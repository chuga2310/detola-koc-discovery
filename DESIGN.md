---
name: KOC Discovery
description: An evidence-cited KOC shortlist dressed in the DETOLA brand system, cream ground, white cards, navy ink and one orange action.
colors:
  action: "#ff794d"
  action-hover: "#f46a3c"
  action-tint: "#fff1ea"
  action-ink: "#1c3048"
  action-text: "#b54620"
  good: "#367064"
  good-fill: "#4c9386"
  good-tint: "#edf3f0"
  caution: "#8f5c10"
  caution-tint: "#fcf2e0"
  risk: "#c0392b"
  risk-tint: "#fbebe8"
  ground: "#f8f3ea"
  surface: "#ffffff"
  surface-2: "#fcfbf8"
  sunken: "#f4f1ea"
  ink: "#1c3048"
  ink-2: "#56616e"
  ink-3: "#66717e"
  ink-mute: "#7f8a94"
  rule: "rgb(28 48 72 / 0.1)"
  rule-strong: "rgb(28 48 72 / 0.22)"
  shell: "#1c3048"
  shell-ink: "#ffffff"
  shell-ink-2: "#c3ccd7"
  shell-rule: "rgb(255 255 255 / 0.16)"
typography:
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.045em"
  display-mobile:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.045em"
  handle-mobile:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  stepper-value:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    fontFeature: "\"tnum\" 1"
  score-mobile:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "\"tnum\" 1"
  figure:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
  meta:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  badge:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
  kicker:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.12em"
rounded:
  mark: "10px"
  md: "12px"
  panel: "16px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  gutter-mobile: "20px"
  gutter-desktop: "40px"
  container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-ink}"
  button-dark:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
    height: "40px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "38px"
  chip-selected:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "30px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px 28px"
  badge-strong:
    backgroundColor: "{colors.good}"
    textColor: "{colors.shell-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-good:
    backgroundColor: "{colors.good-tint}"
    textColor: "{colors.good}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-weak:
    backgroundColor: "{colors.caution-tint}"
    textColor: "{colors.caution}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-reject:
    backgroundColor: "{colors.risk-tint}"
    textColor: "{colors.risk}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chat-bubble-user:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
  avatar-ai:
    backgroundColor: "{colors.action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "36px"
---

> Bản tiếng Anh: [DESIGN.en.md](DESIGN.en.md). Tiêu đề mục giữ tiếng Anh vì công cụ thiết kế (impeccable) đọc file theo các mục này.

# Design System: KOC Discovery

## Overview

**Creative North Star: "The DETOLA Desk"**

KOC Discovery mang thương hiệu DETOLA (detola.vn) như một công cụ làm việc chứ không phải một trang marketing. Nền cream ấm giữ các card trắng bo góc mềm; navy mang mọi chữ và mọi khối tối; một màu cam DETOLA đánh dấu thứ bạn sẽ bấm tiếp theo; teal nói "xong" hoặc "tốt". Bên trong lớp vỏ ấm đó, nội dung vẫn dày và chính xác: số dạng tabular, đường kẻ navy mảnh, kết luận được viết thành chữ, bằng chứng chỉ cách một cú click.

Hệ thống chỉ có light mode và điềm tĩnh. Thứ bậc đến từ độ đậm và tracking âm chặt của Be Vietnam Pro, headline hai tông navy trên xám, và bước chuyển từ cream sang trắng, không bao giờ từ những mảng màu tràn hay shadow nặng. Cam được dùng hiếm một cách có chủ đích; các khối navy (chat bubble của người dùng, dark button, identity mark) tạo sức nặng cho trang. Logo và minh hoạ mascot của DETOLA không được dùng; header có mark nhỏ navy và cam của riêng nó.

**Key Characteristics:**
- Nền cream, card trắng, border hairline navy 10%, một shadow rất mềm.
- Mực navy cho chữ và khối tối; cam chỉ dành cho primary action, AI avatar, rank đang active và evidence key.
- Teal cho các bước đã hoàn tất và kết luận tích cực; amber và brick chỉ cho những trạng thái cần chú ý.
- Góc mềm (12px cho control, 16px cho chat và step panel, 20px cho card) và pill cho mọi thứ là tag hoặc lựa chọn.
- Mọi trạng thái và kết luận đều kèm một chữ, không bao giờ chỉ dựa vào màu.

