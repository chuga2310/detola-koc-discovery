/** GET /api/runs/:id -> trạng thái stage, task, chi phí, log, báo cáo (UI poll mỗi 1.5s) */
import { markStaleRuns } from "@/lib/pipeline/runner";
import { runDetail } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await markStaleRuns();
  const d = await runDetail(id);
  if (!d) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(d);
}
