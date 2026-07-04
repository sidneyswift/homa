# Homa Cloud — Planning Workspace

Planning artifacts for turning Homa (the Mac Mini homeschool agent) into a closed-source,
public, self-serve cloud product on Vercel. **Nothing here is built yet.**

## Documents

| Doc | Contents |
|---|---|
| [00-product-brief.md](00-product-brief.md) | What we're building, why, locked decisions, principles, pricing hypothesis |
| [01-architecture.md](01-architecture.md) | System shape: eve on Vercel, tenancy model, state, compute, ops, fallback |
| [02-user-journeys.md](02-user-journeys.md) | J1–J8: signup wow, daily loop, materials, compliance, coaching, billing, ops, Alessa's migration |
| [03-backlog.md](03-backlog.md) | Full ticket backlog, M0–M5, sized, launch blockers marked ⛔ |
| [04-risks-and-open-questions.md](04-risks-and-open-questions.md) | Ranked risks with mitigations; open questions mapped to milestones |
| [05-vercel-platform-facts.md](05-vercel-platform-facts.md) | Researched platform reference: Sandbox/Workflows/Queues/Cron/Gateway/Blob pricing+limits, Postgres decision (Supabase), compaction research |
| [06-harness-gap-analysis.md](06-harness-gap-analysis.md) | What Hermes ships out-of-box that we must build on eve: memory, session search, post-turn learning review, conversational cron, injection scanning |
| [07-deep-research-notes.md](07-deep-research-notes.md) | eve source-code findings (compaction internals, sandbox-per-deploy scoping), COPPA 2025 brief, 50-state compliance data sourcing, fal.ai economics |
| [08-billing-credits-design.md](08-billing-credits-design.md) | Subscription + usage credits on Stripe: internal ledger as source of truth, action-cost registry with margin law, plan sizing, Metronome graduation path |
| [09-council-synthesis.md](09-council-synthesis.md) | Adversarial 4-reviewer council: unanimous verdicts (auto top-up revision, invite-gated rollout, timeline re-baseline), security adoptions S1–S9, and the four open calls for Sidney |
| [journeys/](journeys/) | **The PM library** (9 workstreams, ~7,900 lines): 00 kickoff/personas cast, 01 personas+JTBD, 02 acquisition/activation, 03 retention/monetization, 04 feature journeys+Gherkin, 05 edge cases+trust, 06 metrics+tracking schema, 07 positioning/messaging, 08 competitive/moats, 09 discovery research plan, **10 reconciliation (conflict rulings C1–C9, MJ-01…33 ticket index, process laws, founder decision queue D1–D10)** |
| [10-real-usage-cost-model.md](10-real-usage-cost-model.md) | **Alessa's real 95-day usage measured from session logs**: ~3 human turns/day but ~116 automated LLM runs/day; 450M tokens/mo at peak; automation (heartbeat + ambient learning) is the dominant cost, not chat; Opus-as-is = $100–200+/mo per family (fails), tiered remix = $25–45 (works at $49) |
| [11-hermes-implementation-notes.md](11-hermes-implementation-notes.md) | Hermes internals extracted at code level: background-review triggers/digest/prompts (spec for M2-13), memory tool + threat-regex scanning (spec for M2-02/14), FTS5 session search (spec for M2-15), cron fail-closed pattern (M3-08) |
| [12-roadmap-okrs.md](12-roadmap-okrs.md) | **CAPSTONE: roadmap** — strategy kernel, Now/Next/Later horizons, Q3-C1 OKRs (wow ≤10min, WLF ≥70%, efficacy note by wk4, trial ≤$45, zero trust incidents), P0/P1/P2, five dated tripwires |
| [13-mr-prd.md](13-mr-prd.md) | **CAPSTONE: the Cohort One PRD** — FR-1…11 bound to journey specs and Gherkin stories, platform requirements, 8 launch gates, non-goals enforced. The document engineering agents build from |

## Decision log

