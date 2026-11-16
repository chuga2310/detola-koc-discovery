# AI KOC Discovery — DETOLA Technical Assessment

Hệ thống tìm KOC TikTok phù hợp cho 1 brief chiến dịch (ví dụ: **5 KOC cho kem chống nắng, nữ 18–30, ngân sách 30 triệu VND**), dựa trên dữ liệu hiệu suất từ Kalodata + phân tích nội dung + **phân tích video bằng AI**, với mọi đề xuất đều có **bằng chứng truy vết được**.

- **Next.js 16** (UI + API routes = backend), **SQLite** (checkpoint/cache), **Claude** (provider chính) / OpenAI (template) / mock (offline).
- Pipeline phễu 7 stage: số liệu (0 token) → text AI rẻ → video AI → chấm điểm cuối có trích dẫn → tối ưu ngân sách.
- Chạy lại / crash giữa chừng → resume đúng chỗ, **không trả tiền AI 2 lần**.

📐 Kiến trúc & quyết định thiết kế: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
📊 Kết quả benchmark (5 KOC, bằng chứng, token/cost, thời gian, phục hồi): [docs/BENCHMARK.md](docs/BENCHMARK.md)

---

## 1. Chạy nhanh

Yêu cầu: Node ≥ 22, `ffmpeg`, `yt-dlp` (tải video TikTok).

```bash
brew install ffmpeg yt-dlp      # macOS
npm install
cp .env.example .env.local      # điền ANTHROPIC_API_KEY
```

### Chế độ offline (không cần key, không cần Kalodata)

```bash
npm run gen:fixtures                                   # sinh 120 creator MẪU (synthetic, handle demo_*)
echo "DATA_SOURCE=fixture" >> .env.local               # không set key -> provider = mock
npm run dev                                            # http://localhost:3000
```

Mock chỉ để xem flow / test resume — nội dung đánh giá là giả lập và được đánh dấu `[MOCK]`.

### Chế độ thật (Claude + Kalodata)

1. Thu thập dữ liệu Kalodata (xem mục 3) → file `data/kalodata/*.json`.
2. `.env.local`: `ANTHROPIC_API_KEY=...`, `DATA_SOURCE=kalodata`.
3. Chạy:

```bash
npm run dev                                                   # UI: tạo brief, xem tiến độ, Stop / Resume
npm run discover -- --brief briefs/sunscreen.json             # hoặc CLI
npm run benchmark -- --fresh                                  # đo end-to-end, ghi docs/BENCHMARK.md
```

### Demo khả năng phục hồi

```bash
# Kill cứng process sau 3 task của stage video_analysis
npm run discover -- --brief briefs/sunscreen.json --crash-after video_analysis:3
npm run discover -- --list                    # run ở trạng thái interrupted
npm run discover -- --resume <runId>          # chạy tiếp từ checkpoint, 0 call trùng
```

Trên UI: bấm **Stop** khi run đang chạy → **Resume từ checkpoint**.

## 2. Pipeline

| # | Stage | AI? | Việc |
|---|---|---|---|
| 1 | `source` | – | Lấy pool ~20N creator từ Kalodata snapshot |
| 2 | `prefilter` | – | Lọc cứng (follower, % nữ, ngành hàng, hoạt động, chi phí ≤ 50% ngân sách) + điểm số liệu có trọng số → giữ ~4N |
| 3 | `text_screen` | Haiku, batch 10 | Đọc "thẻ" creator gọn: ngách, brand fit, liên quan sản phẩm, rủi ro → shortlist ~2N |
| 4 | `media_prep` | – | Chọn 2 video/creator, `yt-dlp` + `ffmpeg` → contact sheet 6 frame + auto-caption |
| 5 | `video_analysis` | Sonnet vision, 1 call/creator | Hồ sơ nội dung khách quan (không phụ thuộc campaign → cache dùng lại) |
| 6 | `final_rank` | Opus, batch 10 | Chấm điểm theo rubric, lý do + rủi ro **bắt buộc trích evidence id**, gợi ý concept |
| 7 | `select` | – | Knapsack: N KOC có tổng điểm cao nhất trong ngân sách |

