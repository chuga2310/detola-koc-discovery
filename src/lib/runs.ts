/** Query đọc trạng thái run cho API / UI / CLI / benchmark (read-only) */
import { db, parseJson } from "./db";
import type { Report } from "./pipeline/stages/select";
import { getConfig } from "./config";
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

export function runUsage(runId: string) {
  const rows = db()
    .prepare(
      `SELECT stage, COUNT(*) calls, SUM(cache_hit) cacheHits, SUM(input_tokens) inputTokens, SUM(output_tokens) outputTokens,
              SUM(cache_read_tokens) cacheReadTokens, SUM(cache_write_tokens) cacheWriteTokens, SUM(images) images,
              SUM(cost_usd) costUsd, SUM(latency_ms) latencyMs
       FROM ai_calls WHERE run_id = ? GROUP BY stage`,
    )
    .all(runId) as StageUsage[];
  const models = db()
    .prepare("SELECT stage, model, COUNT(*) n FROM ai_calls WHERE run_id = ? AND cache_hit = 0 GROUP BY stage, model")
    .all(runId) as { stage: string; model: string; n: number }[];
  const byStage = STAGES.map((s) => rows.find((r) => r.stage === s)).filter(Boolean) as StageUsage[];
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
  return { byStage, total, models, costVnd: Math.round(total.costUsd * getConfig().usdToVnd) };
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

type RunRow = {
  id: string;
  status: RunStatus;
  current_stage: string | null;
  brief_json: string;
  config_json: string;
  error: string | null;
  created_at: number;
  finished_at: number | null;
  active_ms: number;
  attempts: number;
  result_json: string | null;
};

const toSummary = (r: RunRow): RunSummary => ({
  id: r.id,
  status: r.status,
  currentStage: r.current_stage,
  brief: JSON.parse(r.brief_json),
  config: JSON.parse(r.config_json),
  error: r.error,
  createdAt: r.created_at,
  finishedAt: r.finished_at,
  activeMs: r.active_ms,
  attempts: r.attempts,
});

export function listRuns(limit = 30): (RunSummary & { costUsd: number })[] {
  const rows = db().prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?").all(limit) as RunRow[];
  const cost = db().prepare("SELECT COALESCE(SUM(cost_usd),0) c FROM ai_calls WHERE run_id = ?");
  return rows.map((r) => ({ ...toSummary(r), costUsd: (cost.get(r.id) as { c: number }).c }));
}

export function runDetail(runId: string) {
  const r = db().prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RunRow | undefined;
  if (!r) return null;
  const stages = db()
    .prepare("SELECT stage, status, active_ms, started_at, finished_at FROM run_stages WHERE run_id = ?")
    .all(runId) as { stage: string; status: string; active_ms: number; started_at: number; finished_at: number | null }[];
  const tasks = db()
    .prepare("SELECT stage, status, COUNT(*) n FROM tasks WHERE run_id = ? GROUP BY stage, status")
    .all(runId) as { stage: string; status: string; n: number }[];
  const events = db()
    .prepare("SELECT ts, level, stage, message FROM events WHERE run_id = ? ORDER BY id DESC LIMIT 80")
    .all(runId) as { ts: number; level: string; stage: string | null; message: string }[];

  const stageView = STAGES.map((s) => {
    const st = stages.find((x) => x.stage === s);
    const t = tasks.filter((x) => x.stage === s);
    const count = (status: string) => t.find((x) => x.status === status)?.n ?? 0;
    return {
      stage: s,
      status: st?.status ?? "pending",
      activeMs: st?.active_ms ?? 0,
      tasks: { total: t.reduce((a, x) => a + x.n, 0), done: count("done"), failed: count("failed"), running: count("running") },
    };
  });

  return {
    run: toSummary(r),
    stages: stageView,
    usage: runUsage(runId),
    events: events.reverse(),
    report: parseJson<Report>(r.result_json),
  };
}
