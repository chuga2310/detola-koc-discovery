/**
 * Zod schema cho output của từng stage AI (structured outputs).
 * Field tuỳ chọn dùng `.nullable()` thay vì `.optional()` để tương thích strict JSON schema.
 */
import { z } from "zod";

// ---------- Stage text_screen (model rẻ, batch nhiều creator / call) ----------
export const TextScreenSchema = z.object({
  results: z.array(
    z.object({
      ref: z.string().describe("Creator ref đúng như input, ví dụ c3"),
      niche: z.string().describe("Ngách nội dung chính, tiếng Việt, <= 8 từ"),
      formats: z.array(z.string()).describe("Dạng nội dung thường làm: review, tutorial, grwm, unboxing, vlog, skit, live"),
      brand_fit: z.number().int().describe("0-10: mức hợp với thương hiệu/sản phẩm"),
      product_relevance: z.number().int().describe("0-10: đã/đang làm nội dung về loại sản phẩm này chưa"),
      audience_fit: z.number().int().describe("0-10: khớp khán giả mục tiêu"),
      red_flags: z.array(z.string()).describe("Rủi ro: hàng nhái, phốt, nội dung nhạy cảm, bán quá nhiều ngành... rỗng nếu không có"),
      summary: z.string().describe("1 câu tiếng Việt tóm tắt vì sao hợp/không hợp"),
    }),
  ),
});
export type TextScreenOutput = z.infer<typeof TextScreenSchema>;

// ---------- Stage video_analysis (vision, KHÔNG phụ thuộc campaign -> cache dùng lại) ----------
export const VIDEO_FORMATS = [
  "review",
  "tutorial",
  "grwm",
  "unboxing",
  "comparison",
  "vlog",
  "skit",
  "livestream_clip",
  "slideshow",
  "other",
] as const;

export const VideoAnalysisSchema = z.object({
  videos: z.array(
    z.object({
      ref: z.string().describe("Video ref như input, ví dụ v1"),
      format: z.enum(VIDEO_FORMATS),
      on_camera: z.enum(["face_to_camera", "hands_product_only", "voiceover_broll", "mixed", "unclear"]),
      hook: z.string().describe("Mô tả 3 giây đầu (frame 1) giữ chân người xem thế nào, tiếng Việt"),
      shows_texture: z.boolean().describe("Có cận cảnh texture sản phẩm"),
      applies_on_skin: z.boolean().describe("Có thoa/dùng thử sản phẩm trên da"),
      before_after: z.boolean(),
      shows_packaging: z.boolean(),
      production_quality: z.number().int().describe("1-5: ánh sáng, khung hình, độ nét, chỉnh sửa"),
      topics: z.array(z.string()).describe("Chủ đề chính, tiếng Việt"),
      brands_or_products: z.array(z.string()).describe("Thương hiệu/sản phẩm nhìn thấy hoặc được nhắc"),
      observations: z
        .array(
          z.object({
            frame: z.number().int().nullable().describe("Số frame 1-6 nơi thấy bằng chứng, null nếu từ transcript/caption"),
            quote: z.string().nullable().describe("Trích nguyên văn transcript/caption/chữ trên màn hình nếu có"),
            note: z.string().describe("Quan sát cụ thể, tiếng Việt"),
          }),
        )
        .describe("2-4 quan sát cụ thể, có thể kiểm chứng"),
    }),
  ),
  creator: z.object({
    primary_niche: z.string(),
    content_style: z.string().describe("Phong cách trình bày, tiếng Việt, 1 câu"),
    persona: z.string().describe("Hình mẫu creator thể hiện (sinh viên, dân văn phòng, mẹ bỉm...), dựa trên nội dung, không đoán thông tin nhạy cảm"),
    skin_topics: z.array(z.string()).describe("Vấn đề da được nói tới: da dầu, mụn, nhạy cảm, nám..."),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
    brand_safety: z.enum(["safe", "caution", "risk"]),
    brand_safety_note: z.string(),
    overall_video_quality: z.number().int().describe("1-10: chất lượng nội dung video cho mục đích quảng bá mỹ phẩm"),
  }),
});
export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisSchema>;

// ---------- Stage final_rank (model mạnh, chỉ chạy trên shortlist) ----------
export const FinalRankSchema = z.object({
  assessments: z.array(
    z.object({
      ref: z.string(),
      fit_score: z.number().int().describe("0-100 theo rubric"),
      verdict: z.enum(["strong", "good", "weak", "reject"]),
      headline: z.string().describe("1 câu tiếng Việt: lý do chính nên/không nên chọn"),
      reasons: z.array(
        z.object({
          text: z.string().describe("Lý do cụ thể, tiếng Việt"),
          evidence: z.array(z.string()).describe("Các evidence id hỗ trợ, ví dụ c3.m2, c3.v1.o1"),
        }),
      ),
      risks: z.array(
        z.object({
          text: z.string(),
          evidence: z.array(z.string()),
        }),
      ),
      suggested_angle: z.string().describe("Gợi ý concept video cho sản phẩm này hợp với creator, tiếng Việt"),
    }),
  ),
});
export type FinalRankOutput = z.infer<typeof FinalRankSchema>;
