"use client";

/**
 * Danh sách chiến dịch (mỗi chiến dịch = 1 lần tìm KOC theo 1 brief).
 * TanStack Query: tải + tự làm mới khi có chiến dịch đang chạy. TanStack Table: cột + sắp xếp.
 */
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENDER_WORD, shortMoney } from "@/lib/brief/slots";
import type { CampaignBrief } from "@/lib/types";
import { STEP_NAMES } from "./runTypes";
import { StatusTag } from "./ui";

export interface CampaignRow {
  id: string;
  status: string;
  currentStage: string | null;
  createdAt: number;
  costUsd: number;
  credits: number;
  brief: CampaignBrief;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
});

const col = createColumnHelper<typeof features, CampaignRow>();

const budgetLabel = (b: CampaignBrief) =>
  b.budgetInput ? shortMoney(b.budgetInput.amount, b.budgetInput.currency) : shortMoney(b.budgetVnd, "VND");

const when = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Hôm nay, ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
};

const columns = col.columns([
  col.accessor((r) => r.brief.product, {
    id: "product",
    header: "Chiến dịch",
    sortFn: "text",
    meta: { className: "w-full" },
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="min-w-0">
          <Link href={`/runs/${r.id}`} className="text-body font-semibold text-ink no-underline group-hover:text-action group-hover:underline">
            {r.brief.product}
          </Link>
          {r.brief.brand !== r.brief.product && <div className="mt-0.5 text-meta text-ink-2">{r.brief.brand}</div>}
          <div className="num mt-0.5 text-meta text-ink-2">
            {r.brief.numKocs} KOC
            <span className="md:hidden"> · {budgetLabel(r.brief)}</span>
            <span className="sm:hidden"> · {when(r.createdAt)}</span>
          </div>
        </div>
      );
    },
  }),
  col.accessor((r) => `${r.brief.targetAudience.gender}`, {
    id: "audience",
    header: "Khách hàng",
    enableSorting: false,
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => {
      const a = row.original.brief.targetAudience;
      return (
        <span className="whitespace-nowrap text-ink">
          {GENDER_WORD[a.gender]} {a.ageMin}–{a.ageMax}
        </span>
      );
    },
  }),
  col.accessor((r) => r.brief.budgetVnd, {
    id: "budget",
    header: "Ngân sách",
    sortFn: "basic",
    meta: { className: "hidden md:table-cell", align: "right" },
    cell: ({ row }) => <span className="num whitespace-nowrap">{budgetLabel(row.original.brief)}</span>,
  }),
  col.accessor("status", {
    header: "Trạng thái",
    enableSorting: false,
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div>
          <StatusTag status={r.status} />
          {r.status === "running" && r.currentStage && (
            <div className="mt-0.5 hidden text-meta text-ink-2 sm:block">{STEP_NAMES[r.currentStage] ?? r.currentStage}</div>
          )}
        </div>
      );
    },
  }),
  col.accessor("createdAt", {
    header: "Tạo lúc",
    sortFn: "basic",
    sortDescFirst: true,
    meta: { className: "hidden sm:table-cell", align: "right" },
    cell: ({ getValue }) => <span className="num whitespace-nowrap text-ink-2">{when(getValue())}</span>,
  }),
  col.accessor((r) => r.costUsd + r.credits * 0.1, {
    id: "cost",
    header: "Chi phí",
    sortFn: "basic",
    meta: { className: "hidden xl:table-cell", align: "right" },
    cell: ({ row }) => {
      const r = row.original;
      return (
        <span className="num whitespace-nowrap text-ink-2" title={`AI $${r.costUsd.toFixed(3)} + dữ liệu ${r.credits.toFixed(1)} credit`}>
          ≈ ${(r.costUsd + r.credits * 0.1).toFixed(2)}
        </span>
      );
    },
  }),
  col.display({
    id: "go",
    header: () => <span className="sr-only">Mở</span>,
    cell: () => <ChevronRight aria-hidden size={18} className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-action" />,
    meta: { className: "w-8", align: "right" },
  }),
]);

type Meta = { className?: string; align?: "right" };

export function CampaignTable() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/runs");
      if (!res.ok) throw new Error("load failed");
      return ((await res.json()) as { runs: CampaignRow[] }).runs;
    },
    // Có chiến dịch đang chạy -> làm mới 4s/lần để thấy trạng thái đổi
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "running" || r.status === "queued") ? 4000 : false),
  });

  const table = useTable({
    features,
    columns,
    data: q.data ?? [],
    initialState: { sorting: [{ id: "createdAt", desc: true }] },
  });

  if (q.isError && !q.data)
    return (
      <p role="alert" className="mt-8 text-risk">
        Không tải được danh sách chiến dịch. Kiểm tra server rồi tải lại trang.
      </p>
    );
  if (q.isPending) return <TableSkeleton />;
  if (!q.data.length) return <EmptyState />;

  return (
    <table className="mt-8 w-full border-collapse">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="border-b border-rule-strong">
            {hg.headers.map((h) => {
              const meta = (h.column.columnDef.meta ?? {}) as Meta;
              const sorted = h.column.getIsSorted();
              const canSort = h.column.getCanSort();
              return (
                <th
                  key={h.id}
                  scope="col"
                  aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                  className={`py-2.5 pr-4 text-meta font-medium whitespace-nowrap text-ink-2 last:pr-0 ${meta.align === "right" ? "text-right" : "text-left"} ${meta.className ?? ""}`}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={h.column.getToggleSortingHandler()}
                      className={`inline-flex items-center gap-1 hover:text-ink ${sorted ? "text-ink" : ""}`}
                    >
                      <table.FlexRender header={h} />
                      {sorted === "asc" ? <ArrowUp aria-hidden size={13} /> : sorted === "desc" ? <ArrowDown aria-hidden size={13} /> : null}
                    </button>
                  ) : (
                    <table.FlexRender header={h} />
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) return;
              router.push(`/runs/${row.original.id}`);
            }}
            className="group cursor-pointer border-b border-rule transition-colors hover:bg-surface"
          >
            {row.getAllCells().map((cell) => {
              const meta = (cell.column.columnDef.meta ?? {}) as Meta;
              return (
                <td
                  key={cell.id}
                  className={`py-3.5 pr-4 align-top last:pr-0 ${meta.align === "right" ? "text-right" : ""} ${meta.className ?? ""}`}
                >
                  <table.FlexRender cell={cell} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableSkeleton() {
  return (
    <div className="mt-8" aria-busy="true" aria-label="Đang tải chiến dịch">
      <div className="h-px bg-rule-strong" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-6 border-b border-rule py-4">
          <div className="h-4 w-48 animate-pulse rounded-[2px] bg-rule" />
          <div className="ml-auto h-3 w-20 animate-pulse rounded-[2px] bg-rule" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 max-w-[56ch] border-t border-rule pt-8">
      <h2 className="text-title font-bold">Chưa có chiến dịch nào</h2>
      <p className="mt-2 text-ink-2">
        Tạo brief đầu tiên: điền nhanh vài thông tin, hoặc kể cho AI về sản phẩm và khách hàng. Hệ thống sẽ tìm và chấm điểm KOC TikTok kèm bằng
        chứng từ video.
      </p>
      <Link href="/new" className="btn btn-primary mt-6 no-underline">
        <Plus aria-hidden size={16} strokeWidth={2.25} /> Tạo brief mới
      </Link>
    </div>
  );
}
