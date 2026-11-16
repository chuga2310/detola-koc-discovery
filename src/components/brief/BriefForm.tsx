"use client";

/**
 * Form brief (react-hook-form + zod). Chọn bằng chip là chính, chỉ sản phẩm và tiền mới phải gõ.
 * Submit ra BriefDraft -> NewBrief gửi vào hội thoại để AI kiểm tra và hỏi thêm phần thiếu.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Send } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  AGE_BANDS,
  ageFromBands,
  BUDGET_PRESETS,
  bandsFromAge,
  DEFAULT_FOLLOWERS,
  FOLLOWER_TIERS,
  followersFromTiers,
  GENDER_OPTIONS,
  tiersFromFollowers,
  type BriefDraft,
} from "@/lib/brief/slots";
import { BudgetField, ChipGroup, Stepper, TagInput } from "./controls";

const FormSchema = z
  .object({
    product: z.string().trim().min(2, "Nhập tên sản phẩm cần quảng bá."),
    brand: z.string().trim().optional(),
    gender: z.enum(["female", "male", "any"], { message: "Chọn nhóm khách hàng." }),
    ageBands: z.array(z.string()).min(1, "Chọn ít nhất một nhóm tuổi."),
    currency: z.enum(["VND", "USD"]),
    budget: z.number({ message: "Nhập hoặc chọn ngân sách." }).positive("Nhập hoặc chọn ngân sách."),
    numKocs: z.number().int().min(1).max(50),
    tiers: z.array(z.string()).min(1, "Chọn ít nhất một quy mô."),
    productNotes: z.string().trim().optional(),
    keywords: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    const min = v.currency === "USD" ? 50 : 1_000_000;
    if (v.budget < min)
      ctx.addIssue({ code: "custom", path: ["budget"], message: v.currency === "USD" ? "Ngân sách tối thiểu $50." : "Ngân sách tối thiểu 1 triệu ₫." });
  });

export type BriefFormValues = z.input<typeof FormSchema>;

export function draftToForm(d: BriefDraft): BriefFormValues {
  return {
    product: d.product ?? "",
    brand: d.brand ?? "",
    gender: d.gender as BriefFormValues["gender"],
    ageBands: bandsFromAge(d.ageMin, d.ageMax),
    // Mặc định là 1 mức có sẵn (30 triệu) để chip được chọn ngay từ đầu
    currency: d.budget?.currency ?? "VND",
    budget: d.budget?.amount ?? BUDGET_PRESETS.VND[2],
    numKocs: d.numKocs ?? 5,
    tiers: tiersFromFollowers(d.followerMin ?? DEFAULT_FOLLOWERS.min, d.followerMax ?? DEFAULT_FOLLOWERS.max),
    productNotes: d.productNotes ?? "",
    keywords: d.keywords ?? [],
  };
}

function formToDraft(v: z.output<typeof FormSchema>, base: BriefDraft): BriefDraft {
  return {
    ...base,
    product: v.product,
    brand: v.brand || undefined,
    gender: v.gender,
    ...ageFromBands(v.ageBands)!,
    budget: { amount: v.budget, currency: v.currency },
    numKocs: v.numKocs,
    ...followersFromTiers(v.tiers)!,
    productNotes: v.productNotes || undefined,
    keywords: v.keywords.length ? v.keywords : base.keywords,
  };
}

export function BriefForm({
  initial,
  onSubmit,
  submitLabel = "Gửi brief",
  busy = false,
  sample,
}: {
  initial: BriefDraft;
  onSubmit: (d: BriefDraft) => void;
  submitLabel?: string;
  busy?: boolean;
  /** Brief mẫu (đề bài) để điền nhanh khi demo */
  sample?: BriefDraft;
}) {
  // Phần draft form không hiển thị (từ khoá tìm video, category...) giữ theo nguồn gần nhất: initial hoặc brief mẫu
  const [base, setBase] = useState(initial);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BriefFormValues, unknown, z.output<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: draftToForm(initial),
  });
  // useWatch (thay vì watch) để React Compiler tối ưu được component
  const ageBands = useWatch({ control, name: "ageBands" });
  const tiers = useWatch({ control, name: "tiers" });
  const numKocs = useWatch({ control, name: "numKocs" });
  const age = ageFromBands(ageBands ?? []);
  const fol = followersFromTiers(tiers ?? []);

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(formToDraft(v, base)))} noValidate className="space-y-7">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Field label="Sản phẩm" htmlFor="f-product" error={errors.product?.message}>
          <input
            id="f-product"
            className="field"
            placeholder="Ví dụ: Kem chống nắng nâng tông SPF50+"
            aria-invalid={!!errors.product || undefined}
            {...register("product")}
          />
        </Field>
        <Field label="Thương hiệu" optional htmlFor="f-brand">
          <input id="f-brand" className="field" placeholder="Tên thương hiệu" {...register("brand")} />
        </Field>
      </div>

      <Field label="Khách hàng mục tiêu" as="div" error={errors.gender?.message ?? errors.ageBands?.message}>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <ChipGroup label="Giới tính" options={GENDER_OPTIONS} value={field.value ? [field.value] : []} onChange={([v]) => field.onChange(v)} invalid={!!errors.gender} />
            )}
          />
          <span aria-hidden className="hidden h-9 w-px bg-rule sm:block" />
          <Controller
            control={control}
            name="ageBands"
            render={({ field }) => (
              <ChipGroup
                multi
                label="Độ tuổi"
                options={AGE_BANDS.map((b) => ({ value: b.value, label: b.label }))}
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.ageBands}
              />
            )}
          />
        </div>
        {age && (
          <p className="num mt-2 text-meta text-ink-2">
            Độ tuổi {age.ageMin}–{age.ageMax}
          </p>
        )}
      </Field>

      <Field label="Ngân sách cho KOC" as="div" error={errors.budget?.message} errorId="f-budget-err">
        <Controller
          control={control}
          name="budget"
          render={({ field }) => (
            <Controller
              control={control}
              name="currency"
              render={({ field: cur }) => (
                <BudgetField
                  amount={field.value}
                  currency={cur.value}
                  numKocs={numKocs}
                  invalid={!!errors.budget}
                  errorId="f-budget-err"
                  onChange={(amount, c) => {
                    cur.onChange(c);
                    field.onChange(amount);
                  }}
                />
              )}
            />
          )}
        />
      </Field>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Field label="Số KOC cần chọn" as="div">
          <Controller control={control} name="numKocs" render={({ field }) => <Stepper label="Số KOC cần chọn" value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Quy mô creator" as="div" error={errors.tiers?.message}>
          <Controller
            control={control}
            name="tiers"
            render={({ field }) => (
              <ChipGroup
                multi
                label="Quy mô creator"
                options={FOLLOWER_TIERS.map((t) => ({ value: t.value, label: t.label, hint: t.hint }))}
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.tiers}
              />
            )}
          />
          {fol && <p className="mt-2 text-meta text-ink-2">KOC nhỏ thường rẻ hơn và tương tác thật hơn.</p>}
        </Field>
      </div>

      <details className="disclosure border-t border-rule pt-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-1.5 font-semibold">
          <ChevronRight aria-hidden size={16} className="chev text-ink-2" />
          Thêm chi tiết
          <span className="w-full pl-[22px] text-meta font-normal text-ink-2 sm:w-auto sm:pl-0 sm:text-body">· không bắt buộc, giúp AI đánh giá sát hơn</span>
        </summary>
        <div className="mt-5 space-y-5">
          <Field label="Điểm nổi bật của sản phẩm" htmlFor="f-notes">
            <textarea
              id="f-notes"
              rows={2}
              className="field min-h-[68px]"
              placeholder="Ví dụ: thấm nhanh, nâng tông nhẹ, không gây bí da dầu"
              {...register("productNotes")}
            />
          </Field>
          <Field label="Từ khoá thường gặp trong video" as="div">
            <Controller
              control={control}
              name="keywords"
              render={({ field }) => (
                <TagInput label="Từ khoá" value={field.value} onChange={field.onChange} placeholder="Gõ rồi nhấn Enter, ví dụ: kem chống nắng" />
              )}
            />
            <p className="mt-1.5 text-meta text-ink-2">Để trống thì AI tự gợi ý từ tên sản phẩm.</p>
          </Field>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button className="btn btn-primary" disabled={busy}>
          <Send aria-hidden size={16} strokeWidth={2} />
          {submitLabel}
        </button>
        {sample && (
          <button type="button" className="text-meta font-semibold text-action-text underline-offset-3 hover:underline" onClick={() => {
              setBase(sample);
              reset(draftToForm(sample));
            }}>
            Điền brief mẫu của đề bài
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  optional,
  error,
  errorId,
  htmlFor,
  as = "label",
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  errorId?: string;
  htmlFor?: string;
  as?: "label" | "div";
  children: React.ReactNode;
}) {
  const Label = as === "label" ? "label" : "span";
  return (
    <div>
      <Label {...(as === "label" ? { htmlFor } : {})} className="mb-2 block text-meta font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-2"> · không bắt buộc</span>}
      </Label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-meta text-risk">
          {error}
        </p>
      )}
    </div>
  );
}
