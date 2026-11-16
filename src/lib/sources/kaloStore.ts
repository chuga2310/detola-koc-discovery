/**
 * Kho dữ liệu Kalodata trong MongoDB — dữ liệu thật để TÁI SỬ DỤNG, không phải cache response.
 *
 * - Mỗi lần gọi API xếp hạng / danh sách = 1 SNAPSHOT (kalo_rank_snapshots): endpoint, tham số,
 *   thời điểm, credit đã trả và các dòng kết quả theo đúng thứ tự (≤ 100 dòng / lần -> nhúng).
 * - Đồng thời upsert THỰC THỂ: kalo_creators, kalo_videos, kalo_products (cột số liệu chính để truy
 *   vấn, kèm dòng gốc mới nhất). Quan hệ creator ↔ sản phẩm đã bán được ghi 2 chiều.
 * - Response chi tiết (creator / creator theo ngành / video) nhúng thẳng vào thực thể (1:1).
 *
 * Gọi lại cùng tham số khi dữ liệu còn mới (KALODATA_DATA_MAX_AGE_HOURS, mặc định 7 ngày) -> dùng lại,
 * 0 credit. API lỗi (key bị từ chối, mạng...) mà đã có dữ liệu cũ -> dùng dữ liệu cũ kèm cảnh báo.
 */
import type { Collection, Document } from "mongodb";
import { col, logEvent, now } from "../db";
import { redactContact, stableHash } from "../util";
import { creditCost, kaloCall, KalodataError, logDataCall } from "./kalodataApi";

const maxAgeMs = () => Number(process.env.KALODATA_DATA_MAX_AGE_HOURS ?? 168) * 3600_000;

export interface RankSnapshotDoc {
  endpoint: string;
  paramsHash: string;
  params: Record<string, unknown>;
  rows: Record<string, unknown>[];
  rowCount: number;
  credits: number;
  fetchedAt: number;
}

interface DetailSlot {
  paramsHash: string;
  data: Record<string, unknown>;
  fetchedAt: number;
}

export interface KaloCreatorDoc extends Document {
  _id: string;
  handle?: string;
  nickname?: string;
  followers?: number;
  status?: string;
  revenue?: number;
  videoRevenue?: number;
  liveRevenue?: number;
  revenueGrowthRate?: number;
  videoGpm?: number;
  unitPrice?: number;
  newFollowers?: number;
  contactChannels?: string[];
  soldProductIds?: string[];
  rank?: Record<string, unknown>;
  rankSeenAt?: number;
  detail?: DetailSlot;
  categoryDetails?: Record<string, DetailSlot & { categoryIds: string[] }>;
  updatedAt: number;
}

export interface KaloVideoDoc extends Document {
  _id: string;
  creatorId?: string;
  creatorHandle?: string;
  title?: string;
  publishDate?: string;
  views?: number;
  revenue?: number;
  adViewRatio?: number;
  isAd?: boolean;
  isAi?: boolean;
  videoGpm?: number;
  adsRoas?: number;
  durationSec?: number;
  rank?: Record<string, unknown>;
  rankSeenAt?: number;
  detail?: DetailSlot;
  url?: string;
  urlExpiresAt?: number;
  updatedAt: number;
}

export interface KaloProductDoc extends Document {
  _id: string;
  name?: string;
  sellerName?: string;
  unitPrice?: number;
  revenue?: number;
  categories?: string[];
  soldByCreatorIds?: string[];
  rank?: Record<string, unknown>;
  rankSeenAt?: number;
  updatedAt: number;
}

export const snapshotsCol = () => col<RankSnapshotDoc>("kalo_rank_snapshots");
export const kaloCreatorsCol = () => col<KaloCreatorDoc>("kalo_creators");
export const kaloVideosCol = () => col<KaloVideoDoc>("kalo_videos");
export const kaloProductsCol = () => col<KaloProductDoc>("kalo_products");

const num = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined);
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const clean = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Lỗi nào thì nên dùng dữ liệu cũ thay vì làm hỏng cả bước (key bị từ chối, hết budget, mạng, upstream) */
const canFallBack = (e: unknown) => e instanceof KalodataError && e.kind !== "param";

function warnStale(runId: string | null | undefined, what: string, fetchedAt: number, err: unknown) {
  const age = Math.round((now() - fetchedAt) / 3600_000);
  const msg = `Kalodata ${what}: API lỗi (${(err as Error).message.slice(0, 120)}) -> dùng dữ liệu đã lưu ${age} giờ trước`;
  if (runId) logEvent(runId, msg, { level: "warn" });
  else console.warn(msg);
}

interface Stored<T> {
  data: T;
  fetchedAt: number;
  /** Credit lẽ ra phải trả nếu gọi lại API (ghi vào log "đã tiết kiệm") */
  credits: number;
  /** Cùng tham số và còn trong KALODATA_DATA_MAX_AGE_HOURS */
  fresh: boolean;
}

