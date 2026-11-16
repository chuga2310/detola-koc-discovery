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
    // Diversified retrieval: pool đến từ nhiều nguồn (commerce / engagement / content). Nếu chỉ lấy top
    // theo điểm tổng, 1 nhóm (vd affiliate bán mạnh) sẽ chiếm hết suất. Chia đều suất cho từng nguồn
    // (lấy người điểm cao nhất của mỗi nguồn), suất còn dư lấy theo điểm tổng.
    const keep = ctx.funnel.prefilterKeep;
    const tagsOf = new Map(creators.map((c) => [c.id, c.sources?.length ? c.sources : ["all"]]));
    const tags = [...new Set([...tagsOf.values()].flat())];
    const perTag = Math.floor(keep / tags.length);
    const chosen = new Set<string>();
    const perTagCount: Record<string, number> = {};
    for (const tag of tags) {
      for (const r of passed) {
        if ((perTagCount[tag] ?? 0) >= perTag) break;
        if (!chosen.has(r.id) && tagsOf.get(r.id)!.includes(tag)) {
          chosen.add(r.id);
          perTagCount[tag] = (perTagCount[tag] ?? 0) + 1;
        }
      }
    }
    for (const r of passed) if (chosen.size < keep) chosen.add(r.id);
    const kept = passed.filter((r) => chosen.has(r.id)); // passed đã sort theo điểm
    const contentMatched = kept.filter((r) => r.raw.keywordVideos > 0);
    const rest = kept.filter((r) => r.raw.keywordVideos === 0);
    const refs: Record<string, string> = {};
    kept.forEach((r, i) => (refs[r.id] = `c${i + 1}`));

    const dropReasons: Record<string, number> = {};
    for (const r of rows.filter((x) => !x.passed))
      for (const reason of r.dropReasons) {
        const key = reason.split(" ")[0] === "followers" ? "follower ngoài khoảng" : reason.replace(/[\d.,%]+/g, "#");
        dropReasons[key] = (dropReasons[key] ?? 0) + 1;
      }

    ctx.log(
      `Prefilter: ${rows.length} pool -> ${passed.length} passed hard filters -> keep ${kept.length} (per source ${JSON.stringify(perTagCount)}; ${contentMatched.length} with product content, ${rest.length} without)`,
    );
    return {
      rows,
      keptIds: kept.map((r) => r.id),
      refs,
      stats: { pool: rows.length, passed: passed.length, kept: kept.length, dropReasons },
    };
  },
};
