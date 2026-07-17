# Morning research brief v2 implementation notes

## Replay status

Tasks 1 through 3 are reconstructed and locally verified in this isolated
worktree. The disposable PostgreSQL lifecycle suite covers 11 integrity and
lifecycle cases, including family-scoped task runs and feedback adult
attribution. It runs through the focused `check:research-brief` guard.

## Decisions preserved

- The v2 feature flag must be exactly `"true"`.
- The legacy path does not query v2 preparation or use tables.
- A citation label comes from an explicit source name or a narrowly allowlisted
  publication host. URLs are never rendered into the model context.
- The selector is deterministic and accepts only eligible rows. It leaves
  angle selection and writing to the filesystem research-brief skill.
- Remote schema rollout is a later, deliberate action. This replay never
  applies the migration.

## 2026-07-16 · Plan-confirmed

Task 4 replaced the microscope-led contract with a plain, 900-character,
ten-segment format and added a dispatch-only preparation tool. Preparation
re-scopes every id, requires a running v2 task, validates Unicode-aware whole
source and child names, and stages the exact draft without consuming evidence.

## 2026-07-16 · Discovery

An undelivered preparation is a reservation only while its task run is still
running. Terminal preparations remain as audit evidence but cannot block a
future run from using the same source. Preparation and Task 5 finalization
share one family/source advisory-lock identity and lock order.

## 2026-07-16 · Plan-confirmed

Task 5 makes the stored preparation the only deliverable text and finalizes
source use, source artifact, optional observation, run summary, and delivered
time atomically after confirmed delivery. Save-only work has a durable receipt.

## 2026-07-16 · Discovery

Transport acceptance and database finalization are separate crash boundaries.
Pending provider receipts stay uncertain rather than becoming false failures.
Stale recovery aggregates every destination, keeps loose-phone destinations
distinct, preserves partial outcomes, and cannot overwrite a run that finished
after the stale snapshot.

## 2026-07-16 · Plan-confirmed

Task 6 makes the fleet skill teach one named, source-backed finding and one
action-shaping detail for one child. Deterministic fixtures reject unsupported
sources, extrapolation, obvious-only advice, repetition, sibling mentions,
unmatched offers, and carrier overflow. Real Eve eval definitions cover
dispatch-positive and adjacent-negative routing.

## 2026-07-16 · Copy gates

The parent reader understood the child-specific evidence but stalled on
technical phonics terms and a vague artifact. Accepted fixes moved ordinary
skill language into the headline and CTA, made the sound pattern visible with
one example, and named what the offered strip contains.

