/**
 * Domain types dùng chung cho toàn hệ thống.
 *
 * Nguyên tắc: mọi data source (Kalodata, fixture, ...) đều được map về
 * `CreatorRecord` chuẩn hoá. Pipeline chỉ làm việc với type này, nên đổi
 * data source không ảnh hưởng tới các stage phía sau.
 */

export interface CampaignBrief {
  /** Tên thương hiệu / chiến dịch, chỉ để hiển thị */
  brand: string;
  /** Sản phẩm cần quảng bá, ví dụ "Kem chống nắng nâng tông SPF50+" */
  product: string;
  /** Ngành hàng mục tiêu (dùng để lọc category trên Kalodata) */
  category: string;
  /** Mô tả ngắn về sản phẩm / USP, đưa vào prompt cho AI hiểu context */
  productNotes?: string;
  /** Từ khoá liên quan sản phẩm, dùng cho keyword relevance (không cần AI) */
  keywords: string[];
  targetAudience: {
    gender: "female" | "male" | "any";
    ageMin: number;
    ageMax: number;
  };
  /** Ngân sách tổng (VND) */
  budgetVnd: number;
  /** Số KOC cần chọn */
  numKocs: number;
  /** Giới hạn follower để đúng "KOC" (micro/mid creator), không phải celeb */
  followerRange?: { min: number; max: number };
  /** Thị trường, mặc định VN */
  region?: string;
  /** ID category Kalodata để lọc pool (mặc định Skincare + Makeup) */
  kalodataCategoryIds?: string;
  /** ID category Kalodata cho nguồn "engagement" (mặc định Skincare 848776) */
  kalodataSkincareCategoryId?: string;
  /** Keyword tìm video theo nội dung để bổ sung pool (vd "chống nắng"); 0.1 credit / keyword */
  contentKeywords?: string[];
}

export interface CreatorVideo {
  id: string;
  url: string;
  caption: string;
  hashtags: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  publishedAt?: string; // ISO date
  durationSec?: number;
  revenueVnd?: number;
  coverUrl?: string;
  /** Sản phẩm gắn trong video (TikTok Shop), nếu có */
  productTitle?: string;
  /** % view đến từ quảng cáo trả tiền (0..100) -> view "mua" không phản ánh sức hút tự nhiên */
  adViewRatio?: number;
  isAd?: boolean;
}

export interface CreatorRecord {
  /** TikTok user id (ổn định, dùng làm khoá chính) */
  id: string;
  handle: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  followers: number;
  region: string;
  source: "kalodata" | "fixture";
  /** Số liệu 30 ngày gần nhất */
  metrics: {
    revenueVnd?: number;
    itemsSold?: number;
    videoViews?: number;
    videoCount?: number;
    liveCount?: number;
    avgViewsPerVideo?: number;
    /** (like + comment + share) / views */
    engagementRate?: number;
    followerGrowth?: number;
    /** Doanh thu từ video vs livestream: KOC review video khác seller chuyên live */
    videoRevenueVnd?: number;
    liveRevenueVnd?: number;
    /** Số sản phẩm / shop đã hợp tác: quá nhiều = "bán mọi thứ", ít tập trung */
    productCount?: number;
    shopCount?: number;
  };
  /** Phân bổ khán giả (follower demographics). Có thể thiếu nếu nguồn không có. */
  audience?: {
    femalePct?: number; // 0..1
    /** key dạng "18-24", "25-34", ... ; value 0..1 */
    ageBuckets?: Record<string, number>;
  };
  /** Ngành hàng creator bán / nói tới, share 0..1 */
  categories: { name: string; share: number }[];
  /** Ngành hàng cấp 3 (ví dụ "Kem chống nắng", "Serum & Tinh chất") */
  subCategories?: string[];
  /** INDEPENDENT = creator độc lập; BELONGED_TO_SELLER = tài khoản của shop/brand */
  creatorStatus?: string;
  /** true khi đã gọi detail + video (lazy enrichment) */
  enriched?: boolean;
  /** true khi mới chỉ biết creator qua nội dung (chưa có follower/doanh thu) -> chờ enrich */
  partial?: boolean;
  /** Nguồn tìm thấy creator: commerce | engagement | content (để chia suất prefilter) */
  sources?: string[];
  topProducts?: { title: string; category?: string; priceVnd?: number }[];
  videos: CreatorVideo[];
  hasContact?: boolean;
  /** Raw data gốc (để debug / audit), không đưa vào prompt */
  raw?: unknown;
}

/** Các stage của pipeline theo thứ tự chạy */
export const STAGES = [
  "source",
  "prefilter",
  "enrich",
  "text_screen",
  "media_prep",
  "video_analysis",
  "final_rank",
  "select",
] as const;
export type StageName = (typeof STAGES)[number];

export type RunStatus =
  | "queued"
  | "running"
  | "interrupted"
  | "completed"
  | "failed";

/** Một mẩu bằng chứng có ID để AI trích dẫn và UI render lại */
export interface Evidence {
  id: string; // ví dụ "c3.m1", "c3.v1.f4"
  kind: "metric" | "video" | "text" | "audience";
  text: string;
  /** Ảnh contact sheet (path tương đối trong media cache) nếu là video evidence */
  image?: string;
  videoUrl?: string;
  frame?: number | null;
}
