/**
 * Định nghĩa 1 stage theo mô hình plan -> exec -> reduce (giống map-reduce mini):
 *
 *  - plan():   từ output của stage trước, lập danh sách task. PHẢI deterministic
 *              (cùng input -> cùng danh sách task) để resume khớp với DB.
 *  - exec():   xử lý 1 task. PHẢI idempotent (chạy lại không gây hậu quả/tốn tiền thêm,
 *              nhờ ai_cache và media cache).
 *  - reduce(): gộp output các task thành output của stage (thuần tính toán, 0 token).
 *
 * Runner lo phần còn lại: lưu task vào DB, chạy song song có giới hạn, retry,
 * checkpoint, dừng an toàn khi bị yêu cầu stop.
 */
import type { AppConfig } from "../config";
import type { funnelFor } from "../config";
import type { CampaignBrief, StageName } from "../types";

export interface StageContext {
  runId: string;
  brief: CampaignBrief;
  funnel: ReturnType<typeof funnelFor>;
  cfg: AppConfig;
  /** Đọc output đã lưu của 1 stage trước đó */
  output<T>(stage: StageName): T;
  log(message: string, level?: "info" | "warn" | "error"): void;
}

export interface PlannedTask<I> {
  key: string;
  input: I;
}

export interface StageDef<I = unknown, O = unknown, R = unknown> {
  name: StageName;
  /** Mô tả ngắn hiển thị trên UI */
  label: string;
  plan(ctx: StageContext): PlannedTask<I>[] | Promise<PlannedTask<I>[]>;
  exec(ctx: StageContext, input: I, key: string): Promise<O>;
  reduce(ctx: StageContext, outputs: Map<string, O>, failedKeys: string[]): R | Promise<R>;
  /** Số task chạy song song (I/O nặng như tải video nên thấp) */
  concurrency?: number;
  /** true: stage vẫn hoàn thành nếu 1 số task lỗi (ví dụ 1 video không tải được) */
  tolerateFailures?: boolean;
}
