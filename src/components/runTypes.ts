/** Kiểu dữ liệu trả về từ GET /api/runs/:id (chỉ import type ở client) */
import type { Report } from "@/lib/pipeline/stages/select";
import type { ChatMessage } from "@/lib/brief/slots";
import type { StageUsage } from "@/lib/runs";
import type { StepSummary } from "@/lib/steps";

export type { StepRow, StepSummary } from "@/lib/steps";

export type { Pick, Report } from "@/lib/pipeline/stages/select";
export type { Evidence } from "@/lib/types";

export interface RunDetail {
  run: {
    id: string;
    status: string;
    currentStage: string | null;
    error: string | null;
    activeMs: number;
    attempts: number;
    brief: Report["brief"];
    config: { provider: string; models: Record<string, string>; dataSource: string };
  };
  stages: { stage: string; status: string; activeMs: number; tasks: { total: number; done: number; failed: number; running: number } }[];
  usage: {
    byStage: StageUsage[];
    total: Omit<StageUsage, "stage">;
    costVnd: number;
    models: { stage: string; model: string; n: number }[];
    data: {
      byEndpoint: { endpoint: string; calls: number; cacheHits: number; credits: number; avoided: number }[];
      credits: number;
      avoided: number;
      coldCredits: number;
    };
  };
  events: { ts: number; level: string; stage: string | null; message: string }[];
  report: Report | null;
  steps: StepSummary[];
  chat: ChatMessage[];
}

/** Tên bước nghiên cứu cho người dùng (đồng bộ với STEP_TEXT ở server) */
export const STEP_NAMES: Record<string, string> = {
  brief_intake: "Lập brief với AI",
  source: "Tìm creator",
  prefilter: "Lọc theo số liệu",
  enrich: "Xem hồ sơ chi tiết",
  text_screen: "Đọc nội dung",
  media_prep: "Chuẩn bị video",
  video_analysis: "Xem video bằng AI",
  final_rank: "Chấm điểm và lý do",
  select: "Chọn trong ngân sách",
};