The editor's objections to `What I learned:` and `Why it's interesting:` were
rejected because those exact labels remain a binding founder format. Accepted
editor fixes removed imperative teaching directions, unsupported product-style
causal wording, an invented child pronoun, and an unquoted marked evidence
word.

## 2026-07-16 · Plan-confirmed

Task 7 adds the bounded dispatch lane behind two exact flags. It skips generic
family and ChildProgress hydration, preserves fail-soft conversation
continuity, and attributes model usage to `morning_brief` only when dispatch,
family, task-run, and task-kind identity are all present.

## 2026-07-16 · Plan-confirmed

Task 8 separates causal offer outcomes from nearby activity. Yes/no and
approval loops resolve only from exact provider/signed delivery identity or
bounded polarity language. Admin metrics join the real task kind and show
accepted, declined, answered, sent, resolved, and possible-interest counts
without changing causal records.

## 2026-07-16 · Discovery

Resend's POST response id is not the RFC Message-ID used by email
`In-Reply-To`. Homa now retrieves the accepted email, stores its normalized RFC
Message-ID when available, and preserves accepted delivery plus the signed
reply alias when that retrieval is temporarily unavailable.

## 2026-07-16 · Plan-confirmed

Task 9 records one adult's explicit helpful or not-for-us response only for a
confirmed family-visible morning brief. The Tasks page loads only feedback
embedded with its bounded run list and shows accessible controls for done,
partial, partial-uncertain, SMS, email, and save-only outcomes.

## 2026-07-16 · Copy gates

The parent reader wanted a clear reason for the two choices. The accepted
prompt is `Was this research useful?`. The buttons remain `Helpful` and
`Not for us`. The error says what failed, reassures that nothing else changed,
and offers the exact tap to try again. The editor found no must-fix issue after
those changes.

## 2026-07-16 · Documentation as-built

Task 10 registered `morning-research-brief-v2` as the binding policy for named
sources, action-shaping non-obvious findings, a plain headline, one child and
angle, carrier-safe selection, deterministic novelty, prepared-draft delivery
truth, post-delivery effects, bounded context, and separated feedback signals.
It preserves the original four-block format, one to two sentence content
blocks, and one executable offer. The repository map now names the v2
selector, citation resolver, preparation tool, recovery lane, feedback,
semantic checks, migration, and focused commands.

## 2026-07-16 · As-built deviations and external gaps

- No Task 10 code deviation was needed. Documentation describes the current
  isolated worktree rather than claiming an integration result.
- The v2 migration remains local and unapplied remotely. Both v2 flags remain
  external rollout choices, not enabled facts.
- The paid research-brief craft judge is credential-gated and unrun. The
  remote isolation command cannot run here without the Supabase public URL and
  publishable key.
- Production has not received this worktree's prepared-draft, named-source
  path. The observed parent-facing generic-source and early-consumption failure
  remains open until an authorized integration, migration, guarded enablement,
  and complete live-morning verification occur.

## 2026-07-16 · Task 10 review correction

Fresh local runs passed `pnpm check:research-brief` and
`pnpm check:continuity` with 113 tests each. The three v2 guidance files now
have ordered manifest rows that classify them as pre-existing untracked,
in-progress, repository-only evidence with no shipped claim.

The review also clarified the rollout order. Reply resolution and admin
analytics access `conversation_open_loops.resolved_outcome` without either v2
flag, while the additive v2 migration owns that column. The repository allows
additive migrations to lead, so the safe order is migration plus isolation,
code-dark deployment plus legacy probes, exact-corpus refresh, slim sandbox,
v2 sandbox, then fleet. Rollback is flag-first and leaves the additive schema
intact. No migration, deployment, flag change, or other external rollout
happened in Task 10.

## 2026-07-16 · Final local fix wave

- The interrupted split PostgreSQL delivery suite had one missing closing test
  block. It is repaired and runs through the focused acceptance command.
- The prepared-brief helper moved from `agent/channels/` to
  `agent/research-brief-dispatch.ts`. Eve treats every module under
  `agent/channels/` as a deployable channel, so the helper's old location
  caused an Eve build failure even though its TypeScript tests passed.
- Preparation and canonical-persistence guards now expose the actual pinned
  version contract without unused environment arguments. A later flag flip
  cannot change a run's delivery lane.
- Shared-knowledge comments no longer describe a dispatch top-up path. The
  research channel is the only accepted fleet-corpus writer.
- Fresh focused v2 acceptance, research, Tasks UI, continuity, admin,
  agent-context, events, core, map, taxonomy, fleet-skill, chat UI,
  ChildProgress E2E, typecheck, lint, Next build, Eve build, stream guard,
  and diff checks are recorded in
  `.superpowers/sdd/morning-brief-v2-final-fix-report.md`.

Remote isolation still needs the public Supabase credentials. The paid craft
judge, remote migration, deployment, flag enablement, and live verification
remain external and unperformed.

## 2026-07-16 · Final high-confidence review closure

- Resend hard bounces now update the matched delivery and recompute the
  associated task run from recipient-grouped delivery truth. Email fallback
  can become failed, while another successful recipient keeps the run partial.
  A receipt that arrives before either durable provider-id row exists returns a
  retryable response and succeeds on a later webhook retry.
- Delivery retries clear both provider identifiers. Sent completion writes the
  current identifiers exactly. Delayed RFC Message-ID enrichment replaces the
  RFC id only while the durable Resend submission id still matches.
- The slim dispatch bundle now renders every dynamic child, fact, candidate,
  source, claim, observation, and trace field inside one JSON data object.
  Instruction-like newlines remain quoted data and citation URLs remain out.
- The rollout report is now a side-by-side, in-range comparison of the pinned
  `legacy` baseline and `research_brief_v2` treatment. It includes v2 failures
  without preparations, excludes unrelated task kinds, labels
  started-to-finished time as run latency, and keeps the three 800-second risk
  indicators.
- Same-morning corpus top-up is retired everywhere. Family dispatch cannot
  search for or save fleet knowledge. No candidate means no brief; nightly
  fleet demand handles the missing row. The validator accepts the overnight
  headline only.
- The disposable PostgreSQL monolith was replaced by focused schema,
  preparation, delivery, recovery, feedback, and report suites. Both
  `check:research-brief` and v2 acceptance execute every split suite, and CI
  installs PostgreSQL before those commands.
- Legacy and prepared v2 dispatch now share one live transport adapter for
  recipient selection, delivery ledger use, signed replies, SMS, and
  kind-specific email submission.
- Manual Run now treats Eve session acceptance as the point of no return.
  Runtime-session bookkeeping retries three times; a persistent bookkeeping
  failure logs a PII-free phase code and still tells the parent the run
  started.
- Reactive email leaves accepted delivery durable while RFC enrichment,
  canonical visibility, progress binding, and reply-loop work remain
  retryable. The sent delivery row prevents the retry from submitting the
  outbound email twice.
- Operational failures now use bounded phase codes for preparation load,
  canonical persistence, transport, finalization, recovery lookup, manual
  bookkeeping, and reactive email postprocessing. Diagnostics accept no
  family id, run id, destination, parent content, or provider error string.
- Current `origin/main` account-status and admin rendering changes from
  `1a341e9` were manually ported. The v2 admin outcome tiles and checks remain
  intact. A final ancestry check found fourteen current `origin/main` commits
  after this worktree's HEAD, so an
  authorized future commit plus rebase or equivalent ancestry integration is
  an external gate. No merge, rebase, checkout, commit, or push happened here.

Documentation reconciliation remains honest: the local `--allow-open` check
still carries repository-wide first-seen, coverage, migration-evidence, and
claim-ledger drift until a separately scoped reconciliation closes it.

## 2026-07-17 · Final webhook and dispatch race closure

- Prepared v2 finalization now owns the terminal task transition. It takes the
  existing source lock and a row lock on the running task, converts unresolved
  pending attempts to uncertain, re-reads every durable recipient attempt, and
  derives `done`, `partial`, `partial_uncertain`, `uncertain`, or `failed`.
  Status, finished time, session, channel, summary, canonical visibility, and
  eligible evidence effects commit together. Evidence and visibility remain
  internal unless a delivery or save-only receipt is confirmed.
- Dispatch no longer calls a second task-run finish after finalization. The
  finalization aggregate, not the earlier in-memory transport result, is the
  result returned to the channel.
- Resend reconciliation now discovers matching rows, locks each task run
  before touching its delivery rows, and never terminalizes a running run.
  A delivered event followed by a bounce before finalization leaves the task
  running; finalization then sees the bounce and commits partial or failed
  truth. A bounce after finalization re-locks and reconciles the terminal run.
  The focused PostgreSQL cases include two recipients.
- Rollout token counts now join `model_usage` to each pinned run by
  `session_id`, require `channel = 'dispatch'`, and do not filter on the v2-only
  `morning_brief` surface. Tests prove nonzero legacy and v2 totals while
  excluding web-channel and unrelated-session usage.
- Generic webhook reconciliation, retry identifier, map-email, and reactive
  email PostgreSQL cases moved to
  `apps/web/lib/tasks/email-delivery-postgres.test.ts`. Research delivery now
  contains only prepared finalization and recovery cases. Both suites run
  through `check:research-brief`, integrated v2 acceptance, and the existing
  CI step after PostgreSQL installation, with no duplicate test cases.

No remote query, migration, deployment, feature-flag change, commit, merge,
rebase, checkout, clean, or push occurred.

## 2026-07-17 · Completion events and legacy race closure

- Normal prepared finalization now emits exactly one
  `tasks.run_completed` after its transaction commits, using the durable
  `done`, `partial`, `partial_uncertain`, `uncertain`, or `failed` status.
  Confirmed SMS or email also emits one `research.brief_sent`. Recovery uses
  the same event helper; a normal replay or recovery `not_found` result emits
  nothing.
- Journal, custom, and pinned-legacy morning dispatch now finish through
  `finishTaskRunFromDurableDeliveries`. It locks the running task, converts
  unresolved pending attempts to uncertain, groups attempts by member or
  destination, derives durable status and channel, and writes summary,
  finished time, and session only while the row remains running. Explicit
  save-only is a separate confirmed outcome.
- Legacy dispatch uses that returned aggregate for canonical visibility,
  `tasks.run_completed`, `journal.prompt_sent`, and
  `research.brief_sent`. It no longer writes task status from the stale
  in-memory transport aggregate.
- PostgreSQL interleavings cover an early email bounce for journal, custom,
  and pinned-legacy morning runs, a two-recipient partial result, a confirmed
  sent result, and explicit save-only.

No parent-facing Tasks copy changed in this wave. No new reader or editor gate
was required.

## 2026-07-17 · Authoritative recovery and generic visibility closure

- Prepared recovery no longer trusts the aggregate captured before its
  finalization lock. The finalizer returns prepared data plus its recomputed
  delivery aggregate; recovery returns that aggregate and emits completion and
  sent events from it. A PostgreSQL regression inserts a bounce between the
  stale snapshot and run lock, then proves partial durable status and matching
  events.
- Generic durable finalization now locks the canonical assistant message with
  the task and makes it family-visible in the same transaction as status,
  channel, summary, session, and finished time. A visibility trigger failure
  rolls back every task change and leaves the run running.
- Normal save-only writes a recoverable receipt before finalization. Stale
  recovery locates the canonical task message and invokes the same full
  finalizer. A failed visibility attempt followed by stale recovery proves the
  message, summary, and terminal status are recovered together. A terminal
  replay returns no durable result and emits no duplicate event.

## 2026-07-17 · Stale no-output closure

- Stale generic recovery now locks and rechecks the family task run before it
  classifies a missing canonical assistant message. A still-running run with
  no sent, uncertain, or pending delivery and no save-only receipt finishes
  failed through the guarded `onlyIfRunning` transition. Its bounded error is
  `stale task produced no canonical output`.
- A sent, uncertain, or pending delivery, or a durable save-only receipt,
  preserves the running run when canonical lookup has no result. This keeps a
  transient message lookup failure recoverable instead of guessing that the
  model produced nothing.
- The lock also closes the evidence race. Delivery evidence or a save-only
  receipt committed while the reaper waits is re-read before classification.
  A concurrent terminal completion wins without being overwritten.
- PostgreSQL regressions cover model-crash/no-output journal, custom, pinned
  legacy morning, and pinned v2 runs; delivery and save-only preservation;
  evidence committed behind the lock; and concurrent completion. A focused
  completion-event test proves one failed `tasks.run_completed` emission and
  no replay emission. Moving the run out of `running` releases the existing
  Run now throttle.

No remote or git mutation occurred.

## 2026-07-17 · Pre-merge rollout evidence

The feature commit was rebased onto current main without a force push. The
additive production migration is recorded as `20260717125607`. A CI rerun
passed after migration, including remote isolation and continuity E2E. Preview
commit `9f153a3` reached READY and passed landing, sample, and dispatch-health
probes.

The OIDC-authenticated paid craft evaluation passed all twelve current
fixtures. Production code is still unmerged and the v2 flags remain absent,
so this evidence does not claim a production behavior change.

## 2026-07-17 · Plan-confirmed

`HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY` now gates new morning-run v2 pinning
only when its value is exactly `"true"` and the task's `familySandbox` value
was loaded from `families.sandbox`. The existing exact global v2 flag remains
an override for all morning families. Journal and custom runs remain legacy.
Scheduled and manual creation persist the selected version, so later
environment changes cannot change a started run. The sandbox status remains
server-only task context and does not enter model instructions, dispatch auth,
dispatch targets, or client input.

## 2026-07-17 · Discovery

The two original rollout controls,
`HOMA_MORNING_BRIEF_SLIM_CONTEXT_ENABLED` and
`HOMA_RESEARCH_BRIEF_V2_ENABLED`, were global process flags. They could not
safely implement the approved sandbox-only rollout because neither could
distinguish a sandbox family from every other family at run creation. The
conservative fix adds no schema, endpoint, token, or model field. It reads the
existing family sandbox column only in the two server-side task queries and
pins the result on the existing task-run row.

## 2026-07-17 · What to carry forward

- Sandbox rollout verification must prove one sandbox morning pins v2 and one
  non-sandbox morning pins legacy while the global v2 flag remains false.
- Keep the sandbox flag exact. `"TRUE"`, padded values, and absent values are
  disabled.
- Do not reuse `familySandbox` outside server-loaded task context or expose it
  to the model or browser.
