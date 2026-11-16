/**
 * Persistence layer (SQLite, WAL mode).
 *
 * Đây là "xương sống" của Reliability: mọi tiến độ đều được ghi xuống DB
 * trước khi chuyển bước. Process chết giữa chừng -> chạy lại sẽ đọc DB và
 * bỏ qua những gì đã xong.
 *
 * Bảng chính:
 * - runs        : 1 lần chạy discovery cho 1 brief.
 * - run_stages  : stage nào của run đã xong + output tổng hợp (checkpoint cấp stage).
 * - tasks       : đơn vị việc nhỏ nhất (1 batch / 1 creator / 1 video) -> checkpoint cấp task.
 * - creators    : data creator đã chuẩn hoá, dùng chung giữa các run.
 * - ai_cache    : cache kết quả AI theo content hash -> chạy lại/resume không tốn token.
 * - ai_calls    : log từng lần gọi AI (token, cost, latency) -> phục vụ benchmark.
 * - events      : log tiến độ cho UI.
 *
 * Lên production: đổi sang Postgres, tasks dùng `SELECT ... FOR UPDATE SKIP LOCKED`
 * để nhiều worker cùng kéo task. Schema giữ nguyên.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "./config";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const { paths } = getConfig();
  fs.mkdirSync(path.dirname(paths.db), { recursive: true });
  const d = new Database(paths.db);
  d.pragma("journal_mode = WAL"); // ghi đồng thời an toàn, crash không hỏng file
  d.pragma("synchronous = NORMAL");
  d.pragma("busy_timeout = 5000");
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      brief_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      status TEXT NOT NULL,
      current_stage TEXT,
      error TEXT,
      result_json TEXT,
      lease_owner TEXT,
      lease_until INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER,
      active_ms INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS run_stages (
      run_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,          -- running | done
      output_json TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      active_ms INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (run_id, stage)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      run_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      task_key TEXT NOT NULL,
      input_json TEXT NOT NULL,
      status TEXT NOT NULL,          -- pending | running | done | failed
      attempts INTEGER NOT NULL DEFAULT 0,
      output_json TEXT,
      error TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (run_id, stage, task_key)
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(run_id, stage, status);

    CREATE TABLE IF NOT EXISTS creators (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      handle TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      cache_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      output_json TEXT NOT NULL,
      usage_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      stage TEXT,
      task_key TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      cache_hit INTEGER NOT NULL,     -- 1 = lấy từ ai_cache, không gọi API
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_read_tokens INTEGER NOT NULL,
      cache_write_tokens INTEGER NOT NULL,
      images INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      latency_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_calls_run ON ai_calls(run_id);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      stage TEXT,
      message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, id);
  `);
}

export const now = () => Date.now();

export function logEvent(
  runId: string,
  message: string,
  opts: { level?: "info" | "warn" | "error"; stage?: string } = {},
) {
  db()
    .prepare(
      "INSERT INTO events (run_id, ts, level, stage, message) VALUES (?, ?, ?, ?, ?)",
    )
    .run(runId, now(), opts.level ?? "info", opts.stage ?? null, message);
  if (process.env.LOG_EVENTS !== "off") {
    const tag = opts.stage ? `[${opts.stage}]` : "";
    console.log(`[run ${runId.slice(0, 8)}]${tag} ${message}`);
  }
}

export function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
