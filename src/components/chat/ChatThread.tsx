"use client";

/**
 * Hội thoại lập brief: tin của bạn bên phải, của AI bên trái. Câu hỏi của AI kèm lựa chọn
 * (chọn 1 hoặc nhiều, có "Khác" để tự gõ). Khi đủ thông tin AI đưa thẻ brief để xác nhận.
 */
import { ArrowRight, Check, ChevronDown, Pencil, Search } from "lucide-react";
import { useState } from "react";
import {
  followerWords,
  GENDER_WORD,
  shortMoney,
  type Answer,
  type ChatMessage,
  type Question,
} from "@/lib/brief/slots";
import type { CampaignBrief } from "@/lib/types";
import { AiAvatar, UserAvatar } from "./Avatars";

const OPTIONAL = new Set(["followers", "usp"]);

export function ChatThread({
  messages,
  pending = false,
  onAnswer,
  onStart,
  onEdit,
  starting = false,
  readOnly = false,
}: {
  messages: ChatMessage[];
  pending?: boolean;
  onAnswer?: (a: Answer, text: string) => void;
  onStart?: (b: CampaignBrief) => void;
  onEdit?: () => void;
  starting?: boolean;
  readOnly?: boolean;
}) {
  const lastAiIdx = messages.findLastIndex((m) => m.role === "assistant");
  return (
    <ol className="space-y-7" aria-live="polite" aria-busy={pending}>
      {messages.map((m, i) => {
        if (m.role === "user") return <UserMessage key={m.id} m={m} />;
        // Câu trả lời cho câu hỏi này (nếu đã trả lời) nằm ở tin user ngay sau
        const reply =
          messages[i + 1]?.role === "user" ? messages[i + 1] : undefined;
        const active = !readOnly && i === lastAiIdx && !reply && !pending;
        return (
          <AiMessage key={m.id}>
            <p className="whitespace-pre-line">{m.text}</p>
            {m.question && (
              <QuestionCard
                key={m.question.id}
                q={m.question}
                answer={reply?.answer}
                answeredFree={!!reply && !reply.answer}
                active={active}
                onAnswer={onAnswer}
              />
            )}
            {m.brief && !readOnly && (
              <BriefCard
                brief={m.brief}
                latest={i === lastAiIdx && !reply}
                readOnly={readOnly}
                onStart={onStart}
                onEdit={onEdit}
                starting={starting}
              />
            )}
          </AiMessage>
        );
      })}
      {pending && (
        <AiMessage>
          <p className="flex items-center gap-2 text-ink-2">
            <span className="typing inline-flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 rounded-full bg-ink-2" />
              <span className="h-1.5 w-1.5 rounded-full bg-ink-2" />
              <span className="h-1.5 w-1.5 rounded-full bg-ink-2" />
            </span>
            Đang đọc brief của bạn…
          </p>
        </AiMessage>
      )}
    </ol>
  );
}

export function AiMessage({ children }: { children: React.ReactNode }) {
  return (
    <li className="rise-in grid grid-cols-[36px_minmax(0,1fr)] gap-x-3">
      <AiAvatar />
      <div className="min-w-0 pt-1.5">
        <div className="mb-1 text-meta font-semibold text-ink-2">
          Trợ lý brief
        </div>
        <div className="max-w-[68ch] space-y-4">{children}</div>
      </div>
    </li>
  );
}

function UserMessage({ m }: { m: ChatMessage }) {
  return (
    <li className="rise-in flex items-start justify-end gap-3">
      <div className="max-w-[min(560px,85%)] rounded-[2px] bg-shell px-4 py-3 text-shell-ink">
        {m.fromForm && (
          <div className="mb-1.5 text-meta font-semibold text-shell-ink-2">
            Brief điền từ form
          </div>
        )}
        <p className="whitespace-pre-line">{m.text}</p>
      </div>
      <UserAvatar />
    </li>
  );
}

