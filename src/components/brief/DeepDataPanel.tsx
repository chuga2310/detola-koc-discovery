"use client";

/**
 * Dữ liệu chuyên sâu = tính năng TRẢ PHÍ. Mặc định tắt; người dùng tự bật từng mục.
 * Bật bất kỳ mục nào -> hiện cảnh báo trả phí với ước tính credit (bản demo được bật để dùng thử).
 */
import { AlertTriangle, Lock } from "lucide-react";
import { CREDIT_USD, PAID_FEATURES, paidCredits, type DeepData, type PaidMode } from "@/lib/brief/paid";

export function DeepDataPanel({
  value,
  onChange,
  numKocs,
  mode,
  disabled = false,
}: {
  value: DeepData;
  onChange: (v: DeepData) => void;
  numKocs: number;
  mode: PaidMode;
  disabled?: boolean;
}) {
  const locked = mode === "off";
  const credits = paidCredits(value, numKocs);
  return (
    <section aria-labelledby="deep-title" className="border-t border-rule px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="deep-title" className="font-semibold">
          Dữ liệu chuyên sâu
        </h4>
        <span className="rounded-full bg-caution-tint px-2 py-0.5 text-[12px] leading-none font-semibold text-caution">Trả phí</span>
        {mode === "demo" && <span className="rounded-full bg-sunken px-2 py-0.5 text-[12px] leading-none font-semibold text-ink-2">Bản demo: được bật</span>}
      </div>
      <p className="mt-1 text-meta text-ink-2">Tuỳ chọn, mặc định tắt. Mỗi mục lấy thêm số liệu từ Kalodata và tính thêm credit.</p>

      <ul className="mt-3 space-y-2">
        {PAID_FEATURES.map((f) => {
          const on = !!value[f.id];
          const cost = f.credits(numKocs);
          return (
            <li key={f.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${on ? "border-ink bg-action-tint/50" : "border-rule"}`}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={f.title}
                disabled={locked || disabled}
                onClick={() => onChange({ ...value, [f.id]: !on })}
                className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-shell" : "bg-rule-strong"}`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform ${on ? "translate-x-4" : ""}`}
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{f.title}</span>
                  <span className="num text-meta text-ink-2">≈ {cost.toLocaleString("vi-VN")} credit</span>
                </div>
                <p className="mt-0.5 text-meta text-ink-2">{f.description}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {locked && (
        <p className="mt-3 flex items-center gap-2 text-meta text-ink-2">
          <Lock aria-hidden size={14} /> Tính năng này chưa được mở cho tài khoản của bạn. Liên hệ để nâng cấp.
        </p>
      )}
      {credits > 0 && !locked && (
        <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-xl border border-caution/30 bg-caution-tint px-3 py-2.5 text-meta text-ink">
          <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0 text-caution" />
          <p>
            <b className="font-semibold">Đây là tính năng trả phí.</b> Chiến dịch này sẽ dùng thêm khoảng{" "}
            <b className="num font-semibold">{credits.toLocaleString("vi-VN")} credit Kalodata</b> (≈ ${(credits * CREDIT_USD).toFixed(2)}) ngoài chi phí thường.
            {mode === "demo" ? " Bản demo cho phép bật để dùng thử; credit vẫn bị trừ thật trên tài khoản Kalodata." : ""}
          </p>
        </div>
      )}
    </section>
  );
}

/** Dòng tóm tắt các mục đã bật (trang chiến dịch) */
export function deepDataSummary(value: DeepData | undefined): string | null {
  const on = PAID_FEATURES.filter((f) => value?.[f.id]).map((f) => f.title);
  return on.length ? on.join(", ") : null;
}
