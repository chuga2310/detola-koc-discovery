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
    const prepared: PreparedMedia[] = [];
    for (const v of videos) {
      const m = await prepareVideo(v, ctx.funnel.framesPerVideo);
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
