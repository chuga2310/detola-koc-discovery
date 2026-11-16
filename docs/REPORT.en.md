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

Numbers from real run `ac0209d1` on **2026-11-16**, sunscreen brief, N = 5. Full report (Vietnamese) in [BENCHMARK.md](BENCHMARK.md), raw numbers in [results.json](../benchmark/results.json).

### 4.1 The 5 KOCs

Estimated booking cost **29,000,000 ₫ / 30,000,000 ₫**, DP optimizer.

| # | Creator | Followers | Est. cost | Final | AI fit | Data | Video | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | [@luumaianh_](https://www.tiktok.com/@luumaianh_) | 183,300 | 7,000,000 | 58.5 | 62 | 50.3 | 62.5 | good |
| 2 | [@sayhiinb](https://www.tiktok.com/@sayhiinb) | 210,800 | 7,000,000 | 56.6 | 58 | 53.3 | 47.5 | weak |
| 3 | [@binnoo0](https://www.tiktok.com/@binnoo0) | 105,000 | 7,000,000 | 53.3 | 50 | 61 | 46.8 | weak |
| 4 | [@lethiloan2001](https://www.tiktok.com/@lethiloan2001) | 76,300 | 4,000,000 | 53.1 | 51 | 58 | 47.4 | weak |
| 5 | [@bachluulinh](https://www.tiktok.com/@bachluulinh) | 75,800 | 4,000,000 | 52.4 | 55 | 46.5 | 67.5 | weak |

The system says plainly when results are not strong: 4 of the 5 KOCs are "weak". The reasons are stated: the audience-fit score is capped because the API has no follower demographics, and within a 30M budget few creators both specialise in sunscreen and have good organic reach.

### 4.2 Evidence

Each KOC has 3–4 reasons and 2–3 risks, each with traceable evidence ids. For example, #1 @luumaianh_:

- ✅ Engagement rate 9.4% (top 16% of the pool) — `c18.m2`.
- ✅ Has filmed a product with an SPF rating, with an "SPF 50+ PA ++++" overlay in frame 4 at 34.2 s — `c18.v1.o2`.
- ⚠️ Main niche is lipstick; only 1 of 10 recent videos has a sunscreen keyword — `c18.t1`, `c18.m5`.
- ⚠️ No demographics; the "female 18–30" fit is inferred from content only — `c18.a1`.

The full list for all 5 KOCs is in [BENCHMARK.md §1](BENCHMARK.md#1-kết-quả-5-koc) (Vietnamese, as the AI wrote it).

### 4.3 Tokens, cost, time

| | Result |
|---|---|
| AI | 13 calls, 42,959 input + 40,243 cache-read + 26,565 output tokens, 20 images → **$0.39** |
| Kalodata (cold) | **9.4 credits ≈ $0.94** |
| **Total for one cold run** | **≈ $1.33** |
| Processing time | **109.1 s** active (stored Kalodata data, cold AI); ~2.5–3 min fully cold |
| Re-run with the same brief | 13/13 AI calls reused from cache, **$0**, same result |
| Recovery | Hard kill during video review after 5 paid AI calls → resumed in a new process → **0 calls paid twice** |
| vs. naive approach | Strong model reviewing videos for the whole pool: AI **$12.08** → **$0.39** (~97% cheaper) |

AI cost by step: text screen $0.0034 · video $0.2004 · final scoring $0.1866. Funnel: pool 234 → enrich 20 → content read 18 → video review 10 → final scoring 10 → selected 5.

**Scale projection** (from the measured unit costs):

| KOCs needed | AI | AI with Batch API | Kalodata | Total ≈ |
|---|---|---|---|---|
| 5 | $0.39 | $0.20 | 9.4 credits | $1.33 |
| 50 | $3.91 | $1.95 | 94 credits | $13.31 |
| 500 | $39.07 | $19.54 | 940 credits | $133.07 |

**Note on when this was measured.** The benchmark ran on 2026-11-16 with 3 Kalodata sources, before the later changes: 2 more sources (`proven`, `rising`), the move to MongoDB, signals from already-paid data, and paid deep data. Since 2026-11-16 Kalodata rejects the API key ("The key is not allowed", even on the free endpoint), so it has not been re-measured. The 2 new sources are estimated at ~0.7 extra credits per cold run. Once the key works again, run `npm run benchmark -- --fresh` to re-measure; stored data is reused, so only the new parts cost credits.

## 5. README

[README.en.md](../README.en.md) (English) and [README.md](../README.md) (Vietnamese) cover:

- **How to run** (§1): requirements (Node ≥ 22, MongoDB, ffmpeg, yt-dlp), install, running the web app / CLI / benchmark, offline mode, trying crash recovery. `.env.local` settings in §4.
- **Current limitations** (§5): no follower demographics; data skews to creators who sell on TikTok Shop; the AI sees 6 still frames + the transcript instead of real video; each creator's second video is cover-only; booking cost is an estimate; AI output is not fully deterministic; the worker runs inside the Next.js process and there is no login yet.
- **Roadmap** (§6): a model that reads video natively; multiple workers and a MongoDB replica set; Message Batches API (−50% AI cost); a source with follower demographics; a feedback loop from real campaign results; lookalike search with embeddings.

Companion docs: [FEATURES.en.md](FEATURES.en.md) (detailed feature table), [ARCHITECTURE.en.md](ARCHITECTURE.en.md), [BENCHMARK.md](BENCHMARK.md), [PRODUCT.en.md](../PRODUCT.en.md) and [DESIGN.en.md](../DESIGN.en.md) (product record + DETOLA-based design system).
