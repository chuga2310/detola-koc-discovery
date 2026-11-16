"use client";

/**
 * Ô chat ở đáy màn hình. Lúc chưa dùng: viền có vệt crimson chạy quanh + gợi ý nổi phía trên,
 * để người chưa biết điền gì có lối vào bằng lời. Enter gửi, Shift+Enter xuống dòng.
 */
import { ArrowUp, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

const EXAMPLE = "Tìm 5 KOC review kem chống nắng nâng tông cho nữ sinh viên, ngân sách khoảng 30 triệu";

export function Composer({
  onSend,
  disabled = false,
  attention = false,
  hint = attention,
  placeholder = "Mô tả sản phẩm, khách hàng và ngân sách của bạn…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Bật hiệu ứng mời gọi (màn hình bắt đầu) */
  attention?: boolean;
  /** Hiện bong bóng gợi ý phía trên (tắt khi user đang điền form) */
  hint?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [hintClosed, setHintClosed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const showHint = hint && !hintClosed && !text;
  const glow = attention && !focused && !text;

  // Tự giãn chiều cao theo nội dung (tối đa ~6 dòng)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  return (
    <div>
      {/* Gợi ý nằm TRONG luồng (không phủ lên form), mũi tên chỉ xuống ô chat */}
      {showHint && (
        <div id="composer-hint" className="rise-in mb-3 w-full max-w-[520px]">
          <div className="relative rounded-xl bg-ink px-4 py-3 pr-10 text-surface">
            <p className="text-meta leading-relaxed">
              <b className="font-semibold">Chưa biết bắt đầu từ đâu?</b>
              <span className="hidden sm:inline"> Hãy mô tả sản phẩm và khách hàng của bạn, AI sẽ hỏi thêm và gợi ý phần còn lại.</span>
            </p>
            <button
              type="button"
              className="mt-1.5 line-clamp-2 text-left text-meta text-[oklch(0.86_0.03_5)] underline decoration-[oklch(0.6_0.03_5)] underline-offset-3 hover:text-surface sm:line-clamp-none"
              onClick={() => {
                setText(EXAMPLE);
                ref.current?.focus();
              }}
            >
              Thử: “{EXAMPLE}”
            </button>
            <button
              type="button"
              aria-label="Đóng gợi ý"
              className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-xl text-[oklch(0.86_0.03_5)] hover:bg-[oklch(0.3_0.02_345)] hover:text-surface"
              onClick={() => setHintClosed(true)}
            >
              <X aria-hidden size={14} />
            </button>
            {/* mũi tên chỉ xuống ô chat */}
            <span aria-hidden className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 bg-ink" />
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className={`relative flex items-end gap-2 rounded-xl border bg-surface p-2 pl-4 transition-colors focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-action-text ${
          focused ? "border-action-text" : "border-rule-strong"
        } ${glow ? "composer-attn" : ""}`}
      >
        <label htmlFor="composer" className="sr-only">
          Nhắn cho trợ lý brief
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={showHint ? "composer-hint" : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-[168px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-body leading-normal outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          aria-label="Gửi"
          disabled={disabled || !text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-action text-action-ink transition-colors hover:bg-action-hover disabled:bg-rule disabled:text-ink-3"
        >
          <ArrowUp aria-hidden size={18} strokeWidth={2.25} />
        </button>
      </form>
    </div>
  );
}
