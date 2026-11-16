/**
 * Creator đã chuẩn hoá của TỪNG chiến dịch (snapshot theo run).
 *
 * Bản ghi creator mang dữ liệu phụ thuộc brief: nguồn tìm thấy, video khớp keyword, sản phẩm cùng loại,
 * doanh thu theo ngành của brief... nên KHÔNG dùng chung giữa các chiến dịch (chiến dịch sau sẽ ghi đè
 * dữ liệu chiến dịch trước đang chạy / sẽ resume). Phần tái sử dụng giữa chiến dịch nằm ở tầng dưới:
 * dữ liệu Kalodata (sources/kaloStore.ts) và kết quả AI (ai_cache) -> chạy lại vẫn 0 credit, 0 token.
 */
import { creatorsCol, now } from "../db";
import type { CreatorRecord } from "../types";

const docId = (runId: string, creatorId: string) => `${runId}:${creatorId}`;

export async function upsertCreators(runId: string, list: CreatorRecord[]) {
  if (!list.length) return;
  await (await creatorsCol()).bulkWrite(
    list.map((x) => ({
      updateOne: {
        filter: { _id: docId(runId, x.id) },
        update: { $set: { runId, creatorId: x.id, source: x.source, handle: x.handle, data: { ...x, raw: undefined }, fetchedAt: now() } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

/**
 * Đọc creator của 1 run. Run tạo trước khi tách theo run chỉ có bản ghi dùng chung (`_id` = creatorId):
 * thiếu bản theo run thì đọc bản cũ đó để resume / xem lại không bị hỏng.
 */
export async function loadCreators(runId: string, ids: string[]): Promise<Map<string, CreatorRecord>> {
  const out = new Map<string, CreatorRecord>();
  if (!ids.length) return out;
  const c = await creatorsCol();
  for (const d of await c.find({ _id: { $in: ids.map((id) => docId(runId, id)) } }).toArray()) out.set(d.data.id, d.data);
  const legacy = ids.filter((id) => !out.has(id));
  if (legacy.length) for (const d of await c.find({ _id: { $in: legacy } }).toArray()) out.set(d._id, d.data);
  return out;
}

/** Số creator theo từng nguồn (commerce, content...) của 1 run, chỉ đọc field cần thiết */
export async function sourceCounts(runId: string, ids: string[]): Promise<Record<string, number>> {
  const c = await creatorsCol();
  const proj = { projection: { "data.id": 1, "data.sources": 1 } };
  const docs = await c.find({ _id: { $in: ids.map((id) => docId(runId, id)) } }, proj).toArray();
  const found = new Set(docs.map((d) => d.data?.id));
  const legacy = ids.filter((id) => !found.has(id));
  if (legacy.length) docs.push(...(await c.find({ _id: { $in: legacy } }, proj).toArray()));
  const counts: Record<string, number> = {};
  for (const d of docs) for (const t of d.data?.sources ?? []) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

export const tiktokProfileUrl = (handle: string) => `https://www.tiktok.com/@${handle}`;
