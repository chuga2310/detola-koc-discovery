import { ArrowUpRight, Plus } from "lucide-react";
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
          <Link href="/new" className="btn btn-dark no-underline">
            <Plus aria-hidden size={16} strokeWidth={2.25} /> Brief mới
          </Link>
        }
      />

      <main className="mx-auto max-w-[1200px] px-5 pt-12 pb-20 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <span className="kicker">Tìm KOC TikTok bằng AI</span>
            {/* Tiêu đề 2 tông kiểu DETOLA: câu chính navy, câu phụ xám */}
            <h1 className="mt-4 text-[32px] leading-[1.15] font-semibold tracking-[-0.045em] sm:text-display">
              Chiến dịch của bạn.
              <span className="block text-ink-mute">Mỗi brief là một lần tìm KOC.</span>
            </h1>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="max-w-[36ch] text-meta text-ink-2 sm:text-right">Mở một chiến dịch để xem từng bước AI đã làm và các KOC được đề xuất kèm bằng chứng.</p>
            <Link href="/new" className="btn btn-primary no-underline">
              Tạo brief mới <ArrowUpRight aria-hidden size={16} />
            </Link>
          </div>
        </div>
        {cfg.provider === "mock" && (
          <p className="mt-6 max-w-[70ch] rounded-xl border border-caution/30 bg-caution-tint px-4 py-3 text-meta text-ink">
            Chưa có API key nên AI đang chạy giả lập: kết quả chỉ để xem luồng, không phải đánh giá thật.
          </p>
        )}
        <section aria-label="Danh sách chiến dịch" className="card mt-10 px-5 pt-2 pb-3 sm:px-7">
          <CampaignTable />
        </section>
      </main>
    </>
  );
}
