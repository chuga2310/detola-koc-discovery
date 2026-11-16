"use client";

/** Panel kỹ thuật của trang chiến dịch (nằm trong disclosure "Chi phí và nhật ký"): chi phí AI + Kalodata, log */
import { STEP_NAMES, type RunDetail } from "./runTypes";
import { compact, vnd } from "./ui";


export function Costs({ d }: { d: RunDetail }) {
  const u = d.usage;
  const th = "py-2 px-3 text-right font-medium";
  const td = "num py-2 px-3 text-right";
  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="min-w-0 overflow-x-auto">
        <h3 className="text-body font-semibold">Token AI</h3>
        <table className="mt-3 w-full border-collapse text-meta">
          <thead>
            <tr className="border-b border-rule-strong text-meta text-ink-2">
              <th className="py-2 pr-3 text-left font-medium">Bước</th>
              <th className={th}>Call</th>
              <th className={th}>Cache</th>
              <th className={th}>Input</th>
              <th className={th}>Cache đọc</th>
              <th className={th}>Output</th>
              <th className={th}>Ảnh</th>
              <th className="py-2 pl-3 text-right font-medium">USD</th>
            </tr>
          </thead>
          <tbody>
            {u.byStage.map((s) => (
              <tr key={s.stage} className="border-b border-rule">
                <td className="py-2 pr-3">{STEP_NAMES[s.stage] ?? s.stage}</td>
                <td className={td}>{s.calls}</td>
                <td className={td}>{s.cacheHits}</td>
                <td className={td}>{compact(s.inputTokens)}</td>
                <td className={td}>{compact(s.cacheReadTokens)}</td>
                <td className={td}>{compact(s.outputTokens)}</td>
                <td className={td}>{s.images}</td>
                <td className="num py-2 pl-3 text-right">{s.costUsd.toFixed(4)}</td>
              </tr>
            ))}
            {u.byStage.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-ink-2">
                  Chưa có call AI nào.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-rule-strong font-semibold">
              <td className="py-2 pr-3">Tổng</td>
              <td className={td}>{u.total.calls}</td>
              <td className={td}>{u.total.cacheHits}</td>
              <td className={td}>{compact(u.total.inputTokens)}</td>
              <td className={td}>{compact(u.total.cacheReadTokens)}</td>
              <td className={td}>{compact(u.total.outputTokens)}</td>
              <td className={td}>{u.total.images}</td>
              <td className="num py-2 pl-3 text-right">${u.total.costUsd.toFixed(4)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-3 text-meta text-ink-2">
          ≈ {vnd(u.costVnd)} · {u.models.map((m) => `${STEP_NAMES[m.stage] ?? m.stage}: ${m.model}`).join(" · ") || "chưa gọi model"}
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <h3 className="text-body font-semibold">Credit Kalodata</h3>
        <table className="mt-3 w-full border-collapse text-meta">
          <thead>
            <tr className="border-b border-rule-strong text-meta text-ink-2">
              <th className="py-2 pr-3 text-left font-medium">Endpoint</th>
              <th className={th}>Call</th>
              <th className={th}>Cache</th>
              <th className="py-2 pl-3 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {u.data.byEndpoint.map((e) => (
              <tr key={e.endpoint} className="border-b border-rule">
                <td className="py-2 pr-3">{e.endpoint.replace("/tiktok/", "")}</td>
                <td className={td}>{e.calls}</td>
                <td className={td}>{e.cacheHits}</td>
                <td className="num py-2 pl-3 text-right">{e.credits.toFixed(2)}</td>
              </tr>
            ))}
            {u.data.byEndpoint.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-ink-2">
                  Không dùng Kalodata (dữ liệu mẫu).
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <dl className="mt-4 grid grid-cols-3 border-y border-rule text-meta">
          {[
            ["Đã trả", u.data.credits],
            ["Cache tiết kiệm", u.data.avoided],
            ["Chi phí lạnh", u.data.coldCredits],
          ].map(([k, v]) => (
            <div key={k as string} className="py-2.5 pr-3">
              <dt className="text-meta text-ink-2">{k}</dt>
              <dd className="condensed num text-title leading-tight font-bold">{(v as number).toFixed(2)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-meta text-ink-2">1 credit ≈ $0.1. Chi phí lạnh = nếu không có cache.</p>
      </div>
    </div>
  );
}

export function Log({ d, max = 200 }: { d: RunDetail; max?: number }) {
  return (
    <ul className="num max-h-[360px] space-y-1 overflow-y-auto text-meta">
      {d.events.slice(-max).map((e, i) => (
        <li key={i} className={`grid grid-cols-[72px_1fr] gap-3 ${e.level === "error" ? "text-risk" : e.level === "warn" ? "text-caution" : "text-ink"}`}>
          <span className="text-ink-2">{new Date(e.ts).toLocaleTimeString("vi-VN")}</span>
          <span>
            {e.stage && <span className="text-ink-2">{STEP_NAMES[e.stage] ?? e.stage} · </span>}
            {e.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
