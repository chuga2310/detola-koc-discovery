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

# Design System: KOC Discovery

## Overview

**Creative North Star: "The DETOLA Desk"**

KOC Discovery wears the DETOLA brand (detola.vn) as a working tool rather than a marketing page. A warm cream ground holds white, softly rounded cards; navy carries every word and every dark block; one DETOLA orange marks the thing you press next; teal says "done" or "good". Inside that warm shell the content stays dense and exact: tabular figures, hairline navy rules, verdicts spelled out in words, evidence one click away.

The system is light-only and calm. Hierarchy comes from Be Vietnam Pro's weight and tight negative tracking, the navy-over-grey two-tone headline, and the step from cream to white, never from colour floods or heavy shadow. Orange is scarce on purpose; navy blocks (the user's chat bubbles, the dark button, the identity mark) give the page its weight. The DETOLA logo and mascot illustrations are not used; the header carries its own small navy-and-orange mark.

**Key Characteristics:**
- Cream ground, white cards, hairline navy-10% borders, one very soft shadow.
- Navy ink for text and dark blocks; orange only for the primary action, the AI avatar, the active rank and evidence keys.
- Teal for completed steps and positive verdicts; amber and brick only for states that need attention.
- Soft corners (12px controls, 16px chat and step panels, 20px cards) and pills for everything that is a tag or a choice.
- Every status and verdict carries a word, never colour alone.

## Colors

A warm brand palette: cream and white neutrals, DETOLA navy, one orange accent, teal for good news, and muted amber/brick for warnings.

### Primary
- **DETOLA Orange** (action): fill of the primary button ("Tạo brief mới", "Gửi brief"), the AI avatar, the composer send button, the kicker dot, the running-step dot and the composer's attention sweep. Text on it is always navy.
- **Pressed Orange** (action-hover): primary button hover.
- **Peach Wash** (action-tint): selected chip fill, selected ranking row, running status pill, text selection.
- **Burnt Orange Text** (action-text): orange used as text or line on light grounds, for evidence key pills (`m2`, `v1.o2`), the active rank numeral "01", "Hồ sơ TikTok" links, inline secondary actions ("Điền brief mẫu của đề bài"), the caret, focus outlines and focused field borders.

### Secondary
- **Deep Teal** (good): positive text ("Hoàn tất", "Phù hợp"), and the solid fill of the strongest verdict "Rất hợp" with white text.
- **DETOLA Teal** (good-fill): completed step nodes with a white check, good-state dots and bars.
- **Teal Mist** (good-tint): background of good badges and the "Đủ thông tin" ready-brief badge.

### Tertiary
- **Amber Ink / Amber Wash** (caution, caution-tint): "Cân nhắc" verdicts, "Tạm dừng" status, the mock-provider notice.
- **Brick Red / Brick Wash** (risk, risk-tint): "Loại" verdicts, "Lỗi" status, the minus marks on "Lưu ý" risks.

### Neutral
- **DETOLA Cream** (ground): page background and the translucent sticky header.
- **Card White** (surface): cards, fields, chips, buttons.
- **Inner Panel** (surface-2) and **Sunken Oat** (sunken): nested blocks inside cards (score grid, queued status pill, brief summary chips).
- **DETOLA Navy** (ink): all primary text, the selected segmented option, the selected chip outline.
- **Slate Secondary** (ink-2): secondary text and captions; about 5.7:1 on cream.
- **Slate Caption** (ink-3): placeholders, disabled controls, minor captions; about 5:1 on white.
- **Two-Tone Grey** (ink-mute): only the second line of a two-tone headline ("Mỗi brief là một lần tìm KOC.", "Điền nhanh, hoặc kể cho AI."). About 3.2:1 on cream, so it is legal only at large display sizes.
- **Hairline / Strong Hairline** (rule, rule-strong): card borders and dividers at navy 10%; control borders at navy 22%.
- **Navy Block** (shell) with **On-Navy White** and **On-Navy Mist**: the user's chat bubbles, the dark button ("Brief mới" in the header), the composer hint bubble, the identity mark.

### Named Rules
**The One Orange Rule.** Orange as a fill appears only on the primary button, the AI avatar, the send button and small status dots. Anywhere orange must be read as text or line on a light ground, use Burnt Orange Text (about 4.9:1 on cream, 5.4:1 on white), never the raw brand orange.

**The Navy-On-Orange Rule.** Text on an orange fill is navy (about 5.2:1), never white.

**The Word-With-Colour Rule.** Teal, amber and brick always ride with a word ("Rất hợp", "Phù hợp", "Cân nhắc", "Loại", "Hoàn tất", "Đang chạy", "Tạm dừng", "Lỗi").

## Typography

**Display Font:** Be Vietnam Pro (with system-ui, sans-serif)
**Body Font:** Be Vietnam Pro, loaded at 400, 500, 600 and 700 with Latin and Vietnamese subsets.

**Character:** One humanist sans with full Vietnamese diacritics. Headings are semibold with tight negative tracking, which gives the brand's compact, confident voice; body text stays at regular weight with generous line height.

