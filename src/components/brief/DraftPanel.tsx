/** Cột bên phải lúc chat: brief đang được điền dần, mục nào đã có / còn thiếu */
import { Check } from "lucide-react";
import { followerWords, GENDER_WORD, shortMoney, type BriefDraft } from "@/lib/brief/slots";

export function DraftPanel({ draft: d }: { draft: BriefDraft }) {
  const items: { label: string; value: string | null; required?: boolean }[] = [
    { label: "Sản phẩm", value: d.product ?? null, required: true },
    { label: "Khách hàng", value: d.gender ? GENDER_WORD[d.gender] : null, required: true },
    { label: "Độ tuổi", value: d.ageMin !== undefined ? `${d.ageMin}–${d.ageMax}` : null, required: true },
    { label: "Ngân sách", value: d.budget ? shortMoney(d.budget.amount, d.budget.currency) : null, required: true },
    { label: "Số KOC", value: d.numKocs ? `${d.numKocs} KOC` : null, required: true },
    { label: "Quy mô", value: d.followerMin !== undefined && d.followerMax !== undefined ? followerWords(d.followerMin, d.followerMax) : null },
    { label: "Điểm nổi bật", value: d.productNotes ?? null },
  ];
  const done = items.filter((i) => i.required && i.value).length;
  const total = items.filter((i) => i.required).length;
  return (
    <section aria-labelledby="draft-title">
      <div className="flex items-baseline justify-between border-b border-rule-strong pb-2">
        <h2 id="draft-title" className="font-semibold">
          Brief đang có
        </h2>
        <span className="num text-meta text-ink-2">
          {done}/{total} mục chính
        </span>
      </div>
      <ul className="divide-y divide-rule">
        {items.map((i) => (
          <li key={i.label} className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2.5 py-2.5">
            <span className={`mt-0.5 grid h-[18px] w-[18px] place-items-center rounded-full ${i.value ? "bg-good-fill text-white" : "border border-rule-strong"}`}>
              {i.value && <Check aria-hidden size={11} strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <div className="text-meta text-ink-2">
                {i.label}
                {!i.required && " · tuỳ chọn"}
              </div>
              <div className={`num ${i.value ? "text-ink" : "text-ink-3"}`}>{i.value ?? (i.required ? "Chưa có" : "Dùng mặc định")}</div>
            </div>
          </li>
        ))}
      </ul>
      {d.keywords && d.keywords.length > 0 && (
        <div className="mt-4">
          <div className="text-meta text-ink-2">Từ khoá AI gợi ý</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {d.keywords.slice(0, 8).map((k) => (
              <span key={k} className="rounded-full bg-surface px-2.5 py-0.5 text-meta ring-1 ring-rule">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
