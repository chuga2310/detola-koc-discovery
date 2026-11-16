/**
 * Chuyển Zod schema -> JSON Schema "strict" để dùng cho structured outputs.
 *
 * Cả Anthropic (output_config.format) và OpenAI (response_format strict) đều yêu cầu:
 *  - mọi object có additionalProperties: false
 *  - (OpenAI) mọi field đều nằm trong `required` -> field tuỳ chọn thì dùng .nullable()
 *  - không hỗ trợ ràng buộc số/độ dài (minimum, maxLength, ...) -> bỏ đi, Zod validate lại ở client
 *
 * Structured output = model buộc phải trả JSON đúng schema -> không tốn token/retry
 * cho việc "sửa format", và code parse an toàn.
 */
import { z } from "zod";

const UNSUPPORTED_KEYS = [
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "default",
  "format",
];

export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  return strictify(raw) as Record<string, unknown>;
}

/** Các key mà value là MAP tên -> schema (không phải 1 schema): không được xoá key bên trong */
const SCHEMA_MAPS = new Set(["properties", "$defs", "definitions", "patternProperties"]);

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const obj: Record<string, unknown> = { ...(node as Record<string, unknown>) };
  for (const k of UNSUPPORTED_KEYS) delete obj[k];
  for (const [k, v] of Object.entries(obj)) {
    // Bug từng gặp: property tên "format" bị xoá vì trùng keyword JSON Schema "format".
    // -> với map properties, chỉ strictify từng schema con, giữ nguyên tên property.
    obj[k] =
      SCHEMA_MAPS.has(k) && v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, strictify(pv)]))
        : strictify(v);
  }
  if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
    obj.additionalProperties = false;
    obj.required = Object.keys(obj.properties as object);
  }
  return obj;
}