### Hierarchy
- **Display** (600, 40px, 1.12, -0.045em): page titles from the `sm` breakpoint up, and the selected KOC handle on desktop. Written as a two-tone pair: a navy statement and a grey second line.
- **Display mobile** (600, 32px, 1.15): the same page titles below `sm`.
- **Handle mobile** (600, 30px): the KOC handle in the review card on phones, wrapping anywhere so long handles never overflow.
- **Title** (600, 24px, 1.2, -0.025em): card and section titles ("5 KOC đề xuất", "Điền nhanh", "Brief", "Ưu", "Lưu ý"), rank numerals and score figures.
- **Stepper value** (600, 20px, tabular): the number inside the KOC count stepper.
- **Score mobile** (600, 19px, tabular): score cells in the review's two-row score grid on phones.
- **Figure / wordmark** (600 to 700, 17px, -0.02 to -0.03em): the header's "KOC Discovery" wordmark (700) and the header ledger figures for cost and time (600, tabular).
- **Body** (400, 15px, 1.55): reading text, field values, chat messages; long prose capped near 70ch.
- **Label** (600, 14px, 1.2): button and chip text.
- **Meta** (400, 13px, 1.45): table headers, captions, helper lines, segmented options (600).
- **Badge** (600, 12px, line-height 1): verdict and status pills, evidence key pills.
- **Kicker** (600, 11px, 0.12em, uppercase): the small orange-dot label above a page title.

The four tokenised steps (display 40, title 24, body 15, meta 13) are the scale. The other sizes above are deliberate off-ramps, each bound to one component; they are part of the system, not drift, and new sizes beyond them are.

### Named Rules
**The Tabular Figures Rule.** Every number that can be compared (followers, cost, scores, ledger figures, budget input) uses tabular figures and sits right-aligned in its column.

**The Two-Tone Headline Rule.** A page title is a navy line followed by a grey line in ink-mute, both at display size. The grey line never shrinks below 30px, because ink-mute only passes contrast as large text.

## Layout

A centred 1200px container with 20px side gutters on phones and 40px from `md`. Pages open with a header block (kicker, two-tone title, a short meta line and the primary action, which right-aligns on wide screens), then content in cards.

- Home: one card holding the campaign table (20px inline padding on phones, 28px from `sm`).
- New brief: a form card stacked over a sticky chat composer; once chatting, a 300px right aside ("Brief đang có") appears from `lg`.
- Run: an assistant line and a brief card in a narrow reading column, a hairline divider, then ranking (left card) and the selected KOC review (right card) side by side on desktop, stacked on phones. Cost tables and the technical log sit in a collapsed disclosure at the bottom.

Spacing runs in a 4px-based rhythm: 6 and 8px inside controls and pills, 12px between related items, 20px card padding, 40px between header block and content. The sticky composer reserves 11rem of scroll padding so focused fields are never hidden behind it.

## Elevation & Depth

Depth is mostly tonal: cream ground, white cards, sunken or inner-panel blocks inside cards. A single, very diffuse shadow lifts cards and the latest chat card off the cream.

### Shadow Vocabulary
- **Soft lift** (`box-shadow: 0 20px 55px rgb(28 48 72 / 0.045), 0 2px 6px rgb(28 48 72 / 0.03)`): cards, the ready-brief card, the open step panel.
- **Focus halo** (`box-shadow: 0 0 0 3px rgb(255 121 77 / 0.22)`): focused fields, paired with a Burnt Orange border.

### Named Rules
**The One Shadow Rule.** There is one shadow, and it is barely there. No hard offset shadows, no stacked elevation levels; hierarchy comes from cream versus white.

## Shapes

Soft, friendly corners in four steps: 12px for controls (buttons, fields, stepper, composer, mock notice), 16px for conversational and step panels (chat cards, user bubbles with a tighter 6px top-right tail corner, the open step panel), 20px for page cards, and full pills for chips, badges, status tags, the segmented control and avatars. The identity mark is a 32px navy square at 10px. Borders are always 1px hairlines in navy at 10% or 22%.

## Components

### Buttons
- **Shape:** gently rounded (12px), at least 40px tall, 14px semibold label, optional 16px icon with 8px gap.
- **Primary:** DETOLA Orange fill, navy text; hover deepens to Pressed Orange. One per view.
- **Dark:** navy fill, white text, hover `#26405e`. Used for "Brief mới" in the header, echoing DETOLA's "Trao đổi với DETOLA".
- **Secondary:** white fill, navy text, strong hairline border that turns navy on hover.
- **Press / Focus / Disabled:** 1px downward nudge on press; 2px Burnt Orange outline at 2px offset on focus; 50% opacity when disabled.

### Chips
- **Style:** white pills with a strong hairline border, 38px tall, 14px text.
- **State:** selected chips switch to Peach Wash with a 2px navy outline (border plus inset ring), semibold text and a Burnt Orange check. Single-choice groups behave as radios, multi-choice as checkboxes. Disabled unselected chips fade to transparent with caption-grey text.
- **Segmented control:** a white pill track with 3px padding; the active option is a navy pill with white text ("₫ VND" / "$ USD").

