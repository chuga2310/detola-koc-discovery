/**
 * Pipeline runner: chạy các stage theo thứ tự, checkpoint mọi thứ vào MongoDB.
 *
 * Reliability được đảm bảo bởi 4 cơ chế:
 *  1. Checkpoint cấp stage (run_stages): stage xong -> lưu output -> lần sau bỏ qua.
 *  2. Checkpoint cấp task (tasks): trong 1 stage, task nào xong thì không chạy lại.
 *     Task đang "running" lúc process chết sẽ được reset về "pending" khi resume.
 *  3. Lease + heartbeat: 1 run chỉ được 1 worker chạy tại 1 thời điểm (findOneAndUpdate có điều
 *     kiện = atomic). Worker chết -> lease hết hạn (60s) -> worker khác (hoặc lần resume sau) tiếp quản.
 *  4. Idempotent exec + ai_cache: kể cả khi 1 task bị chạy lại (crash ngay sau khi gọi AI
 *     nhưng trước khi ghi DB), kết quả AI đã nằm trong cache -> không trả tiền 2 lần.
 */
import os from "node:os";
import { funnelFor, getConfig } from "../config";
import { flushEvents, logEvent, now, runsCol, runStagesCol, tasksCol, type TaskDoc } from "../db";
import type { CampaignBrief, RunStatus, StageName } from "../types";
import { STAGES } from "../types";
import { paidCredits } from "../brief/paid";
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

export async function createRun(brief: CampaignBrief, chat?: unknown[]): Promise<string> {
  const id = newId();
  const cfg = getConfig();
  const snapshot = {
    provider: cfg.provider,
    models: cfg.models,
    effort: cfg.effort,
    dataSource: cfg.dataSource,
    funnel: funnelFor(brief.numKocs),
    // Dữ liệu chuyên sâu (trả phí) đã bật -> nâng trần credit của chiến dịch đúng bằng phần đó
    paidCreditsBudget: paidCredits(brief.deepData, brief.numKocs),
  };
  await (await runsCol()).insertOne({
    _id: id,
    brief,
    config: snapshot,
    chat: chat?.length ? chat : null,
    status: "queued",
    createdAt: now(),
    updatedAt: now(),
    activeMs: 0,
    attempts: 0,
  });
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
  if (!(await acquireLease(runId, owner))) {
    logEvent(runId, "Another worker holds the lease; skip", { level: "warn" });
    return "running";
  }

  const ctrl = new AbortController();
  activeRuns.set(runId, ctrl);
  const heartbeat = setInterval(() => void renewLease(runId, owner).catch(() => undefined), HEARTBEAT_MS);

  // Mọi bước sau khi giữ lease đều nằm trong try: lỗi ở đâu cũng nhả lease + dừng heartbeat ở finally
  let status: RunStatus = "running";
  try {
    const runs = await runsCol();
    const row = await runs.findOne({ _id: runId }, { projection: { brief: 1, attempts: 1, status: 1 } });
    if (!row) throw new Error(`Run ${runId} not found`);
    const brief = row.brief;
    // Run từng failed (ví dụ API down) -> cho các task lỗi thêm lượt retry mới
    if (row.status === "failed") await (await tasksCol()).updateMany({ runId, status: "failed" }, { $set: { attempts: 0 } });
    await runs.updateOne({ _id: runId }, { $inc: { attempts: 1 }, $set: { status: "running", error: null, updatedAt: now() } });
    if (row.attempts > 0) logEvent(runId, `Resuming run (attempt #${row.attempts + 1}) from last checkpoint`);

    // Output các stage đã xong nạp sẵn vào bộ nhớ -> ctx.output() đồng bộ, stage không phải đợi DB
    const outputs = new Map<string, unknown>();
    for (const st of await (await runStagesCol()).find({ runId, status: "done" }).toArray()) outputs.set(st.stage, st.output);

    const ctx: StageContext = {
      runId,
      brief,
      funnel: funnelFor(brief.numKocs),
      cfg: getConfig(),
      output<T>(stage: StageName): T {
        if (!outputs.has(stage)) throw new Error(`Stage ${stage} has no output yet`);
        return outputs.get(stage) as T;
      },
      log: (message, level = "info") => logEvent(runId, message, { level }),
    };

    for (const stageName of STAGES) {
      if (ctrl.signal.aborted) break;
      const def = STAGE_DEFS[stageName];
      if (outputs.has(stageName)) {
        logEvent(runId, `Checkpoint hit: stage already done, skipping`, { stage: stageName });
        continue;
      }
      const finished = await runStage(ctx, def as StageDef, ctrl.signal, opts, outputs);
      if (!finished) break; // bị stop giữa stage
    }

    if (ctrl.signal.aborted) {
      status = "interrupted";
      logEvent(runId, "Run stopped on request. Resume to continue from checkpoint.", { level: "warn" });
    } else {
      status = "completed";
      const result = ctx.output<unknown>("select");
      await runs.updateOne({ _id: runId }, { $set: { result, finishedAt: now() } });
      logEvent(runId, "Run completed");
    }
  } catch (err) {
    status = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    await (await runsCol()).updateOne({ _id: runId }, { $set: { error: msg } }).catch(() => undefined);
    logEvent(runId, `Run failed: ${msg}`, { level: "error" });
  } finally {
    clearInterval(heartbeat);
    activeRuns.delete(runId);
    await releaseLease(runId, owner, status).catch((err) => console.error(`[run ${runId}] release lease failed`, err));
    await flushEvents();
  }
  return status;
}