## Colors

Một bảng màu thương hiệu ấm: các màu trung tính cream và trắng, navy DETOLA, một màu cam nhấn, teal cho tin tốt, và amber/brick dịu cho cảnh báo.

### Primary
- **DETOLA Orange** (action): fill của primary button ("Tạo brief mới", "Gửi brief"), AI avatar, nút gửi của composer, chấm kicker, chấm của bước đang chạy và vệt quét gây chú ý của composer. Chữ trên nền này luôn là navy.
- **Pressed Orange** (action-hover): hover của primary button.
- **Peach Wash** (action-tint): fill của chip được chọn, hàng ranking được chọn, status pill đang chạy, vùng chọn văn bản.
- **Burnt Orange Text** (action-text): cam dùng làm chữ hoặc đường kẻ trên nền sáng, cho evidence key pill (`m2`, `v1.o2`), số rank active "01", link "Hồ sơ TikTok", các action phụ inline ("Điền brief mẫu của đề bài"), caret, focus outline và border của field đang focus.

### Secondary
- **Deep Teal** (good): chữ tích cực ("Hoàn tất", "Phù hợp"), và fill đặc của kết luận mạnh nhất "Rất hợp" với chữ trắng.
- **DETOLA Teal** (good-fill): node của bước đã hoàn tất với dấu check trắng, chấm và thanh ở trạng thái tốt.
- **Teal Mist** (good-tint): nền của badge tốt và badge "Đủ thông tin" của brief đã sẵn sàng.

### Tertiary
- **Amber Ink / Amber Wash** (caution, caution-tint): kết luận "Cân nhắc", trạng thái "Tạm dừng", thông báo mock provider.
- **Brick Red / Brick Wash** (risk, risk-tint): kết luận "Loại", trạng thái "Lỗi", dấu trừ ở các rủi ro "Lưu ý".

### Neutral
- **DETOLA Cream** (ground): nền trang và sticky header trong mờ.
- **Card White** (surface): card, field, chip, button.
- **Inner Panel** (surface-2) và **Sunken Oat** (sunken): các khối lồng bên trong card (score grid, status pill đang chờ, chip tóm tắt brief).
- **DETOLA Navy** (ink): toàn bộ chữ chính, lựa chọn segmented đang chọn, outline của chip được chọn.
- **Slate Secondary** (ink-2): chữ phụ và caption; khoảng 5.7:1 trên cream.
- **Slate Caption** (ink-3): placeholder, control bị disabled, caption nhỏ; khoảng 5:1 trên trắng.
- **Two-Tone Grey** (ink-mute): chỉ dùng cho dòng thứ hai của headline hai tông ("Mỗi brief là một lần tìm KOC.", "Điền nhanh, hoặc kể cho AI."). Khoảng 3.2:1 trên cream, nên chỉ hợp lệ ở cỡ display lớn.
- **Hairline / Strong Hairline** (rule, rule-strong): border card và divider ở navy 10%; border của control ở navy 22%.
- **Navy Block** (shell) cùng **On-Navy White** và **On-Navy Mist**: chat bubble của người dùng, dark button ("Brief mới" trên header), hint bubble của composer, identity mark.

### Named Rules
**The One Orange Rule.** Cam dạng fill chỉ xuất hiện trên primary button, AI avatar, nút gửi và các chấm trạng thái nhỏ. Ở bất cứ đâu cam phải được đọc như chữ hoặc đường kẻ trên nền sáng, dùng Burnt Orange Text (khoảng 4.9:1 trên cream, 5.4:1 trên trắng), không bao giờ dùng màu cam thương hiệu gốc.

**The Navy-On-Orange Rule.** Chữ trên fill cam là navy (khoảng 5.2:1), không bao giờ là trắng.

**The Word-With-Colour Rule.** Teal, amber và brick luôn đi kèm một chữ ("Rất hợp", "Phù hợp", "Cân nhắc", "Loại", "Hoàn tất", "Đang chạy", "Tạm dừng", "Lỗi").

## Typography

**Display Font:** Be Vietnam Pro (với system-ui, sans-serif)
**Body Font:** Be Vietnam Pro, tải ở 400, 500, 600 và 700 với subset Latin và Vietnamese.

