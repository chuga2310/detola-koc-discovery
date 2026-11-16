/**
 * Kalodata Open API client (https://www.kalodata.com/open-center/docs).
 *
 * Kalodata tính phí theo CREDIT (1 credit ~ 0.1 USD):
 *   - Detail API (creator/video detail):  0.1 credit / call
 *   - Rank API (creator/video rank):      0.1 x ceil(số dòng trả về / 100) / call
 *   - Video URL:                          0.5 credit / call   <- đắt, chỉ dùng làm fallback
 *   - Credit balance:                     miễn phí
 *
 * Vì credit là chi phí thật (giống token AI), client này làm 4 việc:
 *  1. Cache response vào SQLite (kalo_cache) theo hash(endpoint + body) -> resume / chạy lại /
 *     benchmark warm run = 0 credit.
 *  2. Budget guard: mỗi run có trần credit (KALODATA_MAX_CREDITS_PER_RUN). Vượt trần -> từ chối gọi.
 *  3. Rate limit theo endpoint (rank/video: 10 req / 10s; detail: 500 req / 10s).
 *  4. Log từng call vào data_calls (credit, cache hit, latency) -> hiển thị + benchmark.
 */
import { db, now } from "../db";
import { backoffMs, sleep, stableHash } from "../util";

const BASE_URL = process.env.KALODATA_BASE_URL?.trim() || "https://www.kalodata.com/openapi/v1";

export class KalodataError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "budget" | "param" | "quota" | "network" | "upstream",
  ) {
    super(message);
    this.name = "KalodataError";
  }
  /** Lỗi cấu hình / hết budget / sai tham số: retry vô ích -> runner dừng task ngay */
  get nonRetryable() {
    return this.kind !== "network";
  }
}

/** Bảng giá credit theo endpoint */
export function creditCost(path: string, rows?: number): number {
  if (path.endsWith("/video/url")) return 0.5;
  if (path.endsWith("/rank")) return 0.1 * Math.max(1, Math.ceil((rows ?? 1) / 100));
  if (path.startsWith("/credit")) return 0;
  return 0.1;
}

/** Rate limit theo docs (requests / 10 giây) */
const RATE: Record<string, number> = {
  "/tiktok/creator/rank": 10,
  "/tiktok/video/rank": 10,
  "/tiktok/video/url": 10,
  "/tiktok/creator/detail": 500,
  "/tiktok/video/detail": 100,
};
const windows = new Map<string, number[]>();
async function rateLimit(path: string) {
  const max = RATE[path] ?? 10;
  for (;;) {
    const ts = (windows.get(path) ?? []).filter((t) => now() - t < 10_000);
    if (ts.length < max) {
      ts.push(now());
      windows.set(path, ts);
      return;
    }
    await sleep(10_000 - (now() - ts[0]) + 50);
  }
}

export interface KaloCallOpts {
  runId?: string | null;
  /** Bỏ qua cache (ví dụ muốn data mới) */
  fresh?: boolean;
  /** Ước tính số dòng để kiểm tra budget trước khi gọi rank */
  expectedRows?: number;
  /** Kiểm tra data trong cache còn dùng được không (ví dụ signed URL chưa hết hạn) */
  validate?: (data: unknown) => boolean;
}

export function creditsSpent(runId: string): number {
  const r = db().prepare("SELECT COALESCE(SUM(credits),0) c FROM data_calls WHERE run_id = ? AND cache_hit = 0").get(runId) as { c: number };
  return r.c;
}

export function maxCreditsPerRun(): number {
  // Ước tính 1 run N=5: rank 0.1 + enrich 20 x 0.2 + video chính 10 x 0.5 ≈ 9.1 credit
  return Number(process.env.KALODATA_MAX_CREDITS_PER_RUN ?? 12);
}

const cacheTtlMs = () => Number(process.env.KALODATA_CACHE_TTL_HOURS ?? 72) * 3600_000;

