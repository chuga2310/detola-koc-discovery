# Benchmark

> Sinh tự động bởi `npm run benchmark` lúc 2026-11-16T18:03:56.369Z. Provider **anthropic**, data **kalodata**.

Models: screen=`claude-haiku-5-5`, video=`claude-sonnet-5-5`, final=`claude-opus-5-5`

## 1. Kết quả 5 KOC

Chi phí booking ước tính: **19.000.000 ₫ / 30.000.000 ₫** (optimizer: dp)

| # | Creator | Followers | Est. cost | Final | AI fit | Data | Video | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | [@ngoc.matcha.review](https://www.tiktok.com/@ngoc.matcha.review) | 145.700 | 7.000.000 | 60.4 | 62 | 56.7 | 39.5 | good |
| 2 | [@bachluulinh](https://www.tiktok.com/@bachluulinh) | 75.800 | 4.000.000 | 53.6 | 60 | 38.6 | 65 | good |
| 3 | [@rin.review22](https://www.tiktok.com/@rin.review22) | 13.500 | 2.000.000 | 52.6 | 51 | 56.2 | 39.5 | weak |
| 4 | [@phuongmet57](https://www.tiktok.com/@phuongmet57) | 14.900 | 2.000.000 | 52.5 | 49 | 60.7 | 27.2 | weak |
| 5 | [@changaffiliate](https://www.tiktok.com/@changaffiliate) | 85.100 | 4.000.000 | 51.4 | 48 | 59.3 | 39.5 | weak |

### #1 @ngoc.matcha.review — Chuyển đổi rất mạnh, đã bán kem chống nắng, nhưng chưa demo trên da và bán quá nhiều ngành hàng.

- ✅ GPM video 246k VND/1.000 view, thuộc top 5% pool; giá trung bình khán giả mua 189k, hợp tầm giá kem chống nắng.
  - `c4.m7` GPM video 246k VND / 1.000 view (điểm thương mại top 5% pool); giá trung bình sản phẩm khán giả đã mua 189k VND
- ✅ Có 28.9M view tự nhiên/30 ngày, kỳ vọng 83k view mỗi 1 triệu VND với chi phí 7M/video.
  - `c4.m1` Followers 146k; 28.9M view nội dung / 30 ngày (đã trừ view quảng cáo); trung vị 579k view tự nhiên của các video nổi bật (reach top 34% pool)
  - `c4.m4` Chi phí ước tính 7.0M VND/video (tier mid (100k-300k)); 83k view kỳ vọng / 1 triệu VND
- ✅ Đã có content da mụn, chống nắng; tự nhận mua lại lần 2 nên review tạo được độ tin cậy.
  - `c4.t1` Sàng lọc nội dung: ngách "Review skincare, công nghệ"; brand fit 6/10, liên quan sản phẩm 6/10. Có content da mụn, da nhạy cảm và chống nắng nhẹ, nội dung review rõ; đáng cân nhắc.
  - `c4.v1.o3` Nói đã mua lại lần 2, tạo độ tin cậy cho review. — "Ngọc mua lại lần thứ 2 rồi"
- ⚠️ Đang bán kem chống nắng Beplain, có khả năng xung đột với đối thủ trực tiếp.
  - `c4.m10` Đã bán sản phẩm cùng loại: [DEAL ĐỘC QUYỀN] Beplain Kem chống nắng Sunmuse 5…
  - `c4.t2` Cảnh báo: Tỷ lệ view trả phí 24%, reach không hoàn toàn organic; Đã bán kem chống nắng cùng loại qua deal
- ⚠️ Chỉ show bao bì, không thoa lên da; còn review đồ ăn như cơm cháy.
  - `c4.v1.o4` Nêu thành phần panthenol và lý do hợp với da nhạy cảm, da mụn, nhưng không thoa hay test trên da. — "nó sẽ có chứa panteneon"
  - `c4.v2.o3` Mô tả sản phẩm cụ thể bằng lời, nhưng không phải mỹ phẩm. — "lớp nào cũng có chà bông nha"
- ⚠️ 24% view có từ quảng cáo; quảng bá 414 sản phẩm của 179 shop.
  - `c4.m6` 100% doanh thu từ video, 0% từ livestream; quảng bá 414 sản phẩm / 179 shop; 24% tổng view video đến từ quảng cáo
- 💡 Concept gợi ý: Kể chuyện "da mụn đi spa về cần chống nắng gì", lần này thoa thật lên mặt, cận cảnh lớp kem mỏng không vệt trắng và nêu lý do mua lại.

### #2 @bachluulinh — Review skincare có thoa thật trên da, nội dung sạch, nhưng reach thấp và chi phí/view cao.

- ✅ Demo thoa lên da, kể vấn đề da rồi đưa giải pháp; chất lượng 7/10.
  - `c13.v2.o1` [frame 1 @0s] Ảnh bìa: creator mặt mộc, thoa sản phẩm lên trán, có chữ thành phần; ánh sáng nhà tắm khá ổn — "Chiết xuất tơ tằm Lô hội"
  - `c13.v2.o2` Mở bằng vấn đề da khô căng, sần, dẫn vào giải pháp; cấu trúc kể chuyện thuyết phục — "da mình cần được cấp ẩm Theo nhiều tầng hơn á"
  - `c13.v0` Tổng quan video: Review sản phẩm đối diện camera, giọng tự nhiên, kể vấn đề cá nhân rồi giới thiệu giải pháp, có chữ nhấn và cảnh dùng thật Persona: Cô gái trẻ năng động, chăm skincare và haircare hằng ngày, phong cách gần gũi. Chất lượng 7/10, brand safety: safe (Nội dung sạch, có gắn hashtag hợp tác; claim chủ yếu theo thương hiệu, ngôn ngữ…)
- ✅ Claim vừa phải, có gắn hashtag hợp tác; ER 4.7% thuộc top 21% pool.
  - `c13.v2.o3` Nêu thành phần và công dụng bằng ngôn ngữ vừa phải, không hứa hẹn quá đà — "ceramide giúp hỗ trợ củng cố hàng rào bảo vệ da"
  - `c13.m2` Engagement rate 4.7% (top 21% pool)
- ✅ Tập trung, chỉ quảng bá 32 sản phẩm; 60% ngành hàng là làm đẹp.
  - `c13.m6` 100% doanh thu từ video, 0% từ livestream; quảng bá 32 sản phẩm / 29 shop; 12% tổng view video đến từ quảng cáo
  - `c13.a2` Ngành hàng: Chăm sóc sắc đẹp & Chăm sóc cá nhân 60%, Trang phục nữ & Đồ lót 25%, Phụ kiện thời trang 15%
- ⚠️ Reach thấp: trung vị 57k view, chỉ 14k view mỗi 1 triệu VND.
  - `c13.m1` Followers 76k; 2.5M view nội dung / 30 ngày (đã trừ view quảng cáo); trung vị 57k view tự nhiên của các video nổi bật (reach top 89% pool)
  - `c13.m4` Chi phí ước tính 4.0M VND/video (tier micro+ (50k-100k)); 14k view kỳ vọng / 1 triệu VND
- ⚠️ Chưa có bài về chống nắng; nhiều nội dung dưỡng trắng cần kiểm soát claim.
  - `c13.t1` Sàng lọc nội dung: ngách "Serum dưỡng trắng, chăm sóc da đầu, mặt nạ"; brand fit 7/10, liên quan sản phẩm 5/10. Nội dung chăm sóc da rõ ràng, tương tác khá, nhưng chưa có bài về chống nắng.
  - `c13.t2` Cảnh báo: Nhiều nội dung dưỡng trắng, cần kiểm tra cam kết hiệu quả quá mức
- 💡 Concept gợi ý: Routine sáng mặt mộc trong nhà tắm: dưỡng ẩm, thoa kem chống nắng, cận cảnh độ thấm mỏng nhẹ, rồi ra nắng đi làm.

### #3 @rin.review22 — Hiệu quả view/chi phí rất cao, nhưng chỉ unboxing deal, không thoa lên da.

- ✅ Kỳ vọng 574k view mỗi 1 triệu VND, trung vị 1.1M view tự nhiên với chi phí 2M/video.
  - `c6.m4` Chi phí ước tính 2.0M VND/video (tier micro (10k-50k)); 574k view kỳ vọng / 1 triệu VND
  - `c6.m1` Followers 14k; 40.0M view nội dung / 30 ngày (đã trừ view quảng cáo); trung vị 1.1M view tự nhiên của các video nổi bật (reach top 8% pool)
- ✅ GPM 147k, giá trung bình khán giả mua 191k; follower tăng 9.6%.
  - `c6.m7` GPM video 147k VND / 1.000 view (điểm thương mại top 33% pool); giá trung bình sản phẩm khán giả đã mua 191k VND
  - `c6.m8` follower +9.6% trong 30 ngày; có doanh thu 30/30 ngày, xu hướng đi ngang
- ⚠️ Không có keyword chống nắng; ít giọng riêng.
  - `c6.m5` Không video nào gần đây chứa keyword chiến dịch (kem chống nắng, chống nắng, sunscreen...)
  - `c6.t2` Cảnh báo: Nội dung chủ yếu hợp tác thương hiệu lớn, ít giọng riêng; Không có keyword chống nắng
- ⚠️ Chỉ quay tay và hộp, không swatch hay thoa, lời thoại xoay quanh khuyến mãi.
  - `c6.v1.o3` [frame 6 @19.1s] Đặt 3 bảng mắt cạnh nhau so màu, chỉ nhìn bằng mắt, không thoa lên da
  - `c6.v1.o4` Lời thoại thiên về giá và khuyến mãi, không nói về chất phấn hay độ lên màu — "lần đầu tiên chia dép mua một tặng 2 mà chưa tới 4 lớp múc liền mấy vợ ơi"
- 💡 Concept gợi ý: Unboxing kem chống nắng trên bàn gỗ quen thuộc, thêm cảnh swatch lên mu bàn tay, xoa đều để thấy không vệt trắng.

### #4 @phuongmet57 — Reach rẻ và rộng, nhưng là kênh chốt deal, gần như không có review hay demo.

- ✅ Chỉ 2M/video nhưng kỳ vọng 383k view mỗi 1 triệu VND; trung vị 767k view tự nhiên.
  - `c8.m4` Chi phí ước tính 2.0M VND/video (tier micro (10k-50k)); 383k view kỳ vọng / 1 triệu VND
  - `c8.m1` Followers 15k; 31.8M view nội dung / 30 ngày (đã trừ view quảng cáo); trung vị 767k view tự nhiên của các video nổi bật (reach top 13% pool)
- ✅ GPM 158k, giá trung bình khán giả mua 177k; follower tăng 8.7% trong 30 ngày.
  - `c8.m7` GPM video 158k VND / 1.000 view (điểm thương mại top 28% pool); giá trung bình sản phẩm khán giả đã mua 177k VND
  - `c8.m8` follower +8.7% trong 30 ngày; có doanh thu 30/30 ngày, xu hướng đi ngang
- ⚠️ Nội dung deal "mua 1 được 7" dày đặc, có lời phóng đại; brand safety ở mức caution.
  - `c8.t2` Cảnh báo: Nội dung deal 'mua 1 được 7' dày đặc; Tỷ lệ quảng cáo cao ở nhiều video
  - `c8.v0` Tổng quan video: Nói chuyện thân mật kiểu 'các bà ơi', livestream/selfie, chốt deal nhanh và giục mua Persona: Người săn sale, chia sẻ mẹo mua hàng giá rẻ cho chị em. Chất lượng 4/10, brand safety: caution (Nội dung mang tính chốt đơn, hơi phóng đại ('rẻ chấn động', 'thắng đời 10'), có…)
- ⚠️ Không demo sử dụng, chỉ lấy số lượt bán làm bằng chứng.
  - `c8.v1.o4` Dùng số lượt bán làm bằng chứng xã hội, không demo sử dụng thực tế — "tẩy trang 3.000.000 lượt bán"
  - `c8.v2.o3` Nói dùng được cho mọi loại da nhưng không có bằng chứng kiểm chứng — "mấy bà da dầu da nhạy cảm đều có thể sử dụng được"
- 💡 Concept gợi ý: Clip săn deal "kem chống nắng đi học", nhưng bắt buộc có cảnh thoa lên mu bàn tay và mặt, so sánh không vệt trắng trước khi chốt deal.

### #5 @changaffiliate — Bán hàng khủng nhưng là kênh affiliate đa ngành, không có tín hiệu chống nắng.

- ✅ 62M view tự nhiên/30 ngày; kỳ vọng 262k view mỗi 1 triệu VND.
  - `c7.m1` Followers 85k; 62.0M view nội dung / 30 ngày (đã trừ view quảng cáo); trung vị 1.0M view tự nhiên của các video nổi bật (reach top 8% pool)
  - `c7.m4` Chi phí ước tính 4.0M VND/video (tier micro+ (50k-100k)); 262k view kỳ vọng / 1 triệu VND
- ✅ GPM 199k thuộc top 9% pool; giá trung bình khán giả mua 196k.
  - `c7.m7` GPM video 199k VND / 1.000 view (điểm thương mại top 9% pool); giá trung bình sản phẩm khán giả đã mua 196k VND
- ⚠️ Quảng bá 544 sản phẩm từ 263 shop, chủ yếu kem nền và kem đánh răng.
  - `c7.m6` 100% doanh thu từ video, 0% từ livestream; quảng bá 544 sản phẩm / 263 shop; 20% tổng view video đến từ quảng cáo
  - `c7.t2` Cảnh báo: Nội dung nặng quảng cáo, 544 sản phẩm từ 263 shop; Chủ yếu bán kem nền và kem đánh răng, không phải chăm sóc da chuyên sâu
- ⚠️ Video thiên về combo quà tặng, chỉ show bao bì.
  - `c7.v1.o3` Nội dung tập trung vào ưu đãi combo 6 tuýp tặng bình 1L, giới hạn khoảng 100 suất. — "mua 6 tuýp là được tặng một cái bình như thế này luôn"
  - `c7.v1.o2` [frame 4 @36.1s] Cô giơ sát một hộp Closeup White Now trước ống kính, thấy rõ bao bì.
- 💡 Concept gợi ý: "Lười makeup thì chỉ cần 2 bước": thoa kem chống nắng nâng tông nhẹ rồi son má, nói trực diện camera kèm ưu đãi.

## 2. Token / chi phí / thời gian (run 8ee88197)

| Stage | Calls | Cache hits | Input | Cache read | Cache write | Output | Images | USD | Active time |
|---|---|---|---|---|---|---|---|---|---|
| source | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.0000 | 7.7s |
| prefilter | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.0000 | 0.0s |
| enrich | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.0000 | 1.6s |
| text_screen | 2 | 0 | 10552 | 2592 | 2592 | 3947 | 0 | $0.0034 | 19.4s |
| media_prep | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.0000 | 19.6s |
| video_analysis | 10 | 0 | 20016 | 32265 | 3585 | 15966 | 20 | $0.2119 | 39.2s |
| final_rank | 1 | 0 | 18071 | 0 | 2235 | 5296 | 0 | $0.1894 | 46.1s |
| select | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.0000 | 0.0s |
| **Total** | **13** | 0 | 48639 | 34857 | 8412 | 25209 | 20 | **$0.4046** (10.521 ₫) | **133.6s** |

Funnel: pool 224 → qua lọc số liệu 213 → enrich (data API) 20 → text AI 20 → video AI 10 → chấm cuối 10 → chọn 5.

### Chi phí dữ liệu Kalodata (credit, 1 credit ≈ $0.1)

| Endpoint | Calls | Cache hits | Credit trả trong run | Credit tiết kiệm nhờ cache |
|---|---|---|---|---|
| /tiktok/video/url | 10 | 7 | 1.50 | 3.50 |
| /tiktok/creator/detail | 20 | 13 | 0.70 | 1.30 |
| /tiktok/video/rank | 20 | 13 | 0.70 | 1.30 |
| /tiktok/creator/rank | 3 | 2 | 0.10 | 0.20 |
| /tiktok/product/rank | 1 | 0 | 0.10 | 0.00 |
| **Total** | | | **3.10** | 6.30 |

Chi phí dữ liệu khi chạy lần đầu (chưa có dữ liệu Kalodata lưu sẵn) = **9.40 credit ≈ $0.94**. Tổng chi phí 1 lần chạy đầu (chưa có cache AI, chưa có dữ liệu lưu) ≈ AI $0.405 + data $0.94 = **$1.34**.

### Chi phí AI theo từng creator (run 8ee88197)

Cách tính: **xem video** là 1 call Sonnet riêng cho mỗi creator nên tính nguyên call; **đọc nội dung** (Haiku) và **chấm cuối** (Opus) là 1 call cho tối đa 10 creator nên chi phí call chia đều cho số creator trong batch. Chỉ tính call thật, không tính call trúng cache. Credit Kalodata theo bảng giá khi chưa có dữ liệu lưu: lấy chi tiết 0.2, link video 0.5 cho người được xem video.

| Creator | Được chọn | Đọc nội dung (Haiku) | Xem video (Sonnet) | Token video: input / cache read / output · ảnh | Chấm cuối (Opus) | AI cộng | Kalodata | Tổng ≈ USD |
|---|---|---|---|---|---|---|---|---|
| @bachluulinh | ✅ | $0.0002 | $0.0302 | 2.185 / 0 / 1.687 · 2 | $0.0189 | **$0.0493** | 0.7 cr | $0.1193 |
| @ngoc.matcha.review | ✅ | $0.0002 | $0.0201 | 2.112 / 3.585 / 1.555 · 2 | $0.0189 | **$0.0392** | 0.7 cr | $0.1092 |
| @changaffiliate | ✅ | $0.0002 | $0.0200 | 2.089 / 3.585 / 1.550 · 2 | $0.0189 | **$0.0391** | 0.7 cr | $0.1091 |
| @phuongmet57 | ✅ | $0.0002 | $0.0199 | 1.950 / 3.585 / 1.563 · 2 | $0.0189 | **$0.0390** | 0.7 cr | $0.1090 |
| @rin.review22 | ✅ | $0.0002 | $0.0187 | 1.351 / 3.585 / 1.562 · 2 | $0.0189 | **$0.0378** | 0.7 cr | $0.1078 |
| @sayhiinb | – | $0.0002 | $0.0216 | 2.078 / 3.585 / 1.708 · 2 | $0.0189 | **$0.0407** | 0.7 cr | $0.1107 |
| @ngocvan.tran | – | $0.0002 | $0.0213 | 2.083 / 3.585 / 1.673 · 2 | $0.0189 | **$0.0404** | 0.7 cr | $0.1104 |
| @luumaianh_ | – | $0.0002 | $0.0206 | 2.097 / 3.585 / 1.608 · 2 | $0.0189 | **$0.0398** | 0.7 cr | $0.1098 |
| @anhdangxinh | – | $0.0002 | $0.0204 | 2.013 / 3.585 / 1.603 · 2 | $0.0189 | **$0.0395** | 0.7 cr | $0.1095 |
| @.tienxuu | – | $0.0002 | $0.0190 | 2.058 / 3.585 / 1.457 · 2 | $0.0189 | **$0.0382** | 0.7 cr | $0.1082 |
| 10 creator chỉ qua đọc nội dung (trung bình) | – | $0.0002 | – | – | – | **$0.0002** | 0.2 cr | $0.0202 |

- 1 creator đi hết phễu (đọc nội dung → xem video → chấm cuối): AI trung bình **$0.0403** = đọc $0.0002 + video $0.0212 + chấm $0.0189; cộng Kalodata 0.7 credit ≈ **$0.1103**.
- 1 creator dừng sau bước đọc nội dung: AI trung bình **$0.0002**.
- Mỗi KOC được chọn gánh luôn phần của người bị loại: AI $0.4046 / 5 = **$0.0809**; tính cả Kalodata lần chạy đầu 9.4 credit thì ≈ **$0.2689 / KOC**.

## 3. Khả năng phục hồi

- Run bị kill cứng (`process.exit`) tại stage **video_analysis** sau khi đã trả tiền 5 AI call.
- Resume ở process mới (lần chạy #2) → hoàn thành, **0 call bị trả tiền 2 lần**.
- Tổng thời gian wall (gồm khởi động 2 process): 159.7s; thời gian xử lý active: 133.6s.

## 4. Tái sử dụng cache (warm run)

Chạy lại cùng brief: 13/13 call trúng cache, chi phí $0.0000, active 2.2s, cùng kết quả: có.
Phân tích video không phụ thuộc campaign → campaign khác gặp lại creator cũng không trả tiền phần đắt nhất.

## 5. Projection 50–500 KOC

Chi phí đơn vị đo được: text screen $0.0002/creator · video $0.0212/creator (~2002 input token/call) · final $0.0189/creator.

| KOC cần tìm | Pool | Enrich + text AI | Video AI | AI (USD) | AI với Batch API (-50%) | Kalodata (credit) | Tổng ≈ USD | Naive AI (video toàn pool, model mạnh) |
|---|---|---|---|---|---|---|---|---|
| 5 | 100 | 20 | 10 | $0.4046 | $0.2023 | 9.4 | $1.3446 | $12.0800 |
| 50 | 1000 | 200 | 100 | $4.0464 | $2.0232 | 94.0 | $13.4464 | $120.8000 |
| 500 | 10000 | 2000 | 1000 | $40.4639 | $20.2319 | 940.0 | $134.4639 | $1208.0000 |

Naive = gửi 6 frame full-res cho mỗi video (2 video/creator) của MỌI creator trong pool tới model mạnh nhất, mỗi video 1 call.

## 6. Case bật dữ liệu chuyên sâu Kalodata (run 293f2b65)

Cùng brief, bật cả 3 phần trả phí trên form (ước tính thêm **5 credit** theo bảng giá, được cộng vào trần credit của chiến dịch). Xoá cache AI trước khi chạy vì dữ liệu thêm làm đổi nội dung prompt.

- **Doanh thu theo ngành** (2.0 credit): Doanh thu, GPM và số bán của creator chỉ trong ngành làm đẹp. Phân biệt người chuyên beauty với người bán đủ thứ.
- **Chi tiết video** (2.0 credit): Với các video AI xem: GPM, số bán, view quảng cáo, ROAS, số ngày chạy quảng cáo, chi phí mỗi đơn (CPA), thời lượng.
- **Sản phẩm creator đang bán** (1.0 credit): Top sản phẩm creator bán gần đây: phát hiện đang quảng bá sản phẩm cùng loại hoặc của đối thủ.

| | Run A: mặc định | Run D: bật chuyên sâu |
|---|---|---|
| AI calls (trúng cache) | 13 (0) | 13 (0) |
| Đọc nội dung (Haiku) | $0.0034 | $0.0031 |
| Xem video (Sonnet) | $0.2119 | $0.2023 |
| Chấm cuối (Opus) | $0.1894 | $0.2005 |
| **AI tổng** | **$0.4046** | **$0.4059** |
| Token input / cache read / output | 48639 / 34857 / 25209 | 50471 / 43269 / 25859 |
| Kalodata trả trong run | 3.10 credit | 5.00 credit |
| Kalodata khi chạy lần đầu | 9.40 credit | 13.40 credit |
| **Tổng 1 lần chạy đầu ≈** | **$1.34** | **$1.75** |
| Thời gian xử lý active | 133.6s | 140.0s |
| 5 KOC giống run A | – | không |

### Kalodata của run D

| Endpoint | Calls | Dùng lại dữ liệu lưu | Credit trả trong run | Credit tiết kiệm nhờ dữ liệu lưu |
|---|---|---|---|---|
| /tiktok/creator/detail | 40 | 20 | 2.00 | 2.00 |
| /tiktok/video/detail | 20 | 0 | 2.00 | 0.00 |
| /tiktok/product/rank | 11 | 1 | 1.00 | 0.10 |
| /tiktok/video/url | 8 | 8 | 0.00 | 4.00 |
| /tiktok/video/rank | 20 | 20 | 0.00 | 2.00 |
| /tiktok/creator/rank | 3 | 3 | 0.00 | 0.30 |

### 5 KOC của run D (chi phí booking 22.000.000 ₫ / 30.000.000 ₫)

| # | Creator | Final | AI fit | Data | Video | Verdict | Có trong run A |
|---|---|---|---|---|---|---|---|
| 1 | @ngoc.matcha.review | 63 | 66 | 56 | 45 | good | có |
| 2 | @changaffiliate | 57.9 | 57 | 60 | 39.5 | weak | có |
| 3 | @phuongmet57 | 57.7 | 56 | 61.8 | 25.5 | weak | có |
| 4 | @rin.review22 | 54 | 53 | 56.2 | 39.5 | weak | có |
| 5 | @luumaianh_ | 50.1 | 53 | 43.2 | 62.5 | weak | mới |

### Chi phí AI theo từng creator (run 293f2b65)

Cách tính: **xem video** là 1 call Sonnet riêng cho mỗi creator nên tính nguyên call; **đọc nội dung** (Haiku) và **chấm cuối** (Opus) là 1 call cho tối đa 10 creator nên chi phí call chia đều cho số creator trong batch. Chỉ tính call thật, không tính call trúng cache. Credit Kalodata theo bảng giá khi chưa có dữ liệu lưu: lấy chi tiết 0.2, link video 0.5 cho người được xem video.

| Creator | Được chọn | Đọc nội dung (Haiku) | Xem video (Sonnet) | Token video: input / cache read / output · ảnh | Chấm cuối (Opus) | AI cộng | Kalodata | Tổng ≈ USD |
|---|---|---|---|---|---|---|---|---|
| @changaffiliate | ✅ | $0.0002 | $0.0206 | 2.089 / 3.585 / 1.609 · 2 | $0.0201 | **$0.0408** | 1.1 cr | $0.1508 |
| @phuongmet57 | ✅ | $0.0002 | $0.0201 | 1.950 / 3.585 / 1.588 · 2 | $0.0201 | **$0.0403** | 1.1 cr | $0.1503 |
| @rin.review22 | ✅ | $0.0002 | $0.0197 | 1.351 / 3.585 / 1.664 · 2 | $0.0201 | **$0.0399** | 1.1 cr | $0.1499 |
| @ngoc.matcha.review | ✅ | $0.0002 | $0.0194 | 2.112 / 3.585 / 1.482 · 2 | $0.0201 | **$0.0396** | 1.1 cr | $0.1496 |
| @luumaianh_ | ✅ | $0.0002 | $0.0194 | 2.097 / 3.585 / 1.482 · 2 | $0.0201 | **$0.0396** | 1.1 cr | $0.1496 |
| @quenhii.pham | – | $0.0002 | $0.0220 | 1.104 / 3.585 / 1.942 · 2 | $0.0201 | **$0.0422** | 1.1 cr | $0.1522 |
| @bachluulinh | – | $0.0002 | $0.0214 | 2.185 / 3.585 / 1.664 · 2 | $0.0201 | **$0.0416** | 1.1 cr | $0.1516 |
| @sayhiinb | – | $0.0002 | $0.0209 | 2.078 / 3.585 / 1.643 · 2 | $0.0201 | **$0.0411** | 1.1 cr | $0.1511 |
| @anhdangxinh | – | $0.0002 | $0.0198 | 2.013 / 3.585 / 1.546 · 2 | $0.0201 | **$0.0401** | 1.1 cr | $0.1501 |
| @dunghana2882 | – | $0.0002 | $0.0189 | 1.441 / 3.585 / 1.566 · 2 | $0.0201 | **$0.0391** | 1.1 cr | $0.1491 |
| 10 creator chỉ qua đọc nội dung (trung bình) | – | $0.0002 | – | – | – | **$0.0002** | 0.3 cr | $0.0302 |

- 1 creator đi hết phễu (đọc nội dung → xem video → chấm cuối): AI trung bình **$0.0404** = đọc $0.0002 + video $0.0202 + chấm $0.0201; cộng Kalodata 1.1 credit ≈ **$0.1504**.
- 1 creator dừng sau bước đọc nội dung: AI trung bình **$0.0002**.
- Mỗi KOC được chọn gánh luôn phần của người bị loại: AI $0.4059 / 5 = **$0.0812**; tính cả Kalodata lần chạy đầu 13.4 credit thì ≈ **$0.3492 / KOC**.

