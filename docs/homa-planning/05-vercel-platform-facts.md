# Vercel Platform Facts (researched 2026-07-02)

> Historical provider research snapshot. Prices, limits, beta status, storage
> recommendations, and eve behavior were observed or inferred on 2026-07-02.
> They are not current provider, repository, or production evidence. Re-verify
> against official sources and the deployed environment before reuse. Durable
> engineering laws extracted from this research live in `BUILD.md`.

> Every number below comes from Vercel's own docs/pricing pages or the eve 0.19.0 bundled
> docs, pulled today. This is the reference sheet for cost modeling and capacity planning.
> Re-verify before launch : several products are beta and prices move.

## How eve bills (official framing)

eve itself is free (Apache-2.0). An eve deployment is billed through the Vercel resources
it composes: **Functions** (routes, tool execution), **Workflows** (durable sessions),
**Sandbox** (isolated execution), **AI Gateway/model providers** (tokens). Vercel's own
eve pricing page recommends estimating from one representative task: turns per session,
model+tool calls per turn, tokens per call, data streamed, sandbox usage : then mapping to
the tables below. Agent Runs gives those measurements per session.

## Vercel Sandbox (per-family compute for generation jobs)

| Metric | Pro price | Notes |
|---|---|---|
| Active CPU | $0.128/hr | I/O wait NOT billed |
| Provisioned memory | $0.0212/GB-hr | 2 GB per vCPU, 1-min minimum increments |
| Creations | $0.60 / 1M | effectively free |
| Data transfer | $0.15/GB | package installs count : prewarmed templates avoid this |
| Snapshot storage | $0.08/GB-month | persistent sandboxes auto-snapshot on stop |

Limits (Pro): **2,000 concurrent sandboxes**, 24 h max session, 8 vCPU / 16 GB max,
32 GB NVMe disk, **200 vCPUs/min creation rate** (= 100 × 2-vCPU sandboxes per minute :
bounds how fast the weekly-scoring fan-out can go), 10,000 control-plane req/min,
snapshots expire 30 days after last use (configurable), **iad1 region only** today.

**Worksheet-job cost reality check:** a 5-minute 2-vCPU generation job ≈ $0.03 ceiling
(assumes 100% CPU; real cost lower since fal.ai calls are I/O). 30 worksheets/family/mo
≈ **<$1/family/mo of sandbox compute**. Persistent per-family sandbox snapshots at, say,
2 GB = $0.16/family/mo. Sandbox is not the cost problem; tokens are.

## Vercel Workflows (what makes eve sessions durable)

| Resource | Pro | Notes |
|---|---|---|
| Workflow Events | $0.02 / 1K | every step input/output/stream chunk is an event |
| Data Written | $0.50/GB | streamed output counts |
| Data Retained | $0.50/GB-month | **retention after run completion: 7 days on Pro** (30 Enterprise) |

Run limits that matter to us: **25,000 events per run** and 10,000 steps per run
(a months-long single session would hit this : supports the session-rotation design),
50 MB max payload, 2 GB max storage per run, **no limit on run duration or sleep** (a
parked session can wait indefinitely), up to 100k concurrency.

## Vercel Queues (behind Workflows; also usable directly)

Public beta (Feb 27, 2026). $0.60/1M operations, metered in 4 KiB chunks; idempotent
sends billed 2×. Retention 60 s–7 d. At-least-once, approximate ordering (not strict
FIFO). Powers Workflows automatically : we likely never touch it directly, but it's the
delivery guarantee under the dispatcher pattern.

## Cron Jobs

**100 cron jobs per project on every plan** (Jan 2026 change), per-minute precision on
Pro. Our design needs ~5 (minute-level dispatcher + a few fixed jobs) : no constraint.

## Vercel Functions / Fluid Compute (the app + agent routes)

Active CPU pricing (~$0.128/hr + $0.0106/GB-hr provisioned memory + $0.60/1M
invocations); instances reused across concurrent requests; 300 s default / up to 30 min
max duration (Pro, beta above 800 s); Node 24 default. Pro plan = $20/user/mo with $20
usage credit, then pay-as-you-go with Spend Management alerts/auto-pause.

## AI Gateway (models + fleet cost telemetry)

- **Zero markup** on tokens (provider list price). BYOK supported at no fee (paid tier),
  with automatic fallback to system credentials if our key fails.
- **Custom Reporting (beta, Pro+):** attach only `tags` (= feature: chat / scoring /
  worksheet) per request. Query spend and tokens by tag or model via `GET /v1/report`.
  Cost: $0.075/1K metadata writes, $5/1K report queries. Per-family unit economics
  come from Homa's local `public.model_usage` ledger so account deletion can erase the
  family identifier. Gateway reporting reconciles fleet and feature totals without
  receiving the raw family UUID.
- **Budgets/quotas:** spending caps per API key (`limitAmount` USD + daily/weekly/monthly
  refresh). Combined with eve's per-session token limits = two layers of cost guardrails.
