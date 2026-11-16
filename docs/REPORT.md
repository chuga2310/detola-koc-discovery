# Báo cáo bàn giao — AI KOC Discovery

🇬🇧 English: [REPORT.en.md](REPORT.en.md)

Bài đánh giá kỹ thuật Founding Engineer của DETOLA. Đề bài: tìm KOC TikTok phù hợp brief, ví dụ **5 KOC cho kem chống nắng, khách nữ 18–30, ngân sách 30 triệu VND**.

Báo cáo này đi theo 5 yêu cầu bàn giao. Mỗi phần có tóm tắt ngắn, chi tiết nằm ở tài liệu được dẫn link.

| # | Yêu cầu | Trạng thái | Xem ở đâu |
|---|---|---|---|
| 1 | GitHub Repo | Xong | https://github.com/chuga2310/detola-koc-discovery |
| 2 | Working Prototype | Xong, chạy local | [README §1](../README.md#1-chạy), mục 2 bên dưới |
| 3 | Architecture | Xong | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 4 | Benchmark Results | Xong (đo ngày 2026-11-16) | [BENCHMARK.md](BENCHMARK.md), [results.json](../benchmark/results.json) |
| 5 | README | Xong (vi + en) | [README.md](../README.md), [README.en.md](../README.en.md) |

---

## 1. GitHub Repo

- Repo public: https://github.com/chuga2310/detola-koc-discovery (nhánh `master`).
- Code do tôi tự khởi tạo và quản lý từ đầu. Lịch sử commit chia theo từng giai đoạn: pipeline lõi, nguồn Kalodata + benchmark, giao diện, chuyển sang MongoDB, tận dụng dữ liệu Kalodata, review code.
- Không có secret trong repo: key chỉ nằm trong `.env.local` (đã gitignore), toàn bộ lịch sử đã được quét trước khi public. Dữ liệu liên hệ của creator (email, SĐT) không được lưu, chỉ lưu tên kênh liên hệ.
- Tài liệu song ngữ: mỗi tài liệu chính có bản tiếng Việt và bản `.en.md`.

## 2. Working Prototype

Prototype chạy đầy đủ quy trình nghiên cứu và đề xuất KOC trên máy local (Next.js + MongoDB + Claude + Kalodata Open API). Chưa deploy lên server vì bước xử lý video cần `ffmpeg` và `yt-dlp`, và cần key Kalodata / Anthropic.

**Luồng demo trên giao diện:**

1. `/` **Chiến dịch**: danh sách các lần tìm KOC, tự làm mới khi đang chạy.
2. `/new` **Brief mới**: điền form nhanh, hoặc mô tả bằng lời trong chat để AI hỏi thêm kèm lựa chọn. Đủ thông tin thì AI hiện thẻ brief để xác nhận. Có thể bật **dữ liệu chuyên sâu** (trả phí, có cảnh báo và ước tính credit).
3. `/runs/:id` **Phiên chiến dịch**: brief và hội thoại → 8 bước nghiên cứu chạy realtime (mở từng bước để xem chi tiết) → danh sách KOC đề xuất, mỗi lý do và rủi ro có chip bằng chứng bấm được (số liệu, khung hình video, câu trích lời thoại), kèm danh sách dự phòng, chi phí và log.
4. **Khả năng phục hồi**: bấm **Tạm dừng** khi đang chạy rồi **Chạy tiếp**. Chiến dịch tiếp tục đúng chỗ dừng, không trả tiền AI hay credit lần hai.

**Chạy thử** (chi tiết ở [README §1](../README.md#1-chạy)):

```bash
npm install && cp .env.example .env.local   # điền ANTHROPIC_API_KEY, KALODATA_API_KEY
npm run dev                                 # http://localhost:3000
npm run discover -- --brief briefs/sunscreen.json   # hoặc chạy bằng CLI
```

Không có key vẫn xem được toàn bộ luồng ở **chế độ offline**: dữ liệu mẫu 120 creator, AI giả lập (`DATA_SOURCE=fixture AI_PROVIDER=mock`). Thử crash cứng giữa chừng rồi chạy tiếp bằng `--crash-after video_analysis:3` và `--resume <runId>`.

## 3. Architecture

Chi tiết và sơ đồ (mermaid) ở [ARCHITECTURE.md](ARCHITECTURE.md). Tóm tắt:

**Pipeline 8 bước theo hình phễu.** Càng xuống sâu, chi phí mỗi creator càng cao, nên số creator phải giảm nhanh:

| # | Bước | Chi phí | Việc làm |
|---|---|---|---|
| 1 | `source` | ~1.1 credit | 5 nguồn Kalodata: bán tốt qua video, tương tác cao, đã làm video đúng sản phẩm, đã bán sản phẩm cùng loại, đang tăng trưởng |
| 2 | `prefilter` | 0 | Lọc cứng + điểm số liệu, chia suất đều theo nguồn → giữ ~4N |
| 3 | `enrich` | 0.2 credit / creator | Chi tiết hồ sơ + video gần đây, chỉ cho ~4N creator |
| 4 | `text_screen` | Haiku, 10 creator / call | Ngách, độ hợp thương hiệu, rủi ro → giữ ~2N |
| 5 | `media_prep` | 0 – 0.5 credit / creator | Phụ đề tiếng Việt + 6 khung hình ghép thành 1 ảnh lưới |
| 6 | `video_analysis` | Sonnet, 1 call / creator | Hồ sơ nội dung khách quan, không phụ thuộc brief → dùng lại cho mọi chiến dịch |
| 7 | `final_rank` | Opus, 10 creator / call | Chấm theo rubric; lý do và rủi ro **bắt buộc trích evidence id** |
| 8 | `select` | 0 | Knapsack: N KOC tổng điểm cao nhất trong ngân sách |

**Các quyết định chính:**

- **Phễu rẻ → đắt:** lọc bằng số liệu (0 token) trước, AI rẻ đọc chữ, AI đắt chỉ xem video của ~2N creator. Rẻ hơn ~97% so với cho model mạnh xem video cả pool.
- **Model tiering:** Haiku / Sonnet / Opus theo độ khó của từng bước.
- **Bằng chứng có ID, code kiểm tra trích dẫn:** AI chỉ được trích bằng chứng có thật; id không tồn tại bị loại. Mọi nhận định trên UI đều truy được về số liệu hoặc khung hình cụ thể.
- **Checkpoint cấp bước và cấp task, lease + heartbeat, cache AI theo nội dung:** chết giữa chừng thì chạy tiếp đúng chỗ, không trả tiền hai lần.
- **Dữ liệu Kalodata lưu thành dữ liệu thật trong MongoDB** (snapshot xếp hạng + thực thể creator / video / sản phẩm), dùng lại trong 7 ngày, API lỗi thì dùng bản cũ kèm cảnh báo.
- **Kiểm soát credit:** trần credit mỗi chiến dịch, giữ chỗ trước khi gọi API, rate limit theo endpoint. Dữ liệu chuyên sâu trả phí phải tự bật.
- **Điểm cuối neo vào số liệu** (70% AI fit + 30% điểm dữ liệu), rồi tối ưu ngân sách bằng knapsack (DP chính xác khi nhỏ, greedy khi lớn).

## 4. Benchmark Results

Số liệu từ lần chạy thật `8ee88197` ngày **2026-11-17**, brief kem chống nắng, N = 5, đủ 5 nguồn Kalodata. Báo cáo đầy đủ ở [BENCHMARK.md](BENCHMARK.md), số liệu thô ở [results.json](../benchmark/results.json).

"Lần chạy đầu" trong báo cáo này nghĩa là chưa có cache AI và chưa có dữ liệu Kalodata lưu sẵn, nên phải trả đủ tiền AI và credit. Chạy lại cùng brief thì dùng lại cả hai.

### 4.1 Kết quả 5 KOC

Chi phí booking ước tính **19.000.000 ₫ / 30.000.000 ₫**, optimizer DP: chọn tổ hợp có tổng điểm cao nhất, không cố tiêu hết ngân sách.

| # | Creator | Followers | Chi phí ước tính | Final | AI fit | Data | Video | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | [@ngoc.matcha.review](https://www.tiktok.com/@ngoc.matcha.review) | 145.700 | 7.000.000 | 60.4 | 62 | 56.7 | 39.5 | good |
| 2 | [@bachluulinh](https://www.tiktok.com/@bachluulinh) | 75.800 | 4.000.000 | 53.6 | 60 | 38.6 | 65 | good |
| 3 | [@rin.review22](https://www.tiktok.com/@rin.review22) | 13.500 | 2.000.000 | 52.6 | 51 | 56.2 | 39.5 | weak |
| 4 | [@phuongmet57](https://www.tiktok.com/@phuongmet57) | 14.900 | 2.000.000 | 52.5 | 49 | 60.7 | 27.2 | weak |
| 5 | [@changaffiliate](https://www.tiktok.com/@changaffiliate) | 85.100 | 4.000.000 | 51.4 | 48 | 59.3 | 39.5 | weak |

Hệ thống nói thẳng khi kết quả chưa mạnh: 3/5 KOC ở mức "weak". Reach rẻ và bán tốt nhưng chủ yếu là kênh chốt deal, ít thoa thật lên da; điểm khớp khán giả bị giới hạn vì API không có nhân khẩu học follower.

### 4.2 Bằng chứng

Mỗi KOC có 3–4 lý do và 2–3 rủi ro, mỗi ý kèm evidence id truy được. Ví dụ với #1 @ngoc.matcha.review:

- ✅ GPM video 246k VND / 1.000 view, top 5% pool — `c4.m7`.
- ✅ 28.9M view tự nhiên / 30 ngày (đã trừ view quảng cáo), 83k view kỳ vọng mỗi 1 triệu VND — `c4.m1`, `c4.m4`.
- ⚠️ Đang bán kem chống nắng Beplain, có thể xung đột với đối thủ — `c4.m10`, `c4.t2`.
- ⚠️ Chỉ show bao bì, nêu thành phần nhưng không thoa lên da — `c4.v1.o4`.

Danh sách đầy đủ cho cả 5 KOC ở [BENCHMARK.md §1](BENCHMARK.md#1-kết-quả-5-koc).

### 4.3 Token, chi phí, thời gian

| | Số liệu |
|---|---|
| AI | 13 call, 48.639 input + 34.857 cache read + 25.209 output token, 20 ảnh → **$0.40** |
| Kalodata cho lần chạy đầu | **9.4 credit ≈ $0.94** (lần đo này chỉ trả 3.1 credit, phần còn lại dùng dữ liệu đã lưu) |
| **Tổng 1 lần chạy đầu** | **≈ $1.34** |
| Thời gian xử lý | **133.6 s** active (một phần dữ liệu Kalodata đã lưu); chạy lần đầu hoàn toàn ~2.5–3 phút |
| Chạy lại cùng brief | 13/13 call AI dùng lại cache, **$0**, cùng kết quả |
| Phục hồi | Kill cứng ở bước xem video sau 5 call AI đã trả tiền → chạy tiếp ở process mới → **0 call trả tiền hai lần** |
| So với cách ngây thơ | Model mạnh xem video cả pool: AI **$12.08** → **$0.40** (~97% rẻ hơn) |

Chi phí AI theo bước: đọc nội dung $0.0034 · xem video $0.2119 · chấm cuối $0.1894. Phễu: pool 224 → qua lọc số liệu 213 → lấy chi tiết 20 → đọc nội dung 20 → xem video 10 → chấm cuối 10 → chọn 5.

### 4.4 Chi phí AI theo từng creator

Xem video là 1 call riêng cho mỗi creator nên tính nguyên call; đọc nội dung và chấm cuối là 1 call cho tối đa 10 creator nên chia đều chi phí call cho số creator trong batch.

| Creator đi tới bước | Số người | Đọc nội dung (Haiku) | Xem video (Sonnet) | Chấm cuối (Opus) | AI / người | Kalodata / người |
|---|---|---|---|---|---|---|
| Đi hết phễu (5 được chọn + 5 không chọn) | 10 | $0.0002 | $0.0187–0.0302 (TB $0.0212) | $0.0189 | **$0.0403** (≈ $0.11 cả Kalodata) | 0.7 credit |
| Dừng sau bước đọc nội dung | 10 | $0.0002 | – | – | **$0.0002** | 0.2 credit |

Call xem video đầu tiên (@bachluulinh, $0.0302) đắt hơn vì ghi prompt cache; các call sau đọc lại cache nên ~$0.02. Mỗi KOC được chọn gánh luôn phần của người bị loại: AI $0.4046 / 5 = **$0.081 / KOC**, cộng Kalodata lần chạy đầu ≈ **$0.27 / KOC**. Bảng từng người ở [BENCHMARK.md §2](BENCHMARK.md#2-token--chi-phí--thời-gian-run-8ee88197).

### 4.5 Case bật dữ liệu chuyên sâu Kalodata

Cùng brief, bật cả 3 phần trả phí trên form (run `293f2b65`, xoá cache AI trước khi chạy):

| | Mặc định | Bật chuyên sâu |
|---|---|---|
| AI (13 call) | $0.4046 | $0.4059 |
| AI / người đi hết phễu | $0.0403 | $0.0404 |
| Kalodata trả trong run | 3.1 credit | 5.0 credit (doanh thu theo ngành 2.0 + chi tiết video 2.0 + sản phẩm đang bán 1.0, đúng ước tính) |
| Kalodata / người đi hết phễu | 0.7 credit | 1.1 credit |
| Tổng 1 lần chạy đầu | ≈ $1.34 | ≈ $1.75 |
| 5 KOC | – | 4/5 giữ nguyên; @luumaianh_ thay @bachluulinh; #1 fit 62 → 66; booking 22 / 30 triệu |

Dữ liệu chuyên sâu gần như không đổi chi phí AI; chi phí thêm là credit Kalodata.

**Dự phóng quy mô** (từ chi phí đơn vị đo được):

| KOC cần tìm | AI | AI với Batch API | Kalodata | Tổng ≈ |
|---|---|---|---|---|
| 5 | $0.40 | $0.20 | 9.4 credit | $1.34 |
| 50 | $4.05 | $2.02 | 94 credit | $13.45 |
| 500 | $40.46 | $20.23 | 940 credit | $134.46 |

**Thời điểm đo.** Đo lại ngày 2026-11-17 với key Kalodata mới, sau các thay đổi: thêm 2 nguồn (`proven`, `rising`), chuyển sang MongoDB, tín hiệu từ dữ liệu đã trả tiền và dữ liệu chuyên sâu. Chạy lại bằng `npm run benchmark -- --fresh` (thêm `--no-deep` để bỏ case dữ liệu chuyên sâu); dữ liệu Kalodata đã lưu được dùng lại nên chỉ tốn credit cho phần mới.

## 5. README

[README.md](../README.md) (tiếng Việt) và [README.en.md](../README.en.md) (tiếng Anh) gồm:

- **Hướng dẫn chạy** (§1): yêu cầu (Node ≥ 22, MongoDB, ffmpeg, yt-dlp), cài đặt, chạy web / CLI / benchmark, chế độ offline, thử phục hồi sau crash. Cấu hình `.env.local` ở §4.
- **Giới hạn hiện tại** (§5): không có nhân khẩu học follower; dữ liệu thiên về creator có bán TikTok Shop; AI xem 6 khung hình tĩnh + lời thoại thay cho video thật; video thứ 2 mỗi creator chỉ có ảnh bìa; chi phí booking là ước tính; kết quả AI không hoàn toàn tất định; worker chạy chung process Next.js, chưa có đăng nhập.
- **Hướng mở rộng** (§6): model đọc video gốc; nhiều worker và MongoDB replica set; Message Batches API (−50% chi phí AI); nguồn có nhân khẩu học follower; vòng phản hồi từ kết quả chiến dịch thật; tìm creator tương tự bằng embedding.

Tài liệu đi kèm: [FEATURES.md](FEATURES.md) (bảng tính năng chi tiết), [ARCHITECTURE.md](ARCHITECTURE.md), [BENCHMARK.md](BENCHMARK.md), [PRODUCT.md](../PRODUCT.md) và [DESIGN.md](../DESIGN.md) (hồ sơ sản phẩm + design system theo DETOLA).