## 3. Thu thập dữ liệu Kalodata

Kalodata không có public API cho tài khoản thường và có anti-bot, nên dữ liệu được thu **trong browser đã login** rồi import:

1. Login kalodata.com (VN, TikTok) bằng tài khoản DETOLA cấp.
2. Mở DevTools Console trên trang `Creator`, dán nội dung `scripts/kalodata-collector.js`, Enter.
   Script gọi các endpoint nội bộ của chính web app bằng session hiện tại và tải xuống `kalodata-<date>.json`.
3. Chép file vào `data/kalodata/`. Pipeline sẽ đọc tất cả snapshot trong thư mục này.

## 4. Cấu hình chính (`.env.local`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Có key → provider `anthropic` |
| `AI_PROVIDER` | auto | `anthropic` \| `openai` \| `mock` |
| `MODEL_SCREEN` / `MODEL_VIDEO` / `MODEL_FINAL` | haiku-5-5 / sonnet-5-5 / opus-5-5 | Model tiering từng stage |
| `EFFORT_SCREEN` / `EFFORT_VIDEO` / `EFFORT_FINAL` | low / low / medium | Độ sâu suy luận |
| `DATA_SOURCE` | `kalodata` | `kalodata` \| `fixture` |
| `AI_CONCURRENCY` / `MEDIA_CONCURRENCY` | 4 / 3 | Giới hạn song song |
| `USD_VND` | 26000 | Quy đổi chi phí hiển thị |

## 5. Giới hạn hiện tại

- **Dữ liệu Kalodata là snapshot** thu thủ công qua browser, chưa tự động/định kỳ. Field nhân khẩu học follower phụ thuộc gói Kalodata.
- **Chi phí booking KOC là ước tính** theo tier follower (`DEFAULT_RATE_CARD`), chưa có báo giá thật.
- **Âm thanh**: chỉ dùng auto-caption của TikTok; video không có caption thì model chỉ dựa vào hình + caption bài đăng (chưa chạy ASR như Whisper).
- **Video**: 2 video / creator, 6 frame / video — đủ cho tín hiệu chính, có thể bỏ sót chi tiết giữa các frame.
- **Rubric và trọng số** đặt theo kinh nghiệm, chưa được hiệu chỉnh bằng dữ liệu hiệu quả chiến dịch thực tế (CTR, GMV sau booking).
- Worker chạy trong process Next.js (fire-and-forget) — đủ cho demo, production nên tách worker riêng.
- Chưa có auth / multi-tenant cho UI.

## 6. Hướng mở rộng

- **Postgres + worker pool** (`SKIP LOCKED`) để chạy 500 KOC song song nhiều máy; schema giữ nguyên.
- **Message Batches API** cho `text_screen` / `video_analysis` (giảm 50% chi phí, xử lý async).
- **Kalodata API / Playwright worker** có lịch thu thập định kỳ thay cho collector thủ công.
- **ASR** (Whisper/gpt-4o-transcribe) cho video không có caption; **scene-change detection** chọn frame thông minh hơn.
- **Feedback loop**: lưu kết quả thật sau campaign (view, GMV, CPM) → học lại trọng số `PREFILTER_WEIGHTS` và rubric.
- **Lookalike search**: embedding hồ sơ nội dung video (đã cache) để tìm creator giống những KOC từng hiệu quả.
- **Đàm phán**: xuất danh sách + concept gợi ý sang CRM / outreach.

## 7. Cấu trúc thư mục

```
briefs/                 brief mẫu (đề bài kem chống nắng)
data/fixtures/          data synthetic cho chế độ offline
data/kalodata/          snapshot Kalodata (input thật)
docs/                   ARCHITECTURE.md, BENCHMARK.md
scripts/                discover (CLI), benchmark, gen-fixtures, kalodata-collector
src/lib/                lõi hệ thống (xem docs/ARCHITECTURE.md §5)
src/app, src/components Next.js UI + API routes
.data/                  SQLite + media cache (gitignored)
```
