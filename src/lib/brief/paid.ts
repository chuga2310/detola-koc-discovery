/**
 * Dữ liệu chuyên sâu = tính năng TRẢ PHÍ (tốn thêm credit Kalodata), người dùng phải tự bật.
 * File dùng chung client + server: UI hiện cảnh báo và ước tính chi phí; server cộng phần này vào
 * trần credit của chiến dịch.
 */
export type PaidFeatureId = "categoryRevenue" | "videoDetail" | "competitorProducts";

/** Số người đi qua từng tầng của phễu (đồng bộ với funnelFor ở config.ts) */
const prefilterKeep = (n: number) => Math.max(20, 4 * n);
const videoKeep = (n: number) => Math.max(10, 2 * n);

export const CREDIT_USD = 0.1;

export const PAID_FEATURES: { id: PaidFeatureId; title: string; description: string; credits: (numKocs: number) => number }[] = [
  {
    id: "categoryRevenue",
    title: "Doanh thu theo ngành",
    description: "Doanh thu, GPM và số bán của creator chỉ trong ngành làm đẹp. Phân biệt người chuyên beauty với người bán đủ thứ.",
    credits: (n) => 0.1 * prefilterKeep(n),
  },
  {
    id: "videoDetail",
    title: "Chi tiết video",
    description: "Với các video AI xem: GPM, số bán, view quảng cáo, ROAS, số ngày chạy quảng cáo, chi phí mỗi đơn (CPA), thời lượng.",
    credits: (n) => 0.1 * videoKeep(n) * 2,
  },
  {
    id: "competitorProducts",
    title: "Sản phẩm creator đang bán",
    description: "Top sản phẩm creator bán gần đây: phát hiện đang quảng bá sản phẩm cùng loại hoặc của đối thủ.",
    credits: (n) => 0.1 * videoKeep(n),
  },
];

export type DeepData = Partial<Record<PaidFeatureId, boolean>>;

export function paidCredits(deep: DeepData | undefined, numKocs: number): number {
  return Number(
    PAID_FEATURES.filter((f) => deep?.[f.id])
      .reduce((s, f) => s + f.credits(numKocs), 0)
      .toFixed(1),
  );
}

/** "demo" (mặc định): được bật để dùng thử; "on": bật cho khách trả phí; "off": khoá */
export type PaidMode = "demo" | "on" | "off";
