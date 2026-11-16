# Handover report — AI KOC Discovery

🇻🇳 Tiếng Việt: [REPORT.md](REPORT.md)

DETOLA Founding Engineer technical assessment. The task: find TikTok KOCs that fit a brief, for example **5 KOCs for a sunscreen, female customers aged 18–30, a 30M VND budget**.

This report follows the 5 deliverables. Each section gives a short summary; the details live in the linked documents.

| # | Deliverable | Status | Where |
|---|---|---|---|
| 1 | GitHub Repo | Done | https://github.com/chuga2310/detola-koc-discovery |
| 2 | Working Prototype | Done, runs locally | [README §1](../README.en.md#1-running), section 2 below |
| 3 | Architecture | Done | [ARCHITECTURE.en.md](ARCHITECTURE.en.md) |
| 4 | Benchmark Results | Done (measured 2026-11-16) | [BENCHMARK.md](BENCHMARK.md) (Vietnamese), [results.json](../benchmark/results.json) |
| 5 | README | Done (vi + en) | [README.en.md](../README.en.md), [README.md](../README.md) |

---

## 1. GitHub Repo

- Public repo: https://github.com/chuga2310/detola-koc-discovery (branch `master`).
- I created and managed the code from scratch. The commit history follows the phases of the work: core pipeline, Kalodata source + benchmark, UI, move to MongoDB, making full use of Kalodata data, code review.
- No secrets in the repo: keys live only in `.env.local` (gitignored), and the whole history was scanned before going public. Creator contact data (emails, phone numbers) is never stored, only the names of the contact channels.
- Bilingual docs: every main document has a Vietnamese version and an `.en.md` version.

## 2. Working Prototype

The prototype runs the full research-and-recommend flow on a local machine (Next.js + MongoDB + Claude + Kalodata Open API). It is not deployed to a server, because the video step needs `ffmpeg` and `yt-dlp` and the run needs Kalodata / Anthropic keys.

**Demo flow in the UI:**

1. `/` **Campaigns**: every KOC search, auto-refreshing while one runs.
2. `/new` **New brief**: fill in a quick form, or describe the campaign in a chat where the AI asks follow-up questions with options. Once complete, the AI shows a brief card to confirm. **Deep data** (paid, with an alert and a credit estimate) can be enabled here.
3. `/runs/:id` **Campaign session**: brief and conversation → the 8 research steps running live (open any step for details) → the recommended KOCs, where every reason and risk carries clickable evidence chips (metrics, video frames, transcript quotes), plus alternates, costs and the log.
4. **Recovery**: press **Pause** while a campaign runs, then **Resume**. It continues exactly where it stopped, without paying for AI or credits twice.

**Running it** (details in [README §1](../README.en.md#1-running)):

```bash
npm install && cp .env.example .env.local   # set ANTHROPIC_API_KEY, KALODATA_API_KEY
npm run dev                                 # http://localhost:3000
npm run discover -- --brief briefs/sunscreen.json   # or run from the CLI
```

Without keys, the whole flow can still be seen in **offline mode**: 120 sample creators and simulated AI (`DATA_SOURCE=fixture AI_PROVIDER=mock`). A hard crash mid-run and resume can be tried with `--crash-after video_analysis:3` and `--resume <runId>`.

## 3. Architecture

Details and diagrams (mermaid) in [ARCHITECTURE.en.md](ARCHITECTURE.en.md). Summary:

**An 8-step, funnel-shaped pipeline.** The further down a creator goes, the more each creator costs, so the number of creators has to shrink quickly:

| # | Step | Cost | What it does |
|---|---|---|---|
| 1 | `source` | ~1.1 credits | 5 Kalodata sources: sells well through video, high engagement, already makes videos about the product, already sold the same product type, rising |
| 2 | `prefilter` | 0 | Hard filters + metric score, equal quota per source → keeps ~4N |
| 3 | `enrich` | 0.2 credits / creator | Profile details + recent videos, only for ~4N creators |
| 4 | `text_screen` | Haiku, 10 creators / call | Niche, brand fit, risks → keeps ~2N |
| 5 | `media_prep` | 0 – 0.5 credits / creator | Vietnamese transcript + 6 frames tiled into one contact sheet |
| 6 | `video_analysis` | Sonnet, 1 call / creator | Objective, brief-agnostic content profile → reused across campaigns |
| 7 | `final_rank` | Opus, 10 creators / call | Rubric score; reasons and risks **must cite evidence ids** |
| 8 | `select` | 0 | Knapsack: the N KOCs with the best total score within budget |

**Key decisions:**

- **Cheap → expensive funnel:** filter on metrics first (0 tokens), a cheap model reads text, the expensive model only reviews videos for ~2N creators. ~97% cheaper than having a strong model review videos for the whole pool.
- **Model tiering:** Haiku / Sonnet / Opus by how hard each step is.
- **Evidence with ids, citations checked in code:** the AI may only cite evidence that exists; unknown ids are dropped. Every claim in the UI traces back to a specific metric or frame.
- **Step- and task-level checkpoints, lease + heartbeat, content-addressed AI cache:** a crash resumes exactly where it stopped, without paying twice.
- **Kalodata data stored as real data in MongoDB** (rank snapshots + creator / video / product entities), reused for 7 days, with a fallback to older data (and a warning) when the API fails.
- **Credit control:** a credit cap per campaign, credits reserved before each API call, per-endpoint rate limits. Paid deep data must be enabled by the user.
- **Final score anchored to the data** (70% AI fit + 30% data score), then budget optimisation with a knapsack (exact DP when small, greedy when large).

## 4. Benchmark Results

Numbers from the real run `8ee88197` on **2026-11-17**, sunscreen brief, N = 5, all 5 Kalodata sources. Full report in [BENCHMARK.md](BENCHMARK.md) (Vietnamese), raw numbers in [results.json](../benchmark/results.json).

A "first run" here means no AI cache and no stored Kalodata data, so every AI call and credit is paid. Re-running the same brief reuses both.

### 4.1 The 5 KOCs

Estimated booking cost **19,000,000 ₫ / 30,000,000 ₫**, DP optimizer: it picks the set with the highest total score and does not try to spend the whole budget.

| # | Creator | Followers | Est. cost | Final | AI fit | Data | Video | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | [@ngoc.matcha.review](https://www.tiktok.com/@ngoc.matcha.review) | 145,700 | 7,000,000 | 60.4 | 62 | 56.7 | 39.5 | good |
| 2 | [@bachluulinh](https://www.tiktok.com/@bachluulinh) | 75,800 | 4,000,000 | 53.6 | 60 | 38.6 | 65 | good |
| 3 | [@rin.review22](https://www.tiktok.com/@rin.review22) | 13,500 | 2,000,000 | 52.6 | 51 | 56.2 | 39.5 | weak |
| 4 | [@phuongmet57](https://www.tiktok.com/@phuongmet57) | 14,900 | 2,000,000 | 52.5 | 49 | 60.7 | 27.2 | weak |
| 5 | [@changaffiliate](https://www.tiktok.com/@changaffiliate) | 85,100 | 4,000,000 | 51.4 | 48 | 59.3 | 39.5 | weak |

The system says plainly when results are not strong: 3 of 5 are "weak". They have cheap reach and sell well but are mostly deal channels that rarely apply the product on skin; audience match is capped because the API has no follower demographics.

### 4.2 Evidence

Each KOC has 3–4 reasons and 2–3 risks, each with a traceable evidence id. For #1 @ngoc.matcha.review:

- ✅ Video GPM 246k VND per 1,000 views, top 5% of the pool — `c4.m7`.
- ✅ 28.9M organic views in 30 days (ad views removed), 83k expected views per 1M VND — `c4.m1`, `c4.m4`.
- ⚠️ Currently sells a Beplain sunscreen, a possible competitor conflict — `c4.m10`, `c4.t2`.
- ⚠️ Only shows the packaging and names ingredients; never applies it on skin — `c4.v1.o4`.

Full list for all 5 in [BENCHMARK.md §1](BENCHMARK.md#1-kết-quả-5-koc).

### 4.3 Tokens, cost, time

| | Value |
|---|---|
| AI | 13 calls, 48,639 input + 34,857 cache read + 25,209 output tokens, 20 images → **$0.40** |
| Kalodata for a first run | **9.4 credits ≈ $0.94** (this measurement paid only 3.1; the rest reused stored data) |
| **Total for one first run** | **≈ $1.34** |
| Processing time | **133.6 s** active (part of the Kalodata data already stored); a full first run takes ~2.5–3 min |
| Re-run of the same brief | 13/13 AI calls served from cache, **$0**, same result |
| Recovery | Hard kill during video review after 5 paid AI calls → resume in a new process → **0 calls paid twice** |
| vs. naive | Strong model reviewing videos for the whole pool: AI **$12.08** → **$0.40** (~97% cheaper) |

AI cost by step: content screen $0.0034 · video review $0.2119 · final ranking $0.1894. Funnel: pool 224 → pass data filters 213 → detail fetched 20 → content screen 20 → video review 10 → final ranking 10 → pick 5.

### 4.4 AI cost per creator

Video review is one call per creator, so it counts in full; content screening and final ranking are one call for up to 10 creators, so the call cost is split evenly across the batch.

| Creator reached | Creators | Content screen (Haiku) | Video review (Sonnet) | Final ranking (Opus) | AI per creator | Kalodata per creator |
|---|---|---|---|---|---|---|
| Whole funnel (5 picked + 5 not picked) | 10 | $0.0002 | $0.0187–0.0302 (avg $0.0212) | $0.0189 | **$0.0403** (≈ $0.11 with Kalodata) | 0.7 credits |
| Stopped after content screening | 10 | $0.0002 | – | – | **$0.0002** | 0.2 credits |

The first video call (@bachluulinh, $0.0302) costs more because it writes the prompt cache; later calls read it and cost ~$0.02. Each picked KOC also carries the cost of the creators that were dropped: AI $0.4046 / 5 = **$0.081 per KOC**, or ≈ **$0.27 per KOC** with first-run Kalodata credits. Per-creator table in [BENCHMARK.md §2](BENCHMARK.md#2-token--chi-phí--thời-gian-run-8ee88197).

### 4.5 Case: Kalodata deep data turned on

Same brief with all 3 paid options turned on in the form (run `293f2b65`, AI cache cleared first):

| | Default | Deep data on |
|---|---|---|
| AI (13 calls) | $0.4046 | $0.4059 |
| AI per whole-funnel creator | $0.0403 | $0.0404 |
| Kalodata paid in the run | 3.1 credits | 5.0 credits (category revenue 2.0 + video detail 2.0 + products sold 1.0, as estimated) |
| Kalodata per whole-funnel creator | 0.7 credits | 1.1 credits |
| Total for one first run | ≈ $1.34 | ≈ $1.75 |
| The 5 KOCs | – | 4 of 5 unchanged; @luumaianh_ replaces @bachluulinh; #1 fit 62 → 66; booking 22 / 30 million |

Deep data barely changes AI cost; the extra cost is Kalodata credits.

**Scale projection** (from measured unit costs):

| KOCs needed | AI | AI with Batch API | Kalodata | Total ≈ |
|---|---|---|---|---|
| 5 | $0.40 | $0.20 | 9.4 credits | $1.34 |
| 50 | $4.05 | $2.02 | 94 credits | $13.45 |
| 500 | $40.46 | $20.23 | 940 credits | $134.46 |

**When this was measured.** Re-measured on 2026-11-17 with a new Kalodata key, after the later changes: 2 more sources (`proven`, `rising`), the move to MongoDB, signals from already-paid data, and paid deep data. Re-run with `npm run benchmark -- --fresh` (add `--no-deep` to skip the deep-data case); stored Kalodata data is reused, so only new parts cost credits.

## 5. README

[README.en.md](../README.en.md) (English) and [README.md](../README.md) (Vietnamese) cover:

- **How to run** (§1): requirements (Node ≥ 22, MongoDB, ffmpeg, yt-dlp), install, running the web app / CLI / benchmark, offline mode, trying crash recovery. `.env.local` settings in §4.
- **Current limitations** (§5): no follower demographics; data skews to creators who sell on TikTok Shop; the AI sees 6 still frames + the transcript instead of real video; each creator's second video is cover-only; booking cost is an estimate; AI output is not fully deterministic; the worker runs inside the Next.js process and there is no login yet.
- **Roadmap** (§6): a model that reads video natively; multiple workers and a MongoDB replica set; Message Batches API (−50% AI cost); a source with follower demographics; a feedback loop from real campaign results; lookalike search with embeddings.

Companion docs: [FEATURES.en.md](FEATURES.en.md) (detailed feature table), [ARCHITECTURE.en.md](ARCHITECTURE.en.md), [BENCHMARK.md](BENCHMARK.md), [PRODUCT.en.md](../PRODUCT.en.md) and [DESIGN.en.md](../DESIGN.en.md) (product record + DETOLA-based design system).
