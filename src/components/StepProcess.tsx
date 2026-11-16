"use client";

/**
 * Quy trình nghiên cứu creator dạng từng bước. Mỗi bước: tên, mô tả dễ hiểu, kết quả 1 dòng,
 * bấm để mở chi tiết (con số chính + danh sách creator kèm nhận xét). Bước đang chạy tự mở.
 */
import { Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { StepRow, StepSummary } from "./runTypes";

const secs = (ms: number) => (ms < 1000 ? "<1 giây" : `${(ms / 1000).toLocaleString("vi-VN", { maximumFractionDigits: ms < 10_000 ? 1 : 0 })} giây`);

export function StepProcess({ steps }: { steps: StepSummary[] }) {
  // Ghi đè của user (mở/đóng); bước không bị ghi đè thì mặc định: mở nếu đang chạy hoặc lỗi
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const isOpen = (s: StepSummary) => override[s.stage] ?? (s.status === "running" || s.status === "failed");

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const open = isOpen(s);
        const last = i === steps.length - 1;
        const panelId = `step-${s.stage}`;
        const canOpen = s.status !== "pending";
        return (
          <li key={s.stage} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-4">
            {/* Đường nối giữa các bước */}
            {!last && <span aria-hidden className={`absolute top-8 bottom-0 left-[13.5px] w-px ${s.status === "done" ? "bg-ink" : "bg-rule"}`} />}
            <Node status={s.status} n={i + 1} />
            <div className={`min-w-0 ${last ? "" : "pb-5"}`}>
              <button
                type="button"
                aria-expanded={canOpen ? open : undefined}
                aria-controls={canOpen ? panelId : undefined}
                disabled={!canOpen}
                onClick={() => setOverride({ ...override, [s.stage]: !open })}
                className="group flex w-full items-start justify-between gap-4 rounded-[2px] py-1 text-left disabled:cursor-default"
              >
                <span className="min-w-0">
                  <span className={`block font-semibold ${s.status === "pending" ? "text-ink-2" : "text-ink"} ${canOpen ? "group-hover:text-action" : ""}`}>{s.title}</span>
                  <span className={`mt-0.5 block text-meta ${s.status === "done" ? "text-ink" : "text-ink-2"}`}>
                    {s.status === "running"
                      ? progressText(s)
                      : s.status === "failed"
                        ? "Dừng ở bước này. Bấm “Chạy tiếp” để thử lại từ chỗ dở."
                        : (s.result ?? (s.status === "pending" ? "Chờ bước trước" : ""))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-meta text-ink-2">
                  {s.status === "done" && <span className="num hidden sm:inline">{secs(s.activeMs)}</span>}
                  {canOpen && <ChevronDown aria-hidden size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />}
                </span>
              </button>

              {canOpen && open && (
                <div id={panelId} className="rise-in mt-3 rounded-[2px] border border-rule bg-surface px-4 py-4">
                  <p className="max-w-[70ch] text-ink-2">{s.description}</p>
                  <p className="mt-2 text-meta text-ink-2">{s.usesAi ? "Có dùng AI ở bước này." : "Bước này không dùng AI, chỉ tính bằng số liệu."}</p>
                  {s.status === "running" && s.progress.total > 0 && (
                    <div className="mt-3 h-[3px] bg-rule" aria-hidden>
                      <div
                        className="h-full origin-left bg-ink transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{ transform: `scaleX(${s.progress.done / s.progress.total})` }}
                      />
                    </div>
                  )}
                  {s.facts.length > 0 && (
                    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-rule pt-3">
                      {s.facts.map((f) => (
                        <div key={f.label}>
                          <dt className="text-meta text-ink-2">{f.label}</dt>
                          <dd className="condensed num text-title leading-tight font-bold">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {s.rows.length > 0 && <Rows title={s.rowsTitle} rows={s.rows} />}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function progressText(s: StepSummary) {
  if (!s.progress.total) return "Đang chạy…";
  return `Đang chạy · ${s.progress.done}/${s.progress.total} phần việc${s.progress.failed ? ` · ${s.progress.failed} lỗi, sẽ thử lại` : ""}`;
}

function Node({ status, n }: { status: StepSummary["status"]; n: number }) {
  const base = "relative z-[1] mt-0.5 grid h-7 w-7 place-items-center rounded-full text-meta font-bold";
  if (status === "done")
    return (
      <span className={`${base} border-2 border-ink bg-ground text-ink`}>
        {/* vòng kép mực in, cùng họ với con dấu verdict */}
        <span aria-hidden className="absolute inset-[2px] rounded-full border border-current" />
        <Check aria-hidden size={12} strokeWidth={3} />
        <span className="sr-only">Xong</span>
      </span>
    );
  if (status === "running")
    return (
      <span className={`${base} border-2 border-ink bg-ground`}>
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-ink" />
        <span className="sr-only">Đang chạy</span>
      </span>
    );
  if (status === "failed")
    return (
      <span className={`${base} border-2 border-risk bg-risk-tint text-risk`}>
        <X aria-hidden size={14} strokeWidth={3} />
        <span className="sr-only">Lỗi</span>
      </span>
    );
  return <span className={`${base} num border border-rule bg-ground text-ink-3`}>{n}</span>;
}

const TONE: Record<string, string> = { good: "text-good", caution: "text-caution", risk: "text-risk" };

function Rows({ title, rows }: { title?: string; rows: StepRow[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 6);
  return (
    <div className="mt-4 border-t border-rule pt-3">
      {title && <h4 className="text-meta font-semibold text-ink-2">{title}</h4>}
      <ul className="mt-1 divide-y divide-rule">
        {shown.map((r, i) => (
          <li key={`${r.handle}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2.5">
            <div className="min-w-0">
              {r.handle && <span className="condensed mr-2 font-bold">@{r.handle}</span>}
              <span className="text-ink">{r.text}</span>
              {r.note && <p className={`mt-0.5 text-meta ${r.tone && !r.value ? TONE[r.tone] : "text-ink-2"}`}>{r.note}</p>}
            </div>
            {r.value && <span className={`condensed num text-title leading-none font-bold ${r.tone ? TONE[r.tone] : "text-ink"}`}>{r.value}</span>}
          </li>
        ))}
      </ul>
      {rows.length > 6 && (
        <button type="button" className="mt-2 text-meta font-semibold text-action hover:underline" onClick={() => setAll(!all)}>
          {all ? "Thu gọn" : `Xem cả ${rows.length} người`}
        </button>
      )}
    </div>
  );
}
