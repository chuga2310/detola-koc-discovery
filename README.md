# AI KOC Discovery — DETOLA Technical Assessment

🇬🇧 English: [README.en.md](README.en.md) · 📝 **Báo cáo bàn giao: [docs/REPORT.md](docs/REPORT.md)** · 📋 Bảng tính năng chi tiết: [docs/FEATURES.md](docs/FEATURES.md) · 📐 Kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · 📊 Benchmark: [docs/BENCHMARK.md](docs/BENCHMARK.md)

Tìm KOC TikTok phù hợp cho một brief chiến dịch, ví dụ **5 KOC cho kem chống nắng, khách hàng nữ 18–30, ngân sách 30 triệu VND**. Dữ liệu lấy từ **Kalodata Open API**, kết hợp đọc nội dung và **xem video bằng AI**. Mỗi đề xuất đều có **bằng chứng truy vết được**: con số, khung hình, câu nói trong video.

- **Stack:** Next.js 16 (giao diện + API), **MongoDB** (toàn bộ dữ liệu app), Claude (Haiku / Sonnet / Opus theo từng bước), OpenAI (template), chế độ giả lập offline.
- **Pipeline phễu 8 bước:** 5 nguồn Kalodata → lọc số liệu (0 token) → lấy hồ sơ chi tiết có chọn lọc → AI đọc nội dung → AI xem video → AI chấm điểm có trích dẫn → chọn tối ưu theo ngân sách.
- **Chi phí có kiểm soát:**
  - Mỗi bước có checkpoint; crash giữa chừng thì chạy tiếp đúng chỗ, không trả tiền AI hay credit 2 lần.
  - Dữ liệu Kalodata đã trả được lưu thành dữ liệu thật trong MongoDB để dùng lại.

| Kết quả benchmark (chạy thật, N = 5) | |
|---|---|
| Chi phí 1 lần chạy lạnh | **≈ $1.33** = AI $0.39 + Kalodata 9.4 credit (≈ $0.94); thêm 2 nguồn mới ≈ +0.7 credit |
| Chạy lại / chiến dịch gặp lại creator | **$0**: mọi lần gọi AI và Kalodata đều dùng lại dữ liệu đã lưu |
| Thời gian | ~110 giây khi dữ liệu đã có; ~2.5–3 phút khi chạy lạnh hoàn toàn |
| Phục hồi | Kill cứng giữa bước xem video → chạy tiếp → **0 lần gọi bị trả tiền 2 lần** |
| So với cách naive (AI xem video cả pool bằng model mạnh) | AI $12.08 → $0.39, **giảm ~97%** |

---

## 1. Chạy

Yêu cầu: Node ≥ 22, MongoDB, `ffmpeg`, `yt-dlp`.

```bash
brew tap mongodb/brew
brew trust mongodb/brew                 # Homebrew mới yêu cầu tin cậy tap trước khi cài
brew install mongodb-community ffmpeg yt-dlp
brew services start mongodb-community   # MongoDB chạy ở mongodb://127.0.0.1:27017
npm install
cp .env.example .env.local              # điền ANTHROPIC_API_KEY, KALODATA_API_KEY; MONGODB_URI nếu khác mặc định
```

```bash
npm run dev                                         # http://localhost:3000
npm run discover -- --brief briefs/sunscreen.json   # hoặc chạy bằng CLI
npm run benchmark -- --fresh                        # đo end-to-end, ghi docs/BENCHMARK.md
npm run migrate:sqlite                              # (1 lần) chuyển dữ liệu từ bản SQLite cũ .data/koc.db sang MongoDB
```

### Chế độ offline (không cần key)

```bash
npm run gen:fixtures                      # 120 creator MẪU (handle demo_*)
DATA_SOURCE=fixture AI_PROVIDER=mock npm run dev
```

Chế độ này chỉ để xem luồng và thử tính năng phục hồi; nội dung đánh giá là giả lập.

### Thử khả năng phục hồi

