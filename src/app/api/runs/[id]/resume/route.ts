/** POST /api/runs/:id/resume -> chạy tiếp từ checkpoint (run bị stop / crash / failed) */
import { db } from "@/lib/db";
import { isRunActiveHere, startInBackground } from "@/lib/pipeline/runner";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = db().prepare("SELECT status FROM runs WHERE id = ?").get(id) as { status: string } | undefined;
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (row.status === "completed") return Response.json({ error: "run already completed" }, { status: 409 });
  if (isRunActiveHere(id)) return Response.json({ ok: true, note: "already running" });
  startInBackground(id); // runner tự đọc checkpoint và chạy tiếp
  return Response.json({ ok: true });
}
