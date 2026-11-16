"use client";

/**
 * Màn "Brief mới" có 2 trạng thái:
 *  1. Bắt đầu: form điền nhanh ở trên + ô chat ở đáy (có gợi ý) cho ai muốn kể bằng lời.
 *  2. Hội thoại: sau lần gửi đầu (form hoặc chat), màn hình thành phiên chat bạn <-> AI.
 *     AI hỏi thêm phần thiếu kèm lựa chọn; đủ thì đưa thẻ brief -> "Bắt đầu tìm creator".
 */
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { draftSummaryText, type Answer, type BriefDraft, type ChatMessage } from "@/lib/brief/slots";
import type { CampaignBrief } from "@/lib/types";
import { ChatThread } from "../chat/ChatThread";
import { Composer } from "../chat/Composer";
import { BriefForm } from "./BriefForm";
import { DraftPanel } from "./DraftPanel";

const newId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface TurnResult {
  message: ChatMessage;
  draft: BriefDraft;
  ready: boolean;
  missing: string[];
}

export function NewBrief({ sample }: { sample: BriefDraft }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<BriefDraft>({ numKocs: 5 });
  const [editing, setEditing] = useState(false);
  // Đang điền form thì ẩn bong bóng gợi ý của ô chat cho đỡ che
  const [formTouched, setFormTouched] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chatting = messages.length > 0;

  const turn = useMutation({
    mutationFn: async (vars: { draft: BriefDraft; messages: ChatMessage[] }) => {
      const res = await fetch("/api/brief/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(vars),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI chưa trả lời được.");
      return json as TurnResult;
    },
    onSuccess: (r) => {
      setMessages((m) => [...m, r.message]);
      setDraft(r.draft);
    },
  });

  const start = useMutation({
    mutationFn: async (brief: CampaignBrief) => {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, chat: messages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Chưa tạo được chiến dịch.");
      return json.id as string;
    },
    onSuccess: (id) => router.push(`/runs/${id}`),
  });

  const send = (msg: Omit<ChatMessage, "id" | "ts" | "role">, nextDraft = draft) => {
    const m: ChatMessage = { ...msg, id: newId(), ts: Date.now(), role: "user" };
    const all = [...messages, m];
    setMessages(all);
    setDraft(nextDraft);
    setEditing(false);
    turn.mutate({ draft: nextDraft, messages: all });
  };

  const retry = () => turn.mutate({ draft, messages });

  // Tin mới -> cuộn tới cuối hội thoại
  const scrollKey = `${messages.length}:${turn.isPending}:${editing}`;
  useEffect(() => {
    if (messages.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [scrollKey, messages.length]);

  const submitForm = (d: BriefDraft) => send({ text: draftSummaryText(d), fromForm: true }, d);
  const sendText = (text: string) => send({ text });
  const answer = (a: Answer, text: string) => send({ text, answer: a });

  return (
    <div className={chatting ? "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-14" : ""}>
      <div className="min-w-0">
        {!chatting && <p className="mb-8 max-w-[62ch] text-ink-2">Cho chúng tôi biết bạn cần KOC cho sản phẩm nào. Điền nhanh bên dưới, hoặc kể cho AI ở ô chat cuối trang.</p>}
        {!chatting ? (
          <section aria-labelledby="form-title" onFocusCapture={() => setFormTouched(true)} className="rounded-[2px] border border-rule bg-surface p-5 sm:p-7">
            <h2 id="form-title" className="text-title font-bold">
              Điền nhanh
            </h2>
            <p className="mt-1 mb-6 text-ink-2">Bấm chọn là xong, chỉ cần gõ tên sản phẩm. Chưa chắc phần nào thì kể cho AI ở ô chat bên dưới.</p>
            <BriefForm initial={draft} onSubmit={submitForm} sample={sample} busy={turn.isPending} />
          </section>
        ) : (
          <ChatThread
            messages={messages}
            pending={turn.isPending}
            onAnswer={answer}
            onStart={(b) => start.mutate(b)}
            onEdit={() => setEditing(true)}
            starting={start.isPending || start.isSuccess}
          />
        )}

        {turn.isError && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-[2px] border border-risk bg-risk-tint px-4 py-3 text-meta">
            <span className="text-ink">{turn.error.message}</span>
            <button type="button" className="font-semibold text-risk underline" onClick={retry}>
              Thử lại
            </button>
          </div>
        )}
        {start.isError && (
          <p role="alert" className="mt-6 rounded-[2px] border border-risk bg-risk-tint px-4 py-3 text-meta text-ink">
            {start.error.message}
          </p>
        )}

        {editing && (
          <section aria-label="Sửa brief" className="rise-in mt-7 ml-auto max-w-[680px] rounded-[2px] border border-rule-strong bg-surface p-5 sm:p-6">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2 className="text-title font-bold">Sửa brief</h2>
              <button type="button" className="text-meta font-semibold text-ink-2 hover:text-ink hover:underline" onClick={() => setEditing(false)}>
                Huỷ
              </button>
            </div>
            <BriefForm initial={draft} onSubmit={submitForm} submitLabel="Cập nhật brief" busy={turn.isPending} />
          </section>
        )}

        <div ref={endRef} className="h-px scroll-mb-40" />

        <div className="sticky bottom-0 z-[var(--z-sticky)] -mx-5 mt-8 bg-ground/95 px-5 pt-3 pb-5 backdrop-blur-[2px] md:-mx-0 md:px-0">
          <Composer
            onSend={sendText}
            disabled={turn.isPending || start.isPending}
            attention={!chatting}
            hint={!chatting && !formTouched}
            placeholder={chatting ? "Trả lời, hoặc bổ sung thông tin…" : "Hoặc kể cho AI: sản phẩm, khách hàng, ngân sách…"}
          />
        </div>
      </div>

      {chatting && (
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <DraftPanel draft={draft} />
          </div>
        </aside>
      )}
    </div>
  );
}