**Character:** Một font sans humanist duy nhất với đầy đủ dấu tiếng Việt. Heading dùng semibold với tracking âm chặt, tạo nên giọng gọn và tự tin của thương hiệu; body text giữ độ đậm regular với line height rộng rãi.

### Hierarchy
- **Display** (600, 40px, 1.12, -0.045em): tiêu đề trang từ breakpoint `sm` trở lên, và handle của KOC đang chọn trên desktop. Viết thành cặp hai tông: một câu khẳng định navy và một dòng thứ hai màu xám.
- **Display mobile** (600, 32px, 1.15): cùng các tiêu đề trang đó dưới `sm`.
- **Handle mobile** (600, 30px): handle của KOC trong review card trên điện thoại, xuống dòng ở bất cứ đâu để handle dài không bao giờ tràn.
- **Title** (600, 24px, 1.2, -0.025em): tiêu đề card và section ("5 KOC đề xuất", "Điền nhanh", "Brief", "Ưu", "Lưu ý"), số rank và số điểm.
- **Stepper value** (600, 20px, tabular): con số bên trong stepper số lượng KOC.
- **Score mobile** (600, 19px, tabular): các ô điểm trong score grid hai hàng của phần review trên điện thoại.
- **Figure / wordmark** (600 đến 700, 17px, -0.02 đến -0.03em): wordmark "KOC Discovery" trên header (700) và các số ledger trên header cho chi phí và thời gian (600, tabular).
- **Body** (400, 15px, 1.55): chữ để đọc, giá trị field, tin nhắn chat; đoạn văn dài giới hạn khoảng 70ch.
- **Label** (600, 14px, 1.2): chữ của button và chip.
- **Meta** (400, 13px, 1.45): header của bảng, caption, dòng hướng dẫn, các lựa chọn segmented (600).
- **Badge** (600, 12px, line-height 1): pill kết luận và trạng thái, evidence key pill.
- **Kicker** (600, 11px, 0.12em, uppercase): nhãn nhỏ có chấm cam phía trên tiêu đề trang.

Bốn bậc đã token hoá (display 40, title 24, body 15, meta 13) là thang chữ. Các cỡ khác ở trên là những lối rẽ có chủ đích, mỗi cỡ gắn với một component; chúng là một phần của hệ thống, không phải drift, còn các cỡ mới ngoài chúng thì là drift.

### Named Rules
**The Tabular Figures Rule.** Mọi con số có thể so sánh (follower, chi phí, điểm, số ledger, ô nhập ngân sách) đều dùng tabular figures và căn phải trong cột của nó.

**The Two-Tone Headline Rule.** Tiêu đề trang là một dòng navy theo sau bởi một dòng xám ink-mute, cả hai ở cỡ display. Dòng xám không bao giờ nhỏ hơn 30px, vì ink-mute chỉ đạt contrast khi là large text.

## Layout

Một container 1200px căn giữa với gutter hai bên 20px trên điện thoại và 40px từ `md`. Các trang mở đầu bằng một header block (kicker, tiêu đề hai tông, một dòng meta ngắn và primary action, căn phải trên màn hình rộng), sau đó là nội dung trong các card.

- Home: một card chứa bảng chiến dịch (padding ngang 20px trên điện thoại, 28px từ `sm`).
- New brief: một form card xếp chồng trên một chat composer dạng sticky; khi đã bắt đầu chat, một aside bên phải rộng 300px ("Brief đang có") xuất hiện từ `lg`.
- Run: một dòng của assistant và một brief card trong cột đọc hẹp, một divider hairline, sau đó là ranking (card trái) và review của KOC đang chọn (card phải) nằm cạnh nhau trên desktop, xếp chồng trên điện thoại. Các bảng chi phí và log kỹ thuật nằm trong một disclosure thu gọn ở cuối.

Khoảng cách theo nhịp gốc 4px: 6 và 8px bên trong control và pill, 12px giữa các mục liên quan, 20px padding card, 40px giữa header block và nội dung. Composer dạng sticky giữ 11rem scroll padding để field đang focus không bao giờ bị che phía sau nó.

## Elevation & Depth

Chiều sâu chủ yếu đến từ tông màu: nền cream, card trắng, các khối sunken hoặc inner-panel bên trong card. Một shadow duy nhất, rất khuếch tán, nâng card và chat card mới nhất khỏi nền cream.

