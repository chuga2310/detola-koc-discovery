"use client";

/*
 * Bài review của 1 KOC theo lối "biên tập viên làm đẹp đã thử":
 * con dấu verdict, Ưu / Lưu ý có mã bằng chứng, dải swatch frame video.
 * Tương tác đặc trưng: bấm mã bằng chứng -> frame được trích nổi lên trong dải swatch và được khoanh,
 * nội dung bằng chứng hiện ra, KOC được đánh dấu đã xem; bấm frame -> mở bằng chứng trích frame đó.
 */
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Evidence, Pick } from "./runTypes";
import { compact, millions, Seal } from "./ui";

const KIND: Record<string, string> = { metric: "Số liệu", audience: "Khán giả", text: "Nội dung", video: "Video" };

/** "c18.v1.o2" -> "v1.o2": bỏ tiền tố creator cho gọn */
const shortId = (id: string) => id.replace(/^c\d+\./, "");

export function KocReview({ pick, onRead }: { pick: Pick; onRead: () => void }) {
  const [active, setActive] = useState<string | null>(null);
  const evMap = useMemo(() => new Map(pick.evidence.map((e) => [e.id, e])), [pick.evidence]);
  const activeEv = active ? evMap.get(active) : undefined;
  const videos = pick.evidence.filter((e) => /\.v\d+\.s$/.test(e.id) && e.image);
  // (state reset khi đổi KOC: parent render với key = pick.id)

  const openEvidence = (id: string | null) => {
    setActive(id);
    if (id) onRead();
  };

  return (
    <article aria-labelledby={`koc-${pick.id}`} className="min-w-0">
      <header className="grid grid-cols-1 items-start gap-x-8 gap-y-3 border-b border-rule pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id={`koc-${pick.id}`} className="text-[30px] leading-tight font-semibold tracking-[-0.04em] [overflow-wrap:anywhere] sm:text-display">
              @{pick.handle}
            </h2>
            <a href={pick.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-meta font-semibold text-action-text">
              Hồ sơ TikTok <ArrowUpRight aria-hidden size={15} />
            </a>
          </div>
          <p className="num mt-2 text-meta text-ink-2">
            {pick.nickname} · {compact(pick.followers)} follower · {pick.costTier} · ước tính {millions(pick.estCostVnd)} / video
          </p>
          <SignalPills pick={pick} />
          <p className="mt-3 max-w-[64ch] text-body font-medium">{pick.headline}</p>
        </div>
        <span className="hidden sm:block">
          <Seal verdict={pick.verdict} size="lg" />
        </span>
        <span className="-order-1 sm:hidden">
          <Seal verdict={pick.verdict} />
        </span>
        <dl className="mt-2 grid grid-cols-6 gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:col-span-2 sm:grid-cols-5">
          {[
            ["Tổng", pick.scores.final],
            ["AI chấm", pick.scores.fit],
            ["Số liệu", pick.scores.data],
            ["Nội dung", pick.scores.text],
            ["Video", pick.scores.video],
          ].map(([label, v], i) => (
            <div key={label as string} className={`min-w-0 bg-surface-2 px-3 py-2.5 sm:col-span-1 sm:px-4 ${i < 2 ? "col-span-3" : "col-span-2"}`}>
              <dt className="truncate text-[12px] text-ink-2 sm:text-meta">{label}</dt>
              <dd className={`num text-[19px] leading-tight sm:text-title ${i === 0 ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                {v === null ? "–" : (v as number).toFixed(i === 1 ? 0 : 1)}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Dải swatch ngay dưới điểm, như ảnh "đã thử" đặt trước phần nhận xét: luôn nằm trong viewport đầu,
          và hộp bằng chứng (bên dưới lý do) mở ra không bao giờ đẩy nó đi */}
      {videos.length > 0 ? (
        <section className="relative mt-4 -mx-1 flex gap-7 overflow-x-auto px-1 pt-1 pb-1" aria-label="Frame video đã phân tích">
          {videos.map((v) => (
            <FrameStrip
              key={v.id}
              video={v}
              observations={pick.evidence.filter((e) => e.id.startsWith(v.id.replace(/\.s$/, ".o")))}
              active={activeEv}
              onPick={openEvidence}
            />
          ))}
        </section>
      ) : (
        <p className="mt-4 text-ink-2">Chưa phân tích video cho KOC này: điểm chỉ dựa trên số liệu và nội dung text.</p>
      )}

      <div className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2">
        <Claims title="Ưu" tone="good" items={pick.reasons} active={active} onKey={openEvidence} />
        <Claims title="Lưu ý" tone="risk" items={pick.risks} active={active} onKey={openEvidence} empty="AI không nêu rủi ro nào có bằng chứng." />
      </div>

      <div aria-live="polite" className="mt-5">
        {activeEv ? (
          <div key={activeEv.id} className="evidence-in flex items-start gap-4 rounded-xl border border-action/50 bg-action-tint/60 px-4 py-3">
            {activeEv.image && activeEv.frame ? <FrameTile src={`/api/media/${activeEv.image}`} frame={activeEv.frame} className="h-[90px] w-[51px]" /> : null}
            <div className="min-w-0">
              <span className="num text-meta font-bold text-action-text">{shortId(activeEv.id)}</span>
              <p className="mt-0.5">
                <span className="font-semibold text-ink-2">{KIND[activeEv.kind]}. </span>
                {activeEv.text}
              </p>
            </div>
          </div>
        ) : (
          <p className="border border-dashed border-rule px-4 py-2.5 text-meta text-ink-2">
            Bấm một mã bằng chứng cạnh lý do để xem số liệu, câu nói hoặc frame video được trích.
          </p>
        )}
      </div>

      <section className="mt-6 border-t border-rule pt-5">
        <h3 className="text-body font-semibold">Gợi ý concept cho sản phẩm</h3>
        <p className="mt-2 max-w-[70ch]">{pick.suggestedAngle}</p>
      </section>

      <details className="disclosure mt-6 border-t border-rule pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-body font-semibold">
          <ChevronRight aria-hidden size={16} className="chev text-ink-2" />
          Toàn bộ bằng chứng ({pick.evidence.length})
        </summary>
        <ul className="mt-3 space-y-1.5">
          {pick.evidence.map((e) => (
            <li key={e.id} className="grid grid-cols-[64px_1fr] gap-3 text-meta">
              <span className="num font-semibold text-ink-2">{shortId(e.id)}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      </details>
      {pick.invalidEvidence.length > 0 && (
        <p className="mt-4 text-meta text-caution">
          Đã loại {pick.invalidEvidence.length} trích dẫn không tồn tại: {pick.invalidEvidence.join(", ")}.
        </p>
      )}
    </article>
  );
}

function Claims({
  title,
  tone,
  items,
  active,
  onKey,
  empty,
}: {
  title: string;
  tone: "good" | "risk";
  items: Pick["reasons"];
  active: string | null;
  onKey: (id: string | null) => void;
  empty?: string;
}) {
  return (
    <div>
      <h3 className="condensed border-b border-rule pb-1.5 text-title font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-ink-2">{empty}</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {items.map((r, i) => (
            <li key={i} className="grid grid-cols-[14px_1fr] gap-2">
              <span aria-hidden className={`font-bold ${tone === "good" ? "text-good" : "text-risk"}`}>
                {tone === "good" ? "+" : "−"}
              </span>
              <span>
                {r.text}
                {r.evidence.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onKey(active === e.id ? null : e.id)}
                    aria-pressed={active === e.id}
                    aria-label={`Bằng chứng ${shortId(e.id)}`}
                    className={`num ml-1.5 inline-block rounded-xl border px-1.5 align-[1px] text-meta leading-[18px] font-semibold transition-colors ${
                      active === e.id ? "border-action bg-action text-action-ink" : "border-action-text/40 bg-surface text-action-text hover:bg-action-tint"
                    }`}
                  >
                    {shortId(e.id)}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 1 ô frame cắt từ contact sheet 3x2 bằng CSS sprite */
function FrameTile({ src, frame, className }: { src: string; frame: number; className: string }) {
  const col = (frame - 1) % 3;
  const row = Math.floor((frame - 1) / 3);
  return (
    <span
      aria-hidden
      className={`block shrink-0 rounded-xl bg-rule ${className}`}
      style={{ backgroundImage: `url(${src})`, backgroundSize: "300% 200%", backgroundPosition: `${col * 50}% ${row * 100}%` }}
    />
  );
}

/** Mốc thời gian frame: ưu tiên dữ liệu có sẵn, nếu không thì đọc từ text "[frame 4 @34.2s]" */
function frameTimesOf(video: Evidence, observations: Evidence[]): Record<number, number> {
  const out: Record<number, number> = {};
  video.frameTimes?.forEach((t, i) => (out[i + 1] = t));
  for (const o of observations) {
    const m = o.text.match(/\[frame (\d+) @([\d.]+)s\]/);
    if (m) out[Number(m[1])] = Number(m[2]);
  }
  return out;
}

/** Dải swatch: cắt contact sheet 3x2 thành 6 ô frame bằng CSS sprite (không cần xử lý ảnh thêm) */
function FrameStrip({
  video,
  observations,
  active,
  onPick,
}: {
  video: Evidence;
  observations: Evidence[];
  active: Evidence | undefined;
  onPick: (id: string | null) => void;
}) {
  const [count, setCount] = useState<number | null>(video.frameTimes ? video.frameTimes.length : null);
  const scroller = useRef<HTMLDivElement>(null);
  const src = `/api/media/${video.image}`;
  const times = frameTimesOf(video, observations);
  const citedBy = new Map<number, string>();
  observations.forEach((o) => o.frame && !citedBy.has(o.frame) && citedBy.set(o.frame, o.id));
  const activeFrame = active && active.image === video.image ? active.frame ?? null : null;
  const label = video.id.match(/\.v(\d+)\.s$/)?.[1];
  const summary = video.text.replace(/^Video \d+:\s*/, "");

  // Không có frameTimes (run cũ): đọc tỷ lệ ảnh để biết là sheet 6 frame hay chỉ ảnh bìa
  useEffect(() => {
    if (count !== null) return;
    const img = new Image();
    img.onload = () => setCount(img.naturalWidth / img.naturalHeight > 0.7 ? 6 : 1);
    img.src = src;
  }, [src, count]);

  useEffect(() => {
    if (!activeFrame || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-frame="${activeFrame}"]`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [activeFrame]);

  // Chưa biết sheet có mấy frame (đang tải ảnh) -> chỉ 1 ô chờ, tránh hiện 6 ô rỗng sai
  const frames = Array.from({ length: count ?? 1 }, (_, i) => i + 1);
  const cited = [...citedBy.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <div className="min-w-[150px] shrink-0">
      <div className="mb-2 flex items-baseline gap-3">
        <h3 className="text-meta font-semibold" title={summary}>
          Video {label}
          <span className="font-normal text-ink-2">
            {count === 1
              ? " · ảnh bìa"
              : activeFrame
                ? ` · frame ${activeFrame} được trích (${shortId(citedBy.get(activeFrame) ?? "")})`
                : cited.length
                  ? ` · frame ${cited.map(([f]) => f).join(", ")} được trích`
                  : ""}
          </span>
        </h3>
        {video.videoUrl && (
          <a href={video.videoUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-meta font-semibold text-action-text">
            Gốc <ArrowUpRight aria-hidden size={14} />
            <span className="sr-only">: mở video {label} trên TikTok</span>
          </a>
        )}
      </div>
      <div ref={scroller} className="flex items-start gap-2 pt-1">

        {frames.map((f) => {
          const cite = citedBy.get(f);
          const on = activeFrame === f;
          const col = (f - 1) % 3;
          const row = Math.floor((f - 1) / 3);
          return (
            <button
              key={f}
              type="button"
              data-frame={f}
              onClick={() => onPick(cite ? (active?.id === cite ? null : cite) : null)}
              disabled={!cite}
              aria-pressed={on}
              aria-label={`Frame ${f}${times[f] !== undefined ? ` tại ${times[f]} giây` : ""}${cite ? `, được trích ở ${shortId(cite)}` : ""}`}
              className="shrink-0 text-left disabled:cursor-default"
            >
              <span
                className={`block h-[132px] w-[74px] rounded-xl bg-rule outline-2 outline-offset-[3px] transition-[outline-color,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  on ? "-translate-y-1 outline-action" : "outline-transparent"
                }`}
                style={
                  count === 1
                    ? { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { backgroundImage: `url(${src})`, backgroundSize: "300% 200%", backgroundPosition: `${col * 50}% ${row * 100}%` }
                }
              />
              <span className="num mt-1 block text-meta text-ink-2">{times[f] !== undefined ? `${times[f]}s` : `frame ${f}`}</span>
              {cite && <span className={`num block text-meta font-semibold ${on ? "text-action-text" : "text-ink"}`}>{shortId(cite)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tín hiệu nhanh từ dữ liệu Kalodata: view quảng cáo, chuyển đổi, phân khúc giá, đà tăng, kênh liên hệ */
function SignalPills({ pick }: { pick: Pick }) {
  const s = pick.signals;
  if (!s) return null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const items: { text: string; title: string; tone?: "caution" }[] = [];
  if (s.paidViewShare !== undefined)
    items.push({
      text: `${pct(s.paidViewShare)} view từ quảng cáo`,
      title: "Tỷ trọng view video đến từ quảng cáo trả tiền. Reach trong điểm số đã trừ phần này.",
      tone: s.paidViewShare >= 0.5 ? "caution" : undefined,
    });
  if (s.videoGpm) items.push({ text: `${compact(s.videoGpm)} ₫ / 1.000 view`, title: "GPM video: doanh thu trên mỗi 1.000 view (khả năng chuyển đổi)" });
  if (s.avgUnitPriceVnd) items.push({ text: `Khán giả mua ~${compact(s.avgUnitPriceVnd)} ₫/sp`, title: "Giá trung bình sản phẩm khán giả đã mua qua creator" });
  if (s.followerGrowthPct !== undefined) items.push({ text: `+${(s.followerGrowthPct * 100).toFixed(1)}% follower / 30 ngày`, title: "Follower mới trong 30 ngày" });
  if (s.sameCategoryProducts?.length)
    items.push({ text: `Đã bán ${s.sameCategoryProducts.length} sp cùng loại`, title: `Đã bán: ${s.sameCategoryProducts.join("; ")}` });
  if (s.categoryRevenueShare !== undefined)
    items.push({ text: `${pct(s.categoryRevenueShare)} doanh thu trong ngành`, title: "Tỷ trọng doanh thu trong ngành của brief (dữ liệu chuyên sâu)" });
  if (s.analyzedVideoRoas) items.push({ text: `ROAS QC ${s.analyzedVideoRoas.toFixed(1)}`, title: "ROAS quảng cáo trung bình của các video AI xem (dữ liệu chuyên sâu)" });
  items.push(
    s.contactChannels.length
      ? { text: `Liên hệ: ${s.contactChannels.join(", ")}`, title: "Kênh liên hệ công khai trên hồ sơ (xem trên TikTok / Kalodata)" }
      : { text: "Chưa có kênh liên hệ công khai", title: "Liên hệ qua tin nhắn TikTok" },
  );
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tín hiệu nhanh">
      {items.map((it) => (
        <li
          key={it.text}
          title={it.title}
          className={`num rounded-full px-2.5 py-1 text-[12px] leading-none font-medium ${
            it.tone === "caution" ? "bg-caution-tint text-caution" : "bg-sunken text-ink-2"
          }`}
        >
          {it.text}
        </li>
      ))}
    </ul>
  );
}
