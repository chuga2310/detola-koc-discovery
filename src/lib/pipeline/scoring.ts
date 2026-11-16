/**
 * Prefilter scoring: 100% deterministic, 0 token.
 *
 * Ý tưởng: phần lớn creator trong pool có thể loại/xếp hạng bằng số liệu thuần
 * (follower, engagement, khán giả, ngành hàng, chi phí). AI chỉ nên được dùng cho
 * những gì số liệu không nói được (phong cách, chất lượng video, rủi ro).
 *
 * Mỗi metric được chuẩn hoá bằng percentile trong pool (0..1) rồi cộng có trọng số.
 * Mọi điểm đều có breakdown -> giải thích được, không phải "hộp đen".
 */
import type { CampaignBrief, CreatorRecord } from "../types";
import { clamp, keywordHits, normalizeVi, percentileRanks } from "../util";
import { productTypeKeywords, signalsOf } from "./signals";

/** Bảng giá ước tính / 1 video theo tier follower (VND). Giả định — chỉnh theo báo giá thực tế. */
export const DEFAULT_RATE_CARD: { maxFollowers: number; priceVnd: number; tier: string }[] = [
  { maxFollowers: 10_000, priceVnd: 800_000, tier: "nano (<10k)" },
  { maxFollowers: 50_000, priceVnd: 2_000_000, tier: "micro (10k-50k)" },
  { maxFollowers: 100_000, priceVnd: 4_000_000, tier: "micro+ (50k-100k)" },
  { maxFollowers: 300_000, priceVnd: 7_000_000, tier: "mid (100k-300k)" },
  { maxFollowers: 700_000, priceVnd: 12_000_000, tier: "mid+ (300k-700k)" },
  { maxFollowers: 1_500_000, priceVnd: 20_000_000, tier: "macro (700k-1.5M)" },
  { maxFollowers: Infinity, priceVnd: 35_000_000, tier: "mega (>1.5M)" },
];

export function estimateCost(followers: number) {
  const row = DEFAULT_RATE_CARD.find((r) => followers <= r.maxFollowers)!;
  return { priceVnd: row.priceVnd, tier: row.tier };
}

const BEAUTY_CATEGORY_HINTS = [
  "beauty",
  "personal care",
  "skincare",
  "skin care",
  "makeup",
  "cosmetic",
  "lam dep",
  "my pham",
  "cham soc da",
  "cham soc ca nhan",
  "sac dep",
];

export function categoryRelevance(c: CreatorRecord, brief: CampaignBrief): number {
  const target = normalizeVi(brief.category);
  let share = 0;
  for (const cat of c.categories) {
    const n = normalizeVi(cat.name);
    if (n.includes(target) || target.includes(n) || BEAUTY_CATEGORY_HINTS.some((h) => n.includes(h))) {
      share += cat.share;
    }
  }
  return clamp(share);
}

/** Tỷ lệ khán giả nằm trong độ tuổi mục tiêu (cộng theo phần giao giữa bucket và [ageMin, ageMax]) */
export function ageMatch(buckets: Record<string, number> | undefined, ageMin: number, ageMax: number): number | null {
  if (!buckets || !Object.keys(buckets).length) return null;
  let share = 0;
  for (const [k, v] of Object.entries(buckets)) {
    const m = k.match(/(\d+)\s*[-–]\s*(\d+)/);
    const plus = k.match(/(\d+)\s*\+/);
    const lo = m ? Number(m[1]) : plus ? Number(plus[1]) : NaN;
    const hi = m ? Number(m[2]) : plus ? 65 : NaN;
    if (Number.isNaN(lo)) continue;
    const overlap = Math.max(0, Math.min(hi, ageMax) - Math.max(lo, ageMin) + 1);
    share += v * (overlap / (hi - lo + 1));
  }
  return clamp(share);
}

export function audienceMatch(c: CreatorRecord, brief: CampaignBrief): { score: number | null; gender: number | null; age: number | null } {
  const g = brief.targetAudience.gender;
  const fem = c.audience?.femalePct;
  const gender = fem === undefined ? null : g === "female" ? fem : g === "male" ? 1 - fem : 1;
  const age = ageMatch(c.audience?.ageBuckets, brief.targetAudience.ageMin, brief.targetAudience.ageMax);
  if (gender === null && age === null) return { score: null, gender, age };
  return { score: (gender ?? 0.6) * 0.5 + (age ?? 0.5) * 0.5, gender, age };
}

export function engagementRate(c: CreatorRecord): number | undefined {
  if (c.metrics.engagementRate !== undefined) return c.metrics.engagementRate;
  const v = c.videos.reduce((s, x) => s + x.views, 0);
  if (!v) return undefined;
  return c.videos.reduce((s, x) => s + x.likes + x.comments + x.shares, 0) / v;
}

