# Features — AI KOC Discovery

🇻🇳 Tiếng Việt: [FEATURES.md](FEATURES.md) · Overview: [README.en.md](../README.en.md) · Architecture: [ARCHITECTURE.en.md](ARCHITECTURE.en.md)

Cost legend: **0** = nothing extra · **AI** = Claude tokens · **cr** = Kalodata credits (1 cr ≈ $0.1). Estimates are for a 5-KOC brief.

## 1. Creating a brief

| Feature | What it does | Where | How it works | Cost |
|---|---|---|---|---|
| Quick form | Pick with chips; only the product name is typed | `/new` | react-hook-form + zod; form values are authoritative, the AI may not change them | 0 |
| Friendly budget | VND/USD switch, preset amounts (30M VND preselected) or a typed amount with thousand separators; shows "about X per KOC" | `/new` | Switching currency converts and snaps to the nearest preset | 0 |
| Audience, age, creator tier | Gender chips, multi-select age bands, follower tiers Nano/Micro/Mid/Macro | `/new` | Bands and tiers are merged into a min–max range | 0 |
| Tell the AI | Bottom chat box with an animated border and a "Not sure where to start?" hint | `/new` | Sending free text switches to a chat session | AI ≈ $0.001 / turn |
| AI follow-up questions | Asks one missing item at a time, with single/multi-select options and "Other" | Chat session | Code picks the question and builds the options; the AI (Haiku) only parses free text, phrases the question, suggests keywords and selling points | AI ≈ $0.001 / turn |
| Brief so far | Side panel showing which items are filled or missing | Chat session (desktop) | Updates after every turn | 0 |
| Confirm the brief | "Complete" brief card with Start and Edit buttons | Chat session | Edit reopens the form with current values | 0 |
| Saved conversation | The brief conversation is stored with the campaign; intake AI cost is attributed to it | Campaign page | MongoDB `runs.chat` | 0 |

## 2. Finding and scoring KOCs (8-step pipeline)

| Feature | What it does | How it works | Cost |
|---|---|---|---|
| Source "Sells well" | Creators with high video revenue | `creator/rank` sorted by video revenue | ~0.1 cr |
| Source "High engagement" | Creators with ER ≥ 8% in skincare | `creator/rank` with engagement + category filters | ~0.1 cr |
| Source "Makes videos about the product" | Creators whose last-30-day videos mention the product | `video/rank` by keyword, **excluding AI-generated videos, videos under 5,000 views, and videos older than 30 days** | ~0.1 cr / keyword |
| Source "Already sold the same product type" | Creators who actually sold the same kind of product (e.g. sunscreen) | Top 5 products by keyword (`product/rank`) → each product's sellers (`creator/rank` filtered by `product_id`). Evidence from real orders | ~0.6 cr |
| Source "Rising" | Creators growing revenue fastest in the category | `creator/rank` sorted by growth rate, with a revenue floor | ~0.1 cr |
| Independent sources | One failing source does not break the step | Logs a warning and continues with the others | 0 |
| Numeric filter | Hard filters + a data score, with an equal quota per source | 0 tokens. Reach uses **organic views** (ad-bought views removed); commerce uses **GPM**; includes follower momentum | 0 |
| Profile details | Bio, recent videos, GPM, average price sold, new followers, 30-day revenue, contact channel names | Only for the ~20 creators that pass the filter (lazy) | 0.2 cr / creator |
| Content read | AI reads captions, niche, risks and data signals | Haiku, 10 creators per call | AI ~$0.003 |
| Video prep | Original Vietnamese transcript + 6 frames as one contact sheet | yt-dlp (free) + Kalodata MP4 for the main video + ffmpeg | 0.5 cr / creator |
| AI video review | Format, applies on skin / texture close-up, production quality, frame-cited observations | Sonnet vision, 1 call per creator; brief-agnostic → reused by every later campaign | AI ~$0.02 / creator |
| Scoring and reasons | Fit score, reasons, risks, content angle; every claim must cite an evidence id | Opus; code rejects invalid citations | AI ~$0.2 |
| Budget selection | Picks the N KOCs with the best total score whose total cost fits the budget | Knapsack, 0 tokens | 0 |

