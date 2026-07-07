# Homa Roadmap & OKRs — Senior PM capstone (2026-07-03)

> Supersession note (2026-07-06, build-log): $29 and $29 to $49 plan prices
> below are the retired placeholder. Pricing v1 is Homa $19/mo or $99/yr and
> Homa Pro $49/mo, live in Stripe both environments. Competitor prices quoted
> in this doc are facts and stand. Allotments still derive at day 60 (T2).

> Synthesizes: decision queue D1–D9 + T1–T3 (journeys/10 §5, all closed), the M-R
> revenue-first track (03-backlog), the PM library (journeys/01–09), real usage data
> (10-real-usage-cost-model), and the council verdicts (09). Companion doc: the M-R PRD
> (13-mr-prd.md) specifies the Now horizon in buildable detail.

## Vision (unchanged, sharpened by Alessa's testimony)

Every homeschool mom gets an always-on agent that knows each of her children, makes
materials aimed at exactly what's growing, **proves the work moved the numbers**, does
the state paperwork, and connects lessons to her real world — so she feels calm,
capable, and not alone. The durable asset is the family's accumulating record (profile,
hours, journal, portfolio, what-works) with the efficacy loop as its engine.

## Strategy kernel

- **Diagnosis:** validated demand exists (hours/compliance, personalized materials);
  the felt difference vs $8–12/mo tools only appears at power-user intensity (T1
  insight); trust is the scarce resource in this niche; a solo founder's constraint is
  ops surface, not code volume (agents write code; nobody else answers 3am pages).
- **Guiding policy:** ship the proven domain system on managed infrastructure
  (eve/Vercel/Supabase), sell the *felt* agent difference through an uncapped trial,
  price on usage tiers derived from measured margins, and let concierge loops be the
  product until automation earns its keep. Never compete in Fox's category (T3).
- **Coherent actions:** the three horizons below.

## Horizons (Now / Next / Later)

### NOW — "Cohort One" (M-R track; phases by dependency, no calendar estimates)

Goal: **20 invited families, cards on file, feeling the power-user difference.**
**Hard external deadline inside NOW: July 13, 2026 — conference landing page +
waitlist capture live (BUILD.md Deliverable 0, independent of all other phases).**

| Cluster | Contents |
|---|---|
| Conference (July 13) | Landing page + waitlist capture deployed (BUILD.md Deliverable 0), conference kit to Alessa, entity filing |
| Engine proof | M0-01 adversarial prototype (strict timebox), M0-03/04 wow+voice spikes, M0-05 Supabase+RLS, M0-09 repo |
| Core product | M1-01..05/07/08min, M1-14..17, M2-01..05 (incl. D4 photo-personalization + consent floor), M2-07/08 subset, M2-13/14 |
| Journey adds | MJ-01..14 (print preflight, routing undo, crisis playbook, PWA, drip, gen status, out-of-range, event registry, invites, SLA, feedback reasons, dispute flow, sensitive-context, founder dashboard) |
| Money | Stripe Payment Link: trial w/ **card upfront** (T1), $29/mo placeholder price; margin telemetry from day one (T2: Gateway `ai-reporting-user` + action-class tags) |
| Concierge | Saturday scoring script; Sidney-reviewed weekly notes **with hand-written efficacy before/after**; "ask Homa" state reports; manual routing assist at n=1 |
| Parallel (agents) | 8–12 benchmarks/questionnaire/materials track (D3) behind the rigor bar; SEO state-page content (MJ-30 start) |

**P0 within Now** (nothing ships without): M1-07 isolation suite green in CI · D4
consent floor (screen + DPAs + photo TTL) · MJ-03 crisis playbook · M1-16 safe mode +
backups · MJ-08 event registry · card-upfront trial live.
**P1:** the wow funnel (M2-03 split, MJ-04/05/06), materials + photo magic, voice+fallback, dashboard, hours capture.
**P2:** MJ-10/11/12, weekly-note tooling polish, PWA niceties.

