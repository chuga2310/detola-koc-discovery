/**
 * POST /api/runs/:id/stop -> dừng an toàn (để demo khả năng phục hồi trên UI).
 * Task đang chạy làm nốt; task chưa chạy giữ "pending" -> Resume sẽ tiếp tục đúng chỗ.
 */
import { requestStop } from "@/lib/pipeline/runner";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = requestStop(id);
  return Response.json({ ok }, { status: ok ? 200 : 409 });
}
