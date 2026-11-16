/** Lưu / đọc creator đã chuẩn hoá (dùng chung giữa các run -> không fetch lại) */
import { db, now } from "../db";
import type { CreatorRecord } from "../types";

export function upsertCreators(list: CreatorRecord[]) {
  const stmt = db().prepare(
    `INSERT INTO creators (id, source, handle, data_json, fetched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, fetched_at = excluded.fetched_at, handle = excluded.handle`,
  );
  db().transaction(() => {
    for (const c of list) stmt.run(c.id, c.source, c.handle, JSON.stringify({ ...c, raw: undefined }), now());
  })();
}

export function loadCreators(ids: string[]): Map<string, CreatorRecord> {
  const out = new Map<string, CreatorRecord>();
  const stmt = db().prepare("SELECT data_json FROM creators WHERE id = ?");
  for (const id of ids) {
    const r = stmt.get(id) as { data_json: string } | undefined;
    if (r) out.set(id, JSON.parse(r.data_json) as CreatorRecord);
  }
  return out;
}

export const tiktokProfileUrl = (handle: string) => `https://www.tiktok.com/@${handle}`;
