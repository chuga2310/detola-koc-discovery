/**
 * Stage 2 — prefilter: lọc cứng + chấm điểm bằng số liệu. 0 token.
 * Giữ lại top ~4N creator cho stage AI đầu tiên.
 */
import { loadCreators } from "../creators";
import { prefilter, type PrefilterRow } from "../scoring";
import type { StageDef } from "../stage";
import type { SourceOut } from "./source";

export interface PrefilterOut {
  rows: PrefilterRow[];
  keptIds: string[];
  /** id -> ref ngắn (c1, c2...) dùng trong prompt để tiết kiệm token + làm evidence id */
  refs: Record<string, string>;
  stats: { pool: number; passed: number; kept: number; dropReasons: Record<string, number> };
}

export const prefilterStage: StageDef<never, never, PrefilterOut> = {
  name: "prefilter",
  label: "Lọc cứng + chấm điểm số liệu (0 token)",
  plan: () => [],
  exec: async () => {
    throw new Error("prefilter has no tasks");
  },
  reduce(ctx) {
    const { ids } = ctx.output<SourceOut>("source");
    const creators = [...loadCreators(ids).values()];
    const rows = prefilter(creators, ctx.brief);
    const passed = rows.filter((r) => r.passed);
    const kept = passed.slice(0, ctx.funnel.prefilterKeep);
    const refs: Record<string, string> = {};
    kept.forEach((r, i) => (refs[r.id] = `c${i + 1}`));

    const dropReasons: Record<string, number> = {};
    for (const r of rows.filter((x) => !x.passed))
      for (const reason of r.dropReasons) {
        const key = reason.split(" ")[0] === "followers" ? "follower ngoài khoảng" : reason.replace(/[\d.,%]+/g, "#");
        dropReasons[key] = (dropReasons[key] ?? 0) + 1;
      }

    ctx.log(`Prefilter: ${rows.length} pool -> ${passed.length} passed hard filters -> keep top ${kept.length}`);
    return {
      rows,
      keptIds: kept.map((r) => r.id),
      refs,
      stats: { pool: rows.length, passed: passed.length, kept: kept.length, dropReasons },
    };
  },
};
