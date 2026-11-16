/**
 * Stage 3 — text_screen: model RẺ đọc "thẻ" text gọn của creator, batch 10 creator / call.
 *
 * Tiết kiệm token:
 *  - Batch: system prompt + brief chỉ gửi 1 lần cho 10 creator (và được prompt-cache cho batch sau).
 *  - Thẻ creator viết dạng dòng gọn (~150 token) thay vì JSON raw (~2-5k token).
 *  - Chỉ chạy trên ~4N creator đã qua prefilter.
 * Output dùng để chọn shortlist ~2N creator cho bước phân tích video (đắt nhất).
 */
import { aiGenerate } from "../../ai/gateway";
import type { CreatorRecord } from "../../types";
import { compactNum, pct, stableHash, truncate } from "../../util";
import { loadCreators } from "../creators";
import { PROMPT_VERSION, textScreenSystem } from "../prompts";
import { TextScreenSchema, type TextScreenOutput } from "../schemas";
import type { PrefilterRow } from "../scoring";
import { signalsOf } from "../signals";
import type { StageContext, StageDef } from "../stage";
import { dataRow, type EnrichOut } from "./enrich";
import type { PrefilterOut } from "./prefilter";

export type TextResult = TextScreenOutput["results"][number] & { textScore: number };

export interface TextScreenOut {
  byId: Record<string, TextResult>;
  ranking: { id: string; combined: number }[];
  shortlist: string[];
}

