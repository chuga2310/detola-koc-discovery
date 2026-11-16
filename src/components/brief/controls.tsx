"use client";

/**
 * Control nhập liệu thân thiện cho brief: chip chọn nhanh, ô tiền tự format, stepper, ô từ khoá.
 * Thay cho input số thuần: user bấm là xong, gõ tay thì tự thêm dấu phân cách.
 */
import { Check, Minus, Plus, X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { BUDGET_PRESETS, shortMoney, USD_VND, type Currency } from "@/lib/brief/slots";

export interface ChipOption {
  value: string;
  label: string;
  hint?: string;
}

/** Nhóm chip: single (như radio) hoặc multi (như checkbox). Dùng role chuẩn để screen reader hiểu. */
export function ChipGroup({
  options,
  value,
  onChange,
  multi = false,
  label,
  disabled = false,
  invalid = false,
}: {
  options: ChipOption[];
  value: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const toggle = (v: string) => {
    if (multi) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange([v]);
  };
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={label} aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className="chip"
          >
            {multi && <Check aria-hidden size={14} strokeWidth={2.5} className="chip-check" />}
            <span>{o.label}</span>
            {o.hint && <span className="num text-meta text-ink-2">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Ô nhập tiền: hiển thị "30.000.000" (VND) hoặc "1,500" (USD), giữ vị trí con trỏ khi tự thêm dấu */
export function MoneyInput({
  value,
  currency,
  onChange,
  id,
  invalid,
  describedBy,
}: {
  value: number | undefined;
  currency: Currency;
  onChange: (v: number | undefined) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  const locale = currency === "USD" ? "en-US" : "vi-VN";
  const text = value ? value.toLocaleString(locale) : "";

  // Sau khi format lại, đặt con trỏ sau đúng số chữ số user đã gõ trước nó
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caretDigits.current === null || document.activeElement !== el) return;
    let seen = 0;
    let pos = 0;
    while (pos < text.length && seen < caretDigits.current) {
      if (/\d/.test(text[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [text]);

  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2">
        {currency === "USD" ? "$" : "₫"}
      </span>
      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Hoặc tự nhập số tiền"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="field num pl-8 text-title font-semibold placeholder:text-body placeholder:font-normal"
        value={text}
        onChange={(e) => {
          const before = e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length);
          caretDigits.current = before.replace(/\D/g, "").length;
          const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
          onChange(digits ? Number(digits) : undefined);
        }}
      />
    </div>
  );
}

/** Ngân sách = chọn tiền tệ + chip mức có sẵn + ô tự nhập */
export function BudgetField({
  amount,
  currency,
  onChange,
  numKocs,
  invalid,
  errorId,
}: {
  amount: number | undefined;
  currency: Currency;
  onChange: (amount: number | undefined, currency: Currency) => void;
  numKocs?: number;
  invalid?: boolean;
  errorId?: string;
}) {
  const id = useId();
  const switchTo = (c: Currency) => {
    if (c === currency) return;
    // Đổi tiền tệ: quy đổi và làm tròn về số "đẹp" để user không phải sửa lại
    // Quy đổi rồi bám vào mức có sẵn gần nhất -> chip vẫn được chọn sau khi đổi tiền tệ
    const converted = !amount ? 0 : c === "USD" ? amount / USD_VND : amount * USD_VND;
    const presets = BUDGET_PRESETS[c];
    const next = converted ? presets.reduce((best, p) => (Math.abs(p - converted) < Math.abs(best - converted) ? p : best), presets[0]) : presets[2];
    onChange(next, c);
  };
  const vndValue = amount ? (currency === "USD" ? amount * USD_VND : amount) : 0;
  const perKoc = numKocs && vndValue ? vndValue / numKocs : 0;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Tiền tệ" className="segmented">
          {(["VND", "USD"] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={currency === c} onClick={() => switchTo(c)}>
              {c === "VND" ? "₫ VND" : "$ USD"}
            </button>
          ))}
        </div>
        <ChipGroup
          label="Mức ngân sách có sẵn"
          options={BUDGET_PRESETS[currency].map((v) => ({ value: String(v), label: shortMoney(v, currency) }))}
          value={amount ? [String(amount)] : []}
          onChange={([v]) => onChange(Number(v), currency)}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,260px)_1fr]">
        <MoneyInput id={id} value={amount} currency={currency} onChange={(v) => onChange(v, currency)} invalid={invalid} describedBy={errorId} />
        <p className="num text-meta text-ink-2" aria-live="polite">
          {currency === "USD" && amount ? `≈ ${Math.round(amount * USD_VND).toLocaleString("vi-VN")} ₫ · ` : ""}
          {perKoc ? `khoảng ${shortMoney(Math.round(perKoc / 1e5) * 1e5, "VND")} cho mỗi KOC` : "Chọn mức có sẵn hoặc tự nhập."}
        </p>
      </div>
    </div>
  );
}

/** Stepper − 5 + cho số KOC */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 50,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n || min));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Bớt 1" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
        <Minus aria-hidden size={16} />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        className="num"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, ""))))}
      />
      <button type="button" aria-label="Thêm 1" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
        <Plus aria-hidden size={16} />
      </button>
    </div>
  );
}

/** Ô từ khoá dạng thẻ: Enter hoặc dấu phẩy để thêm, × để xoá */
export function TagInput({ value, onChange, placeholder, label }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; label: string }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setText("");
  };
  return (
    <div className="field flex min-h-[44px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-[2px] bg-ground py-0.5 pr-1 pl-2 text-meta">
          {t}
          <button type="button" aria-label={`Xoá ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-[2px] p-0.5 text-ink-2 hover:text-ink">
            <X aria-hidden size={12} />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        value={text}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => text && add(text)}
        className="min-w-[120px] flex-1 bg-transparent py-0.5 outline-none placeholder:text-ink-3"
      />
    </div>
  );
}
