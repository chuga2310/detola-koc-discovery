/**
 * Fixture source: data MẪU (synthetic) để chạy offline / test, sinh bởi
 * `npm run gen:fixtures`. Handle có tiền tố `demo_` để không nhầm với creator thật.
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config";
import type { CreatorRecord } from "../types";
import type { DataSource, SourceQuery } from "./index";

export const fixtureSource: DataSource = {
  name: "fixture",
  async search({ brief, limit }: SourceQuery) {
    const file = path.join(getConfig().paths.fixtures, "creators.sample.json");
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run: npm run gen:fixtures`);
    const all = JSON.parse(fs.readFileSync(file, "utf8")) as CreatorRecord[];
    const range = brief.followerRange;
    return all
      .filter((c) => !range || (c.followers >= range.min * 0.5 && c.followers <= range.max * 2))
      .sort((a, b) => (b.metrics.videoViews ?? 0) - (a.metrics.videoViews ?? 0))
      .slice(0, limit);
  },
  // Fixture đã đầy đủ dữ liệu -> enrich không làm gì
  enrich: async (c) => ({ ...c, enriched: true }),
};
