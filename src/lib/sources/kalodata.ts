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
import { kaloRequest } from "./kalodataApi";

/** Mặc định: Makeup (848648) + Skincare (848776) — category cấp 2 của Kalodata, ngành Beauty & Personal Care */
const DEFAULT_CATEGORY_IDS = "848648,848776";
const SKINCARE_CATEGORY_ID = "848776";

const n = (x: unknown): number | undefined => {
  const v = typeof x === "string" ? Number(x) : (x as number);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

/** Che số điện thoại / email / link trong bio trước khi lưu + đưa vào prompt (dữ liệu cá nhân, không cần cho đánh giá) */
export function redactContact(s: string | undefined): string | undefined {
  if (!s) return s;
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(\+?84|0)[\d .-]{8,12}\d/g, "[phone]")
    .replace(/https?:\/\/\S+/g, "[link]");
}

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
  creator_contact_email?: string;
  creator_contact_zalo?: string;
  creator_contact_facebook?: string;
  creator_contact_ins?: string;
  creator_contact_whatsapp?: string;
  creator_contact_line?: string;
}

/** Chỉ ghi nhận CÓ kênh liên hệ nào (để marketer biết đường booking), không lưu email/số điện thoại */
const CONTACT_FIELDS: [keyof DetailData, string][] = [
  ["creator_contact_email", "Email"],
  ["creator_contact_zalo", "Zalo"],
  ["creator_contact_facebook", "Facebook"],
  ["creator_contact_ins", "Instagram"],
  ["creator_contact_whatsapp", "WhatsApp"],
  ["creator_contact_line", "Line"],
];

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

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function baseParams() {
  return { region: "VN", language: "vi-VN", currency: "VND", date_range: "last30Day" };
}

export const kalodataSource: DataSource = {
  name: "kalodata",

  /**
   * Multi-signal retrieval: 3 nguồn bổ sung cho nhau (mỗi nguồn ~0.1 credit / 100 dòng).
   *  1. commerce:   xếp theo doanh thu từ VIDEO -> creator chứng minh được khả năng bán qua video.
   *  2. engagement: ER >= 8% (filter MEDIUM của API), xếp theo lượt xem nội dung -> creator nội dung
   *                 có sức hút tự nhiên (KOC "thật"), thường không lọt top doanh thu.
   *  3. content:    video 30 ngày có title chứa keyword sản phẩm -> creator ĐÃ làm đúng loại nội dung.
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
    const rankQueries: { tag: string; body: Record<string, unknown> }[] = [
      // KOC làm video -> doanh thu từ VIDEO (tổng doanh thu bị seller livestream chiếm)
      { tag: "commerce", body: { sort_field: { field: "video_revenue", type: "DESC" } } },
      // ER >= 8% + bán được SKINCARE qua video: creator có sức hút tự nhiên VÀ đúng ngành chăm da
      {
        tag: "engagement",
        body: {
          sort_field: { field: "video_revenue", type: "DESC" },
          engagement_rate: "MEDIUM",
          category_id_list: brief.kalodataSkincareCategoryId ?? SKINCARE_CATEGORY_ID,
        },
      },
    ];
    const pages = Math.ceil(limit / pageSize); // N lớn -> pool lớn -> nhiều trang (0.1 credit / trang 100 dòng)
    for (const q of rankQueries) for (let page = 1; page <= pages; page++) {
      const rows = await kaloRequest<RankRow[]>(
        "/tiktok/creator/rank",
        {
          ...baseParams(),
          page_size: pageSize,
          page_number: page,
          category_id_list: brief.kalodataCategoryIds ?? DEFAULT_CATEGORY_IDS,
          followers_range: `${range.min}-${range.max}`,
          creator_type: "INDEPENDENT", // loại tài khoản của shop/brand ngay từ API
          need_category: 1,
          need_ter_category: 1,
          ...q.body, // tham số riêng của từng nguồn (sort, ER, category) ghi đè mặc định
        },
        { runId, expectedRows: pageSize },
      );
      const list = Array.isArray(rows) ? rows : [];
      for (const r of list) add(mapRankRow(r), q.tag);
      if (list.length < pageSize) break;
    }

    // Nguồn 3 — theo NỘI DUNG: video 30 ngày có title chứa keyword sản phẩm (vd "chống nắng").
    // 0.1 credit / 100 video. Tìm đúng creator ĐÃ làm nội dung về loại sản phẩm này, thứ mà
    // xếp hạng doanh thu không thấy được.
    for (const kw of brief.contentKeywords ?? []) {
      const vids = await kaloRequest<(VideoRow & { belonged_creator_id: string; belonged_creator_handle?: string })[]>(
        "/tiktok/video/rank",
        {
          ...baseParams(),
          keyword: kw,
          followers_range: `${range.min}-${range.max}`,
          sort_field: { field: "views", type: "DESC" },
          page_size: 100,
          page_number: 1,
        },
        { runId, expectedRows: 100 },
      );
      for (const v of Array.isArray(vids) ? vids : []) {
        const id = String(v.belonged_creator_id);
        const handle = String(v.belonged_creator_handle ?? "").replace(/^@/, "");
        // Creator chỉ xuất hiện qua nội dung: chưa có số liệu list-level -> enrich sẽ bổ sung.
        // Follower đã được API lọc trong khoảng mục tiêu.
        const c = add(
          pool.get(id) ?? { id, handle, nickname: handle, followers: 0, region: "VN", source: "kalodata", metrics: {}, categories: [], videos: [], enriched: false, partial: true },
          "content",
        );
        if (!c.videos.some((x) => x.id === String(v.video_id))) c.videos.push(mapVideo(c.handle || handle, v));
      }
    }
    return [...pool.values()];
  },

  async enrich(c: CreatorRecord, { runId }: { brief: CampaignBrief; runId?: string | null }) {
    if (c.enriched) return c;
    const detail = await kaloRequest<DetailData>(
      "/tiktok/creator/detail",
      { ...baseParams(), creator_id: c.id, need_extra: true },
      { runId },
    );
    const videos = await kaloRequest<VideoRow[]>(
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
      contactChannels: CONTACT_FIELDS.filter(([k]) => typeof detail?.[k] === "string" && (detail[k] as string).trim()).map(([, name]) => name),
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
};
