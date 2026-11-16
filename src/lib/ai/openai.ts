/**
 * OpenAI provider (template thay thế). Cùng interface với Claude provider,
 * set AI_PROVIDER=openai + OPENAI_API_KEY là chạy được.
 *
 * Ghi chú tối ưu: ảnh gửi với `detail: "low"` (giá cố định thấp / ảnh),
 * OpenAI tự cache prefix >= 1024 token nên system prompt luôn đặt đầu.
 */
import OpenAI from "openai";
import { toStrictJsonSchema } from "./schema";
import {
  extractJson,
  NonRetryableError,
  TruncatedError,
  type GenerateRequest,
  type GenerateResult,
  type LLMProvider,
} from "./provider";

let _client: OpenAI | null = null;
const client = () => (_client ??= new OpenAI({ maxRetries: 3, timeout: 180_000 }));

export const openaiProvider: LLMProvider = {
  name: "openai",
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = req.content.map((p) =>
      p.type === "text"
        ? { type: "text", text: p.text }
        : {
            type: "image_url",
            image_url: { url: `data:${p.mediaType};base64,${p.base64}`, detail: "low" },
          },
    );

    let res: OpenAI.Chat.ChatCompletion;
    try {
      res = await client().chat.completions.create({
        model: req.model,
        max_completion_tokens: req.maxTokens,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: parts },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: req.schemaName, schema: toStrictJsonSchema(req.schema), strict: true },
        },
      });
    } catch (err) {
      if (err instanceof OpenAI.APIError && err.status && [400, 401, 403, 404].includes(err.status)) {
        throw new NonRetryableError(`OpenAI ${err.status}: ${err.message}`);
      }
      throw err;
    }

    const choice = res.choices[0];
    if (choice?.finish_reason === "length") throw new TruncatedError();
    if (choice?.message.refusal) throw new NonRetryableError(`Refused: ${choice.message.refusal}`);

    const data = req.schema.parse(extractJson(choice?.message.content ?? ""));
    const cached = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      data,
      model: res.model,
      usage: {
        inputTokens: (res.usage?.prompt_tokens ?? 0) - cached,
        outputTokens: res.usage?.completion_tokens ?? 0,
        cacheReadTokens: cached,
        cacheWriteTokens: 0,
      },
    };
  },
};