### Cards / Containers
- **Corner Style:** 20px for page cards, 16px for chat and step panels.
- **Background:** white on cream; nested blocks in Inner Panel or Sunken Oat.
- **Shadow Strategy:** Soft lift only.
- **Border:** 1px navy 10%; the latest chat card uses the strong hairline, older ones fade to 70% opacity.
- **Internal Padding:** 20px, widening to 28px on page cards from `sm`.

### Inputs / Fields
- **Style:** white, strong hairline border, 12px radius, 10px by 14px padding, 15px text, caption-grey placeholder; border darkens to caption grey on hover.
- **Focus:** Burnt Orange border plus the orange focus halo; composite fields (the money field with its "₫" prefix) take the halo on the wrapper.
- **Money field:** the value is set at title size, semibold, tabular, with the formatted amount ("30.000.000") and a hint line beneath ("khoảng 6 triệu cho mỗi KOC").
- **Stepper:** "− n +" in a 44px-tall rounded box, 44px square buttons that tint cream on hover, the value at 20px semibold.

### Navigation
- **Header:** light and sticky, translucent cream with backdrop blur and a bottom hairline, at least 68px tall. Left: the 32px navy mark with an orange dot and the 17px bold "KOC Discovery" wordmark, then context (breadcrumb "Chiến dịch › Kem chống nắng" and a status pill) after a hairline divider on desktop. Right: ledger figures ("≈ $0.00", "chi phí · 0 giây") and one action.
- **Disclosures:** text rows with a drawn chevron that rotates 90° when open ("Xem 8 bước đã làm", "Dự phòng (5)", "Toàn bộ bằng chứng (19)").

### Verdict Badges and Status Tags
Pills with a small dot and a word, 12px semibold. Verdicts: "Rất hợp" solid Deep Teal with white text; "Phù hợp" Teal Mist; "Cân nhắc" Amber Wash; "Loại" Brick Wash; a large variant at body size heads the KOC review. Statuses: "Hoàn tất" teal, "Đang chạy" Peach Wash with a pulsing orange dot, "Chờ chạy" sunken grey, "Tạm dừng" amber, "Lỗi" brick. A screen-reader prefix "Đánh giá:" precedes each verdict word.

### Chat
- **AI:** a 36px orange circle avatar with a navy lens glyph, messages on the cream ground, a three-dot typing indicator.
- **User:** right-aligned navy bubbles with white text and a white avatar with a navy figure.
- **Composer:** a white 12px box with an orange send button; until it is focused or used, an orange arc sweeps around its border (3.6s loop), with a navy hint bubble above it ("Chưa biết bắt đầu từ đâu?"). Reduced motion shows a static orange border.
- **Ready brief card:** a 16px card titled "Brief" with a Teal Mist "Đủ thông tin" badge and the primary action "Bắt đầu tìm creator".

### Step Process
A vertical rail of 28px circular nodes: completed steps are DETOLA Teal with a white check, the running step is a white node with an orange pulsing dot inside an orange ring, pending steps show a two-digit number ("01" to "08") in a hairline circle. The open step expands into a 16px panel that rises in.

### Ranking and KOC Review
The ranking is a table inside a card: two-digit rank numerals at title size (Burnt Orange on the selected row, which is tinted Peach Wash), handle and name, tabular follower and cost columns, a verdict badge, and the score at title size with "AI 62" beneath. The review card leads with the handle at display size, a large verdict badge, a five-cell score grid (Tổng, AI chấm, Số liệu, Nội dung, Video) that becomes two rows on phones, a video frame strip with timestamps and frame ids, then "Ưu" (teal plus marks) and "Lưu ý" (brick minus marks) columns. Each claim ends in Burnt Orange outlined evidence-key pills; pressing one reveals that evidence with a short blur-in (280ms).

## Do's and Don'ts

### Do:
- **Do** put text on cream or white and blocks of weight in navy; reserve orange fills for the one primary action per view, the AI avatar and status dots.
- **Do** use Burnt Orange Text whenever orange must be read as text, line or focus indicator.
- **Do** pair every verdict and status colour with its word.
- **Do** keep numbers tabular and right-aligned.
- **Do** use the documented off-ramp sizes (11, 12, 14, 17, 19, 20, 30 and 32px) only in the components they belong to.
- **Do** honour `prefers-reduced-motion`: the composer sweep becomes a static border and all transitions collapse.

### Don't:
- **Don't** put white text on DETOLA orange, or set body text in raw orange.
- **Don't** use ink-mute for anything below 30px or for information the reader needs; it is the headline's second voice only.
- **Don't** copy DETOLA's logo or mascot illustrations; use the product's own navy mark.
- **Don't** add a second shadow, hard offset shadows, gradients or dark neon surfaces.
- **Don't** use more than one kicker per page, and only above the page title.
