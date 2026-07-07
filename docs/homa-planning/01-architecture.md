# Homa Cloud — Architecture (working draft)

> Supersession note (2026-07-06, build-log): $29 and $29 to $49 plan prices
> below are the retired placeholder. Pricing v1 is Homa $19/mo or $99/yr and
> Homa Pro $49/mo, live in Stripe both environments. Competitor prices quoted
> in this doc are facts and stand. Allotments still derive at day 60 (T2).

> Status: PLANNING. Decisions here are "current best answer," each with confidence noted.
> The M0 eve tenancy spike can overturn the Engine section. Last updated 2026-07-02.

## Shape of the system

```
                        ┌─────────────────────────────────────────────┐
                        │              Vercel (one team)              │
                        │                                             │
  Mom's browser ───────▶│  homa-web (Next.js)                         │
   · chat + voice notes │   · marketing site + app dashboard          │
   · dashboard          │   · auth, billing, onboarding UI            │
   · worksheet library  │   · admin/fleet console (Sidney only)       │
                        │            │                                │
                        │            ▼                                │
                        │  homa-agent (eve)                           │
                        │   · instructions + skills (ported)          │
                        │   · tools (profile CRUD, artifact gen, …)   │
                        │   · schedules (cron loops)                  │
                        │   · channels: web (v1) → twilio (v2)        │
                        │   · Workflows = durable sessions            │
                        │            │                                │
                        │            ▼                                │
                        │  Vercel Sandbox (per-job or per-family)     │
                        │   · Python generators (reportlab, PDFs)     │
                        │   · fal.ai image calls                      │
                        │                                             │
                        │  AI Gateway ── model routing + per-tenant   │
                        │               cost telemetry                │
                        └───────┬──────────────┬──────────────┬───────┘
                                │              │              │
                        Postgres (Supabase)  Vercel Blob   Stripe
                          tenant + profile  PDFs, images,  billing
                          + event data      artifacts
```

## Tenancy model (the load-bearing decision)

> Researched 2026-07-02 against eve 0.19.0's bundled docs (`docs/patterns/multi-tenant-auth.md`,
> `multi-tenant-memory.md`, `dynamic-scheduling.md`, `sandbox.mdx`,
> `concepts/execution-model-and-durability.md`, `guides/frontend/nextjs.mdx`).
> This is eve's *documented* multi-tenant design, not our invention.

**There is no fleet of instances. One Vercel project. One eve agent definition. One
deployment serves every family.** Concretely:

- **One project, one deploy:** `withEve()` in `next.config.ts` ships the Next.js web app
  and the eve agent runtime as a single Vercel project — same origin, no CORS, cookie
  auth flows straight through. homa-web and homa-agent are one deployable.
- **A family is a tenant principal, not an instance.** The eve channel's route auth
  (`AuthFn`) validates our app session/JWT and stamps `{ principalId: userId,
  attributes: { familyId } }` onto the session. Every tool reads the family from
  `ctx.session.auth.current` — never from model output. This is eve's documented
  `requireTenantCaller` pattern; the model physically cannot address another family.
- **A family's continuity is its durable session + Postgres record — NOT the sandbox.**
  (Corrected per source-code findings, 07: session sandbox names are deployment-scoped,
  so every deploy orphans `/workspace`; the earlier "family's computer in the cloud"
  framing is dead.) Sessions provide conversational continuity (history, parking,
  resume); Postgres provides all durable state; sandboxes are per-job scratch seeded
  from prewarmed templates — chat turns don't need one at all.
- **Memory** follows eve's multi-tenant memory pattern: dynamic instructions on
  `turn.started` load that family's memories from Postgres (scoped by
  `familyId` + `userId`); `remember`/`forget` tools write back. `defineState` is
  session-scoped only — anything cross-session lives in Postgres (as planned).
