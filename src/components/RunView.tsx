"use client";

import { useCallback, useEffect, useState } from "react";
import type { Report } from "@/lib/pipeline/stages/select";
import type { StageUsage } from "@/lib/runs";
import { KocCard } from "./KocCard";
import { compact, StatusBadge, vnd } from "./ui";

interface Detail {
  run: {
    id: string;
    status: string;
    currentStage: string | null;
    error: string | null;
    activeMs: number;
    attempts: number;
    brief: Report["brief"];
    config: { provider: string; models: Record<string, string>; dataSource: string };
  };
  stages: { stage: string; status: string; activeMs: number; tasks: { total: number; done: number; failed: number; running: number } }[];
  usage: {
    byStage: StageUsage[];
    total: Omit<StageUsage, "stage">;
    costVnd: number;
    models: { stage: string; model: string; n: number }[];
    data: { byEndpoint: { endpoint: string; calls: number; cacheHits: number; credits: number; avoided: number }[]; credits: number; avoided: number; coldCredits: number };
  };
  events: { ts: number; level: string; stage: string | null; message: string }[];
  report: Report | null;
}

const STAGE_LABEL: Record<string, string> = {
  source: "1. Pool từ data source",
  prefilter: "2. Lọc số liệu (0 token)",
  enrich: "3. Enrich chi tiết (data API)",
  text_screen: "4. Text AI (model rẻ)",
  media_prep: "5. Video → contact sheet",
  video_analysis: "6. Video AI (vision)",
  final_rank: "7. Chấm điểm + lý do",
  select: "8. Tối ưu ngân sách",
};

