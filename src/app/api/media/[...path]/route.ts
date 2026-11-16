/** GET /api/media/<videoId>/sheet.jpg -> phục vụ contact sheet từ media cache (cho UI hiển thị bằng chứng) */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const root = path.resolve(getConfig().paths.mediaCache);
  const file = path.resolve(root, ...parts);
  // Chặn path traversal (../../etc/passwd)
  if (!file.startsWith(root + path.sep) || !/\.(jpe?g|png)$/i.test(file) || !fs.existsSync(file)) {
    return new Response("not found", { status: 404 });
  }
  return new Response(fs.readFileSync(file), {
    headers: { "content-type": file.endsWith(".png") ? "image/png" : "image/jpeg", "cache-control": "public, max-age=86400" },
  });
}
