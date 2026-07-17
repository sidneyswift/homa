# Morning research brief v2 implementation plan

Goal: source-specific, child-tight, novel, carrier-safe morning research
briefs with an auditable delivery trail.

## As-built reference and boundaries

Tasks 1 through 9 are implemented in the isolated
`.worktrees/morning-research-brief-v2` worktree. Task 10 records this state.
Task 11 remains an integration and rollout gate, not a completed operation.
No commit, merge, push, remote migration, feature-flag enablement, paid model
execution, deployment, or production verification is represented by this
plan.

The implementation preserves `morning-brief-format`'s four blocks, the one to
two sentence limit for its two content blocks, and one executable offer. V2
supersedes its generic-source and microscope requirements only. A final draft
must remain below 900 visible Unicode characters and ten actual carrier
segments. Citation links in the app and all-child coverage are intentionally
out of scope.

### Repository ownership

| Concern | As-built owner |
|---|---|
| Named provenance | `apps/web/lib/knowledge/citation-source.ts` |
| Eligibility and deterministic ranking | `apps/web/lib/knowledge/select-brief.ts` |
| Bounded family, child, observation, and trace context | `apps/web/lib/tasks/brief-context.ts` and `dispatch-input.ts`, rendered as one JSON data object |
| Exact four-block and carrier validation | `apps/web/lib/tasks/research-brief-format.ts` |
| Authenticated staging | `apps/web/agent/tools/prepare_research_brief.ts` and `apps/web/lib/tasks/research-brief-preparation.ts` |
| Prepared-only send, receipts, recovery, and atomic terminal finalization | `apps/web/lib/tasks/research-brief-delivery.ts`, `research-brief-store.ts`, `dispatch-transport.ts`, `apps/web/agent/research-brief-dispatch.ts`, and `apps/web/agent/channels/dispatch.ts` |
| Resend submission, RFC identity, bounce truth, and reactive retry | `apps/web/lib/conversation-continuity/delivery-ledger.ts`, `reactive-email-delivery.ts`, `apps/web/lib/email-webhook.ts`, and `apps/web/app/api/email/webhook/route.ts` |
| Causal outcomes and proximate analytics | `apps/web/lib/conversation-continuity/reply-policy.ts`, `rfc-message-id.ts`, and `apps/web/lib/admin/morning-brief-metrics.ts` |
| Explicit parent feedback | `apps/web/lib/tasks/research-brief-feedback*.ts` and `apps/web/app/app/tasks/task-history.tsx` |
| Fleet procedure and semantic routing | `apps/web/agent/skills/research-brief/SKILL.md` and `apps/web/evals/research-brief/` |
| Read-only rollout comparison | `scripts/morning-research-brief-v2-report.mts` and `morning-research-brief-v2-report-lib.ts`, joining both cohorts' dispatch usage by run session |
| Generic email delivery PostgreSQL coverage | `apps/web/lib/tasks/email-delivery-postgres.test.ts` |
| Durable v2 state | `supabase/migrations/20260716115722_morning_research_brief_v2.sql` |

### As-built sequence

1. The selector filters active source rows by freshness, confidence, named
   citation, stage/tier rules, relevance, and the exact fourteen-day
   family-row cooldown. It ranks by fit, fleet recent-use count, and a stable
   family-local-date tie.
2. The skill receives at most three candidates for each child plus bounded
   traces and concrete evidence. It chooses one child and angle, then writes
   a named-source finding and one action-shaping non-obvious detail.
   If no candidate remains, it stops. Family dispatch cannot search or write
   the fleet corpus; nightly fleet demand handles that gap.
3. `prepare_research_brief` authenticates the dispatch run, validates exact
   source and child inclusion and sibling exclusion, and stores the exact
   valid text with its source snapshot. It does not consume the source.
4. The dispatcher reads only that staged text. Finalization locks the v2 run,
   re-reads all durable attempts, derives terminal delivery truth, and in one
   transaction writes status, finished time, session, channel, summary,
   canonical visibility, and eligible evidence effects. Running-run webhooks
   update delivery rows but do not terminalize the task. Crash recovery uses
   the durable receipt before contacting a transport again.
5. Later incoming activity resolves a causal offer only with delivery-backed
   evidence or bounded polarity/substantive text. Four-hour nearby activity is
   possible interest only. The Tasks page records a separate explicit
   Helpful or Not for us signal.

### Focused evidence

`pnpm check:research-brief`, `pnpm check:research`, `pnpm check:tasks-ui`,
`pnpm check:agent-context`, `pnpm check:continuity`, and `pnpm check:admin`
cover the focused deterministic layers. `pnpm check:events` covers the
feedback event. `pnpm eval:research-brief` is paid and requires credentials,
so it is not part of the completed isolated evidence. Remote isolation
requires Supabase public credentials absent from this worktree.

## Task 1: additive schema and isolation contract

Create the additive migration only through Supabase CLI. Add preparations,
family knowledge use, feedback, and loop outcomes. Family-scoped rows use a
composite `(task_run_id, family_id)` reference to prevent a task run from
another family or a fleet run from entering the records. Add anonymous and
authenticated isolation probes plus ten disposable PostgreSQL lifecycle cases.
Do not apply remote schema.

## Task 2: named-source gate and deterministic selector

Add a shared `ResearchCitation` type. New agent-research rows need lens,
required stage except method, source tier, named citations, and medium or high
confidence. Selection consumes stored TTL, current-study tier rules, citation
derived source labels, deterministic fit including broad legacy subject,
timestamped fourteen-day cooldown, fleet recent-use count, and a stable
family/date tie. `check:research` owns focused suites.

## Task 3: bounded context and prefetched history

