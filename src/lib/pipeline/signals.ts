/**
 * Tín hiệu suy ra từ dữ liệu Kalodata ĐÃ CÓ (0 credit thêm), dùng chung cho chấm điểm, AI và UI.
 *
 * - View quảng cáo: Kalodata cho biết % view mỗi video đến từ quảng cáo. ~3/4 video trong pool có chạy
 *   quảng cáo -> view thô thổi phồng sức hút tự nhiên. Reach phải tính trên view TỰ NHIÊN.
 * - GPM video: doanh thu / 1000 view -> khả năng chuyển đổi, không thiên vị tài khoản lớn như doanh thu tuyệt đối.
 * - Giá trung bình sản phẩm đã bán: khán giả quen mua ở phân khúc giá nào.
 * - Đà tăng: follower mới 30 ngày / follower; doanh thu 30 ngày đều hay chỉ 1 cú viral.
 * - Độ thật: số video gắn cờ AI tạo; kênh liên hệ (chỉ lưu TÊN kênh, không lưu giá trị).
 */
import type { CreatorRecord, CreatorVideo } from "../types";

export interface CreatorSignals {
  /** 0..1: tỷ trọng view đến từ quảng cáo, có trọng số theo view, trên các video có số liệu */
  paidViewShare?: number;
  /** Trung vị view TỰ NHIÊN (đã trừ view quảng cáo) của các video đã biết */
  organicMedianViews?: number;
  /** Doanh thu video / 1000 view (VND) */
  videoGpm?: number;
  /** Giá trung bình sản phẩm đã bán (VND) */
  avgUnitPriceVnd?: number;
  /** Follower mới 30 ngày / follower hiện tại (0..1) */
  followerGrowthPct?: number;
  /** Số ngày có doanh thu trong 30 ngày */
  revenueActiveDays?: number;
  /** So 10 ngày cuối với 10 ngày đầu của chuỗi doanh thu */
  revenueTrend?: "up" | "flat" | "down";
  aiVideoCount: number;
  contactChannels: string[];
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const organicViews = (v: CreatorVideo) =>
  v.adViewRatio !== undefined ? v.views * (1 - Math.min(100, Math.max(0, v.adViewRatio)) / 100) : v.views;

export function signalsOf(c: CreatorRecord): CreatorSignals {
  const known = c.videos.filter((v) => v.adViewRatio !== undefined && v.views > 0);
  const totalKnown = known.reduce((s, v) => s + v.views, 0);
  const paidViewShare = totalKnown ? known.reduce((s, v) => s + v.views - organicViews(v), 0) / totalKnown : undefined;

  const trend = c.metrics.revenueTrend30d;
  let revenueActiveDays: number | undefined;
  let revenueTrend: CreatorSignals["revenueTrend"];
  if (trend?.length) {
    revenueActiveDays = trend.filter((x) => x > 0).length;
    const k = Math.max(1, Math.floor(trend.length / 3));
    const first = trend.slice(0, k).reduce((s, x) => s + x, 0);
    const last = trend.slice(-k).reduce((s, x) => s + x, 0);
    revenueTrend = first === 0 && last === 0 ? "flat" : last > first * 1.25 ? "up" : last < first * 0.8 ? "down" : "flat";
  }

  return {
    paidViewShare,
    organicMedianViews: c.videos.length ? median(c.videos.map(organicViews)) : undefined,
    videoGpm: c.metrics.videoGpm || undefined,
    avgUnitPriceVnd: c.metrics.avgUnitPriceVnd || undefined,
    followerGrowthPct: c.metrics.followerGrowth !== undefined && c.followers > 0 ? c.metrics.followerGrowth / c.followers : undefined,
    revenueActiveDays,
    revenueTrend,
    aiVideoCount: c.videos.filter((v) => v.isAiVideo).length,
    contactChannels: c.contactChannels ?? [],
  };
}
