/**
 * POST /api/runs  -> tạo run mới từ brief và chạy nền
 * GET  /api/runs  -> danh sách run gần đây
 */
import { z } from "zod";
import { createRun, markStaleRuns, startInBackground } from "@/lib/pipeline/runner";
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
});

export async function GET() {
  markStaleRuns();
  return Response.json({ runs: listRuns() });
}

export async function POST(req: Request) {
  const parsed = BriefSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const id = createRun(parsed.data);
  startInBackground(id);
  return Response.json({ id }, { status: 201 });
}