- **Per-family scheduling** follows eve's dynamic-scheduling pattern: schedule *rows* in
  Postgres (weekly scoring, journal prompt per family, in the family's timezone), ONE
  authored dispatcher cron that atomically leases due rows and fans out via
  `receive(channel, { auth: familyPrincipal })` — each row becomes a normal durable
  session running as that family. At-least-once delivery; jobs must be idempotent.
- **Data boundary** — Postgres rows scoped by `family_id`; Blob paths
  `families/{familyId}/…`; sandbox instances are per-session, so per-family by
  construction.

**Fleet management is therefore:** tenant rows in our database + an admin console, not
VMs. One `vercel deploy` updates every family at once — eve documents that existing
durable sessions adopt the new deployment's instructions/model/tools on their next turn
while keeping conversation history. Staged rollouts via Vercel Rolling Releases;
per-family kill switch is an app-level flag; observability via the Agent Runs dashboard
(note: currently team-gated — request enablement), OpenTelemetry export
(Braintrust/Datadog), and our own events table.

Explicitly rejected: instance-per-family (the OpenClaw/Hermes model — per-tenant VMs,
warm pools, orchestration; solo-founder-hostile) and project-per-family on Vercel (a
thousand deployments to upgrade, no shared session infrastructure, fights eve's design).

**Session topology (decided, research-backed — see compaction findings in
`05-vercel-platform-facts.md`):** sessions are **deliberately rotated** (weekly, or at a
turn/event threshold), not one eternal session per family. Rationale: (a) 2026 research
on auto-compaction shows summarize-and-replace loses ~77% of named entities and silently
drops standing behavioral constraints ("governance decay" — violations jump 0%→30% after
compaction); (b) Workflow runs cap at 25K events anyway. The design that makes rotation
free: **nothing load-bearing lives in conversation history.** Family profile, what-works,
memories, and behavior rules are re-injected every turn via dynamic instructions
(`defineDynamic` on `turn.started`) — which eve prepends outside compactable history, the
literal "constraint pinning" mitigation from the research — and every durable fact is
written to Postgres by a tool the moment it's learned. A fresh session with the same
Postgres memory behaves identically. Set `compaction.thresholdPercent` ≈ 0.75 (research
recommendation) rather than the 0.9 default for turns within a session's lifetime.
Schedule-spawned sessions (scoring, weekly plan) are ephemeral by nature and share family
state through Postgres. Client persistence contract (from the frontend
docs): our DB keeps one conversation row per family chat holding the full
`SessionState` cursor (`sessionId`, `continuationToken`, `streamIndex`) **plus** the
ordered event log for rendering history; `useEveAgent` rehydrates from
`initialSession`/`initialEvents`, and events persist via `onEvent`/`onFinish`. Note
`defineState` is session-scoped working memory only — anything that must outlive a
session (profile, memory, what-works) lives in Postgres, which also makes session
rollover safe.

## Verified eve facts that shape this design (full docs read, v0.19.0, 2026-07-02)

- **Per-session token budgets are built in.** `limits.maxInputTokensPerSession` /
  `maxOutputTokensPerSession` hard-stop a runaway session
  (`SESSION_TOKEN_LIMIT_REACHED`); defaults 40M in / unset out. This is a free cost
  guardrail per family session — set it deliberately.
- **Compaction is built in** (summarizes old turns at 90% of context by default,
  tunable) and preserves the framework todo list across summaries. Long-lived
  per-family sessions are a supported shape, not a hack.
- **Model mix maps to subagents.** The root agent has one model, but each declared
  subagent sets its own (`agent/subagents/<id>/agent.ts`). So: root chat agent on a
  mid-tier model; a `worksheet-maker` subagent with its own sandbox + generator
  scripts; a `scorer` subagent on a cheap model. Deploys swap models fleet-wide —
  existing sessions adopt the new deployment on their next turn.
- **Sandbox templates are prewarmed at build.** `bootstrap()` (install Python,
  reportlab, fonts) runs once per template and is cached across deploys; sessions
  start from the warm template with `agent/sandbox/workspace/**` + skills seeded into
  `/workspace`. Worksheet-generation latency is a solved problem if we bake deps into
  bootstrap. **Build fails if prewarm fails** — good, keeps it honest.
- **Sandbox `/workspace` is SCRATCH, never storage (verified in eve source).** Session
  sandbox names embed the `VERCEL_DEPLOYMENT_ID` scope — every production deploy points
  existing sessions at a fresh sandbox; prior workspace contents are orphaned. Law:
  generated artifacts upload to Blob before the turn ends; family state lives in
  Postgres. (Templates survive deploys; session filesystems don't. See
  07-deep-research-notes.md.)
- **Compaction is aggressively lossy (verified in eve source).** Older messages are
  truncated to 280 chars and tool results squashed to stubs BEFORE summarization.
  Reinforces: capture facts to Postgres at the turn they occur. Also verified:
  `compaction.model` is separately configurable — set it to a cheap model.
- **Sandbox egress must be locked down by us.** Default is `allow-all`; we ship
  `deny-all` + allowlist (fal.ai etc.), and **credential brokering** injects the fal
  API key at the firewall so secrets never enter the sandbox.
- **HITL parks durably.** Tool `approval` policies and the built-in `ask_question`
  park a session at `session.waiting` for seconds or days and resume exactly there —
  this is the mechanism for the resumable onboarding questionnaire and any
  "approve before sending" flows. Approval policies can also auto-deny cross-tenant
  input (`multi-tenant-approvals` pattern) — defense in depth on top of tool scoping.
- **Schedule-dispatched turns carry the app principal** (`eve:app`/`runtime`); the
  documented policy pattern skips approvals for automated turns while still prompting
  humans — but scheduled side effects then need idempotency keys (use
  `sessionId:turnId`).
- **Built-in `web_search`/`web_fetch` tools** — the nightly benchmark-research job
  needs no extra plumbing.
- **Evals are first-class** (`evals/*.eval.ts`, `eve eval --strict` in CI, LLM-judge,
  `mockModel` for deterministic fixtures, Braintrust reporter, dev-only
  `dispatchSchedule` for testing cron jobs). This substantially upgrades the
  solo-founder "software factory": tenancy isolation tests, skill regression tests,
  and schedule tests all run against the real HTTP surface.
- **Known beta friction (plan around it):** Vercel Connect is *private beta* (Slack
  channel depends on it — we don't need Slack, so low impact); the Agent Runs
  dashboard is team-gated; deploys currently need
  `VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1`; `eve dev` never fires schedules on cron
  (use the dev dispatch route); **the Twilio channel does not support inbound media
  attachments today** — moms texting photos of worksheets over SMS/WhatsApp won't
  work until that lands, which strengthens web-chat-first (web `send()` accepts file
  parts as data URLs, including PDFs/images).
- **No inbound message queue, confirmed at the contract level:** one turn at a time
  per session, one active continuation token, stale tokens rejected, burst deliveries
  drained best-effort. The web app keeps a tiny per-conversation send queue and gates
  the composer on `session.waiting` (the `useEveAgent` hook's `status` already does
  this for the UI; the queue matters for journal-prompt email replies and any
  channel-originated bursts).

## State model

**Do we need our own database for conversation history, or does Vercel already store it?**
Answered with platform facts (see `05-vercel-platform-facts.md`): eve sessions live in
Vercel Workflow storage, which is built for *durability and replay*, not for being your
product's chat-history database. Three hard reasons we keep our own Postgres record:

1. **Retention:** Workflow data is retained only **7 days after a run completes** on Pro.
   A mom scrolling back to "that phonics plan from March" needs our store.
2. **Run limits:** 25,000 events / 10,000 steps per run means sessions get rotated;
   history must survive rotation somewhere that isn't the session.
3. **Cost + queryability:** retained workflow data bills at $0.50/GB-month and isn't
   queryable ("show me all worksheets about dinosaurs") — Postgres rows are.

So the division of labor is: **Workflow owns the live durable session** (resume, parking,
streaming, crash recovery — we never reimplement that); **Postgres owns the permanent
record** (messages/events per conversation for rendering history, plus all domain data).
The web app persists stream events as they arrive (`onEvent`/`onFinish`) alongside the
`SessionState` cursor — exactly the pattern eve's own frontend docs prescribe for
database-backed chat apps.

Two stores, mirroring the proven "JSON truth / rendered views" pattern:

| Store | Holds | Mac Mini equivalent |
|---|---|---|
| **Postgres** | families, users, children, **child profile JSON** (jsonb), journal entries, compliance/hours log, observations, interventions, artifact metadata, event log, cron run log | `children/*.json`, `journal.jsonl`, `learning-journal.jsonl`, `profile-history/`, `operations/` |
| **Blob** | generated PDFs/worksheets, images, voice-note audio, rendered reports | `content/curriculum/**/worksheets/`, vault attachments |

Shared (global, not per-tenant) content:

- **Benchmarks library** — one copy, versioned in the repo, refreshed by ONE nightly
  research job for all families (huge cost win vs per-family research; per-child notes
  live in the profile, not the benchmark).
- **Activities library** (76+ activity specs), **practice library**, **questionnaire bank**.

The Obsidian vault does not exist in cloud v1. Its job (mom-facing compiled view) is done
by the web dashboard; its "binder" job is done by the worksheet library + print-ready PDFs.
An "export my data" bundle (markdown + JSON + PDFs) replaces vault portability. *(Also our
answer to trust/lock-in questions.)*

Memory: eve has no MEMORY.md convention. Port the layered model explicitly —
per-family `memory` rows (daily notes, curated long-term facts, `what_works` per child)
loaded into context by a `recall` tool + session-start hook.

## Compute model

| Workload | Where | Notes |
|---|---|---|
| Chat turns | eve on Fluid Compute (Workflows) | Durable, resumable; streaming to web UI |
| Worksheet/PDF generation | Vercel Sandbox (ephemeral per job, seeded with generator scripts + fonts) | Python + reportlab ports as-is; fal.ai for art |
| Voice transcription | Function calling Whisper (or Gateway equivalent) | Web app records; no ffmpeg chunking needed for short notes |
| Scheduled loops | eve `schedules/` → Vercel Cron → fan-out via Queues/Workflows per family | See loop table below |
| Global research | Single nightly job, not per family | Writes to shared benchmarks |

Scheduled loops (ported from the 10 Mac Mini crons, re-costed for N families):

| Loop | Mac Mini | Cloud v1 |
|---|---|---|
| Ambient learning (30-min Slack sweep) | per family, LLM | **Dropped** — web chat turns update the profile inline; no channel to sweep |
| Journal prompt (8pm) | Slack post | Email/push notification with one-tap reply into web chat |
| Weekly scoring (Sat) | per family, LLM | Per family, batched, cheap-model first pass + premium scoring |
| Nightly benchmark research | per family | **Global**, once |
| Weekly plan | per family | Per family, on-demand + scheduled |
| Dashboard regen | per family | Rendered live from Postgres — no regen step |
| Doctor/janitor | per machine | Fleet health job + admin console (see Ops) |
| Email triage | Alessa's Gmail | **Cut from v1** (personal-Gmail model can't ship multi-tenant) |

## Model strategy & cost

Mac Mini runs Opus-class for everything; at $29–49/mo that's unaffordable per family.
Route through AI Gateway with a tiered mix (chat/capture on a fast-cheap model,
scoring/curriculum on a mid model, escalation on demand), fallbacks configured.
Target: <20% of subscription price in model cost at P50 usage.

**Per-family cost attribution is a built-in, not a build** (researched — see
`05-vercel-platform-facts.md`): AI Gateway is zero-markup on tokens and its Custom
Reporting API accepts a `user` id and `tags` on every request via plain HTTP headers
(`ai-reporting-user: <familyId>`, `ai-reporting-tags: chat|scoring|worksheet`), queryable
by `GET /v1/report` / `getSpendReport()` — cost, tokens, request counts per family, per
feature, per model. Gateway **budget quotas per API key** (USD cap + refresh period) plus
eve's per-session token limits give two independent cost-runaway guardrails. The admin
console's unit-economics view is a thin UI over this API.

## Channels

- **v1: web chat** (with first-class voice notes — record → Whisper → agent). Proactive
  outbound = transactional email (Resend) + web push.
- **v2: SMS via Twilio channel** (eve ships it). Requires entity + A2P 10DLC registration —
  start paperwork when entity exists; weeks of carrier lead time.
- **v2/v3: WhatsApp** (same Twilio channel; watch Meta's Oct 2026 service-message pricing).
- **Not offered:** Slack (the Mac Mini keeps it; cloud customers shouldn't need it).

## Solo-founder ops (the "productize Sidney" layer)

- **Observability:** Vercel Observability + eve Agent Runs (per-session traces, token
  usage) out of the box; Sentry for web app errors; AI Gateway for cost anomalies.
- **Fleet doctor (cloud descendant of `doctor.py`):** nightly job scoring every family —
  onboarding completeness, profile staleness, failed jobs, stuck sessions, cost outliers —
  written to an `ops_findings` table, surfaced in the admin console, alerting to
  Sidney via email/Slack when severity ≥ high.
- **Admin console** in homa-web: family list w/ health + usage, session inspector
  (privacy-gated), artifact browser, cron run history, refund/comps actions.
- **Agent-assisted ops:** the repo itself stays agent-legible (this planning folder,
  typed events, runbooks in `planning/runbooks/`) so Cursor agents can diagnose
  production issues from telemetry — the "software factory" goal.
- **Safety rails:** kill-switch per family, per-loop feature flags, staged rollouts
  (Vercel Rolling Releases).

## Security & privacy notes (children's data — take seriously)

- All data is about minors ⇒ COPPA-adjacent posture even though the *user* is the parent:
  clear privacy policy, no training on customer data, encryption at rest (Supabase
  default), strict tenant scoping (tested) **plus Postgres Row-Level Security policies on
  `family_id` as a database-enforced second wall**, data export + deletion self-serve.
- No third-party OAuth grants in v1 (no Gmail/Calendar) — removes the scariest surface.
- Model calls via Gateway with zero-data-retention providers where available.

## Fallback plan

If the eve spike fails on tenancy or beta churn is intolerable: same architecture, replace
the eve layer with a custom harness on **AI SDK + Workflow SDK + Sandbox + AI Gateway**
(the primitives eve composes). Tools, prompts, skills, schedules, and all data models are
designed to be eve-independent so the swap is contained to the harness layer.

## Open questions to resolve in M0

1. ~~eve per-tenant sandbox semantics~~ **Resolved by docs research (2026-07-02):**
   sandboxes are per-durable-session with persistent `/workspace`; tenancy via route-auth
   principals is eve's documented pattern (see Tenancy section). Spike M0-01 now *verifies
   behavior* — session longevity/compaction over weeks, sandbox resume latency + snapshot
   cost, dispatcher fan-out at 100+ families — rather than discovering the model.
2. eve session ↔ our auth: continuation-token custody per family conversation lives in our
   DB; eve is one-turn-at-a-time per session with no durable inbound message queue, so the
   app layer needs a per-family send queue (hold messages until `session.waiting`) — spike.
3. Voice notes: browser MediaRecorder quality/limits on mobile Safari (moms are on phones).
4. Worksheet fonts/licensing (bundled TTFs in template — verify redistribution rights).
5. ~~Neon vs Supabase~~ **Decided: Supabase** (Sidney, 2026-07-02). RLS on `family_id`
   from the first migration; Supavisor pooling for Fluid Compute; Supabase Auth becomes
   the default candidate for Q3.
6. Pricing validation at the homeschool conference (Alessa's field research).
