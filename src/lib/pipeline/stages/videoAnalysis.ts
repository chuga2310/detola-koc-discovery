/**
 * Stage 5 — video_analysis: model vision xem contact sheet + transcript của 2 video / creator.
 *
 * Quyết định thiết kế quan trọng: prompt KHÔNG chứa brief campaign.
 * => Kết quả là "hồ sơ nội dung" khách quan của creator, cache theo (ảnh + caption + transcript).
 * => Campaign sau (kem dưỡng, son, serum...) gặp lại creator này: 0 token cho phần đắt nhất.
 * Việc đánh giá "hợp với campaign không" để stage final_rank làm trên text gọn (rẻ hơn nhiều).
 *
 * 1 call / creator (gộp 2 video) thay vì 1 call / video -> system prompt chỉ tính 1 lần.
 */
import { aiGenerate } from "../../ai/gateway";
import type { ContentPart } from "../../ai/provider";
import { readSheetBase64, type PreparedMedia } from "../../media/video";
import { clamp, keywordHits, stableHash, truncate } from "../../util";
import { loadCreators } from "../creators";
import { PROMPT_VERSION, VIDEO_ANALYSIS_SYSTEM } from "../prompts";
import { VideoAnalysisSchema, type VideoAnalysisOutput } from "../schemas";
import type { StageDef } from "../stage";
import type { MediaPrepOut } from "./mediaPrep";

export interface VideoResult {
  analysis: VideoAnalysisOutput;
  videoScore: number;
  cacheHit: boolean;
}
export interface VideoOut {
  byId: Record<string, VideoResult>;
}

/** Điểm video 0..1 (không phụ thuộc campaign): chất lượng tổng + tín hiệu demo + an toàn thương hiệu */
export function videoScore(a: VideoAnalysisOutput): number {
  const vids = a.videos;
  const demo = vids.length
    ? vids.reduce((s, v) => s + (v.applies_on_skin ? 0.5 : 0) + (v.shows_texture ? 0.3 : 0) + (v.before_after ? 0.2 : 0), 0) / vids.length
    : 0;
  const prod = vids.length ? vids.reduce((s, v) => s + v.production_quality, 0) / vids.length / 5 : 0;
  const base = 0.55 * (a.creator.overall_video_quality / 10) + 0.25 * clamp(demo) + 0.2 * prod;
  const safety = a.creator.brand_safety === "risk" ? 0.5 : a.creator.brand_safety === "caution" ? 0.85 : 1;
  return Number((base * safety).toFixed(4));
}

function mockAnalysis(captions: string[], creatorId: string): VideoAnalysisOutput {
  const h = parseInt(stableHash(creatorId).slice(0, 4), 16);
  const beauty = captions.some((c) => keywordHits(c, ["kem", "skincare", "chống nắng", "serum", "makeup", "da"]).length);
  return {
    videos: captions.map((cap, i) => ({
      ref: `v${i + 1}`,
      format: beauty ? "review" : "vlog",
      on_camera: h % 3 === 0 ? "voiceover_broll" : "face_to_camera",
      hook: `[MOCK] Mở đầu: ${truncate(cap, 50)}`,
      shows_texture: beauty && h % 2 === 0,
      applies_on_skin: beauty,
      before_after: h % 5 === 0,
      shows_packaging: true,
      production_quality: 2 + (h % 4),
      topics: [beauty ? "skincare" : "lifestyle"],
      brands_or_products: [],
      observations: [{ frame: 2, quote: null, note: "[MOCK] Quan sát giả lập — không phải phân tích AI thật" }],
    })),
    creator: {
      primary_niche: beauty ? "Skincare review" : "Lifestyle",
      content_style: "[MOCK] Phong cách giả lập",
      persona: "[MOCK]",
      skin_topics: beauty ? ["da dầu"] : [],
      strengths: ["[MOCK]"],
      concerns: [],
      brand_safety: "safe",
      brand_safety_note: "",
      overall_video_quality: 4 + (h % 6),
    },
  };
}

export const videoAnalysisStage: StageDef<{ creatorId: string }, VideoResult | null, VideoOut> = {
  name: "video_analysis",
  label: "Phân tích video bằng AI vision (contact sheet + transcript)",
  tolerateFailures: true,
  plan(ctx) {
    const { byId } = ctx.output<MediaPrepOut>("media_prep");
    return Object.entries(byId)
      .filter(([, media]) => media.length > 0)
      .map(([id]) => ({ key: id, input: { creatorId: id } }));
  },
  async exec(ctx, input, key) {
    const media: PreparedMedia[] = ctx.output<MediaPrepOut>("media_prep").byId[input.creatorId] ?? [];
    const c = (await loadCreators([input.creatorId])).get(input.creatorId)!;
    const content: ContentPart[] = [];
    const captions: string[] = [];
    media.forEach((m, i) => {
      const v = c.videos.find((x) => x.id === m.videoId);
      captions.push(v?.caption ?? "");
      const header = [
        `VIDEO v${i + 1}${m.kind === "cover" ? " (COVER IMAGE ONLY - video could not be downloaded)" : ""}`,
        `caption: ${truncate(v?.caption, 300) || "(none)"}`,
        v?.productTitle ? `tagged product: ${truncate(v.productTitle, 100)}` : null,
        m.durationSec ? `duration: ${Math.round(m.durationSec)}s` : null,
        m.kind === "video" ? `frame timestamps (s): ${m.frameTimes.map((t, k) => `${k + 1}=${t}`).join(", ")}` : null,
        `transcript: ${m.transcript ? truncate(m.transcript, 700) : "(not available)"}`,
      ]
        .filter(Boolean)
        .join("\n");
      content.push({ type: "text", text: header });
      content.push({ type: "image", mediaType: "image/jpeg", base64: readSheetBase64(m.sheet) });
    });
    content.push({ type: "text", text: `Analyze creator @${c.handle} based on the ${media.length} video(s) above.` });

    const res = await aiGenerate(
      { runId: ctx.runId, stage: "video_analysis", taskKey: key },
      {
        promptVersion: PROMPT_VERSION.video_analysis,
        model: ctx.cfg.models.video,
        effort: ctx.cfg.effort.video,
        system: VIDEO_ANALYSIS_SYSTEM,
        content,
        schema: VideoAnalysisSchema,
        schemaName: "video_analysis",
        maxTokens: 6000,
        mock: () => mockAnalysis(captions, c.id),
      },
    );
    return { analysis: res.data, videoScore: videoScore(res.data), cacheHit: res.cacheHit };
  },
  reduce(ctx, outputs) {
    const byId: Record<string, VideoResult> = {};
    for (const [id, r] of outputs) if (r) byId[id] = r;
    const reused = Object.values(byId).filter((r) => r.cacheHit).length;
    ctx.log(`Video analysis: ${Object.keys(byId).length} creators analysed (${reused} reused from cache)`);
    return { byId };
  },
};
