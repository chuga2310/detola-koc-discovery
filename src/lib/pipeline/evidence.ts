/**
 * Evidence builder: biến số liệu + kết quả AI thành danh sách "bằng chứng" có ID.
 *
 * Model ở stage cuối CHỈ được trích dẫn ID có trong danh sách này. Sau khi model trả lời,
 * code kiểm tra lại từng ID (validateEvidence) -> lý do nào trích ID không tồn tại sẽ bị
 * đánh dấu. Nhờ vậy mọi lý do đề xuất đều truy ngược được về số liệu/khung hình cụ thể
 * (chống "AI bịa").
 */
import type { PreparedMedia } from "../media/video";
import type { CampaignBrief, CreatorRecord, Evidence } from "../types";
import { compactNum, pct, truncate } from "../util";
import type { TextScreenOutput, VideoAnalysisOutput } from "./schemas";
import type { PrefilterRow } from "./scoring";
import { productTypeKeywords } from "../brief/keywords";
import { signalsOf } from "./signals";

type TextResult = TextScreenOutput["results"][number];

export function buildEvidence(args: {
  ref: string;
  creator: CreatorRecord;
  pre: PrefilterRow;
  brief: CampaignBrief;
  text?: TextResult;
  media?: PreparedMedia[];
  video?: VideoAnalysisOutput;
}): Evidence[] {
  const { ref, creator: c, pre, brief, text, media, video } = args;
  const ev: Evidence[] = [];
  const topPct = (p: number) => `top ${Math.max(1, Math.round((1 - p) * 100))}% pool`;
  const sig = signalsOf(c, productTypeKeywords(brief));

  ev.push({
    id: `${ref}.m1`,
    kind: "metric",
    text: `Followers ${compactNum(c.followers)}; ${compactNum(pre.raw.videoViews30d)} view nội dung / 30 ngày${
      pre.raw.paidViewShare !== undefined ? " (đã trừ view quảng cáo)" : ""
    }; trung vị ${compactNum(pre.raw.avgViews)} view${pre.raw.paidViewShare !== undefined ? " tự nhiên" : ""} của các video nổi bật (reach ${topPct(pre.breakdown.reach)})`,
  });
  if (pre.raw.engagementRate !== undefined)
    ev.push({ id: `${ref}.m2`, kind: "metric", text: `Engagement rate ${pct(pre.raw.engagementRate, 1)} (${topPct(pre.breakdown.engagement)})` });
  if (c.metrics.revenueVnd || c.metrics.itemsSold)
    ev.push({
      id: `${ref}.m3`,
      kind: "metric",
      text: `30 ngày: GMV ${compactNum(c.metrics.revenueVnd)} VND, ${compactNum(c.metrics.itemsSold)} sản phẩm bán ra, ${c.metrics.videoCount ?? c.videos.length} video`,
    });
  ev.push({
    id: `${ref}.m4`,
    kind: "metric",
    text: `Chi phí ước tính ${compactNum(pre.estCostVnd)} VND/video (tier ${pre.costTier}); ${compactNum(pre.raw.avgViews && pre.raw.avgViews / (pre.estCostVnd / 1e6))} view kỳ vọng / 1 triệu VND`,
  });
  if (pre.raw.videoFocus !== undefined || c.metrics.productCount !== undefined) {
    ev.push({
      id: `${ref}.m6`,
      kind: "metric",
      text: [
        pre.raw.videoFocus !== undefined ? `${pct(pre.raw.videoFocus)} doanh thu từ video, ${pct(1 - pre.raw.videoFocus)} từ livestream` : null,
        c.metrics.productCount !== undefined ? `quảng bá ${c.metrics.productCount} sản phẩm / ${c.metrics.shopCount ?? "?"} shop` : null,
        sig.paidViewShare !== undefined ? `${pct(sig.paidViewShare)} tổng view video đến từ quảng cáo` : null,
      ]
        .filter(Boolean)
        .join("; "),
    });
  }
  const s = sig;
  const conv = [
    s.videoGpm ? `GPM video ${compactNum(s.videoGpm)} VND / 1.000 view (điểm thương mại ${topPct(pre.breakdown.commerce)})` : null,
    s.avgUnitPriceVnd ? `giá trung bình sản phẩm khán giả đã mua ${compactNum(s.avgUnitPriceVnd)} VND` : null,
  ].filter(Boolean);
  if (conv.length) ev.push({ id: `${ref}.m7`, kind: "metric", text: conv.join("; ") });
  const mom = [
    s.followerGrowthPct !== undefined ? `follower +${pct(s.followerGrowthPct, 1)} trong 30 ngày` : null,
    s.revenueActiveDays !== undefined
      ? `có doanh thu ${s.revenueActiveDays}/30 ngày, xu hướng ${s.revenueTrend === "up" ? "tăng" : s.revenueTrend === "down" ? "giảm" : "đi ngang"}`
      : null,
    s.aiVideoCount ? `${s.aiVideoCount} video bị gắn cờ do AI tạo` : null,
  ].filter(Boolean);
  if (mom.length) ev.push({ id: `${ref}.m8`, kind: "metric", text: mom.join("; ") });
  if (s.categoryRevenueShare !== undefined)
    ev.push({
      id: `${ref}.m9`,
      kind: "metric",
      text: `${pct(s.categoryRevenueShare)} doanh thu 30 ngày đến từ ngành của brief${s.categoryVideoGpm ? `; GPM video trong ngành ${compactNum(s.categoryVideoGpm)} VND / 1.000 view` : ""}`,
    });
  const sold = c.soldProducts ?? [];
  if (sold.length) {
    const others = sold.filter((p) => !s.sameCategoryProducts.includes(p.name)).slice(0, 3);
    ev.push({
      id: `${ref}.m10`,
      kind: "metric",
      text: [
        s.sameCategoryProducts.length ? `Đã bán sản phẩm cùng loại: ${s.sameCategoryProducts.slice(0, 3).map((x) => truncate(x, 50)).join("; ")}` : "Chưa thấy bán sản phẩm cùng loại",
        others.length ? `sản phẩm khác đang bán: ${others.map((p) => truncate(p.name, 40) + (p.seller ? ` (${p.seller})` : "")).join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    });
  }
  if (s.analyzedVideoStats)
    ev.push({
      id: `${ref}.m11`,
      kind: "metric",
      text: [
        `Chi tiết ${s.analyzedVideoStats.withStats} video được AI xem`,
        s.analyzedVideoStats.gpm !== undefined ? `GPM TB ${compactNum(s.analyzedVideoStats.gpm)} VND/1.000 view` : null,
        s.analyzedVideoStats.roas ? `ROAS quảng cáo TB ${s.analyzedVideoStats.roas.toFixed(1)}` : null,
        s.analyzedVideoStats.adDays ? `chạy quảng cáo TB ${s.analyzedVideoStats.adDays.toFixed(0)} ngày` : null,
        s.analyzedVideoStats.cpa ? `chi phí quảng cáo / đơn TB ${compactNum(s.analyzedVideoStats.cpa)} VND` : null,
      ]
        .filter(Boolean)
        .join("; "),
    });
  ev.push({
    id: `${ref}.m5`,
    kind: "metric",
    text: pre.raw.matchedKeywords.length
      ? `${pre.raw.keywordVideos}/${pre.raw.keywordTotal} video gần đây chứa keyword chiến dịch: ${pre.raw.matchedKeywords.slice(0, 5).join(", ")}`
      : `Không video nào gần đây chứa keyword chiến dịch (${brief.keywords.slice(0, 3).join(", ")}...)`,
  });

  const g = pre.raw.audienceGender;
  const a = pre.raw.audienceAge;
  ev.push({
    id: `${ref}.a1`,
    kind: "audience",
    text:
      g === null && a === null
        ? "Nguồn dữ liệu không cung cấp nhân khẩu học follower (cần suy từ nội dung)"
        : `Khán giả: ${g === null ? "?" : pct(g)} đúng giới tính mục tiêu; ${a === null ? "?" : pct(a)} trong độ tuổi ${brief.targetAudience.ageMin}-${brief.targetAudience.ageMax}`,
  });
  if (c.categories.length)
    ev.push({
      id: `${ref}.a2`,
      kind: "audience",
      text: `Ngành hàng: ${c.categories
        .slice(0, 4)
        .map((x) => `${x.name} ${pct(x.share)}`)
        .join(", ")}`,
    });

  if (text) {
    ev.push({
      id: `${ref}.t1`,
      kind: "text",
      text: `Sàng lọc nội dung: ngách "${text.niche}"; brand fit ${text.brand_fit}/10, liên quan sản phẩm ${text.product_relevance}/10. ${text.summary}`,
    });
    if (text.red_flags.length) ev.push({ id: `${ref}.t2`, kind: "text", text: `Cảnh báo: ${text.red_flags.join("; ")}` });
  }

  if (video && media) {
    video.videos.forEach((v, vi) => {
      const m = media[vi];
      const vref = `${ref}.v${vi + 1}`;
      const demo = [
        v.applies_on_skin && "thoa lên da",
        v.shows_texture && "cận texture",
        v.before_after && "before/after",
        v.shows_packaging && "show bao bì",
      ].filter(Boolean);
      ev.push({
        id: `${vref}.s`,
        kind: "video",
        text: `Video ${vi + 1}: dạng ${v.format}, ${v.on_camera}, chất lượng hình ${v.production_quality}/5${demo.length ? `, demo: ${demo.join(", ")}` : ""}. Hook: ${truncate(v.hook, 120)}`,
        image: m?.sheet,
        videoUrl: m?.url,
        frame: null,
        frameTimes: m?.frameTimes,
      });
      v.observations.forEach((o, oi) => {
        ev.push({
          id: `${vref}.o${oi + 1}`,
          kind: "video",
          text: `${o.frame ? `[frame ${o.frame}${m?.frameTimes[o.frame - 1] !== undefined ? ` @${m.frameTimes[o.frame - 1]}s` : ""}] ` : ""}${o.note}${o.quote ? ` — "${truncate(o.quote, 100)}"` : ""}`,
          image: m?.sheet,
          videoUrl: m?.url,
          frame: o.frame,
        });
      });
    });
    ev.push({
      id: `${ref}.v0`,
      kind: "video",
      text: `Tổng quan video: ${video.creator.content_style} Persona: ${video.creator.persona}. Chất lượng ${video.creator.overall_video_quality}/10, brand safety: ${video.creator.brand_safety}${video.creator.brand_safety_note ? ` (${truncate(video.creator.brand_safety_note, 80)})` : ""}`,
    });
  }
  return ev;
}

/** Render evidence thành dòng gọn cho prompt */
export const evidenceLines = (ev: Evidence[]) => ev.map((e) => `[${e.id}] ${e.text}`).join("\n");

/** Tách ID hợp lệ / không hợp lệ (trích ID không tồn tại hoặc của creator khác) */
export function validateEvidence(ids: string[], allowed: Set<string>) {
  const valid = ids.filter((id) => allowed.has(id));
  const invalid = ids.filter((id) => !allowed.has(id));
  return { valid, invalid };
}
