# Product

<!-- impeccable:product-schema 1 -->

> Bản tiếng Anh: [PRODUCT.en.md](PRODUCT.en.md). Đây là hồ sơ sản phẩm mà công cụ thiết kế (impeccable) đọc trước khi làm UI; tiêu đề mục giữ tiếng Anh theo đúng schema của công cụ.

## Platform

web

## Users

Chính: marketer ở brand mỹ phẩm hoặc agency tại Việt Nam, cần một danh sách ngắn KOC TikTok (Key Opinion Consumer) cho chiến dịch. Họ làm việc tại bàn, giờ hành chính, thường mở brief của khách bên cạnh công cụ. Việc cần làm: biến brief chiến dịch (sản phẩm, khách hàng mục tiêu, ngân sách, số KOC) thành một danh sách bảo vệ được trước brand manager, mỗi người được chọn đều có lý do và bằng chứng.

Phụ (bối cảnh đã xác nhận, không phải đối tượng thiết kế): hội đồng tuyển dụng DETOLA chấm bài đánh giá kỹ thuật này.

## Product Purpose

KOC Discovery nghiên cứu một pool lớn creator TikTok từ dữ liệu Kalodata, dùng AI phân tích nội dung và video của họ, rồi đề xuất N creator hợp brief trong ngân sách. Thành công nghĩa là marketer tin và giải thích được từng đề xuất mà không phải nghiên cứu lại, và chi phí AI / dữ liệu để tạo ra nó vẫn thấp.

## Positioning

Mọi đề xuất đều trích bằng chứng: mỗi lý do gắn với một số liệu cụ thể, một thông tin về khán giả, hoặc một frame được đánh số kèm câu trích từ chính video của creator; trích dẫn không tồn tại bị code loại bỏ. Pipeline là một phễu tính đến chi phí (lọc bằng số liệu trước, rồi AI rẻ, rồi mới tới AI xem video đắt), có checkpoint, chạy tiếp được sau khi dừng, và mỗi chiến dịch có bảng chi phí hiển thị rõ.

## Operating Context

- Luồng làm việc: mở danh sách chiến dịch → tạo brief (form nhanh, hoặc mô tả trong chat để AI hỏi thêm kèm lựa chọn) → xác nhận brief, có thể bật dữ liệu chuyên sâu (trả phí) → theo dõi 8 bước nghiên cứu → đọc KOC đã xếp hạng, điểm, lý do, rủi ro và bằng chứng video → so với danh sách dự phòng → tạm dừng / chạy tiếp khi cần.
- Một chiến dịch chạy lần đầu (chưa có cache AI, chưa có dữ liệu Kalodata lưu sẵn) mất ~2–3 phút; người dùng xem tiến độ rồi đọc kỹ kết quả.
- Chi phí là mối quan tâm hàng đầu: token AI (USD) và credit Kalodata (1 credit ≈ $0.1) hiển thị theo từng bước và từng endpoint; dữ liệu Kalodata đã trả tiền được lưu lại và dùng lại.
- Nội dung bằng tiếng Việt (chữ trên UI, lý do của AI); định danh kỹ thuật (tên stage, tên model, evidence id) giữ tiếng Anh.

## Capabilities and Constraints

- App Next.js 16 (App Router), UI + API route trong cùng một app; MongoDB lưu toàn bộ dữ liệu app (chiến dịch, checkpoint, creator theo từng chiến dịch, cache AI, log chi phí, dữ liệu Kalodata đã lưu); tiến độ realtime bằng polling.
- Màn hình: `/` danh sách chiến dịch, `/new` brief mới (form + chat AI), `/runs/:id` phiên chiến dịch (brief và hội thoại, 8 bước thu gọn được, kết quả).
- Trường brief: brand, sản phẩm, ngành hàng, ghi chú sản phẩm, keyword, keyword nội dung, giới tính / độ tuổi mục tiêu, ngân sách (VND hoặc USD), số KOC, khoảng follower, category id Kalodata, tuỳ chọn dữ liệu chuyên sâu.
- Dữ liệu chuyên sâu trả phí (doanh thu theo ngành, chi tiết video, sản phẩm creator đang bán) phải tự bật, có cảnh báo chi phí kèm ước tính, và nâng trần credit của chiến dịch đúng bằng phần đó; `PAID_FEATURES` có thể khoá tính năng này.
- Màn chiến dịch: trạng thái, tạm dừng / chạy tiếp, tiến độ và thời gian từng bước, bảng token / chi phí AI, sổ credit Kalodata, số lượng qua từng tầng phễu, KOC được chọn (hạng, handle, follower, tier chi phí, chi phí booking ước tính, điểm final / AI fit / data / video, verdict, headline, lý do / rủi ro kèm chip bằng chứng, pill tín hiệu, góc nội dung đề xuất, contact sheet video với frame được trích làm nổi bật), danh sách dự phòng, log sự kiện.
- Giới hạn dữ liệu mà UI không được che: API không có nhân khẩu học follower (khán giả là suy luận), chi phí booking là ước tính theo bảng giá tier follower, kết quả ở chế độ mock là giả lập.

## Brand Commitments

- Tính cách (người dùng xác nhận): chính xác, điềm tĩnh, đáng tin.
- Cảm giác tham chiếu (đã xác nhận): Linear / Stripe Dashboard — phân cấp chặt, màu tiết chế, số liệu sắc nét.
- Hệ thống thương hiệu (quyết định của người dùng, 2026-11-16): theo design system DETOLA từ detola.vn — nền kem với card trắng, chữ navy, nút chính màu cam DETOLA, teal cho trạng thái tích cực, font Be Vietnam Pro. Quyết định này thay cho anti-reference "không dùng nền kem" trước đó: màu kem là màu thương hiệu DETOLA đã cam kết, không phải mặc định. Không sao chép logo hay hình mascot của DETOLA.
- Anti-reference (vẫn áp dụng): SaaS tối màu neon / gradient; chữ xám nhạt bạc màu với phân cấp yếu.

## Evidence on Hand

- Lần benchmark thật với 5 KOC, bằng chứng, token / credit đã dùng và thời gian: `docs/BENCHMARK.md`, `benchmark/results.json`.
- Contact sheet video thật trong `.data/media/`, phục vụ qua `/api/media/...`.
- Chưa có lời chứng thực khách hàng, logo hay case study nào; không được bịa ra.

## Product Principles

1. Bằng chứng hơn khẳng định: nhận định không truy được nguồn thì không xuất hiện.
2. Chi phí luôn hiển thị: mỗi chiến dịch cho thấy đã tiêu bao nhiêu và dữ liệu dùng lại tiết kiệm bao nhiêu; phần trả phí thêm phải tự bật và được báo trước khi tốn tiền.
3. Trung thực về độ chắc chắn: verdict yếu, dữ liệu thiếu và số ước tính đều được gắn nhãn, không làm mờ đi.
4. Lướt trước, sâu khi cần: bảng xếp hạng đọc trong vài giây; bằng chứng chỉ cách một cú click.
5. Bền vững mặc định: bị gián đoạn là trạng thái bình thường, luôn có cách chạy tiếp rõ ràng.

## Accessibility & Inclusion

WCAG 2.2 AA: độ tương phản chữ ≥ 4.5:1, dùng được hoàn toàn bằng bàn phím với focus nhìn thấy được, không truyền thông tin chỉ bằng màu (verdict và trạng thái luôn kèm chữ), tôn trọng prefers-reduced-motion.