```bash
npm run discover -- --brief briefs/sunscreen.json --crash-after video_analysis:3   # kill cứng process
npm run discover -- --list                                                         # thấy chiến dịch bị gián đoạn
npm run discover -- --resume <runId>                                               # chạy tiếp từ checkpoint
```

Trên giao diện: bấm **Tạm dừng** khi chiến dịch đang chạy, rồi **Chạy tiếp**.

## 2. Giao diện

| Màn hình | Nội dung |
|---|---|
| `/` **Chiến dịch** | Danh sách mọi lần tìm KOC (sắp xếp được, tự làm mới khi đang chạy) + nút **Brief mới** |
| `/new` **Brief mới** | **Form** điền nhanh bằng chip (ngân sách chọn tiền tệ + mức có sẵn hoặc tự nhập). **Ô chat**: kể bằng lời, AI hỏi thêm từng câu kèm lựa chọn. Đủ thông tin → thẻ brief để xác nhận, tuỳ chọn bật **dữ liệu chuyên sâu (trả phí)** → **Bắt đầu tìm creator** |
| `/runs/:id` **Chiến dịch** | Brief đã chốt và hội thoại → **8 bước nghiên cứu** (mở từng bước để xem chi tiết) → KOC đề xuất kèm bằng chứng bấm được. Chi phí và nhật ký nằm trong mục thu gọn |

Giao diện theo design system của DETOLA (detola.vn), mô tả ở [DESIGN.md](DESIGN.md); hồ sơ sản phẩm (người dùng, nguyên tắc) ở [PRODUCT.md](PRODUCT.md).

## 3. Pipeline

| # | Bước | Chi phí | Việc |
|---|---|---|---|
| 1 | `source` | ~1.1 credit | 5 nguồn: bán hàng tốt, tương tác cao, đang làm video về sản phẩm, **đã bán sản phẩm cùng loại**, **đang tăng trưởng**. Mỗi nguồn chịu lỗi độc lập |
| 2 | `prefilter` | 0 | Lọc cứng + điểm số liệu (reach trên view tự nhiên, GPM, đà tăng); chia đều suất theo nguồn → giữ ~4N |
| 3 | `enrich` | 0.2 credit / người | Hồ sơ chi tiết + video gần đây chỉ cho ~4N người, rồi chấm lại điểm |
| 4 | `text_screen` | Haiku, 10 người / lần | Ngách, độ hợp thương hiệu, độ liên quan sản phẩm, rủi ro → giữ ~2N |
| 5 | `media_prep` | 0.5 credit / người | Lời thoại tiếng Việt (miễn phí) + MP4 video chính → ảnh lưới 6 khung hình |
| 6 | `video_analysis` | Sonnet, 1 lần / người | Hồ sơ nội dung khách quan, không phụ thuộc brief → dùng lại xuyên chiến dịch |
| 7 | `final_rank` | Opus, 10 người / lần | Điểm theo rubric; lý do và rủi ro **bắt buộc trích mã bằng chứng** |
| 8 | `select` | 0 | Knapsack: N KOC tổng điểm cao nhất trong ngân sách |