function QuestionCard({
  q,
  answer,
  answeredFree,
  active,
  onAnswer,
}: {
  q: Question;
  answer?: Answer;
  answeredFree: boolean;
  active: boolean;
  onAnswer?: (a: Answer, text: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");
  const chosen = answer?.values ?? picked;
  const label = (v: string) => q.options.find((o) => o.value === v)?.label ?? v;

  const send = (values: string[], otherText?: string) => {
    const t =
      [...values.map(label), otherText].filter(Boolean).join(", ") || "Bỏ qua";
    onAnswer?.(
      { questionId: q.id, slot: q.slot, values, other: otherText || undefined },
      t,
    );
  };

  const groupId = `q-${q.id}`;
  return (
    <div className="rounded-[2px] border border-rule bg-surface p-4">
      <p id={groupId} className="font-semibold text-ink">
        {q.text}
      </p>
      <p className="mt-0.5 text-meta text-ink-2">
        {q.mode === "multi" ? "Chọn một hoặc nhiều" : "Chọn một"}
      </p>
      <div
        role={q.mode === "multi" ? "group" : "radiogroup"}
        aria-labelledby={groupId}
        className="mt-3 flex flex-wrap gap-2"
      >
        {q.options.map((o) => {
          const on = chosen.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={q.mode === "multi" ? "checkbox" : "radio"}
              aria-checked={on}
              disabled={!active}
              className="chip"
              onClick={() => {
                if (q.mode === "single") send([o.value]);
                else
                  setPicked(
                    on
                      ? picked.filter((x) => x !== o.value)
                      : [...picked, o.value],
                  );
              }}
            >
              {q.mode === "multi" && (
                <Check
                  aria-hidden
                  size={14}
                  strokeWidth={2.5}
                  className="chip-check"
                />
              )}
              {o.label}
              {o.hint && (
                <span className="num text-meta text-ink-2">{o.hint}</span>
              )}
            </button>
          );
        })}
        {q.allowOther && (
          <button
            type="button"
            className="chip"
            role={q.mode === "multi" ? "checkbox" : "radio"}
            aria-checked={otherOpen || !!answer?.other}
            aria-expanded={otherOpen}
            disabled={!active}
            onClick={() => setOtherOpen(!otherOpen)}
          >
            <Pencil aria-hidden size={13} /> Khác
          </button>
        )}
      </div>

      {answer?.other && (
        <p className="mt-2 text-meta text-ink-2">Bạn ghi: “{answer.other}”</p>
      )}
      {answeredFree && !answer && (
        <p className="mt-2 text-meta text-ink-2">
          Bạn đã trả lời bằng tin nhắn.
        </p>
      )}

      {active && otherOpen && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim())
              send(q.mode === "multi" ? picked : [], other.trim());
          }}
        >
          <input
            autoFocus
            className="field"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder={q.otherPlaceholder ?? "Câu trả lời của bạn"}
            aria-label="Câu trả lời khác"
          />
          <button className="btn shrink-0" disabled={!other.trim()}>
            Gửi
          </button>
        </form>
      )}

      {active && (q.mode === "multi" || OPTIONAL.has(q.slot)) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {q.mode === "multi" && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!picked.length}
              onClick={() => send(picked, otherOpen ? other.trim() : undefined)}
            >
              Xác nhận{picked.length ? ` (${picked.length})` : ""}
            </button>
          )}
          {OPTIONAL.has(q.slot) && (
            <button
              type="button"
              className="text-meta font-semibold text-ink-2 hover:text-ink hover:underline"
              onClick={() => send([])}
            >
              Bỏ qua, dùng mặc định
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Thẻ brief hoàn chỉnh để xác nhận trước khi chạy */
export function BriefCard({
  brief: b,
  latest = true,
  readOnly = false,
  onStart,
  onEdit,
  starting = false,
  collapsible = false,
}: {
  brief: CampaignBrief;
  latest?: boolean;
  readOnly?: boolean;
  onStart?: (b: CampaignBrief) => void;
  onEdit?: () => void;
  starting?: boolean;
  /** Trang chiến dịch: mặc định chỉ hiện 1 dòng tóm tắt, bấm để xem đủ */
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const money = b.budgetInput
    ? shortMoney(b.budgetInput.amount, b.budgetInput.currency)
    : shortMoney(b.budgetVnd, "VND");
  const per = shortMoney(
    Math.round(b.budgetVnd / b.numKocs / 1e5) * 1e5,
    "VND",
  );
  const rows: [string, React.ReactNode][] = [
    [
      "Sản phẩm",
      <>
        {b.product}
        {b.brand !== b.product && (
          <span className="text-ink-2"> · {b.brand}</span>
        )}
      </>,
    ],
    [
      "Khách hàng",
      `${GENDER_WORD[b.targetAudience.gender]}, ${b.targetAudience.ageMin}–${b.targetAudience.ageMax} tuổi`,
    ],
    [
      "Ngân sách",
      <>
        {money} <span className="text-ink-2">· khoảng {per} mỗi KOC</span>
      </>,
    ],
    ["Số KOC", `${b.numKocs} KOC`],
    [
      "Quy mô",
      b.followerRange
        ? followerWords(b.followerRange.min, b.followerRange.max)
        : "Micro, Mid",
    ],
  ];
  if (b.productNotes) rows.push(["Điểm nổi bật", b.productNotes]);
  return (
    <div
      className={`rounded-[2px] border bg-surface ${latest ? "border-rule-strong" : "border-rule opacity-70"}`}
    >
      <div
        className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 ${open ? "border-b border-rule" : ""}`}
      >
        <h3 className="condensed text-title font-extrabold">Brief</h3>
        {!latest && (
          <span className="text-meta text-ink-2">
            Đã được cập nhật bên dưới
          </span>
        )}
        {/* Brief sẵn sàng được "đóng dấu" như verdict của KOC */}
        {latest && !readOnly && (
          <span
            role="img"
            aria-label="Brief đã đủ thông tin"
            className="compressed relative inline-grid h-[52px] w-[52px] shrink-0 -rotate-6 place-items-center self-center rounded-full border-2 border-current text-center text-[12px] leading-[1.05] font-extrabold text-good uppercase"
          >
            <span aria-hidden className="absolute inset-[4px] rounded-full border border-current" />
            <span className="max-w-[38px]">Đủ brief</span>
          </span>
        )}
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 text-meta font-semibold text-ink-2 hover:text-ink"
          >
            {open ? "Thu gọn" : "Xem đủ brief"}
            <ChevronDown
              aria-hidden
              size={14}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
        {!open && (
          <p className="num w-full text-ink">
            {b.product} · {GENDER_WORD[b.targetAudience.gender]}{" "}
            {b.targetAudience.ageMin}–{b.targetAudience.ageMax} · {money} ·{" "}
            {b.numKocs} KOC
          </p>
        )}
      </div>
      {open && (
        <dl className="divide-y divide-rule px-4">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-1 gap-x-4 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)]"
            >
              <dt className="text-meta text-ink-2 sm:pt-0.5">{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-x-4 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)]">
            <dt className="text-meta text-ink-2 sm:pt-1">Từ khoá</dt>
            <dd className="flex flex-wrap gap-1.5">
              {b.keywords.slice(0, 10).map((k) => (
                <span
                  key={k}
                  className="rounded-[2px] bg-ground px-2 py-0.5 text-meta"
                >
                  {k}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      )}
      {latest && !readOnly && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule px-4 py-4">
          <button
            type="button"
            className="btn btn-primary"
            disabled={starting}
            onClick={() => onStart?.(b)}
          >
            <Search aria-hidden size={16} strokeWidth={2.25} />
            {starting ? "Đang tạo chiến dịch…" : "Bắt đầu tìm creator"}
            {!starting && <ArrowRight aria-hidden size={16} />}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onEdit}
            disabled={starting}
          >
            <Pencil aria-hidden size={15} /> Sửa brief
          </button>
          <p className="w-full text-meta text-ink-2">
            Mất khoảng 2–3 phút. Bạn có thể rời trang, chiến dịch vẫn tiếp tục
            chạy.
          </p>
        </div>
      )}
    </div>
  );
}
