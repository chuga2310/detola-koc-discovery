/**
 * Brief intake: AI hỏi thêm để hoàn thiện brief từ mô tả tự do của user.
 *
 * Chia việc giữa code và AI để rẻ + đáng tin:
 *  - Code: áp câu trả lời dạng option vào draft, quyết định slot nào còn thiếu, dựng option
 *    cho câu hỏi (ngân sách, tuổi, số KOC...). Không bao giờ để AI tự "bịa" điều kiện chạy.
 *  - AI (model rẻ, effort low): hiểu câu chữ tự do ("cần 5 bạn review kem chống nắng cho sinh viên"),
 *    viết câu trả lời tự nhiên, gợi ý từ khoá TikTok và điểm nổi bật của sản phẩm để user chọn.
 * Mỗi lượt ~1 call ~1-2k token. Cùng hội thoại -> cache hit, 0 token.
 */
import { z } from "zod";
import { aiGenerate } from "../ai/gateway";
import { getConfig } from "../config";
import {
  applyAnswer,
  defaultQuestion,
  draftToBrief,
  missingSlots,
  nextSlot,
  parseAge,
  parseGender,
  parseKocCount,
  parseMoney,
  askedSlots,
  REQUIRED_SLOTS,
  SLOTS,
  type BriefDraft,
  type ChatMessage,
  type Question,
} from "./slots";

const PROMPT_VERSION = "intake-v3";

const IntakeSchema = z.object({
  reply: z
    .string()
    .describe("1-2 câu tiếng Việt, giọng đồng nghiệp marketing: xác nhận ngắn điều vừa hiểu. KHÔNG đặt câu hỏi ở đây. Không emoji."),
  extracted: z
    .object({
      brand: z.string().nullable().describe("Tên thương hiệu nếu user nói"),
      product: z.string().nullable().describe("Tên sản phẩm cụ thể, ví dụ 'Kem chống nắng nâng tông SPF50+'"),
      productNotes: z.string().nullable().describe("Điểm nổi bật / USP user nêu, 1 câu"),
      gender: z.enum(["female", "male", "any"]).nullable(),
      ageMin: z.number().int().nullable(),
      ageMax: z.number().int().nullable(),
      budgetAmount: z.number().nullable().describe("Số tiền đầy đủ, ví dụ 30 triệu -> 30000000"),
      budgetCurrency: z.enum(["VND", "USD"]).nullable(),
      numKocs: z.number().int().nullable(),
      followerMin: z.number().int().nullable(),
      followerMax: z.number().int().nullable(),
    })
    .describe("CHỈ điền thông tin user đã nói rõ trong tin nhắn mới nhất. Không suy đoán; không rõ thì null."),
  keywords: z
    .array(z.string())
    .describe("6-10 cụm từ người Việt hay viết trong caption TikTok về sản phẩm này, có dấu, viết thường, ví dụ 'kem chống nắng', 'nâng tông', 'spf50'"),
  contentKeywords: z.array(z.string()).describe("1-2 cụm ngắn để tìm video theo nội dung, ví dụ 'kem chống nắng'"),
  uspOptions: z.array(z.string()).describe("4-5 điểm nổi bật KHẢ DĨ của loại sản phẩm này để user chọn, mỗi ý <= 6 từ"),
  question: z
    .object({
      slot: z.enum(SLOTS),
      text: z.string().describe("Câu hỏi ngắn, cụ thể theo sản phẩm, tiếng Việt, không liệt kê lựa chọn"),
    })
    .nullable()
    .describe("Câu hỏi cho slot đầu tiên còn thiếu theo quy tắc; null nếu đã đủ"),
});
type IntakeOut = z.infer<typeof IntakeSchema>;

