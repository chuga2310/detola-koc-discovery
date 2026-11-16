/**
 * Chuyển dữ liệu từ bản SQLite cũ (.data/koc.db) sang MongoDB, chạy 1 lần.
 *
 *   npm run migrate:sqlite                 # mặc định đọc .data/koc.db
 *   npm run migrate:sqlite -- --from path/to/koc.db --force
 *
 * Giữ nguyên: chiến dịch (brief, hội thoại, checkpoint từng bước/task, kết quả), creator, cache AI,
 * log chi phí AI / Kalodata, log tiến độ. Response Kalodata cũ (kalo_cache) được chuyển thành dữ liệu
 * thật trong kalo_rank_snapshots / kalo_creators / kalo_videos / kalo_products -> không mất credit đã trả.
 * Chạy lại an toàn: dữ liệu có khoá được upsert; log chỉ chép 1 lần (đánh dấu trong app_meta), trừ khi --force.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { closeDb, col, mdb } from "../src/lib/db";
import { importLegacyResponse } from "../src/lib/sources/kaloStore";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const json = <T>(s: string | null | undefined): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

type Row = Record<string, unknown>;

async function main() {
  const from = arg("from") ?? path.join(process.cwd(), ".data", "koc.db");
  if (!fs.existsSync(from)) {
    console.log(`Không thấy ${from}: không có gì để chuyển.`);
    return;
  }
  const sq = new Database(from, { readonly: true });
  const has = (t: string) => !!sq.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
  const all = (sql: string) => sq.prepare(sql).all() as Row[];
  const db = await mdb();
  const meta = await col<{ _id: string; at: number; counts: Record<string, number> }>("app_meta");
  const done = await meta.findOne({ _id: "sqlite_migrated" });
  const force = process.argv.includes("--force");
  const counts: Record<string, number> = {};

  // ---- dữ liệu có khoá: upsert (chạy lại không nhân bản)
  if (has("runs")) {
    const rows = all("SELECT * FROM runs");
    for (const r of rows)
      await db.collection("runs").replaceOne(
        { _id: r.id as never },
        {
          brief: json(r.brief_json as string),
          config: json(r.config_json as string) ?? {},
          chat: json(r.chat_json as string),
          status: r.status,
          currentStage: r.current_stage ?? null,
          error: r.error ?? null,
          result: json(r.result_json as string),
          leaseOwner: null,
          leaseUntil: null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          finishedAt: r.finished_at ?? null,
          activeMs: r.active_ms ?? 0,
          attempts: r.attempts ?? 0,
        },
        { upsert: true },
      );
    counts.runs = rows.length;
  }
  if (has("run_stages")) {
    const rows = all("SELECT * FROM run_stages");
    for (const r of rows)
      await db.collection("run_stages").replaceOne(
        { _id: `${r.run_id}:${r.stage}` as never },
        {
          runId: r.run_id,
          stage: r.stage,
          status: r.status,
          output: json(r.output_json as string),
          startedAt: r.started_at ?? null,
          finishedAt: r.finished_at ?? null,
          activeMs: r.active_ms ?? 0,
        },
        { upsert: true },
      );
    counts.run_stages = rows.length;
  }
  if (has("tasks")) {
    const rows = all("SELECT rowid AS seq, * FROM tasks ORDER BY rowid");
    const ops = rows.map((r) => ({
      replaceOne: {
        filter: { _id: `${r.run_id}:${r.stage}:${r.task_key}` as never },
        replacement: {
          runId: r.run_id,
          stage: r.stage,
          key: r.task_key,
          seq: r.seq,
          input: json(r.input_json as string),
          status: r.status,
          attempts: r.attempts ?? 0,
          output: json(r.output_json as string),
          error: r.error ?? null,
          updatedAt: r.updated_at,
        },
        upsert: true,
      },
    }));
    for (let i = 0; i < ops.length; i += 500) await db.collection("tasks").bulkWrite(ops.slice(i, i + 500), { ordered: false });
    counts.tasks = rows.length;
  }
  if (has("creators")) {
    const rows = all("SELECT * FROM creators");
    const ops = rows.map((r) => ({
      replaceOne: {
        filter: { _id: r.id as never },
        replacement: { source: r.source, handle: r.handle, data: json(r.data_json as string), fetchedAt: r.fetched_at },
        upsert: true,
      },
    }));
    if (ops.length) await db.collection("creators").bulkWrite(ops, { ordered: false });
    counts.creators = rows.length;
  }
  if (has("ai_cache")) {
    const rows = all("SELECT * FROM ai_cache");
    const ops = rows.map((r) => ({
      replaceOne: {
        filter: { _id: r.cache_key as never },
        replacement: {
          provider: r.provider,
          model: r.model,
          output: json(r.output_json as string),
          usage: json(r.usage_json as string),
          createdAt: r.created_at,
        },
        upsert: true,
      },
    }));
    if (ops.length) await db.collection("ai_cache").bulkWrite(ops, { ordered: false });
    counts.ai_cache = rows.length;
  }

  // ---- log chỉ ghi thêm: chép 1 lần
  if (!done || force) {
    // Chép lại: xoá log + snapshot đã chép (thực thể upsert nên không nhân bản)
    if (force && done) for (const c of ["ai_calls", "events", "data_calls", "kalo_rank_snapshots"]) await db.collection(c).deleteMany({});
    if (has("ai_calls")) {
      const docs = all("SELECT * FROM ai_calls ORDER BY id").map((r) => ({
        runId: r.run_id ?? null,
        stage: r.stage,
        taskKey: r.task_key,
        provider: r.provider,
        model: r.model,
        cacheHit: r.cache_hit === 1,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        images: r.images,
        costUsd: r.cost_usd,
        latencyMs: r.latency_ms,
        ok: r.ok === undefined ? true : r.ok === 1,
        createdAt: r.created_at,
      }));
      if (docs.length) await db.collection("ai_calls").insertMany(docs, { ordered: false });
      counts.ai_calls = docs.length;
    }
    if (has("events")) {
      const docs = all("SELECT * FROM events ORDER BY id").map((r) => ({
        runId: r.run_id,
        ts: r.ts,
        seq: r.id,
        level: r.level,
        stage: r.stage ?? null,
        message: r.message,
      }));
      for (let i = 0; i < docs.length; i += 1000) await db.collection("events").insertMany(docs.slice(i, i + 1000), { ordered: false });
      counts.events = docs.length;
    }
    if (has("data_calls")) {
      const docs = all("SELECT * FROM data_calls ORDER BY id").map((r) => ({
        runId: r.run_id ?? null,
        provider: r.provider,
        endpoint: r.endpoint,
        credits: r.credits,
        creditsAvoided: r.credits_avoided ?? 0,
        cacheHit: r.cache_hit === 1,
        latencyMs: r.latency_ms,
        createdAt: r.created_at,
      }));
      if (docs.length) await db.collection("data_calls").insertMany(docs, { ordered: false });
      counts.data_calls = docs.length;
    }
    // Response Kalodata cũ -> dữ liệu thật trong kalo_* (snapshot + thực thể)
    if (has("kalo_cache")) {
      const rows = all("SELECT * FROM kalo_cache ORDER BY fetched_at");
      for (const r of rows)
        await importLegacyResponse(String(r.path), json<Row>(r.body_json as string) ?? {}, json(r.data_json as string), Number(r.fetched_at));
      counts.kalodata_responses = rows.length;
    }
    await meta.replaceOne({ _id: "sqlite_migrated" }, { at: Date.now(), counts }, { upsert: true });
  } else {
    console.log("Log (ai_calls, events, data_calls) và dữ liệu Kalodata đã chuyển trước đó; bỏ qua (dùng --force để chép lại).");
  }
  sq.close();
  console.log("Đã chuyển sang MongoDB:", counts);
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
