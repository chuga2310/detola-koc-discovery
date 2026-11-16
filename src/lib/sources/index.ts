/**
 * Data source abstraction.
 *
 * - search(): trả về pool creator ứng viên (dữ liệu list-level, rẻ). Filter "rẻ" (region, ngành hàng,
 *   khoảng follower, loại tài khoản) được đẩy xuống nguồn dữ liệu — như query DB có WHERE.
 * - enrich(): bổ sung dữ liệu chi tiết (bio, video gần đây...) cho 1 creator. Chỉ gọi cho creator
 *   đã qua prefilter (lazy enrichment) vì mỗi call detail tốn phí.
 */
import { getConfig } from "../config";
import type { CampaignBrief, CreatorRecord } from "../types";
import { fixtureSource } from "./fixture";
import { kalodataSource } from "./kalodata";

export interface SourceQuery {
  brief: CampaignBrief;
  limit: number;
  runId?: string | null;
}

export interface DataSource {
  name: string;
  search(q: SourceQuery): Promise<CreatorRecord[]>;
  enrich(c: CreatorRecord, ctx: { brief: CampaignBrief; runId?: string | null }): Promise<CreatorRecord>;
}

export function getDataSource(name?: string): DataSource {
  const n = name ?? getConfig().dataSource;
  return n === "fixture" ? fixtureSource : kalodataSource;
}
