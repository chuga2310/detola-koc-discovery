/**
 * Stage 4 — media_prep: chọn 2 video / creator, tải + cắt frame + ghép contact sheet.
 * 0 token (chỉ I/O + ffmpeg). Tách khỏi stage AI để:
 *  - lỗi tải video không làm hỏng/tốn lại tiền gọi AI,
 *  - có thể scale riêng (worker media nhiều CPU/băng thông).
 */
import { pickVideos, prepareVideo, type PreparedMedia } from "../../media/video";
import { keywordHits } from "../../util";
import { loadCreators } from "../creators";
import type { StageDef } from "../stage";
import type { TextScreenOut } from "./textScreen";

export interface MediaPrepOut {
  byId: Record<string, PreparedMedia[]>;
}

export const mediaPrepStage: StageDef<{ creatorId: string }, PreparedMedia[], MediaPrepOut> = {
  name: "media_prep",
  label: "Tải video + trích frame + contact sheet (0 token)",
  concurrency: 3,
  tolerateFailures: true,
  plan(ctx) {
    const { shortlist } = ctx.output<TextScreenOut>("text_screen");
    return shortlist.map((id) => ({ key: id, input: { creatorId: id } }));
  },
  async exec(ctx, input) {
    const c = loadCreators([input.creatorId]).get(input.creatorId);
    if (!c) throw new Error("creator not found");
    const videos = pickVideos(c.videos, ctx.funnel.videosPerCreator, (v) =>
      keywordHits(`${v.caption} ${v.hashtags.join(" ")} ${v.productTitle ?? ""}`, ctx.brief.keywords).length > 0,
    );
    // Nguồn video trả phí (Kalodata 0.5 credit/video): mặc định chỉ cho video CHÍNH của mỗi creator
    const paidMode = process.env.KALODATA_VIDEO_URL_FALLBACK ?? "primary"; // primary | all | off
    const prepared: PreparedMedia[] = [];
    for (const [i, v] of videos.entries()) {
      const allowPaid = paidMode === "all" || (paidMode === "primary" && i === 0);
      const m = await prepareVideo(v, { framesPerVideo: ctx.funnel.framesPerVideo, allowPaid, runId: ctx.runId });
      if (m) prepared.push(m);
    }
    if (videos.length && !prepared.length) ctx.log(`@${c.handle}: no media could be prepared`, "warn");
    return prepared;
  },
  reduce(ctx, outputs) {
    const byId: Record<string, PreparedMedia[]> = {};
    let n = 0;
    for (const [id, media] of outputs) {
      byId[id] = media ?? [];
      n += byId[id].length;
    }
    ctx.log(`Media ready: ${n} videos for ${Object.values(byId).filter((m) => m.length).length} creators`);
    return { byId };
  },
};
