import type { CampaignBrief } from "../types";

/**
 * Từ khoá LOẠI sản phẩm của brief (vd "kem chống nắng"): contentKeywords, nếu không có thì tên sản phẩm.
 * Dùng cho cả tìm nguồn (video / sản phẩm theo keyword) lẫn nhận diện "sản phẩm cùng loại".
 * Không dùng brief.keywords vì có cả từ chung chung ("skincare", "dưỡng da") -> nhận nhầm sản phẩm khác.
 */
export function productTypeKeywords(brief: Pick<CampaignBrief, "product" | "contentKeywords">): string[] {
  // Tên sản phẩm viết thường: giữ đúng tham số đã gửi Kalodata trước đây -> dùng lại được dữ liệu đã lưu
  return brief.contentKeywords?.length ? brief.contentKeywords : [brief.product.toLowerCase()];
}
