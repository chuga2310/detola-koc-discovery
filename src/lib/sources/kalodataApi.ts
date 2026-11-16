/**
 * Kalodata Open API client (https://www.kalodata.com/open-center/docs).
 *
 * Kalodata tính phí theo CREDIT (1 credit ~ 0.1 USD):
 *   - Detail API (creator/video detail):  0.1 credit / call
 *   - Rank API (creator/video rank):      0.1 x ceil(số dòng trả về / 100) / call
 *   - Video URL:                          0.5 credit / call   <- đắt, chỉ dùng làm fallback
 *   - Credit balance:                     miễn phí
 *
 * Vì credit là chi phí thật (giống token AI), client này làm 3 việc khi THỰC SỰ gọi API:
 *  1. Budget guard: mỗi run có trần credit (KALODATA_MAX_CREDITS_PER_RUN). Vượt trần -> từ chối gọi.
 *  2. Rate limit theo endpoint (rank/video: 10 req / 10s; detail: 500 req / 10s).
 *  3. Log từng call vào data_calls (credit, dùng lại từ DB hay gọi mới, latency) -> hiển thị + benchmark.
 * Việc LƯU dữ liệu để tái sử dụng (thay cho cache response) nằm ở kaloStore.ts.
 */
import { dataCallsCol, now, runsCol } from "../db";
import { backoffMs, sleep } from "../util";

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
  "/tiktok/product/rank": 10,
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
  /** Ước tính số dòng để kiểm tra budget trước khi gọi rank */
  expectedRows?: number;
}

export async function creditsSpent(runId: string): Promise<number> {
  const r = await (await dataCallsCol())
    .aggregate<{ c: number }>([{ $match: { runId, cacheHit: false } }, { $group: { _id: null, c: { $sum: "$credits" } } }])
    .toArray();
  return r[0]?.c ?? 0;
}

/** Trần credit 1 run: mức cơ bản + phần cộng thêm cho tính năng trả phí người dùng đã bật (lưu trong run) */
export async function maxCreditsPerRun(runId?: string | null): Promise<number> {
  // Ước tính 1 run N=5: rank ~0.9 + enrich 20 x 0.2 + video chính 10 x 0.5 ≈ 10 credit
  const base = Number(process.env.KALODATA_MAX_CREDITS_PER_RUN ?? 12);
  if (!runId) return base;
  const run = await (await runsCol()).findOne({ _id: runId }, { projection: { config: 1 } });
  const extra = Number((run?.config as { paidCreditsBudget?: number } | undefined)?.paidCreditsBudget ?? 0);
  return base + extra;
}

/** Gọi THẬT 1 endpoint Kalodata (không đọc dữ liệu đã lưu), trả về field `data` của envelope */
export async function kaloCall<T = unknown>(path: string, body: Record<string, unknown>, opts: KaloCallOpts = {}): Promise<T> {
  const runId = opts.runId ?? null;
  const apiKey = process.env.KALODATA_API_KEY?.trim();
  if (!apiKey) throw new KalodataError("KALODATA_API_KEY is not set", "auth");

  // Budget guard: chặn TRƯỚC khi tiêu credit
  const estimate = creditCost(path, opts.expectedRows);
  if (runId) {
    const spent = await creditsSpent(runId);
    const cap = await maxCreditsPerRun(runId);
    if (spent + estimate > cap + 1e-9) {
      throw new KalodataError(
        `Kalodata credit budget exceeded for this run (spent ${spent.toFixed(2)} + ${estimate} > ${cap})`,
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
      await logDataCall(runId, path, credits, false, now() - started);
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

export async function logDataCall(runId: string | null, path: string, credits: number, cacheHit: boolean, latencyMs: number, avoided = 0) {
  await (await dataCallsCol()).insertOne({
    runId,
    provider: "kalodata",
    endpoint: path,
    credits,
    creditsAvoided: avoided,
    cacheHit,
    latencyMs,
    createdAt: now(),
  });
}

/** Ghi nhận credit được tiết kiệm khi dùng lại kết quả đã có ở nơi khác (vd video đã tải về đĩa) */
export async function logAvoidedCredit(runId: string | null | undefined, path: string, credits: number) {
  await logDataCall(runId ?? null, path, 0, true, 0, credits);
}

/** Số dư credit (endpoint miễn phí) */
export async function creditBalance(): Promise<number | null> {
  const apiKey = process.env.KALODATA_API_KEY?.trim();
  if (!apiKey) return null;
  const res = await fetch(`${BASE_URL}/credit/balance`, { headers: { "secret-key": apiKey }, signal: AbortSignal.timeout(15_000) });
  const j = (await res.json()) as { success?: boolean; data?: { totalRemain?: number } };
  return j.success ? Number(j.data?.totalRemain ?? 0) : null;
}
