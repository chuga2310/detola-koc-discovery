/**
 * Tóm tắt từng bước nghiên cứu cho UI: mô tả dễ hiểu + kết quả 1 dòng + danh sách chi tiết.
 *
 * Đọc output đã checkpoint của từng stage (run_stages.output_json) và rút gọn lại để client
 * không phải tải cả trăm KB dữ liệu thô. Stage đã xong thì output không đổi nữa -> memo trong RAM.
 */
import { creatorsCol, runStagesCol } from "./db";
import type { Report } from "./pipeline/stages/select";
import { STAGES } from "./types";

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface StepRow {
  /** Handle TikTok (không có @) */
  handle?: string;
  /** Dòng chính (vd. ngách nội dung, nhận xét) */
  text: string;
  /** Dòng phụ nhỏ hơn */
  note?: string;
  /** Con số bên phải (điểm, follower...) */
  value?: string;
  tone?: "good" | "caution" | "risk";
}

export interface StepSummary {
  stage: string;
  title: string;
  description: string;
  status: StepStatus;
  activeMs: number;
  progress: { done: number; total: number; failed: number };
  /** Kết quả 1 dòng, null khi chưa xong */
  result: string | null;
  facts: { label: string; value: string }[];
  rowsTitle?: string;
  rows: StepRow[];
  /** Bước không tốn AI (lọc bằng code) -> UI ghi chú "Không dùng AI" */
  usesAi: boolean;
}

export const STEP_TEXT: Record<string, { title: string; description: string; usesAi: boolean }> = {
  source: {
    title: "Tìm creator",
    description: "Tìm trên Kalodata theo 5 hướng: người bán hàng tốt, người có tương tác cao trong ngành, người đang làm video về sản phẩm, người đã bán sản phẩm cùng loại, và người đang tăng trưởng.",
    usesAi: false,
  },
  prefilter: {
    title: "Lọc theo số liệu",
    description: "Bỏ người ngoài quy mô follower, chấm điểm theo tương tác, doanh thu, độ liên quan và chi phí ước tính. Giữ nhóm tốt nhất để xem kỹ.",
    usesAi: false,
  },
  enrich: {
    title: "Xem hồ sơ chi tiết",
    description: "Lấy tiểu sử và video gần đây của nhóm được giữ lại.",
    usesAi: false,
  },
  text_screen: {
    title: "Đọc nội dung",
    description: "AI đọc caption và chủ đề video của từng người: hợp sản phẩm không, đúng khách hàng không, có dấu hiệu rủi ro không.",
    usesAi: true,
  },
  media_prep: {
    title: "Chuẩn bị video",
    description: "Với nhóm tốt nhất: lấy lời nói và 6 khung hình từ video tiêu biểu của mỗi người.",
    usesAi: false,
  },
  video_analysis: {
    title: "Xem video bằng AI",
    description: "AI xem khung hình và lời nói: có thoa sản phẩm lên da không, có cận cảnh texture không, chất lượng quay ra sao.",
    usesAi: true,
  },
  final_rank: {
    title: "Chấm điểm và lý do",
    description: "AI chấm độ phù hợp, viết lý do và rủi ro. Mỗi ý phải dẫn đến bằng chứng cụ thể (video, khung hình, số liệu).",
    usesAi: true,
  },
  select: {
    title: "Chọn trong ngân sách",
    description: "Chọn tổ hợp KOC có tổng điểm cao nhất mà tổng chi phí ước tính vẫn nằm trong ngân sách.",
    usesAi: false,
  },
};

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
const trieu = (n: number) => `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`;
const pct = (x: number) => `${Math.round(x * 100)}`;
const VERDICT: Record<string, string> = { strong: "Rất hợp", good: "Phù hợp", weak: "Cân nhắc", reject: "Loại" };
const toneOf = (v: string): StepRow["tone"] => (v === "strong" || v === "good" ? "good" : v === "weak" ? "caution" : "risk");

