/**
 * Persistence layer — MongoDB.
 *
 * Mọi tiến độ đều được ghi xuống DB trước khi chuyển bước: process chết giữa chừng -> chạy lại
 * sẽ đọc DB và bỏ qua những gì đã xong.
 *
 * Collection (thiết kế theo cách app đọc/ghi, không chép 1:1 bảng SQL):
 * - runs            : 1 chiến dịch = 1 document: brief, hội thoại lập brief, trạng thái, lease, kết quả.
 * - run_stages      : checkpoint từng bước + output (tối đa 8 document / chiến dịch).
 * - tasks           : checkpoint cấp task. Collection riêng vì task cập nhật SONG SONG và độc lập,
 *                     có thể tới hàng trăm task / bước (500 KOC) -> không nhúng vào run.
 * - creators        : creator đã chuẩn hoá, dùng chung giữa các chiến dịch.
 * - ai_cache        : kết quả AI theo content hash -> chạy lại / resume không tốn token.
 * - ai_calls, data_calls, events : log chỉ ghi thêm (token/cost, credit Kalodata, tiến độ cho UI).
 * - kalo_*          : dữ liệu Kalodata lưu thành dữ liệu thật để tái sử dụng (xem sources/kaloStore.ts).
 *
 * Lên production: nhiều worker cùng kéo task bằng findOneAndUpdate có điều kiện (đã dùng cho lease).
 */
import { MongoClient, type Collection, type Db, type Document } from "mongodb";
import type { Usage } from "./ai/pricing";
import type { CampaignBrief, CreatorRecord, RunStatus } from "./types";

export const now = () => Date.now();

// ---------------------------------------------------------------- kiểu document

export interface RunDoc {
  _id: string;
  brief: CampaignBrief;
  config: Record<string, unknown>;
  chat?: unknown[] | null;
  status: RunStatus;
  currentStage?: string | null;
  error?: string | null;
  result?: unknown;
  leaseOwner?: string | null;
  leaseUntil?: number | null;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number | null;
  activeMs: number;
  attempts: number;
}

export interface RunStageDoc {
  _id: string; // `${runId}:${stage}`
  runId: string;
  stage: string;
  status: "running" | "done";
  output?: unknown;
  startedAt: number;
  finishedAt?: number | null;
  activeMs: number;
}

export interface TaskDoc {
  _id: string; // `${runId}:${stage}:${key}`
  runId: string;
  stage: string;
  key: string;
  /** Thứ tự lập kế hoạch (để chạy theo đúng thứ tự plan) */
  seq: number;
  input: unknown;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  output?: unknown;
  error?: string | null;
  updatedAt: number;
}

export interface CreatorDoc {
  _id: string;
  source: string;
  handle: string;
  data: CreatorRecord;
  fetchedAt: number;
}

export interface AiCacheDoc {
  _id: string;
  provider: string;
  model: string;
  output: unknown;
  usage: Usage;
  createdAt: number;
}

export interface AiCallDoc {
  runId: string | null;
  stage: string;
  taskKey: string;
  provider: string;
  model: string;
  cacheHit: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  images: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  createdAt: number;
}

export interface EventDoc {
  runId: string;
  ts: number;
  /** Thứ tự ghi trong cùng 1 ms */
  seq: number;
  level: "info" | "warn" | "error";
  stage: string | null;
  message: string;
}

export interface DataCallDoc {
  runId: string | null;
  provider: string;
  endpoint: string;
  credits: number;
  creditsAvoided: number;
  /** true = dùng lại dữ liệu đã lưu trong DB, không gọi API */
  cacheHit: boolean;
  latencyMs: number;
  createdAt: number;
}

// ---------------------------------------------------------------- kết nối

const g = globalThis as unknown as { __kocMongo?: { client: MongoClient; db: Promise<Db> } };

function connect() {
  const uri = process.env.MONGODB_URI?.trim() || "mongodb://127.0.0.1:27017";
  const name = process.env.MONGODB_DB?.trim() || "koc_discovery";
  // ignoreUndefined: field undefined không bị lưu thành null (code dùng `!== undefined` để biết "chưa có dữ liệu")
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, ignoreUndefined: true });
  const dbp = client.connect().then(async (c) => {
    const d = c.db(name);
    await ensureIndexes(d);
    return d;
  });
  // Kết nối lỗi -> lần gọi sau thử lại (không giữ promise hỏng mãi)
  dbp.catch(() => {
    if (g.__kocMongo?.client === client) g.__kocMongo = undefined;
  });
  return { client, db: dbp };
}

/** 1 client cho cả process (globalThis để sống qua HMR của Next dev) */
export function mdb(): Promise<Db> {
  g.__kocMongo ??= connect();
  return g.__kocMongo.db;
}

export async function col<T extends Document>(name: string): Promise<Collection<T>> {
  return (await mdb()).collection<T>(name);
}

export const runsCol = () => col<RunDoc>("runs");
export const runStagesCol = () => col<RunStageDoc>("run_stages");
export const tasksCol = () => col<TaskDoc>("tasks");
export const creatorsCol = () => col<CreatorDoc>("creators");
export const aiCacheCol = () => col<AiCacheDoc>("ai_cache");
export const aiCallsCol = () => col<AiCallDoc>("ai_calls");
export const eventsCol = () => col<EventDoc>("events");
export const dataCallsCol = () => col<DataCallDoc>("data_calls");

async function ensureIndexes(d: Db) {
  await Promise.all([
    d.collection("runs").createIndex({ createdAt: -1 }),
    d.collection("runs").createIndex({ status: 1, leaseUntil: 1 }),
    d.collection("run_stages").createIndex({ runId: 1, stage: 1 }),
    d.collection("tasks").createIndex({ runId: 1, stage: 1, status: 1, seq: 1 }),
    d.collection("ai_calls").createIndex({ runId: 1, stage: 1 }),
    d.collection("events").createIndex({ runId: 1, ts: -1, seq: -1 }),
    d.collection("data_calls").createIndex({ runId: 1, endpoint: 1 }),
    d.collection("kalo_rank_snapshots").createIndex({ paramsHash: 1, fetchedAt: -1 }),
    d.collection("kalo_videos").createIndex({ creatorId: 1 }),
  ]);
}

/** Đóng kết nối (CLI script gọi trước khi thoát) */
export async function closeDb() {
  await flushEvents();
  const cur = g.__kocMongo;
  g.__kocMongo = undefined;
  if (cur) await cur.client.close();
}

// ---------------------------------------------------------------- log tiến độ

const pending = new Set<Promise<unknown>>();
let seq = 0;

/**
 * Ghi 1 dòng log tiến độ. Không chặn luồng chính (UI chỉ cần thấy sau vài trăm ms);
 * các lần ghi đang chờ được gom lại để flushEvents() đợi trước khi kết thúc run / thoát process.
 */
export function logEvent(runId: string, message: string, opts: { level?: "info" | "warn" | "error"; stage?: string } = {}) {
  const doc: EventDoc = { runId, ts: now(), seq: seq++, level: opts.level ?? "info", stage: opts.stage ?? null, message };
  const p = eventsCol()
    .then((c) => c.insertOne(doc))
    .catch((err) => console.error("[events] write failed", err))
    .finally(() => pending.delete(p));
  pending.add(p);
  if (process.env.LOG_EVENTS !== "off") {
    const tag = opts.stage ? `[${opts.stage}]` : "";
    console.log(`[run ${runId.slice(0, 8)}]${tag} ${message}`);
  }
}

export async function flushEvents() {
  while (pending.size) await Promise.allSettled([...pending]);
}
