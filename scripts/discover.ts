/**
 * CLI chạy pipeline (không cần mở web).
 *
 *   npm run discover -- --brief briefs/sunscreen.json
 *   npm run discover -- --brief briefs/sunscreen.json --crash-after video_analysis:3   # giả lập crash
 *   npm run discover -- --resume <runId>                                              # chạy tiếp
 *   npm run discover -- --list
 */
import fs from "node:fs";
import { getConfig } from "../src/lib/config";
import { createRun, markStaleRuns, runPipeline } from "../src/lib/pipeline/runner";
import { listRuns, runDetail } from "../src/lib/runs";
import type { CampaignBrief, StageName } from "../src/lib/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cfg = getConfig();
  if (process.argv.includes("--list")) {
    markStaleRuns();
    for (const r of listRuns()) console.log(`${r.id}  ${r.status.padEnd(11)} ${r.currentStage ?? "-"}  $${r.costUsd.toFixed(4)}  ${new Date(r.createdAt).toISOString()}`);
    return;
  }

  let runId = arg("resume");
  if (!runId) {
    const briefPath = arg("brief") ?? "briefs/sunscreen.json";
    const brief = JSON.parse(fs.readFileSync(briefPath, "utf8")) as CampaignBrief;
    runId = createRun(brief);
  } else {
    markStaleRuns();
  }
  console.log(`\nRun ${runId}  provider=${cfg.provider} models=${JSON.stringify(cfg.models)} source=${cfg.dataSource}\n`);

  const crash = arg("crash-after");
  const crashAfter = crash ? { stage: crash.split(":")[0] as StageName, tasks: Number(crash.split(":")[1] ?? 1) } : undefined;

  const t0 = Date.now();
  const status = await runPipeline(runId, { crashAfter });
  const wall = Date.now() - t0;
  const d = runDetail(runId)!;

  console.log(`\nStatus: ${status}   wall (this process): ${(wall / 1000).toFixed(1)}s   active total: ${(d.run.activeMs / 1000).toFixed(1)}s`);
  console.log(`AI: ${d.usage.total.calls} calls (${d.usage.total.cacheHits} cache hits), in ${d.usage.total.inputTokens} / out ${d.usage.total.outputTokens} / cache-read ${d.usage.total.cacheReadTokens} tokens, ${d.usage.total.images} images, $${d.usage.total.costUsd.toFixed(4)} (~${d.usage.costVnd.toLocaleString("vi-VN")} VND)`);
  for (const s of d.usage.byStage)
    console.log(`  ${s.stage.padEnd(15)} calls=${s.calls} hits=${s.cacheHits} in=${s.inputTokens} out=${s.outputTokens} cr=${s.cacheReadTokens} img=${s.images} $${s.costUsd.toFixed(4)}`);

  if (d.report) {
    console.log(`\nTop ${d.report.picks.length} KOC (est. ${d.report.totals.estCostVnd.toLocaleString("vi-VN")} / ${d.report.totals.budgetVnd.toLocaleString("vi-VN")} VND):`);
    for (const p of d.report.picks) {
      console.log(`  #${p.rank} @${p.handle}  ${p.followers.toLocaleString()} fl  final=${p.scores.final} fit=${p.scores.fit} data=${p.scores.data} video=${p.scores.video ?? "-"}  cost=${p.estCostVnd.toLocaleString("vi-VN")}`);
      console.log(`      ${p.headline}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