export function RunView({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch(`/api/runs/${id}`).then((r) => r.json()).then(setD), [id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [load]);

  if (!d) return <p className="text-muted">Đang tải…</p>;
  if (!d.run) return <p className="text-bad">Không tìm thấy run.</p>;
  const { run, report, usage } = d;

  const act = async (action: "stop" | "resume") => {
    setBusy(true);
    await fetch(`/api/runs/${id}/${action}`, { method: "POST" });
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              {run.brief.product} · {run.brief.numKocs} KOC · {vnd(run.brief.budgetVnd)}
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {run.brief.targetAudience.gender === "female" ? "Nữ" : run.brief.targetAudience.gender} {run.brief.targetAudience.ageMin}–
            {run.brief.targetAudience.ageMax} · provider <b className="text-ink">{run.config.provider}</b> · data {run.config.dataSource} · lần chạy #{run.attempts}
          </p>
          {run.config.provider === "mock" && <p className="mt-1 text-xs text-warn">MOCK: kết quả giả lập, không phải đánh giá AI thật.</p>}
          {run.error && <p className="mt-2 text-sm text-bad">{run.error}</p>}
        </div>
        <div className="flex gap-2">
          {run.status === "running" && (
            <button className="btn" disabled={busy} onClick={() => act("stop")}>
              Stop (giả lập gián đoạn)
            </button>
          )}
          {(run.status === "interrupted" || run.status === "failed") && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act("resume")}>
              Resume từ checkpoint
            </button>
          )}
        </div>
      </div>

      {/* Pipeline progress + usage */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-5">
          <h2 className="label mb-3">Tiến độ pipeline</h2>
          <ol className="space-y-2">
            {d.stages.map((s) => {
              const pct = s.status === "done" ? 100 : s.tasks.total ? (s.tasks.done / s.tasks.total) * 100 : 0;
              return (
                <li key={s.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={run.currentStage === s.stage && run.status === "running" ? "font-semibold" : ""}>{STAGE_LABEL[s.stage]}</span>
                    <span className="num text-xs text-muted">
                      {s.tasks.total ? `${s.tasks.done}/${s.tasks.total}` : ""} {s.tasks.failed ? `(${s.tasks.failed} lỗi)` : ""} {(s.activeMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-line">
                    <div className={`h-1 rounded ${s.status === "done" ? "bg-good" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted">
            Thời gian xử lý (active): <span className="num">{(run.activeMs / 1000).toFixed(1)}s</span>
          </p>
        </div>

        <div className="card p-5">
          <h2 className="label mb-3">Token & chi phí AI</h2>
          <table className="num w-full text-xs">
            <thead className="text-muted">
              <tr className="text-left">
                <th className="py-1 font-normal">stage</th>
                <th className="font-normal">calls</th>
                <th className="font-normal">cache</th>
                <th className="font-normal">in</th>
                <th className="font-normal">cache-read</th>
                <th className="font-normal">out</th>
                <th className="font-normal">img</th>
                <th className="text-right font-normal">USD</th>
              </tr>
            </thead>
            <tbody>
              {usage.byStage.map((s) => (
                <tr key={s.stage} className="border-t border-line">
                  <td className="py-1">{s.stage}</td>
                  <td>{s.calls}</td>
                  <td>{s.cacheHits}</td>
                  <td>{compact(s.inputTokens)}</td>
                  <td>{compact(s.cacheReadTokens)}</td>
                  <td>{compact(s.outputTokens)}</td>
                  <td>{s.images}</td>
                  <td className="text-right">{s.costUsd.toFixed(4)}</td>
                </tr>
              ))}
              <tr className="border-t border-ink font-semibold">
                <td className="py-1">total</td>
                <td>{usage.total.calls}</td>
                <td>{usage.total.cacheHits}</td>
                <td>{compact(usage.total.inputTokens)}</td>
                <td>{compact(usage.total.cacheReadTokens)}</td>
                <td>{compact(usage.total.outputTokens)}</td>
                <td>{usage.total.images}</td>
                <td className="text-right">${usage.total.costUsd.toFixed(4)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            ≈ {vnd(usage.costVnd)} · models: {usage.models.map((m) => `${m.stage}=${m.model}`).join(", ") || "–"}
          </p>
          {usage.data && usage.data.byEndpoint.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <h3 className="label mb-1">Kalodata API (credit, 1 ≈ $0.1)</h3>
              <ul className="num space-y-0.5 text-xs">
                {usage.data.byEndpoint.map((e) => (
                  <li key={e.endpoint} className="flex justify-between">
                    <span>
                      {e.endpoint.replace("/tiktok/", "")} ×{e.calls} <span className="text-muted">({e.cacheHits} cache)</span>
                    </span>
                    <span>{e.credits.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">
                Trả: <b className="num">{usage.data.credits.toFixed(2)}</b> credit · tiết kiệm nhờ cache:{" "}
                <span className="num">{usage.data.avoided.toFixed(2)}</span> · chi phí lạnh: <span className="num">{usage.data.coldCredits.toFixed(2)}</span>
              </p>
            </div>
          )}
          {report && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {[
                ["Pool", report.funnel.pool],
                ["Qua lọc số liệu", report.funnel.prefilterPassed],
                ["Enrich", report.funnel.enriched],
                ["Text AI", report.funnel.textScreened],
                ["Video AI", report.funnel.videoAnalyzed],
                ["Chấm cuối", report.funnel.finalRanked],
                ["Chọn", report.funnel.selected],
              ].map(([k, v], i) => (
                <span key={k} className="rounded border border-line px-2 py-1">
                  {i > 0 && "→ "}
                  {k} <b className="num">{v}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {report && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{report.picks.length} KOC đề xuất</h2>
            <span className="text-sm text-muted">
              Chi phí ước tính <b className="num text-ink">{vnd(report.totals.estCostVnd)}</b> / {vnd(report.totals.budgetVnd)} ({report.totals.method})
            </span>
          </div>
          <div className="space-y-4">
            {report.picks.map((p) => (
              <KocCard key={p.id} pick={p} />
            ))}
          </div>
          {report.alternates.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium">Dự phòng ({report.alternates.length})</summary>
              <div className="mt-3 space-y-4">
                {report.alternates.map((p) => (
                  <KocCard key={p.id} pick={p} compact />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* Event log */}
      <details className="card p-5" open={!report}>
        <summary className="label cursor-pointer">Log</summary>
        <ul className="num mt-3 max-h-72 space-y-0.5 overflow-auto text-xs">
          {d.events.map((e, i) => (
            <li key={i} className={e.level === "error" ? "text-bad" : e.level === "warn" ? "text-warn" : ""}>
              <span className="text-muted">{new Date(e.ts).toLocaleTimeString("vi-VN")}</span> {e.stage ? `[${e.stage}] ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
