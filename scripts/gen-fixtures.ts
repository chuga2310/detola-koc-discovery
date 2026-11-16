/**
 * Sinh data MẪU (synthetic) cho chế độ offline: data/fixtures/creators.sample.json
 * Seeded RNG -> chạy lại ra đúng dữ liệu cũ (benchmark tái lập được).
 * Handle có tiền tố demo_ để không nhầm với creator thật.
 *
 *   npm run gen:fixtures
 */
import fs from "node:fs";
import path from "node:path";
import type { CreatorRecord } from "../src/lib/types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20261116);
const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
const between = (a: number, b: number) => a + r() * (b - a);

const NICHES = {
  skincare: {
    weight: 0.35,
    female: [0.78, 0.95],
    cats: [["Beauty & Personal Care", 0.7], ["Health", 0.15], ["Fashion", 0.15]],
    captions: [
      "Review kem chống nắng nâng tông cho da dầu mụn, test 8 tiếng ngoài trời #kemchongnang #skincare",
      "Routine skincare buổi sáng cho da dầu: sữa rửa mặt, serum, kem chống nắng SPF50 #skincare",
      "So sánh 3 kem chống nắng dưới 300k, loại nào không bết? #review #spf50",
      "Da nhạy cảm dùng gì? Serum phục hồi mình dùng 2 tháng #dangyeu",
      "Mẹo chống nắng khi đi học bằng xe máy #sinhvien #chongnang",
      "Đập hộp haul mỹ phẩm sale 11.11 #haul #myphamchinhhang",
      "Test kem chống nắng có bị vệt trắng không? #sunscreen #test",
      "Skincare cho da mụn ẩn, giảm 80% sau 1 tháng #trimun",
    ],
  },
  makeup: {
    weight: 0.15,
    female: [0.8, 0.96],
    cats: [["Beauty & Personal Care", 0.8], ["Fashion", 0.2]],
    captions: [
      "Makeup đi học tự nhiên 5 phút #makeup #grwm",
      "GRWM đi làm, lớp nền mỏng nhẹ có kem chống nắng #grwm",
      "Review cushion mới, che phủ tốt cho da dầu #cushion",
      "Son tint mùa thu, swatch 6 màu #son #swatch",
      "Makeup đi biển chống trôi cả ngày #dibien",
    ],
  },
  lifestyle: {
    weight: 0.2,
    female: [0.55, 0.85],
    cats: [["Fashion", 0.45], ["Beauty & Personal Care", 0.3], ["Home & Living", 0.25]],
    captions: [
      "Một ngày làm việc của mình ở Sài Gòn #vlog #dailyvlog",
      "Outfit đi chơi cuối tuần dưới 500k #ootd",
      "Đồ dùng nhà cửa xinh xắn mua trên shop #home",
      "Chuẩn bị đi Đà Lạt cần mang gì #travel",
      "Mini routine buổi tối thư giãn #selfcare",
    ],
  },
  deals: {
    weight: 0.15,
    female: [0.45, 0.7],
    cats: [["Home & Living", 0.3], ["Food & Beverage", 0.3], ["Beauty & Personal Care", 0.2], ["Phones & Electronics", 0.2]],
    captions: [
      "Deal sốc hôm nay chỉ 9k!!! #deal #sale",
      "Săn sale 12.12 đồ gia dụng giá rẻ #sansale",
      "Combo đồ ăn vặt siêu ngon #anvat",
      "Kem chống nắng auth giá rẻ chỉ 49k #sale",
      "Live xả kho cuối năm #livestream",
    ],
  },
  male: {
    weight: 0.15,
    female: [0.1, 0.35],
    cats: [["Phones & Electronics", 0.5], ["Sports & Outdoor", 0.3], ["Men's Fashion", 0.2]],
    captions: [
      "Unbox tai nghe mới giá rẻ #tech",
      "Gym routine cho người mới #gym",
      "Đồng hồ nam dưới 1 triệu #review",
      "Setup góc làm việc #setup",
    ],
  },
} as const;

type NicheKey = keyof typeof NICHES;
const nicheKeys = Object.keys(NICHES) as NicheKey[];
const FIRST = ["Linh", "Trang", "Ngọc", "Mai", "Hà", "Vy", "Thảo", "My", "An", "Nhi", "Quỳnh", "Huyền", "Minh", "Khoa", "Tuấn"];

function pickNiche(): NicheKey {
  let x = r();
  for (const k of nicheKeys) {
    x -= NICHES[k].weight;
    if (x <= 0) return k;
  }
  return "skincare";
}

const creators: CreatorRecord[] = [];
for (let i = 1; i <= 120; i++) {
  const niche = pickNiche();
  const N = NICHES[niche];
  const followers = Math.round(Math.exp(between(Math.log(4_000), Math.log(1_800_000))));
  const er = between(0.015, 0.12);
  const videoCount = Math.round(between(1, 30));
  const avgViews = Math.round(followers * between(0.08, 1.4));
  const female = between(N.female[0], N.female[1]);
  const young = between(0.35, 0.8);
  const ages = { "18-24": young * between(0.45, 0.7), "25-34": 0, "35-44": 0, "45+": 0 } as Record<string, number>;
  ages["25-34"] = young - ages["18-24"] + between(0.05, 0.2);
  ages["35-44"] = between(0.05, 0.2);
  ages["45+"] = Math.max(0.02, 1 - ages["18-24"] - ages["25-34"] - ages["35-44"]);
  const sum = Object.values(ages).reduce((s, x) => s + x, 0);
  for (const k of Object.keys(ages)) ages[k] = Number((ages[k] / sum).toFixed(3));
  const name = pick(FIRST);
  const handle = `demo_${niche}_${String(i).padStart(3, "0")}`;
  const videos = Array.from({ length: 8 }, (_, k) => {
    const views = Math.round(avgViews * between(0.3, 2.2));
    return {
      id: `fx${i}${k}`,
      url: "", // fixture: không có video thật -> stage media bỏ qua
      caption: pick([...N.captions]),
      hashtags: [],
      views,
      likes: Math.round(views * er * 0.85),
      comments: Math.round(views * er * 0.1),
      shares: Math.round(views * er * 0.05),
      publishedAt: new Date(Date.UTC(2026, 9, 15 + k)).toISOString(),
      durationSec: Math.round(between(15, 90)),
    };
  });
  creators.push({
    id: `fixture-${i}`,
    handle,
    nickname: `${name} (demo)`,
    followers,
    region: "VN",
    source: "fixture",
    bio: `[DEMO DATA] ${niche}`,
    metrics: {
      revenueVnd: Math.round(avgViews * videoCount * between(0, 60)),
      itemsSold: Math.round(avgViews * videoCount * between(0, 0.004)),
      videoViews: avgViews * videoCount,
      videoCount,
      avgViewsPerVideo: avgViews,
      engagementRate: Number(er.toFixed(4)),
    },
    audience: r() < 0.85 ? { femalePct: Number(female.toFixed(3)), ageBuckets: ages } : undefined,
    categories: N.cats.map(([name, share]) => ({ name, share: Number((share * between(0.8, 1.2)).toFixed(2)) })),
    videos,
  });
}

const out = path.join(process.cwd(), "data", "fixtures", "creators.sample.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(creators, null, 1));
console.log(`Wrote ${creators.length} synthetic creators -> ${out}`);
