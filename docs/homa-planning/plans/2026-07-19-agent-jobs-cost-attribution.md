# Agent-jobs cost attribution: wire per-stage spend into the paywall/credits substrate

> Design note, 2026-07-19. Author: fleet coding agent. Status: source settled
> by investigation (§1). Plumbing approved and shipping (§3). Pricing posture
> DECIDED by founder 2026-07-19: **option A, plan-included and monitored** (§4).
> No family-facing metering or cap is built; agent-jobs spend is attributed and
> surfaced for the margin review, exactly as scoring and research already are.

## 0. Why this exists

Agent-jobs shipped LIVE to prod on 2026-07-18 (flag `HOMA_AGENT_JOBS_ENABLED`
on). The whole primitive deliberately dropped hard per-family ceilings: the
2026-07-13 "more agentic" ruling removed `web_fetch`'s daily read budget on the
explicit basis that "usage cost is a paywall and credit-metering concern, not a
hard-coded ceiling on reads" (`agent/tools/web_fetch.ts`). That trade only holds
if agent-jobs spend actually flows into the paywall/credits substrate. Today it
does not: a family can run a 200-stage build and the money layer cannot see it
as anything but ordinary web chat. This note settles the authoritative cost
source, designs the attribution plumbing, and puts the pricing posture in front
of the founder.

## 1. The authoritative cost source (settled by investigation)

**Verdict: `public.model_usage`, joined to a job's build sessions by
`session_id`, is the authoritative source. The typed `agent_job_stages`
metering columns are NOT authoritative and must not be the billing truth.**

The `agent_job_stages` migration comment claims its three typed columns are
"the billing truth for the credits/paywall rollup: typed, indexable, SUM-able
columns the wall prices from." That intent is sound; the columns as built are
not, for four independent reasons:

1. **They are model-supplied.** `sandbox_cpu_seconds`, `page_fetch_count`, and
   `model_tokens` arrive as optional args on `report_agent_job_stage`, which the
   build session (a model) fills in about itself. A model cannot accurately
   report its own token count, and the tool-honesty law is explicit that
   scoring and arithmetic never move into prose. Trusting these for billing
   would be trusting the meter to the thing being metered.
2. **They are never populated in practice.** `buildStageBrief`
   (`lib/jobs/session.ts`) never instructs the build session to report metering;
   the args are `.optional()`; so `recordStageBuilt` writes NULLs on essentially
   every stage.
3. **They are never read.** A full-tree search finds only the
   `report_agent_job_stage` input schema and the `runner.ts` writes. The
   `modelTokens` in `app/admin/page.tsx` and `lib/admin/overview-data.ts` is a
   different value derived from `model_usage`, not these columns. They are dead,
   write-only fields.
4. **Two of the three have no server ledger at all.** `web_fetch` is
   Firecrawl-backed and records nothing per fetch; there is no sandbox in the
   cloud runtime. So `page_fetch_count` and `sandbox_cpu_seconds` cannot be made
   authoritative without new instrumentation. Model tokens dominate agent-job
   cost anyway (a stage is a full eve session drafting and rendering a
   material), so token spend is the number that matters first.

