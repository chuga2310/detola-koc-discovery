/**
 * Pipeline runner: chạy các stage theo thứ tự, checkpoint mọi thứ vào SQLite.
 *
 * Reliability được đảm bảo bởi 4 cơ chế:
 *  1. Checkpoint cấp stage (run_stages): stage xong -> lưu output -> lần sau bỏ qua.
 *  2. Checkpoint cấp task (tasks): trong 1 stage, task nào xong thì không chạy lại.
 *     Task đang "running" lúc process chết sẽ được reset về "pending" khi resume.
 *  3. Lease + heartbeat: 1 run chỉ được 1 worker chạy tại 1 thời điểm. Worker chết ->
 *     lease hết hạn (60s) -> worker khác (hoặc lần resume sau) tiếp quản được.
 *  4. Idempotent exec + ai_cache: kể cả khi 1 task bị chạy lại (crash ngay sau khi gọi AI
 *     nhưng trước khi ghi DB), kết quả AI đã nằm trong cache -> không trả tiền 2 lần.
 */
import os from "node:os";
import { funnelFor, getConfig } from "../config";
import { db, logEvent, now, parseJson } from "../db";
import type { CampaignBrief, RunStatus, StageName } from "../types";
import { STAGES } from "../types";
import { createLimiter, newId } from "../util";
import type { StageContext, StageDef } from "./stage";
import { STAGE_DEFS } from "./stages";

const LEASE_MS = 60_000;
const HEARTBEAT_MS = 15_000;

/** Registry các run đang chạy trong process này (globalThis để sống qua HMR của Next dev) */
const g = globalThis as unknown as { __kocRuns?: Map<string, AbortController> };
const activeRuns = (g.__kocRuns ??= new Map<string, AbortController>());

export function isRunActiveHere(runId: string) {
  return activeRuns.has(runId);
}

export function createRun(brief: CampaignBrief): string {
  const id = newId();
  const cfg = getConfig();
  const snapshot = { provider: cfg.provider, models: cfg.models, effort: cfg.effort, dataSource: cfg.dataSource, funnel: funnelFor(brief.numKocs) };
  db()
    .prepare(
      `INSERT INTO runs (id, brief_json, config_json, status, created_at, updated_at) VALUES (?, ?, ?, 'queued', ?, ?)`,
    )
    .run(id, JSON.stringify(brief), JSON.stringify(snapshot), now(), now());
  logEvent(id, `Run created (provider=${cfg.provider}, source=${cfg.dataSource})`);
  return id;
}

/** Yêu cầu dừng an toàn: các task đang chạy làm nốt, không nhận task mới */
export function requestStop(runId: string): boolean {
  const ctrl = activeRuns.get(runId);
  if (!ctrl) return false;
  ctrl.abort();
  return true;
}

export interface RunOptions {
  /** Giả lập crash cứng (process.exit) sau N task của 1 stage - chỉ dùng cho demo/benchmark */
  crashAfter?: { stage: StageName; tasks: number };
}

/**
 * Chạy (hoặc tiếp tục) 1 run. Gọi lại hàm này trên run đã dừng/crash = resume.
 */
export async function runPipeline(runId: string, opts: RunOptions = {}): Promise<RunStatus> {
  const owner = `${os.hostname()}:${process.pid}:${newId().slice(0, 6)}`;
  if (!acquireLease(runId, owner)) {
    logEvent(runId, "Another worker holds the lease; skip", { level: "warn" });
    return "running";
  }

  const ctrl = new AbortController();
  activeRuns.set(runId, ctrl);
  const heartbeat = setInterval(() => renewLease(runId, owner), HEARTBEAT_MS);

  const row = db().prepare("SELECT brief_json, attempts, status FROM runs WHERE id = ?").get(runId) as {
    brief_json: string;
    attempts: number;
    status: RunStatus;
  };
  const brief = JSON.parse(row.brief_json) as CampaignBrief;
  // Run từng failed (ví dụ API down) -> cho các task lỗi thêm lượt retry mới
  if (row.status === "failed") db().prepare("UPDATE tasks SET attempts = 0 WHERE run_id = ? AND status = 'failed'").run(runId);
  db().prepare("UPDATE runs SET attempts = attempts + 1, status = 'running', error = NULL, updated_at = ? WHERE id = ?").run(now(), runId);
  if (row.attempts > 0) logEvent(runId, `Resuming run (attempt #${row.attempts + 1}) from last checkpoint`);

  const ctx: StageContext = {
    runId,
    brief,
    funnel: funnelFor(brief.numKocs),
    cfg: getConfig(),
    output<T>(stage: StageName): T {
      const r = db().prepare("SELECT output_json FROM run_stages WHERE run_id = ? AND stage = ? AND status = 'done'").get(runId, stage) as
        | { output_json: string }
        | undefined;
      if (!r) throw new Error(`Stage ${stage} has no output yet`);
      return JSON.parse(r.output_json) as T;
    },
    log: (message, level = "info") => logEvent(runId, message, { level }),
  };

  let status: RunStatus = "running";
  try {
    for (const stageName of STAGES) {
      if (ctrl.signal.aborted) break;
      const def = STAGE_DEFS[stageName];
      const done = db().prepare("SELECT status FROM run_stages WHERE run_id = ? AND stage = ?").get(runId, stageName) as
        | { status: string }
        | undefined;
      if (done?.status === "done") {
        logEvent(runId, `Checkpoint hit: stage already done, skipping`, { stage: stageName });
        continue;
      }
      const finished = await runStage(ctx, def as StageDef, ctrl.signal, opts);
      if (!finished) break; // bị stop giữa stage
    }

    if (ctrl.signal.aborted) {
      status = "interrupted";
      logEvent(runId, "Run stopped on request. Resume to continue from checkpoint.", { level: "warn" });
    } else {
      status = "completed";
      const result = ctx.output<unknown>("select");
      db().prepare("UPDATE runs SET result_json = ?, finished_at = ? WHERE id = ?").run(JSON.stringify(result), now(), runId);
      logEvent(runId, "Run completed");
    }
  } catch (err) {
    status = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    db().prepare("UPDATE runs SET error = ? WHERE id = ?").run(msg, runId);
    logEvent(runId, `Run failed: ${msg}`, { level: "error" });
  } finally {
    clearInterval(heartbeat);
    activeRuns.delete(runId);
    db()
      .prepare("UPDATE runs SET status = ?, lease_owner = NULL, lease_until = NULL, updated_at = ? WHERE id = ?")
      .run(status, now(), runId);
  }
  return status;
}

