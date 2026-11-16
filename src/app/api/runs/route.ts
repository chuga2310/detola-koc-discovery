/**
 * POST /api/runs  -> tạo run mới từ brief và chạy nền
 * GET  /api/runs  -> danh sách run gần đây
 */
import { z } from "zod";
import { createRun, markStaleRuns, startInBackground } from "@/lib/pipeline/runner";
import { aiCallsCol, runsCol } from "@/lib/db";
import { paidCredits, type PaidMode } from "@/lib/brief/paid";
import { listRuns } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BriefSchema = z.object({
  brand: z.string().min(1),
  product: z.string().min(1),
  productNotes: z.string().optional(),
  category: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  targetAudience: z.object({
    gender: z.enum(["female", "male", "any"]),
    ageMin: z.number().int().min(13),
    ageMax: z.number().int().max(80),
  }),
  budgetVnd: z.number().positive(),
  numKocs: z.number().int().min(1).max(500),
  followerRange: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  region: z.string().optional(),
  kalodataCategoryIds: z.string().optional(),
  contentKeywords: z.array(z.string()).optional(),
  budgetInput: z.object({ amount: z.number().positive(), currency: z.enum(["VND", "USD"]) }).optional(),
  deepData: z
    .object({ categoryRevenue: z.boolean().optional(), videoDetail: z.boolean().optional(), competitorProducts: z.boolean().optional() })
    .optional(),
});

/** Body mới: { brief, chat }. Vẫn nhận body cũ (chỉ brief) cho CLI / script. */
const CreateSchema = z.union([z.object({ brief: BriefSchema, chat: z.array(z.record(z.string(), z.unknown())).max(80).optional() }), BriefSchema]);

export async function GET() {
  await markStaleRuns();
  return Response.json({ runs: await listRuns() });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Brief chưa đủ thông tin để bắt đầu." }, { status: 400 });
  const { brief, chat } = "brief" in parsed.data ? parsed.data : { brief: parsed.data, chat: undefined };
  // Dữ liệu chuyên sâu là tính năng trả phí: chỉ cho bật khi chế độ cho phép (bản demo: được bật)
  const mode = (process.env.PAID_FEATURES?.trim() || "demo") as PaidMode;
  const wantsPaid = Object.values(brief.deepData ?? {}).some(Boolean);
  if (wantsPaid && mode === "off") return Response.json({ error: "Tính năng dữ liệu chuyên sâu chưa được mở cho tài khoản này." }, { status: 403 });
  const id = await createRun(brief, chat);
  if (wantsPaid) {
    // Nâng trần credit của chiến dịch đúng bằng phần người dùng đã đồng ý trả thêm
    await (await runsCol()).updateOne({ _id: id }, { $set: { "config.paidCreditsBudget": paidCredits(brief.deepData, brief.numKocs), "config.paidMode": mode } });
  }
  if (chat?.length) await attributeIntakeCost(id, chat);
  startInBackground(id);
  return Response.json({ id }, { status: 201 });
}

/** Chi phí AI của các lượt hỏi brief (ghi lúc chưa có chiến dịch) -> gắn vào chiến dịch vừa tạo */
async function attributeIntakeCost(runId: string, chat: Record<string, unknown>[]) {
  const ids = chat.filter((m) => m.role === "user" && typeof m.id === "string").map((m) => m.id as string);
  if (!ids.length) return;
  await (await aiCallsCol()).updateMany({ runId: null, stage: "brief_intake", taskKey: { $in: ids } }, { $set: { runId } });
}