By contrast, `model_usage` (migration #43) is the per-family consumption ledger:
one append-only row per model call, written server-side by
`agent/hooks/record-usage.ts` on every `step.completed`, with `family_id` and
`session_id` taken from session auth, never from model output. Every build
session runs authenticated as the family with a stable `session_id`, so its
model spend already lands in `model_usage` today. Prices join at read time via
`lib/model-pricing*.ts` (the ledger stores raw quantities only, because prices
drift). This is the substrate the whole credit system was always meant to price
against (the migration #43 header says so). Precedent for attributing spend by
`session_id` already exists: `lib/admin/sessions-data.ts` groups `model_usage`
by `session_id` and joins task runs by it; research runs persist their runtime
session id.

### 1.1 The two gaps that make agent-jobs spend invisible today

1. **Mislabelled.** The build session's turns record with
   `surface = 'chat'` and `channel = 'web'`, because
   `usageSurfaceFromAttributes` / `usageChannelFromAttributes` do not recognise
   `channel = 'agent-job'`. Agent-jobs model spend is therefore
   indistinguishable from ordinary chat, even at the family level.
2. **No job/stage key, and image spend is unattributed.** `agent_jobs.session_id`
   is the *parent's* session that called `start_agent_job`, not the per-stage
   build sessions the runner spawns. Nothing maps a `model_usage` row to a job
   or stage. Worse, the dominant material cost, image generation and artifact
   review (`lib/materials/generate-image.ts`, `lib/materials/review-artifact.ts`),
   records `model_usage` with `session_id = NULL`: those call sites never pass a
   session id. So even a session-scoped rollup would miss the biggest line item.

## 2. What "attribute per-stage cost to the family" requires

To produce a correct, complete agent-jobs COGS per family, spend must be keyed
to the job at the point it is recorded, and the rollup must sum every model call
a stage caused (chat turns AND nested image/review calls). The design:

- **Key = the build session's `session_id`.** It already scopes a stage's chat
  turns, it is the house pattern, and it needs no job-specific columns in the
  generic ledger. The one thing missing is that image/review spend does not yet
  carry it. We thread it in (§3.2). This is a general fix: it also makes
  materials image spend visible to the existing sessions view, which today
  cannot see it.
- **Map = a per-stage `build_session_id`.** Stamped when a stage successfully
  reports (the billable build). Failed retry attempts that never report are
  intentionally excluded: we do not charge a family for our own retry waste.
- **Rollup = read-time.** `SUM` over `model_usage` where `session_id` matches a
  family's stage build sessions, priced through the live price book. Read-time
  avoids every write-time timing race; the money layer asks whenever it needs a
  number.

## 3. The plumbing this PR ships (posture-independent, safe under every §4 option)

### 3.1 Label agent-job model spend (no migration)

Add `"agent_job"` to `USAGE_SURFACES` and branch `usageSurfaceFromAttributes` to
return it when `channel === 'agent-job'`. `surface` is free text validated only
by the TypeScript union (migration #43 header), so no schema change is needed.
This makes the build session's own turns sliceable and readable in the console.
(`channel` stays `'web'`; changing the `channel` CHECK is a migration for no
rollup benefit, since we roll up by `session_id`, not channel.)

### 3.2 Make material spend session-attributable (no migration)

Thread an optional `sessionId` through the two material call sites so their
`recordModelUsage` rows carry the build (or chat) session id:

- `agent/tools/generate_image.ts` passes `ctx.session.id` to `generateStudioImage`.
- `agent/tools/create_printable.ts` passes `ctx.session.id` to `reviewArtifact`.
- `lib/materials/generate-image.ts` and `lib/materials/review-artifact.ts` accept
  `sessionId?` and forward it to `recordModelUsage`.

Null-safe for every non-agent-job caller; a strict improvement to attribution
generally.

### 3.3 Persist the build session per stage (additive migration)

Add nullable `build_session_id text` to `agent_job_stages`. Stamp it in
`recordStageBuilt` from the reporting build session's `ctx.session.id`, threaded
through `report_agent_job_stage` and `completeStageFromWorker`. Additive only,
safe to lead the deploy. The migration also adds a column comment retiring the
three model-supplied metering columns as non-authoritative, so no future reader
mistakes them for billing truth.

### 3.4 The queryable per-family rollup

New `lib/jobs/spend.ts`: `familyAgentJobsSpend(familyId, { since?, until? })`
joins `model_usage` to the family's `agent_job_stages` by `build_session_id`,
groups by model, and prices via `summarizeUsageCost` against the live price
book. Returns estimated USD, unpriced models, token and call counts, and an
optional per-job breakdown. `familyId` is the authenticated caller's, never
model input; the query is explicitly family-scoped and passes
`pnpm check:isolation`.

### 3.5 Expose it

Surface a fleet agent-jobs COGS line in the founder console overview, and make
`familyAgentJobsSpend` available for the family deep view. This is the
"costed in telemetry" half of the plan-included policy (§4), and the input to
the monthly margin review the billing design already calls for.

### 3.6 What this PR does NOT do

No family-facing metering, no credit charge, no wall change, no hard cap, and no
change to `HOMA_WALL_ENABLED` behaviour. Those wait on §4.

## 4. Pricing posture: the founder decision

Homa has no credit ledger yet. The wall today is a binary Stripe Payment Link
trial gate (`trial_started_at`); the credits system (`credit_ledger`,
`chargeCredits`, the `action_costs` registry M1-12/M1-13) is an explicit
POST-REVENUE build (`08-billing-credits-design.md` §Sequencing). Critically, that
same design already rules on background loops:

> "Schedule-dispatched loops (scoring, research) are plan-included: costed in
> telemetry but not charged: subscription margin covers them, and the registry's
> monthly review keeps that honest."

Agent-jobs is exactly such a schedule-dispatched loop (`agent/schedules/agent-jobs.ts`,
a 5-minute claim-lease runner). So the standing policy already points at option
A. The three postures:

- **A. Plan-included and monitored (recommended, matches standing policy).**
  Attribute agent-jobs COGS per family (this PR), surface it in the console, feed
  the monthly margin review. No family-facing charge and no cap. The
  subscription covers it; the margin review catches an unprofitable family or a
  runaway job. Smallest, honest, and consistent with how scoring and research
  are already treated.
- **B. Plan-included, monitored, plus a soft high-spend alert / cooperative
  pause.** Everything in A, and when a family's rolling agent-jobs COGS crosses a
  founder-set threshold, flag it in the console and optionally have the runner
  cooperatively stop *starting new* jobs for that family pending founder review.
  Still no charge, no hard mid-job kill, honouring the grace-buffer / no-hard-cap
  law. This is the safety valve for the "we dropped the caps" trade if a single
  family's build spend is alarming before the credit ledger exists.
- **C. Meter agent-jobs as billable credits now.** Give a stage (or a whole job)
  an `action_costs` row, price it at COGS x 3.3, and decrement a family credit
  balance, gating new jobs for non-subscribers when exhausted. This is the real
  credit-metering answer, but it is the M1-12/M1-13 post-revenue build: it needs
  the credit ledger, a packaging decision (per-stage vs per-job vs token-based
  price, included allotment per plan), and Stripe wiring. Out of scope for
  plumbing; a multi-ticket effort.

**Recommendation: A now, with B's alert as a fast follow if the founder wants a
safety valve before the credit ledger lands. C is the eventual destination and
this PR's attribution is precisely the substrate it will price against.** The
plumbing in §3 is identical under all three, which is why it can proceed before
this decision is final.

**Founder decision (2026-07-19): option A.** Agent-jobs is treated like scoring
and research: costed in telemetry, not charged, subscription margin covers it,
the monthly margin review keeps it honest. This PR ships the §3 attribution and
console surface and stops there. B (soft alert / cooperative pause) and C (credit
metering) are explicitly deferred; B becomes the fast follow if a single family's
build spend looks alarming in the console before the credit ledger exists.

## 5. Risks and limitations (stated honestly)

- **Estimates, not invoices.** `model_usage` prices are monitoring-grade
  estimates; the AI Gateway invoice remains the source of truth
  (`model-pricing.ts`). Fine for margin monitoring and any internal cap;
  revisit if C ever bills a family directly.
- **Non-token cost is out of ledger.** Firecrawl page fetches and any future
  sandbox CPU are not in `model_usage`. If they ever become material, they need
  their own server-side counter; the model-supplied columns are not it.
- **Retry waste excluded by design.** Only the successfully-reporting build
  session is stamped, so abandoned retry attempts of the same stage are not
  counted. This is deliberate (do not bill our own retries) and slightly
  under-counts true fleet COGS; the margin review sees total fleet spend
  regardless.
- **Backfill.** Jobs built before this ships have no `build_session_id`, so
  historical per-job rollups are blank; family-level history is still
  approximable from `model_usage` once the `agent_job` surface exists going
  forward. No backfill is attempted.

## 6. Test plan

- Unit: `familyAgentJobsSpend` rollup (correct sum across chat + image + review
  rows for a family's stages; excludes other families; excludes unstamped
  retries; unpriced-model handling).
- Unit: `usageSurfaceFromAttributes` returns `agent_job` for the build channel
  and is unchanged for every other channel.
- Runner: `recordStageBuilt` / `completeStageFromWorker` stamp `build_session_id`.
- Guards: `pnpm check:isolation` (new cross-table family-scoped query),
  `pnpm typecheck`, `pnpm lint`, and `VERCEL=1 pnpm --filter web exec eve build`
  since agent tool modules change.
