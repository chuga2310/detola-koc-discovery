import { ArrowLeft } from "lucide-react";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { NewBrief } from "@/components/brief/NewBrief";
import { Shell } from "@/components/ui";
import { briefToDraft } from "@/lib/brief/slots";
import { getConfig } from "@/lib/config";
import type { CampaignBrief } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function NewBriefPage() {
  // Brief mẫu của đề bài (kem chống nắng, nữ 18–30, 30 triệu, 5 KOC) cho nút "Điền brief mẫu"
  const sample = briefToDraft(JSON.parse(fs.readFileSync(path.join(process.cwd(), "briefs", "sunscreen.json"), "utf8")) as CampaignBrief);
  sample.budget = { amount: 30_000_000, currency: "VND" };
  const mock = getConfig().provider === "mock";
  return (
    <>
      <Shell
        aside={
          <Link href="/" className="inline-flex items-center gap-1.5 text-meta font-semibold text-ink-2 no-underline hover:text-ink">
            <ArrowLeft aria-hidden size={15} /> Chiến dịch
          </Link>
        }
      />
      <main className="mx-auto max-w-[1080px] px-5 pt-10 md:px-10">
        <span className="kicker">Brief mới</span>
        <h1 className="mt-4 mb-8 text-[32px] leading-[1.15] font-semibold tracking-[-0.045em] sm:text-display">
          Bạn cần KOC cho sản phẩm nào?
          <span className="block text-ink-mute">Điền nhanh, hoặc kể cho AI.</span>
        </h1>
        {mock && (
          <p className="mb-6 rounded-xl border border-caution/30 bg-caution-tint px-4 py-3 text-meta">
            Đang chạy AI giả lập (chưa có API key): AI chỉ hiểu được câu đơn giản và kết quả không phải đánh giá thật.
          </p>
        )}
        <NewBrief sample={sample} />
      </main>
    </>
  );
}