/** Nhả lease + ghi trạng thái cuối (chỉ khi vẫn là chủ lease) */
async function releaseLease(runId: string, owner: string, status: RunStatus) {
  await (await runsCol()).updateOne(
    { _id: runId, leaseOwner: owner },
    { $set: { status, leaseOwner: null, leaseUntil: null, updatedAt: now() } },
  );
}

/** Trả về true nếu stage hoàn thành, false nếu bị dừng giữa chừng */
async function runStage(
  ctx: StageContext,
  def: StageDef,
  signal: AbortSignal,
  opts: RunOptions,
  stageOutputs: Map<string, unknown>,
): Promise<boolean> {
  const { runId } = ctx;
  const stage = def.name;
  const stageStart = now();
  const runs = await runsCol();
  const stagesC = await runStagesCol();
  const tasks = await tasksCol();
  await runs.updateOne({ _id: runId }, { $set: { currentStage: stage, updatedAt: now() } });
  await stagesC.updateOne(
    { _id: `${runId}:${stage}` },
    { $setOnInsert: { runId, stage, status: "running", startedAt: now(), activeMs: 0 } },
    { upsert: true },
  );

  // 1) Plan: ghi task vào DB ($setOnInsert -> task đã có từ lần chạy trước giữ nguyên trạng thái)
  const planned = await def.plan(ctx);
  if (planned.length)
    await tasks.bulkWrite(
      planned.map((t, i) => ({
        updateOne: {
          filter: { _id: `${runId}:${stage}:${t.key}` },
          update: { $setOnInsert: { runId, stage, key: t.key, seq: i, input: t.input, status: "pending", attempts: 0, updatedAt: now() } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  // Task "running" từ process đã chết -> trả về pending
  await tasks.updateMany({ runId, stage, status: "running" }, { $set: { status: "pending" } });

  const maxAttempts = ctx.cfg.maxTaskAttempts;
  const todo = await tasks
    .find({ runId, stage, $or: [{ status: "pending" }, { status: "failed", attempts: { $lt: maxAttempts } }] })
    .sort({ seq: 1 })
    .toArray();
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
    todo.map((t: TaskDoc) =>
      limit(async () => {
        if (signal.aborted) return;
        for (let attempt = t.attempts + 1; attempt <= maxAttempts; attempt++) {
          await tasks.updateOne({ _id: t._id }, { $set: { status: "running", attempts: attempt, updatedAt: now() } });
          try {
            const out = await def.exec(ctx, t.input, t.key);
            await tasks.updateOne({ _id: t._id }, { $set: { status: "done", output: out ?? null, error: null, updatedAt: now() } });
            completedThisProcess++;
            await maybeCrash(opts, stage, completedThisProcess, ctx);
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await tasks.updateOne({ _id: t._id }, { $set: { status: "failed", error: msg.slice(0, 1000), updatedAt: now() } });
            ctx.log(`Task ${t.key} failed (attempt ${attempt}/${maxAttempts}): ${msg.slice(0, 200)}`, "warn");
            if (err instanceof Error && (err.name === "NonRetryableError" || (err as { nonRetryable?: boolean }).nonRetryable)) return;
            if (signal.aborted) return;
          }
        }
      }),
    ),
  );

  await addActiveTime(runId, stage, now() - stageStart);
  if (signal.aborted) return false;

  // 3) Reduce
  const rows = await tasks.find({ runId, stage }, { projection: { key: 1, status: 1, output: 1, error: 1 } }).toArray();
  const outputs = new Map<string, unknown>();
  const failed: string[] = [];
  for (const r of rows) {
    if (r.status === "done") outputs.set(r.key, r.output ?? null);
    else failed.push(r.key);
  }
  if (failed.length && !def.tolerateFailures) {
    // Kèm lỗi gốc của task đầu tiên để UI nói được nguyên nhân (vd. key bị từ chối), không chỉ "task failed"
    const cause = rows.find((r) => r.status === "failed" && r.error)?.error;
    throw new Error(`Stage ${stage}: ${failed.length} task(s) failed: ${failed.slice(0, 5).join(", ")}${cause ? ` — ${cause}` : ""}`);
  }
  if (failed.length) ctx.log(`${failed.length} task(s) failed but tolerated: ${failed.slice(0, 5).join(", ")}`, "warn");

  const reduceStart = now();
  const result = await def.reduce(ctx, outputs, failed);
  await stagesC.updateOne({ _id: `${runId}:${stage}` }, { $set: { status: "done", output: result, finishedAt: now() } });
  stageOutputs.set(stage, result);
  await addActiveTime(runId, stage, now() - reduceStart);
  return true;
}

async function addActiveTime(runId: string, stage: string, ms: number) {
  await (await runStagesCol()).updateOne({ _id: `${runId}:${stage}` }, { $inc: { activeMs: ms } });
  await (await runsCol()).updateOne({ _id: runId }, { $inc: { activeMs: ms } });
}

async function maybeCrash(opts: RunOptions, stage: StageName, completed: number, ctx: StageContext) {
  if (opts.crashAfter && opts.crashAfter.stage === stage && completed >= opts.crashAfter.tasks) {
    ctx.log(`💥 Simulated hard crash after ${completed} task(s) in ${stage} (process.exit)`, "error");
    await flushEvents(); // để log crash kịp nằm trong DB
    // Không release lease, không cập nhật status -> giống hệt process bị kill thật
    process.exit(137);
  }
}

// ---------------------------------------------------------------------------
// Lease: đảm bảo 1 run chỉ có 1 worker. Atomic nhờ findOneAndUpdate có điều kiện.
// ---------------------------------------------------------------------------
async function acquireLease(runId: string, owner: string): Promise<boolean> {
  const runs = await runsCol();
  const t = now();
  const got = await runs.findOneAndUpdate(
    { _id: runId, status: { $ne: "completed" }, $or: [{ leaseOwner: null }, { leaseUntil: { $lt: t } }] },
    { $set: { leaseOwner: owner, leaseUntil: t + LEASE_MS, updatedAt: t } },
  );
  if (got) return true;

  // Lease còn hạn nhưng owner có thể đã chết (crash). Nếu owner cùng máy và PID không còn
  // tồn tại -> chắc chắn đã chết -> tiếp quản ngay, không cần chờ lease hết hạn.
  const cur = await runs.findOne({ _id: runId }, { projection: { leaseOwner: 1 } });
  if (cur?.leaseOwner && isDeadLocalOwner(cur.leaseOwner)) {
    const steal = await runs.findOneAndUpdate(
      { _id: runId, leaseOwner: cur.leaseOwner },
      { $set: { leaseOwner: owner, leaseUntil: t + LEASE_MS, updatedAt: t } },
    );
    return !!steal;
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

async function renewLease(runId: string, owner: string) {
  await (await runsCol()).updateOne({ _id: runId, leaseOwner: owner }, { $set: { leaseUntil: now() + LEASE_MS } });
}

/**
 * Run bị "kẹt" (status running nhưng lease hết hạn) = worker đã chết. Đánh dấu interrupted
 * để UI hiện nút Resume. Gọi khi list runs.
 */
let lastStaleCheck = 0;
export async function markStaleRuns() {
  // Gọi từ mọi lần poll của UI; phát hiện worker chết không cần dày hơn 10 giây
  if (now() - lastStaleCheck < 10_000) return;
  lastStaleCheck = now();
  await (await runsCol()).updateMany(
    { status: "running", $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now() } }] },
    { $set: { status: "interrupted", leaseOwner: null } },
  );
}

/** Chạy nền (fire-and-forget) trong process Next.js */
export function startInBackground(runId: string) {
  if (isRunActiveHere(runId)) return;
  void runPipeline(runId).catch((err) => console.error("pipeline crashed", err));
}
