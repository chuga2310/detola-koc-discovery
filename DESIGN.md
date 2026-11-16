---
name: KOC Discovery
description: An evidence-cited KOC shortlist laid out like a beauty editor's tested-product review, on a calm light workbench with a black-cherry shell band.
colors:
  ground: "oklch(0.975 0.002 350)"
  surface: "oklch(0.995 0.001 350)"
  ink: "oklch(0.21 0.018 345)"
  ink-2: "oklch(0.43 0.016 345)"
  ink-3: "oklch(0.55 0.012 345)"
  rule: "oklch(0.89 0.006 345)"
  rule-strong: "oklch(0.21 0.018 345)"
  shell: "oklch(0.29 0.075 5)"
  shell-ink: "oklch(0.97 0.008 5)"
  shell-ink-2: "oklch(0.86 0.03 5)"
  shell-rule: "oklch(0.42 0.07 5)"
  action: "oklch(0.47 0.155 6)"
  action-hover: "oklch(0.41 0.145 6)"
  action-tint: "oklch(0.955 0.022 6)"
  action-ink: "oklch(0.99 0.005 6)"
  good: "oklch(0.44 0.095 158)"
  good-tint: "oklch(0.955 0.025 158)"
  caution: "oklch(0.47 0.105 70)"
  caution-tint: "oklch(0.96 0.035 80)"
  risk: "oklch(0.49 0.165 30)"
  risk-tint: "oklch(0.955 0.025 30)"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "'wdth' 72"
  rank-numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 64"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
  seal:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.05
    fontVariation: "'wdth' 64"
rounded:
  hairline: "1px"
  sm: "2px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  gutter: "20px"
  xl: "28px"
  gutter-wide: "40px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-ink}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  button-on-shell:
    backgroundColor: "transparent"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-on-shell-hover:
    backgroundColor: "{colors.shell-rule}"
  button-shell-solid:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.shell}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-shell-solid-hover:
    backgroundColor: "{colors.shell-ink-2}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.hairline}"
    height: "30px"
  stepper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
  evidence-key:
    backgroundColor: "transparent"
    textColor: "{colors.action}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    typography: "{typography.label}"
  evidence-key-active:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
  ranking-row-selected:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  shell-band:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-ink}"
    padding: "20px 40px"
  user-bubble:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  composer-hint:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 40px 12px 16px"
---

# Design System: KOC Discovery

## Overview

**Creative North Star: "The Tested-Product Review"**

Every KOC is presented the way a beauty editor writes up a product they have actually tried: a stamped verdict, a short "Ưu / Lưu ý" ledger where every line carries a proof key, and the creator's video frames laid out like a swatch strip. The rest of the app is the editor's workbench around that review: a calm, neutral near-white ground, plum-tinted near-black ink, hairline rules, and one black-cherry shell band at the top of every screen that carries identity, location, status, the run's cost and the single next action.

