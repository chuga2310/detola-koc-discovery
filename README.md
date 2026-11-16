# AI KOC Discovery — DETOLA Technical Assessment

Hệ thống tìm KOC TikTok phù hợp cho một brief chiến dịch (ví dụ: **5 KOC cho kem chống nắng, nữ 18–30, ngân sách 30 triệu VND**). Dữ liệu lấy từ **Kalodata Open API**, kết hợp phân tích nội dung và **phân tích video bằng AI**. Mọi đề xuất đều có **bằng chứng truy vết được** (số liệu, khung hình, câu nói trong video).

- **Next.js 16** (UI + API routes = backend), **SQLite** (checkpoint + cache), **Claude** (Haiku / Sonnet / Opus theo stage), OpenAI (template), mock (offline).
- Pipeline phễu 8 stage: 3 nguồn dữ liệu → lọc số liệu (0 token) → enrich có chọn lọc → text AI rẻ → video AI → chấm điểm có trích dẫn → tối ưu ngân sách.
- Crash giữa chừng → resume đúng chỗ, **không trả tiền AI hay credit Kalodata 2 lần**.

| Kết quả benchmark (run thật, N = 5) | |
|---|---|
| Chi phí 1 run lạnh | **≈ $1.33** = AI $0.39 + Kalodata 9.4 credit (≈ $0.94) |
| Run lặp lại / campaign gặp lại creator | **$0**: 13/13 call AI và mọi call Kalodata trúng cache |
| Thời gian xử lý | ~110s khi dữ liệu đã cache; ~2.5–3 phút khi lạnh hoàn toàn |
| Phục hồi | kill cứng giữa `video_analysis` → resume → **0 call trả tiền 2 lần** |
| So với naive (video AI cả pool bằng model mạnh, ước tính) | chi phí AI $12.08 → $0.39, **giảm ~97%** |

📐 Kiến trúc & quyết định thiết kế: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
📊 Kết quả 5 KOC, bằng chứng, token/credit, thời gian, phục hồi, projection 50–500 KOC: [docs/BENCHMARK.md](docs/BENCHMARK.md)

---

## 1. Chạy

Yêu cầu: Node ≥ 22, `ffmpeg`, `yt-dlp`.

```bash
brew install ffmpeg yt-dlp      # macOS
npm install
cp .env.example .env.local      # điền ANTHROPIC_API_KEY, KALODATA_API_KEY
```

```bash
npm run dev                                                   # http://localhost:3000 — tạo brief, xem tiến độ, Stop / Resume
npm run discover -- --brief briefs/sunscreen.json             # hoặc chạy bằng CLI
npm run benchmark -- --fresh                                  # đo end-to-end, ghi docs/BENCHMARK.md
```

### Chế độ offline (không cần key)

```bash
npm run gen:fixtures                      # 120 creator MẪU (synthetic, handle demo_*)
DATA_SOURCE=fixture AI_PROVIDER=mock npm run dev
```

Mock chỉ để xem flow / test resume. Nội dung đánh giá là giả lập và được đánh dấu `[MOCK]`.

### Demo khả năng phục hồi

```bash
npm run discover -- --brief briefs/sunscreen.json --crash-after video_analysis:3   # kill cứng process
npm run discover -- --list                                                         # thấy run bị gián đoạn
npm run discover -- --resume <runId>                                               # chạy tiếp từ checkpoint
```

Trên UI: bấm **Stop** khi run đang chạy, sau đó bấm **Resume từ checkpoint**.

## 2. Pipeline

| # | Stage | Chi phí | Việc |
|---|---|---|---|
| 1 | `source` | ~0.4 credit | Pool từ 3 nguồn Kalodata: **commerce** (doanh thu video), **engagement** (ER ≥ 8%, Skincare), **content** (video có keyword "kem chống nắng") |
| 2 | `prefilter` | 0 | Lọc cứng (follower, chi phí ≤ 50% ngân sách, tài khoản shop, seller chỉ livestream…) + điểm số liệu; chia đều suất theo nguồn → giữ ~4N |
| 3 | `enrich` | 0.2 credit / creator | Detail + video gần đây **chỉ cho ~4N** creator đã qua prefilter, rồi chấm lại điểm |
| 4 | `text_screen` | Haiku, batch 10 | Ngách, brand fit, liên quan sản phẩm, red flag → shortlist ~2N |
| 5 | `media_prep` | 0.5 credit / creator | yt-dlp (miễn phí) lấy transcript + thumbnail; video chính lấy mp4 qua Kalodata → contact sheet 6 frame |
| 6 | `video_analysis` | Sonnet vision, 1 call / creator | Hồ sơ nội dung khách quan (không phụ thuộc campaign → cache dùng lại) |
| 7 | `final_rank` | Opus, batch 10 | Chấm điểm theo rubric; lý do + rủi ro **bắt buộc trích evidence id**; gợi ý concept |
| 8 | `select` | 0 | Knapsack: N KOC có tổng điểm cao nhất trong ngân sách |