const SYSTEM = `Bạn là trợ lý lập brief tìm KOC TikTok cho thương hiệu mỹ phẩm/tiêu dùng tại Việt Nam.
User là marketer. Bạn đọc hội thoại và:
1. Trích thông tin brief user vừa nói (chỉ điều được nói rõ, không đoán).
2. Viết reply ngắn xác nhận điều đã hiểu, giọng đồng nghiệp, tiếng Việt tự nhiên, không emoji, không liệt kê lại toàn bộ.
3. Gợi ý từ khoá TikTok (cách người Việt thực sự gõ/hashtag) và điểm nổi bật khả dĩ của sản phẩm.
4. Chọn slot cần hỏi tiếp SAU KHI đã tính cả thông tin vừa trích: slot bắt buộc đầu tiên còn thiếu theo thứ tự
   product, gender, age, budget, numKocs; nếu đủ thì slot tuỳ chọn đầu tiên còn thiếu và chưa hỏi (followers, usp,
   xem "optional_already_asked"). Viết câu hỏi ngắn, cụ thể theo sản phẩm. Câu hỏi hiển thị kèm nút lựa chọn có sẵn
   (nhóm tuổi, mức ngân sách, số KOC, quy mô follower...) nên hỏi theo kiểu "...nào?", bạn không liệt kê lựa chọn.
   Nếu không còn slot nào thì question = null.
   Reply chỉ xác nhận điều vừa hiểu: không chứa câu hỏi, KHÔNG nói brief đã đủ hay còn thiếu gì (hệ thống tự nói).
Không dùng từ kỹ thuật như "slot", "field", "brief bắt buộc" khi nói với user; nói như người làm marketing.
Thương hiệu, từ khoá không bắt buộc: không đòi user cung cấp. Reply không nhắc tới thông tin còn thiếu (câu hỏi đã lo việc đó).

Ý nghĩa slot: product = sản phẩm; gender/age = khách hàng mục tiêu; budget = tổng ngân sách cho KOC;
numKocs = số KOC cần chọn; followers = quy mô follower; usp = điểm nổi bật sản phẩm.
Tiền: "30tr", "30 triệu", "30 củ" = 30000000 VND; "$2k" = 2000 USD.`;

export interface IntakeTurn {
  draft: BriefDraft;
  messages: ChatMessage[];
}

export interface IntakeResult {
  message: ChatMessage;
  draft: BriefDraft;
  ready: boolean;
  missing: string[];
  costUsd: number;
}

const newId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Gộp phần AI trích được vào draft; chỉ ghi đè bằng giá trị hợp lệ */
function mergeExtracted(d: BriefDraft, x: IntakeOut["extracted"]): BriefDraft {
  const out = { ...d };
  if (x.brand?.trim()) out.brand = x.brand.trim();
  if (x.product?.trim()) out.product = x.product.trim();
  if (x.productNotes?.trim()) out.productNotes = x.productNotes.trim();
  if (x.gender) out.gender = x.gender;
  if (x.ageMin && x.ageMax && x.ageMin >= 13 && x.ageMax <= 80 && x.ageMin < x.ageMax) {
    out.ageMin = x.ageMin;
    out.ageMax = x.ageMax;
  }
  if (x.budgetAmount && x.budgetAmount > 0) out.budget = { amount: Math.round(x.budgetAmount), currency: x.budgetCurrency ?? "VND" };
  if (x.numKocs && x.numKocs >= 1 && x.numKocs <= 500) out.numKocs = x.numKocs;
  if (x.followerMin && x.followerMax && x.followerMin < x.followerMax) {
    out.followerMin = x.followerMin;
    out.followerMax = x.followerMax;
  }
  return out;
}

/** Bản heuristic cho mock provider (chạy offline): regex thay cho AI */
function mockIntake(text: string, askSlot: string | null): IntakeOut {
  const money = parseMoney(text);
  const age = parseAge(text);
  const product = text.match(/(kem chống nắng|serum[^,.\n]*|son[^,.\n]*|sữa rửa mặt|kem dưỡng[^,.\n]*|toner|mặt nạ)/i)?.[1];
  return {
    reply: askSlot ? "Mình đã ghi nhận." : "Brief đã đủ thông tin để bắt đầu tìm creator.",
    extracted: {
      brand: null,
      product: product ? product[0].toUpperCase() + product.slice(1) : null,
      productNotes: null,
      gender: parseGender(text),
      ageMin: age?.ageMin ?? null,
      ageMax: age?.ageMax ?? null,
      budgetAmount: money?.amount ?? null,
      budgetCurrency: money?.currency ?? null,
      numKocs: parseKocCount(text),
      followerMin: null,
      followerMax: null,
    },
    keywords: product ? [product.toLowerCase(), "review", "skincare", "da dầu", "makeup"] : [],
    contentKeywords: product ? [product.toLowerCase()] : [],
    uspOptions: [],
    question: null,
  };
}

/**
 * 1 lượt hội thoại. Tin nhắn cuối trong `messages` là của user (chữ tự do hoặc trả lời option).
 */
