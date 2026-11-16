# AI KOC Discovery — DETOLA Technical Assessment

🇻🇳 Tiếng Việt: [README.md](README.md) · 📝 **Handover report: [docs/REPORT.en.md](docs/REPORT.en.md)** · 📋 Detailed feature table: [docs/FEATURES.en.md](docs/FEATURES.en.md) · 📐 Architecture: [docs/ARCHITECTURE.en.md](docs/ARCHITECTURE.en.md) · 📊 Benchmark (Vietnamese): [docs/BENCHMARK.md](docs/BENCHMARK.md)

Finds TikTok KOCs that fit a campaign brief, for example **5 KOCs for a sunscreen, female customers aged 18–30, a 30M VND budget**. Data comes from the **Kalodata Open API**, combined with content reading and **AI video review**. Every recommendation carries **traceable evidence**: numbers, video frames, quotes.

- **Stack:** Next.js 16 (UI + API), **MongoDB** (all app data), Claude (Haiku / Sonnet / Opus per step), OpenAI (template), offline simulation mode.
- **8-step funnel pipeline:** 5 Kalodata sources → numeric filter (0 tokens) → selective profile details → AI content read → AI video review → AI scoring with citations → budget-optimal selection.
- **Controlled cost:**
  - Every step is checkpointed; a crash resumes exactly where it stopped, without paying for AI or credits twice.
  - Paid Kalodata data is stored as real data in MongoDB and reused.

| Benchmark (real run, N = 5) | |
|---|---|
| One cold run | **≈ $1.33** = AI $0.39 + 9.4 Kalodata credits (≈ $0.94); the 2 new sources add ≈ 0.7 credits |
| Re-run / later campaign meeting the same creators | **$0**: every AI and Kalodata call reuses stored data |
| Time | ~110 s with stored data; ~2.5–3 min fully cold |
| Recovery | Hard kill during video review → resume → **0 calls paid twice** |
| vs. naive (strong model reviews videos for the whole pool) | AI $12.08 → $0.39, **~97% cheaper** |

---

## 1. Running

Requirements: Node ≥ 22, MongoDB, `ffmpeg`, `yt-dlp`.

```bash
brew tap mongodb/brew
brew trust mongodb/brew                 # recent Homebrew requires trusting the tap first
brew install mongodb-community ffmpeg yt-dlp
brew services start mongodb-community   # MongoDB at mongodb://127.0.0.1:27017
npm install
cp .env.example .env.local              # set ANTHROPIC_API_KEY, KALODATA_API_KEY; MONGODB_URI if not the default
```

```bash
npm run dev                                         # http://localhost:3000
npm run discover -- --brief briefs/sunscreen.json   # or run from the CLI
npm run benchmark -- --fresh                        # end-to-end measurement, writes docs/BENCHMARK.md
npm run migrate:sqlite                              # (once) move data from the old SQLite .data/koc.db into MongoDB
```

### Offline mode (no keys)

```bash
npm run gen:fixtures                      # 120 SAMPLE creators (handles demo_*)
DATA_SOURCE=fixture AI_PROVIDER=mock npm run dev
```

Only for seeing the flow and testing recovery; the assessments are simulated.

### Trying recovery

```bash
npm run discover -- --brief briefs/sunscreen.json --crash-after video_analysis:3   # hard-kill the process
npm run discover -- --list                                                         # the campaign shows as interrupted
npm run discover -- --resume <runId>                                               # resume from checkpoint
```

In the UI: press **Pause** while a campaign runs, then **Resume**.

## 2. Screens

| Screen | Content |
|---|---|
| `/` **Campaigns** | Every KOC search (sortable, auto-refreshes while running) + a **New brief** button |
| `/new` **New brief** | A quick chip-based **form** (budget with currency switch + presets or a typed amount). A **chat box**: describe it in your own words and the AI asks follow-ups with options. Once complete → a brief card to confirm, optionally enable **paid deep data** → **Start finding creators** |
| `/runs/:id` **Campaign** | Confirmed brief and conversation → **8 research steps** (expand any step for details) → recommended KOCs with clickable evidence. Costs and log live in a collapsed section |

The UI follows DETOLA's design system (detola.vn), documented in [DESIGN.en.md](DESIGN.en.md); the product record (users, principles) is in [PRODUCT.en.md](PRODUCT.en.md).

## 3. Pipeline

