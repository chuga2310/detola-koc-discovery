"use client";

/* eslint-disable @next/next/no-img-element -- ảnh từ CDN ngoài / media cache, không cần tối ưu next/image */
import { useState } from "react";
import type { Pick } from "@/lib/pipeline/stages/select";
import type { Evidence } from "@/lib/types";
import { compact, ScoreBar, vnd } from "./ui";

const VERDICT: Record<string, string> = {
  strong: "bg-green-50 text-good border-green-200",
  good: "bg-blue-50 text-blue-700 border-blue-200",
  weak: "bg-amber-50 text-warn border-amber-200",
  reject: "bg-red-50 text-bad border-red-200",
};

/** Contact sheet 3x2: khoanh frame được trích dẫn để người xem kiểm chứng bằng mắt */
function Sheet({ ev }: { ev: Evidence }) {
  if (!ev.image) return null;
  const f = ev.frame ?? null;
  return (
    <a href={ev.videoUrl} target="_blank" rel="noreferrer" className="relative mt-2 block w-full max-w-sm">
      <img src={`/api/media/${ev.image}`} alt="contact sheet" className="w-full rounded border border-line" />
      {f && f >= 1 && f <= 6 && (
        <span
          className="absolute rounded border-2 border-accent"
          style={{ left: `${((f - 1) % 3) * 33.33}%`, top: `${Math.floor((f - 1) / 3) * 50}%`, width: "33.33%", height: "50%" }}
        />
      )}
    </a>
  );
}

function EvidenceChip({ ev, open, onToggle }: { ev: Evidence; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`num rounded border px-1.5 py-0.5 text-[11px] ${open ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-ink"}`}
      title={ev.text}
    >
      {ev.id}
    </button>
  );
}

function ClaimList({ items, tone }: { items: Pick["reasons"]; tone: "good" | "bad" }) {
  const [open, setOpen] = useState<string | null>(null);
  const openEv = items.flatMap((x) => x.evidence).find((e) => e.id === open);
  return (
    <div>
      <ul className="space-y-1.5">
        {items.map((r, i) => (
          <li key={i} className="text-sm">
            <span className={tone === "good" ? "text-good" : "text-bad"}>{tone === "good" ? "+" : "−"}</span> {r.text}{" "}
            <span className="inline-flex flex-wrap gap-1 align-middle">
              {r.evidence.map((e) => (
                <EvidenceChip key={e.id} ev={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
              ))}
            </span>
          </li>
        ))}
      </ul>
      {openEv && (
        <div className="mt-2 rounded border border-line bg-bg p-2 text-xs">
          <b className="num">{openEv.id}</b> {openEv.text}
          <Sheet ev={openEv} />
        </div>
      )}
    </div>
  );
}

export function KocCard({ pick: p, compact: isCompact }: { pick: Pick; compact?: boolean }) {
  const sheets = p.evidence.filter((e) => e.id.endsWith(".s") && e.image);
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">#{p.rank}</div>
        {p.avatarUrl && <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full border border-line object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={p.profileUrl} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
              @{p.handle}
            </a>
            <span className="text-sm text-muted">{p.nickname}</span>
            <span className={`rounded border px-1.5 py-0.5 text-xs ${VERDICT[p.verdict] ?? ""}`}>{p.verdict}</span>
            {!p.videoAnalyzed && <span className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">chưa phân tích video</span>}
          </div>
          <p className="mt-1 text-sm">{p.headline}</p>
          <p className="num mt-1 text-xs text-muted">
            {compact(p.followers)} followers · {p.costTier} · ước tính {vnd(p.estCostVnd)}/video
          </p>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <ScoreBar label="Final" value={p.scores.final} />
          <ScoreBar label="AI fit" value={p.scores.fit} />
          <ScoreBar label="Data" value={p.scores.data} />
          <ScoreBar label="Video" value={p.scores.video} />
        </div>
      </div>

      {!isCompact && (
        <div className="mt-4 grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div>
              <h3 className="label mb-1.5">Lý do đề xuất (bấm id để xem bằng chứng)</h3>
              <ClaimList items={p.reasons} tone="good" />
            </div>
            {p.risks.length > 0 && (
              <div>
                <h3 className="label mb-1.5">Rủi ro</h3>
                <ClaimList items={p.risks} tone="bad" />
              </div>
            )}
            <div>
              <h3 className="label mb-1">Gợi ý concept</h3>
              <p className="text-sm">{p.suggestedAngle}</p>
            </div>
            {p.invalidEvidence.length > 0 && (
              <p className="text-xs text-warn">Đã loại {p.invalidEvidence.length} trích dẫn không hợp lệ: {p.invalidEvidence.join(", ")}</p>
            )}
          </div>
          <div>
            <h3 className="label mb-1.5">Video đã phân tích</h3>
            {sheets.length === 0 && <p className="text-sm text-muted">Không có media.</p>}
            <div className="space-y-3">
              {sheets.map((s) => (
                <div key={s.id} className="text-xs">
                  <p className="text-muted">{s.text}</p>
                  <Sheet ev={s} />
                </div>
              ))}
            </div>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted">Tất cả bằng chứng ({p.evidence.length})</summary>
              <ul className="mt-2 space-y-1">
                {p.evidence.map((e) => (
                  <li key={e.id}>
                    <b className="num">{e.id}</b> {e.text}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}
    </article>
  );
}
