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
 *   D. Cùng brief nhưng BẬT dữ liệu chuyên sâu Kalodata (doanh thu theo ngành, chi tiết video, sản phẩm
 *      creator đang bán), xoá ai_cache trước để đo đủ chi phí AI. Bỏ qua bằng --no-deep.
 * Mỗi run A / D có thêm bảng chi phí AI theo từng creator (video = call riêng, text/final = chia đều batch).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PAID_FEATURES, paidCredits, type DeepData } from "../src/lib/brief/paid";
import { funnelFor, getConfig } from "../src/lib/config";
import { aiCacheCol, aiCallsCol, closeDb, creatorsCol, runsCol, tasksCol } from "../src/lib/db";
import { runDetail } from "../src/lib/runs";
import type { CampaignBrief } from "../src/lib/types";

const BRIEF = process.argv.includes("--brief") ? process.argv[process.argv.indexOf("--brief") + 1] : "briefs/sunscreen.json";
const CRASH_AT = process.env.BENCH_CRASH_AT ?? "video_analysis:3";
const DEEP = !process.argv.includes("--no-deep");
const ALL_DEEP: DeepData = { categoryRevenue: true, videoDetail: true, competitorProducts: true };

function discover(args: string[]) {
  const r = spawnSync(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "scripts/discover.ts", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, LOG_EVENTS: "off" },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const latestRunId = async () => (await (await runsCol()).find({}, { projection: { _id: 1 } }).sort({ createdAt: -1 }).limit(1).next())!._id;

async function paidDuplicates(runId: string) {
  // Cùng task bị gọi AI (không cache) > 1 lần = trả tiền 2 lần -> lỗi reliability
  const dups = await (await aiCallsCol())
    .aggregate([
      { $match: { runId, cacheHit: false, ok: true } },
      { $group: { _id: { stage: "$stage", taskKey: "$taskKey" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  return dups.length;
}

/** Credit Kalodata của 1 creator theo bảng giá (khi chưa có dữ liệu lưu): enrich 0.2, video/url 0.5, cộng phần trả phí đã bật */
function creatorCredits(watched: boolean, deep: DeepData | undefined) {
  let cr = 0.2 + (deep?.categoryRevenue ? 0.1 : 0);
  if (watched) cr += 0.5 + (deep?.videoDetail ? 0.2 : 0) + (deep?.competitorProducts ? 0.1 : 0);
  return cr;
}

/**
 * Chi phí AI của từng creator trong 1 run (chỉ call thật, không tính call trúng cache):
 * - video_analysis: 1 call riêng cho mỗi creator -> tính nguyên call.
 * - text_screen / final_rank: 1 call cho batch ≤10 creator -> chia đều chi phí call cho số creator trong batch.
 */
async function perCreatorAi(runId: string, pickedIds: string[], deep: DeepData | undefined) {
  const calls = await (await aiCallsCol()).find({ runId, cacheHit: false }).toArray();
  const tasks = await (await tasksCol())
    .find({ runId, stage: { $in: ["text_screen", "final_rank"] } }, { projection: { stage: 1, key: 1, input: 1 } })
    .toArray();
  const rows = new Map<string, { id: string; text: number; video: number; final: number; videoIn: number; videoCacheRead: number; videoOut: number; images: number }>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { id, text: 0, video: 0, final: 0, videoIn: 0, videoCacheRead: 0, videoOut: 0, images: 0 }));
    return r;
  };
  for (const t of tasks) {
    const ids = (t.input as { ids?: string[] } | null)?.ids ?? [];
    const cost = calls.filter((c) => c.stage === t.stage && c.taskKey === t.key).reduce((s, c) => s + c.costUsd, 0);
    for (const id of ids) row(id)[t.stage === "text_screen" ? "text" : "final"] += cost / ids.length;
  }
  for (const c of calls.filter((x) => x.stage === "video_analysis")) {
    const r = row(c.taskKey);
    r.video += c.costUsd;
    r.videoIn += c.inputTokens;
    r.videoCacheRead += c.cacheReadTokens;
    r.videoOut += c.outputTokens;
    r.images += c.images;
  }
  const docs = await (await creatorsCol()).find({ runId, creatorId: { $in: [...rows.keys()] } }, { projection: { creatorId: 1, handle: 1 } }).toArray();
  const handleOf = new Map(docs.map((d) => [d.creatorId!, d.handle]));
  return [...rows.values()]
    .map((r) => {
      const watched = r.video > 0 || r.final > 0;
      const ai = r.text + r.video + r.final;
      const credits = creatorCredits(watched, deep);
      return { ...r, handle: handleOf.get(r.id) ?? r.id, picked: pickedIds.includes(r.id), watched, ai, credits, totalUsd: ai + credits * 0.1 };
    })
    .sort((a, b) => Number(b.picked) - Number(a.picked) || Number(b.watched) - Number(a.watched) || b.ai - a.ai);
}

async function collect() {
  const cfg = getConfig();
  const brief = JSON.parse(fs.readFileSync(BRIEF, "utf8")) as CampaignBrief;
  if (process.argv.includes("--fresh")) {
    await (await aiCacheCol()).deleteMany({});
    console.log("ai_cache cleared (cold start)");
  }

  // ---- A. cold + crash + resume
  console.log(`A) cold run with simulated crash at ${CRASH_AT} ...`);
  const t0 = Date.now();
  const a1 = discover(["--brief", BRIEF, "--crash-after", CRASH_AT]);
  const runA = await latestRunId();
  const crashed = a1.code !== 0;
  const afterCrash = (await (await runsCol()).findOne({ _id: runA }, { projection: { status: 1, currentStage: 1 } }))!;
  const statusAfterCrash = { status: afterCrash.status, current_stage: afterCrash.currentStage ?? "" };
  const callsBeforeResume = await (await aiCallsCol()).countDocuments({ runId: runA, cacheHit: false });
  console.log(`   crashed=${crashed} (exit ${a1.code}) at stage=${statusAfterCrash.current_stage}, paid calls so far=${callsBeforeResume}`);
  const a2 = discover(["--resume", runA]);
  const wallA = Date.now() - t0;
  if (a2.code !== 0) console.error(a2.out);
  const dA = (await runDetail(runA))!;
  const dupA = await paidDuplicates(runA);
  console.log(`   resumed -> ${dA.run.status}, cost $${dA.usage.total.costUsd.toFixed(4)}, duplicates=${dupA}`);

  // ---- B. warm run (cache reuse)
  console.log("B) warm run (same brief, cache warm) ...");
  const tB = Date.now();
  discover(["--brief", BRIEF]);
  const wallB = Date.now() - tB;
  const runB = await latestRunId();
  const dB = (await runDetail(runB))!;
  console.log(`   ${dB.run.status}, cost $${dB.usage.total.costUsd.toFixed(4)}, cache hits ${dB.usage.total.cacheHits}/${dB.usage.total.calls}`);

  // ---- D. bật dữ liệu chuyên sâu Kalodata (xoá ai_cache trước: dữ liệu thêm làm đổi prompt, đo đủ chi phí AI)
  let runD: null | {
    id: string;
    deep: DeepData;
    estimatedPaidCredits: number;
    wallMs: number;
    activeMs: number;
    usage: NonNullable<Awaited<ReturnType<typeof runDetail>>>["usage"];
    report: NonNullable<Awaited<ReturnType<typeof runDetail>>>["report"];
    perCreator: Awaited<ReturnType<typeof perCreatorAi>>;
    samePicks: boolean;
  } = null;
  if (DEEP) {
    console.log("D) deep data on (category revenue, video detail, products), ai_cache cleared ...");
    await (await aiCacheCol()).deleteMany({});
    const deepBrief = path.join("benchmark", "brief-deep.json");
    fs.mkdirSync("benchmark", { recursive: true });
    fs.writeFileSync(deepBrief, JSON.stringify({ ...brief, deepData: ALL_DEEP }, null, 2));
    const tD = Date.now();
    const d1 = discover(["--brief", deepBrief]);
    const wallD = Date.now() - tD;
    if (d1.code !== 0) console.error(d1.out);
    const idD = await latestRunId();
    const dD = (await runDetail(idD))!;
    const picksD = dD.report?.picks.map((p) => p.id) ?? [];
    runD = {
      id: idD,
      deep: ALL_DEEP,
      estimatedPaidCredits: paidCredits(ALL_DEEP, brief.numKocs),
      wallMs: wallD,
      activeMs: dD.run.activeMs,
      usage: dD.usage,
      report: dD.report,
      perCreator: await perCreatorAi(idD, picksD, ALL_DEEP),
      samePicks: JSON.stringify(picksD) === JSON.stringify(dA.report?.picks.map((p) => p.id)),
    };
    console.log(`   ${dD.run.status}, AI $${dD.usage.total.costUsd.toFixed(4)}, Kalodata ${dD.usage.data.credits.toFixed(2)} credits paid`);
  }
  const perCreatorA = await perCreatorAi(runA, dA.report?.picks.map((p) => p.id) ?? [], brief.deepData);

  // ---- C. projection
  const st = (s: string) => dA.usage.byStage.find((x) => x.stage === s);
  const f = funnelFor(brief.numKocs);
  const r = dA.report!;
  const perText = (st("text_screen")?.costUsd ?? 0) / Math.max(1, r.funnel.textScreened);
  const perVideo = (st("video_analysis")?.costUsd ?? 0) / Math.max(1, r.funnel.videoAnalyzed);
  const perFinal = (st("final_rank")?.costUsd ?? 0) / Math.max(1, r.funnel.finalRanked);
  const avgVideoIn = (st("video_analysis")?.inputTokens ?? 0) / Math.max(1, st("video_analysis")?.calls ?? 1);
  // Credit Kalodata theo bảng giá: rank 0.1/100 dòng (2 nguồn + mỗi keyword), detail+video list 0.2/creator enrich,
  // video url 0.5/creator (chỉ video chính)
  const kw = brief.contentKeywords?.length ?? 0;
  const dataCredits = (fn: ReturnType<typeof funnelFor>) =>
    (2 + kw) * Math.ceil(fn.poolSize / 100) * 0.1 + fn.prefilterKeep * 0.2 + fn.videoKeep * 0.5;
  const projection = [brief.numKocs, 50, 500].map((n) => {
    const fn = funnelFor(n);
    const cost = fn.prefilterKeep * perText + fn.videoKeep * perVideo + fn.videoKeep * perFinal;
    const credits = dataCredits(fn);
    return {
      kocs: n,
      pool: fn.poolSize,
      textScreened: fn.prefilterKeep,
      videoAnalyzed: fn.videoKeep,
      estCostUsd: cost,
      estCostWithBatchApi: cost * 0.5,
      dataCredits: credits,
      totalUsd: cost + credits * 0.1,
    };
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
    runA: { id: runA, crashedAt: statusAfterCrash.current_stage, callsBeforeResume, wallMs: wallA, activeMs: dA.run.activeMs, attempts: dA.run.attempts, duplicates: dupA, usage: dA.usage, stages: dA.stages, report: dA.report, perCreator: perCreatorA },
    runB: { id: runB, wallMs: wallB, activeMs: dB.run.activeMs, usage: dB.usage, samePicks: JSON.stringify(dB.report?.picks.map((p) => p.id)) === JSON.stringify(dA.report?.picks.map((p) => p.id)) },
    runD,
    unitCost: { perTextCreator: perText, perVideoCreator: perVideo, perFinalCreator: perFinal, avgVideoInputTokens: avgVideoIn },
    projection,
    naive: [brief.numKocs, 50, 500].map((n) => ({ kocs: n, estCostUsd: naiveCost(n) })),
  };
  return results;
}

type Results = Awaited<ReturnType<typeof collect>>;

async function main() {
  const results = await collect();
  fs.mkdirSync("benchmark", { recursive: true });
  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync(path.join("benchmark", "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join("docs", "BENCHMARK.md"), renderMarkdown(results));
  console.log("\nWrote benchmark/results.json and docs/BENCHMARK.md");
  await closeDb();
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
  lines.push(`Funnel: pool ${A.report?.funnel.pool} → qua lọc số liệu ${A.report?.funnel.prefilterPassed} → enrich (data API) ${A.report?.funnel.enriched} → text AI ${A.report?.funnel.textScreened} → video AI ${A.report?.funnel.videoAnalyzed} → chấm cuối ${A.report?.funnel.finalRanked} → chọn ${A.report?.funnel.selected}.`, ``);

  const dc = A.usage.data;
  lines.push(`### Chi phí dữ liệu Kalodata (credit, 1 credit ≈ $0.1)`, ``);
  lines.push(`| Endpoint | Calls | Cache hits | Credit trả trong run | Credit tiết kiệm nhờ cache |`, `|---|---|---|---|---|`);
  for (const e of dc.byEndpoint) lines.push(`| ${e.endpoint} | ${e.calls} | ${e.cacheHits} | ${e.credits.toFixed(2)} | ${e.avoided.toFixed(2)} |`);
  lines.push(
    `| **Total** | | | **${dc.credits.toFixed(2)}** | ${dc.avoided.toFixed(2)} |`,
    ``,
    `Chi phí dữ liệu khi chạy lần đầu (chưa có dữ liệu Kalodata lưu sẵn) = **${dc.coldCredits.toFixed(2)} credit ≈ $${(dc.coldCredits * 0.1).toFixed(2)}**. ` +
      `Tổng chi phí 1 lần chạy đầu (chưa có cache AI, chưa có dữ liệu lưu) ≈ AI $${t.costUsd.toFixed(3)} + data $${(dc.coldCredits * 0.1).toFixed(2)} = **$${(t.costUsd + dc.coldCredits * 0.1).toFixed(2)}**.`,
    ``,
  );
  lines.push(`### Chi phí AI theo từng creator (run ${A.id.slice(0, 8)})`, ``);
  lines.push(...perCreatorSection(A.perCreator, t.costUsd, dc.coldCredits, r.brief.numKocs), ``);

  lines.push(`## 3. Khả năng phục hồi`, ``);
  lines.push(`- Run bị kill cứng (\`process.exit\`) tại stage **${A.crashedAt}** sau khi đã trả tiền ${A.callsBeforeResume} AI call.`);
  lines.push(`- Resume ở process mới (lần chạy #${A.attempts}) → hoàn thành, **${A.duplicates} call bị trả tiền 2 lần**.`);
  lines.push(`- Tổng thời gian wall (gồm khởi động 2 process): ${(A.wallMs / 1000).toFixed(1)}s; thời gian xử lý active: ${(A.activeMs / 1000).toFixed(1)}s.`, ``);

  lines.push(`## 4. Tái sử dụng cache (warm run)`, ``);
  lines.push(`Chạy lại cùng brief: ${r.runB.usage.total.cacheHits}/${r.runB.usage.total.calls} call trúng cache, chi phí ${usd(r.runB.usage.total.costUsd)}, active ${(r.runB.activeMs / 1000).toFixed(1)}s, cùng kết quả: ${r.runB.samePicks ? "có" : "không"}.`);
  lines.push(`Phân tích video không phụ thuộc campaign → campaign khác gặp lại creator cũng không trả tiền phần đắt nhất.`, ``);

  lines.push(`## 5. Projection 50–500 KOC`, ``);
  lines.push(`Chi phí đơn vị đo được: text screen ${usd(r.unitCost.perTextCreator)}/creator · video ${usd(r.unitCost.perVideoCreator)}/creator (~${Math.round(r.unitCost.avgVideoInputTokens)} input token/call) · final ${usd(r.unitCost.perFinalCreator)}/creator.`, ``);
  lines.push(
    `| KOC cần tìm | Pool | Enrich + text AI | Video AI | AI (USD) | AI với Batch API (-50%) | Kalodata (credit) | Tổng ≈ USD | Naive AI (video toàn pool, model mạnh) |`,
    `|---|---|---|---|---|---|---|---|---|`,
  );
  r.projection.forEach((p, i) =>
    lines.push(
      `| ${p.kocs} | ${p.pool} | ${p.textScreened} | ${p.videoAnalyzed} | ${usd(p.estCostUsd)} | ${usd(p.estCostWithBatchApi)} | ${p.dataCredits.toFixed(1)} | ${usd(p.totalUsd)} | ${usd(r.naive[i].estCostUsd)} |`,
    ),
  );
  lines.push(``, `Naive = gửi 6 frame full-res cho mỗi video (2 video/creator) của MỌI creator trong pool tới model mạnh nhất, mỗi video 1 call.`, ``);

  if (r.runD) lines.push(...deepSection(r, r.runD));
  return lines.join("\n") + "\n";
}

type PerCreatorRow = Results["runA"]["perCreator"][number];

/** Bảng chi phí AI theo từng creator + cách tính + chi phí bình quân mỗi KOC được chọn */
function perCreatorSection(rows: PerCreatorRow[], totalAiUsd: number, coldCredits: number, numKocs: number): string[] {
  const usd = (x: number) => `$${x.toFixed(4)}`;
  const watched = rows.filter((x) => x.watched);
  const textOnly = rows.filter((x) => !x.watched);
  const avg = (xs: PerCreatorRow[], f: (x: PerCreatorRow) => number) => (xs.length ? xs.reduce((s, x) => s + f(x), 0) / xs.length : 0);
  const out = [
    `Cách tính: **xem video** là 1 call Sonnet riêng cho mỗi creator nên tính nguyên call; **đọc nội dung** (Haiku) và **chấm cuối** (Opus) là 1 call cho tối đa 10 creator nên chi phí call chia đều cho số creator trong batch. Chỉ tính call thật, không tính call trúng cache. Credit Kalodata theo bảng giá khi chưa có dữ liệu lưu: lấy chi tiết 0.2, link video 0.5 cho người được xem video.`,
    ``,
    `| Creator | Được chọn | Đọc nội dung (Haiku) | Xem video (Sonnet) | Token video: input / cache read / output · ảnh | Chấm cuối (Opus) | AI cộng | Kalodata | Tổng ≈ USD |`,
    `|---|---|---|---|---|---|---|---|---|`,
  ];
  for (const x of watched)
    out.push(
      `| @${x.handle} | ${x.picked ? "✅" : "–"} | ${usd(x.text)} | ${usd(x.video)} | ${x.videoIn.toLocaleString("vi-VN")} / ${x.videoCacheRead.toLocaleString("vi-VN")} / ${x.videoOut.toLocaleString("vi-VN")} · ${x.images} | ${usd(x.final)} | **${usd(x.ai)}** | ${x.credits.toFixed(1)} cr | ${usd(x.totalUsd)} |`,
    );
  if (textOnly.length)
    out.push(
      `| ${textOnly.length} creator chỉ qua đọc nội dung (trung bình) | – | ${usd(avg(textOnly, (x) => x.text))} | – | – | – | **${usd(avg(textOnly, (x) => x.ai))}** | ${avg(textOnly, (x) => x.credits).toFixed(1)} cr | ${usd(avg(textOnly, (x) => x.totalUsd))} |`,
    );
  const perPick = totalAiUsd / Math.max(1, numKocs);
  out.push(
    ``,
    `- 1 creator đi hết phễu (đọc nội dung → xem video → chấm cuối): AI trung bình **${usd(avg(watched, (x) => x.ai))}** = đọc ${usd(avg(watched, (x) => x.text))} + video ${usd(avg(watched, (x) => x.video))} + chấm ${usd(avg(watched, (x) => x.final))}; cộng Kalodata ${avg(watched, (x) => x.credits).toFixed(1)} credit ≈ **${usd(avg(watched, (x) => x.totalUsd))}**.`,
    `- 1 creator dừng sau bước đọc nội dung: AI trung bình **${usd(avg(textOnly, (x) => x.ai))}**.`,
    `- Mỗi KOC được chọn gánh luôn phần của người bị loại: AI ${usd(totalAiUsd)} / ${numKocs} = **${usd(perPick)}**; tính cả Kalodata lần chạy đầu ${coldCredits.toFixed(1)} credit thì ≈ **${usd(perPick + (coldCredits * 0.1) / Math.max(1, numKocs))} / KOC**.`,
  );
  return out;
}

/** Mục 6: case bật dữ liệu chuyên sâu Kalodata, so với run A */
function deepSection(r: Results, D: NonNullable<Results["runD"]>): string[] {
  const usd = (x: number) => `$${x.toFixed(4)}`;
  const A = r.runA;
  const tA = A.usage.total;
  const tD = D.usage.total;
  const stage = (u: typeof A.usage, s: string) => u.byStage.find((x) => x.stage === s)?.costUsd ?? 0;
  const firstA = tA.costUsd + A.usage.data.coldCredits * 0.1;
  const firstD = tD.costUsd + D.usage.data.coldCredits * 0.1;
  const on = PAID_FEATURES.filter((f) => D.deep[f.id]);
  const out = [
    `## 6. Case bật dữ liệu chuyên sâu Kalodata (run ${D.id.slice(0, 8)})`,
    ``,
    `Cùng brief, bật cả ${on.length} phần trả phí trên form (ước tính thêm **${D.estimatedPaidCredits} credit** theo bảng giá, được cộng vào trần credit của chiến dịch). Xoá cache AI trước khi chạy vì dữ liệu thêm làm đổi nội dung prompt.`,
    ``,
    ...on.map((f) => `- **${f.title}** (${f.credits(r.brief.numKocs).toFixed(1)} credit): ${f.description}`),
    ``,
    `| | Run A: mặc định | Run D: bật chuyên sâu |`,
    `|---|---|---|`,
    `| AI calls (trúng cache) | ${tA.calls} (${tA.cacheHits}) | ${tD.calls} (${tD.cacheHits}) |`,
    `| Đọc nội dung (Haiku) | ${usd(stage(A.usage, "text_screen"))} | ${usd(stage(D.usage, "text_screen"))} |`,
    `| Xem video (Sonnet) | ${usd(stage(A.usage, "video_analysis"))} | ${usd(stage(D.usage, "video_analysis"))} |`,
    `| Chấm cuối (Opus) | ${usd(stage(A.usage, "final_rank"))} | ${usd(stage(D.usage, "final_rank"))} |`,
    `| **AI tổng** | **${usd(tA.costUsd)}** | **${usd(tD.costUsd)}** |`,
    `| Token input / cache read / output | ${tA.inputTokens} / ${tA.cacheReadTokens} / ${tA.outputTokens} | ${tD.inputTokens} / ${tD.cacheReadTokens} / ${tD.outputTokens} |`,
    `| Kalodata trả trong run | ${A.usage.data.credits.toFixed(2)} credit | ${D.usage.data.credits.toFixed(2)} credit |`,
    `| Kalodata khi chạy lần đầu | ${A.usage.data.coldCredits.toFixed(2)} credit | ${D.usage.data.coldCredits.toFixed(2)} credit |`,
    `| **Tổng 1 lần chạy đầu ≈** | **$${firstA.toFixed(2)}** | **$${firstD.toFixed(2)}** |`,
    `| Thời gian xử lý active | ${(A.activeMs / 1000).toFixed(1)}s | ${(D.activeMs / 1000).toFixed(1)}s |`,
    `| 5 KOC giống run A | – | ${D.samePicks ? "có" : "không"} |`,
    ``,
    `### Kalodata của run D`,
    ``,
    `| Endpoint | Calls | Dùng lại dữ liệu lưu | Credit trả trong run | Credit tiết kiệm nhờ dữ liệu lưu |`,
    `|---|---|---|---|---|`,
    ...D.usage.data.byEndpoint.map((e) => `| ${e.endpoint} | ${e.calls} | ${e.cacheHits} | ${e.credits.toFixed(2)} | ${e.avoided.toFixed(2)} |`),
    ``,
  ];
  if (D.report) {
    const inA = new Set(A.report?.picks.map((p) => p.id));
    out.push(
      `### 5 KOC của run D (chi phí booking ${D.report.totals.estCostVnd.toLocaleString("vi-VN")} ₫ / ${D.report.totals.budgetVnd.toLocaleString("vi-VN")} ₫)`,
      ``,
      `| # | Creator | Final | AI fit | Data | Video | Verdict | Có trong run A |`,
      `|---|---|---|---|---|---|---|---|`,
      ...D.report.picks.map((p) => `| ${p.rank} | @${p.handle} | ${p.scores.final} | ${p.scores.fit} | ${p.scores.data} | ${p.scores.video ?? "–"} | ${p.verdict} | ${inA.has(p.id) ? "có" : "mới"} |`),
      ``,
      `### Chi phí AI theo từng creator (run ${D.id.slice(0, 8)})`,
      ``,
      ...perCreatorSection(D.perCreator, tD.costUsd, D.usage.data.coldCredits, r.brief.numKocs),
      ``,
    );
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