| Date | Decision |
|---|---|
| 2026-07-02 | v1 audience: public self-serve launch |
| 2026-07-02 | v1 channel: web app chat (voice-first); SMS/WhatsApp fast-follow |
| 2026-07-02 | Engine: eve on Vercel, gated on M0-01 tenancy spike; fallback custom harness |
| 2026-07-02 | Business: entity later; existing Stripe account for billing |
| 2026-07-02 | Scope: everything ticketed, milestone-sequenced (M0–M5) |
| 2026-07-02 | Open source: closed; homa-template frozen/archived |
| 2026-07-02 | Postgres: our own event log IS required (Workflow retention = 7 days post-completion). Provider: ~~Neon~~ → **Supabase** (Sidney's call, same day) — RLS second tenant wall, bundled Auth candidate, MCP in dev workspace |
| 2026-07-02 | Sessions: deliberately rotated, never eternal; all durable facts in Postgres, re-injected per turn via dynamic instructions (compaction research: entity loss + governance decay) |
| 2026-07-02 | Per-family cost tracking: AI Gateway Custom Reporting (`ai-reporting-user` header) + budget quotas — not hand-rolled |
| 2026-07-02 | Billing: **subscription + usage credits** (Sidney's call). Internal credit ledger = source of truth; Stripe = subscriptions + Checkout packs + webhooks; every billable action priced in the `action_costs` registry with ≥70% margin law; Metronome = graduation path, not v1 |
| 2026-07-02 | ~~Auto top-up default-on~~ **COUNCIL REVISION (veto-able):** never-block via grace buffer + explicit opt-in auto top-up — unanimous 4/4 council (races, ROSCA/chargeback exposure, community trust). Preserves the intent: the mom is never blocked mid-action. See 09 §V1 |
| 2026-07-02 | **Council synthesis adopted (09):** M-R revenue-first track is plan of record — invite-gated rollout, first dollar ~wk 6 via Payment Link, concierge loops, Alessa gate at wk 5; public GA = scheduled switch after 10 stranger families survive week-4 unassisted. Security adoptions S1–S9 folded into tickets. **Four calls pending Sidney:** auto top-up veto, visible credits vs flat plans, age-range ICP (preK–2 vs +8–12 track), child voice/likeness scope |
| 2026-07-02 | **Origin-user value stack recorded (00):** metrics-as-validation ("a test for the mother," never the child), the **efficacy loop** as the ultimate selling point (M3-11 ⛔ — assess → target → generate → prove the metric moved), connector layer (local discovery M3-12, curriculum comparison M3-13, co-op finder M5-08, moms network M5-09). Positioning corrected: metrics lead, presentation law stands |
| 2026-07-02 | **Design system adopted** (`docs/homa-design/`): brand promise "You've got this. HOMA's got the rest." / tagline "Homeschooling, made calm"; reassurance-first data law (**no red "behind" labels, ever**; growth framing only); voice rules flow into agent instructions (M2-01); UI kits are the spec for M1-04/M2-08/M4-07; worksheet template feeds M2-05; new ticket M1-17 (token/component integration) |

## Source material in this repo

- `homa-macmini/` — the live production system (read-only reference; keeps running for Alessa)
- `homa-template/` — the OSS template attempt (now frozen; port source for `packages/core`)
- `homa-research/` — OpenClaw + Hermes clones and EVE docs pointer (research only)
- `docs/homa-design/` — **the brand + UI source of truth** (added 2026-07-02): "Quiet warmth" direction, tokens/components (clay/sage/gold, Newsreader/Hanken Grotesk), full UI kits (web app incl. Benchmarks/Discover/Curriculum views, mobile, landing), social templates, printable worksheet template, voice/copy rules, and an agent-skill entry (`SKILL.md`) so coding agents design on-brand

| 2026-07-03 | **Founder decision session:** D1 ✅ grace-buffer billing (never blocks, opt-in silent top-up); D2 ✅ flat fair-use plans (meter internal-only); D9 ✅ unlimited kids on every plan, tiers by usage allotment, overflow auto-bumps the month. NEW: T1 trial = card upfront + uncapped power-user experience (the Alessa-vs-Fox felt difference IS the conversion mechanism); T2 pricing derived from first 60 days of margin data — margin/model-swap infra elevated to day-one priority; T3 never compete in Fox's category ($99/yr chat+dashboard) — sell the always-on agent |
| 2026-07-03 | **Repo strategy:** reuse `sidneyswift/homa` (verified: public, 0 stars/forks/watchers) → make private, becomes the product monorepo. Template preserved as `template-archive` tag + local `homa-template/`; monorepo starts on fresh orphan `main` after a history secret-scan. No GitHub org tonight (transfer later if needed). Executes M5-07's archive intent |
| 2026-07-03 | **Decision queue CLOSED** (journeys/10 §5): D3 ✅ full age range ("boil the ocean" — 8–12 track agent-built in parallel, M5-06 pulled forward; cohort starts on proven 2–7 core); D4 ✅ photo-personalized magic ships day one "startup right" (consent screen + no-training DPAs + photo TTL + no face-recognition ship WITH it); D5 ✅ companion-not-therapist crisis posture; D6 ✅ sensitive-flag health info; D7 ✅ share worksheets freely with footer attribution; D8 ✅ HOMA in UI / Homa in prose. Only D10 remains (ask Alessa: is "Hegg" Heggerty?). **Capstones unblocked: OKR roadmap + M-R PRD** |

## Next action

**PLANNING PHASE COMPLETE** (2026-07-03). All decisions closed (journeys/10 §5, only
D10 "ask Alessa" open), capstones written (12-roadmap-okrs, 13-mr-prd).

**Engineering agents start at `/BUILD.md` (repo root).** It is the entry point: reading
order, dependency-sequenced build phases, non-negotiable laws, and conflict-resolution
rules. No build-time estimates exist anywhere in this plan by design — the ONE real
date is **July 13, 2026 (Alessa's conference): marketing site + waitlist email capture
must be deployed** (BUILD.md Deliverable 0). After that: Phase A engine proofs, then
the PRD's FR order.