### Shadow Vocabulary
- **Soft lift** (`box-shadow: 0 20px 55px rgb(28 48 72 / 0.045), 0 2px 6px rgb(28 48 72 / 0.03)`): card, ready-brief card, step panel đang mở.
- **Focus halo** (`box-shadow: 0 0 0 3px rgb(255 121 77 / 0.22)`): field đang focus, đi cùng border Burnt Orange.

### Named Rules
**The One Shadow Rule.** Chỉ có một shadow, và nó gần như không thấy. Không có shadow lệch cứng, không có các tầng elevation chồng nhau; thứ bậc đến từ cream so với trắng.

## Shapes

Góc mềm, thân thiện theo bốn bậc: 12px cho control (button, field, stepper, composer, mock notice), 16px cho panel hội thoại và step panel (chat card, user bubble với góc đuôi trên bên phải chặt hơn 6px, step panel đang mở), 20px cho page card, và pill tròn hoàn toàn cho chip, badge, status tag, segmented control và avatar. Identity mark là một hình vuông navy 32px bo 10px. Border luôn là hairline 1px màu navy ở 10% hoặc 22%.

## Components

### Buttons
- **Shape:** bo nhẹ (12px), cao ít nhất 40px, label semibold 14px, icon 16px tuỳ chọn với khoảng cách 8px.
- **Primary:** fill DETOLA Orange, chữ navy; hover đậm lên thành Pressed Orange. Mỗi view một cái.
- **Dark:** fill navy, chữ trắng, hover `#26405e`. Dùng cho "Brief mới" trên header, gợi lại nút "Trao đổi với DETOLA" của DETOLA.
- **Secondary:** fill trắng, chữ navy, border strong hairline chuyển sang navy khi hover.
- **Press / Focus / Disabled:** dịch xuống 1px khi nhấn; outline Burnt Orange 2px với offset 2px khi focus; opacity 50% khi disabled.

### Chips
- **Style:** pill trắng với border strong hairline, cao 38px, chữ 14px.
- **State:** chip được chọn chuyển sang Peach Wash với outline navy 2px (border cộng inset ring), chữ semibold và dấu check Burnt Orange. Nhóm chọn một hoạt động như radio, nhóm chọn nhiều như checkbox. Chip disabled chưa được chọn mờ thành trong suốt với chữ xám caption.
- **Segmented control:** một track pill trắng với padding 3px; lựa chọn đang active là pill navy với chữ trắng ("₫ VND" / "$ USD").

### Cards / Containers
- **Corner Style:** 20px cho page card, 16px cho chat và step panel.
- **Background:** trắng trên cream; các khối lồng dùng Inner Panel hoặc Sunken Oat.
- **Shadow Strategy:** chỉ dùng Soft lift.
- **Border:** 1px navy 10%; chat card mới nhất dùng strong hairline, các card cũ hơn mờ xuống opacity 70%.
- **Internal Padding:** 20px, nới ra 28px trên page card từ `sm`.

### Inputs / Fields
- **Style:** trắng, border strong hairline, radius 12px, padding 10px x 14px, chữ 15px, placeholder xám caption; border đậm lên thành xám caption khi hover.
- **Focus:** border Burnt Orange cộng focus halo cam; field ghép (money field với tiền tố "₫") nhận halo trên wrapper.
- **Money field:** giá trị đặt ở cỡ title, semibold, tabular, với số tiền đã định dạng ("30.000.000") và một dòng gợi ý bên dưới ("khoảng 6 triệu cho mỗi KOC").
- **Stepper:** "− n +" trong một hộp bo góc cao 44px, button vuông 44px chuyển tint cream khi hover, giá trị ở 20px semibold.

### Navigation
- **Header:** sáng và sticky, cream trong mờ với backdrop blur và hairline ở cạnh dưới, cao ít nhất 68px. Bên trái: mark navy 32px với chấm cam và wordmark "KOC Discovery" bold 17px, sau đó là ngữ cảnh (breadcrumb "Chiến dịch › Kem chống nắng" và một status pill) sau một divider hairline trên desktop. Bên phải: các số ledger ("≈ $0.00", "chi phí · 0 giây") và một action.
- **Disclosures:** các hàng chữ với chevron vẽ tay xoay 90° khi mở ("Xem 8 bước đã làm", "Dự phòng (5)", "Toàn bộ bằng chứng (19)").