/** View điển hình / video. Có video chi tiết -> trung vị view TỰ NHIÊN (đã trừ view quảng cáo). */
export function avgViews(c: CreatorRecord): number | undefined {
  const organic = signalsOf(c).organicMedianViews;
  if (organic) return organic;
  if (c.metrics.avgViewsPerVideo) return c.metrics.avgViewsPerVideo;
  if (c.metrics.videoViews && c.metrics.videoCount) return c.metrics.videoViews / c.metrics.videoCount;
  if (!c.videos.length) return undefined;
  return c.videos.reduce((s, x) => s + x.views, 0) / c.videos.length;
}

export function keywordCoverage(c: CreatorRecord, keywords: string[]) {
  const texts = [
    ...c.videos.map((v) => `${v.caption} ${v.hashtags.join(" ")} ${v.productTitle ?? ""}`),
    ...(c.topProducts ?? []).map((p) => p.title),
    ...(c.subCategories ?? []), // ví dụ ngành cấp 3 "Kem chống nắng"
    ...(c.soldProducts ?? []).map((p) => p.name), // sản phẩm đã thực sự bán (nguồn "proven" / danh mục)
  ];
  const hitsPerText = texts.map((t) => keywordHits(t, keywords));
  const matched = new Set(hitsPerText.flat());
  const videoHits = c.videos.filter((_, i) => hitsPerText[i].length > 0).length;
  const catHits = (c.subCategories ?? []).filter((x) => keywordHits(x, keywords).length > 0).length;
  return {
    matchedKeywords: [...matched],
    videosWithHits: videoHits,
    totalVideos: c.videos.length,
    score: c.videos.length
      ? clamp(videoHits / Math.min(c.videos.length, 6) + 0.15 * catHits)
      : clamp(0.3 * Math.min(1, matched.size) + 0.15 * catHits),
  };
}

export const PREFILTER_WEIGHTS = {
  audience: 0.15,
  engagement: 0.15,
  reach: 0.15,
  category: 0.1,
  keyword: 0.15,
  commerce: 0.1,
  costEfficiency: 0.1,
  videoFocus: 0.05,
  /** Đà tăng follower 30 ngày (chỉ có sau enrich; thiếu = trung tính) */
  momentum: 0.05,
};

/** Tỷ trọng doanh thu đến từ VIDEO (vs livestream). KOC cho campaign video nên làm video là chính. */
export function videoFocus(c: CreatorRecord): number | undefined {
  const v = c.metrics.videoRevenueVnd;
  const l = c.metrics.liveRevenueVnd;
  if (v === undefined && l === undefined) return undefined;
  const total = (v ?? 0) + (l ?? 0);
  return total > 0 ? (v ?? 0) / total : 0.5;
}

export interface PrefilterRow {
  id: string;
  handle: string;
  followers: number;
  estCostVnd: number;
  costTier: string;
  passed: boolean;
  dropReasons: string[];
  /** 0..1 */
  dataScore: number;
  breakdown: Record<keyof typeof PREFILTER_WEIGHTS, number>;
  raw: {
    engagementRate?: number;
    avgViews?: number;
    revenueVnd?: number;
    audienceGender: number | null;
    audienceAge: number | null;
    categoryShare: number;
    keywordVideos: number;
    keywordTotal: number;
    matchedKeywords: string[];
    videoFocus?: number;
    videoViews30d?: number;
    /** 0..1 view đến từ quảng cáo */
    paidViewShare?: number;
    videoGpm?: number;
    avgUnitPriceVnd?: number;
    followerGrowthPct?: number;
  };
}

