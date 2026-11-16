/**
 * Stage 1 — source: lấy pool creator ứng viên từ data source (Kalodata).
 * 0 token. Kết quả lưu vào bảng creators (dùng chung giữa các run).
 */
import { getDataSource } from "../../sources";
import { upsertCreators } from "../creators";
import type { StageDef } from "../stage";

export interface SourceOut {
  ids: string[];
  source: string;
}

export const sourceStage: StageDef<{ limit: number }, SourceOut, SourceOut> = {
  name: "source",
  label: "Thu thập pool creator từ data source",
  plan: (ctx) => [{ key: "search", input: { limit: ctx.funnel.poolSize } }],
  async exec(ctx, input) {
    const src = getDataSource(ctx.cfg.dataSource);
    const list = await src.search({ brief: ctx.brief, limit: input.limit, runId: ctx.runId });
    if (!list.length) throw new Error(`Data source "${src.name}" returned 0 creators`);
    await upsertCreators(list);
    ctx.log(`Fetched ${list.length} creators from ${src.name}`);
    return { ids: list.map((c) => c.id), source: src.name };
  },
  reduce: (_ctx, outputs) => outputs.get("search")!,
};
