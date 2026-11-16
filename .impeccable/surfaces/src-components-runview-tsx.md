---
version: 3
slug: "src-components-runview-tsx"
primary_target: "src/components/RunView.tsx"
related_targets: ["src/app/page.tsx","src/components/CampaignTable.tsx","src/app/new/page.tsx","src/components/brief/NewBrief.tsx","src/components/brief/BriefForm.tsx","src/components/brief/controls.tsx","src/components/chat/ChatThread.tsx","src/components/chat/Composer.tsx","src/components/StepProcess.tsx","src/components/KocReview.tsx"]
---

# Surface: KOC Discovery app (campaign results, new brief, campaign list)

Mode: Operate. Primary surface: campaign page (`/runs/[id]`); also new brief (`/new`) and campaign list (`/`).

v3 (2026-11-16, user request): visual world switched to the DETOLA brand design system (detola.vn): cream #F8F3EA ground alternating with white cards (radius 12–24px, hairline navy-10% borders, very soft shadow), navy #1C3048 ink and dark buttons, DETOLA orange #FF794D primary buttons with navy text, teal #4C9386 for good/done states, Be Vietnam Pro (600 headings, tight negative tracking), two-tone headings (navy + grey), uppercase kicker with an orange dot, pill chips/badges, numbered "01" step nodes. The OWN-WORLD/FORM sections below describe the superseded v1/v2 "bàn thử" world and are kept only as history; structure (v2) is unchanged.

v2 (2026-11-16, user request): less technical, fewer words, friendlier inputs. Home = "Chiến dịch" list; "Brief mới" = form on top + AI chat composer at the bottom (animated highlight + hint), turning into a chat session (user/AI avatars, questions with single/multi options + "Khác"); research shows as collapsible steps with description + result. Visual world unchanged.
Audience/job: brand/agency marketer turning a campaign brief into a defensible KOC shortlist. Task frequency: daily; reads results in depth after watching a ~2–3 min run.
Must stay: every function and content field in PRODUCT.md (stop/resume, per-stage progress, AI token table, Kalodata credit ledger, funnel, picks with scores/verdict/reasons/risks/evidence/contact sheets, alternates, event log, brief form, runs list).
Feels wrong if: numbers are hard to scan, evidence is buried, decoration overpowers content, weak verdicts/estimates/missing data are softened.
Scene: marketer at an agency desk in a bright Saigon office, daytime, laptop beside the client brief, often screen-sharing the shortlist in a meeting room → light theme.

## Direction contract

THESIS: Each KOC reads like a beauty editor's tested-product review: a stamped verdict, Ưu / Lưu ý with cited proof, video frames laid out as a swatch strip. Refuses the SaaS card-grid dashboard and the cream editorial page.

OWN-WORLD: Neutral near-white ground (chroma ≈ 0), plum-tinted near-black ink. Black-cherry shell band carries identity. Lacquer crimson is reserved for actions, selection and evidence keys. Verdicts are double-ring printed seals with words, in green, amber or red ink. Archivo variable: condensed heavy for rank numerals, handles and seals; normal width for UI; tabular figures. Hairline rules, 2px radius, no decorative shadows.

STORY: The marketer sees the ranked five, understands why each made it, opens proof in one click, sees what the run cost, and resumes an interrupted run without hunting.

FIRST VIEWPORT:
- `/` Chiến dịch: black-cherry band with "Brief mới" (light button on shell); condensed "Chiến dịch" title; TanStack table (campaign, audience, budget, status with current step, created, cost), sortable, row opens campaign.
- `/new`: "Điền nhanh" form (product text, chips for audience/age/creator tier, budget = currency segmented + preset chips (30 triệu preselected) + auto-formatted input, KOC stepper) and a sticky chat composer below with an in-flow hint bubble and a crimson sweep on its border until focused. After the first send it becomes a chat: AI left (shell avatar with lens), user right (neutral avatar, shell bubble), question cards with chips, ready brief card stamped "Đủ brief" with "Bắt đầu tìm creator". Desktop aside: "Brief đang có" checklist.
- `/runs/[id]`: band with breadcrumb, status, one next action, single cost figure. Running: brief summary + 8-step stepper (double-ring ink nodes, running step open). Completed: one AI line + one-line brief + "Xem 8 bước đã làm" disclosure, then ranking (left) and the selected KOC review (right). Cost tables and log live in a collapsed "Chi phí và nhật ký kỹ thuật".

FORM: Beauty editor's tested-product review page; position 6 of 7 on the grounded list; seed:2a16c7c47c65d7ae. Signature interaction: clicking an evidence key brings its frame forward in the swatch strip, rings it, shows the evidence text, and marks that KOC as read.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raises carried from declined challengers
- Action color appears only on things you can press (warm consumer app).
- Rank carried by weight, width and rules, not size; 4-step type scale; no hero metrics (timetable rack).
- Every number tabular and right-aligned in dense columns (datamatics).
- Read KOCs are marked persistently (doujin catalog).
- Each run state shows one obvious next step (terminal wayfinding).
