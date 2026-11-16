/** Query đọc trạng thái run cho API / UI / CLI / benchmark (read-only) */
import type { ChatMessage } from "./brief/slots";
import { getConfig } from "./config";
import { aiCallsCol, dataCallsCol, eventsCol, runsCol, runStagesCol, tasksCol, type RunDoc } from "./db";
import type { Report } from "./pipeline/stages/select";
import { runSteps } from "./steps";
import type { CampaignBrief, RunStatus } from "./types";
import { STAGES } from "./types";

export interface StageUsage {
  stage: string;
  calls: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  images: number;
  costUsd: number;
  latencyMs: number;
}

export async function runUsage(runId: string) {
  const ai = await aiCallsCol();
  const rows = await ai
    .aggregate<StageUsage>([
      { $match: { runId } },
      {
        $group: {
          _id: "$stage",
          calls: { $sum: 1 },
          cacheHits: { $sum: { $cond: ["$cacheHit", 1, 0] } },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          cacheReadTokens: { $sum: "$cacheReadTokens" },
          cacheWriteTokens: { $sum: "$cacheWriteTokens" },
          images: { $sum: "$images" },
          costUsd: { $sum: "$costUsd" },
          latencyMs: { $sum: "$latencyMs" },
        },
      },
      { $set: { stage: "$_id" } },
      { $unset: "_id" },
    ])
    .toArray();
  const models = await ai
    .aggregate<{ stage: string; model: string; n: number }>([
      { $match: { runId, cacheHit: false } },
      { $group: { _id: { stage: "$stage", model: "$model" }, n: { $sum: 1 } } },
      { $project: { _id: 0, stage: "$_id.stage", model: "$_id.model", n: 1 } },
    ])
    .toArray();
  // brief_intake = các lượt AI hỏi brief trước khi chạy (gắn vào chiến dịch lúc tạo)
  const byStage = ["brief_intake", ...STAGES].map((s) => rows.find((r) => r.stage === s)).filter(Boolean) as StageUsage[];
  const total = byStage.reduce(
    (t, r) => ({
      calls: t.calls + r.calls,
      cacheHits: t.cacheHits + r.cacheHits,
      inputTokens: t.inputTokens + r.inputTokens,
      outputTokens: t.outputTokens + r.outputTokens,
      cacheReadTokens: t.cacheReadTokens + r.cacheReadTokens,
      cacheWriteTokens: t.cacheWriteTokens + r.cacheWriteTokens,
      images: t.images + r.images,
      costUsd: t.costUsd + r.costUsd,
      latencyMs: t.latencyMs + r.latencyMs,
    }),
    { calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, images: 0, costUsd: 0, latencyMs: 0 },
  );
  const data = await (await dataCallsCol())
    .aggregate<{ endpoint: string; calls: number; cacheHits: number; credits: number; avoided: number }>([
      { $match: { runId } },
      {
        $group: {
          _id: "$endpoint",
          calls: { $sum: 1 },
          cacheHits: { $sum: { $cond: ["$cacheHit", 1, 0] } },
          credits: { $sum: "$credits" },
          avoided: { $sum: "$creditsAvoided" },
        },
      },
      { $project: { _id: 0, endpoint: "$_id", calls: 1, cacheHits: 1, credits: 1, avoided: 1 } },
      { $sort: { credits: -1, avoided: -1 } },
    ])
    .toArray();
  const credits = data.reduce((s, r) => s + r.credits, 0);
  const avoided = data.reduce((s, r) => s + r.avoided, 0);
  return {
    byStage,
    total,
    models,
    costVnd: Math.round(total.costUsd * getConfig().usdToVnd),
    /** Chi phí dữ liệu Kalodata: 1 credit ~ 0.1 USD. coldCredits = chi phí nếu không dùng lại dữ liệu đã lưu */
    data: { byEndpoint: data, credits, avoided, coldCredits: credits + avoided, approxUsd: credits * 0.1 },
  };
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  currentStage: string | null;
  brief: CampaignBrief;
  config: Record<string, unknown>;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  activeMs: number;
  attempts: number;
}

const toSummary = (r: RunDoc): RunSummary => ({
  id: r._id,
  status: r.status,
  currentStage: r.currentStage ?? null,
  brief: r.brief,
  config: r.config,
  error: r.error ?? null,
  createdAt: r.createdAt,
  finishedAt: r.finishedAt ?? null,
  activeMs: r.activeMs,
  attempts: r.attempts,
});

export async function listRuns(limit = 30): Promise<(RunSummary & { costUsd: number; credits: number })[]> {
  const rows = await (await runsCol()).find({}, { projection: { result: 0, chat: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray();
  const ids = rows.map((r) => r._id);
  const cost = await (await aiCallsCol())
    .aggregate<{ _id: string; c: number }>([{ $match: { runId: { $in: ids } } }, { $group: { _id: "$runId", c: { $sum: "$costUsd" } } }])
    .toArray();
  const cred = await (await dataCallsCol())
    .aggregate<{ _id: string; c: number }>([{ $match: { runId: { $in: ids } } }, { $group: { _id: "$runId", c: { $sum: "$credits" } } }])
    .toArray();
  const c1 = new Map(cost.map((x) => [x._id, x.c]));
  const c2 = new Map(cred.map((x) => [x._id, x.c]));
  return rows.map((r) => ({ ...toSummary(r), costUsd: c1.get(r._id) ?? 0, credits: c2.get(r._id) ?? 0 }));
}

export async function runDetail(runId: string) {
  const r = await (await runsCol()).findOne({ _id: runId });
  if (!r) return null;
  const stages = await (await runStagesCol()).find({ runId }, { projection: { output: 0 } }).toArray();
  const tasks = await (await tasksCol())
    .aggregate<{ _id: { stage: string; status: string }; n: number }>([
      { $match: { runId } },
      { $group: { _id: { stage: "$stage", status: "$status" }, n: { $sum: 1 } } },
    ])
    .toArray();
  const events = await (await eventsCol())
    .find({ runId }, { projection: { _id: 0, ts: 1, level: 1, stage: 1, message: 1 } })
    .sort({ ts: -1, seq: -1 })
    .limit(80)
    .toArray();

  const stageView = STAGES.map((s) => {
    const st = stages.find((x) => x.stage === s);
    const t = tasks.filter((x) => x._id.stage === s);
    const count = (status: string) => t.find((x) => x._id.status === status)?.n ?? 0;
    return {
      stage: s,
      status: st?.status ?? "pending",
      activeMs: st?.activeMs ?? 0,
      tasks: { total: t.reduce((a, x) => a + x.n, 0), done: count("done"), failed: count("failed"), running: count("running") },
    };
  });

  const run = toSummary(r);
  return {
    run,
    stages: stageView,
    steps: await runSteps(runId, run.status, run.currentStage, stageView),
    chat: (r.chat as ChatMessage[] | null) ?? [],
    usage: await runUsage(runId),
    events: events.reverse(),
    report: (r.result as Report | undefined) ?? null,
  };
}
