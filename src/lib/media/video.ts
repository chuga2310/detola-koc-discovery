/**
 * Chuẩn bị media cho phân tích video bằng AI — phần tối ưu token (và credit) quan trọng nhất.
 *
 * Nguồn media theo thứ tự rẻ -> đắt:
 *   1. yt-dlp (MIỄN PHÍ): auto-caption tiếng Việt của TikTok (transcript) + thumbnail.
 *      Luôn chạy cho mọi video.
 *   2. yt-dlp tải video (MIỄN PHÍ): TikTok hiện thường chặn format video với client không phải app
 *      (chỉ trả audio), nên bước này hay thất bại -> không phụ thuộc vào nó.
 *   3. Kalodata `video/url` (0.5 CREDIT): link mp4 chính thức. Chỉ dùng cho video CHÍNH của mỗi
 *      creator (KALODATA_VIDEO_URL_FALLBACK=primary) -> 1 contact sheet đầy đủ / creator.
 *   4. Không có video: dùng thumbnail làm "sheet" 1 khung (kind = "cover") + transcript.
 *
 * Từ video: lấy 6 frame tại mốc cố định (~1s cho hook, rồi 20/40/60/80/95%), resize 240x426,
 * ghép contact sheet 3x2 (720x852). Claude tính token ảnh ~ (w*h)/750 => ~820 token / video,
 * so với ~9.6k token nếu gửi 6 frame full-res riêng lẻ => tiết kiệm ~90% token hình ảnh.
 *
 * Mọi thứ cache trên đĩa theo video id (meta.json) -> idempotent, chạy lại không tải / trả phí lại.
 *
 * GHI CHÚ: cắt 6 frame tĩnh là cách TẠM vì model hiện chỉ đọc ảnh, không đọc video. Nó mất chuyển động
 * (thoa / tán / miết texture), nhịp dựng, âm thanh và mọi thứ giữa 2 frame. Nếu có model đọc video gốc tốt,
 * phân tích sẽ cải thiện rất nhiều: khi đó chỉ cần gửi MP4 thay cho contact sheet ở stage video_analysis,
 * schema output + cache + các stage sau giữ nguyên.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getConfig } from "../config";
import { kaloVideoUrl, logAvoidedCredit } from "../sources/kalodataApi";
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
  /** "video" = contact sheet từ video thật; "cover" = chỉ có thumbnail */
  kind: "video" | "cover";
  /** Video lấy từ đâu (để minh bạch chi phí) */
  via: "yt-dlp" | "kalodata" | "thumbnail";
}

export interface PrepareOptions {
  framesPerVideo?: number;
  /** Cho phép dùng nguồn trả phí (Kalodata video/url) cho video này */
  allowPaid?: boolean;
  runId?: string | null;
}

const mediaDir = (videoId: string) => path.join(getConfig().paths.mediaCache, videoId.replace(/[^\w-]/g, ""));

