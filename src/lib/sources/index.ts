/**
 * Data source abstraction.
 *
 * `search()` trả về pool creator ứng viên đã chuẩn hoá. Filter "rẻ" (region, category,
 * follower range) được đẩy xuống nguồn dữ liệu càng nhiều càng tốt — giống như query DB
 * có WHERE thay vì kéo hết về rồi lọc.
 */
import { getConfig } from "../config";
import type { CampaignBrief, CreatorRecord } from "../types";
import { fixtureSource } from "./fixture";
import { kalodataSource } from "./kalodata";

export interface SourceQuery {
  brief: CampaignBrief;
  limit: number;
}

export interface DataSource {
  name: string;
  search(q: SourceQuery): Promise<CreatorRecord[]>;
}

export function getDataSource(name?: string): DataSource {
  const n = name ?? getConfig().dataSource;
  return n === "fixture" ? fixtureSource : kalodataSource;
}
