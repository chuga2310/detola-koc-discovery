/**
 * Benchmark end-to-end, xuất docs/BENCHMARK.md + benchmark/results.json
 *
 *   npm run benchmark                 # dùng provider theo env (anthropic nếu có key)
 *   npm run benchmark -- --fresh      # xoá ai_cache trước (đo cold cache thật)
 *
 * Kịch bản:
 *   A. Cold run nhưng bị "kill" cứng giữa stage video_analysis (process.exit) -> resume ở process mới.
 *      Đo: tổng chi phí, số call, số call bị trả tiền 2 lần (phải = 0), thời gian active.
 *   B. Warm run: cùng brief, chạy lại -> mọi call AI trúng cache -> chi phí ~0 (tái sử dụng).
 *   C. Projection 50 / 500 KOC từ chi phí đo được trên từng đơn vị (per creator / per batch).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { funnelFor, getConfig } from "../src/lib/config";
import { db } from "../src/lib/db";
import { runDetail } from "../src/lib/runs";
import type { CampaignBrief } from "../src/lib/types";

const BRIEF = process.argv.includes("--brief") ? process.argv[process.argv.indexOf("--brief") + 1] : "briefs/sunscreen.json";
const CRASH_AT = process.env.BENCH_CRASH_AT ?? "video_analysis:3";

function discover(args: string[]) {
  const r = spawnSync(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "scripts/discover.ts", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, LOG_EVENTS: "off" },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const latestRunId = () => (db().prepare("SELECT id FROM runs ORDER BY created_at DESC LIMIT 1").get() as { id: string }).id;

function paidDuplicates(runId: string) {
  // Cùng task bị gọi AI (không cache) > 1 lần = trả tiền 2 lần -> lỗi reliability
  return (
    db()
      .prepare("SELECT stage, task_key, COUNT(*) n FROM ai_calls WHERE run_id = ? AND cache_hit = 0 GROUP BY stage, task_key HAVING n > 1")
      .all(runId) as { stage: string; task_key: string; n: number }[]
  ).length;
}

function collect() {
  const cfg = getConfig();
  const brief = JSON.parse(fs.readFileSync(BRIEF, "utf8")) as CampaignBrief;
  if (process.argv.includes("--fresh")) {
    db().prepare("DELETE FROM ai_cache").run();
    console.log("ai_cache cleared (cold start)");
  }

  // ---- A. cold + crash + resume
  console.log(`A) cold run with simulated crash at ${CRASH_AT} ...`);
  const t0 = Date.now();
  const a1 = discover(["--brief", BRIEF, "--crash-after", CRASH_AT]);
  const runA = latestRunId();
  const crashed = a1.code !== 0;
  const statusAfterCrash = (db().prepare("SELECT status, current_stage FROM runs WHERE id = ?").get(runA) as { status: string; current_stage: string });
  const callsBeforeResume = (db().prepare("SELECT COUNT(*) n FROM ai_calls WHERE run_id = ? AND cache_hit = 0").get(runA) as { n: number }).n;
  console.log(`   crashed=${crashed} (exit ${a1.code}) at stage=${statusAfterCrash.current_stage}, paid calls so far=${callsBeforeResume}`);
  const a2 = discover(["--resume", runA]);
  const wallA = Date.now() - t0;
  if (a2.code !== 0) console.error(a2.out);
  const dA = runDetail(runA)!;
  const dupA = paidDuplicates(runA);
  console.log(`   resumed -> ${dA.run.status}, cost $${dA.usage.total.costUsd.toFixed(4)}, duplicates=${dupA}`);

  // ---- B. warm run (cache reuse)
  console.log("B) warm run (same brief, cache warm) ...");
  const tB = Date.now();
  discover(["--brief", BRIEF]);
  const wallB = Date.now() - tB;
  const runB = latestRunId();
  const dB = runDetail(runB)!;
  console.log(`   ${dB.run.status}, cost $${dB.usage.total.costUsd.toFixed(4)}, cache hits ${dB.usage.total.cacheHits}/${dB.usage.total.calls}`);

  // ---- C. projection
  const st = (s: string) => dA.usage.byStage.find((x) => x.stage === s);
  const f = funnelFor(brief.numKocs);
  const r = dA.report!;
  const perText = (st("text_screen")?.costUsd ?? 0) / Math.max(1, r.funnel.textScreened);
  const perVideo = (st("video_analysis")?.costUsd ?? 0) / Math.max(1, r.funnel.videoAnalyzed);
  const perFinal = (st("final_rank")?.costUsd ?? 0) / Math.max(1, r.funnel.finalRanked);
  const avgVideoIn = (st("video_analysis")?.inputTokens ?? 0) / Math.max(1, st("video_analysis")?.calls ?? 1);
  const projection = [brief.numKocs, 50, 500].map((n) => {
    const fn = funnelFor(n);
    const cost = fn.prefilterKeep * perText + fn.videoKeep * perVideo + fn.videoKeep * perFinal;
    return { kocs: n, pool: fn.poolSize, textScreened: fn.prefilterKeep, videoAnalyzed: fn.videoKeep, estCostUsd: cost, estCostWithBatchApi: cost * 0.5 };
  });
  // Baseline "naive": phân tích video MỌI creator trong pool bằng model final, mỗi video 1 call, 6 frame full-res (~1.6k token/frame)
  const naivePerVideoTokens = 6 * 1600 + 1500;
  const naiveCost = (n: number) => {
    const fn = funnelFor(n);
    return fn.poolSize * 2 * ((naivePerVideoTokens * 4 + 800 * 20) / 1e6); // Opus 5.5: $4 in / $20 out
  };

  const results = {
    generatedAt: new Date().toISOString(),
    provider: cfg.provider,
    models: cfg.models,
    dataSource: cfg.dataSource,
    brief,
    funnel: f,
    runA: { id: runA, crashedAt: statusAfterCrash.current_stage, callsBeforeResume, wallMs: wallA, activeMs: dA.run.activeMs, attempts: dA.run.attempts, duplicates: dupA, usage: dA.usage, stages: dA.stages, report: dA.report },
    runB: { id: runB, wallMs: wallB, activeMs: dB.run.activeMs, usage: dB.usage, samePicks: JSON.stringify(dB.report?.picks.map((p) => p.id)) === JSON.stringify(dA.report?.picks.map((p) => p.id)) },
    unitCost: { perTextCreator: perText, perVideoCreator: perVideo, perFinalCreator: perFinal, avgVideoInputTokens: avgVideoIn },
    projection,
    naive: [brief.numKocs, 50, 500].map((n) => ({ kocs: n, estCostUsd: naiveCost(n) })),
  };
  return results;
}

type Results = ReturnType<typeof collect>;

function main() {
  const results = collect();
  fs.mkdirSync("benchmark", { recursive: true });
  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync(path.join("benchmark", "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join("docs", "BENCHMARK.md"), renderMarkdown(results));
  console.log("\nWrote benchmark/results.json and docs/BENCHMARK.md");
}

function renderMarkdown(r: Results): string {
  const A = r.runA;
  const usd = (x: number) => `$${x.toFixed(4)}`;
  const vnd = (x: number) => `${Math.round(x * getConfig().usdToVnd).toLocaleString("vi-VN")} ₫`;
  const lines: string[] = [];
  lines.push(`# Benchmark`, ``);
  lines.push(`> Sinh tự động bởi \`npm run benchmark\` lúc ${r.generatedAt}. Provider **${r.provider}**, data **${r.dataSource}**.`);
  if (r.provider === "mock") lines.push(`>`, `> ⚠️ Chạy ở chế độ MOCK: token là ước lượng, chi phí = 0, nội dung đánh giá là giả lập. Chạy lại với ANTHROPIC_API_KEY để có số thật.`);
  lines.push(``, `Models: screen=\`${r.models.screen}\`, video=\`${r.models.video}\`, final=\`${r.models.final}\``, ``);

  lines.push(`## 1. Kết quả 5 KOC`, ``);
  if (A.report) {
    lines.push(`Chi phí booking ước tính: **${A.report.totals.estCostVnd.toLocaleString("vi-VN")} ₫ / ${A.report.totals.budgetVnd.toLocaleString("vi-VN")} ₫** (optimizer: ${A.report.totals.method})`, ``);
    lines.push(`| # | Creator | Followers | Est. cost | Final | AI fit | Data | Video | Verdict |`, `|---|---|---|---|---|---|---|---|---|`);
    for (const p of A.report.picks)
      lines.push(`| ${p.rank} | [@${p.handle}](${p.profileUrl}) | ${p.followers.toLocaleString("vi-VN")} | ${p.estCostVnd.toLocaleString("vi-VN")} | ${p.scores.final} | ${p.scores.fit} | ${p.scores.data} | ${p.scores.video ?? "–"} | ${p.verdict} |`);
    lines.push(``);
    for (const p of A.report.picks) {
      lines.push(`### #${p.rank} @${p.handle} — ${p.headline}`, ``);
      for (const x of p.reasons) lines.push(`- ✅ ${x.text}`, ...x.evidence.map((e) => `  - \`${e.id}\` ${e.text}`));
      for (const x of p.risks) lines.push(`- ⚠️ ${x.text}`, ...x.evidence.map((e) => `  - \`${e.id}\` ${e.text}`));
      lines.push(`- 💡 Concept gợi ý: ${p.suggestedAngle}`, ``);
    }
  }

  lines.push(`## 2. Token / chi phí / thời gian (run ${A.id.slice(0, 8)})`, ``);
  lines.push(`| Stage | Calls | Cache hits | Input | Cache read | Cache write | Output | Images | USD | Active time |`, `|---|---|---|---|---|---|---|---|---|---|`);
  for (const s of A.stages) {
    const u = A.usage.byStage.find((x) => x.stage === s.stage);
    lines.push(`| ${s.stage} | ${u?.calls ?? 0} | ${u?.cacheHits ?? 0} | ${u?.inputTokens ?? 0} | ${u?.cacheReadTokens ?? 0} | ${u?.cacheWriteTokens ?? 0} | ${u?.outputTokens ?? 0} | ${u?.images ?? 0} | ${usd(u?.costUsd ?? 0)} | ${(s.activeMs / 1000).toFixed(1)}s |`);
  }
  const t = A.usage.total;
  lines.push(`| **Total** | **${t.calls}** | ${t.cacheHits} | ${t.inputTokens} | ${t.cacheReadTokens} | ${t.cacheWriteTokens} | ${t.outputTokens} | ${t.images} | **${usd(t.costUsd)}** (${vnd(t.costUsd)}) | **${(A.activeMs / 1000).toFixed(1)}s** |`, ``);
  lines.push(`Funnel: pool ${A.report?.funnel.pool} → qua lọc số liệu ${A.report?.funnel.prefilterPassed} → text AI ${A.report?.funnel.textScreened} → video AI ${A.report?.funnel.videoAnalyzed} → chấm cuối ${A.report?.funnel.finalRanked} → chọn ${A.report?.funnel.selected}.`, ``);

  lines.push(`## 3. Khả năng phục hồi`, ``);
  lines.push(`- Run bị kill cứng (\`process.exit\`) tại stage **${A.crashedAt}** sau khi đã trả tiền ${A.callsBeforeResume} AI call.`);
  lines.push(`- Resume ở process mới (lần chạy #${A.attempts}) → hoàn thành, **${A.duplicates} call bị trả tiền 2 lần**.`);
  lines.push(`- Tổng thời gian wall (gồm khởi động 2 process): ${(A.wallMs / 1000).toFixed(1)}s; thời gian xử lý active: ${(A.activeMs / 1000).toFixed(1)}s.`, ``);

  lines.push(`## 4. Tái sử dụng cache (warm run)`, ``);
  lines.push(`Chạy lại cùng brief: ${r.runB.usage.total.cacheHits}/${r.runB.usage.total.calls} call trúng cache, chi phí ${usd(r.runB.usage.total.costUsd)}, active ${(r.runB.activeMs / 1000).toFixed(1)}s, cùng kết quả: ${r.runB.samePicks ? "có" : "không"}.`);
  lines.push(`Phân tích video không phụ thuộc campaign → campaign khác gặp lại creator cũng không trả tiền phần đắt nhất.`, ``);

  lines.push(`## 5. Projection 50–500 KOC`, ``);
  lines.push(`Chi phí đơn vị đo được: text screen ${usd(r.unitCost.perTextCreator)}/creator · video ${usd(r.unitCost.perVideoCreator)}/creator (~${Math.round(r.unitCost.avgVideoInputTokens)} input token/call) · final ${usd(r.unitCost.perFinalCreator)}/creator.`, ``);
  lines.push(`| KOC cần tìm | Pool | Text AI | Video AI | Ước tính USD | Với Batch API (-50%) | Naive (video AI toàn pool bằng model mạnh) |`, `|---|---|---|---|---|---|---|`);
  r.projection.forEach((p, i) =>
    lines.push(`| ${p.kocs} | ${p.pool} | ${p.textScreened} | ${p.videoAnalyzed} | ${usd(p.estCostUsd)} | ${usd(p.estCostWithBatchApi)} | ${usd(r.naive[i].estCostUsd)} |`),
  );
  lines.push(``, `Naive = gửi 6 frame full-res cho mỗi video (2 video/creator) của MỌI creator trong pool tới model mạnh nhất, mỗi video 1 call.`);
  return lines.join("\n") + "\n";
}

main();
