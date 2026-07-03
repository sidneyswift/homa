# Homa Cloud — Full Backlog ("ticket everything")

> Status: PLANNING COMPLETE → BUILD. Everything is ticketed; **phases enforce
> dependency order, not calendar time** — there are deliberately NO build-time
> estimates (agents build at agent speed; see BUILD.md). Sizes S/M/L/XL = relative
> complexity only. `⛔` = launch blocker for public self-serve.
>
> **THE ONE REAL DATE: July 13, 2026 — Alessa's conference. Marketing site + waitlist
> email capture MUST be live (BUILD.md Deliverable 0).**
>
> **COUNCIL REVISION (2026-07-02, see 09-council-synthesis.md):** plan of record is the
> **M-R revenue-first track**: invite-gated rollout (same self-serve code, invite codes
> at signup), first paying families via concierge loops, public GA as a scheduled
> switch after 10 stranger families survive onboarding + their fourth usage week
> unassisted. M0–M5 tickets remain the full catalog; M-R sequences a subset and defers
> the rest to post-revenue, where 20 real families' data makes them better-built anyway.

## M-R — Revenue-first track (plan of record; phases = dependency order)

| Phase | Scope (ticket refs) |
|---|---|
| **0 — CONFERENCE (deadline July 13)** | **Marketing landing page + waitlist capture, deployed** (BUILD.md Deliverable 0; specs: journeys/07 copy kit, journeys/02 §1, MJ-09, homa-design landing kit), M0-07 conference kit to Alessa, **file the entity** (starts 10DLC clock) |
| A — Engine proof | M0-01 (strict timebox, GO/NO-GO criteria written before starting), M0-03 (+ S8 egress criteria), M0-04 (+ text/upload fallback built same sitting), M0-05, M0-08, M0-09, M0-10 trimmed to 3 worksheet formats |
| B — Walking skeleton | M1-01 (**Supabase Auth — decided**), M1-02 (+ S2 RLS access pattern), M1-03, M1-04 trimmed (+ S6 token custody), M1-05, M1-07 (+ S3 adversarial suite, stays ⛔ at any cohort size), **M1-08 minimal (pulled in per journeys/10 C4 — drip/journal/note need email)**, M1-14 harness contract, M1-15 rotation, M1-16 safe mode + backups, M2-01, M2-02, M2-03 (split: form intake / drip questionnaire / 3-min wow), M2-05 (incl. D4 photo consent floor), M2-14, **MJ [M-R] set: MJ-01 print preflight, MJ-02 routing undo, MJ-03 crisis playbook, MJ-04 PWA, MJ-05 drip scheduler, MJ-06 generation status, MJ-07 out-of-range kids, MJ-08 event registry, MJ-09 invites, MJ-10 SLA, MJ-11 feedback reasons, MJ-12 dispute flow, MJ-13 sensitive-context law, MJ-14 founder dashboard** |
| C — Alessa moves in | **M4-11 partial: Alessa daily use begins** (the real gate — her parity verdict gates invites #6–20), M2-08 minimal dashboard, M2-07 journal prompt (concierge routing at n=1), **hours capture pulled forward** (M3-05 subset) |
| D — First dollar | Stripe Payment Link trial-with-card (T1; replaces M1-06/12/13 pre-revenue), invite codes to friend + first waitlist families, 1-page privacy policy naming providers, support inbox + auto-responder. Concierge: Saturday scoring script + Sidney-reviewed weekly notes (= fail-closed human review) **hand-writing the efficacy before/after in every note from the first one** (M3-11 done manually until the data pipeline exists), "ask Homa" state reports |
| post-revenue | Full billing system (M1-06/12/13 per 08), remaining M2/M3, M4 hardening → **public GA switch** |

Deferred to post-revenue: M1-08/09/10/11(per-family), M2-06, M2-09, M2-12, M3-03 (folded into weekly note), M3-08, M4-01/02/03/06/07(full), M4-10. Cut/absorbed: M0-02 (only on NO-GO), M0-06 (replaced by real cohort data + Gateway budget caps).

## M0 — Prototype phase: test the risky assumptions before committing

Plain-language explainer (no jargon): before building the real product, we build a small
**throwaway prototype** — a fake Homa serving 3 pretend families — purely to confirm the
architecture works the way the docs say and to measure the things docs can't tell us
(speed, cost, feel). "Spike" was the shorthand for exactly this: a time-boxed experiment
whose only output is answers, not shipping code. If the prototype proves the design, we
build for real on the same pattern; if it fails, we fall back to the custom-harness plan
before any real code exists. Everything else in M1–M5 waits on this gate (except
Phase 0, the conference deliverable, which is independent and deadline-bound).

| ID | Ticket | Size | Notes |
|---|---|---|---|
| M0-01 ⛔ | **Throwaway multi-family prototype on eve** — COUNCIL RE-SCOPE: strict timebox (throwaway code, answers only), GO/NO-GO criteria written before starting, and the tests are adversarial things a short prototype CAN falsify: (a) **eve upgrade drill** — bump one version mid-run with a session parked in HITL, document breakage; (b) **deploy + rollback** with an in-flight workflow run; (c) **kill the dispatcher mid-fan-out**, verify lease recovery; (d) **rotate a session parked in HITL**; (e) synthetic 100-family fan-out with fake work. Un-testable long-horizon risks become dated tripwires: >2 breaking eve changes costing >1 day each in any 4-week window before M1 ends ⇒ eject to M0-02; after M2 starts ⇒ never eject, fork/vendor the pinned version | L | GO/NO-GO gate with teeth |
| M0-02 | (only if M0-01 fails) Same prototype rebuilt without eve, directly on AI SDK + Workflow + Sandbox | L | The fallback engine |
| M0-03 ⛔ | Worksheet generation inside the prototype: run a ported reportlab script + fal.ai image call in Vercel Sandbox from a chat message; measure end-to-end latency + cost per worksheet (research predicts <$0.03 compute — verify) | M | The "wow" moment depends on this |
| M0-04 | Voice-note test on real phones: record in mobile Safari/Chrome → upload → Whisper → text lands in the chat turn | M | Moms are on phones |
| M0-05 | ~~Postgres decision~~ **Decided: Supabase** (founder preference; RLS as second tenant wall, bundled Auth candidate for Q3, MCP already wired into the dev workspace). Ticket is now: Supabase project setup + schema v0 (family/child/profile) **with RLS policies from row one** | S | See 05-vercel-platform-facts.md |
| M0-06 | Model-mix cost model: simulate a family-month (turns, scoring, generation) across candidate models via AI Gateway; produce $/family/mo table | M | Sets pricing floor |
| M0-07 | Conference field research kit for Alessa: demo script, 5 interview questions, pricing probe ($19/29/49 reactions) | S | Free market research |
| M0-08 | Font licensing audit for bundled TTFs (Patrick Hand, Quicksand, etc.) | S | Redistribution rights |
| M0-09 | Repo bootstrap: monorepo (`apps/web`, `apps/agent`, `packages/core`, `planning/`), CI, preview deploys | M | |
| M0-10 | Extract `packages/core` v0: child profile schema (genericized from `story_position` → `development_position`), questionnaire bank, benchmarks, activities — ported from homa-template, residue scrubbed | L | The asset; closed-source per decision |

## M1 — Platform skeleton (auth → billing → chat)

| ID | Ticket | Size | Notes |
|---|---|---|---|
| M1-01 ⛔ | Auth with `familyId` principal; session plumbing into agent. **Decided: Supabase Auth** (Q3 closed — ships with the DB, unlimited MAU, JWT maps to eve `AuthFn`) | M | |
| M1-02 ⛔ | Tenant data layer: Postgres schema v1 (families, users, children, profiles jsonb, journal, observations, artifacts, events, cron_runs) + **S2 access-pattern law: agent DB access via non-service role + `SET LOCAL` per-request transaction (never session SET under Supavisor pooling); every tool re-scopes ALL model-supplied IDs by family_id server-side** + `profile_revisions` append-only versioning with writing-job identity | L | RLS must actually engage — see 09 §S2 |
| M1-03 ⛔ | Blob storage layout `families/{id}/…` + signed URLs with **serve-time ownership check** (not just signature validity); URLs never embedded in emails/PDFs | S | 09 §S8 |
| M1-04 ⛔ | Web chat UI: streaming, markdown, artifact cards (PDF preview/download), mobile-first. **Continuation tokens are secrets: server-side custody only, ownership check on every resume/append, never logged, rotated on session rollover** | L | 09 §S6 |
| M1-05 ⛔ | Voice notes in chat (from M0-04 spike → production) **+ client-side failure fallback (text box + audio file upload) shipped simultaneously** — voice failure is a moat failure | M | Realist #5 |
| M1-06 ⛔ | Stripe: subscription (licensed price), 14-day trial, Checkout for credit packs, customer portal, webhook suite (`invoice.paid`, `checkout.session.completed`, sub updates, refunds/disputes → clawback) | L | Design in 08-billing-credits-design.md |
| M1-12 ⛔ | Credit ledger — COUNCIL REVISION (V1, veto-able): append-only `credit_ledger` (grant/burn/expire/refund, RLS), `chargeCredits` pre-execution with **DB-unique-constraint idempotency** (not just keys), **grace buffer = never block** (balance may go modestly negative; action always completes), post-action one-tap top-up prompt, **auto top-up as explicit un-bundled opt-in** (own consent screen: pack/threshold/monthly cap), **Postgres advisory lock = singleflight top-up per family**, monthly credits granted by our scheduler at cycle start (webhook = reconciliation), trial = promotional credits no card, **global billing kill switch** | XL | Post-revenue build; Payment Link covers cohort one. See 09 §V1 |
| M1-13 ⛔ | `action_costs` registry + CI check "no unpriced billable actions" + admin margin view (Gateway Custom Reporting actuals vs credits burned) | M | The costs-and-margins-per-feature law, mechanized |
| M1-07 ⛔ | Tenancy isolation test suite: adversarial prompts attempting cross-family access; runs in CI | M | Non-negotiable for kids' data |
| M1-08 | Transactional email (Resend): welcome, receipts, journal prompt, weekly note templates | M | |
| M1-09 | Web push notifications (opt-in) | S | |
| M1-10 | Rate limiting + usage metering per family (Gateway token data → `usage` table) | M | Cost guardrail |
| M1-11 | Feature flags + per-family kill switch | S | |
| M1-14 ⛔ | **Harness escape-hatch contract** (council V-adopt #8): TypeScript interface `startTurn/parkForHuman/resume/scheduleDispatch/persistEvent`; eve lives behind it as an adapter, incl. wrapping `useEveAgent`. Makes the fallback real | M | Architect #1 |
| M1-15 ⛔ | **Session rotation state machine** (council #3): rotate only at idle, never while parked; structured episode-summary to Postgres on rotation (our template, not eve compaction); transactional cursor swap against live clients | M | Was design-law-without-a-ticket |
| M1-16 ⛔ | **Safe mode + backups**: global switch pausing all loops/outbound email/charges (chat degrades to reactive-only); fail-closed — unacknowledged doctor alert ⇒ loops pause; Supabase PITR + nightly logical dump to Blob; as-built runbook stubs generated per feature at merge | M | Realist #8, architect #6/#7 |
| M1-17 ⛔ | **Design system integration** (`homa-design/`): tokens (`styles.css`) + components ported into `apps/web` as the app's component library; web-app UI kit views (Chat, Dashboard, Benchmarks, Planner, Discover, Curriculum, Onboarding) are the build spec for M1-04/M2-03/M2-08; design-system `SKILL.md` wired into the repo so coding agents build on-brand; **reassurance-first data law enforced in code** (no red "behind" states — growth framing only, per DS readme) | M | The UI is no longer designed from scratch — it's implemented from spec |

## M2 — The agent (port the domain system)

| ID | Ticket | Size | Notes |
|---|---|---|---|
| M2-01 ⛔ | Agent instructions: port SOUL/IDENTITY/AGENTS into eve `instructions.md` + per-family dynamic context (USER-equivalent from DB) **+ design-system voice rules** (offers never commands, second person, name the child + name the win, reassure-before-inform, sentence case, no em dashes, ≤1 emoji, "a lighter day is still a good day" permission language) | M | Voice source: homa-design/readme.md §Content fundamentals |
| M2-02 ⛔ | Memory model: `recall`/`remember` tools + session-start context loader (daily notes, long-term facts, per-child `what_works`) | L | Replaces MEMORY.md convention |
| M2-03 ⛔ | Onboarding — COUNCIL INVERSION (product #1): split into (i) boring form intake (name/state/kids/DOBs — forms, not conversation), (ii) **3-minute wow**: 4 questions per child → personalized worksheet in-chat, (iii) the 15-min questionnaire re-scoped as a **week-one drip** ("3 questions a day") that doubles as the day-1→7 engagement mechanic. Sparse profiles are fine — the confidence system was built for exactly that | XL | Wow before work, always |
| M2-04 ⛔ | Profile engine: observation → subdomain update, confidence decay job, position computation vs benchmarks | L | Port of scoring logic |
| M2-05 ⛔ | Worksheet skills port: handwriting, flash cards, coloring pages (from M0-03) → artifact library + feedback 👍/👎 wired to `what_works`; **PDF layout adopts the DS printable-worksheet template** (`homa-design/templates/worksheet/`, incl. `showAnswers` answer-key variant). **D4 addition: photo-personalization ships day one** — family reference-image upload with dedicated consent screen (separate from signup), raw-photo TTL, no-training/no-retention DPAs with image providers (M4-04), NO face-recognition ever | L | D4 decided 2026-07-03 |
| M2-06 | Remaining make-skills: decodable readers, sentence pyramids, picture book, word-of-the-week | L | |
| M2-07 ⛔ | Journal capture (J2): evening prompt schedule + email deep-link + routing to journal/compliance/profile/memory | M | |
| M2-08 ⛔ | Dashboard (web): per-child domain positions, trajectory, hours, recent artifacts — rendered live from Postgres | L | Replaces vault + Vercel dashboard |
| M2-09 | Activity recommendations from library keyed to profile position + interests | M | |
| M2-10 | Weekly plan generation (genericized `build-weekly-plan` — schedule from tenant config, not hardcoded) | M | |
| M2-11 | Multi-child routing rules (disambiguation etiquette from SOUL.md) | S | |
| M2-12 | Curriculum ingestion skill (photo of textbook → lesson plan) | L | Can slip to M5 |
| M2-13 ⛔ | Post-turn learning review, HARDENED (council S4): **schema-constrained output** (enumerated domains, bounded scores — no free text that becomes instruction), extraction turns run with **reduced toolset** (no schedule/billing/web tools), **delta/rate guards** (a turn moving >N subdomains gets staged, not auto-applied), surfaced in UI with undo, writes recorded in `profile_revisions` | L | The "gets smarter" loop, now injection- and corruption-resistant |
| M2-14 ⛔ | Injection defense for user-derived content — PROMOTED + EXPANDED (council S5): structural separation (labeled untrusted-data blocks), scanning layer (length caps, unicode/HTML stripping, instruction-pattern deny-list), scope includes journal text, transcripts, memory writes, **textbook photos, and web-research content**; memory char budgets + consolidate-on-full per Hermes spec | M | Was mis-prioritized as non-blocking |
| M2-15 ⛔ | `recall_conversations` tool — PROMOTED (rotation makes recall load-bearing): Postgres FTS (+pgvector), **family_id filtered inside the SQL** (pre-filter FTS; over-fetch-then-hard-filter for ANN), cross-tenant search probes in M1-07 | M | Council S3 |

## M3 — Loops + compliance (the moat + the table stakes)

| ID | Ticket | Size | Notes |
|---|---|---|---|
| M3-01 ⛔ | Weekly scoring job: fan-out per family, batched, cheap-first model mix; writes trajectory snapshot | L | |
| M3-02 ⛔ | Weekly parent note (J5): what moved, stale areas, suggested measurement activity | M | |
| M3-03 | Interventions: propose/accept/track/retire lifecycle | M | |
| M3-04 ⛔ | Global nightly benchmark research job — QUARANTINE PIPELINE (council S1, fleet-wide blast radius): job emits **typed benchmark fields only** (never prose-to-library), citation-must-resolve check, review renders a **diff with invisible-char/HTML stripping applied first**, content-addressed versioned publishes with **one-action fleet-wide revert** | L | The one injection surface that hits every family at once |
| M3-05 ⛔ | Hours/compliance tracking (J4): ambient hour capture, per-state ruleset table seeded from the **HomeschoolLeap free public API** (statute-sourced) + JHU Homeschool Hub verification; statute links + "last verified" dates shown in product | L | Data sourcing solved — see 07-deep-research-notes.md |
| M3-06 ⛔ | State report generator: generic report v1 (attendance, hours by subject, portfolio index) → PDF | M | Deep per-state templates post-launch by demand |
| M3-07 | Re-engagement policy: quiet-family nudges, prompt-fatigue rules | S | |
| M3-08 | Mom-created reminders/schedules via chat: schedule CRUD tools on the dispatcher rows; model pinned + fail-closed; schedule-spawned sessions never get schedule tools (no runaway loops) | M | Hermes `cronjob` pattern (see 06-harness-gap-analysis.md) |
| M3-09 | ~~Auto-top-up~~ Folded into M1-12 — grace-buffer never-block + explicit opt-in auto top-up per council V1 (veto-able) | — | See 09-council-synthesis.md §V1 |
| M3-10 | Dispatcher failure hardening (council #4): lease `leased_until` TTL + reaper sweep, fan-out as durable Workflow, **outbox pattern** with `(schedule_row_id, scheduled_for)` uniqueness on every outbound send (no duplicate journal emails), dispatcher heartbeat row + >5min gap alert, Saturday scoring staggered | M | The 3am component gets a failure design |
| M3-11 ⛔ | **Efficacy loop — the ultimate selling point** (Alessa, 00 §value stack): attribution view connecting activities/materials done → subdomain metric movement → before/after presentation in dashboard + weekly note ("the sentence pyramids moved his phonics from X to Y"). Mostly composition of M2-04/M2-05-feedback/M3-01 data — the delta is the attribution join + honest presentation (correlation framed as progress-with-the-work, not causal overclaim) | M | The renewal argument and the word-of-mouth artifact |
| M3-12 | **Local discovery engine** (Alessa): community/cultural activities tied to what the child is learning NOW — museums, zoo, story hour, library programs, rainy-day options; surfaces as suggestions in chat + one line in the weekly plan ("space week → Air & Space Museum?"). v1 = per-family metro area web-research on the weekly-plan schedule (the Mac Mini's orphaned "DC events scout" cron, generalized); later: cached per-metro activity library shared across families | L | Post-revenue; needs S1-style quarantine on web content |
| M3-13 | **Curriculum comparison advisor**: "should I use Hegg or Logic of English for phonics?" answered from the practice library (curriculum-reviews.md pattern) + web research + what-works data; positions against curriculum-box anxiety | M | Post-revenue |

## M4 — Launch hardening (public self-serve makes these blockers)

| ID | Ticket | Size | Notes |
|---|---|---|---|
| M4-01 ⛔ | Fleet doctor: nightly per-family health scoring → `ops_findings` + alerting (cloud `doctor.py`) | L | |
| M4-02 ⛔ | Admin console — session inspector gating now DEFINED (council S7): **break-glass model** — metadata-only by default; content access requires reason-tagged time-boxed grant tied to a ticket, immutable audit the admin can't alter, family-visible access notice, read-only/no-export, `recordInputs/recordOutputs:false` in all traces | L | "Privacy-gated" is now acceptance criteria, not a vibe |
| M4-03 ⛔ | Observability wiring: Sentry, AI Gateway cost alerts, eve Agent Runs, uptime checks | M | |
| M4-04 ⛔ | Privacy policy + ToS — lawyer pass with the COPPA-2025 brief in 07-deep-research-notes.md: confirm parent-directed posture (child never uses the product) keeps us outside COPPA's operator trigger; written retention policy (now mandatory); provider no-training/ZDR terms verified contractually; third parties named in notices; state child-data laws | M | Compliance deadline for the amended rule already passed (Apr 2026) — launch must comply day one |
| M4-05 ⛔ | Data export (markdown+JSON+PDF bundle) + self-serve deletion **with propagation** (Blob, backups, Workflow storage, subprocessors) | M | Council S10 |
| M4-12 ⛔ | Compliance floor as EXECUTED artifacts (council S10, refuse-to-launch #2): retention schedule with concrete TTLs per data class (voice audio, transcripts, photos, profiles, journals, PDFs, logs, backups), executed no-training/ZDR subprocessor DPAs (fal, model providers, Whisper), published subprocessor list, **written breach-response plan with notification clocks** | M | Not a lawyer pass — deliverables |
| M4-06 ⛔ | Abuse/safety: signup abuse (BotID), content-safety guardrails on generation, spend caps | M | |
| M4-07 ⛔ | Marketing site — REFRAMED (Alessa + council product #7): lead with the **efficacy loop** ("know exactly where your child stands — without testing them — and watch the numbers move") and "am I doing enough?, answered weekly with evidence"; before/after worksheet + metric screenshot as hero proof; anchor price against curriculum spend ($300–800/yr); connector features as the "more than a planner" section; samples, privacy story, FAQ, conference landing page | L | |
| M4-08 ⛔ | Support loop: help docs, in-app contact, Sidney's triage inbox | M | |
| M4-09 | Runbooks in `planning/runbooks/` (incident, refund, deletion request, model outage) — agent-legible | M | Software-factory groundwork |
| M4-10 | Load/cost dry-run: synthetic 100-family week; verify $/family and job fan-out | M | |
| M4-11 ⛔ | Alessa migration + parity sign-off (J8) — import script + her daily use for 2 weeks | L | The launch gate |

## M5 — Post-launch fast-follows

| ID | Ticket | Size | Notes |
|---|---|---|---|
| M5-01 | Entity/EIN → A2P 10DLC registration → SMS channel (eve Twilio) | L | Weeks of carrier lead time — start paperwork early |
| M5-02 | WhatsApp channel | M | Watch Meta Oct 2026 pricing |
| M5-03 | Per-state deep compliance templates (by customer demand) | M each | ArborSlate model |
| M5-04 | Email triage/Google integration re-imagined with scoped OAuth (never full-account) | XL | Was cut from v1 |
| M5-05 | Sibling/co-op sharing, curriculum marketplace, printed-binder mail service | — | Icebox |
| M5-06 | ~~Age-range expansion~~ **PULLED FORWARD per D3 ("boil the ocean")**: 8–12 benchmarks + questionnaire + materials track, agent-built in parallel with the cohort weeks; same citation-backed rigor as the 2–7 core before it fronts families; teen track follows | XL | D3 decided 2026-07-03 |
| M5-07 | Homa-template repo: archive gracefully (closed decision) — README pointing to cloud | S | |
| M5-08 | **Co-op finder**: local co-op discovery per metro/state (directory data + web research) | M | Connector layer (Alessa) |
| M5-09 | **Homa moms network**: opt-in local connection between Homa families (same metro, similar-age kids) — the network-effect moat | XL | Big feature, big trust design; post-traction |

## Sequencing logic

M0 de-risks the two novel bets (eve tenancy, sandbox generation) before any real code.
M1 is boring-but-blocking SaaS plumbing. M2 ports the proven domain system — highest
reuse, highest value. M3 adds the compounding loops + the compliance table stakes.
M4 is everything "public self-serve" implies that a design-partner pilot would have let
us skip. Rough solo+agents wall-clock: **M0 ~2 wks, M1 ~3 wks, M2 ~4 wks, M3 ~3 wks,
M4 ~3 wks → ~3.5–4 months to public launch**, SMS following. (Estimates, not promises;
M0 outcomes can move everything.)

## MJ — Journey-derived tickets (reconciled 2026-07-02)

Thirty-three tickets surfaced by the nine PM journey workstreams, renumbered globally
in **journeys/10-reconciliation.md §2** (authoritative index with origins, tiers, sizes).
Summary: **MJ-01…MJ-14 are [M-R] launch-set additions** (print preflight, routing undo,
crisis playbook, PWA, drip scheduler, generation status, out-of-range kids, event
registry CI, invites, SLA, feedback reasons, dispute flow, sensitive-context law,
founder dashboard). MJ-15…MJ-30 are [GA]; MJ-31…MJ-33 [POST-GA]. Process laws ratified
alongside them (no-events-no-merge, sibling-comparison ban, distress-data firewall,
anti-guilt ratio, temporal-never-causal claims) live in journeys/10 §3.