export async function intakeTurn({ draft, messages }: IntakeTurn): Promise<IntakeResult> {
  const last = messages[messages.length - 1];
  let d: BriefDraft = { ...draft };

  // 1) Trả lời dạng option: áp bằng code trước (chính xác, không cần AI hiểu)
  if (last?.answer) d = applyAnswer(d, last.answer);

  // 2) Tin nhắn tự do (kể cả phần "Khác"), hoặc lượt đầu từ form -> nhờ AI hiểu + gợi ý
  const freeText = last?.answer ? (last.answer.other ?? "") : (last?.text ?? "");
  const needsKeywords = !d.keywords?.length;
  const needsUsp = !d.productNotes;
  const plannedSlot = nextSlot(d, messages);
  const askNeedsAi = plannedSlot !== null && plannedSlot !== "gender" && plannedSlot !== "budget" && plannedSlot !== "numKocs";
  const useAi = freeText.trim().length > 0 || needsKeywords || (plannedSlot === "usp" && needsUsp) || askNeedsAi || plannedSlot === null;

  let reply = "";
  let costUsd = 0;
  let uspOptions: string[] = [];
  let questionText: string | null = null;

  if (useAi) {
    const cfg = getConfig();
    const history = messages.slice(-8).map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`).join("\n");
    const input = {
      current_brief: d,
      missing_before_this_message: missingSlots(d),
      optional_already_asked: [...askedSlots(messages)].filter((s) => !REQUIRED_SLOTS.includes(s)),
      latest_user_message: freeText || last?.text || "",
      history,
    };
    const res = await aiGenerate(
      { runId: null, stage: "brief_intake", taskKey: last?.id ?? "intake" },
      {
        model: cfg.models.screen,
        effort: "low",
        system: SYSTEM,
        content: [{ type: "text", text: JSON.stringify(input) }],
        schema: IntakeSchema,
        schemaName: "brief_intake",
        maxTokens: 1500,
        promptVersion: PROMPT_VERSION,
        mock: () => mockIntake(freeText || last?.text || "", plannedSlot),
      },
    );
    costUsd = res.costUsd;
    const out = res.data;
    // Tin gửi từ form: giá trị form là chuẩn, không để AI "trích" lại (dễ đổi tên thương hiệu, làm tròn số...)
    if (!last?.fromForm) d = mergeExtracted(d, out.extracted);
    // Option user vừa chọn thắng phần AI trích từ "Khác" nếu mâu thuẫn -> áp lại answer sau merge
    if (last?.answer) d = applyAnswer(d, last.answer);
    if (!d.keywords?.length && out.keywords.length) d.keywords = out.keywords.slice(0, 10);
    if (!d.contentKeywords?.length && out.contentKeywords.length) d.contentKeywords = out.contentKeywords.slice(0, 2);
    uspOptions = out.uspOptions;
    reply = out.reply.trim();
    questionText = out.question?.text?.trim() || null;
    // AI có thể hỏi slot khác với slot code chọn -> chỉ dùng câu chữ khi khớp slot
    if (out.question && out.question.slot !== nextSlot(d, messages)) questionText = null;
  }

  // 3) Code quyết định câu hỏi tiếp theo
  const slot = nextSlot(d, messages);
  const ready = missingSlots(d).filter((s) => REQUIRED_SLOTS.includes(s)).length === 0 && slot === null;
  let question: Question | undefined;
  if (slot) {
    question = defaultQuestion(slot, d, uspOptions);
    if (questionText) question.text = questionText;
  }

  // Câu "đã đủ / bắt đầu" do code quyết định: bỏ nếu AI tự nói mà thực tế còn câu hỏi, thêm khi thật sự đủ
  if (!ready) reply = reply.replace(/[^.!?]*(đã đủ|đủ để bắt đầu|bắt đầu tìm)[^.!?]*[.!?]?/gi, "").trim();
  if (!reply) reply = ready ? "Đã rõ." : "Đã ghi nhận.";
  if (ready) reply = `${reply.replace(/[^.!?]*(đã đủ|đủ để bắt đầu|bắt đầu tìm)[^.!?]*[.!?]?/gi, "").trim()} Brief đã đủ, bạn kiểm tra lại rồi bấm “Bắt đầu tìm creator”.`.trim();

  const message: ChatMessage = {
    id: newId(),
    role: "assistant",
    text: reply,
    ts: Date.now(),
    question,
    brief: ready ? draftToBrief(d) : undefined,
  };
  return { message, draft: d, ready, missing: missingSlots(d), costUsd };
}