export function prefilter(creators: CreatorRecord[], brief: CampaignBrief): PrefilterRow[] {
  const range = brief.followerRange ?? { min: 10_000, max: 1_000_000 };
  const maxCostPerKoc = brief.budgetVnd * 0.5;

  const base = creators.map((c) => {
    const er = engagementRate(c);
    const av = avgViews(c);
    const aud = audienceMatch(c, brief);
    const cat = categoryRelevance(c, brief);
    const kw = keywordCoverage(c, brief.keywords);
    // Creator "partial" (mới biết qua nội dung): follower đã được API lọc trong khoảng mục tiêu
    // nhưng chưa biết số cụ thể -> ước tính chi phí theo mức giữa khoảng, kiểm tra lại sau enrich.
    const cost = estimateCost(c.partial ? Math.sqrt(range.min * range.max) : c.followers);
    const reasons: string[] = [];
    if (!c.partial && (c.followers < range.min || c.followers > range.max))
      reasons.push(`followers ${c.followers} ngoài khoảng ${range.min}-${range.max}`);
    if (cost.priceVnd > maxCostPerKoc) reasons.push(`chi phí ước tính ${cost.priceVnd} > 50% ngân sách`);
    if (aud.gender !== null && brief.targetAudience.gender !== "any" && aud.gender < 0.5)
      reasons.push(`khán giả đúng giới tính chỉ ${(aud.gender * 100).toFixed(0)}%`);
    if (cat < 0.15 && kw.matchedKeywords.length === 0) reasons.push("không có tín hiệu ngành hàng/keyword liên quan");
    // Chỉ áp khi có dữ liệu (list-level của Kalodata chưa có số video)
    const recentVideos = c.metrics.videoCount ?? (c.videos.length || undefined);
    if (recentVideos !== undefined && recentVideos < 1 && !c.videos.length) reasons.push("không đăng video trong 30 ngày");
    if (c.creatorStatus === "BELONGED_TO_SELLER") reasons.push("tài khoản thuộc shop/brand, không phải KOC độc lập");
    const vf = videoFocus(c);
    if (vf !== undefined && vf < 0.1) reasons.push("doanh thu gần như toàn bộ từ livestream (không phải KOC video)");
    const sig = signalsOf(c, productTypeKeywords(brief));
    return { c, er, av, aud, cat, kw, cost, reasons, vf, sig };
  });

  // Percentile trong pool -> các metric khác đơn vị về chung thang 0..1
  const pEr = percentileRanks(base.map((b) => b.er));
  // Reach: tổng view nội dung 30 ngày / follower (độ "lan" của nội dung) + quy mô view tuyệt đối
  // View 30 ngày TỰ NHIÊN: trừ tỷ trọng view quảng cáo (khi biết) — view mua không phải sức hút thật
  const views30 = (b: (typeof base)[number]) => {
    const raw = b.c.metrics.videoViews ?? (b.av && b.c.metrics.videoCount ? b.av * b.c.metrics.videoCount : undefined);
    return raw !== undefined && b.sig.paidViewShare !== undefined ? raw * (1 - b.sig.paidViewShare) : raw;
  };
  const pReach = percentileRanks(base.map((b) => (views30(b) && b.c.followers ? views30(b)! / b.c.followers : undefined)));
  const pAv = percentileRanks(base.map((b) => views30(b)));
  const pRev = percentileRanks(base.map((b) => b.c.metrics.videoRevenueVnd ?? b.c.metrics.revenueVnd));
  const pCostEff = percentileRanks(base.map((b) => (views30(b) ? views30(b)! / b.cost.priceVnd : undefined)));
  // Chuyển đổi: GPM video (doanh thu / 1000 view) — chỉ có sau enrich
  const pGpm = percentileRanks(base.map((b) => b.sig.videoGpm));
  const pGrowth = percentileRanks(base.map((b) => b.sig.followerGrowthPct));

  const rows: PrefilterRow[] = base.map((b, i) => {
    const breakdown = {
      audience: b.aud.score ?? 0.45, // không có data -> hơi dưới trung bình (ưu tiên creator có data minh bạch)
      engagement: pEr[i],
      reach: pReach[i] * 0.5 + pAv[i] * 0.5,
      // partial = tìm thấy qua nội dung đúng sản phẩm nhưng chưa biết ngành hàng bán -> trung tính
      // Có doanh thu theo ngành (trả phí): pha 50/50 với tín hiệu danh mục để thưởng creator chuyên ngành
      category: b.sig.categoryRevenueShare !== undefined ? 0.5 * b.cat + 0.5 * b.sig.categoryRevenueShare : b.c.partial && !b.c.categories.length ? 0.5 : b.cat,
      keyword: b.kw.score,
      // Có GPM: ưu tiên chuyển đổi (60%) hơn doanh thu tuyệt đối (40%) để không thiên vị tài khoản lớn
      commerce: b.sig.videoGpm !== undefined ? 0.6 * pGpm[i] + 0.4 * pRev[i] : pRev[i],
      costEfficiency: pCostEff[i],
      videoFocus: b.vf ?? 0.5,
      momentum: b.sig.followerGrowthPct !== undefined ? pGrowth[i] : 0.5,
    };
    const dataScore = (Object.keys(PREFILTER_WEIGHTS) as (keyof typeof PREFILTER_WEIGHTS)[]).reduce(
      (s, k) => s + PREFILTER_WEIGHTS[k] * breakdown[k],
      0,
    );
    return {
      id: b.c.id,
      handle: b.c.handle,
      followers: b.c.followers,
      estCostVnd: b.cost.priceVnd,
      costTier: b.cost.tier,
      passed: b.reasons.length === 0,
      dropReasons: b.reasons,
      dataScore: Number(dataScore.toFixed(4)),
      breakdown,
      raw: {
        engagementRate: b.er,
        avgViews: b.av,
        revenueVnd: b.c.metrics.revenueVnd,
        audienceGender: b.aud.gender,
        audienceAge: b.aud.age,
        categoryShare: b.cat,
        keywordVideos: b.kw.videosWithHits,
        keywordTotal: b.kw.totalVideos,
        matchedKeywords: b.kw.matchedKeywords,
        videoFocus: b.vf,
        videoViews30d: views30(b),
        paidViewShare: b.sig.paidViewShare,
        videoGpm: b.sig.videoGpm,
        avgUnitPriceVnd: b.sig.avgUnitPriceVnd,
        followerGrowthPct: b.sig.followerGrowthPct,
      },
    };
  });

  return rows.sort((a, b) => Number(b.passed) - Number(a.passed) || b.dataScore - a.dataScore);
}
