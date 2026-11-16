/**
 * Mock provider: chạy toàn bộ pipeline OFFLINE, không cần API key.
 *
 * Mục đích: demo flow, test resume/checkpoint, CI. Output được sinh bởi heuristic
 * của từng stage (`req.mock()`), token được ƯỚC LƯỢNG theo độ dài prompt để thấy
 * hình dạng chi phí. Kết quả mock KHÔNG phải đánh giá AI thật.
 */
import { sleep } from "../util";
import type { GenerateRequest, GenerateResult, LLMProvider } from "./provider";

/** ~3.2 ký tự / token cho text lẫn tiếng Việt; ảnh contact sheet ~ 820 token */
const estimateTokens = (req: GenerateRequest<unknown>) => {
  let chars = req.system.length;
  let images = 0;
  for (const p of req.content) {
    if (p.type === "text") chars += p.text.length;
    else images++;
  }
  return Math.ceil(chars / 3.2) + images * 820;
};

export const mockProvider: LLMProvider = {
  name: "mock",
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    if (!req.mock) throw new Error(`No mock generator for schema ${req.schemaName}`);
    await sleep(80 + Math.random() * 120); // giả lập latency
    const data = req.schema.parse(req.mock());
    const systemTokens = Math.ceil(req.system.length / 3.2);
    const total = estimateTokens(req as GenerateRequest<unknown>);
    return {
      data,
      model: req.model,
      usage: {
        inputTokens: total - systemTokens,
        // giả định system prompt đã được cache (trừ call đầu tiên - đơn giản hoá)
        cacheReadTokens: systemTokens,
        cacheWriteTokens: 0,
        outputTokens: Math.ceil(JSON.stringify(data).length / 3.2),
      },
    };
  },
};
