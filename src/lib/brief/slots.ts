/**
 * Brief "slots": các mảnh thông tin cần để chạy tìm KOC, dùng chung cho form và chat AI.
 *
 * File này KHÔNG import gì của server (db, SDK) -> dùng được cả ở client lẫn server.
 * - Form điền trực tiếp vào BriefDraft.
 * - Chat: mỗi câu hỏi của AI gắn với 1 slot; câu trả lời dạng option được áp vào draft
 *   bằng code (chính xác, 0 token), câu trả lời tự do mới cần AI hiểu.
 */
import type { CampaignBrief } from "../types";

export type Currency = "VND" | "USD";
export type Gender = CampaignBrief["targetAudience"]["gender"];

/** Tỷ giá hiển thị/quy đổi khi user nhập ngân sách bằng USD (đồng bộ với USD_VND ở server) */
export const USD_VND = 26000;

export interface BriefDraft {
  brand?: string;
  product?: string;
  productNotes?: string;
  category?: string;
  keywords?: string[];
  contentKeywords?: string[];
  gender?: Gender;
  ageMin?: number;
  ageMax?: number;
  budget?: { amount: number; currency: Currency };
  numKocs?: number;
  followerMin?: number;
  followerMax?: number;
}

/** Slot mà AI có thể hỏi. Thứ tự = thứ tự hỏi. */
export const SLOTS = ["product", "gender", "age", "budget", "numKocs", "followers", "usp"] as const;
export type Slot = (typeof SLOTS)[number];
/** Bắt buộc phải có trước khi chạy; còn lại có mặc định hợp lý, chỉ hỏi 1 lần */
export const REQUIRED_SLOTS: Slot[] = ["product", "gender", "age", "budget", "numKocs"];

export interface QuestionOption {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  slot: Slot;
  text: string;
  mode: "single" | "multi";
  options: QuestionOption[];
  allowOther: boolean;
  otherPlaceholder?: string;
}

export interface Answer {
  questionId: string;
  slot: Slot;
  values: string[];
  other?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  question?: Question;
  answer?: Answer;
  /** Có khi AI đã đủ thông tin: brief hoàn chỉnh để user xác nhận */
  brief?: CampaignBrief;
  /** Tin nhắn user gửi bằng form (hiển thị dạng tóm tắt) */
  fromForm?: boolean;
}

// ---------------------------------------------------------------- preset

export const GENDER_OPTIONS: QuestionOption[] = [
  { value: "female", label: "Nữ" },
  { value: "male", label: "Nam" },
  { value: "any", label: "Cả hai" },
];

export const AGE_BANDS = [
  { value: "13-17", label: "13–17", min: 13, max: 17 },
  { value: "18-24", label: "18–24", min: 18, max: 24 },
  { value: "25-30", label: "25–30", min: 25, max: 30 },
  { value: "31-40", label: "31–40", min: 31, max: 40 },
  { value: "41-55", label: "41–55", min: 41, max: 55 },
] as const;

export const BUDGET_PRESETS: Record<Currency, number[]> = {
  VND: [10_000_000, 20_000_000, 30_000_000, 50_000_000, 100_000_000],
  USD: [500, 1000, 2000, 5000],
};

export const KOC_PRESETS = [3, 5, 10, 20];

export const FOLLOWER_TIERS = [
  { value: "nano", label: "Nano", hint: "1k–10k", min: 1_000, max: 10_000 },
  { value: "micro", label: "Micro", hint: "10k–100k", min: 10_000, max: 100_000 },
  { value: "mid", label: "Mid", hint: "100k–500k", min: 100_000, max: 500_000 },
  { value: "macro", label: "Macro", hint: "500k–1M", min: 500_000, max: 1_000_000 },
] as const;

export const PRODUCT_SUGGESTIONS = ["Kem chống nắng", "Serum dưỡng da", "Son môi", "Sữa rửa mặt", "Kem dưỡng ẩm"];

export const DEFAULT_FOLLOWERS = { min: 10_000, max: 500_000 };

// ---------------------------------------------------------------- định dạng tiền

export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `${amount.toLocaleString("vi-VN")} ₫`;
}