/** Trả về true nếu stage hoàn thành, false nếu bị dừng giữa chừng */
async function runStage(ctx: StageContext, def: StageDef, signal: AbortSignal, opts: RunOptions): Promise<boolean> {
  const { runId } = ctx;
  const stage = def.name;
  const stageStart = now();
  db().prepare("UPDATE runs SET current_stage = ?, updated_at = ? WHERE id = ?").run(stage, now(), runId);
  db()
    .prepare("INSERT OR IGNORE INTO run_stages (run_id, stage, status, started_at) VALUES (?, ?, 'running', ?)")
    .run(runId, stage, now());

  // 1) Plan: ghi task vào DB (INSERT OR IGNORE -> task đã có từ lần chạy trước giữ nguyên trạng thái)
  const planned = await def.plan(ctx);
  const insert = db().prepare(
    "INSERT OR IGNORE INTO tasks (run_id, stage, task_key, input_json, status, updated_at) VALUES (?, ?, ?, ?, 'pending', ?)",
  );
  db().transaction(() => {
    for (const t of planned) insert.run(runId, stage, t.key, JSON.stringify(t.input), now());
  })();
  // Task "running" từ process đã chết -> trả về pending
  db().prepare("UPDATE tasks SET status = 'pending' WHERE run_id = ? AND stage = ? AND status = 'running'").run(runId, stage);

  const maxAttempts = ctx.cfg.maxTaskAttempts;
  const todo = db()
    .prepare(
      "SELECT task_key, input_json, attempts FROM tasks WHERE run_id = ? AND stage = ? AND (status = 'pending' OR (status = 'failed' AND attempts < ?)) ORDER BY rowid",
    )
    .all(runId, stage, maxAttempts) as { task_key: string; input_json: string; attempts: number }[];
  const doneCount = planned.length - todo.length;
  ctx.log(
    planned.length
      ? `${def.label}: ${planned.length} tasks (${doneCount} restored from checkpoint, ${todo.length} to run)`
      : `${def.label}`,
  );

  // 2) Exec các task còn lại, song song có giới hạn
  const limit = createLimiter(def.concurrency ?? 4);
  let completedThisProcess = 0;
  await Promise.all(
    todo.map((t) =>
      limit(async () => {
        if (signal.aborted) return;
        for (let attempt = t.attempts + 1; attempt <= maxAttempts; attempt++) {
          db()
            .prepare("UPDATE tasks SET status = 'running', attempts = ?, updated_at = ? WHERE run_id = ? AND stage = ? AND task_key = ?")
            .run(attempt, now(), runId, stage, t.task_key);
          try {
            const out = await def.exec(ctx, JSON.parse(t.input_json), t.task_key);
            db()
              .prepare(
                "UPDATE tasks SET status = 'done', output_json = ?, error = NULL, updated_at = ? WHERE run_id = ? AND stage = ? AND task_key = ?",
              )
              .run(JSON.stringify(out ?? null), now(), runId, stage, t.task_key);
            completedThisProcess++;
            maybeCrash(opts, stage, completedThisProcess, ctx);
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            db()
              .prepare("UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE run_id = ? AND stage = ? AND task_key = ?")
              .run(msg.slice(0, 1000), now(), runId, stage, t.task_key);
            ctx.log(`Task ${t.task_key} failed (attempt ${attempt}/${maxAttempts}): ${msg.slice(0, 200)}`, "warn");
            if (err instanceof Error && (err.name === "NonRetryableError" || (err as { nonRetryable?: boolean }).nonRetryable)) return;
            if (signal.aborted) return;
          }
        }
      }),
    ),
  );

  addActiveTime(runId, stage, now() - stageStart);
  if (signal.aborted) return false;

  // 3) Reduce
  const rows = db()
    .prepare("SELECT task_key, status, output_json FROM tasks WHERE run_id = ? AND stage = ?")
    .all(runId, stage) as { task_key: string; status: string; output_json: string | null }[];
  const outputs = new Map<string, unknown>();
  const failed: string[] = [];
  for (const r of rows) {
    if (r.status === "done") outputs.set(r.task_key, parseJson(r.output_json));
    else failed.push(r.task_key);
  }
  if (failed.length && !def.tolerateFailures) {
    throw new Error(`Stage ${stage}: ${failed.length} task(s) failed: ${failed.slice(0, 5).join(", ")}`);
  }
  if (failed.length) ctx.log(`${failed.length} task(s) failed but tolerated: ${failed.slice(0, 5).join(", ")}`, "warn");

  const reduceStart = now();
  const result = await def.reduce(ctx, outputs, failed);
  db()
    .prepare("UPDATE run_stages SET status = 'done', output_json = ?, finished_at = ? WHERE run_id = ? AND stage = ?")
    .run(JSON.stringify(result), now(), runId, stage);
  addActiveTime(runId, stage, now() - reduceStart);
  return true;
}

