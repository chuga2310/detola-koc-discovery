/**
 * Stage 7 — select: chọn N KOC cuối cùng trong ngân sách + đóng gói báo cáo. 0 token.
 *
 * finalScore = 0.7 * fit_score (AI, theo rubric) + 0.3 * dataScore (số liệu thuần)
 * -> AI quyết định chính, nhưng luôn bị "neo" vào số liệu thật để tránh lệch.
 * Sau đó knapsack chọn bộ N creator có tổng điểm cao nhất mà tổng chi phí <= ngân sách.
 */
import type { CampaignBrief, Evidence } from "../../types";
import { loadCreators, tiktokProfileUrl } from "../creators";
import { selectWithinBudget } from "../optimizer";
import type { StageDef } from "../stage";
import type { FinalRankOut } from "./finalRank";
import { dataRow, type EnrichOut } from "./enrich";
import type { PrefilterOut } from "./prefilter";
import { productTypeKeywords } from "../../brief/keywords";
import { signalsOf } from "../signals";
import type { TextScreenOut } from "./textScreen";
import type { VideoOut } from "./videoAnalysis";

export interface Pick {
  rank: number;
  id: string;
  ref: string;
  handle: string;
  nickname: string;
  avatarUrl?: string;
  profileUrl: string;
  followers: number;
  estCostVnd: number;
  costTier: string;
  scores: { final: number; fit: number; data: number; text: number | null; video: number | null };
  verdict: string;
  headline: string;
  reasons: { text: string; evidence: Evidence[] }[];
  risks: { text: string; evidence: Evidence[] }[];
  suggestedAngle: string;
  evidence: Evidence[];
  invalidEvidence: string[];
  videoAnalyzed: boolean;
  /** Tín hiệu nhanh cho marketer (từ dữ liệu Kalodata đã có) */
  signals?: {
    paidViewShare?: number;
    videoGpm?: number;
    avgUnitPriceVnd?: number;
    followerGrowthPct?: number;
    contactChannels: string[];
    categoryRevenueShare?: number;
    sameCategoryProducts?: string[];
    analyzedVideoRoas?: number;
  };
}

export interface Report {
  brief: CampaignBrief;
  picks: Pick[];
  alternates: Pick[];
  totals: { estCostVnd: number; budgetVnd: number; method: string };
  funnel: { pool: number; prefilterPassed: number; enriched: number; textScreened: number; videoAnalyzed: number; finalRanked: number; selected: number };
}

export const selectStage: StageDef<never, never, Report> = {
  name: "select",
  label: "Chọn N KOC tối ưu trong ngân sách (knapsack, 0 token)",
  plan: () => [],
  exec: async () => {
    throw new Error("select has no tasks");
  },
  async reduce(ctx) {
    const pf = ctx.output<PrefilterOut>("prefilter");
    const ts = ctx.output<TextScreenOut>("text_screen");
    const vs = ctx.output<VideoOut>("video_analysis");
    const fr = ctx.output<FinalRankOut>("final_rank");
    const en = ctx.output<EnrichOut>("enrich");
    const ids = Object.keys(fr.byId);
    const creators = await loadCreators(ctx.runId, ids);

    const all: Pick[] = ids.map((id) => {
      const a = fr.byId[id];
      const pre = dataRow(en, pf, id)!;
      const c = creators.get(id)!;
      const ev = fr.evidence[id] ?? [];
      const evMap = new Map(ev.map((e) => [e.id, e]));
      const resolve = (xs: { text: string; evidence: string[] }[]) =>
        xs.map((x) => ({ text: x.text, evidence: x.evidence.map((e) => evMap.get(e)!).filter(Boolean) }));
      const final = Number((0.7 * a.fit_score + 0.3 * pre.dataScore * 100).toFixed(1));
      return {
        rank: 0,
        id,
        ref: pf.refs[id],
        handle: c.handle,
        nickname: c.nickname,
        avatarUrl: c.avatarUrl,
        profileUrl: tiktokProfileUrl(c.handle),
        followers: c.followers,
        estCostVnd: pre.estCostVnd,
        costTier: pre.costTier,
        scores: {
          final,
          fit: a.fit_score,
          data: Number((pre.dataScore * 100).toFixed(1)),
          text: ts.byId[id] ? Number((ts.byId[id].textScore * 100).toFixed(1)) : null,
          video: vs.byId[id] ? Number((vs.byId[id].videoScore * 100).toFixed(1)) : null,
        },
        verdict: a.verdict,
        headline: a.headline,
        reasons: resolve(a.reasons),
        risks: resolve(a.risks),
        suggestedAngle: a.suggested_angle,
        evidence: ev,
        invalidEvidence: a.invalidEvidence,
        videoAnalyzed: !!vs.byId[id],
        signals: (() => {
          const s = signalsOf(c, productTypeKeywords(ctx.brief));
          return {
            paidViewShare: s.paidViewShare,
            videoGpm: s.videoGpm,
            avgUnitPriceVnd: s.avgUnitPriceVnd,
            followerGrowthPct: s.followerGrowthPct,
            contactChannels: s.contactChannels,
            categoryRevenueShare: s.categoryRevenueShare,
            sameCategoryProducts: s.sameCategoryProducts,
            analyzedVideoRoas: s.analyzedVideoStats?.roas,
          };
        })(),
      };
    });

    // Loại "reject" khỏi tập được chọn; chọn tối ưu trong ngân sách
    const eligible = all.filter((p) => p.verdict !== "reject");
    const sel = selectWithinBudget(
      eligible.map((p) => ({ id: p.id, score: p.scores.final, cost: p.estCostVnd })),
      ctx.brief.numKocs,
      ctx.brief.budgetVnd,
    );
    const picks = sel.ids.map((id, i) => ({ ...all.find((p) => p.id === id)!, rank: i + 1 }));
    const alternates = eligible
      .filter((p) => !sel.ids.includes(p.id))
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, 5)
      .map((p, i) => ({ ...p, rank: picks.length + i + 1 }));

    if (picks.length < ctx.brief.numKocs)
      ctx.log(`Only ${picks.length}/${ctx.brief.numKocs} KOCs fit the budget/quality bar`, "warn");
    ctx.log(`Selected ${picks.length} KOCs, est. cost ${sel.totalCost.toLocaleString("vi-VN")} / ${ctx.brief.budgetVnd.toLocaleString("vi-VN")} VND (${sel.method})`);

    return {
      brief: ctx.brief,
      picks,
      alternates,
      totals: { estCostVnd: sel.totalCost, budgetVnd: ctx.brief.budgetVnd, method: sel.method },
      funnel: {
        pool: pf.stats.pool,
        prefilterPassed: pf.stats.passed,
        enriched: en.rows.length,
        textScreened: Object.keys(ts.byId).length,
        videoAnalyzed: Object.keys(vs.byId).length,
        finalRanked: ids.length,
        selected: picks.length,
      },
    };
  },
};
