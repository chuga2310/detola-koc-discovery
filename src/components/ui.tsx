/** UI primitives nhỏ dùng chung */
export function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    completed: "bg-green-50 text-good border-green-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    queued: "bg-stone-50 text-muted border-line",
    interrupted: "bg-amber-50 text-warn border-amber-200",
    failed: "bg-red-50 text-bad border-red-200",
    done: "bg-green-50 text-good border-green-200",
    pending: "bg-stone-50 text-muted border-line",
  };
  return <span className={`rounded border px-2 py-0.5 text-xs font-medium ${color[status] ?? color.pending}`}>{status}</span>;
}

export function ScoreBar({ label, value, max = 100 }: { label: string; value: number | null; max?: number }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-muted">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-line">
        <div className="h-1.5 rounded bg-ink" style={{ width: `${Math.min(100, (v / max) * 100)}%`, opacity: value === null ? 0.2 : 1 }} />
      </div>
      <span className="num w-9 text-right">{value === null ? "–" : value.toFixed(0)}</span>
    </div>
  );
}

export const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
export const compact = (n: number | null | undefined) =>
  n === null || n === undefined ? "–" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n));
