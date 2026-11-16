"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "./ui";

interface RunRow {
  id: string;
  status: string;
  currentStage: string | null;
  createdAt: number;
  costUsd: number;
  credits: number;
  activeMs: number;
  brief: { product: string; numKocs: number };
  config: { provider?: string };
}

export function RunsList() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/runs")
        .then((r) => r.json())
        .then((j) => alive && setRuns(j.runs));
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!runs) return <p className="mt-4 text-sm text-muted">Đang tải…</p>;
  if (!runs.length) return <p className="mt-4 text-sm text-muted">Chưa có run nào.</p>;
  return (
    <ul className="mt-3 divide-y divide-line">
      {runs.map((r) => (
        <li key={r.id}>
          <Link href={`/runs/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-bg/60">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {r.brief.product} · {r.brief.numKocs} KOC
              </div>
              <div className="num text-xs text-muted">
                {r.id.slice(0, 8)} · {new Date(r.createdAt).toLocaleString("vi-VN")} · {r.config.provider}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="num text-xs text-muted">
                AI ${r.costUsd.toFixed(3)} · {r.credits.toFixed(1)} cr
              </span>
              <StatusBadge status={r.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
