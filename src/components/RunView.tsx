"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, ChevronRight, MessagesSquare, Pause, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CREDIT_USD } from "@/lib/brief/paid";
import { AiMessage, BriefCard, ChatThread } from "./chat/ChatThread";
import { KocReview } from "./KocReview";
import { Costs, Log } from "./RunPanels";
import type { Pick, RunDetail } from "./runTypes";
import { StepProcess } from "./StepProcess";
import { compact, LedgerFigure, millions, Seal, Shell, StatusTag } from "./ui";

const LIVE = new Set(["queued", "running"]);
const readKey = (runId: string) => `koc-read:${runId}`;

/**
 * KOC "đã xem" theo run, lưu trong trình duyệt (tiện ích cá nhân; storage bị chặn thì chỉ mất dấu).
 * useSyncExternalStore: đọc localStorage an toàn với SSR, không setState trong effect.
 */
function useReadMarks(runId: string): [Set<string>, (id: string) => void] {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("koc-read", cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener("koc-read", cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(readKey(runId)) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const set = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const mark = useCallback(
    (id: string) => {
      if (set.has(id)) return;
      try {
        localStorage.setItem(readKey(runId), JSON.stringify([...set, id]));
        window.dispatchEvent(new Event("koc-read"));
      } catch {
        /* storage bị chặn: bỏ qua */
      }
    },
    [runId, set],
  );
  return [set, mark];
}

export function RunView({ id }: { id: string }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [read, markRead] = useReadMarks(id);
  const reviewRef = useRef<HTMLDivElement>(null);

  // TanStack Query: poll 1.5s khi chiến dịch đang chạy, xong thì dừng
  const q = useQuery({
    queryKey: ["run", id],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("load failed");
      return (await res.json()) as RunDetail;
    },
    refetchInterval: (query) => (query.state.data && LIVE.has(query.state.data.run.status) ? 1500 : false),
  });
  const act = useMutation({
    mutationFn: (action: "stop" | "resume") => fetch(`/api/runs/${id}/${action}`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["run", id] }),
  });

  const select = (pickId: string) => {
    setSel(pickId);
    markRead(pickId);
    if (window.innerWidth < 1280) reviewRef.current?.scrollIntoView({ block: "start" });
  };

  if (q.data === null)
    return (
      <>
        <Shell />
        <main className="mx-auto max-w-[1200px] px-5 py-16 md:px-10">
          <h1 className="text-display font-semibold">Không tìm thấy chiến dịch</h1>
          <p className="mt-2 text-ink-2">Chiến dịch có thể đã bị xoá. Quay lại danh sách để mở chiến dịch khác.</p>
          <Link href="/" className="btn mt-6 no-underline">
            <ArrowLeft aria-hidden size={15} /> Chiến dịch
          </Link>
        </main>
      </>
    );
  if (!q.data)
    return (
      <>
        <Shell />
        <p className="mx-auto max-w-[1200px] px-5 py-16 text-ink-2 md:px-10">{q.isError ? "Không tải được chiến dịch. Thử tải lại trang." : "Đang tải chiến dịch…"}</p>
      </>
    );

  const d = q.data;
  const { run, report, usage } = d;
  const b = run.brief;
  const picks = report?.picks ?? [];
  const current = [...picks, ...(report?.alternates ?? [])].find((p) => p.id === sel) ?? picks[0];
  const totalUsd = usage.total.costUsd + usage.data.credits * CREDIT_USD;
  const busy = act.isPending;
  const finished = run.status === "completed" && !!report && !!current;

  return (
    <>
      <Shell
        aside={
          <>
            <LedgerFigure value={`≈ $${totalUsd.toFixed(2)}`} label={`chi phí · ${minutes(run.activeMs)}`} />
            {run.status === "running" && (
              <button className="btn" disabled={busy} onClick={() => act.mutate("stop")}>
                <Pause aria-hidden size={15} /> Tạm dừng
              </button>
            )}
            {(run.status === "interrupted" || run.status === "failed") && (
              <button className="btn btn-primary" disabled={busy} onClick={() => act.mutate("resume")}>
                <RotateCcw aria-hidden size={15} /> Chạy tiếp
              </button>
            )}
            {run.status === "completed" && (
              <Link href="/new" className="btn no-underline">
                <Plus aria-hidden size={15} /> Brief mới
              </Link>
            )}
          </>
        }
      >
        <nav aria-label="Vị trí" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
          <Link href="/" className="text-ink-2 no-underline hover:text-ink hover:underline">
            Chiến dịch
          </Link>
          <ChevronRight aria-hidden size={14} className="text-ink-3" />
          <span className="font-semibold text-ink">{b.product}</span>
          <span className="ml-3">
            <StatusTag status={run.status} />
          </span>
        </nav>
      </Shell>

      <main className="mx-auto max-w-[1200px] px-5 pt-8 pb-20 md:px-10">
        <h1 className="sr-only">Chiến dịch {b.product}</h1>
        {run.config.provider === "mock" && (
          <p className="mb-6 rounded-xl border border-caution/30 bg-caution-tint px-4 py-3 text-meta">
            Chiến dịch chạy bằng AI giả lập: điểm và lý do chỉ để xem luồng, không phải đánh giá thật.
          </p>
        )}
        {run.error && (
          <div role="alert" className="mb-6 rounded-xl border border-risk/30 bg-risk-tint px-4 py-3 text-meta">
            <b className="text-risk">Chiến dịch dừng vì lỗi.</b> {friendlyError(run.error)} Các bước đã xong được giữ nguyên, bấm “Chạy tiếp” để thử lại từ chỗ dở.
          </div>
        )}

        {/* Phiên làm việc: brief đã chốt -> quy trình từng bước */}
        <section aria-label="Phiên tìm creator" className="max-w-[860px]">
          <ol className="space-y-7">
            {d.chat.length > 0 && (
              <li>
                <button
                  type="button"
                  aria-expanded={showChat}
                  onClick={() => setShowChat(!showChat)}
                  className="inline-flex items-center gap-1.5 text-meta font-semibold text-ink-2 hover:text-ink"
                >
                  <MessagesSquare aria-hidden size={15} />
                  {showChat ? "Ẩn hội thoại lập brief" : `Xem lại hội thoại lập brief (${d.chat.length} tin)`}
                  <ChevronDown aria-hidden size={15} className={`transition-transform ${showChat ? "rotate-180" : ""}`} />
                </button>
                {showChat && (
                  <div className="mt-6 border-b border-rule pb-8">
                    <ChatThread messages={d.chat} readOnly />
                  </div>
                )}
              </li>
            )}
            {finished ? (
              // Đã xong: kết quả là thứ cần thấy trước; brief + 8 bước thu vào 1 dòng, mở khi cần
              <AiMessage>
                <p>{sessionLine(run.status, d)}</p>
                <BriefCard brief={b} readOnly collapsible />
                <button
                  type="button"
                  aria-expanded={showSteps}
                  aria-controls="run-steps"
                  onClick={() => setShowSteps(!showSteps)}
                  className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-action-text"
                >
                  {showSteps ? "Ẩn quy trình" : `Xem ${d.steps.length} bước đã làm`}
                  <ChevronDown aria-hidden size={16} className={`transition-transform ${showSteps ? "rotate-180" : ""}`} />
                </button>
                {showSteps && (
                  <div id="run-steps">
                    <StepProcess steps={d.steps} />
                  </div>
                )}
              </AiMessage>
            ) : (
              <>
                <AiMessage>
                  <p>{d.chat.length ? "Brief đã chốt:" : "Brief của chiến dịch:"}</p>
                  <BriefCard brief={b} readOnly collapsible />
                </AiMessage>
                <AiMessage>
                  <p>{sessionLine(run.status, d)}</p>
                  <StepProcess steps={d.steps} />
                </AiMessage>
              </>
            )}
          </ol>
        </section>

        {report && current && (
          <section aria-label="Kết quả" className="mt-10 border-t border-rule-strong pt-10">
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
              <Ranking report={report} selected={current.id} read={read} onSelect={select} />
              <div ref={reviewRef} className="card min-w-0 scroll-mt-24 p-5 sm:p-8">
                <KocReview key={current.id} pick={current} onRead={() => markRead(current.id)} />
              </div>
            </div>
          </section>
        )}

        <details className="disclosure mt-16 border-t border-rule pt-5">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
            <ChevronRight aria-hidden size={16} className="chev text-ink-2" />
            Chi phí và nhật ký kỹ thuật
            <span className="font-normal text-ink-2">· cho người vận hành</span>
          </summary>
          <div className="mt-6 space-y-12">
            {run.error && (
              <p className="num rounded-xl border border-rule bg-surface px-4 py-3 text-meta">
                <b>Lỗi:</b> {run.error}
              </p>
            )}
            <Costs d={d} />
            <div>
              <h3 className="text-body font-semibold">Nhật ký</h3>
              <div className="mt-3 border-t border-rule pt-3">
                <Log d={d} />
              </div>
            </div>
          </div>
        </details>
      </main>
    </>
  );
}

