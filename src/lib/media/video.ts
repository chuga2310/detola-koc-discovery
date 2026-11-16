/**
 * Chuẩn bị media cho phân tích video bằng AI — phần tối ưu token quan trọng nhất.
 *
 * Gửi cả video cho model là rất đắt (và Claude không nhận video trực tiếp). Thay vào đó:
 *   1. Tải video độ phân giải thấp (yt-dlp, <=720p).
 *   2. Lấy 6 frame tại các mốc cố định: ~1s (hook) rồi 20/40/60/80/95% thời lượng.
 *   3. Ghép 6 frame thành 1 "contact sheet" 3x2, mỗi frame 240x426 -> ảnh 720x852.
 *      Claude tính token ảnh ~ (w*h)/750 => ~820 token / video.
 *      So với gửi 6 ảnh 1080x1920 riêng lẻ (bị resize về ~1568px cạnh dài, ~1.6k token/ảnh)
 *      => ~9.6k token. Tiết kiệm ~90% token hình ảnh mà vẫn thấy rõ hook, demo, bối cảnh.
 *   4. Lấy auto-caption (phụ đề tự động của TikTok) làm transcript -> miễn phí, không cần ASR.
 *
 * Mọi thứ cache trên đĩa theo video id -> idempotent, chạy lại không tải lại.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getConfig } from "../config";
import type { CreatorVideo } from "../types";

const run = promisify(execFile);

export const FRAME_W = 240;
export const FRAME_H = 426;

export interface PreparedMedia {
  videoId: string;
  url: string;
  /** Path tương đối trong media cache, ví dụ "7301.../sheet.jpg" */
  sheet: string;
  sheetWidth: number;
  sheetHeight: number;
  frameTimes: number[];
  durationSec: number | null;
  transcript: string | null;
  /** "video" = contact sheet từ video thật; "cover" = chỉ có ảnh bìa (fallback) */
  kind: "video" | "cover";
}

const mediaDir = (videoId: string) => path.join(getConfig().paths.mediaCache, videoId.replace(/[^\w-]/g, ""));

export async function prepareVideo(video: CreatorVideo, framesPerVideo = 6): Promise<PreparedMedia | null> {
  const dir = mediaDir(video.id);
  const metaPath = path.join(dir, "meta.json");
  if (fs.existsSync(metaPath)) return JSON.parse(fs.readFileSync(metaPath, "utf8")) as PreparedMedia; // cache hit
  fs.mkdirSync(dir, { recursive: true });

  let result: PreparedMedia | null = null;
  try {
    result = await fromVideo(video, dir, framesPerVideo);
  } catch (err) {
    console.warn(`[media] video ${video.id} failed: ${(err as Error).message.slice(0, 200)}`);
  }
  if (!result && video.coverUrl) {
    try {
      result = await fromCover(video, dir);
    } catch (err) {
      console.warn(`[media] cover ${video.id} failed: ${(err as Error).message.slice(0, 200)}`);
    }
  }
  if (result) fs.writeFileSync(metaPath, JSON.stringify(result, null, 2));
  return result;
}