function addActiveTime(runId: string, stage: string, ms: number) {
  db().prepare("UPDATE run_stages SET active_ms = active_ms + ? WHERE run_id = ? AND stage = ?").run(ms, runId, stage);
  db().prepare("UPDATE runs SET active_ms = active_ms + ? WHERE id = ?").run(ms, runId);
}

function maybeCrash(opts: RunOptions, stage: StageName, completed: number, ctx: StageContext) {
  if (opts.crashAfter && opts.crashAfter.stage === stage && completed >= opts.crashAfter.tasks) {
    ctx.log(`💥 Simulated hard crash after ${completed} task(s) in ${stage} (process.exit)`, "error");
    // Không release lease, không cập nhật status -> giống hệt process bị kill thật
    process.exit(137);
  }
}

// ---------------------------------------------------------------------------
// Lease: đảm bảo 1 run chỉ có 1 worker. Atomic nhờ 1 câu UPDATE có điều kiện.
// ---------------------------------------------------------------------------
function acquireLease(runId: string, owner: string): boolean {
  const t = now();
  const res = db()
    .prepare(
      `UPDATE runs SET lease_owner = ?, lease_until = ?, updated_at = ?
       WHERE id = ? AND status != 'completed' AND (lease_owner IS NULL OR lease_until < ?)`,
    )
    .run(owner, t + LEASE_MS, t, runId, t);
  if (res.changes === 1) return true;

  // Lease còn hạn nhưng owner có thể đã chết (crash). Nếu owner cùng máy và PID không còn
  // tồn tại -> chắc chắn đã chết -> tiếp quản ngay, không cần chờ lease hết hạn.
  const cur = db().prepare("SELECT lease_owner FROM runs WHERE id = ?").get(runId) as { lease_owner: string | null } | undefined;
  if (cur?.lease_owner && isDeadLocalOwner(cur.lease_owner)) {
    const steal = db()
      .prepare("UPDATE runs SET lease_owner = ?, lease_until = ?, updated_at = ? WHERE id = ? AND lease_owner = ?")
      .run(owner, t + LEASE_MS, t, runId, cur.lease_owner);
    return steal.changes === 1;
  }
  return false;
}

function isDeadLocalOwner(leaseOwner: string): boolean {
  const [host, pidStr] = leaseOwner.split(":");
  const pid = Number(pidStr);
  if (host !== os.hostname() || !pid || pid === process.pid) return false;
  try {
    process.kill(pid, 0); // signal 0 = chỉ kiểm tra process còn sống
    return false;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ESRCH";
  }
}

function renewLease(runId: string, owner: string) {
  db().prepare("UPDATE runs SET lease_until = ? WHERE id = ? AND lease_owner = ?").run(now() + LEASE_MS, runId, owner);
}

/**
 * Run bị "kẹt" (status running nhưng lease hết hạn) = worker đã chết. Đánh dấu interrupted
 * để UI hiện nút Resume. Gọi khi list runs.
 */
export function markStaleRuns() {
  db()
    .prepare(
      "UPDATE runs SET status = 'interrupted', lease_owner = NULL WHERE status = 'running' AND (lease_until IS NULL OR lease_until < ?)",
    )
    .run(now());
}

/** Chạy nền (fire-and-forget) trong process Next.js */
export function startInBackground(runId: string) {
  if (isRunActiveHere(runId)) return;
  void runPipeline(runId).catch((err) => console.error("pipeline crashed", err));
}