export function creatorCard(ref: string, c: CreatorRecord, pre: PrefilterRow): string {
  const ages = c.audience?.ageBuckets
    ? Object.entries(c.audience.ageBuckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k} ${pct(v)}`)
        .join(", ")
    : "?";
  const vids = [...c.videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((v) => `"${truncate(v.caption, 90)}" (${compactNum(v.views)}v${v.adViewRatio ? `, ${Math.round(v.adViewRatio)}% ad` : ""})`)
    .join(" | ");
  const prods = (c.topProducts ?? []).slice(0, 3).map((p) => truncate(p.title, 60)).join("; ");
  const s = signalsOf(c, pre.raw.matchedKeywords.length ? pre.raw.matchedKeywords : []);
  const signals = [
    s.paidViewShare !== undefined ? `paid views ${pct(s.paidViewShare)}` : null,
    s.videoGpm ? `GPM ${compactNum(s.videoGpm)} VND/1k views` : null,
    s.avgUnitPriceVnd ? `avg price sold ${compactNum(s.avgUnitPriceVnd)} VND` : null,
    s.followerGrowthPct !== undefined ? `followers +${pct(s.followerGrowthPct, 1)}/30d` : null,
    s.revenueActiveDays !== undefined ? `GMV on ${s.revenueActiveDays}/30 days, trend ${s.revenueTrend}` : null,
    s.aiVideoCount ? `${s.aiVideoCount} AI-generated videos` : null,
    s.categoryRevenueShare !== undefined ? `${pct(s.categoryRevenueShare)} of GMV in the brief's category` : null,
    s.sameCategoryProducts.length ? `already sold same-category products: ${s.sameCategoryProducts.slice(0, 2).map((x) => truncate(x, 40)).join("; ")}` : null,
  ].filter(Boolean);
  return [
    `${ref} | @${c.handle} | ${compactNum(c.followers)} fl | ${compactNum(pre.raw.videoViews30d)} views/30d | median ${compactNum(pre.raw.avgViews)} v/top-vid | ER ${pct(pre.raw.engagementRate, 1)} | GMV30 ${compactNum(c.metrics.revenueVnd)} | sold ${compactNum(c.metrics.itemsSold)}`,
    `aud: F ${c.audience?.femalePct !== undefined ? pct(c.audience.femalePct) : "?"} | ${ages}`,
    `cats: ${c.categories.slice(0, 3).map((x) => `${x.name} ${pct(x.share)}`).join(", ") || "?"}`,
    `kw: ${pre.raw.matchedKeywords.join(", ") || "none"} (${pre.raw.keywordVideos}/${pre.raw.keywordTotal} vids)`,
    c.bio ? `bio: ${truncate(c.bio, 80)}` : null,
    pre.raw.videoFocus !== undefined
      ? `sales mix: ${pct(pre.raw.videoFocus)} from videos, ${pct(1 - pre.raw.videoFocus)} from livestream; promotes ${c.metrics.productCount ?? "?"} products / ${c.metrics.shopCount ?? "?"} shops`
      : null,
    c.subCategories?.length ? `sub-cats: ${c.subCategories.slice(0, 3).join(", ")}` : null,
    signals.length ? `signals: ${signals.join(" | ")}` : null,
    `vids: ${vids || "none"}`,
    prods ? `prods: ${prods}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Điểm text 0..1. Red flag trừ điểm. */
export const textScore = (r: TextScreenOutput["results"][number]) =>
  Math.max(0, (r.brand_fit * 0.4 + r.product_relevance * 0.35 + r.audience_fit * 0.25) / 10 - 0.08 * r.red_flags.length);

function mockScreen(ctx: StageContext, items: { ref: string; c: CreatorRecord; pre: PrefilterRow }[]): TextScreenOutput {
  return {
    results: items.map(({ ref, c, pre }) => {
      const jitter = (parseInt(stableHash(c.id).slice(0, 2), 16) % 3) - 1;
      const brand = Math.round(Math.min(10, Math.max(0, 3 + pre.raw.categoryShare * 6 + jitter)));
      return {
        ref,
        niche: pre.raw.categoryShare > 0.5 ? "Review mỹ phẩm / skincare" : "Lifestyle, bán đa ngành",
        formats: ["review"],
        brand_fit: brand,
        product_relevance: Math.min(10, Math.round(pre.breakdown.keyword * 10)),
        audience_fit: Math.round((pre.breakdown.audience ?? 0.5) * 10),
        red_flags: pre.raw.categoryShare < 0.25 ? ["Bán nhiều ngành hàng, ít tập trung làm đẹp"] : [],
        summary: `[MOCK] ${ctx.brief.category}: share ${pct(pre.raw.categoryShare)}, keyword ${pre.raw.keywordVideos} video.`,
      };
    }),
  };
}

export const textScreenStage: StageDef<{ ids: string[] }, Record<string, TextScreenOutput["results"][number]>, TextScreenOut> = {
  name: "text_screen",
  label: "Sàng lọc nội dung bằng model rẻ (batch)",
  plan(ctx) {
    const pf = ctx.output<PrefilterOut>("prefilter");
    const en = ctx.output<EnrichOut>("enrich");
    // Chỉ screen creator đã enrich thành công và vẫn qua hard filter với dữ liệu đầy đủ
    const keptIds = pf.keptIds.filter((id) => dataRow(en, pf, id)?.passed && !en.failed.includes(id));
    const size = ctx.funnel.textBatchSize;
    const tasks = [];
    for (let i = 0; i < keptIds.length; i += size)
      tasks.push({ key: `batch-${i / size}`, input: { ids: keptIds.slice(i, i + size) } });
    return tasks;
  },
  async exec(ctx, input, key) {
    const pf = ctx.output<PrefilterOut>("prefilter");
    const en = ctx.output<EnrichOut>("enrich");
    const creators = await loadCreators(input.ids);
    const items = input.ids
      .filter((id) => creators.has(id))
      .map((id) => ({ ref: pf.refs[id], c: creators.get(id)!, pre: dataRow(en, pf, id)! }));

    const res = await aiGenerate(
      { runId: ctx.runId, stage: "text_screen", taskKey: key },
      {
        promptVersion: PROMPT_VERSION.text_screen,
        model: ctx.cfg.models.screen,
        effort: ctx.cfg.effort.screen,
        system: textScreenSystem(ctx.brief),
        content: [{ type: "text", text: `Screen these ${items.length} creators:\n\n${items.map((x) => creatorCard(x.ref, x.c, x.pre)).join("\n\n")}` }],
        schema: TextScreenSchema,
        schemaName: "text_screen",
        maxTokens: 6000,
        mock: () => mockScreen(ctx, items),
      },
    );
    const byRef = new Map(res.data.results.map((r) => [r.ref, r]));
    const out: Record<string, TextScreenOutput["results"][number]> = {};
    for (const it of items) {
      const r = byRef.get(it.ref);
      if (r) out[it.c.id] = r;
      else ctx.log(`text_screen: model skipped ${it.ref}`, "warn");
    }
    return out;
  },
  reduce(ctx, outputs) {
    const pf = ctx.output<PrefilterOut>("prefilter");
    const en = ctx.output<EnrichOut>("enrich");
    const byId: Record<string, TextResult> = {};
    for (const batch of outputs.values()) for (const [id, r] of Object.entries(batch)) byId[id] = { ...r, textScore: textScore(r) };
    const dataScore = new Map(Object.keys(byId).map((id) => [id, dataRow(en, pf, id)?.dataScore ?? 0]));
    // Kết hợp 50% số liệu + 50% đánh giá nội dung để chọn ai đáng tốn tiền phân tích video
    const ranking = Object.keys(byId)
      .map((id) => ({ id, combined: Number((0.5 * (dataScore.get(id) ?? 0) + 0.5 * byId[id].textScore).toFixed(4)) }))
      .sort((a, b) => b.combined - a.combined);
    const shortlist = ranking.slice(0, ctx.funnel.videoKeep).map((r) => r.id);
    ctx.log(`Text screen: ${ranking.length} creators scored -> shortlist ${shortlist.length} for video analysis`);
    return { byId, ranking, shortlist };
  },
};
