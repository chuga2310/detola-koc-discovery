/**
 * Stage 3 — enrich (lazy enrichment): lấy dữ liệu chi tiết CHỈ cho ~4N creator đã qua prefilter.
 *
 * Với Kalodata: creator/detail (0.1 credit) + video/rank theo creator (0.1 credit) = ~0.2 credit / creator.
 * Gọi cho cả pool 100 creator = 20 credit; chỉ gọi cho 20 creator qua prefilter = 4 credit (giảm 80%).
 * Đây cũng là nguyên lý funnel như với token AI: dữ liệu đắt chỉ lấy cho ứng viên đáng xem.
 *
 * Sau khi enrich, chấm lại điểm số liệu (có thêm engagement thực, keyword trong caption, tỷ lệ
 * video/live...) -> điểm này được dùng cho các stage sau.
 */
import { getDataSource } from "../../sources";
import { loadCreators, upsertCreators } from "../creators";
import { prefilter, type PrefilterRow } from "../scoring";
import type { StageDef } from "../stage";
import type { PrefilterOut } from "./prefilter";

export interface EnrichOut {
  /** Điểm số liệu chấm lại trên dữ liệu đầy đủ (chỉ creator đã enrich) */
  rows: PrefilterRow[];
  failed: string[];
}

export const enrichStage: StageDef<{ creatorId: string }, { ok: true }, EnrichOut> = {
  name: "enrich",
  label: "Lấy chi tiết + video gần đây cho creator qua prefilter (data API)",
  concurrency: 2, // video/rank của Kalodata giới hạn 10 req / 10s
  tolerateFailures: true,
  plan(ctx) {
    const { keptIds } = ctx.output<PrefilterOut>("prefilter");
    return keptIds.map((id) => ({ key: id, input: { creatorId: id } }));
  },
  async exec(ctx, input) {
    const c = loadCreators([input.creatorId]).get(input.creatorId);
    if (!c) throw new Error("creator not found");
    const full = await getDataSource(ctx.cfg.dataSource).enrich(c, { brief: ctx.brief, runId: ctx.runId });
    upsertCreators([full]);
    return { ok: true };
  },
  reduce(ctx, outputs, failed) {
    const ids = [...outputs.keys()];
    const creators = [...loadCreators(ids).values()];
    const rows = prefilter(creators, ctx.brief);
    const stillPass = rows.filter((r) => r.passed).length;
    ctx.log(`Enriched ${ids.length} creators (${failed.length} failed); ${stillPass} still pass hard filters with full data`);
    return { rows, failed };
  },
};

/** Lấy điểm số liệu tốt nhất hiện có cho 1 creator: ưu tiên bản sau enrich */
export function dataRow(enrich: EnrichOut | null, pf: PrefilterOut, id: string): PrefilterRow | undefined {
  return enrich?.rows.find((r) => r.id === id) ?? pf.rows.find((r) => r.id === id);
}