/**
 * Chính sách dùng chung cho mọi dữ liệu Kalodata:
 *   còn mới -> dùng lại (0 credit) · không thì gọi API + lưu · API lỗi mà có bản cũ -> dùng bản cũ kèm cảnh báo.
 */
async function reuseOrFetch<T>(
  endpoint: string,
  runId: string | null | undefined,
  stored: Stored<T> | null,
  fetchAndSave: () => Promise<T>,
  label = endpoint,
): Promise<T> {
  const reuse = async (s: Stored<T>) => {
    await logDataCall(runId ?? null, endpoint, 0, true, 0, s.credits);
    return s.data;
  };
  if (stored?.fresh) return reuse(stored);
  try {
    return await fetchAndSave();
  } catch (err) {
    if (!stored || !canFallBack(err)) throw err;
    warnStale(runId, label, stored.fetchedAt, err);
    return reuse(stored);
  }
}

const isFresh = (fetchedAt: number) => now() - fetchedAt < maxAgeMs();

// ---------------------------------------------------------------- xếp hạng / danh sách

/**
 * Gọi 1 API xếp hạng. Dùng lại snapshot cùng tham số nếu còn mới; không thì gọi API, lưu snapshot
 * và upsert thực thể. API lỗi -> dùng snapshot cũ (nếu có).
 */
export async function rankQuery<T = Record<string, unknown>>(
  endpoint: string,
  params: Record<string, unknown>,
  opts: { runId?: string | null; expectedRows?: number } = {},
): Promise<T[]> {
  const last = await (await snapshotsCol()).findOne({ paramsHash: stableHash({ endpoint, params }) }, { sort: { fetchedAt: -1 } });
  const stored = last && { data: last.rows as T[], fetchedAt: last.fetchedAt, credits: last.credits, fresh: isFresh(last.fetchedAt) };
  return reuseOrFetch(endpoint, opts.runId, stored, async () => {
    const data = await kaloCall<unknown>(endpoint, params, opts);
    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    await saveRankSnapshot(endpoint, params, rows, now());
    return rows as T[];
  });
}

export async function saveRankSnapshot(endpoint: string, params: Record<string, unknown>, rows: Record<string, unknown>[], fetchedAt: number) {
  const credits = creditCost(endpoint, rows.length);
  await (await snapshotsCol()).insertOne({
    endpoint,
    paramsHash: stableHash({ endpoint, params }),
    params,
    rows,
    rowCount: rows.length,
    credits,
    fetchedAt,
  });
  await upsertEntitiesFromRank(endpoint, params, rows, fetchedAt);
}