The system is quiet so the numbers and the proof can be loud. Hierarchy comes from weight, letter width (Archivo's `wdth` axis) and rules rather than from size, color or depth. Lacquer crimson is scarce on purpose: it marks only what you can press, what is selected, and evidence keys. Verdicts and run states never rely on color alone; they carry words, and verdicts also change shape.

Confirmed anti-references from the product record still bind the system: no dark neon or gradient SaaS look, no cream or beige editorial "paper" ground, no washed-out light-gray text with weak hierarchy.

**Key Characteristics:**
- Neutral near-white ground (chroma about 0) with plum-black ink; one black-cherry band per screen.
- Crimson reserved for actions, selection and evidence keys.
- Verdicts as printed ink seals with words: double ring (good), single ring (caution), struck through (reject).
- One variable family, Archivo; rank set by width (64% / 72% / 100%) and weight, on a 4-step size scale.
- Every number tabular; dense numeric columns right-aligned.
- Hairline rules and 2px corners; no decorative shadows.
- One staged motion moment (evidence reveal), everything else is short state easing.

## Colors

A near-achromatic workbench with one saturated identity band, one action accent, and three verdict inks.

### Primary
- **Lacquer Crimson** (`action`): primary buttons, the send button, links that act ("Hồ sơ TikTok", "Gốc", "Điền brief mẫu của đề bài"), evidence keys, the active frame ring, the focus outline, the text caret and the selected rank numeral. Its hover is **Deep Lacquer** (`action-hover`); its text partner is **Lacquer Ink** (`action-ink`).
- **Blush Selection** (`action-tint`): the background of a selected chip, a selected ranking row, evidence-key hover, and text selection. It always pairs with a crimson border or crimson text, never alone.

### Secondary
- **Black Cherry** (`shell`): the top band on every screen, the user's chat bubble, and the AI avatar disc. It is identity, not action.
- **Shell Ink** (`shell-ink`) and **Shell Ink Muted** (`shell-ink-2`): primary and secondary text on the band; `shell-ink` also fills the one light "solid" button on the band.
- **Shell Rule** (`shell-rule`): dividers on the band and the hover fill of outlined buttons on the band.

### Tertiary (verdict and status inks)
- **Tested Green** (`good`) / `good-tint`: "Rất hợp", "Phù hợp", "Hoàn tất", the "Đủ brief" stamp, the "+" marks under "Ưu".
- **Amber Proof** (`caution`) / `caution-tint`: "Cân nhắc", "Bị gián đoạn", mock-mode notices, invalid-citation notes.
- **Red Proof** (`risk`) / `risk-tint`: "Loại", "Lỗi", error alerts, failed step nodes, the "−" marks under "Lưu ý", field errors.

### Neutral
- **Workbench** (`ground`): page background, sticky composer backdrop (at 95%), secondary-button hover, keyword tags.
- **Sheet** (`surface`): cards, fields, chips, the brief form, step detail panels, row hover.
- **Plum Ink** (`ink`): body text, headings, completed step nodes, progress fills, the selected segmented option, the composer hint bubble.
- **Plum Ink 2** (`ink-2`): secondary text, labels, meta lines, column headers.
- **Plum Ink 3** (`ink-3`): placeholders, pending step numbers, disabled controls, the "read" check on unselected rows. Never for body copy.
- **Hairline** (`rule`): default 1px rules, card and field borders, track of progress bars.
- **Strong Rule** (`rule-strong`, same value as `ink`): table header underlines, section breaks, the review header rule, the latest brief card border, button outlines.

### Named Rules
**The Pressable Crimson Rule.** Crimson appears only on things you can press, things that are selected, and evidence keys. Status, decoration, headings and charts never use it.

**The Quiet Status Rule.** Normal run states ("Hoàn tất", "Đang chạy", "Chờ chạy") are plain ink text with a small dot; only states that need action ("Bị gián đoạn", "Lỗi") get a tinted box with a colored border.

**The Words With Color Rule.** No color carries meaning alone: verdicts are words inside a seal whose ring shape also changes, statuses are words, step nodes carry an icon plus screen-reader text.

## Typography

**Display Font:** Archivo variable (with system-ui, sans-serif), loaded with the `wdth` axis and Latin + Vietnamese subsets.
**Body Font:** the same Archivo at normal width.

**Character:** one family doing three jobs by width alone: compressed (64%) heavy for rank numerals, the wordmark and seals; condensed (72%) heavy for titles, handles and figures; normal width for UI and reading. Figures are tabular everywhere (`tnum` on `body`).

### Hierarchy
- **Display** (800, 40px, line-height 1, condensed 72%): page titles ("Chiến dịch", "Brief mới"), the ranking heading ("5 KOC đề xuất"), the reviewed KOC handle.
- **Rank numeral** (800, 40px, compressed 64%, tabular): the zero-padded "01–05" rank in ranking rows; crimson when that row is selected.
- **Title** (700–800, 24px, line-height 1.1, usually condensed 72%): the shell wordmark (compressed, uppercase), ledger figures, scores, step facts, "Ưu" / "Lưu ý", "Brief" card title, form section titles, the stepper value.
- **Body** (400–600, 15px, line-height 1.5): reading text, AI messages, reasons, table cells, buttons and chips (600 for buttons and selected chips). Reading measure is held to 62–70ch.
- **Label / meta** (500–600, 13px, line-height 1.4): field labels, column headers, meta lines, statuses, evidence keys, hints.
- **Seal** (800, 12px, compressed 64%, uppercase): the word inside a small 60px verdict seal or the 52px "Đủ brief" stamp only. The large 120px seal uses Title.

### Named Rules
**The Width Not Size Rule.** Rank is carried by weight, letter width and rules. When something needs more presence, condense or embolden it before making it bigger.

**The Four Sizes Rule.** Only 40 / 24 / 15 / 13px. The 12px seal word is the single scoped exception and lives only inside a seal.

**The Tabular Everything Rule.** All figures are tabular; numbers in dense columns are right-aligned; money is formatted ("30.000.000 ₫", "7M ₫", "≈ $0.42").

## Layout

- **Shell band** spans full width; its content sits in a 1440px max container with 20px side padding (40px from md). Left: wordmark, then a ruled-off context slot (breadcrumb + status). Right: ledger figure(s) and at most one next action. It wraps on narrow screens.
- **Content containers**: 1200px for "Chiến dịch" and the campaign page, 1080px for "Brief mới"; 20px gutters on mobile, 40px from md. Top padding 32–40px, bottom 80px.
- **Rhythm**: 8px inside control groups (chip rows), 12px between grid columns in dense rows, 16px card padding, 28px between chat messages, 40–64px between page sections (a strong rule plus 40px marks the jump into results).
- **"Chiến dịch" (`/`)**: title + one-line explanation, then a full-width sortable table (header row underlined with a strong rule, rows with hairlines, whole row opens the campaign, headers never wrap).
- **"Brief mới" (`/new`)**: before the first send, a bordered "Điền nhanh" sheet (20px padding, 28px from sm) with fields stacked on a 24px rhythm; a sticky composer pinned at the bottom of the column with the hint bubble in flow above it. After the first send, the column becomes a chat thread; from lg, a 300px sticky "Brief đang có" checklist sits to the right (56px gap). The page sets `scroll-padding-bottom: 11rem` while the composer exists so focused fields are never hidden under it.
- **Campaign (`/runs/[id]`)**: a session column capped at 860px (AI messages, brief card, steps). Running: brief + the open 8-step process. Completed: results first, with one AI line, a one-line brief and a "Xem 8 bước đã làm" disclosure. Results split from lg into a 500px ranking (sticky, scrolls on its own) and the review (hairline left rule, 48px gutter); below lg they stack. Costs and log live in a closed "Chi phí và nhật ký kỹ thuật" disclosure at the bottom.
- **Mobile**: the ranking drops the follower and cost columns into the row's meta line; the five-score grid stays as a five-column strip; the large seal becomes the small seal; the video frame strip scrolls horizontally.

**The One Next Step Rule.** Each run state shows exactly one obvious action in the band: "Tạm dừng" while running, "Chạy tiếp" when interrupted or failed, "Brief mới" when complete.

## Elevation & Depth

The system is flat. Depth is expressed with tone (ground vs. surface), hairline and strong rules, and the shell band's dark mass. There are no box-shadows anywhere in the shipped UI. The only layered elements are the sticky composer (a 95% ground backdrop with a 2px blur so text scrolling beneath stays legible) and the sticky ranking column on desktop.

**The No Decorative Shadow Rule.** Separate things with a rule or a tone step, never with a shadow.

**The Lift Is a Ring Rule.** When something must come forward (the cited video frame), it moves up 4px and gains a 2px crimson outline offset by 3px; it does not cast a shadow.

## Shapes

Crisp, nearly square: every box, control, card, bubble, tag and frame tile has a 2px radius (1px inside the segmented control). Circles are reserved for things that are stamps or markers: verdict seals, the "Đủ brief" stamp, step nodes, avatars, status dots and the draft checklist ticks. Borders are 1px hairlines; 2px is used only for seal rings, step-node rings and focus outlines. A dashed hairline marks an empty placeholder (the evidence prompt box).

**The Printed Ring Rule.** Circles that judge or confirm are drawn as ink rings, not filled discs: double ring for positive, single for caution, a diagonal strike for reject, and the same double ring on completed step nodes and the AI avatar.

## Components

### Buttons
- **Shape:** 2px corners, 8px x 14px padding, 15px semibold, 8px icon gap, 1px border.
- **Primary:** crimson fill and border, Lacquer Ink text; hover to Deep Lacquer. One primary per area ("Gửi brief", "Bắt đầu tìm creator", "Xác nhận (n)", "Tạo brief mới").
- **Secondary:** sheet fill with a strong-rule outline, ink text; hover to ground ("Sửa brief", "Gửi" inside "Khác").
- **On shell (outlined):** transparent with a muted shell-ink outline; hover fills with Shell Rule ("Tạm dừng", "Brief mới" on a completed run).
- **On shell (solid):** shell-ink fill with black-cherry text; hover to shell-ink-2. Used when the band's action is the main one ("Brief mới" on the home band, "Chạy tiếp").
- **Text actions:** 13px semibold, ink-2 turning ink with underline on hover for secondary choices ("Bỏ qua, dùng mặc định", "Huỷ"); crimson for actions that go somewhere or fill data.
- **Disabled:** 55% opacity and a not-allowed cursor. The icon send button turns rule-gray with ink-3 arrow instead.

### Chips and choice controls
- **Chip:** 36px minimum height, 6px x 12px, hairline border, sheet fill, 15px. Hover darkens the border to ink-3. Selected (`aria-checked="true"`): crimson border, Blush Selection fill, semibold, and for multi-select a crimson check appears. Optional hint text sits inside in 13px ink-2 ("10k–100k"). Single choice uses `radio` roles in a `radiogroup`; multi uses `checkbox` roles in a `group`. Disabled unselected chips fade to ink-3 on a transparent ground; a disabled chip that was chosen keeps its selected look so answered questions stay readable.
- **Segmented control** (currency): strong-rule outline with 2px inner padding; 30px options in 13px semibold ink-2; the selected option inverts to ink fill with sheet text. It is a mode switch, so it uses ink rather than crimson.
- **Stepper:** 44px tall, 44px square − / + buttons, the value centered in condensed 24px bold between hairline dividers; buttons disable at min/max.

### Inputs / Fields
- **Style:** sheet fill, hairline border, 2px corners, 8px x 10px padding, 15px; placeholder in ink-3. Hover darkens the border to ink-3.
- **Focus:** crimson border plus a 2px crimson outline at 0 offset; composite fields (tag input) take the same ring on `focus-within`.
- **Money input:** currency symbol inset at 12px, value in 24px semibold tabular, auto-formatted with the locale separator; a live line beside it states the per-KOC figure.
- **Tag input:** a field holding 13px tags on ground with a small × each; Enter or comma adds.
- **Error:** 13px red text under the field with `role="alert"`, and `aria-invalid` on the control.

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** sheet on the workbench ground.
- **Border:** hairline by default; the current brief card uses the strong rule, an outdated one drops to hairline at 70% opacity with "Đã được cập nhật bên dưới".
- **Internal Padding:** 16px (question cards, brief card rows, step detail), 20–28px for the brief form sheet.
- **Notices:** tinted box with a colored 1px border and 13px text: caution for mock mode, risk for errors (always with a plain-language sentence and the recovery path).

### Navigation
- **Shell band:** wordmark "KOC DISCOVERY" (24px, compressed, extrabold, uppercase) links home. Breadcrumb in 15px: parent in shell-ink-2 (underline on hover), current in semibold shell-ink, followed by the on-shell status (light dot + word). The "Brief mới" page shows only a quiet back link ("Chiến dịch") on the right.
- **Disclosures:** native `details` with a drawn chevron that rotates 90° when open (200ms); summary in semibold body with an optional ink-2 qualifier ("· cho người vận hành", "· không bắt buộc, …"). Inline expanders use a chevron-down that flips 180° and `aria-expanded`.

### Campaign table (home)
Sortable column headers are 13px medium ink-2 buttons that turn ink when sorted, with an arrow and `aria-sort`; headers never wrap. Rows have 14px vertical padding, hairline separators, sheet hover, and open the campaign on click. Loading shows three pulsing rule-colored bars; empty shows a short explanation and a primary "Tạo brief mới".

### Verdict Seal (signature)
A circle drawn in verdict ink: 60px with 12px compressed uppercase word in rows and on mobile, 120px tilted −6° with a 24px word in the review header. Double inner ring for "Rất hợp" / "Phù hợp" (green), single ring for "Cân nhắc" (amber), a diagonal strike for "Loại" (red). Exposed to assistive tech as `role="img"` with "Verdict: …". The ready brief card carries the same stamp language: a 52px green double-ring "Đủ brief" stamp tilted −6°.

### Ranking row
A full-width button: compressed rank numeral, handle (semibold, truncating) with nickname or follower · cost meta below, right-aligned tabular follower and cost columns (from sm), the small seal, and the final score in condensed 24px with "AI n" beneath. Selected: Blush Selection fill and crimson numeral, `aria-pressed`. A KOC whose evidence has been opened gets a persistent check ("Đã xem"), crimson on the selected row, ink-3 otherwise. Below the list: a 3px ink budget bar on a rule track with "29M ₫ / 30M ₫" and an honest estimate note.

### KOC review
Header: display handle, crimson "Hồ sơ TikTok" link, a tabular meta line, the one-sentence headline (medium weight, 64ch), the seal on the right, and a five-cell score strip between hairlines (Tổng, AI chấm, Số liệu, Nội dung, Video; "Tổng" in extrabold). Then the video swatch strip, then "Ưu" / "Lưu ý" side by side from md (condensed title over a hairline; "+" in green and "−" in red as aria-hidden markers), then the evidence panel, the suggested concept, and a "Toàn bộ bằng chứng (n)" disclosure.

### Evidence key and frame strip (signature interaction)
- **Evidence key:** a small 13px semibold tabular tag (crimson 1px border, crimson text, 2px corners, 18px line) placed after the claim it supports, short id only ("v1.o2"). Hover: Blush fill. Pressed (`aria-pressed`): crimson fill, Lacquer Ink text.
- **Frame strip:** each analysed video is a row of 74 x 132px frame tiles cut from its contact sheet, with timestamp and, when cited, the evidence id beneath. Clicking a key scrolls its frame into view, lifts it 4px and rings it in crimson; the evidence panel below shows the frame thumbnail, the crimson id, the kind ("Số liệu", "Khán giả", "Nội dung", "Video") and the quoted text, announced via `aria-live="polite"`; the KOC is marked read. Clicking a cited frame does the same in reverse. Uncited frames are inert.
- **Empty prompt:** a dashed hairline box telling the reader to press a key.

### Step process
A vertical list with 28px circular nodes joined by a 1px line (ink once done, hairline otherwise). Nodes: done = double ink ring with a check; running = ink ring with a pulsing dot; failed = red ring on red tint with ×; pending = hairline ring with the step number in ink-3. Each step is a button (title semibold, one-line result in 13px) with time and a chevron; the running or failed step opens automatically. The open panel (sheet, hairline, 16px) holds a plain-language description, whether AI was used, a 3px ink progress bar, condensed figures, and up to six creator rows with "Xem cả n người".

### Chat thread and composer
- **AI message:** shell avatar disc with a lens mark inside a faint ring, "Trợ lý brief" label in 13px semibold ink-2, content held to 68ch with 16px internal spacing.
- **User message:** right-aligned Black Cherry bubble (2px corners, 12px x 16px, max 560px or 85%) next to a neutral outline avatar; "Brief điền từ form" label when sent from the form.
- **Question card:** sheet card with the question in semibold, "Chọn một" / "Chọn một hoặc nhiều" in meta, chip options plus "Khác" (opens an inline field + "Gửi"), "Xác nhận (n)" for multi, and "Bỏ qua, dùng mặc định" for optional slots.
- **Typing:** three 6px ink-2 dots fading in sequence with "Đang đọc brief của bạn…".
- **Composer:** strong-rule outlined field with a 40px crimson square send button (arrow), auto-growing to 168px; Enter sends, Shift+Enter breaks a line. Focus: crimson border and 2px crimson outline. Before first use: a crimson arc sweeps around the border (3.6s loop) until focus or typing, and an ink hint bubble sits in flow above it with a tappable example and a close button.
- **Brief draft panel:** "Brief đang có" with "n/5 mục chính", and a ticked checklist (filled ink circle when known, hairline circle when missing; "Chưa có" / "Dùng mặc định").

### Motion
- **Easing:** one curve, `cubic-bezier(0.22, 1, 0.36, 1)`; 160ms for color and border changes, 200ms for chevrons, 300ms for the frame lift, 700ms for progress bars.
- **Entrances:** `rise-in` (6px up + fade, 320ms) for chat messages, the hint bubble, the edit sheet and opened step panels; `evidence-in` (4px down + fade + 2px blur, 280ms) for the evidence panel. Content is visible by default; animation only smooths it.
- **Ambient:** the composer sweep and the running-dot pulse are the only loops, and both stop when they stop being true.
- **Reduced motion:** all animations and transitions collapse to 0.01ms, smooth scrolling is disabled, the composer sweep becomes a static crimson ring, and the frame strip scrolls instantly.

**The One Staged Moment Rule.** The evidence reveal (key pressed, frame lifted and ringed, proof appears) is the only choreographed motion. Everything else is state easing.

### Accessibility
- WCAG 2.2 AA: ink, ink-2 and ink-3 all clear 4.5:1 on ground and surface; ink-3 is still kept to placeholders, pending and disabled states.
- Global focus: 2px crimson outline, 2px offset (0 offset on fields, inset on the stepper input). Never removed without a replacement.
- Targets are at least 36px (chips), 40px (send) or 44px (stepper); the sticky composer reserves scroll padding so focus is never obscured.
- Choice controls use radio/checkbox roles with `aria-checked`; toggles use `aria-pressed`; expanders use `aria-expanded` + `aria-controls`; table sorting uses `aria-sort`.
- Live regions: the chat thread, the evidence panel and the per-KOC budget line are polite; errors use `role="alert"`.
- Seals, avatars and stamps are `role="img"` with a spoken label; decorative icons are `aria-hidden`; step and status states carry screen-reader words.
- `html lang="vi"`; the font ships the Vietnamese subset.

### Copy Voice
Plain, short Vietnamese spoken to a marketer, first person for the assistant ("Mình đã đi qua 8 bước và chọn ra 5 KOC, xem bên dưới."), "bạn" for the user. Technical identifiers (evidence ids, model names, "Token AI", "Cache") stay in English and live in the operator disclosure. Errors say what happened in plain words and what to do next ("Chiến dịch dừng vì lỗi. … bấm “Chạy tiếp” để thử lại từ chỗ dở."). Estimates and simulations are labelled every time ("ước tính", "chưa phải báo giá thật", "AI đang chạy giả lập"). Optional things say so ("· không bắt buộc", "· tuỳ chọn"). Buttons are verbs: "Gửi brief", "Bắt đầu tìm creator", "Chạy tiếp", "Tạm dừng", "Sửa brief".

## Do's and Don'ts

### Do:
- **Do** keep crimson on actions, selection and evidence keys only (The Pressable Crimson Rule).
- **Do** give every verdict a word and a ring shape, and every status a word (The Words With Color Rule).
- **Do** raise rank with weight and Archivo width before size, and stay on the 40 / 24 / 15 / 13px scale.
- **Do** set every number tabular and right-align numbers in dense columns.
- **Do** separate with 1px hairlines or the strong rule and keep corners at 2px.
- **Do** put the black-cherry band on every screen with exactly one next action for the current state.
- **Do** label every estimate, simulation, missing data point and invalid citation in plain Vietnamese.
- **Do** put a new proof element behind an evidence key that rings its source, never as free-floating claim text.
- **Do** honor reduced motion in script-driven scrolling as well as in CSS.

### Don't:
- **Don't** use crimson for status, headings, decoration or charts.
- **Don't** add box-shadows, gradients (beyond the composer's single crimson sweep) or glass effects.
- **Don't** tint the ground warm or cream; it stays near-achromatic.
- **Don't** add a fifth text size or a second typeface.
- **Don't** use filled colored discs for verdicts; seals are ink rings.
- **Don't** use light-gray (ink-3) for readable body text.
- **Don't** show more than one primary action in the band for a given run state.
- **Don't** add small uppercase kicker labels above headings; titles stand on their own.
- **Don't** hard-code color literals in components; add or reuse a token.