- Optional paid add-ons: provider allowlist, zero-data-retention enforcement (relevant to
  the children's-data posture) at ~$0.10/1K requests.

## Vercel Blob (worksheet PDFs, voice notes, images)

Storage ~$0.023/GB-mo; data transfer ~$0.05/GB (iad1); simple ops $0.40/1M; advanced ops
(put/copy/list) $5/1M; deletes free; 512 MB max cacheable blob; 5 TB max file; public and
**private** stores (private = served through a Function : right choice for family
artifacts); client uploads avoid double transfer (use for voice notes). Worked example in
docs: 120K uploads + 50 GB stored + 2.5M downloads ≈ $16/mo : our scale is far below that.

## Postgres: Neon vs Supabase (decision input)

| | Neon | Supabase |
|---|---|---|
| Vercel story | Powers "Vercel Postgres" natively; Marketplace; **billed through Vercel**; branch-per-preview-deploy | Marketplace integration; own dashboard/billing gravity |
| Model | Usage-based; scale-to-zero; ~$19/mo Launch (300 compute-hrs, 10 GB) | $25/mo Pro flat + usage; bundles Auth/Storage/Realtime/Edge Functions |
| Branching | First-class copy-on-write (test migrations on a branch) | Limited |
| Extras we'd use | None needed : eve is the backend, Blob is storage, auth is Clerk/Auth.js | Its bundled Auth/Storage duplicate what we already get elsewhere |

**Decision (Sidney, 2026-07-02): Supabase.** My initial lean was Neon on
minimal-surface grounds, but Supabase won on founder preference plus real advantages for
this product:

- **Row-Level Security as a second tenant wall:** Postgres-enforced `family_id` policies
  underneath the app-layer scoping : defense in depth for children's data, enforced by
  the database even if application code has a bug.
- **Supabase Auth is bundled** : a live candidate to answer Q3 (auth provider) with
  zero extra vendors; unlimited MAU on Pro.
- **Supabase MCP is already connected in Sidney's Cursor workspace** : direct
  agent-assisted DB ops/debugging fits the "software factory" ops model today.
- **Realtime** (Postgres changes over websockets) is a free upgrade path for live
  dashboard updates without polling.
- Storage also bundled; default plan remains Vercel Blob for artifacts (sandbox/function
  adjacency), revisit only if Blob economics disappoint.

Costs: $25/mo Pro flat + usage; no scale-to-zero (irrelevant at product scale : the DB
should never be idle). Use Supavisor pooling with Fluid Compute functions; migration-based
preview environments instead of Neon's copy-on-write branches (mitigate with a staging
project + `supabase db` migrations in CI).

## Observability stack (solo-founder telemetry, all managed)

- **Agent Runs** (Vercel dashboard, gated : request enablement): per-session traces,
  turns, tools, token usage, powered by automatic `$eve.*` workflow run tags.
- **Workflow observability:** every step/sleep/error recorded automatically.
- **Observability Plus** ($1.20/1M events, on by default for new Pro teams): 30-day
  retention, queryable notebooks. Base retention without it is only 1 day on Pro.
- **AI Gateway reporting:** per-family cost (above).
- **OpenTelemetry export** from eve (`instrumentation.ts`) to Braintrust/Datadog if we
  outgrow the dashboard. Set `recordInputs/recordOutputs: false` for children's data.
- Gap to fill ourselves: product analytics + error tracking in homa-web (Sentry) and the
  fleet-doctor job (our domain health, not infra health).

## Long-session compaction: research findings (why session rotation is now design law)

eve compacts automatically at 90% of context (tunable via `compaction.thresholdPercent`).
Current research (2026) says lossy auto-compaction is a real hazard for a months-long
"main session" pattern:

- **Governance decay** (arXiv 2606.22528): compaction drops standing constraints from
  history : constraint-violation rates jump from 0% to ~30% after compaction; soft
  policies (exactly our "never alarm-frame delays," "always read what-works first")
  decay 8.3× more than hard safety norms. Mitigation: **constraint pinning** : keep
  policies out of compactable history.
- Production measurements: standard summarize-and-replace compaction loses **~77% of
  named entities** (people, dates, decisions); practitioners recommend compacting early
  (~70–75%), structured summary templates, and **external memory as the source of truth
  for durable facts, never the compaction summary**.

**How this maps to our architecture (already mostly aligned, now explicit):**

1. **Instructions are immune to compaction by construction.** eve prepends
   `instructions.md` + dynamic instructions to *every* model call : they are not part of
   compactable history. Loading the family profile, what-works, and behavior rules via
   `defineDynamic` on `turn.started` **is** constraint pinning. Never rely on the
   conversation remembering a rule or a fact.
2. **Postgres is the memory; the session is just a conversation.** Everything durable
   (profile, observations, hours, memories) is written to the DB by tools at the moment
   it's learned : the compaction summary is allowed to be lossy because nothing
   load-bearing lives only in history.
3. **Rotate sessions deliberately** (e.g., weekly or at N turns) rather than betting on
   one eternal session: fresh session, same memory, plus it stays inside the 25K
   events/run Workflow limit. Set `compaction.thresholdPercent` ≈ 0.75, not the 0.9
   default.