const DROP_WORDS: [RegExp, string][] = [
  [/^followers/i, "ngoài quy mô follower"],
  [/chi phí ước tính/i, "chi phí vượt 50% ngân sách"],
  [/giới tính/i, "khán giả lệch giới tính"],
  [/ngành hàng/i, "không liên quan ngành hàng"],
  [/30 ngày/i, "không đăng video gần đây"],
  [/shop\/brand/i, "tài khoản của shop/brand"],
  [/livestream/i, "chủ yếu bán qua livestream"],
];
const dropWord = (r: string) => DROP_WORDS.find(([re]) => re.test(r))?.[1] ?? r;

interface PrefilterRow {
  id: string;
  handle: string;
  followers: number;
  estCostVnd: number;
  costTier: string;
  passed: boolean;
  dropReasons: string[];
  dataScore: number;
  raw: { engagementRate?: number; avgViews?: number; keywordVideos?: number; keywordTotal?: number; paidViewShare?: number; videoGpm?: number };
}

/** "105k follower · tương tác 3.2%": bỏ số chưa có (0) thay vì in "0 follower" */
const statLine = (r: PrefilterRow) =>
  [r.followers ? `${k(r.followers)} follower` : null, r.raw.engagementRate ? `tương tác ${(r.raw.engagementRate * 100).toFixed(1)}%` : null]
    .filter(Boolean)
    .join(" · ") || "Chưa có số follower/tương tác";

const memo = new Map<string, Omit<StepSummary, "status" | "activeMs" | "progress">>();

