/**
 * Stage 6 — final_rank: model MẠNH NHẤT chấm điểm shortlist (~2N creator) theo rubric,
 * viết lý do + rủi ro, và BẮT BUỘC trích evidence id.
 *
 * Model mạnh nhưng input là text gọn (evidence lines) chứ không phải ảnh/raw data,
 * và chỉ chạy trên shortlist => 1 call cho demo 5 KOC.
 * Sau khi nhận kết quả, code kiểm tra evidence id (chống bịa).
 */
import { aiGenerate } from "../../ai/gateway";
import type { CreatorRecord, Evidence } from "../../types";
import { loadCreators } from "../creators";
import { buildEvidence, evidenceLines, validateEvidence } from "../evidence";
import { finalRankSystem, PROMPT_VERSION } from "../prompts";
import { FinalRankSchema, type FinalRankOutput } from "../schemas";
import type { PrefilterRow } from "../scoring";
import type { StageContext, StageDef } from "../stage";
import type { MediaPrepOut } from "./mediaPrep";
import { dataRow, type EnrichOut } from "./enrich";
import type { PrefilterOut } from "./prefilter";
import type { TextScreenOut } from "./textScreen";
import type { VideoOut } from "./videoAnalysis";

export type Assessment = FinalRankOutput["assessments"][number] & { invalidEvidence: string[] };

export interface FinalRankOut {
  byId: Record<string, Assessment>;
  evidence: Record<string, Evidence[]>;
}

interface BatchOut {
  assessments: Record<string, Assessment>;
  evidence: Record<string, Evidence[]>;
}

function evidenceFor(ctx: StageContext, id: string, c: CreatorRecord) {
  const pf = ctx.output<PrefilterOut>("prefilter");
  const pre = dataRow(ctx.output<EnrichOut>("enrich"), pf, id) as PrefilterRow;
  const text = ctx.output<TextScreenOut>("text_screen").byId[id];
  const media = ctx.output<MediaPrepOut>("media_prep").byId[id];
  const video = ctx.output<VideoOut>("video_analysis").byId[id]?.analysis;
  return buildEvidence({ ref: pf.refs[id], creator: c, pre, brief: ctx.brief, text, media, video });
}

function mockFinal(ctx: StageContext, items: { ref: string; id: string; ev: Evidence[] }[]): FinalRankOutput {
  const pf = ctx.output<PrefilterOut>("prefilter");
  const ts = ctx.output<TextScreenOut>("text_screen").byId;
  const vs = ctx.output<VideoOut>("video_analysis").byId;
  return {
    assessments: items.map(({ ref, id, ev }) => {
      const data = dataRow(ctx.output<EnrichOut>("enrich"), pf, id)?.dataScore ?? 0.5;
      const score = Math.round(100 * (0.45 * data + 0.35 * (ts[id]?.textScore ?? 0.5) + 0.2 * (vs[id]?.videoScore ?? 0.4)));
      const vid = ev.find((e) => e.kind === "video");
      return {
        ref,
        fit_score: score,
        verdict: score >= 75 ? "strong" : score >= 60 ? "good" : score >= 40 ? "weak" : "reject",
        headline: `[MOCK] Điểm tổng hợp ${score}/100 từ số liệu + sàng lọc + video`,
        reasons: [
          { text: "[MOCK] Hiệu suất view/engagement", evidence: [`${ref}.m1`, `${ref}.m2`].filter((x) => ev.some((e) => e.id === x)) },
          { text: "[MOCK] Khán giả mục tiêu", evidence: [`${ref}.a1`] },
          ...(vid ? [{ text: "[MOCK] Bằng chứng video", evidence: [vid.id] }] : []),
        ],
        risks: [],
        suggested_angle: "[MOCK] Test kem chống nắng ngoài trời 8 tiếng",
      };
    }),
  };
}

export const finalRankStage: StageDef<{ ids: string[] }, BatchOut, FinalRankOut> = {
  name: "final_rank",
  label: "Chấm điểm cuối + lý do có trích dẫn (model mạnh, shortlist)",
  plan(ctx) {
    const { shortlist } = ctx.output<TextScreenOut>("text_screen");
    const size = ctx.funnel.finalBatchSize;
    const tasks = [];
    for (let i = 0; i < shortlist.length; i += size)
      tasks.push({ key: `batch-${i / size}`, input: { ids: shortlist.slice(i, i + size) } });
    return tasks;
  },
  async exec(ctx, input, key) {
    const pf = ctx.output<PrefilterOut>("prefilter");
    const creators = await loadCreators(input.ids);
    const items = input.ids
      .filter((id) => creators.has(id))
      .map((id) => {
        const c = creators.get(id)!;
        return { id, ref: pf.refs[id], c, ev: evidenceFor(ctx, id, c) };
      });

    const blocks = items.map(
      ({ ref, c, ev }) => `=== ${ref} @${c.handle} (${c.nickname}) ===\n${evidenceLines(ev)}`,
    );
    const res = await aiGenerate(
      { runId: ctx.runId, stage: "final_rank", taskKey: key },
      {
        promptVersion: PROMPT_VERSION.final_rank,
        model: ctx.cfg.models.final,
        effort: ctx.cfg.effort.final,
        system: finalRankSystem(ctx.brief),
        content: [{ type: "text", text: `Assess these ${items.length} shortlisted creators:\n\n${blocks.join("\n\n")}` }],
        schema: FinalRankSchema,
        schemaName: "final_rank",
        maxTokens: 12000,
        mock: () => mockFinal(ctx, items),
      },
    );

    const byRef = new Map(res.data.assessments.map((a) => [a.ref, a]));
    const out: BatchOut = { assessments: {}, evidence: {} };
    for (const it of items) {
      out.evidence[it.id] = it.ev;
      const a = byRef.get(it.ref);
      if (!a) {
        ctx.log(`final_rank: model skipped ${it.ref}`, "warn");
        continue;
      }
      // Kiểm tra trích dẫn: chỉ giữ evidence id thật sự thuộc creator này
      const allowed = new Set(it.ev.map((e) => e.id));
      const invalid: string[] = [];
      const clean = (xs: { text: string; evidence: string[] }[]) =>
        xs.map((x) => {
          const v = validateEvidence(x.evidence, allowed);
          invalid.push(...v.invalid);
          return { ...x, evidence: v.valid };
        });
      out.assessments[it.id] = { ...a, reasons: clean(a.reasons), risks: clean(a.risks), invalidEvidence: invalid };
      if (invalid.length) ctx.log(`final_rank: ${it.ref} cited ${invalid.length} unknown evidence id(s): ${invalid.join(", ")}`, "warn");
    }
    return out;
  },
  reduce(ctx, outputs) {
    const res: FinalRankOut = { byId: {}, evidence: {} };
    for (const b of outputs.values()) {
      Object.assign(res.byId, b.assessments);
      Object.assign(res.evidence, b.evidence);
    }
    ctx.log(`Final rank: ${Object.keys(res.byId).length} creators assessed`);
    return res;
  },
};