export async function prepareVideo(video: CreatorVideo, opts: PrepareOptions = {}): Promise<PreparedMedia | null> {
  const dir = mediaDir(video.id);
  const metaPath = path.join(dir, "meta.json");
  if (fs.existsSync(metaPath)) {
    const cached = JSON.parse(fs.readFileSync(metaPath, "utf8")) as PreparedMedia;
    // Đã có contact sheet đầy đủ, hoặc lần này cũng không được phép trả phí -> dùng lại
    if (cached.kind === "video" || !opts.allowPaid) {
      if (cached.via === "kalodata") logAvoidedCredit(opts.runId, "/tiktok/video/url", 0.5); // để benchmark thấy chi phí lạnh
      // Đọc lại transcript từ file phụ đề đã lưu (rẻ, 0 mạng): cache cũ có thể giữ bản dịch tiếng Anh
      const transcript = readTranscript(dir) ?? cached.transcript;
      if (transcript !== cached.transcript) {
        cached.transcript = transcript;
        fs.writeFileSync(metaPath, JSON.stringify(cached, null, 2));
      }
      return cached;
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const cfg = getConfig();

  // 1) Miễn phí: transcript + thumbnail
  if (video.url) {
    try {
      await run(
        cfg.ytDlpBin,
        ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "vie.*,vi.*,en.*", "--sub-format", "vtt",
          "--write-thumbnail", "--convert-thumbnails", "jpg", "-o", path.join(dir, "meta"), "--no-playlist", "--quiet", "--no-warnings", video.url],
        { timeout: 120_000 },
      );
    } catch (err) {
      console.warn(`[media] ${video.id} metadata failed: ${(err as Error).message.slice(0, 160)}`);
    }
  }

  // 2) Miễn phí: thử tải video (chỉ nhận format có hình)
  let file = findFile(dir, /^video\.(mp4|webm|mkv|mov)$/);
  let via: PreparedMedia["via"] = "yt-dlp";
  if (!file && video.url) {
    try {
      await run(
        cfg.ytDlpBin,
        ["-f", "b[vcodec!=none][height<=720]/bv*[height<=720]+ba/b[vcodec!=none]", "-o", path.join(dir, "video.%(ext)s"),
          "--no-playlist", "--quiet", "--no-warnings", video.url],
        { timeout: 180_000 },
      );
      file = findFile(dir, /^video\.(mp4|webm|mkv|mov)$/);
    } catch {
      /* TikTok chặn format video -> xuống bước 3 */
    }
  }

  // 3) Trả phí (0.5 credit): link mp4 chính thức từ Kalodata, chỉ khi được phép
  if (!file && opts.allowPaid && process.env.KALODATA_API_KEY) {
    try {
      const link = await kaloVideoUrl(video.id, opts.runId);
      if (link) {
        const res = await fetch(link, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(path.join(dir, "video.mp4"), Buffer.from(await res.arrayBuffer()));
        file = path.join(dir, "video.mp4");
        via = "kalodata";
      }
    } catch (err) {
      console.warn(`[media] ${video.id} kalodata video url failed: ${(err as Error).message.slice(0, 160)}`);
    }
  }

  let result: PreparedMedia | null = null;
  if (file) result = await sheetFromVideo(video, dir, file, opts.framesPerVideo ?? 6, via);
  if (!result) result = await sheetFromThumbnail(video, dir);
  if (result) fs.writeFileSync(metaPath, JSON.stringify(result, null, 2));
  return result;
}

async function sheetFromVideo(video: CreatorVideo, dir: string, file: string, framesPerVideo: number, via: PreparedMedia["via"]): Promise<PreparedMedia> {
  const cfg = getConfig();
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
  // Xoá video gốc + frame lẻ sau khi ghép -> chỉ giữ sheet ~60KB (quan trọng khi scale 500+ creator)
  if (process.env.KEEP_VIDEOS !== "1") {
    fs.rmSync(file, { force: true });
    for (let i = 1; i <= times.length; i++) fs.rmSync(path.join(dir, `frame_${i}.jpg`), { force: true });
  }
  return {
    videoId: video.id,
    url: video.url,
    sheet: rel(dir, "sheet.jpg"),
    sheetWidth: FRAME_W * cols,
    sheetHeight: FRAME_H * rows,
    frameTimes: times,
    durationSec: duration,
    transcript: readTranscript(dir),
    kind: "video",
    via,
  };
}

async function sheetFromThumbnail(video: CreatorVideo, dir: string): Promise<PreparedMedia | null> {
  let src = findFile(dir, /^meta\.jpg$/);
  if (!src && video.coverUrl) {
    try {
      const res = await fetch(video.coverUrl, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        src = path.join(dir, "cover_raw");
        fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
      }
    } catch {
      /* bỏ qua */
    }
  }
  if (!src) return null;
  await run(getConfig().ffmpegBin, ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=360:-2", path.join(dir, "sheet.jpg")], {
    timeout: 60_000,
  });
  return {
    videoId: video.id,
    url: video.url,
    sheet: rel(dir, "sheet.jpg"),
    sheetWidth: 360,
    sheetHeight: 640,
    frameTimes: [0],
    durationSec: video.durationSec ?? null,
    transcript: readTranscript(dir),
    kind: "cover",
    via: "thumbnail",
  };
}

const rel = (dir: string, f: string) => path.relative(getConfig().paths.mediaCache, path.join(dir, f));

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
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((x) => re.test(x));
  return f ? path.join(dir, f) : null;
}

/** Đọc file .vtt -> text thuần, bỏ timestamp và dòng lặp (auto-caption hay lặp dòng) */
/**
 * Thứ tự ưu tiên phụ đề: tiếng Việt gốc -> tiếng Anh -> bất kỳ.
 * TikTok thường trả cả `vie-VN` (lời nói gốc) lẫn `eng-US` (máy dịch). Trước đây lấy file .vtt
 * đầu tiên theo bảng chữ cái nên `eng-US` thắng -> AI đọc bản dịch máy, trích dẫn sai sắc thái.
 */
const SUB_LANG_PRIORITY = [/\.vie?[-.]/i, /\.vi\./i, /\.en(g)?[-.]/i];

export function pickSubtitleFile(files: string[]): string | null {
  const vtts = files.filter((f) => f.endsWith(".vtt")).sort();
  for (const re of SUB_LANG_PRIORITY) {
    const hit = vtts.find((f) => re.test(f));
    if (hit) return hit;
  }
  return vtts[0] ?? null;
}

function readTranscript(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const vtt = pickSubtitleFile(fs.readdirSync(dir));
  if (!vtt) return null;
  const lines = fs
    .readFileSync(path.join(dir, vtt), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.includes("-->") && !/^WEBVTT|^Kind:|^Language:|^\d+$/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const dedup = lines.filter((l, i) => l !== lines[i - 1]);
  const text = dedup.join(" ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 1500) : null;
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
