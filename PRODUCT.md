# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: marketers at a Vietnamese beauty brand or agency who need a shortlist of TikTok KOCs (Key Opinion Consumers) for a campaign. They work at a desk, in daytime office hours, often with a brief from a client open next to the tool. The job: turn a campaign brief (product, target audience, budget, number of KOCs) into a defensible shortlist they can present to a brand manager, with reasons and proof for every pick.

Secondary (confirmed context, not the design target): the DETOLA hiring panel reviewing this as a technical assessment.

## Product Purpose

KOC Discovery researches a large pool of TikTok creators from Kalodata data, analyses their content and videos with AI, and recommends N creators that fit the brief within budget. Success means a marketer can trust and explain each recommendation without re-doing the research, and the AI/data cost of producing it stays low.

## Positioning

Every recommendation is evidence-cited: each reason links to a specific metric, audience fact, or a numbered frame and quote from the creator's own video, and citations that do not exist are rejected by code. The pipeline is a cost-aware funnel (data filters before cheap AI before expensive video AI) with checkpointed, resumable runs and a visible cost ledger per run.

## Operating Context

- Workflow: write or adjust a brief → start a run → watch the 8-stage pipeline progress → read the ranked KOCs, their scores, reasons, risks and video evidence → compare alternates → stop/resume runs when needed.
- Runs take ~2–3 minutes cold; users watch progress, then read results in depth.
- Cost is a first-class concern: AI tokens (USD) and Kalodata credits (1 credit ≈ $0.1) are shown per stage and per endpoint.
- Content is Vietnamese (UI copy, AI reasons); technical identifiers (stage names, model names, evidence ids) stay in English.

## Capabilities and Constraints

- Next.js 16 app (App Router), UI + API routes in one app; SQLite storage; polling-based live progress.
- Brief fields: brand, product, category, product notes, keywords, target gender/age, budget (VND), number of KOCs, follower range, Kalodata category ids, content keywords.
- Run view: status, stop/resume, per-stage progress and timing, AI token/cost table, Kalodata credit ledger, funnel counts, KOC picks (rank, handle, followers, cost tier, estimated booking cost, final/AI-fit/data/video scores, verdict, headline, reasons/risks with evidence chips, suggested content angle, video contact sheets with cited frame highlighted), alternates, event log.
- Data limits that the UI must not hide: no follower demographics from the API (audience is inferred), booking cost is an estimate from a follower-tier rate card, mock mode results are simulated.

## Brand Commitments

- Personality (confirmed by user): precise, calm, trustworthy.
- Reference feel (confirmed): Linear / Stripe Dashboard — tight hierarchy, restrained color, crisp numbers.
- Brand system (user decision, 2026-11-16): follow the DETOLA design system from detola.vn — cream ground with white cards, navy ink, DETOLA orange primary buttons, teal for positive states, Be Vietnam Pro. This supersedes the earlier "no cream" anti-reference: the cream is DETOLA's committed brand color, not a default. Do not copy DETOLA's logo or mascot illustrations.
- Anti-references (still apply): dark neon/gradient SaaS; washed-out light-gray text with weak hierarchy.

## Evidence on Hand

- Real benchmark run with 5 KOCs, evidence, token/credit usage and timing: `docs/BENCHMARK.md`, `benchmark/results.json`.
- Real video contact sheets in `.data/media/` served at `/api/media/...`.
- No customer testimonials, logos or case studies exist; do not fabricate any.

## Product Principles

1. Evidence over assertion: a claim without a traceable source does not appear.
2. Cost is visible: every run shows what it spent and what cache saved.
3. Honest uncertainty: weak verdicts, missing data and estimates are labelled, never smoothed over.
4. Scan first, depth on demand: the ranking reads in seconds; proof is one click away.
5. Resilient by default: interruption is a normal state with an obvious way to resume.

## Accessibility & Inclusion

WCAG 2.2 AA: text contrast ≥ 4.5:1, full keyboard operation with visible focus, no information carried by color alone (verdicts and statuses also carry text), respects prefers-reduced-motion.