/** Gọi 1 endpoint Kalodata, trả về field `data` của envelope */
export async function kaloRequest<T = unknown>(path: string, body: Record<string, unknown>, opts: KaloCallOpts = {}): Promise<T> {
  const key = stableHash({ path, body });
  const runId = opts.runId ?? null;

  if (!opts.fresh) {
    const hit = db().prepare("SELECT data_json, fetched_at FROM kalo_cache WHERE cache_key = ?").get(key) as
      | { data_json: string; fetched_at: number }
      | undefined;
    if (hit && now() - hit.fetched_at < cacheTtlMs() && (!opts.validate || opts.validate(JSON.parse(hit.data_json)))) {
      const data = JSON.parse(hit.data_json) as T;
      // Ghi lại số credit ĐÃ TIẾT KIỆM nhờ cache (để benchmark thấy chi phí lạnh vs thực trả)
      logDataCall(runId, path, 0, true, 0, creditCost(path, Array.isArray(data) ? data.length : undefined));
      return data;
    }
  }

  const apiKey = process.env.KALODATA_API_KEY?.trim();
  if (!apiKey) throw new KalodataError("KALODATA_API_KEY is not set", "auth");

  // Budget guard: chặn TRƯỚC khi tiêu credit
  const estimate = creditCost(path, opts.expectedRows);
  if (runId) {
    const spent = creditsSpent(runId);
    if (spent + estimate > maxCreditsPerRun() + 1e-9) {
      throw new KalodataError(
        `Kalodata credit budget exceeded for this run (spent ${spent.toFixed(2)} + ${estimate} > ${maxCreditsPerRun()})`,
        "budget",
      );
    }
  }

  let lastErr = "unknown";
  let pendingWaits = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await rateLimit(path);
    const started = now();
    let status = 0;
    let envelope: { success?: boolean; data?: unknown; code?: string | number | null; message?: string | null };
    try {
      const res = await fetch(BASE_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8", "secret-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      status = res.status;
      envelope = (await res.json()) as typeof envelope;
    } catch (e) {
      lastErr = (e as Error).message;
      await sleep(backoffMs(attempt, 500));
      continue;
    }

    if (envelope.success) {
      const data = envelope.data as T;
      const rows = Array.isArray(data) ? data.length : undefined;
      const credits = creditCost(path, rows);
      db()
        .prepare("INSERT OR REPLACE INTO kalo_cache (cache_key, path, body_json, data_json, fetched_at) VALUES (?, ?, ?, ?, ?)")
        .run(key, path, JSON.stringify(body), JSON.stringify(data), now());
      logDataCall(runId, path, credits, false, now() - started);
      return data;
    }

    const code = String(envelope.code ?? "");
    const msg = String(envelope.message ?? "");
    // 1054 = "Video is being fetched, please try again": Kalodata đang chuẩn bị file (async).
    // Không bị tính credit -> chờ rồi gọi lại, không tính vào số lần retry lỗi.
    if (code === "1054" && pendingWaits < 12) {
      pendingWaits++;
      attempt--;
      await sleep(5_000);
      continue;
    }
    if (status === 401 || status === 403 || (code === "501" && msg.toLowerCase().startsWith("the key")))
      throw new KalodataError(`Kalodata rejected the API key: ${msg}`, "auth");
    if (code === "2016") throw new KalodataError(`Kalodata parameter/quota error: ${msg}`, msg.match(/must be|invalid|required|parameter/i) ? "param" : "quota");
    if (code === "2000" || status >= 500 || /timeout/i.test(msg)) {
      lastErr = `${code} ${msg}`;
      await sleep(backoffMs(attempt, 500));
      continue;
    }
    throw new KalodataError(`Kalodata error ${code}: ${msg}`, "upstream");
  }
  throw new KalodataError(`Kalodata unreachable after 3 attempts: ${lastErr}`, "network");
}

function logDataCall(runId: string | null, path: string, credits: number, cacheHit: boolean, latencyMs: number, avoided = 0) {
  db()
    .prepare(
      "INSERT INTO data_calls (run_id, provider, endpoint, credits, credits_avoided, cache_hit, latency_ms, created_at) VALUES (?, 'kalodata', ?, ?, ?, ?, ?, ?)",
    )
    .run(runId, path, credits, avoided, cacheHit ? 1 : 0, latencyMs, now());
}

/** Ghi nhận credit được tiết kiệm khi dùng lại kết quả đã có ở nơi khác (vd video đã tải về đĩa) */
export function logAvoidedCredit(runId: string | null | undefined, path: string, credits: number) {
  logDataCall(runId ?? null, path, 0, true, 0, credits);
}

/** Số dư credit (endpoint miễn phí) */
export async function creditBalance(): Promise<number | null> {
  const apiKey = process.env.KALODATA_API_KEY?.trim();
  if (!apiKey) return null;
  const res = await fetch(`${BASE_URL}/credit/balance`, { headers: { "secret-key": apiKey }, signal: AbortSignal.timeout(15_000) });
  const j = (await res.json()) as { success?: boolean; data?: { totalRemain?: number } };
  return j.success ? Number(j.data?.totalRemain ?? 0) : null;
}

/** Link tải mp4 của video (0.5 credit). Cache lại cho tới khi link sắp hết hạn. */
export async function kaloVideoUrl(videoId: string, runId?: string | null): Promise<string | null> {
  const data = await kaloRequest<{ video_url?: string; expires_at?: number | string }>(
    "/tiktok/video/url",
    { video_id: videoId },
    {
      runId,
      validate: (d) => Number((d as { expires_at?: number }).expires_at ?? 0) * 1000 > now() + 60_000,
    },
  );
  return data?.video_url ?? null;
}
