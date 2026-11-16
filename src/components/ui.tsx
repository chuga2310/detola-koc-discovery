/** Primitive dùng chung theo design system DETOLA: header, badge đánh giá, trạng thái, định dạng số */
import Link from "next/link";

export const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;
export const compact = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "–"
    : n >= 1e9
      ? `${(n / 1e9).toFixed(1)}B`
      : n >= 1e6
        ? `${(n / 1e6).toFixed(1)}M`
        : n >= 1e3
          ? `${Math.round(n / 1e3)}k`
          : String(Math.round(n));
export const millions = (n: number) => `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M ₫`;

/** Dấu nhận diện nhỏ: chấm cam + vòng navy (không dùng logo DETOLA) */
function Mark() {
  return (
    <span aria-hidden className="relative inline-grid h-8 w-8 place-items-center rounded-[10px] bg-shell">
      <span className="h-2.5 w-2.5 rounded-full bg-action" />
      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-action/60" />
    </span>
  );
}

/** Header sáng, dính đầu trang (kiểu header detola.vn): nhận diện bên trái, ngữ cảnh ở giữa, hành động bên phải */
export function Shell({ children, aside }: { children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-rule bg-ground/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[68px] max-w-[1200px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3 md:px-10">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold tracking-[-0.03em] text-ink no-underline">
            <Mark />
            KOC Discovery
          </Link>
          {children && <div className="min-w-0 md:border-l md:border-rule md:pl-6">{children}</div>}
        </div>
        {aside && <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{aside}</div>}
      </div>
    </header>
  );
}

/** Một con số tóm tắt trên header (chi phí, thời gian) */
export function LedgerFigure({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <div className="num text-[17px] leading-none font-semibold tracking-[-0.02em] text-ink">{value}</div>
      <div className="mt-1 text-meta text-ink-2">{label}</div>
    </div>
  );
}

const VERDICT: Record<string, { word: string; cls: string; dot: string }> = {
  strong: { word: "Rất hợp", cls: "bg-good text-white border-good", dot: "bg-white" },
  good: { word: "Phù hợp", cls: "bg-good-tint text-good border-good/30", dot: "bg-good-fill" },
  weak: { word: "Cân nhắc", cls: "bg-caution-tint text-caution border-caution/30", dot: "bg-caution" },
  reject: { word: "Loại", cls: "bg-risk-tint text-risk border-risk/30", dot: "bg-risk" },
};

export const verdictWord = (v: string) => VERDICT[v]?.word ?? v;

/** Badge đánh giá dạng pill có chấm màu + chữ (không truyền tin chỉ bằng màu) */
export function Seal({ verdict, size = "sm" }: { verdict: string; size?: "sm" | "lg" }) {
  const v = VERDICT[verdict] ?? { word: verdict, cls: "bg-surface text-ink-2 border-rule", dot: "bg-ink-3" };
  const lg = size === "lg";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${v.cls} ${
        lg ? "px-3.5 py-1.5 text-body" : "px-2.5 py-1 text-[12px] leading-none"
      }`}
    >
      <span aria-hidden className={`rounded-full ${v.dot} ${lg ? "h-2 w-2" : "h-1.5 w-1.5"}`} />
      <span className="sr-only">Đánh giá: </span>
      {v.word}
    </span>
  );
}

/* Trạng thái chiến dịch: pill nhạt; chỉ trạng thái cần xử lý (gián đoạn, lỗi) mới có màu cảnh báo */
const STATUS: Record<string, { word: string; dot: string; cls: string }> = {
  completed: { word: "Hoàn tất", dot: "bg-good-fill", cls: "bg-good-tint text-good" },
  running: { word: "Đang chạy", dot: "bg-action animate-pulse", cls: "bg-action-tint text-ink" },
  queued: { word: "Chờ chạy", dot: "bg-ink-3", cls: "bg-sunken text-ink-2" },
  interrupted: { word: "Tạm dừng", dot: "bg-caution", cls: "bg-caution-tint text-caution" },
  failed: { word: "Lỗi", dot: "bg-risk", cls: "bg-risk-tint text-risk" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap ${s.cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.word}
    </span>
  );
}
