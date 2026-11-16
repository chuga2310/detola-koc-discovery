/** Lưu / đọc creator đã chuẩn hoá (dùng chung giữa các run -> không fetch lại) */
import { creatorsCol, now } from "../db";
import type { CreatorRecord } from "../types";

export async function upsertCreators(list: CreatorRecord[]) {
  if (!list.length) return;
  const c = await creatorsCol();
  await c.bulkWrite(
    list.map((x) => ({
      updateOne: {
        filter: { _id: x.id },
        update: { $set: { source: x.source, handle: x.handle, data: { ...x, raw: undefined }, fetchedAt: now() } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

export async function loadCreators(ids: string[]): Promise<Map<string, CreatorRecord>> {
  const out = new Map<string, CreatorRecord>();
  if (!ids.length) return out;
  const docs = await (await creatorsCol()).find({ _id: { $in: ids } }).toArray();
  for (const d of docs) out.set(d._id, d.data);
  return out;
}

export const tiktokProfileUrl = (handle: string) => `https://www.tiktok.com/@${handle}`;