## 3. Cấu hình (`.env.local`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Có key → provider `anthropic` |
| `KALODATA_API_KEY` | – | Kalodata Open API (header `secret-key`) |
| `DATA_SOURCE` | `kalodata` | `kalodata` \| `fixture` |
| `AI_PROVIDER` | auto | `anthropic` \| `openai` \| `mock` |
| `MODEL_SCREEN` / `MODEL_VIDEO` / `MODEL_FINAL` | haiku-5-5 / sonnet-5-5 / opus-5-5 | Model tiering |
| `EFFORT_SCREEN` / `EFFORT_VIDEO` / `EFFORT_FINAL` | low / low / medium | Độ sâu suy luận |
| `KALODATA_MAX_CREDITS_PER_RUN` | 12 | Trần credit mỗi run (chặn trước khi gọi) |
| `KALODATA_VIDEO_URL_FALLBACK` | `primary` | Lấy mp4 trả phí cho: `primary` (video chính) \| `all` \| `off` |
| `KALODATA_CACHE_TTL_HOURS` | 72 | Thời gian dùng lại response Kalodata |
| `AI_CONCURRENCY` / `MEDIA_CONCURRENCY` | 4 / 3 | Giới hạn song song |

Brief (`briefs/sunscreen.json`) gồm: sản phẩm, ngành, keyword, khán giả mục tiêu, ngân sách, số KOC, khoảng follower, category Kalodata, keyword tìm nội dung (`contentKeywords`).

## 4. Giới hạn hiện tại

- **Không có nhân khẩu học follower**: Kalodata Open API không trả tuổi/giới tính khán giả (giao diện web có, API thì không). Phần "khán giả nữ 18–30" được AI suy từ nội dung và persona, rubric giới hạn điểm phần này. Đây là nguyên nhân chính khiến điểm fit chỉ ở khoảng 50–62.
- **Dữ liệu thiên về TikTok Shop**: Kalodata theo dõi creator có bán hàng, nên nhiều ứng viên là affiliate. Pipeline giảm thiên lệch bằng 3 nguồn + chia suất, nhưng KOC thuần review không bán qua TikTok Shop có thể không có trong dữ liệu.
- **Chi phí booking là ước tính** theo tier follower (`DEFAULT_RATE_CARD`), chưa có báo giá thật.
- **Video**: tải video miễn phí từ TikTok hiện bị chặn (chỉ lấy được audio), nên video chính dùng Kalodata (0.5 credit), video phụ chỉ có thumbnail + transcript. 6 frame / video có thể bỏ sót chi tiết giữa các frame.
- **Kết quả AI không hoàn toàn tất định**: 2 lần chạy lạnh có thể đổi thứ hạng ở các creator điểm sát nhau. Run lặp lại thì cố định nhờ cache.
- **Rubric và trọng số** đặt theo kinh nghiệm, chưa hiệu chỉnh bằng dữ liệu hiệu quả chiến dịch thật.
- Worker chạy trong process Next.js (fire-and-forget): đủ cho demo, production nên tách worker. Chưa có auth cho UI.

## 5. Hướng mở rộng

- **Postgres + worker pool** (`SKIP LOCKED`) cho 500 KOC trên nhiều máy; schema giữ nguyên.
- **Message Batches API** cho `text_screen` / `video_analysis` (−50% chi phí AI, async).
- Ở quy mô lớn **chi phí video URL vượt chi phí AI** → chỉ trả 0.5 credit cho top cuối, tầng đầu dùng thumbnail + transcript; tận dụng cache hồ sơ video xuyên campaign.
- Bổ sung nguồn có nhân khẩu học follower (Kalodata gói cao hơn hoặc TikTok Creator Marketplace) → thay suy luận bằng số liệu.
- **Feedback loop**: lưu kết quả thật sau campaign (view, GMV, CPM) để học lại trọng số và rubric.
- **Lookalike search**: embedding hồ sơ nội dung video (đã cache) để tìm creator giống những KOC từng hiệu quả.

## 6. Cấu trúc thư mục

```
briefs/                 brief mẫu (đề bài kem chống nắng)
data/fixtures/          data synthetic cho chế độ offline
docs/                   ARCHITECTURE.md, BENCHMARK.md
benchmark/results.json  số liệu thô của benchmark
scripts/                discover (CLI), benchmark, gen-fixtures
src/lib/                lõi hệ thống (xem docs/ARCHITECTURE.md §5)
src/app, src/components Next.js UI + API routes
.data/                  SQLite + media cache (gitignored)
```
