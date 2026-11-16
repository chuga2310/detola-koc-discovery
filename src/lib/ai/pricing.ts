/**
 * Bảng giá (USD / 1M token) để tính chi phí từng call.
 * Anthropic: giá first-party API. Cache read ~0.05x-0.1x giá input, cache write 5 phút = 1.25x.
 * OpenAI: giá tham khảo, có thể override qua env nếu thay đổi.
 */
export interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "gpt-4.1": { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cacheRead: 0.1, cacheWrite: 0.4 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
};

const ZERO: Price = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export function priceFor(model: string): Price {
  if (model.startsWith("mock")) return ZERO;
  const p = PRICES[model];
  if (p) return p;
  // Model lạ (ví dụ OpenAI model mới): cho phép set giá qua env
  const input = Number(process.env.CUSTOM_PRICE_INPUT ?? 0);
  const output = Number(process.env.CUSTOM_PRICE_OUTPUT ?? 0);
  return { input, output, cacheRead: input * 0.1, cacheWrite: input * 1.25 };
}

export interface Usage {
  /** input token không cache (giá đầy đủ) */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function costUsd(model: string, u: Usage): number {
  const p = priceFor(model);
  return (
    (u.inputTokens * p.input +
      u.outputTokens * p.output +
      u.cacheReadTokens * p.cacheRead +
      u.cacheWriteTokens * p.cacheWrite) /
    1_000_000
  );
}

/**
 * Ước lượng token cho ảnh với Claude: ~ (width * height) / 750.
 * Dùng để giải thích vì sao ghép 6 frame vào 1 contact sheet nhỏ lại rẻ.
 */
export const claudeImageTokens = (w: number, h: number) => Math.ceil((w * h) / 750);