### NEXT — "Earn GA" (post-first-dollar → public GA switch)

Trigger to start: ≥10 paying families past their second usage week. Trigger to flip
GA: **10 stranger families survive onboarding + their fourth usage week unassisted**
(council V2 gate). (Usage weeks are customer-calendar measures, not build estimates.)

- Real billing system: M1-06/M1-12 (grace buffer, opt-in auto top-up, tier auto-bump
  months per D9) + M1-13 margin CI — **pricing finalized from 60 days of measured
  margin data (T2)**
- Automation replaces concierge one loop at a time (M3-01/02 productized, M3-04
  quarantine pipeline, M3-05/06 full compliance, MJ-15 benchmarks surface)
- Hardening: M4-01..08 + M4-12, MJ-20/21/24 (degraded mode, multi-adult, status page)
- 8–12 track fronts families once it passes the same citation rigor as the 2–7 core
- Marketing site + programmatic SEO live; referral instrumentation (MJ-29)

### LATER — "Compound" (post-GA)

- Channels: SMS via 10DLC (entity clock already running), WhatsApp
- Connector layer at full strength: MJ-31 discover governance, M3-12/13, M5-08 co-ops
- Network moat: M5-09 Homa-moms local network (post-traction only)
- New abilities → registry-first (T2): video, 3D as kids age up, richer curriculum
  ingestion (M2-12); teen track; graduation packs (MJ-22) as word-of-mouth artifacts
- Metronome graduation if billing complexity earns it

## OKRs — Cohort One phase (call it Q3-C1)

**O1 — Manufacture the felt difference (activation)**
- KR1: First personalized artifact ≤10 min from signup for ≥80% of new families
- KR2: ≥70% of cohort completes the week-one drip (≥15 of 21 drip questions answered)
- KR3: Add-to-home-screen (PWA) ≥60% of families

**O2 — Prove it compounds (retention + efficacy)**
- KR1: Weekly Learning Families (WLF, per journeys/06) ≥70% by week 4
- KR2: Every family receives ≥1 hand-written efficacy before/after by week 4; ≥50%
  react/respond to it
- KR3: Journal-prompt reply rate ≥40% weekly average
- KR4: W4 retention ≥60% (families still WLF-active in weeks 4–5)

**O3 — Prove the economics (T2)**
- KR1: Margin telemetry live day one: cost per family per action-class, weekly
- KR2: Uncapped-trial token cost ≤ $45/family/mo P50 (real data beats the estimate)
- KR3: ≥3 model-remix experiments run with quality checks (evals) — pricing memo with
  derived tier allotments delivered at day 60
- KR4: Zero unpriced billable actions (registry CI green)

**O4 — Zero trust incidents**
- KR1: M1-07 adversarial suite green in CI every merge; 0 cross-tenant events
- KR2: Crisis playbook + D4 consent floor + SLA (MJ-10) live before invite #1
- KR3: 100% outbound weekly notes human-reviewed (concierge = fail-closed review)
- KR4: Support first-response ≤ same-day for P0 categories, measured

## Standing tripwires (dated, from council + decisions)

1. **eve eject:** >2 breaking changes costing >1 day each in any 4-week window before
   M1 ends → eject to custom harness; after M2 starts → never eject, fork/vendor.
   Tracked in `docs/homa-planning/eve-churn-log.md`; `eve` is pinned to an exact
   version in `apps/web/package.json` so every bump is a logged decision.
2. **8–12 rigor bar (D3):** the parallel track never fronts a family until its
   benchmarks match the 2–7 core's citation standard — reviewed like M3-04 publishes.
3. **Anti-guilt ratio law:** re-engagement response ≥20% & unsubs <1%/mo or sends stop.
4. **Trial economics:** if P50 trial cost exceeds $60/family/mo, invoke model-remix
   before touching the uncapped promise (T1 is the last thing we compromise).
5. **Concierge ceiling:** when weekly-note review exceeds ~3 hrs/Saturday, that loop
   graduates to automation next sprint (the pain IS the prioritization signal).