/** Kết quả + chi tiết của 1 stage đã xong */
function describeDone(runId: string, stage: string, out: unknown, all: Map<string, unknown>): Omit<StepSummary, "status" | "activeMs" | "progress"> {
  const key = `${runId}:${stage}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const t = STEP_TEXT[stage];
  const base = { stage, title: t.title, description: t.description, usesAi: t.usesAi, facts: [] as StepSummary["facts"], rows: [] as StepRow[] };
  const pf = all.get("prefilter") as { rows: PrefilterRow[]; keptIds: string[]; stats: { pool: number; passed: number; kept: number; dropReasons: Record<string, number> } } | undefined;
  const handleOf = (id: string) => pf?.rows.find((r) => r.id === id)?.handle ?? id;
  let res: Omit<StepSummary, "status" | "activeMs" | "progress">;

  switch (stage) {
    case "source": {
      const o = out as { ids: string[]; source: string };
      // Số creator theo nguồn: runSteps đọc sẵn từ DB (describeDone giữ đồng bộ)
      const counts = (all.get("__sourceCounts") as Record<string, number> | undefined) ?? {};
      const label: Record<string, string> = {
        commerce: "Bán hàng tốt",
        engagement: "Tương tác cao",
        content: "Đang làm video về sản phẩm",
        proven: "Đã bán sản phẩm cùng loại",
        rising: "Đang tăng trưởng",
      };
      res = {
        ...base,
        result: `Tìm được ${o.ids.length} creator`,
        facts: Object.entries(counts).map(([s, n]) => ({ label: label[s] ?? s, value: `${n} người` })),
        rows: [],
      };
      break;
    }
    case "prefilter": {
      const o = out as NonNullable<typeof pf>;
      const kept = o.keptIds.map((id) => o.rows.find((r) => r.id === id)!).filter(Boolean);
      const grouped: Record<string, number> = {};
      for (const [r, n] of Object.entries(o.stats.dropReasons ?? {})) grouped[dropWord(r)] = (grouped[dropWord(r)] ?? 0) + n;
      const drops = Object.entries(grouped).sort((x, y) => y[1] - x[1]);
      res = {
        ...base,
        result: `Giữ ${o.stats.kept} trong ${o.stats.pool} người để xem kỹ`,
        facts: [
          { label: "Đạt điều kiện", value: `${o.stats.passed} / ${o.stats.pool}` },
          ...drops.slice(0, 3).map(([r, n]) => ({ label: `Loại vì ${r}`, value: `${n}` })),
        ],
        rowsTitle: "Nhóm được giữ, xếp theo điểm số liệu",
        rows: kept.map((r) => ({
          handle: r.handle,
          text: statLine(r),
          note: r.raw.keywordVideos ? `${r.raw.keywordVideos} video có từ khoá sản phẩm` : undefined,
          value: pct(r.dataScore),
        })),
      };
      break;
    }
    case "enrich": {
      const o = out as { rows: PrefilterRow[]; failed: string[] };
      res = {
        ...base,
        result: `Đã có hồ sơ của ${o.rows.length} người${o.failed.length ? `, ${o.failed.length} không lấy được` : ""}`,
        rowsTitle: "Hồ sơ đã lấy",
        rows: o.rows.map((r) => ({
          handle: r.handle,
          text: [
            statLine(r),
            r.raw.avgViews ? `${k(r.raw.avgViews)} view tự nhiên/video` : null,
            r.raw.videoGpm ? `${k(r.raw.videoGpm)} ₫/1.000 view` : null,
            `ước tính ${trieu(r.estCostVnd)}/video`,
          ]
            .filter(Boolean)
            .join(" · "),
          note: !r.passed
            ? `Bị loại: ${r.dropReasons.map(dropWord).join(", ")}`
            : r.raw.paidViewShare !== undefined && r.raw.paidViewShare >= 0.3
              ? `${Math.round(r.raw.paidViewShare * 100)}% view từ quảng cáo (đã trừ khi chấm reach)`
              : undefined,
          value: pct(r.dataScore),
          tone: r.passed ? (r.raw.paidViewShare !== undefined && r.raw.paidViewShare >= 0.5 ? "caution" : undefined) : "risk",
        })),
      };
      break;
    }
    case "text_screen": {
      const o = out as {
        byId: Record<string, { niche: string; summary: string; red_flags: string[]; textScore: number; product_relevance: number; audience_fit: number }>;
      };
      const list = Object.entries(o.byId).sort((a, b) => b[1].textScore - a[1].textScore);
      const relevant = list.filter(([, v]) => v.product_relevance >= 6).length;
      const audience = list.filter(([, v]) => v.audience_fit >= 6).length;
      res = {
        ...base,
        result: `Đọc nội dung của ${list.length} người · ${relevant} người đã làm nội dung gần với sản phẩm`,
        facts: [
          { label: "Gần với sản phẩm", value: `${relevant} người` },
          { label: "Đúng khách hàng mục tiêu", value: `${audience} người` },
        ],
        rowsTitle: "Nhận xét của AI, xếp theo độ hợp nội dung",
        rows: list.map(([id, v]) => ({
          handle: handleOf(id),
          text: v.niche,
          note: v.summary,
          value: pct(v.textScore),
          tone: v.red_flags.length >= 3 ? "caution" : undefined,
        })),
      };
      break;
    }
    case "media_prep": {
      const o = out as { byId: Record<string, { transcript?: string | null; frameTimes?: number[] }[]> };
      const list = Object.entries(o.byId);
      const videos = list.reduce((s, [, v]) => s + v.length, 0);
      const withVoice = list.reduce((s, [, v]) => s + v.filter((x) => x.transcript && x.transcript.length > 20).length, 0);
      res = {
        ...base,
        result: `${videos} video của ${list.length} người · ${withVoice} video có lời nói`,
        rows: list.map(([id, v]) => ({
          handle: handleOf(id),
          text: `${v.length} video · ${v.reduce((s, x) => s + (x.frameTimes?.length ?? 0), 0)} khung hình`,
          note: v.some((x) => x.transcript && x.transcript.length > 20) ? "Có lời nói" : "Không có lời nói, AI chỉ xem hình",
        })),
      };
      break;
    }
    case "video_analysis": {
      const o = out as {
        byId: Record<string, { videoScore: number; analysis: { videos: { applies_on_skin: boolean; shows_texture: boolean; on_camera: string; production_quality: number }[] } }>;
      };
      const list = Object.entries(o.byId).sort((a, b) => b[1].videoScore - a[1].videoScore);
      const onSkin = list.filter(([, v]) => v.analysis.videos.some((x) => x.applies_on_skin)).length;
      res = {
        ...base,
        result: `Xem video của ${list.length} người · ${onSkin} người có thoa sản phẩm lên da`,
        rowsTitle: "Điều AI thấy trong video",
        rows: list.map(([id, v]) => {
          const vs = v.analysis.videos;
          const tags = [
            vs.some((x) => x.applies_on_skin) && "Thoa lên da",
            vs.some((x) => x.shows_texture) && "Cận texture",
            vs.some((x) => x.on_camera === "face_to_camera") && "Nói trước camera",
          ].filter(Boolean) as string[];
          const q = vs.length ? vs.reduce((s, x) => s + x.production_quality, 0) / vs.length : 0;
          return {
            handle: handleOf(id),
            text: tags.length ? tags.join(" · ") : "Chưa thấy demo sản phẩm",
            note: `Chất lượng quay ${q.toFixed(1)}/5`,
            value: pct(v.videoScore),
            tone: tags.length ? undefined : "caution",
          };
        }),
      };
      break;
    }
    case "final_rank": {
      const o = out as { byId: Record<string, { fit_score: number; verdict: string; headline: string }> };
      const list = Object.entries(o.byId).sort((a, b) => b[1].fit_score - a[1].fit_score);
      const good = list.filter(([, v]) => v.verdict === "strong" || v.verdict === "good").length;
      res = {
        ...base,
        result: `Chấm ${list.length} người · ${good} người được đánh giá phù hợp trở lên`,
        rowsTitle: "Điểm phù hợp và nhận định",
        rows: list.map(([id, v]) => ({
          handle: handleOf(id),
          text: v.headline,
          note: VERDICT[v.verdict] ?? v.verdict,
          value: String(v.fit_score),
          tone: toneOf(v.verdict),
        })),
      };
      break;
    }
    case "select": {
      const o = out as Report;
      res = {
        ...base,
        result: `Chọn ${o.picks.length} KOC · ${trieu(o.totals.estCostVnd)} / ${trieu(o.totals.budgetVnd)}`,
        facts: [
          { label: "Tổng chi phí ước tính", value: trieu(o.totals.estCostVnd) },
          { label: "Còn lại", value: trieu(Math.max(0, o.totals.budgetVnd - o.totals.estCostVnd)) },
        ],
        rows: o.picks.map((p) => ({ handle: p.handle, text: p.headline, value: trieu(p.estCostVnd), tone: toneOf(p.verdict) })),
      };
      break;
    }
    default:
      res = { ...base, result: null, rows: [] };
  }
  memo.set(key, res);
  return res;
}

export async function runSteps(
  runId: string,
  runStatus: string,
  currentStage: string | null,
  stages: { stage: string; status: string; activeMs: number; tasks: { total: number; done: number; failed: number } }[],
): Promise<StepSummary[]> {
  const rows = await (await runStagesCol()).find({ runId, status: "done" }, { projection: { stage: 1, output: 1 } }).toArray();
  const outputs = new Map<string, unknown>(rows.map((r) => [r.stage, r.output]));
  const src = outputs.get("source") as { ids?: string[] } | undefined;
  if (src?.ids?.length && !memo.has(`${runId}:source`)) {
    const counts: Record<string, number> = {};
    const docs = await (await creatorsCol()).find({ _id: { $in: src.ids } }, { projection: { "data.sources": 1 } }).toArray();
    for (const d of docs) for (const t of d.data?.sources ?? []) counts[t] = (counts[t] ?? 0) + 1;
    outputs.set("__sourceCounts", counts);
  }
  return STAGES.map((stage) => {
    const s = stages.find((x) => x.stage === stage)!;
    const t = STEP_TEXT[stage];
    const live = currentStage === stage && runStatus === "running";
    const status: StepStatus =
      s.status === "done" ? "done" : live ? "running" : currentStage === stage && runStatus === "failed" ? "failed" : "pending";
    const progress = { done: s.tasks.done, total: s.tasks.total, failed: s.tasks.failed };
    if (status === "done" && outputs.get(stage)) {
      return { ...describeDone(runId, stage, outputs.get(stage), outputs), status, activeMs: s.activeMs, progress };
    }
    return { stage, title: t.title, description: t.description, usesAi: t.usesAi, status, activeMs: s.activeMs, progress, result: null, facts: [], rows: [] };
  });
}
