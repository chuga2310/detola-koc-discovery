/**
 * Kalodata source qua Open API (chính thức, xác thực bằng API key).
 *
 * Chiến lược "lazy enrichment" để tiết kiệm credit:
 *   search():  1 call creator/rank (100 dòng = 0.1 credit) -> pool đầy đủ chỉ số list-level.
 *              Filter đẩy xuống API: VN, ngành hàng, khoảng follower, creator độc lập (loại tài khoản shop).
 *   enrich():  CHỈ cho creator qua prefilter: creator/detail (0.1) + video/rank theo creator (0.1).
 *              => ~0.2 credit / creator thay vì gọi detail cho cả pool.
 *
 * Kalodata Open API không trả nhân khẩu học follower (tuổi/giới tính) -> audience để trống,
 * AI suy luận khán giả từ nội dung (đã ghi rõ trong rubric + README).
 */
import type { CampaignBrief, CreatorRecord, CreatorVideo } from "../types";
import type { DataSource, SourceQuery } from "./index";
import { logEvent } from "../db";
import { median, redactContact } from "../util";
import { productTypeKeywords } from "../brief/keywords";
import { creatorCategoryDetail, detailQuery, rankQuery } from "./kaloStore";

/** Mặc định: Makeup (848648) + Skincare (848776) — category cấp 2 của Kalodata, ngành Beauty & Personal Care */
const DEFAULT_CATEGORY_IDS = "848648,848776";
const SKINCARE_CATEGORY_ID = "848776";