| # | Step | Cost | What it does |
|---|---|---|---|
| 1 | `source` | ~1.1 credits | 5 sources: sells well, high engagement, makes videos about the product, **already sold the same product type**, **rising**. Each source fails independently |
| 2 | `prefilter` | 0 | Hard filters + data score (organic-view reach, GPM, momentum); equal quota per source → keeps ~4N |
| 3 | `enrich` | 0.2 credits / creator | Profile details + recent videos for ~4N creators only, then re-score |
| 4 | `text_screen` | Haiku, 10 creators / call | Niche, brand fit, product relevance, risks → keeps ~2N |
| 5 | `media_prep` | 0.5 credits / creator | Vietnamese transcript (free) + main-video MP4 → 6-frame contact sheet |
| 6 | `video_analysis` | Sonnet, 1 call / creator | Objective content profile, brief-agnostic → reused across campaigns |
| 7 | `final_rank` | Opus, 10 creators / call | Rubric score; reasons and risks **must cite evidence ids** |
| 8 | `select` | 0 | Knapsack: the N KOCs with the best total score within budget |

**Deep data (paid, off by default):** revenue by category (~2 cr), video details (~2 cr), products the creator sells (~1 cr). See [docs/FEATURES.en.md](docs/FEATURES.en.md#3-deep-data-paid-opt-in).

## 4. Configuration (`.env.local`)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Set → uses Claude |
| `KALODATA_API_KEY` | – | Kalodata Open API (`secret-key` header) |
| `MONGODB_URI` / `MONGODB_DB` | `mongodb://127.0.0.1:27017` / `koc_discovery` | App database |
| `DATA_SOURCE` | `kalodata` | `kalodata` \| `fixture` |
| `AI_PROVIDER` | auto | `anthropic` \| `openai` \| `mock` |
| `MODEL_SCREEN` / `MODEL_VIDEO` / `MODEL_FINAL` | haiku-5-5 / sonnet-5-5 / opus-5-5 | Model per step |
| `EFFORT_SCREEN` / `EFFORT_VIDEO` / `EFFORT_FINAL` | low / low / medium | Reasoning depth |
| `KALODATA_MAX_CREDITS_PER_RUN` | 12 | Credit cap per campaign (plus any paid features the user enabled) |
| `KALODATA_DATA_MAX_AGE_HOURS` | 168 | How long stored Kalodata data is reused |
| `KALODATA_VIDEO_URL_FALLBACK` | `primary` | Paid MP4 for `primary` (main video) \| `all` \| `off` |
| `PAID_FEATURES` | `demo` | Deep data: `demo` (can be enabled to try) \| `on` \| `off` (locked) |
| `AI_CONCURRENCY` / `MEDIA_CONCURRENCY` | 4 / 3 | Concurrency limits |

## 5. Current limitations

- **No follower demographics:** the Kalodata Open API does not return audience age/gender. "Female 18–30" is inferred by the AI from content; the rubric caps that component, so fit scores usually land around 50–65.
- **Data skews to TikTok Shop:** Kalodata tracks creators who sell. Five sources and per-source quotas reduce the bias, but pure reviewers who do not sell via TikTok Shop may be missing.
- **The AI does not watch real video yet:** it receives 6 still frames + the transcript instead, so motion, pacing and audio are lost. A model that reads video natively would improve this a lot; only the video step's input would change.
- **Each creator's second video is cover-only** (TikTok blocks free video download; MP4 for both costs 0.5 credits more per creator).
- **Booking cost is an estimate** by follower tier, not a real quote.
- **AI output is not fully deterministic:** creators with close scores can swap ranks between two cold runs.
- The worker runs inside the Next.js process; production should split it out. The UI has no login yet.

## 6. Roadmap

- **A model that reads video natively** instead of the 6-frame contact sheet (the largest remaining quality gain).
- **Multiple workers** pulling tasks with conditional `findOneAndUpdate` (the lease already uses it); a MongoDB replica set in production.
- **Message Batches API** for the content-read / video-review steps (−50% AI cost).
- **A source with follower demographics** (higher Kalodata tier or TikTok Creator Marketplace).
- **Feedback loop:** store real post-campaign results (views, GMV, CPM) to re-learn the weights.
- **Lookalike search** with embeddings of stored video content profiles.

## 7. Layout

```
briefs/                 sample brief (the sunscreen assessment)
data/fixtures/          sample data for offline mode
docs/                   REPORT, ARCHITECTURE, FEATURES (vi + en), BENCHMARK (generated, Vietnamese)
PRODUCT.md, DESIGN.md   product record + design system (vi; .en.md = English), used by the design tool
AGENTS.md               instructions for AI coding agents, generated by `next dev`
benchmark/results.json  raw benchmark numbers
scripts/                discover (CLI), benchmark, gen-fixtures, migrate-sqlite
src/lib/                core (see docs/ARCHITECTURE.en.md §5)
src/app, src/components Next.js UI + API (brief/ = form, chat/ = AI conversation)
.data/media/            contact sheets and video captions (gitignored)
```
