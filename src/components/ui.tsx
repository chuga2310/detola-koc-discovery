/** Primitive dùng chung: shell band, con dấu verdict, trạng thái run, định dạng số */
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

/** Dải shell black-cherry: nhận diện + ngữ cảnh của màn hình hiện tại */
export function Shell({ children, aside }: { children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <header className="bg-shell text-shell-ink">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-10 gap-y-4 px-5 py-5 md:px-10">
        <div className="flex min-w-0 flex-col items-start gap-3 md:flex-row md:items-center md:gap-6">
          <Link href="/" className="compressed shrink-0 text-title leading-none font-extrabold tracking-[0.01em] uppercase no-underline">
            KOC Discovery
          </Link>
          {children && <div className="min-w-0 md:border-l md:border-shell-rule md:pl-6">{children}</div>}
        </div>
        {aside && <div className="flex flex-wrap items-center gap-x-8 gap-y-3">{aside}</div>}
      </div>
    </header>
  );
}

/** Một con số trong sổ chi phí trên dải shell */
export function LedgerFigure({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <div className="condensed num text-title leading-none font-bold">{value}</div>
      <div className="mt-1 text-meta text-shell-ink-2">{label}</div>
    </div>
  );
}

const VERDICT: Record<string, { word: string; tone: string; ring: string }> = {
  strong: { word: "Rất hợp", tone: "text-good", ring: "double" },
  good: { word: "Phù hợp", tone: "text-good", ring: "double" },
  weak: { word: "Cân nhắc", tone: "text-caution", ring: "single" },
  reject: { word: "Loại", tone: "text-risk", ring: "struck" },
};

export const verdictWord = (v: string) => VERDICT[v]?.word ?? v;

/**
 * Con dấu verdict — dấu ấn của thế giới "bàn thử". Hình dạng khác nhau theo mức
 * (vòng kép / vòng đơn / gạch chéo) để không phụ thuộc vào màu.
 */
export function Seal({ verdict, size = "sm" }: { verdict: string; size?: "sm" | "lg" }) {
  const v = VERDICT[verdict] ?? { word: verdict, tone: "text-ink-2", ring: "single" };
  const lg = size === "lg";
  return (
    <span
      className={`compressed relative inline-grid shrink-0 place-items-center rounded-full border-2 border-current text-center leading-[1.05] font-extrabold uppercase ${v.tone} ${
        lg ? "h-[120px] w-[120px] -rotate-6 text-title" : "h-[60px] w-[60px] text-[12px]"
      }`}
      role="img"
      aria-label={`Verdict: ${v.word}`}
    >
      {v.ring === "double" && <span aria-hidden className={`absolute rounded-full border border-current ${lg ? "inset-[7px]" : "inset-[4px]"}`} />}
      {v.ring === "struck" && <span aria-hidden className="absolute top-1/2 left-[8%] h-[2px] w-[84%] -rotate-[28deg] bg-current" />}
      <span className={lg ? "max-w-[78px]" : "max-w-[44px]"}>{v.word}</span>
    </span>
  );
}

/*
 * Trạng thái run. Crimson dành cho hành động nên không dùng ở đây:
 * bình thường (xong / đang chạy / chờ) là chữ yên lặng kèm chấm; chỉ trạng thái cần xử lý
 * (gián đoạn, lỗi) mới có khung màu để nổi lên khi quét danh sách.
 */
const STATUS: Record<string, { word: string; dot: string; loud?: string }> = {
  completed: { word: "Hoàn tất", dot: "bg-good" },
  running: { word: "Đang chạy", dot: "bg-ink animate-pulse" },
  queued: { word: "Chờ chạy", dot: "bg-ink-3" },
  interrupted: { word: "Bị gián đoạn", dot: "bg-caution", loud: "text-caution border-caution bg-caution-tint" },
  failed: { word: "Lỗi", dot: "bg-risk", loud: "text-risk border-risk bg-risk-tint" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-meta font-semibold whitespace-nowrap ${
        s.loud ? `rounded-[2px] border px-2 py-0.5 ${s.loud}` : "text-ink"
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.word}
    </span>
  );
}

/** Trạng thái trên nền shell tối: chữ sáng, viền màu trạng thái */
export function StatusOnShell({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <span className="inline-flex items-center gap-2 text-meta font-semibold text-shell-ink">
      <span aria-hidden className={`h-2 w-2 rounded-full ${status === "running" ? "animate-pulse bg-shell-ink" : status === "completed" ? "bg-[oklch(0.8_0.12_158)]" : status === "failed" ? "bg-[oklch(0.75_0.14_30)]" : "bg-[oklch(0.85_0.12_85)]"}`} />
      {s.word}
    </span>
  );
}