/** Lỗi thường gặp -> câu dễ hiểu cho marketer */
function friendlyError(e: string) {
  if (/kalodata/i.test(e) && /key/i.test(e)) return "Nguồn dữ liệu creator đang từ chối truy cập, cần người quản trị kiểm tra kết nối.";
  if (/budget|credit/i.test(e)) return "Đã chạm giới hạn chi phí dữ liệu cho phép.";
  if (/anthropic|openai|429|overloaded/i.test(e)) return "Dịch vụ AI tạm thời quá tải hoặc từ chối yêu cầu.";
  return "Một bước xử lý gặp sự cố.";
}

const minutes = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút ${s % 60} giây`;
};

function sessionLine(status: string, d: RunDetail) {
  const done = d.steps.filter((s) => s.status === "done").length;
  if (status === "completed") {
    const n = d.report?.picks.length ?? 0;
    const took = d.run.activeMs < 2000 ? "Xong ngay vì dùng lại kết quả đã phân tích trước đó" : `Xong sau ${minutes(d.run.activeMs)}`;
    return `${took}. Mình đã đi qua ${d.steps.length} bước và chọn ra ${n} KOC, xem bên dưới.`;
  }
  if (status === "queued") return "Chiến dịch đang chờ chạy…";
  if (status === "running") return `Mình đang tìm creator theo ${d.steps.length} bước (xong ${done}/${d.steps.length}). Bạn có thể rời trang, chiến dịch vẫn chạy tiếp.`;
  if (status === "interrupted") return `Chiến dịch tạm dừng ở bước ${done + 1}/${d.steps.length}. Phần đã xong được giữ lại, bấm “Chạy tiếp” để làm nốt.`;
  return `Chiến dịch dừng ở bước ${done + 1}/${d.steps.length}.`;
}

// Cột bảng xếp hạng: mobile gộp follower/booking vào dòng phụ; từ sm có cột số riêng, căn phải
const ROW_COLS = "grid-cols-[34px_minmax(0,1fr)_84px_48px] sm:grid-cols-[34px_minmax(0,1fr)_52px_56px_84px_48px]";

function Ranking({
  report,
  selected,
  read,
  onSelect,
}: {
  report: NonNullable<RunDetail["report"]>;
  selected: string;
  read: Set<string>;
  onSelect: (id: string) => void;
}) {
  const { picks, alternates, totals } = report;
  const used = Math.min(1, totals.estCostVnd / totals.budgetVnd);
  return (
    <section aria-labelledby="rank-title" className="card min-w-0 p-5 sm:p-7 xl:sticky xl:top-24">
      <h2 id="rank-title" className="text-title font-semibold">
        {picks.length} KOC đề xuất
      </h2>
      <div aria-hidden className={`mt-4 grid ${ROW_COLS} items-end gap-x-3 border-b border-rule-strong px-2 pb-2 text-meta text-ink-2`}>
        <span>#</span>
        <span>Creator</span>
        <span className="hidden text-right sm:block">Follower</span>
        <span className="hidden text-right sm:block">Chi phí</span>
        <span className="text-center">Đánh giá</span>
        <span className="text-right">Điểm</span>
      </div>
      <ol>
        {picks.map((p) => (
          <Row key={p.id} p={p} on={p.id === selected} read={read.has(p.id)} onSelect={onSelect} />
        ))}
      </ol>
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-meta">
          <span className="text-ink-2">Chi phí booking ước tính</span>
          <span className="num font-semibold">
            {millions(totals.estCostVnd)} <span className="font-normal text-ink-2">/ {millions(totals.budgetVnd)}</span>
          </span>
        </div>
        <div className="mt-1.5 h-[3px] bg-rule" aria-hidden>
          <div className="h-full origin-left bg-ink" style={{ transform: `scaleX(${used})` }} />
        </div>
        <p className="mt-1.5 text-meta text-ink-2">Chi phí theo bảng giá ước tính theo tier follower, chưa phải báo giá thật.</p>
      </div>
      {alternates.length > 0 && (
        <details className="disclosure mt-8">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 border-b border-rule-strong pb-2 text-body font-semibold">
            <ChevronRight aria-hidden size={16} className="chev text-ink-2" />
            Dự phòng ({alternates.length})
          </summary>
          <ol>
            {alternates.map((p) => (
              <Row key={p.id} p={p} on={p.id === selected} read={read.has(p.id)} onSelect={onSelect} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function Row({ p, on, read, onSelect }: { p: Pick; on: boolean; read: boolean; onSelect: (id: string) => void }) {
  return (
    <li className="border-b border-rule">
      <button
        type="button"
        onClick={() => onSelect(p.id)}
        aria-pressed={on}
        className={`grid w-full ${ROW_COLS} items-center gap-x-3 px-2 py-3 text-left transition-colors rounded-xl ${on ? "bg-action-tint" : "hover:bg-ground/60"}`}
      >
        <span className={`num text-title font-semibold ${on ? "text-action-text" : "text-ink-3"}`}>{String(p.rank).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold">@{p.handle}</span>
            {read && (
              <span className={`inline-flex shrink-0 items-center ${on ? "text-action-text" : "text-ink-3"}`} title="Đã xem">
                <Check aria-hidden size={14} strokeWidth={2.25} />
                <span className="sr-only">Đã xem</span>
              </span>
            )}
          </span>
          <span className="num block text-meta text-ink-2">
            <span className="sm:hidden">
              {compact(p.followers)} · {millions(p.estCostVnd)}
            </span>
            <span className="hidden sm:inline">{p.nickname}</span>
            {!p.videoAnalyzed && " · chưa xem video"}
          </span>
        </span>
        <span className="num hidden text-right sm:block">{compact(p.followers)}</span>
        <span className="num hidden text-right sm:block">{millions(p.estCostVnd)}</span>
        <span className="flex justify-center">
          <Seal verdict={p.verdict} />
        </span>
        <span className="text-right">
          <span className="condensed num block text-title leading-none font-bold">{p.scores.final.toFixed(1)}</span>
          <span className="num mt-1 block text-meta text-ink-2">AI {p.scores.fit}</span>
        </span>
      </button>
    </li>
  );
}