const n = (x: unknown): number | undefined => {
  const v = typeof x === "string" ? Number(x) : (x as number);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

interface RankRow {
  creator_id: string;
  creator_nickname?: string;
  creator_handle?: string;
  revenue?: number;
  revenue_growth_rate?: number;
  content_views?: string | number;
  creator_followers?: string | number;
  sales_volumn?: number;
  video_revenue?: number;
  live_revenue?: number;
  category_list?: string[];
  ter_category_list?: string[];
}

interface DetailData {
  creator_status?: string;
  creator_bio?: string;
  revenue?: number;
  sales_volumn?: number;
  video_revenue?: number;
  live_revenue?: number;
  video_views?: number;
  new_followers?: number;
  video_number?: number;
  live_number?: number;
  product_number?: number;
  shop_number?: number;
  creator_followers?: string | number;
  video_gpm?: number;
  unit_price?: number;
  revenue_trend?: number[];
  /** Tên các kênh liên hệ công khai (kaloStore tách sẵn, không lưu email/số điện thoại) */
  contact_channels?: string[];
}

interface ProductRow {
  product_id: string | number;
  product_name?: string;
  seller_name?: string;
  revenue?: number;
  unit_price?: number;
  pri_category?: unknown;
  sec_category?: unknown;
  ter_category?: unknown;
}

interface VideoDetailData {
  video_gpm?: number;
  sales_volumn?: number;
  ads_views?: number;
  ads_roas?: number;
  ads_period?: number;
  ad_cpa?: number;
  duration?: number;
  product_number?: number;
}

const categoryName = (c: unknown) =>
  c && typeof c === "object" ? ((c as { category_name?: string }).category_name ?? undefined) : typeof c === "string" ? c : undefined;

type SoldProduct = NonNullable<CreatorRecord["soldProducts"]>[number];
function mergeProducts(cur: SoldProduct[] | undefined, more: SoldProduct[]): SoldProduct[] {
  const out = [...(cur ?? [])];
  for (const p of more) if (!out.some((x) => x.id === p.id)) out.push(p);
  return out;
}

const partialCreator = (id: string, handle: string): CreatorRecord => ({
  id,
  handle,
  nickname: handle,
  followers: 0,
  region: "VN",
  source: "kalodata",
  metrics: {},
  categories: [],
  videos: [],
  enriched: false,
  partial: true,
});

interface VideoRow {
  video_id: string;
  video_title?: string;
  revenue?: number;
  views?: number;
  digg_count?: number;
  share_count?: number;
  comment_count?: number;
  ad?: number;
  ad_view_ratio?: number;
  ad_revenue_ratio?: number;
  ai_video?: number;
  creator_debut?: string;
  publish_date?: string;
}

export function mapRankRow(r: RankRow): CreatorRecord {
  // category_list là top 3 ngành (không có tỷ trọng) -> gán trọng số theo thứ tự
  const weights = [0.6, 0.25, 0.15];
  return {
    id: String(r.creator_id),
    handle: String(r.creator_handle ?? "").replace(/^@/, ""),
    nickname: r.creator_nickname ?? "",
    followers: n(r.creator_followers) ?? 0,
    region: "VN",
    source: "kalodata",
    metrics: {
      revenueVnd: n(r.revenue),
      itemsSold: n(r.sales_volumn),
      videoViews: n(r.content_views),
      videoRevenueVnd: n(r.video_revenue),
      liveRevenueVnd: n(r.live_revenue),
      revenueGrowthPct: n(r.revenue_growth_rate),
    },
    categories: (r.category_list ?? []).map((name, i) => ({ name, share: weights[i] ?? 0.1 })),
    subCategories: r.ter_category_list ?? [],
    videos: [],
    enriched: false,
  };
}

function mapVideo(handle: string, v: VideoRow): CreatorVideo {
  const caption = v.video_title ?? "";
  const pub = v.publish_date ? new Date(v.publish_date.replace(/\//g, "-").replace(" ", "T") + "+07:00") : null;
  return {
    id: String(v.video_id),
    url: `https://www.tiktok.com/@${handle}/video/${v.video_id}`,
    caption,
    hashtags: caption.match(HASHTAG_RE)?.map((h) => h.slice(1)) ?? [],
    views: n(v.views) ?? 0,
    likes: n(v.digg_count) ?? 0,
    comments: n(v.comment_count) ?? 0,
    shares: n(v.share_count) ?? 0,
    publishedAt: pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : undefined,
    revenueVnd: n(v.revenue),
    adViewRatio: n(v.ad_view_ratio),
    adRevenueRatio: n(v.ad_revenue_ratio),
    isAd: v.ad === 1,
    isAiVideo: v.ai_video === 1,
  };
}

export function baseParams() {
  return { region: "VN", language: "vi-VN", currency: "VND", date_range: "last30Day" };
}

export const kalodataSource: DataSource = {
  name: "kalodata",

  /**
   * Multi-signal retrieval: 5 nguồn bổ sung cho nhau (chi tiết từng nguồn ở comment trong hàm).
   *  commerce (bán qua video) · engagement (ER cao, đúng ngành) · rising (tăng trưởng nhanh)
   *  · content (đã làm video đúng sản phẩm) · proven (đã bán sản phẩm cùng loại).
   * Lý do: Kalodata là dữ liệu TikTok Shop, nếu chỉ xếp theo doanh thu pool sẽ toàn affiliate
   * "deal-poster". Mỗi creator mang tag nguồn để prefilter chia suất công bằng.
   */
  async search({ brief, limit, runId }: SourceQuery) {
    const range = brief.followerRange ?? { min: 10_000, max: 500_000 };
    const pageSize = Math.min(100, limit); // 100 dòng / call = 0.1 credit
    const pool = new Map<string, CreatorRecord>();
    const add = (c: CreatorRecord, tag: string) => {
      const cur = pool.get(c.id) ?? c;
      cur.sources = [...new Set([...(cur.sources ?? []), tag])];
      pool.set(c.id, cur);
      return cur;
    };
    const common = {
      ...baseParams(),
      category_id_list: brief.kalodataCategoryIds ?? DEFAULT_CATEGORY_IDS,
      followers_range: `${range.min}-${range.max}`,
      creator_type: "INDEPENDENT", // loại tài khoản của shop/brand ngay từ API
      need_category: 1,
      need_ter_category: 1,
    };
    const skincare = brief.kalodataSkincareCategoryId ?? SKINCARE_CATEGORY_ID;
    const failures: string[] = [];
    // Mỗi nguồn chạy độc lập: 1 nguồn lỗi (API, tham số) không làm hỏng cả bước
    const source = async (tag: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        failures.push(`${tag}: ${(err as Error).message.slice(0, 160)}`);
        if (runId) logEvent(runId, `Nguồn "${tag}" lỗi, bỏ qua: ${(err as Error).message.slice(0, 160)}`, { level: "warn", stage: "source" });
      }
    };
    const pages = Math.ceil(limit / pageSize); // N lớn -> pool lớn -> nhiều trang (0.1 credit / trang 100 dòng)
    const creatorRank = async (tag: string, body: Record<string, unknown>, size = pageSize, maxPages = pages) => {
      for (let page = 1; page <= maxPages; page++) {
        const list = await rankQuery<RankRow>(
          "/tiktok/creator/rank",
          { ...common, page_size: size, page_number: page, ...body }, // tham số riêng của nguồn ghi đè mặc định
          { runId, expectedRows: size },
        );
        for (const r of list) add(mapRankRow(r), tag);
        if (list.length < size) break;
      }
    };

    // 1. commerce: doanh thu từ VIDEO (tổng doanh thu bị seller livestream chiếm)
    await source("commerce", () => creatorRank("commerce", { sort_field: { field: "video_revenue", type: "DESC" } }));
    // 2. engagement: ER >= 8% + bán được SKINCARE qua video -> sức hút tự nhiên VÀ đúng ngành chăm da
    await source("engagement", () =>
      creatorRank("engagement", { sort_field: { field: "video_revenue", type: "DESC" }, engagement_rate: "MEDIUM", category_id_list: skincare }),
    );
    // 3. rising: tăng trưởng doanh thu nhanh nhất trong skincare (đặt sàn doanh thu để bỏ tài khoản gốc quá nhỏ)
    await source("rising", () =>
      creatorRank(
        "rising",
        { sort_field: { field: "revenue_growth_rate", type: "DESC" }, category_id_list: skincare, revenue_range: "10000000-1000000000000" },
        50,
        1,
      ),
    );

    const keywords = productTypeKeywords(brief);
    // 4. content: video 30 ngày có title chứa keyword sản phẩm -> creator ĐÃ làm đúng loại nội dung.
    //    Bộ lọc miễn phí: bỏ video AI tạo, bỏ video quá ít view, chỉ video đăng trong 30 ngày.
    for (const kw of keywords)
      await source("content", async () => {
        const vids = await rankQuery<VideoRow & { belonged_creator_id: string; belonged_creator_handle?: string }>(
          "/tiktok/video/rank",
          {
            ...baseParams(),
            keyword: kw,
            followers_range: `${range.min}-${range.max}`,
            is_ai_video: 0,
            views_range: "5000-1000000000",
            publish_date_range: "30",
            sort_field: { field: "views", type: "DESC" },
            page_size: 100,
            page_number: 1,
          },
          { runId, expectedRows: 100 },
        );
        for (const v of vids) {
          const id = String(v.belonged_creator_id);
          const handle = String(v.belonged_creator_handle ?? "").replace(/^@/, "");
          // Creator chỉ xuất hiện qua nội dung: chưa có số liệu list-level -> enrich sẽ bổ sung.
          const c = add(pool.get(id) ?? partialCreator(id, handle), "content");
          if (!c.videos.some((x) => x.id === String(v.video_id))) c.videos.push(mapVideo(c.handle || handle, v));
        }
      });

    // 5. proven: creator ĐÃ BÁN sản phẩm cùng loại (top sản phẩm theo keyword -> người bán từng sản phẩm).
    //    Bằng chứng ngách mạnh nhất: không đoán từ caption mà từ đơn hàng thật. ~0.6 credit.
    await source("proven", async () => {
      const products = await rankQuery<ProductRow>(
        "/tiktok/product/rank",
        { ...baseParams(), keyword: keywords[0], sort_field: { field: "revenue", type: "DESC" }, page_size: 10, page_number: 1 },
        { runId, expectedRows: 10 },
      );
      for (const pr of products.slice(0, 5)) {
        const sellers = await rankQuery<RankRow>(
          "/tiktok/creator/rank",
          { ...common, product_id: String(pr.product_id), sort_field: { field: "video_revenue", type: "DESC" }, page_size: 30, page_number: 1 },
          { runId, expectedRows: 30 },
        );
        for (const r of sellers) {
          const c = add(mapRankRow(r), "proven");
          c.soldProducts = mergeProducts(c.soldProducts, [
            { id: String(pr.product_id), name: String(pr.product_name ?? ""), seller: pr.seller_name, revenueVnd: n(pr.revenue), source: "proven" },
          ]);
        }
      }
    });

    if (!pool.size) throw new Error(`Không lấy được creator nào từ Kalodata: ${failures.join(" | ") || "0 kết quả"}`);
    return [...pool.values()];
  },

  async enrich(c: CreatorRecord, { runId }: { brief: CampaignBrief; runId?: string | null }) {
    if (c.enriched) return c;
    const detail = await detailQuery<DetailData>("creator", c.id, { ...baseParams(), creator_id: c.id, need_extra: true }, { runId });
    const videos = await rankQuery<VideoRow>(
      "/tiktok/video/rank",
      {
        ...baseParams(),
        creator_id: c.id,
        sort_field: { field: "views", type: "DESC" },
        page_size: 10,
        page_number: 1,
      },
      { runId, expectedRows: 10 },
    );
    // Giữ video tìm thấy qua keyword (bằng chứng nội dung liên quan) + top video theo view
    const top = (Array.isArray(videos) ? videos : []).map((v) => mapVideo(c.handle, v));
    const vids = [...c.videos, ...top.filter((v) => !c.videos.some((x) => x.id === v.id))];
    const totalViews = vids.reduce((s, v) => s + v.views, 0);
    const er = totalViews ? vids.reduce((s, v) => s + v.likes + v.comments + v.shares, 0) / totalViews : undefined;
    return {
      ...c,
      bio: redactContact(detail?.creator_bio),
      creatorStatus: detail?.creator_status,
      contactChannels: Array.isArray(detail?.contact_channels) ? detail.contact_channels : c.contactChannels,
      debutDate: (Array.isArray(videos) ? videos : []).find((v) => v.creator_debut)?.creator_debut ?? c.debutDate,
      followers: n(detail?.creator_followers) ?? c.followers,
      metrics: {
        ...c.metrics,
        revenueVnd: n(detail?.revenue) ?? c.metrics.revenueVnd,
        itemsSold: n(detail?.sales_volumn) ?? c.metrics.itemsSold,
        videoRevenueVnd: n(detail?.video_revenue) ?? c.metrics.videoRevenueVnd,
        liveRevenueVnd: n(detail?.live_revenue) ?? c.metrics.liveRevenueVnd,
        videoViews: n(detail?.video_views) ?? c.metrics.videoViews,
        videoCount: n(detail?.video_number),
        liveCount: n(detail?.live_number),
        productCount: n(detail?.product_number),
        shopCount: n(detail?.shop_number),
        followerGrowth: n(detail?.new_followers),
        videoGpm: n(detail?.video_gpm),
        avgUnitPriceVnd: n(detail?.unit_price),
        revenueTrend30d: Array.isArray(detail?.revenue_trend) ? detail.revenue_trend.map((x) => Number(x) || 0) : c.metrics.revenueTrend30d,
        // Trung vị view của các video gần đây: bền hơn trung bình (1 video viral không làm lệch)
        avgViewsPerVideo: median(vids.map((v) => v.views)),
        engagementRate: er,
      },
      videos: vids,
      enriched: true,
      partial: false,
    };
  },

  /** [Trả phí] Doanh thu / GPM / số bán chỉ trong ngành của brief: 0.1 credit / creator */
  async categoryDetail(c: CreatorRecord, { brief, runId }: { brief: CampaignBrief; runId?: string | null }) {
    const ids = String(brief.kalodataCategoryIds ?? DEFAULT_CATEGORY_IDS)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const d = await creatorCategoryDetail<DetailData>(c.id, ids, { ...baseParams(), need_extra: true }, { runId });
    if (!d) return c;
    return {
      ...c,
      metrics: { ...c.metrics, categoryRevenueVnd: n(d.revenue), categoryVideoGpm: n(d.video_gpm), categoryItemsSold: n(d.sales_volumn) },
    };
  },

  /** [Trả phí] Chi tiết các video được chọn để AI xem: 0.1 credit / video */
  async videoDetails(c: CreatorRecord, videoIds: string[], { runId }: { brief: CampaignBrief; runId?: string | null }) {
    const videos = [...c.videos];
    for (const id of videoIds) {
      const d = await detailQuery<VideoDetailData>("video", id, { ...baseParams(), video_id: id, need_extra: true }, { runId });
      const i = videos.findIndex((v) => v.id === id);
      if (!d || i < 0) continue;
      videos[i] = {
        ...videos[i],
        stats: {
          gpm: n(d.video_gpm),
          salesVolume: n(d.sales_volumn),
          adsViews: n(d.ads_views),
          adsRoas: n(d.ads_roas),
          adsPeriodDays: n(d.ads_period),
          adCpaVnd: n(d.ad_cpa),
          durationSec: n(d.duration),
          productCount: n(d.product_number),
        },
      };
    }
    return { ...c, videos };
  },

  /** [Trả phí] Top sản phẩm creator đang bán (1 lần xếp hạng sản phẩm theo creator): 0.1 credit / creator */
  async soldProducts(c: CreatorRecord, { runId }: { brief: CampaignBrief; runId?: string | null }) {
    const rows = await rankQuery<ProductRow>(
      "/tiktok/product/rank",
      { ...baseParams(), creator_id: c.id, sort_field: { field: "revenue", type: "DESC" }, page_size: 10, page_number: 1 },
      { runId, expectedRows: 10 },
    );
    return {
      ...c,
      soldProducts: mergeProducts(
        c.soldProducts,
        rows.map((r) => ({
          id: String(r.product_id),
          name: String(r.product_name ?? ""),
          seller: r.seller_name,
          category: categoryName(r.ter_category) ?? categoryName(r.sec_category),
          revenueVnd: n(r.revenue),
          source: "catalog" as const,
        })),
      ),
    };
  },
};
