"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CampaignBrief } from "@/lib/types";

/** Form brief: prefill bằng đề bài (kem chống nắng, nữ 18-30, 30tr, 5 KOC) */
export function BriefForm({ initial }: { initial: CampaignBrief }) {
  const router = useRouter();
  const [b, setB] = useState(initial);
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const brief = { ...b, keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) };
    const res = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(brief) });
    const json = await res.json();
    if (!res.ok) {
      setErr(JSON.stringify(json.error));
      setBusy(false);
      return;
    }
    router.push(`/runs/${json.id}`);
  }

  const field = (label: string, node: React.ReactNode, span = "") => (
    <label className={`block ${span}`}>
      <span className="label">{label}</span>
      <div className="mt-1">{node}</div>
    </label>
  );

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3">
      {field("Thương hiệu", <input className="input" value={b.brand} onChange={(e) => setB({ ...b, brand: e.target.value })} />, "col-span-2")}
      {field("Sản phẩm", <input className="input" value={b.product} onChange={(e) => setB({ ...b, product: e.target.value })} />)}
      {field("Ngành hàng", <input className="input" value={b.category} onChange={(e) => setB({ ...b, category: e.target.value })} />)}
      {field(
        "Mô tả sản phẩm",
        <textarea className="input" rows={2} value={b.productNotes ?? ""} onChange={(e) => setB({ ...b, productNotes: e.target.value })} />,
        "col-span-2",
      )}
      {field("Từ khoá (phẩy)", <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} />, "col-span-2")}
      {field(
        "Giới tính mục tiêu",
        <select
          className="input"
          value={b.targetAudience.gender}
          onChange={(e) => setB({ ...b, targetAudience: { ...b.targetAudience, gender: e.target.value as CampaignBrief["targetAudience"]["gender"] } })}
        >
          <option value="female">Nữ</option>
          <option value="male">Nam</option>
          <option value="any">Tất cả</option>
        </select>,
      )}
      {field(
        "Độ tuổi",
        <div className="flex items-center gap-2">
          <input type="number" className="input" value={b.targetAudience.ageMin} onChange={(e) => setB({ ...b, targetAudience: { ...b.targetAudience, ageMin: +e.target.value } })} />
          <span>–</span>
          <input type="number" className="input" value={b.targetAudience.ageMax} onChange={(e) => setB({ ...b, targetAudience: { ...b.targetAudience, ageMax: +e.target.value } })} />
        </div>,
      )}
      {field("Ngân sách (VND)", <input type="number" className="input num" value={b.budgetVnd} onChange={(e) => setB({ ...b, budgetVnd: +e.target.value })} />)}
      {field("Số KOC", <input type="number" className="input num" value={b.numKocs} onChange={(e) => setB({ ...b, numKocs: +e.target.value })} />)}
      {field(
        "Follower (min – max)",
        <div className="flex items-center gap-2">
          <input type="number" className="input num" value={b.followerRange?.min ?? 10000} onChange={(e) => setB({ ...b, followerRange: { min: +e.target.value, max: b.followerRange?.max ?? 500000 } })} />
          <span>–</span>
          <input type="number" className="input num" value={b.followerRange?.max ?? 500000} onChange={(e) => setB({ ...b, followerRange: { min: b.followerRange?.min ?? 10000, max: +e.target.value } })} />
        </div>,
        "col-span-2",
      )}
      <div className="col-span-2 flex items-center gap-3 pt-1">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Đang tạo…" : "Chạy discovery"}
        </button>
        {err && <span className="text-sm text-bad">{err}</span>}
      </div>
    </form>
  );
}
