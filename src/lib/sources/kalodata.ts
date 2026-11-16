/**
 * Kalodata source.
 *
 * Kalodata không có public API cho tài khoản thường, và web app có lớp anti-bot
 * (URL bị obfuscate, gọi server-to-server dễ bị chặn). Vì vậy thiết kế 2 bước:
 *
 *   1. COLLECT (trong browser đã login): `scripts/kalodata-collector.js` chạy trong tab
 *      kalodata.com, gọi chính các endpoint nội bộ của web (`/creator/queryList`, ...)
 *      bằng session hiện tại -> xuất 1 file snapshot JSON.
 *   2. IMPORT (server): đọc snapshot trong data/kalodata/*.json -> map về CreatorRecord.
 *
 * Ưu điểm: không lưu mật khẩu/cookie trong backend, không vượt anti-bot, snapshot
 * có version -> benchmark tái lập được. Production: thay bước 1 bằng Kalodata API
 * (gói enterprise) hoặc worker Playwright có session riêng — interface DataSource giữ nguyên.
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config";
import type { CreatorRecord, CreatorVideo } from "../types";
import type { DataSource, SourceQuery } from "./index";

export interface KalodataSnapshot {
  source: "kalodata";
  collectedAt: string;
  region: string;
  filters?: unknown;
  creators: KalodataCreatorRaw[];
}

/** Dữ liệu thô của 1 creator trong snapshot (field theo Kalodata, đã được collector làm phẳng) */
export interface KalodataCreatorRaw {
  id: string;
  handle: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
  followers?: number;
  revenue?: number;
  itemsSold?: number;
  videoViews?: number;
  videoCount?: number;
  liveCount?: number;
  engagementRate?: number;
  followerChange?: number;
  femaleRatio?: number;
  ageDistribution?: Record<string, number>;
  categories?: { name: string; share: number }[];
  products?: { title: string; category?: string; price?: number }[];
  videos?: {
    id: string;
    title?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    publishTime?: string;
    duration?: number;
    revenue?: number;
    cover?: string;
    productTitle?: string;
  }[];
  hasContact?: boolean;
  /** Payload gốc từ API để audit / map thêm field sau này */
  raw?: unknown;
}

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

export function mapKalodataCreator(r: KalodataCreatorRaw, region = "VN"): CreatorRecord {
  const videos: CreatorVideo[] = (r.videos ?? []).map((v) => ({
    id: v.id,
    url: `https://www.tiktok.com/@${r.handle}/video/${v.id}`,
    caption: v.title ?? "",
    hashtags: (v.title ?? "").match(HASHTAG_RE)?.map((h) => h.slice(1)) ?? [],
    views: v.views ?? 0,
    likes: v.likes ?? 0,
    comments: v.comments ?? 0,
    shares: v.shares ?? 0,
    publishedAt: v.publishTime,
    durationSec: v.duration,
    revenueVnd: v.revenue,
    coverUrl: v.cover,
    productTitle: v.productTitle,
  }));
  const totalShare = (r.categories ?? []).reduce((s, c) => s + c.share, 0) || 1;
  return {
    id: r.id,
    handle: r.handle,
    nickname: r.nickname ?? r.handle,
    avatarUrl: r.avatar,
    bio: r.bio,
    followers: r.followers ?? 0,
    region,
    source: "kalodata",
    metrics: {
      revenueVnd: r.revenue,
      itemsSold: r.itemsSold,
      videoViews: r.videoViews,
      videoCount: r.videoCount,
      liveCount: r.liveCount,
      avgViewsPerVideo: r.videoViews && r.videoCount ? r.videoViews / r.videoCount : undefined,
      engagementRate: r.engagementRate,
      followerGrowth: r.followerChange,
    },
    audience:
      r.femaleRatio !== undefined || r.ageDistribution
        ? { femalePct: r.femaleRatio, ageBuckets: r.ageDistribution }
        : undefined,
    categories: (r.categories ?? []).map((c) => ({ name: c.name, share: c.share / (totalShare > 1.5 ? totalShare : 1) })),
    topProducts: (r.products ?? []).map((p) => ({ title: p.title, category: p.category, priceVnd: p.price })),
    videos,
    hasContact: r.hasContact,
  };
}

export function loadSnapshots(): CreatorRecord[] {
  const dir = getConfig().paths.kalodataSnapshots;
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort(); // file mới hơn (tên theo ngày) ghi đè file cũ
  const byId = new Map<string, CreatorRecord>();
  for (const f of files) {
    const snap = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as KalodataSnapshot;
    for (const raw of snap.creators ?? []) byId.set(raw.id, mapKalodataCreator(raw, snap.region ?? "VN"));
  }
  return [...byId.values()];
}

export const kalodataSource: DataSource = {
  name: "kalodata",
  async search({ brief, limit }: SourceQuery) {
    const all = loadSnapshots();
    if (!all.length)
      throw new Error(
        `No Kalodata snapshot in ${getConfig().paths.kalodataSnapshots}. Run scripts/kalodata-collector.js in a logged-in Kalodata tab, or set DATA_SOURCE=fixture.`,
      );
    const range = brief.followerRange;
    // "Push-down filter": snapshot đã được collector query theo ngành hàng; ở đây chỉ
    // giới hạn follower gần khoảng mục tiêu (nới x0.5 / x2 để prefilter còn thấy biên).
    return all
      .filter((c) => !range || (c.followers >= range.min * 0.5 && c.followers <= range.max * 2))
      .sort((a, b) => (b.metrics.revenueVnd ?? 0) - (a.metrics.revenueVnd ?? 0))
      .slice(0, limit);
  },
};
