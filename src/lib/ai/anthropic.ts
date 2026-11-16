/**
 * Claude provider (provider chính).
 *
 * Tối ưu chi phí ở tầng call:
 *  - system prompt gắn `cache_control` -> các call sau cùng prefix chỉ trả ~5-10% giá input.
 *  - structured outputs (`output_config.format`) -> JSON luôn hợp lệ, không phải retry vì sai format.
 *  - `output_config.effort` thấp cho việc đơn giản -> ít thinking token (thinking tính như output token).
 *  - Opus/Sonnet: bật server-side refusal fallback (`fallbacks: "default"`) để 1 refusal hiếm hoi
 *    không làm hỏng cả batch.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config";
import type { Usage } from "./pricing";
import { toStrictJsonSchema } from "./schema";
import {
  NonRetryableError,
  parseOrThrow,
  TruncatedError,
  type GenerateRequest,
  type GenerateResult,
  type LLMProvider,
} from "./provider";

let _client: Anthropic | null = null;
const client = () =>
  (_client ??= new Anthropic({
    maxRetries: 3, // SDK tự retry 408/409/429/5xx + lỗi mạng với backoff
    timeout: 180_000,
  }));

export const anthropicProvider: LLMProvider = {
  name: "anthropic",
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const cfg = getConfig();
    const content: Anthropic.Beta.BetaContentBlockParam[] = req.content.map((p) =>
      p.type === "text"
        ? { type: "text", text: p.text }
        : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } },
    );

    const useFallback = cfg.anthropicFallbacks && /claude-(opus|sonnet)-5-5/.test(req.model);

    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: {
        format: { type: "json_schema", schema: toStrictJsonSchema(req.schema) },
        ...(req.effort ? { effort: req.effort } : {}),
      },
      ...(useFallback
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    };

    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client().beta.messages.create(params);
    } catch (err) {
      // 400/401/403/404: lỗi cấu hình -> retry vô ích
      if (
        err instanceof Anthropic.BadRequestError ||
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError ||
        err instanceof Anthropic.NotFoundError
      ) {
        throw new NonRetryableError(`Anthropic ${err.status}: ${err.message}`);
      }
      throw err; // 429/5xx/network: SDK đã retry, gateway sẽ retry tiếp ở cấp task
    }

    // Đọc usage TRƯỚC khi validate: call hỏng vẫn bị tính tiền -> phải ghi nhận
    const usage: Usage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
    };

    if (res.stop_reason === "refusal") {
      throw new NonRetryableError(
        `Model refused (${res.stop_details?.category ?? "unknown"}): ${res.stop_details?.explanation ?? ""}`,
      );
    }
    if (res.stop_reason === "max_tokens") throw new TruncatedError(undefined, usage, res.model);

    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { data: parseOrThrow(req.schema, text, usage, res.model), model: res.model, usage };
  },
};
