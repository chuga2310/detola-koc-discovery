/**
 * AI Gateway: MỌI lời gọi AI trong hệ thống đều đi qua đây.
 *
 * Làm 4 việc:
 *  1. Content-addressed cache: key = hash(provider, model, prompt version, system, content, schema).
 *     Cùng input -> trả kết quả cũ, 0 token. Đây là lý do resume sau crash không tốn thêm tiền,
 *     và phân tích video của 1 creator được tái sử dụng cho mọi campaign sau.
 *  2. Concurrency limit: giới hạn số request song song (tránh 429).
 *  3. Retry có backoff ở cấp task (ngoài retry của SDK), retry khi JSON sai schema,
 *     tăng max_tokens khi output bị cắt.
 *  4. Ghi log token/cost/latency vào bảng ai_calls -> benchmark + hiển thị chi phí realtime.
 */
import { getConfig } from "../config";
import { db, now } from "../db";
import { backoffMs, createLimiter, sleep, stableHash } from "../util";
import { anthropicProvider } from "./anthropic";
import { mockProvider } from "./mock";
import { openaiProvider } from "./openai";
import { costUsd, type Usage } from "./pricing";
import {
  NonRetryableError,
  SchemaMismatchError,
  TruncatedError,
  type GenerateRequest,
  type LLMProvider,
} from "./provider";

export function getProvider(): LLMProvider {
  const { provider } = getConfig();
  if (provider === "anthropic") return anthropicProvider;
  if (provider === "openai") return openaiProvider;
  return mockProvider;
}

let _limiter: ReturnType<typeof createLimiter> | null = null;
const limiter = () => (_limiter ??= createLimiter(getConfig().aiConcurrency));

/**
 * Cache priming: nếu N call cùng system prompt bắn song song ngay từ đầu, cả N đều GHI cache
 * (trả 1.25x) và không call nào ĐỌC được. Nên call đầu tiên của mỗi (model, system) chạy trước;
 * các call sau chờ nó xong rồi mới chạy song song -> tất cả đọc cache (~0.05-0.1x giá input).
 */
const primed = new Map<string, { p: Promise<unknown>; at: number }>();
const PRIME_TTL_MS = 4 * 60_000; // cache Anthropic sống 5 phút (mỗi lần đọc được gia hạn)
async function withCachePriming<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const first = primed.get(key);
  if (first && now() - first.at < PRIME_TTL_MS) {
    await first.p.catch(() => undefined);
    first.at = now(); // call sau đọc cache -> cache được gia hạn
    return fn();
  }
  const p = fn();
  primed.set(key, { p, at: now() });
  p.catch(() => primed.delete(key)); // call đầu lỗi -> call sau tự làm "người mồi" mới
  return p;
}

export interface AiContext {
  runId: string | null;
  stage: string;
  taskKey: string;
}

export interface AiResult<T> {
  data: T;
  cacheHit: boolean;
  costUsd: number;
  usage: Usage;
  model: string;
}

/** Hash phần content (ảnh hash theo bytes, không đưa cả base64 vào key) */
function contentFingerprint(req: GenerateRequest<unknown>) {
  return req.content.map((p) =>
    p.type === "text" ? { t: p.text } : { img: stableHash(p.base64) },
  );
}

export async function aiGenerate<T>(
  ctx: AiContext,
  req: GenerateRequest<T> & { promptVersion: string },
): Promise<AiResult<T>> {
  const provider = getProvider();
  const cacheKey = stableHash({
    provider: provider.name,
    model: req.model,
    v: req.promptVersion,
    effort: req.effort ?? null,
    system: stableHash(req.system),
    content: contentFingerprint(req as GenerateRequest<unknown>),
    schema: req.schemaName,
  });
  const images = req.content.filter((p) => p.type === "image").length;

  // 1) Cache hit -> không gọi API
  const cached = db()
    .prepare("SELECT output_json, usage_json, model FROM ai_cache WHERE cache_key = ?")
    .get(cacheKey) as { output_json: string; usage_json: string; model: string } | undefined;
  if (cached) {
    const parsed = req.schema.safeParse(JSON.parse(cached.output_json));
    if (parsed.success) {
      const zero: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      logCall(ctx, provider.name, cached.model, true, zero, images, 0, 0);
      return { data: parsed.data, cacheHit: true, costUsd: 0, usage: zero, model: cached.model };
    }
  }

  // 2) Gọi provider với retry
  const maxAttempts = getConfig().maxTaskAttempts;
  let maxTokens = req.maxTokens;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = now();
    try {
      const primeKey = `${provider.name}:${req.model}:${stableHash(req.system)}`;
      const res = await withCachePriming(primeKey, () => limiter()(() => provider.generate({ ...req, maxTokens })));
      const cost = costUsd(res.model, res.usage);
      db()
        .prepare(
          "INSERT OR REPLACE INTO ai_cache (cache_key, provider, model, output_json, usage_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(cacheKey, provider.name, res.model, JSON.stringify(res.data), JSON.stringify(res.usage), now());
      logCall(ctx, provider.name, res.model, false, res.usage, images, cost, now() - started);
      return { data: res.data, cacheHit: false, costUsd: cost, usage: res.usage, model: res.model };
    } catch (err) {
      lastErr = err;
      // Call đã chạy xong ở phía provider nhưng output hỏng -> vẫn tốn tiền -> ghi log (ok = 0)
      if ((err instanceof SchemaMismatchError || err instanceof TruncatedError) && err.usage) {
        const m = err.model ?? req.model;
        logCall(ctx, provider.name, m, false, err.usage, images, costUsd(m, err.usage), now() - started, false);
      }
      if (err instanceof NonRetryableError) throw err;
      if (err instanceof TruncatedError) maxTokens = Math.min(maxTokens * 2, 32000);
      if (attempt < maxAttempts) await sleep(backoffMs(attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function logCall(
  ctx: AiContext,
  provider: string,
  model: string,
  cacheHit: boolean,
  u: Usage,
  images: number,
  cost: number,
  latencyMs: number,
  ok = true,
) {
  db()
    .prepare(
      `INSERT INTO ai_calls (run_id, stage, task_key, provider, model, cache_hit, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, images, cost_usd, latency_ms, created_at, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ctx.runId,
      ctx.stage,
      ctx.taskKey,
      provider,
      model,
      cacheHit ? 1 : 0,
      u.inputTokens,
      u.outputTokens,
      u.cacheReadTokens,
      u.cacheWriteTokens,
      images,
      cost,
      latencyMs,
      now(),
      ok ? 1 : 0,
    );
}
