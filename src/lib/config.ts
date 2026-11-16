/**
 * Config tập trung, đọc từ env (.env.local). Mọi "con số ma thuật" của funnel
 * và model tiering đều nằm ở đây để dễ tune khi benchmark.
 */
import path from "node:path";

const env = (k: string, d: string) => process.env[k]?.trim() || d;
const num = (k: string, d: number) => {
  const v = process.env[k];
  return v ? Number(v) : d;
};

export type ProviderName = "anthropic" | "openai" | "mock";
export type Effort = "low" | "medium" | "high";

/**
 * Chọn provider:
 * - AI_PROVIDER set tường minh -> dùng cái đó.
 * - Không set: có ANTHROPIC_API_KEY -> anthropic; có OPENAI_API_KEY -> openai;
 *   không có key nào -> mock (chạy offline để demo flow, KHÔNG phải kết quả thật).
 */
function resolveProvider(): ProviderName {
  const p = process.env.AI_PROVIDER?.trim() as ProviderName | undefined;
  if (p) return p;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/**
 * Model tiering: mỗi stage dùng model rẻ nhất mà vẫn đủ chất lượng cho việc đó.
 * - screen: lọc text hàng loạt (batch 10 creator / call) -> model rẻ, nhanh.
 * - video:  phân tích hình ảnh (contact sheet) -> model vision tầm trung.
 * - final:  chấm điểm cuối + viết lý do có trích dẫn -> model mạnh nhất, nhưng chỉ
 *           chạy trên shortlist nhỏ nên tổng chi phí vẫn thấp.
 */
const DEFAULT_MODELS: Record<ProviderName, { screen: string; video: string; final: string }> = {
  anthropic: {
    screen: "claude-haiku-5-5",
    video: "claude-sonnet-5-5",
    final: "claude-opus-5-5",
  },
  openai: {
    screen: "gpt-4.1-mini",
    video: "gpt-4.1-mini",
    final: "gpt-4.1",
  },
  mock: { screen: "mock-screen", video: "mock-video", final: "mock-final" },
};

export function getConfig() {
  const provider = resolveProvider();
  const defaults = DEFAULT_MODELS[provider];
  const root = process.cwd();
  return {
    provider,
    models: {
      screen: env("MODEL_SCREEN", defaults.screen),
      video: env("MODEL_VIDEO", defaults.video),
      final: env("MODEL_FINAL", defaults.final),
    },
    effort: {
      screen: env("EFFORT_SCREEN", "low") as Effort,
      video: env("EFFORT_VIDEO", "low") as Effort,
      final: env("EFFORT_FINAL", "medium") as Effort,
    },
    /** Bật server-side refusal fallback cho Opus/Sonnet (Anthropic) */
    anthropicFallbacks: env("ANTHROPIC_FALLBACKS", "on") === "on",
    /** Số request AI chạy song song tối đa (tránh rate limit) */
    aiConcurrency: num("AI_CONCURRENCY", 4),
    /** Số video tải/cắt frame song song */
    mediaConcurrency: num("MEDIA_CONCURRENCY", 3),
    /** Số lần retry 1 task trước khi đánh dấu failed */
    maxTaskAttempts: num("MAX_TASK_ATTEMPTS", 3),
    /** Tỷ giá để hiển thị chi phí AI theo VND */
    usdToVnd: num("USD_VND", 26000),
    paths: {
      root,
      db: env("DB_PATH", path.join(root, ".data", "koc.db")),
      mediaCache: env("MEDIA_CACHE_DIR", path.join(root, ".data", "media")),
      fixtures: path.join(root, "data", "fixtures"),
    },
    /** Nguồn data: "kalodata" (Open API) hoặc "fixture" (data mẫu offline) */
    dataSource: env("DATA_SOURCE", "kalodata") as "kalodata" | "fixture",
    /** Công cụ tải video TikTok */
    ytDlpBin: env("YT_DLP_BIN", "yt-dlp"),
    ffmpegBin: env("FFMPEG_BIN", "ffmpeg"),
    ffprobeBin: env("FFPROBE_BIN", "ffprobe"),
  };
}

export type AppConfig = ReturnType<typeof getConfig>;

/**
 * Kích thước funnel theo số KOC cần tìm (N). Đây là "đòn bẩy" chính để tiết kiệm
 * token: càng xuống sâu funnel, mỗi creator càng tốn nhiều AI hơn, nên số lượng
 * phải giảm nhanh.
 *
 *   pool (0 token)  ->  prefilter (0 token)  ->  text screen (rẻ)  ->  video (đắt)  ->  final
 *   ~20N               ~4N                       ~4N                  ~2N              ~2N
 */
export function funnelFor(numKocs: number) {
  return {
    poolSize: Math.max(60, 20 * numKocs),
    prefilterKeep: Math.max(20, 4 * numKocs),
    textBatchSize: 10,
    videoKeep: Math.max(10, 2 * numKocs),
    videosPerCreator: 2,
    framesPerVideo: 6,
    finalBatchSize: 10,
  };
}