async function upsertEntitiesFromRank(endpoint: string, params: Record<string, unknown>, rows: Record<string, unknown>[], at: number) {
  if (!rows.length) return;
  if (endpoint.endsWith("/creator/rank")) {
    const productId = str(params.product_id);
    await (await kaloCreatorsCol()).bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { _id: String(r.creator_id) },
          update: {
            $set: clean({
              handle: str(r.creator_handle)?.replace(/^@/, ""),
              nickname: str(r.creator_nickname),
              followers: num(r.creator_followers),
              revenue: num(r.revenue),
              videoRevenue: num(r.video_revenue),
              liveRevenue: num(r.live_revenue),
              revenueGrowthRate: num(r.revenue_growth_rate),
              rank: r,
              rankSeenAt: at,
              updatedAt: at,
            }),
            ...(productId ? { $addToSet: { soldProductIds: productId } } : {}),
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    if (productId)
      await (await kaloProductsCol()).updateOne(
        { _id: productId },
        { $addToSet: { soldByCreatorIds: { $each: rows.map((r) => String(r.creator_id)) } }, $setOnInsert: { updatedAt: at } },
        { upsert: true },
      );
  } else if (endpoint.endsWith("/video/rank")) {
    const creatorId = str(params.creator_id);
    await (await kaloVideosCol()).bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { _id: String(r.video_id) },
          update: {
            $set: clean({
              creatorId: str(r.belonged_creator_id) ?? creatorId,
              creatorHandle: str(r.belonged_creator_handle)?.replace(/^@/, ""),
              title: str(r.video_title),
              publishDate: str(r.publish_date),
              views: num(r.views),
              revenue: num(r.revenue),
              adViewRatio: num(r.ad_view_ratio),
              isAd: r.ad === undefined ? undefined : Number(r.ad) === 1,
              isAi: r.ai_video === undefined ? undefined : Number(r.ai_video) === 1,
              rank: r,
              rankSeenAt: at,
              updatedAt: at,
            }),
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } else if (endpoint.endsWith("/product/rank")) {
    const creatorId = str(params.creator_id);
    await (await kaloProductsCol()).bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { _id: String(r.product_id) },
          update: {
            $set: clean({
              name: str(r.product_name),
              sellerName: str(r.seller_name),
              unitPrice: num(r.unit_price),
              revenue: num(r.revenue),
              categories: [r.pri_category, r.sec_category, r.ter_category]
                .map((c) => (c && typeof c === "object" ? str((c as { category_name?: unknown }).category_name) : str(c)))
                .filter((x): x is string => !!x),
              rank: r,
              rankSeenAt: at,
              updatedAt: at,
            }),
            ...(creatorId ? { $addToSet: { soldByCreatorIds: creatorId } } : {}),
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    if (creatorId)
      await (await kaloCreatorsCol()).updateOne(
        { _id: creatorId },
        { $addToSet: { soldProductIds: { $each: rows.map((r) => String(r.product_id)) } }, $setOnInsert: { updatedAt: at } },
        { upsert: true },
      );
  }
}

// ---------------------------------------------------------------- chi tiết

type DetailKind = "creator" | "video";
const DETAIL_ENDPOINT: Record<DetailKind, string> = { creator: "/tiktok/creator/detail", video: "/tiktok/video/detail" };
const ID_FIELD: Record<DetailKind, string> = { creator: "creator_id", video: "video_id" };

/** Hash tham số chi tiết KHÔNG gồm id (vùng, tiền tệ, khoảng ngày, ngành...) */
const detailHash = (kind: DetailKind, params: Record<string, unknown>) => {
  const rest = { ...params };
  delete rest[ID_FIELD[kind]];
  return stableHash({ endpoint: DETAIL_ENDPOINT[kind], rest });
};

const CONTACT_FIELDS: [string, string][] = [
  ["creator_contact_email", "Email"],
  ["creator_contact_zalo", "Zalo"],
  ["creator_contact_facebook", "Facebook"],
  ["creator_contact_ins", "Instagram"],
  ["creator_contact_whatsapp", "WhatsApp"],
  ["creator_contact_line", "Line"],
];

/** Cột số liệu tách từ response chi tiết để truy vấn được (không lưu giá trị liên hệ, chỉ tên kênh) */
function columnsFromDetail(kind: DetailKind, d: Record<string, unknown>): Record<string, unknown> {
  if (kind === "creator")
    return clean({
      handle: str(d.creator_handle)?.replace(/^@/, ""),
      nickname: str(d.creator_nickname),
      followers: num(d.creator_followers),
      status: str(d.creator_status),
      revenue: num(d.revenue),
      videoRevenue: num(d.video_revenue),
      liveRevenue: num(d.live_revenue),
      videoGpm: num(d.video_gpm),
      unitPrice: num(d.unit_price),
      newFollowers: num(d.new_followers),
      contactChannels: CONTACT_FIELDS.filter(([k]) => typeof d[k] === "string" && (d[k] as string).trim()).map(([, n]) => n),
    });
  return clean({
    creatorId: str(d.belonged_creator_id),
    title: str(d.video_title),
    views: num(d.views),
    revenue: num(d.revenue),
    videoGpm: num(d.video_gpm),
    adsRoas: num(d.ads_roas),
    durationSec: num(d.duration),
    adViewRatio: num(d.ad_view_ratio),
  });
}

/** Contact không lưu vào DB: chỉ giữ TÊN kênh (đã tách ở trên) */
function stripContacts(d: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...d };
  if (!Array.isArray(out.contact_channels))
    out.contact_channels = CONTACT_FIELDS.filter(([k]) => typeof d[k] === "string" && (d[k] as string).trim()).map(([, n]) => n);
  for (const [k] of CONTACT_FIELDS) delete out[k];
  // Bio công khai hay chứa email / SĐT: che trước khi lưu vào DB
  if (typeof out.creator_bio === "string") out.creator_bio = redactContact(out.creator_bio);
  return out;
}

/** Creator và video có chung phần chi tiết (`detail`) nên đọc / ghi qua kiểu chung */
type DetailDoc = Document & { _id: string; detail?: DetailSlot; updatedAt: number };
async function detailCollection(kind: DetailKind): Promise<Collection<DetailDoc>> {
  return col<DetailDoc>(kind === "creator" ? "kalo_creators" : "kalo_videos");
}

/** Chi tiết 1 creator / video: dùng lại nếu còn mới và cùng tham số; API lỗi -> dùng bản cũ */
export async function detailQuery<T = Record<string, unknown>>(
  kind: DetailKind,
  id: string,
  params: Record<string, unknown>,
  opts: { runId?: string | null } = {},
): Promise<T | null> {
  const endpoint = DETAIL_ENDPOINT[kind];
  const doc = await (await detailCollection(kind)).findOne({ _id: id }, { projection: { detail: 1 } });
  const slot = doc?.detail;
  // Bản cũ khác tham số (vd khác khoảng ngày) không được dùng lại, nhưng vẫn hơn không khi API lỗi
  const stored = slot && {
    data: slot.data as T,
    fetchedAt: slot.fetchedAt,
    credits: creditCost(endpoint),
    fresh: slot.paramsHash === detailHash(kind, params) && isFresh(slot.fetchedAt),
  };
  return reuseOrFetch<T | null>(endpoint, opts.runId, stored ?? null, async () => {
    const data = await kaloCall<Record<string, unknown>>(endpoint, params, opts);
    await saveDetail(kind, id, params, data ?? {}, now());
    return (data ? stripContacts(data) : null) as T | null;
  });
}

export async function saveDetail(kind: DetailKind, id: string, params: Record<string, unknown>, data: Record<string, unknown>, at: number) {
  await (await detailCollection(kind)).updateOne(
    { _id: id },
    { $set: { ...columnsFromDetail(kind, data), detail: { paramsHash: detailHash(kind, params), data: stripContacts(data), fetchedAt: at }, updatedAt: at } },
    { upsert: true },
  );
}

/** Chi tiết creator CHỈ TRONG các ngành chỉ định (doanh thu, GPM theo ngành) — tính năng trả phí */
export async function creatorCategoryDetail<T = Record<string, unknown>>(
  creatorId: string,
  categoryIds: string[],
  params: Record<string, unknown>,
  opts: { runId?: string | null } = {},
): Promise<T | null> {
  const endpoint = DETAIL_ENDPOINT.creator;
  const body = { ...params, creator_id: creatorId, category_ids: categoryIds.map(Number) };
  const key = stableHash({ endpoint, rest: { ...params, category_ids: categoryIds } });
  const cc = await kaloCreatorsCol();
  const slot = (await cc.findOne({ _id: creatorId }, { projection: { categoryDetails: 1 } }))?.categoryDetails?.[key];
  const stored = slot && { data: slot.data as T, fetchedAt: slot.fetchedAt, credits: creditCost(endpoint), fresh: isFresh(slot.fetchedAt) };
  return reuseOrFetch<T | null>(
    endpoint,
    opts.runId,
    stored ?? null,
    async () => {
      const data = stripContacts((await kaloCall<Record<string, unknown>>(endpoint, body, opts)) ?? {});
      await cc.updateOne(
        { _id: creatorId },
        { $set: { [`categoryDetails.${key}`]: { paramsHash: key, categoryIds, data, fetchedAt: now() }, updatedAt: now() } },
        { upsert: true },
      );
      return data as T;
    },
    `${endpoint} (category)`,
  );
}

// ---------------------------------------------------------------- link video (0.5 credit, hết hạn ~5 phút)

export async function videoUrl(videoId: string, runId?: string | null): Promise<string | null> {
  const vc = await kaloVideosCol();
  const doc = await vc.findOne({ _id: videoId }, { projection: { url: 1, urlExpiresAt: 1 } });
  const endpoint = "/tiktok/video/url";
  if (doc?.url && (doc.urlExpiresAt ?? 0) > now() + 60_000) {
    await logDataCall(runId ?? null, endpoint, 0, true, 0, creditCost(endpoint));
    return doc.url;
  }
  const data = await kaloCall<{ video_url?: string; expires_at?: number | string }>(endpoint, { video_id: videoId }, { runId });
  if (!data?.video_url) return null;
  await saveVideoUrl(videoId, data.video_url, Number(data.expires_at ?? 0) * 1000);
  return data.video_url;
}

export async function saveVideoUrl(videoId: string, url: string, expiresAtMs: number) {
  await (await kaloVideosCol()).updateOne({ _id: videoId }, { $set: { url, urlExpiresAt: expiresAtMs, updatedAt: now() } }, { upsert: true });
}

// ---------------------------------------------------------------- chuyển dữ liệu cũ

/** Nhập 1 response cũ (từ bảng kalo_cache của bản SQLite) vào kho mới — dùng cho script migrate */
export async function importLegacyResponse(path: string, body: Record<string, unknown>, data: unknown, fetchedAt: number) {
  if (path.endsWith("/rank")) return saveRankSnapshot(path, body, (Array.isArray(data) ? data : []) as Record<string, unknown>[], fetchedAt);
  if (path.endsWith("/creator/detail")) return saveDetail("creator", String(body.creator_id), body, (data ?? {}) as Record<string, unknown>, fetchedAt);
  if (path.endsWith("/video/detail")) return saveDetail("video", String(body.video_id), body, (data ?? {}) as Record<string, unknown>, fetchedAt);
  if (path.endsWith("/video/url")) {
    const d = data as { video_url?: string; expires_at?: number };
    if (d?.video_url) return saveVideoUrl(String(body.video_id), d.video_url, Number(d.expires_at ?? 0) * 1000);
  }
}
