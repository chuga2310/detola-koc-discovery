import fs from "node:fs";
import path from "node:path";
import { BriefForm } from "@/components/BriefForm";
import { RunsList } from "@/components/RunsList";
import { getConfig } from "@/lib/config";
import type { CampaignBrief } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Home() {
  const defaultBrief = JSON.parse(fs.readFileSync(path.join(process.cwd(), "briefs", "sunscreen.json"), "utf8")) as CampaignBrief;
  const cfg = getConfig();
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="card p-5">
        <h1 className="text-lg font-semibold">Brief chiến dịch</h1>
        <p className="mt-1 text-sm text-muted">
          Provider <b className="text-ink">{cfg.provider}</b> · data <b className="text-ink">{cfg.dataSource}</b> · models{" "}
          <span className="num text-xs">{cfg.models.screen} / {cfg.models.video} / {cfg.models.final}</span>
          {cfg.provider === "mock" && (
            <span className="mt-2 block rounded bg-amber-50 px-2 py-1 text-amber-800">
              Chưa có API key → đang ở chế độ MOCK (kết quả giả lập để demo flow). Thêm ANTHROPIC_API_KEY vào .env.local.
            </span>
          )}
        </p>
        <BriefForm initial={defaultBrief} />
      </section>
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Các lần chạy</h2>
        <RunsList />
      </section>
    </div>
  );
}
