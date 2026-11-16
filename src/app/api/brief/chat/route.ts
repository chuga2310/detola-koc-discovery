/**
 * POST /api/brief/chat -> 1 lượt hội thoại lập brief.
 * Body: { draft, messages } (tin cuối là của user). Trả: { message, draft, ready, missing }.
 * Server không giữ state: client gửi lại toàn bộ hội thoại mỗi lượt (ngắn, vài KB).
 */
import { z } from "zod";
import { intakeTurn } from "@/lib/brief/intake";
import { SLOTS } from "@/lib/brief/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Option = z.object({ value: z.string(), label: z.string(), hint: z.string().optional() });
const Question = z.object({
  id: z.string(),
  slot: z.enum(SLOTS),
  text: z.string(),
  mode: z.enum(["single", "multi"]),
  options: z.array(Option),
  allowOther: z.boolean(),
  otherPlaceholder: z.string().optional(),
});
const Message = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
  ts: z.number(),
  question: Question.optional(),
  answer: z
    .object({ questionId: z.string(), slot: z.enum(SLOTS), values: z.array(z.string()), other: z.string().max(500).optional() })
    .optional(),
  brief: z.any().optional(),
  fromForm: z.boolean().optional(),
});
const Draft = z.object({
  brand: z.string().optional(),
  product: z.string().optional(),
  productNotes: z.string().optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  contentKeywords: z.array(z.string()).optional(),
  gender: z.enum(["female", "male", "any"]).optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  budget: z.object({ amount: z.number().positive(), currency: z.enum(["VND", "USD"]) }).optional(),
  numKocs: z.number().int().optional(),
  followerMin: z.number().int().optional(),
  followerMax: z.number().int().optional(),
});
const Body = z.object({ draft: Draft, messages: z.array(Message).min(1).max(60) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Hội thoại không hợp lệ." }, { status: 400 });
  const last = parsed.data.messages.at(-1)!;
  if (last.role !== "user") return Response.json({ error: "Tin nhắn cuối phải là của bạn." }, { status: 400 });
  try {
    const out = await intakeTurn(parsed.data);
    return Response.json(out);
  } catch (err) {
    console.error("[brief/chat]", err);
    return Response.json({ error: "AI chưa trả lời được, thử gửi lại." }, { status: 502 });
  }
}
