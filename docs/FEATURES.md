# Tính năng — AI KOC Discovery

🇬🇧 English: [FEATURES.en.md](FEATURES.en.md) · Tổng quan: [README.md](../README.md) · Kiến trúc: [ARCHITECTURE.md](ARCHITECTURE.md)

Ký hiệu chi phí: **0** = không tốn gì thêm · **AI** = token Claude · **cr** = credit Kalodata (1 cr ≈ $0.1). Ước tính cho brief 5 KOC.

## 1. Tạo brief

| Tính năng | Mô tả | Ở đâu | Cách hoạt động | Chi phí |
|---|---|---|---|---|
| Form điền nhanh | Chọn bằng chip, chỉ cần gõ tên sản phẩm | `/new` | react-hook-form + zod; dữ liệu form là nguồn chuẩn, AI không được sửa | 0 |
| Ngân sách thân thiện | Chọn VND/USD, mức có sẵn (mặc định 30 triệu) hoặc tự nhập có dấu phân cách; hiện "khoảng X mỗi KOC" | `/new` | Đổi tiền tệ tự quy đổi và bám vào mức có sẵn gần nhất | 0 |
| Khách hàng, độ tuổi, quy mô | Chip giới tính, nhóm tuổi (chọn nhiều), tier follower Nano/Micro/Mid/Macro | `/new` | Nhóm tuổi / tier được gộp thành khoảng min–max | 0 |
| Kể cho AI | Ô chat cuối trang có viền sáng và gợi ý "Chưa biết bắt đầu từ đâu?" | `/new` | Gửi mô tả tự do → chuyển sang phiên chat | AI ≈ $0.001 / lượt |
| AI hỏi thêm | Hỏi từng câu còn thiếu, kèm lựa chọn chọn 1 / chọn nhiều và "Khác" | Phiên chat | Code chọn câu hỏi và dựng lựa chọn; AI (Haiku) chỉ hiểu câu tự do, viết câu hỏi tự nhiên, gợi ý từ khoá và điểm nổi bật | AI ≈ $0.001 / lượt |
| Brief đang có | Cột bên phải cho thấy mục nào đã có / còn thiếu | Phiên chat (desktop) | Cập nhật sau mỗi lượt | 0 |
| Xác nhận brief | Thẻ brief "Đủ thông tin", nút Bắt đầu tìm creator, Sửa brief | Phiên chat | Sửa brief mở lại form với giá trị hiện tại | 0 |
| Lưu hội thoại | Hội thoại lập brief lưu kèm chiến dịch; chi phí các lượt hỏi gắn vào chiến dịch | Trang chiến dịch | MongoDB `runs.chat` | 0 |

## 2. Tìm và chấm KOC (pipeline 8 bước)

| Tính năng | Mô tả | Cách hoạt động | Chi phí |
|---|---|---|---|
| Nguồn "Bán hàng tốt" | Creator có doanh thu từ video cao | `creator/rank` sắp theo doanh thu video | ~0.1 cr |
| Nguồn "Tương tác cao" | Creator ER ≥ 8% trong ngành chăm sóc da | `creator/rank` lọc engagement + ngành | ~0.1 cr |
| Nguồn "Đang làm video về sản phẩm" | Creator có video 30 ngày chứa từ khoá sản phẩm | `video/rank` theo từ khoá, **bỏ video AI tạo, bỏ video < 5.000 view, chỉ video đăng trong 30 ngày** | ~0.1 cr / từ khoá |
| Nguồn "Đã bán sản phẩm cùng loại" | Creator đã thật sự bán sản phẩm cùng loại (vd kem chống nắng) | Top 5 sản phẩm theo từ khoá (`product/rank`) → người bán từng sản phẩm (`creator/rank` lọc `product_id`). Bằng chứng từ đơn hàng thật | ~0.6 cr |
| Nguồn "Đang tăng trưởng" | Creator tăng doanh thu nhanh trong ngành | `creator/rank` sắp theo tăng trưởng, có sàn doanh thu | ~0.1 cr |
| Nguồn chịu lỗi độc lập | 1 nguồn lỗi không làm hỏng cả bước | Ghi cảnh báo, chạy tiếp với các nguồn còn lại | 0 |
| Lọc theo số liệu | Lọc cứng + điểm số liệu, chia đều suất theo nguồn | 0 token. Reach tính trên **view tự nhiên** (trừ view quảng cáo); thương mại dùng **GPM**; có đà tăng follower | 0 |
| Xem hồ sơ chi tiết | Bio, video gần đây, GPM, giá TB sản phẩm, follower mới, doanh thu 30 ngày, tên kênh liên hệ | Chỉ cho ~20 người qua lọc (lazy) | 0.2 cr / người |
| Đọc nội dung | AI đọc caption, ngách, rủi ro, tín hiệu số liệu | Haiku, 10 creator / lần gọi | AI ~$0.003 |
| Chuẩn bị video | Lời thoại tiếng Việt gốc + 6 khung hình thành ảnh lưới | yt-dlp (miễn phí) + MP4 Kalodata cho video chính + ffmpeg | 0.5 cr / người |
| Xem video bằng AI | Dạng video, có thoa lên da / cận texture, chất lượng quay, quan sát có số khung hình | Sonnet vision, 1 lần gọi / người; không phụ thuộc brief → dùng lại cho mọi chiến dịch | AI ~$0.02 / người |
| Chấm điểm và lý do | Điểm phù hợp, lý do, rủi ro, gợi ý concept; mỗi ý phải trích mã bằng chứng | Opus; code loại trích dẫn sai | AI ~$0.2 |
| Chọn trong ngân sách | Chọn N KOC tổng điểm cao nhất mà tổng chi phí ≤ ngân sách | Knapsack, 0 token | 0 |