## 3. Deep data (paid, opt-in)

Off by **default**. Each item is switched on in the brief confirmation card; enabling any of them shows a **paid-feature alert** with the estimated credits, and the start button shows "+X credits". Demo mode (`PAID_FEATURES=demo`) allows enabling; `off` locks them. The campaign's credit cap is raised by exactly the amount the user agreed to.

| Feature | What it fetches | Where it is used | Cost (5 KOCs) |
|---|---|---|---|
| Revenue by category | Revenue, GPM and units sold **inside the brief's category only** (`creator/detail` + `category_ids`) | Category score (50/50 blend), evidence m9, content-read card, "% revenue in category" pill | ~2 cr |
| Video details | For the videos the AI reviews: GPM, units sold, ad views, ROAS, ad days, CPA, duration (`video/detail`) | Evidence m11, "Ad ROAS" pill | ~2 cr |
| Products the creator sells | The creator's top 10 products (`product/rank` filtered by `creator_id`) | Evidence m10 (same-category / competitor products), "Sold N same-category products" pill | ~1 cr |

## 4. Reviewing results

| Feature | What it does | Where |
|---|---|---|
| Campaign list | Sortable table, auto-refresh while a campaign runs, status with the current step | `/` |
| Campaign session | Confirmed brief (one-line, expandable), brief conversation replay, 8-step process | `/runs/:id` |
| Expandable steps | Description, one-line result, key figures, per-creator list with notes | Process |
| Results first | Finished campaigns show the 5 KOCs first; the process collapses into "See the 8 steps" | `/runs/:id` |
| Ranking + KOC review | Verdict badges, total / AI / data / content / video scores, quick signal pills | `/runs/:id` |
| Clickable evidence | Click an id next to a reason → the evidence text and the circled frame in the strip | `/runs/:id` |
| Alternates | Lower-ranked KOCs in case top picks decline | `/runs/:id` |
| Cost and log | AI tokens per step, Kalodata credits per endpoint (paid vs reused), event log | Collapsed section |
| Pause / Resume | Graceful stop and resume from checkpoint | Campaign header |
| Plain-language errors | Errors explained in plain words (e.g. the data source refused access); technical detail in the collapsed section | `/runs/:id` |

## 5. Data, cost, reliability

| Feature | What it does | How it works |
|---|---|---|
| MongoDB | All app data: campaigns, checkpoints, AI cache, cost logs, Kalodata data | `src/lib/db.ts` |
| Kalodata data store | Every ranking call is stored as a **snapshot** (params, time, ordered rows); creators / videos / products become documents with queryable metric fields | `src/lib/sources/kaloStore.ts` |
| Reuse paid data | Same params within 7 days (`KALODATA_DATA_MAX_AGE_HOURS`) → 0 credits; API failure → stale data with a warning | kaloStore |
| Content-addressed AI cache | Same input → 0 tokens; video reviews reused across campaigns | `ai_cache` |
| Two-level checkpoints | Finished steps and finished tasks never re-run | `run_stages`, `tasks` |
| Lease + heartbeat | One worker per campaign; a dead worker is taken over | Conditional `findOneAndUpdate` |
| Credit cap | Blocks a call before it would exceed the cap (12 cr + enabled paid features) | `kalodataApi.ts` |
| Privacy | Bios have emails/phones masked; only contact channel names are stored | kalodata.ts, kaloStore.ts |
| SQLite migration | One-time script moving old campaigns, caches, logs and Kalodata data to MongoDB | `npm run migrate:sqlite` |
| Offline mode | Sample data + simulated AI to see the flow | `DATA_SOURCE=fixture AI_PROVIDER=mock` |