async function fromVideo(video: CreatorVideo, dir: string, framesPerVideo: number): Promise<PreparedMedia> {
  const cfg = getConfig();
  let file = findFile(dir, /^video\.(mp4|webm|mkv|mov)$/);
  if (!file) {
    await run(
      cfg.ytDlpBin,
      [
        "-f",
        "mp4[height<=720]/best[height<=720]/worst",
        "-o",
        path.join(dir, "video.%(ext)s"),
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "vie.*,vi.*,en.*",
        "--sub-format",
        "vtt",
        "--no-playlist",
        "--no-progress",
        "--quiet",
        "--no-warnings",
        video.url,
      ],
      { timeout: 180_000 },
    );
    file = findFile(dir, /^video\.(mp4|webm|mkv|mov)$/);
    if (!file) throw new Error("yt-dlp finished but no video file");
  }

  const duration = await probeDuration(file);
  const d = duration ?? video.durationSec ?? 15;
  // Mốc frame: frame 1 ~1s (hook), còn lại rải đều thân video
  const marks = [Math.min(1, d * 0.05), 0.2, 0.4, 0.6, 0.8, 0.95];
  const times = marks
    .slice(0, framesPerVideo)
    .map((m, i) => (i === 0 ? m : Math.min(d - 0.1, m * d)))
    .map((t) => Number(Math.max(0, t).toFixed(1)));

  for (let i = 0; i < times.length; i++) {
    await run(
      cfg.ffmpegBin,
      ["-y", "-loglevel", "error", "-ss", String(times[i]), "-i", file, "-frames:v", "1",
        "-vf", `scale=${FRAME_W}:${FRAME_H}:force_original_aspect_ratio=decrease,pad=${FRAME_W}:${FRAME_H}:(ow-iw)/2:(oh-ih)/2`,
        path.join(dir, `frame_${i + 1}.jpg`)],
      { timeout: 60_000 },
    );
  }
  const cols = 3;
  const rows = Math.ceil(times.length / cols);
  await run(
    cfg.ffmpegBin,
    ["-y", "-loglevel", "error", "-framerate", "1", "-start_number", "1", "-i", path.join(dir, "frame_%d.jpg"),
      "-vf", `tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "5", path.join(dir, "sheet.jpg")],
    { timeout: 60_000 },
  );

  // Xoá video gốc sau khi cắt frame -> tiết kiệm đĩa khi scale 500+ creator
  if (process.env.KEEP_VIDEOS !== "1") fs.rmSync(file, { force: true });

  return {
    videoId: video.id,
    url: video.url,
    sheet: path.relative(getConfig().paths.mediaCache, path.join(dir, "sheet.jpg")),
    sheetWidth: FRAME_W * cols,
    sheetHeight: FRAME_H * rows,
    frameTimes: times,
    durationSec: duration,
    transcript: readTranscript(dir),
    kind: "video",
  };
}

async function fromCover(video: CreatorVideo, dir: string): Promise<PreparedMedia> {
  const res = await fetch(video.coverUrl!, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`cover HTTP ${res.status}`);
  const raw = path.join(dir, "cover_raw");
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  await run(getConfig().ffmpegBin, ["-y", "-loglevel", "error", "-i", raw, "-vf", "scale=360:-2", path.join(dir, "sheet.jpg")], {
    timeout: 60_000,
  });
  fs.rmSync(raw, { force: true });
  return {
    videoId: video.id,
    url: video.url,
    sheet: path.relative(getConfig().paths.mediaCache, path.join(dir, "sheet.jpg")),
    sheetWidth: 360,
    sheetHeight: 640,
    frameTimes: [0],
    durationSec: video.durationSec ?? null,
    transcript: null,
    kind: "cover",
  };
}

async function probeDuration(file: string): Promise<number | null> {
  try {
    const { stdout } = await run(getConfig().ffprobeBin, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
    const d = Number(stdout.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

function findFile(dir: string, re: RegExp): string | null {
  const f = fs.readdirSync(dir).find((x) => re.test(x));
  return f ? path.join(dir, f) : null;
}

/** Đọc file .vtt -> text thuần, bỏ timestamp và dòng lặp (auto-caption hay lặp dòng) */
function readTranscript(dir: string): string | null {
  const vtt = fs.readdirSync(dir).find((f) => f.endsWith(".vtt"));
  if (!vtt) return null;
  const lines = fs
    .readFileSync(path.join(dir, vtt), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.includes("-->") && !/^WEBVTT|^Kind:|^Language:|^\d+$/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const dedup = lines.filter((l, i) => l !== lines[i - 1]);
  const text = dedup.join(" ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 1200) : null;
}

export function readSheetBase64(sheet: string): string {
  return fs.readFileSync(path.join(getConfig().paths.mediaCache, sheet)).toString("base64");
}

/** Chọn video để phân tích: ưu tiên video liên quan keyword có view cao + 1 video gần nhất */
export function pickVideos(videos: CreatorVideo[], count: number, hasKeyword: (v: CreatorVideo) => boolean): CreatorVideo[] {
  const withUrl = videos.filter((v) => v.url);
  const relevant = withUrl.filter(hasKeyword).sort((a, b) => b.views - a.views);
  const recent = [...withUrl].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const top = [...withUrl].sort((a, b) => b.views - a.views);
  const picked: CreatorVideo[] = [];
  for (const v of [...relevant.slice(0, 1), ...recent.slice(0, 1), ...top, ...recent]) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.id === v.id)) picked.push(v);
  }
  return picked;
}
