/** Tiện ích nhỏ dùng chung: hash, concurrency limit, retry, xử lý tiếng Việt. */
import crypto from "node:crypto";

/** Hash ổn định cho object (sort key trước khi stringify) -> dùng làm cache key */
export function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/**
 * Semaphore đơn giản: giới hạn số promise chạy song song (thay cho p-limit).
 * Dùng để không bắn quá nhiều request AI cùng lúc -> tránh 429 rate limit.
 */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= max) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff + jitter: 1s, 2s, 4s ... (+ ngẫu nhiên tới 30%) */
export function backoffMs(attempt: number, baseMs = 1000) {
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  return Math.round(exp + Math.random() * exp * 0.3);
}

/** Bỏ dấu tiếng Việt + lowercase -> so khớp keyword không phụ thuộc dấu/hoa thường */
export function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Đếm số keyword (đã chuẩn hoá) xuất hiện trong text */
export function keywordHits(text: string, keywords: string[]): string[] {
  const t = normalizeVi(text);
  return keywords.filter((k) => t.includes(normalizeVi(k)));
}

export function clamp(x: number, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, x));
}

/** Rút gọn số lớn cho prompt/UI: 125000 -> "125k", 3400000 -> "3.4M" */
export function compactNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "?";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

export const pct = (x: number | undefined | null, digits = 0) =>
  x === undefined || x === null ? "?" : `${(x * 100).toFixed(digits)}%`;

export function truncate(s: string | undefined, max: number): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Percentile rank (0..1) của từng giá trị trong mảng -> chuẩn hoá metric về cùng thang */
export function percentileRanks(values: (number | undefined)[]): number[] {
  const defined = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => typeof x.v === "number" && !Number.isNaN(x.v));
  const sorted = [...defined].sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length).fill(0.5); // thiếu data -> trung vị (không thưởng, không phạt nặng)
  sorted.forEach((x, rank) => {
    out[x.i] = sorted.length === 1 ? 1 : rank / (sorted.length - 1);
  });
  return out;
}

/** Che email / số điện thoại / link trong text công khai (bio) trước khi lưu hoặc đưa vào prompt */
export function redactContact(s: string | undefined): string | undefined {
  if (!s) return s;
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(\+?84|0)[\d .-]{8,12}\d/g, "[phone]")
    .replace(/https?:\/\/\S+/g, "[link]");
}

