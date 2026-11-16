import { Plus } from "lucide-react";
import Link from "next/link";
import { CampaignTable } from "@/components/CampaignTable";
import { Shell } from "@/components/ui";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Home() {
  const cfg = getConfig();
  return (
    <>
      <Shell
        aside={
          <Link href="/new" className="btn border-shell-ink bg-shell-ink text-shell no-underline hover:bg-shell-ink-2">
            <Plus aria-hidden size={16} strokeWidth={2.25} /> Brief mới
          </Link>
        }
      />

      <main className="mx-auto max-w-[1200px] px-5 pt-10 pb-20 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h1 className="condensed text-display font-extrabold">Chiến dịch</h1>
            <p className="mt-2 max-w-[62ch] text-ink-2">Mỗi chiến dịch là một lần tìm KOC theo brief của bạn. Mở một chiến dịch để xem từng bước và KOC được đề xuất.</p>
          </div>
        </div>
        {cfg.provider === "mock" && (
          <p className="mt-6 max-w-[70ch] rounded-[2px] border border-caution bg-caution-tint px-4 py-3 text-meta text-ink">
            Chưa có API key nên AI đang chạy giả lập: kết quả chỉ để xem luồng, không phải đánh giá thật.
          </p>
        )}
        <CampaignTable />
      </main>
    </>
  );
}