With v2 disabled, preserve a legacy loader and renderer that do not read v2
tables. With v2 enabled, load child-scoped stage, subjects, frontiers, up to
three ranked candidates, named citations and claims, confidence and tier, plus
seven delivered traces. Use the family-local date in deterministic selection.
The prompt selects one child and candidate, prepares the draft first, then
outputs only the accepted draft. `check:tasks-ui` owns focused suites.

## Task 4: format and prepared-draft service

Replace the microscope headline with the plain four-block contract. Enforce
900 visible characters and ten actual carrier segments. Add the
dispatch-authenticated preparation tool, Unicode-aware whole source and child
matching, running-run checks, transactional source reservation, exact draft
hash/snapshot staging, and focused tests.

## Task 5: prepared-only delivery and post-delivery finalization

Dispatch sends only the stored preparation. Under one task-run lock,
finalization re-reads all durable recipient attempts, derives honest
`done`/`partial`/`partial_uncertain`/`uncertain`/`failed` truth, and atomically writes
terminal task state with canonical visibility and evidence effects only for a
confirmed delivery or save-only receipt. Webhook reconciliation uses the same
run lock, never terminalizes a running task, and may reconcile a terminal
bounce afterward. Dispatch performs no later finish write. Normal and recovery
paths each emit one durable task-completion event; confirmed SMS/email also
emits one brief-sent event and replay emits nothing.

## Task 6: fleet skill and semantic evals

Update `research-brief/SKILL.md` to require actual named provenance, one
finding plus one action-shaping non-obvious mechanism/progression/boundary,
one child and evidence anchor, and one matched CTA. Use prefetched traces, not
routine recall. Require `prepare_research_brief` before final output. Add
positive fixtures for observation, frontier, method, and multi-child pick-one.
Add negatives for no candidate, generic source, invented author, extrapolation,
obvious-only, repetition, sibling comparison, unrelated CTA, carrier overflow,
family-dispatch search, and family-dispatch fleet writes. Add dispatch-positive
and parent-chat adjacent-negative routing.
Run the Homa reader gate, apply accepted fixes, then the editor gate.

## Task 7: slim context and usage telemetry

Add dispatch-specific instructions. Under the exact slim-context flag, skip
generic family and ChildProgress hydration only for v2 morning dispatch. Add
typed `morning_brief` model-usage surface. Preserve every other channel. Test
flag boundaries and run agent-context, typecheck, and Eve build.

## Task 8: causal outcomes and proximate analytics

Disable word-overlap matching for yes/no and approval loops. Return and persist
accepted, declined, or answered outcomes. Use a run-specific morning prompt
key. Add read-only four-hour same-episode possible-interest analytics without
mutating `replied_at`. Split admin metrics by task kind and outcome. Preserve
legacy continuity behavior and add focused tests.

## Task 9: helpful feedback in Tasks history

Add family-scoped, morning-only, idempotent explicit feedback writes and the
`research.brief_feedback` event. Show `Helpful` and `Not for us` only on
delivered morning briefs. Run Homa reader then editor gates. Verify Tasks UI,
events, and isolation.

## Task 10: rulings, map, and implementation notes

Register the new founder ruling and superseded format details, update the repo
map for every new module and check, and reconcile build-log evidence. Keep the
implementation notes current. Run the documentation structural check.

## Task 11: full verification and rollout

Extend the disposable task E2E for exact selection, preparation, delivered
text, post-delivery effects, and idempotency. Add a PII-free before/after
report comparing the in-range `legacy` baseline with the
`research_brief_v2` treatment for dispatch-channel tokens joined by run
session, whole-run latency, 800-second risk indicators, SMS/fallback, source
naming/repetition, outcomes, proximity, and feedback. Include v2 failures
without preparations and exclude unrelated task kinds. Run all focused
guards, typecheck, lint, Next build, Eve build, and E2E.

Use the repository's additive-migrations-may-lead rule. Migration-first is
required here because reply resolution writes
`conversation_open_loops.resolved_outcome` and admin analytics read it outside
both feature flags. A flags-off deployment still needs that column. With
explicit external-write authorization:

`HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY` is the exact sandbox gate for new
morning runs. It selects `research_brief_v2` only when its value is exactly
`"true"` and the server-loaded `families.sandbox` value is true. The global
`HOMA_RESEARCH_BRIEF_V2_ENABLED === "true"` override remains fleet-wide.
Every other value, non-sandbox family, journal run, and custom run selects
legacy. The selected value persists on the task-run row and never changes
when environment values later change.

1. Apply the additive v2 migration, then run `pnpm check:isolation` against the
   migrated target.
2. Deploy code with `HOMA_MORNING_BRIEF_SLIM_CONTEXT_ENABLED=false` and
   `HOMA_RESEARCH_BRIEF_V2_ENABLED=false`, and leave
   `HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY` absent or false. Wait for Vercel
   READY, then probe the legacy morning-brief, reply, and Tasks paths.
3. Refresh the exact v2 fleet research corpus and verify required metadata and
   named citations.
4. In the sandbox, enable slim context while v2 remains false and probe the
   legacy path.
5. Set `HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY=true` while the global v2 flag
   stays false. Verify one sandbox morning from selection through explicit
   feedback and one non-sandbox family still pinned to legacy.
6. Enable both exact flags for the fleet only after sandbox evidence is
   reviewed, then verify one complete live morning.

Rollback sets `HOMA_RESEARCH_BRIEF_V2_ENABLED=false` first and waits for
READY. Set `HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY=false`, then set
`HOMA_MORNING_BRIEF_SLIM_CONTEXT_ENABLED=false`. Keep the additive schema in
place.