### Verdict Badges and Status Tags
Pill với một chấm nhỏ và một chữ, semibold 12px. Kết luận: "Rất hợp" đặc Deep Teal với chữ trắng; "Phù hợp" Teal Mist; "Cân nhắc" Amber Wash; "Loại" Brick Wash; một biến thể lớn ở cỡ body đứng đầu phần review KOC. Trạng thái: "Hoàn tất" teal, "Đang chạy" Peach Wash với chấm cam nhấp nháy, "Chờ chạy" xám sunken, "Tạm dừng" amber, "Lỗi" brick. Một tiền tố cho screen reader "Đánh giá:" đứng trước mỗi chữ kết luận.

### Chat
- **AI:** avatar hình tròn cam 36px với glyph ống kính navy, tin nhắn nằm trên nền cream, typing indicator ba chấm.
- **User:** bubble navy căn phải với chữ trắng và avatar trắng có hình người navy.
- **Composer:** một hộp trắng bo 12px với nút gửi cam; cho đến khi được focus hoặc được dùng, một cung cam quét quanh border của nó (vòng lặp 3.6s), với một hint bubble navy phía trên ("Chưa biết bắt đầu từ đâu?"). Reduced motion hiển thị border cam tĩnh.
- **Ready brief card:** một card 16px có tiêu đề "Brief" với badge Teal Mist "Đủ thông tin" và primary action "Bắt đầu tìm creator".

### Step Process
Một rail dọc gồm các node tròn 28px: bước đã hoàn tất là DETOLA Teal với dấu check trắng, bước đang chạy là node trắng với chấm cam nhấp nháy bên trong một vòng cam, bước đang chờ hiển thị số hai chữ số ("01" đến "08") trong một vòng tròn hairline. Bước đang mở bung ra thành một panel 16px trồi lên.

### Ranking and KOC Review
Ranking là một bảng bên trong card: số rank hai chữ số ở cỡ title (Burnt Orange ở hàng được chọn, hàng này được tint Peach Wash), handle và tên, các cột follower và chi phí dạng tabular, một verdict badge, và điểm ở cỡ title với "AI 62" bên dưới. Review card mở đầu bằng handle ở cỡ display, một verdict badge lớn, một score grid năm ô (Tổng, AI chấm, Số liệu, Nội dung, Video) chuyển thành hai hàng trên điện thoại, một dải frame video với timestamp và frame id, sau đó là các cột "Ưu" (dấu cộng teal) và "Lưu ý" (dấu trừ brick). Mỗi nhận định kết thúc bằng các evidence-key pill viền Burnt Orange; nhấn vào một pill sẽ hiện bằng chứng đó với hiệu ứng blur-in ngắn (280ms).

## Do's and Don'ts

### Do:
- **Do** đặt chữ trên cream hoặc trắng và các khối có sức nặng bằng navy; dành fill cam cho một primary action duy nhất mỗi view, AI avatar và các chấm trạng thái.
- **Do** dùng Burnt Orange Text bất cứ khi nào cam phải được đọc như chữ, đường kẻ hoặc focus indicator.
- **Do** ghép mỗi màu kết luận và trạng thái với chữ của nó.
- **Do** giữ số ở dạng tabular và căn phải.
- **Do** chỉ dùng các cỡ lối rẽ đã ghi lại (11, 12, 14, 17, 19, 20, 30 và 32px) trong đúng component của chúng.
- **Do** tôn trọng `prefers-reduced-motion`: vệt quét của composer thành border tĩnh và mọi transition đều được rút gọn.

### Don't:
- **Don't** đặt chữ trắng trên cam DETOLA, hay để body text bằng màu cam gốc.
- **Don't** dùng ink-mute cho bất cứ thứ gì dưới 30px hoặc cho thông tin người đọc cần; nó chỉ là giọng thứ hai của headline.
- **Don't** sao chép logo hay minh hoạ mascot của DETOLA; dùng mark navy riêng của sản phẩm.
- **Don't** thêm shadow thứ hai, shadow lệch cứng, gradient hay bề mặt neon tối.
- **Don't** dùng nhiều hơn một kicker mỗi trang, và chỉ đặt phía trên tiêu đề trang.