**Dữ liệu chuyên sâu (trả phí, mặc định tắt):** doanh thu theo ngành (~2 cr), chi tiết video (~2 cr), sản phẩm creator đang bán (~1 cr). Xem [docs/FEATURES.md](docs/FEATURES.md#3-dữ-liệu-chuyên-sâu-trả-phí-phải-bật).

## 4. Cấu hình (`.env.local`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Có key → dùng Claude |
| `KALODATA_API_KEY` | – | Kalodata Open API (header `secret-key`) |
| `MONGODB_URI` / `MONGODB_DB` | `mongodb://127.0.0.1:27017` / `koc_discovery` | Database của app |
| `DATA_SOURCE` | `kalodata` | `kalodata` \| `fixture` |
| `AI_PROVIDER` | tự chọn | `anthropic` \| `openai` \| `mock` |
| `MODEL_SCREEN` / `MODEL_VIDEO` / `MODEL_FINAL` | haiku-5-5 / sonnet-5-5 / opus-5-5 | Model cho từng bước |
| `EFFORT_SCREEN` / `EFFORT_VIDEO` / `EFFORT_FINAL` | low / low / medium | Độ sâu suy luận |
| `KALODATA_MAX_CREDITS_PER_RUN` | 12 | Trần credit mỗi chiến dịch (cộng thêm phần trả phí người dùng đã bật) |
| `KALODATA_DATA_MAX_AGE_HOURS` | 168 | Dữ liệu Kalodata đã lưu được dùng lại bao lâu |
| `KALODATA_VIDEO_URL_FALLBACK` | `primary` | Lấy MP4 trả phí cho `primary` (video chính) \| `all` \| `off` |
| `PAID_FEATURES` | `demo` | Dữ liệu chuyên sâu: `demo` (được bật thử) \| `on` \| `off` (khoá) |
| `AI_CONCURRENCY` / `MEDIA_CONCURRENCY` | 4 / 3 | Giới hạn song song |

## 5. Giới hạn hiện tại

- **Không có nhân khẩu học follower:** Kalodata Open API không trả tuổi / giới tính khán giả. Phần "nữ 18–30" do AI suy từ nội dung; rubric giới hạn điểm phần này, nên điểm phù hợp thường ở mức 50–65.
- **Dữ liệu thiên về TikTok Shop:** Kalodata theo dõi creator có bán hàng. 5 nguồn và chia suất giảm thiên lệch, nhưng KOC thuần review không bán qua TikTok Shop có thể không có trong dữ liệu.
- **AI chưa xem video thật:** model nhận 6 khung hình tĩnh + lời thoại thay cho video, nên mất chuyển động, nhịp dựng, âm thanh. Một model đọc video gốc tốt sẽ cải thiện rất nhiều; chỉ cần thay đầu vào của bước xem video.
- **Video thứ 2 mỗi creator chỉ có ảnh bìa** (TikTok chặn tải video miễn phí; lấy MP4 cho cả 2 tốn thêm 0.5 credit / người).
- **Chi phí booking là ước tính** theo tier follower, chưa có báo giá thật.
- **Kết quả AI không hoàn toàn tất định:** creator điểm sát nhau có thể đổi thứ hạng giữa 2 lần chạy lạnh.
- Worker chạy trong process Next.js; production nên tách worker. Chưa có đăng nhập cho giao diện.

## 6. Hướng mở rộng

- **Model đọc video gốc** thay cho ảnh lưới 6 khung hình (nâng cấp chất lượng lớn nhất còn lại).
- **Nhiều worker** kéo task bằng `findOneAndUpdate` có điều kiện (lease đã dùng cơ chế này); MongoDB replica set khi lên production.
- **Message Batches API** cho bước đọc nội dung / xem video (−50% chi phí AI).
- **Nguồn có nhân khẩu học follower** (gói Kalodata cao hơn hoặc TikTok Creator Marketplace).
- **Vòng phản hồi:** lưu kết quả thật sau chiến dịch (view, GMV, CPM) để học lại trọng số.
- **Tìm creator tương tự** bằng embedding hồ sơ nội dung video đã lưu.

## 7. Cấu trúc thư mục

```
briefs/                 brief mẫu (đề bài kem chống nắng)
data/fixtures/          dữ liệu mẫu cho chế độ offline
docs/                   REPORT, ARCHITECTURE, FEATURES (vi + en), BENCHMARK (tự sinh, tiếng Việt)
PRODUCT.md, DESIGN.md   hồ sơ sản phẩm + design system (vi; bản .en.md tiếng Anh), dùng cho công cụ thiết kế
AGENTS.md               hướng dẫn cho AI coding agent, do `next dev` tự sinh
benchmark/results.json  số liệu thô của benchmark
scripts/                discover (CLI), benchmark, gen-fixtures, migrate-sqlite
src/lib/                lõi hệ thống (xem docs/ARCHITECTURE.md §5)
src/app, src/components giao diện Next.js + API (brief/ = form, chat/ = hội thoại AI)
.data/media/            ảnh lưới và phụ đề video (gitignored)
```
