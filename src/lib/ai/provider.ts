/**
 * Provider abstraction: pipeline chỉ gọi `generate()` với input chuẩn hoá,
 * không biết bên dưới là Claude, OpenAI hay mock. Đổi provider = đổi env.
 */
import type { z } from "zod";
import type { Effort, ProviderName } from "../config";
import type { Usage } from "./pricing";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png"; base64: string };

export interface GenerateRequest<T> {
  model: string;
  /** Phần tĩnh của prompt (rubric, hướng dẫn). Đặt đầu tiên để prompt caching hoạt động. */
  system: string;
  /** Phần động: data của creator / batch hiện tại */
  content: ContentPart[];
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens: number;
  effort?: Effort;
  /** Chỉ dùng cho mock provider: sinh output giả lập từ heuristic của stage */
  mock?: () => T;
}

export interface GenerateResult<T> {
  data: T;
  usage: Usage;
  /** Model thực sự phục vụ (có thể khác nếu fallback xảy ra) */
  model: string;
}

export interface LLMProvider {
  name: ProviderName;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

/** Lỗi không nên retry (refusal, 400, auth...) */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/** Output bị cắt vì chạm max_tokens -> gateway sẽ retry với max_tokens lớn hơn */
export class TruncatedError extends Error {
  constructor(message = "Output truncated at max_tokens") {
    super(message);
    this.name = "TruncatedError";
  }
}

/** Lấy JSON từ text model trả về (phòng khi có ```json fence) */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Model output is not JSON");
    return JSON.parse(m[0]);
  }
}