## 3. Dữ liệu chuyên sâu (trả phí, phải bật)

Mặc định **tắt**. Bật từng mục ở thẻ xác nhận brief; bật bất kỳ mục nào sẽ hiện **cảnh báo trả phí** kèm số credit ước tính, và nút chạy hiện "+X credit". Bản demo (`PAID_FEATURES=demo`) cho phép bật; `off` thì khoá. Trần credit của chiến dịch được nâng đúng bằng phần đã đồng ý trả thêm.

| Tính năng | Lấy gì | Dùng ở đâu | Chi phí (5 KOC) |
|---|---|---|---|
| Doanh thu theo ngành | Doanh thu, GPM, số bán **chỉ trong ngành của brief** (`creator/detail` + `category_ids`) | Điểm ngành (pha 50/50), bằng chứng m9, thẻ đọc nội dung, pill "% doanh thu trong ngành" | ~2 cr |
| Chi tiết video | Với video AI xem: GPM, số bán, view quảng cáo, ROAS, số ngày chạy quảng cáo, CPA, thời lượng (`video/detail`) | Bằng chứng m11, pill "ROAS QC" | ~2 cr |
| Sản phẩm creator đang bán | Top 10 sản phẩm creator bán (`product/rank` lọc `creator_id`) | Bằng chứng m10 (sản phẩm cùng loại / đối thủ), pill "Đã bán N sp cùng loại" | ~1 cr |

## 4. Xem kết quả

| Tính năng | Mô tả | Ở đâu |
|---|---|---|
| Danh sách chiến dịch | Bảng sắp xếp được, tự làm mới khi có chiến dịch đang chạy, trạng thái kèm bước hiện tại | `/` |
| Phiên chiến dịch | Brief đã chốt (thu gọn 1 dòng), xem lại hội thoại, quy trình 8 bước | `/runs/:id` |
| Từng bước có thể mở | Mô tả, kết quả 1 dòng, con số chính, danh sách creator kèm nhận xét | Quy trình |
| Kết quả lên trước | Chiến dịch xong: 5 KOC hiện ngay, quy trình thu vào "Xem 8 bước đã làm" | `/runs/:id` |
| Xếp hạng + đánh giá KOC | Badge đánh giá, điểm tổng / AI / số liệu / nội dung / video, tín hiệu nhanh | `/runs/:id` |
| Bằng chứng bấm được | Bấm mã cạnh lý do → câu bằng chứng + khung hình được khoanh trong dải ảnh | `/runs/:id` |
| Dự phòng | Các KOC xếp sau, phòng khi top bị từ chối | `/runs/:id` |
| Chi phí và nhật ký | Bảng token AI theo bước, credit Kalodata theo endpoint (trả thật / dùng lại), log | Mục thu gọn |
| Tạm dừng / Chạy tiếp | Dừng an toàn và chạy tiếp từ checkpoint | Header trang chiến dịch |
| Lỗi dễ hiểu | Thông báo bằng lời thường (vd nguồn dữ liệu từ chối truy cập), chi tiết kỹ thuật để trong mục thu gọn | `/runs/:id` |

## 5. Dữ liệu, chi phí, độ tin cậy

| Tính năng | Mô tả | Cách hoạt động |
|---|---|---|
| MongoDB | Toàn bộ dữ liệu app: chiến dịch, checkpoint, cache AI, log chi phí, dữ liệu Kalodata | `src/lib/db.ts` |
| Kho dữ liệu Kalodata | Mỗi lần gọi xếp hạng lưu thành **snapshot** (tham số, thời điểm, thứ tự kết quả); creator / video / sản phẩm thành document có cột số liệu để truy vấn | `src/lib/sources/kaloStore.ts` |
| Dùng lại dữ liệu đã trả | Cùng tham số trong 7 ngày (`KALODATA_DATA_MAX_AGE_HOURS`) → 0 credit; API lỗi → dùng bản cũ kèm cảnh báo | kaloStore |
| Cache AI theo nội dung | Cùng input → 0 token; phân tích video dùng lại xuyên chiến dịch | `ai_cache` |
| Checkpoint 2 tầng | Bước xong không chạy lại; task xong không chạy lại | `run_stages`, `tasks` |
| Lease + heartbeat | 1 chiến dịch chỉ 1 worker; worker chết → tiếp quản | `findOneAndUpdate` có điều kiện |
| Trần credit | Chặn trước khi gọi nếu vượt trần (12 cr + phần trả phí đã bật) | `kalodataApi.ts` |
| Quyền riêng tư | Bio che email / số điện thoại; liên hệ chỉ lưu tên kênh | kalodata.ts, kaloStore.ts |
| Chuyển dữ liệu từ SQLite | Script 1 lần chuyển chiến dịch, cache, log và dữ liệu Kalodata cũ sang MongoDB | `npm run migrate:sqlite` |
| Chế độ offline | Dữ liệu mẫu + AI giả lập để xem luồng | `DATA_SOURCE=fixture AI_PROVIDER=mock` |