/** Nhãn ngắn kiểu "30 triệu", "1,5 tỷ", "$2,000" cho chip */
export function shortMoney(amount: number, currency: Currency): string {
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  if (amount >= 1e9) return `${(amount / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (amount >= 1e6) return `${(amount / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`;
  return formatMoney(amount, currency);
}

export const toVnd = (b: { amount: number; currency: Currency }) => Math.round(b.currency === "USD" ? b.amount * USD_VND : b.amount);

/**
 * Đọc số tiền từ chữ tự do: "30 triệu", "30tr", "1,5 tỷ", "30.000.000", "$2,000", "2000 usd".
 * Trả null nếu không thấy con số nào giống tiền.
 */
export function parseMoney(text: string): { amount: number; currency: Currency } | null {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
  const usd = t.match(/\$\s*([\d.,]+)\s*(k)?|([\d.,]+)\s*(k)?\s*(usd|đô|dollar)/);
  if (usd) {
    const raw = (usd[1] ?? usd[3]).replace(/,/g, "");
    const k = usd[2] || usd[4] ? 1000 : 1;
    const v = Number(raw) * k;
    if (v > 0) return { amount: Math.round(v), currency: "USD" };
  }
  const unit = t.match(/([\d]+(?:[.,]\d+)?)\s*(tỷ|tỉ|ty|triệu|trieu|tr|củ|m|nghìn|ngàn|k)\b/);
  if (unit) {
    const mult = /^(tỷ|tỉ|ty)$/.test(unit[2]) ? 1e9 : /^(nghìn|ngàn|k)$/.test(unit[2]) ? 1e3 : 1e6;
    const v = Number(unit[1].replace(",", ".")) * mult;
    if (v > 0) return { amount: Math.round(v), currency: "VND" };
  }
  const plain = t.match(/\d{1,3}(?:[.,\s]\d{3}){2,}|\d{6,}/);
  if (plain) {
    const v = num(plain[0].replace(/[,\s]/g, "."));
    if (v >= 100_000) return { amount: Math.round(v), currency: "VND" };
  }
  return null;
}

/** Lấy tất cả chữ số từ ô nhập tiền (user gõ "30.000.000" hoặc "30000000") */
export const digitsOnly = (s: string) => Number(s.replace(/\D/g, "")) || 0;

// ---------------------------------------------------------------- áp câu trả lời vào draft

export function ageFromBands(values: string[]): { ageMin: number; ageMax: number } | null {
  const bands = AGE_BANDS.filter((b) => values.includes(b.value));
  if (!bands.length) return null;
  return { ageMin: Math.min(...bands.map((b) => b.min)), ageMax: Math.max(...bands.map((b) => b.max)) };
}

export function bandsFromAge(min?: number, max?: number): string[] {
  if (min === undefined || max === undefined) return [];
  return AGE_BANDS.filter((b) => b.max >= min && b.min <= max).map((b) => b.value);
}

export function followersFromTiers(values: string[]): { followerMin: number; followerMax: number } | null {
  const tiers = FOLLOWER_TIERS.filter((t) => values.includes(t.value));
  if (!tiers.length) return null;
  return { followerMin: Math.min(...tiers.map((t) => t.min)), followerMax: Math.max(...tiers.map((t) => t.max)) };
}

export function tiersFromFollowers(min?: number, max?: number): string[] {
  if (min === undefined || max === undefined) return [];
  return FOLLOWER_TIERS.filter((t) => t.max > min && t.min < max).map((t) => t.value);
}

export function parseAge(text: string): { ageMin: number; ageMax: number } | null {
  const m = text.match(/(\d{2})\s*(?:-|–|đến|tới|~)\s*(\d{2})(?!\d)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a < 13 || b > 80 || a >= b) return null;
  return { ageMin: a, ageMax: b };
}

export function parseGender(text: string): Gender | null {
  const t = text.toLowerCase();
  const f = /\bnữ\b|phụ nữ|chị em|con gái|\bgirls?\b|female/.test(t);
  const m = /\bnam\b|con trai|đàn ông|\bmen\b|male/.test(t.replace(/việt nam/g, ""));
  if (f && m) return "any";
  if (f) return "female";
  if (m) return "male";
  if (/cả hai|mọi giới|tất cả/.test(t)) return "any";
  return null;
}

export function parseKocCount(text: string): number | null {
  const m = text.toLowerCase().match(/(\d{1,3})\s*(?:koc|kol|creator|người|bạn|influencer|tiktoker)/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 500 ? n : null;
}

/**
 * Áp câu trả lời dạng option (hoặc "Khác") vào draft bằng code. Trả về draft mới.
 * "Khác" của các slot số (tiền, tuổi, số KOC) cũng parse bằng code; slot chữ (sản phẩm, USP) lấy nguyên văn.
 */
export function applyAnswer(draft: BriefDraft, a: Answer): BriefDraft {
  const d = { ...draft };
  const other = a.other?.trim() ?? "";
  switch (a.slot) {
    case "product":
      if (a.values[0]) d.product = PRODUCT_SUGGESTIONS.find((p) => p === a.values[0]) ?? a.values[0];
      if (other) d.product = other;
      break;
    case "gender": {
      const g = (a.values[0] as Gender | undefined) ?? (other ? parseGender(other) : null);
      if (g) d.gender = g;
      break;
    }
    case "age": {
      const r = ageFromBands(a.values) ?? (other ? parseAge(other) : null);
      if (r) Object.assign(d, r);
      break;
    }
    case "budget": {
      const v = a.values[0];
      if (v) {
        const [cur, amt] = v.split(":");
        d.budget = { currency: cur as Currency, amount: Number(amt) };
      }
      const p = other ? parseMoney(other) : null;
      if (p) d.budget = p;
      break;
    }
    case "numKocs": {
      const n = a.values[0] ? Number(a.values[0]) : other ? Number(other.replace(/\D/g, "")) : NaN;
      if (n >= 1 && n <= 500) d.numKocs = n;
      break;
    }
    case "followers": {
      const r = followersFromTiers(a.values);
      if (r) Object.assign(d, r);
      break;
    }
    case "usp": {
      const parts = [...a.values, other].filter(Boolean);
      if (parts.length) d.productNotes = parts.join("; ");
      break;
    }
  }
  return d;
}

/** Slot bắt buộc còn thiếu */
export function missingSlots(d: BriefDraft): Slot[] {
  const has: Record<Slot, boolean> = {
    product: !!d.product?.trim(),
    gender: !!d.gender,
    age: d.ageMin !== undefined && d.ageMax !== undefined,
    budget: !!d.budget && d.budget.amount > 0,
    numKocs: !!d.numKocs,
    followers: d.followerMin !== undefined && d.followerMax !== undefined,
    usp: !!d.productNotes?.trim(),
  };
  return SLOTS.filter((s) => !has[s]);
}

/** Câu hỏi mặc định cho 1 slot (dùng khi AI không đề xuất hoặc ở chế độ mock) */
export function defaultQuestion(slot: Slot, draft: BriefDraft, uspOptions: string[] = []): Question {
  const id = `q-${slot}-${Math.random().toString(36).slice(2, 8)}`;
  const cur = draft.budget?.currency ?? "VND";
  switch (slot) {
    case "product":
      return {
        id, slot, mode: "single", allowOther: true, otherPlaceholder: "Tên sản phẩm, ví dụ: Kem chống nắng nâng tông SPF50",
        text: "Bạn muốn tìm KOC cho sản phẩm nào?",
        options: PRODUCT_SUGGESTIONS.map((p) => ({ value: p, label: p })),
      };
    case "gender":
      return { id, slot, mode: "single", allowOther: false, text: "Khách hàng chính của sản phẩm là ai?", options: GENDER_OPTIONS };
    case "age":
      return {
        id, slot, mode: "multi", allowOther: true, otherPlaceholder: "Ví dụ: 20–35",
        text: "Họ ở độ tuổi nào? Chọn một hoặc nhiều nhóm.",
        options: AGE_BANDS.map((b) => ({ value: b.value, label: b.label })),
      };
    case "budget":
      return {
        id, slot, mode: "single", allowOther: true, otherPlaceholder: "Ví dụ: 45 triệu hoặc $1,500",
        text: "Ngân sách cho toàn bộ KOC khoảng bao nhiêu?",
        options: BUDGET_PRESETS[cur].map((v) => ({ value: `${cur}:${v}`, label: shortMoney(v, cur) })),
      };
    case "numKocs":
      return {
        id, slot, mode: "single", allowOther: true, otherPlaceholder: "Số KOC, ví dụ 8",
        text: "Bạn cần chọn ra bao nhiêu KOC?",
        options: KOC_PRESETS.map((n) => ({ value: String(n), label: `${n} KOC` })),
      };
    case "followers":
      return {
        id, slot, mode: "multi", allowOther: false,
        text: "Bạn muốn KOC ở quy mô nào? KOC nhỏ thường rẻ và tương tác thật hơn.",
        options: FOLLOWER_TIERS.map((t) => ({ value: t.value, label: t.label, hint: t.hint })),
      };
    case "usp":
      return {
        id, slot, mode: "multi", allowOther: true, otherPlaceholder: "Điểm nổi bật khác của sản phẩm",
        text: "Sản phẩm nổi bật ở điểm nào? AI dùng điều này để đánh giá KOC có hợp nội dung không.",
        options: (uspOptions.length ? uspOptions : ["Thấm nhanh, không bết", "Nâng tông nhẹ", "Không gây mụn", "Giá dễ mua"]).slice(0, 5).map((u) => ({ value: u, label: u })),
      };
  }
}

/** Slot nào đã từng được hỏi trong hội thoại (slot tuỳ chọn chỉ hỏi 1 lần) */
export const askedSlots = (messages: ChatMessage[]) => new Set(messages.filter((m) => m.question).map((m) => m.question!.slot));

/** Slot tiếp theo cần hỏi: bắt buộc trước, sau đó slot tuỳ chọn chưa hỏi lần nào */
export function nextSlot(d: BriefDraft, messages: ChatMessage[]): Slot | null {
  const missing = missingSlots(d);
  const req = missing.find((s) => REQUIRED_SLOTS.includes(s));
  if (req) return req;
  const asked = askedSlots(messages);
  return missing.find((s) => !asked.has(s)) ?? null;
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** Draft đủ slot bắt buộc -> CampaignBrief hoàn chỉnh (điền mặc định cho phần còn lại) */
export function draftToBrief(d: BriefDraft): CampaignBrief {
  const product = d.product!.trim();
  const kw = uniq(d.keywords?.length ? d.keywords : [product.toLowerCase()]);
  return {
    brand: d.brand?.trim() || product,
    product,
    productNotes: d.productNotes?.trim() || undefined,
    category: d.category?.trim() || "Beauty & Personal Care",
    keywords: kw,
    contentKeywords: uniq(d.contentKeywords?.length ? d.contentKeywords : [product.toLowerCase()]).slice(0, 2),
    targetAudience: { gender: d.gender ?? "any", ageMin: d.ageMin ?? 18, ageMax: d.ageMax ?? 35 },
    budgetVnd: toVnd(d.budget!),
    budgetInput: d.budget,
    numKocs: d.numKocs!,
    followerRange: { min: d.followerMin ?? DEFAULT_FOLLOWERS.min, max: d.followerMax ?? DEFAULT_FOLLOWERS.max },
    region: "VN",
  };
}

/** CampaignBrief -> draft (để "Sửa brief" mở lại form với giá trị cũ) */
export function briefToDraft(b: CampaignBrief): BriefDraft {
  return {
    brand: b.brand,
    product: b.product,
    productNotes: b.productNotes,
    category: b.category,
    keywords: b.keywords,
    contentKeywords: b.contentKeywords,
    gender: b.targetAudience.gender,
    ageMin: b.targetAudience.ageMin,
    ageMax: b.targetAudience.ageMax,
    budget: b.budgetInput ?? { amount: b.budgetVnd, currency: "VND" },
    numKocs: b.numKocs,
    followerMin: b.followerRange?.min,
    followerMax: b.followerRange?.max,
  };
}

export const GENDER_WORD: Record<Gender, string> = { female: "Nữ", male: "Nam", any: "Nam và nữ" };

/** Mô tả quy mô follower bằng chữ: "Micro, Mid (10k–500k)" */
export function followerWords(min: number, max: number): string {
  const tiers = FOLLOWER_TIERS.filter((t) => t.max > min && t.min < max).map((t) => t.label);
  const k = (n: number) => (n >= 1e6 ? `${n / 1e6}M` : `${Math.round(n / 1e3)}k`);
  return `${tiers.join(", ")} (${k(min)}–${k(max)})`;
}

/** Tin nhắn tóm tắt khi user gửi bằng form */
export function draftSummaryText(d: BriefDraft): string {
  const parts = [
    d.product && `Sản phẩm: ${d.product}${d.brand && d.brand !== d.product ? ` (${d.brand})` : ""}`,
    d.gender && d.ageMin !== undefined && `Khách hàng: ${GENDER_WORD[d.gender]} ${d.ageMin}–${d.ageMax} tuổi`,
    d.budget && `Ngân sách: ${shortMoney(d.budget.amount, d.budget.currency)}`,
    d.numKocs && `Cần ${d.numKocs} KOC`,
    d.followerMin !== undefined && d.followerMax !== undefined && `Quy mô: ${followerWords(d.followerMin, d.followerMax)}`,
    d.productNotes && `Điểm nổi bật: ${d.productNotes}`,
  ].filter(Boolean);
  return parts.join("\n");
}
