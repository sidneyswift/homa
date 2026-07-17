# Morning research brief v2 design

Status: approved 2026-07-16 and production-verified 2026-07-17. The shipped
system preserves the binding decisions from the approved control document,
including the later sandbox-only and no-candidate skip corrections.

## Scope and preserved format

This is a v2 refinement of the weekday research brief, not a new task kind,
research system, or all-child digest. It supersedes only the generic-source
and microscope details of `morning-brief-format`. The four blocks remain
binding: a plain research headline, `What I learned:`, `Why it's
interesting:`, and one `Want me to ...?` offer. Each content block remains
one or two sentences and the offer stays one executable current capability.

The parent-visible message has no more than 900 Unicode characters and ten
actual SMS carrier segments. The carrier calculation is authoritative over
character count. App citation links and all-child coverage are deliberately
deferred. The brief stays one child and one angle, so a parent can understand
why this morning's message matters without comparing children or scanning a
digest.

## Decision and delivery model

1. Deterministic code filters and ranks source rows before the model writes.
   A candidate must be active, within its stored freshness TTL, medium or high
   confidence, relevant to the selected child's current stage or method, and
   backed by at least one actual named citation. Current-study rows also need
   a permitted source tier and matching stage. A delivered use of the same
   knowledge row excludes it for fourteen days.
2. Ranking favors child frontier fit, then subject fit, method fit, and broad
   legacy subject fit. It next favors lower fleet recent-use count and uses a
   stable family-plus-local-date hash as the final tie breaker. This makes
   eligibility and novelty reproducible without asking the model to remember
   what a family saw.
3. The dispatch bundle is bounded. It contains eligible child-local
   candidates, named provenance and claims, concrete current-work or frontier
   anchors, limited fresh observations, family method evidence, and at most
   seven delivered traces. URLs, generic profile hydration, and generic
   ChildProgress hydration do not enter the exact slim dispatch lane. Every
   dynamic field is serialized inside one JSON data object, so newlines and
   instruction-like parent or corpus text remain quoted values.
4. The fleet skill makes the remaining judgment call: choose one child and one
   eligible angle, explain an obvious source-backed finding plus an
   action-shaping non-obvious mechanism, progression, or boundary, and make
   one matching offer. It stops rather than inventing a source, child anchor,
   or offer. Family dispatch cannot search for or save fleet knowledge. An
   empty candidate set produces no brief; nightly fleet demand handles the
   missing corpus row without family context.
5. The model must call `prepare_research_brief` before its final output. The
   tool derives family, run, and task kind from authenticated dispatch
   attributes, re-scopes every supplied identifier, validates the exact
   four-block draft and selected child/source names, and writes a draft hash
   plus parent-safe source snapshot. A prepared draft is not evidence use.
6. Dispatch sends only the stored preparation. Finalization locks the running
   v2 task, re-reads every durable recipient attempt, and derives honest
   `done`, `partial`, `partial_uncertain`, `uncertain`, or `failed` truth. The same
   transaction writes status, finished time, session, channel, and summary.
   Only confirmed delivery or save-only also records family knowledge use,
   source artifact, eligible observation use, preparation delivery time, and
   canonical family visibility. Dispatch performs no later finish write.
   After commit, normal delivery emits one `tasks.run_completed` from the
   durable status and emits `research.brief_sent` only for confirmed SMS or
   email. Recovery uses the same event contract and replay emits nothing.
   Legacy and v2 share one recipient, ledger, signed-reply, SMS, and email
   transport adapter.
7. Offer outcomes are causal only when the delivery identity or bounded
   affirmative, negative, or substantive reply supports the link. Four-hour
   same-episode activity is read-only possible interest. Helpful and Not for
   us are separate explicit parent feedback, attributed to the adult who
   supplied it.
8. Resend's submission id is durable webhook identity. RFC Message-ID is
   separate reply-thread identity. Retries clear stale identifiers, accepted
   completion writes current identifiers exactly, and delayed RFC enrichment
   can update only the matching submission. Hard bounces recompute the task
   run from all recipient delivery rows. Webhooks lock the task first and
   never terminalize it while it is running; prepared finalization owns that
   transition. A later terminal-run webhook may reconcile a bounce. An
   unmatched webhook asks Resend to retry.
9. Reactive email keeps accepted delivery durable while visibility, RFC
   enrichment, and reply-loop postprocessing remain retryable. The delivery
   ledger prevents a retry from sending the outbound email twice.

## Durable data and rollout boundary

The additive local migration creates `research_brief_preparations`,
`family_knowledge_use`, and `research_brief_feedback`; it also adds nullable
`conversation_open_loops.resolved_outcome` and supporting delivery/query
indexes. It also adds a separate `provider_submission_id` to conversation
deliveries. Family-scoped records use composite family identity references
and RLS. The knowledge bank remains fleet-wide and never gains a family id.

The repository implementation is isolated in
`.worktrees/morning-research-brief-v2`. It has not been committed, integrated,
deployed, remotely migrated, feature-enabled, or production-verified. The
optional paid craft judge remains credential-gated. Production rollout needs
separate authorization for integration, additive migration, flag enablement,
and a complete live morning verification.

The intended rollout is additive migration, code-dark deployment, sandbox,
then fleet. Migration-first is required here because reply resolution writes
`conversation_open_loops.resolved_outcome` and admin analytics read it outside
both feature flags. A flags-off deployment would still require that additive
column.

`HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY` is an exact `"true"` scoped rollout
gate. A new morning run uses v2 when the global
`HOMA_RESEARCH_BRIEF_V2_ENABLED` flag is exactly `"true"`, or when the
sandbox-only flag is exactly `"true"` and the server-loaded `families.sandbox`
value is true. The global flag overrides sandbox status. Journal and custom
runs stay legacy. The task run persists this decision at creation, so later
environment changes cannot alter an existing run. The sandbox value is
database-loaded task context only, never model-visible or client-provided.

1. Apply the additive v2 migration, then run the isolation guard against the
   migrated target.
2. Deploy code with `HOMA_MORNING_BRIEF_SLIM_CONTEXT_ENABLED` and
   `HOMA_RESEARCH_BRIEF_V2_ENABLED` both false, and
   `HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY` absent or false. Wait for Vercel
   READY and probe the legacy morning-brief, reply, and Tasks paths.
3. Refresh the exact v2 fleet research corpus and verify its eligible rows
   carry the required lens, stage or method exception, source tier where
   required, confidence, and actual named citations.
4. In the sandbox, enable slim context while v2 remains false. This first flag
   is inert until v2 is enabled. Probe one complete legacy path.
5. Set `HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY=true` while the global v2 flag
   remains false, then verify one complete prepared, delivered, finalized,
   and feedback-capable sandbox morning. Verify a non-sandbox family still
   creates a legacy run.
6. Enable the exact flags for the fleet only after the sandbox evidence is
   reviewed. Verify one complete live morning before calling rollout complete.

Rollback is kill-switch first: set `HOMA_RESEARCH_BRIEF_V2_ENABLED` false,
then set `HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY` false, wait for READY, then
set the slim-context flag false. Leave the additive tables and columns in
place.

## Verification model

- Deterministic format, preparation, prepared-delivery, feedback, and focused
  disposable PostgreSQL schema, preparation, research delivery, generic email
  delivery, recovery, feedback, and report suites run through
  `pnpm check:research-brief`.
- Named citation and deterministic selection cases run through
  `pnpm check:research`.
- Bounded context and Tasks history cases run through `pnpm check:agent-context`
  and `pnpm check:tasks-ui`.
- Causal continuity and administrative outcome metrics run through
  `pnpm check:continuity` and `pnpm check:admin`.
- Semantic fixtures and Eve routing definitions test source honesty, child
  specificity, novelty, action fit, and adjacent non-routes. The paid craft
  judge is intentionally separate from CI.
- The read-only rollout report compares in-range `legacy` and
  `research_brief_v2` cohorts. Whole-run started-to-finished time is labeled
  run latency, never compose or model latency. The 800-second indicators remain
  explicit operational risks. Both cohorts' token totals join dispatch-channel
  model usage to the pinned run by session id, without a v2-only surface rule.

## Binding decisions

1. The brief teaches a source-specific, non-obvious finding, anchors it to one
   child, and offers one executable action.
2. Parent-visible content is at most 900 characters and ten SMS segments.
3. Code decides safe eligibility. The fleet skill selects one useful angle.
   Candidates are active, fresh, medium or high confidence, cited, relevant,
   stage-appropriate, and outside a fourteen-day family cooldown.
4. `family_knowledge_use` stores family novelty. `knowledge_bank` never stores
   a family id. Fleet use count and a stable family/date tie resolve ranking.
5. `prepare_research_brief` is delivery truth. It scopes all identifiers,
   validates the exact draft, and stores the source snapshot before dispatch.
6. One run-locked transaction owns v2 terminal status, finished time, session,
   channel, summary, visibility, source use, artifact, observation use, and
   preparation delivery. Evidence effects require confirmed delivery or
   save-only; webhook reconciliation cannot terminalize a running task.
7. V2 dispatch uses bounded child context, named provenance, and seven recent
   delivered traces. Routine recall is not a deduplication mechanism.
8. Engagement outcomes are accepted, declined, or answered. Four-hour activity
   is only possible interest, not a causal reply.
9. Default scope remains one child, one angle, and one CTA.
10. Family dispatch never searches for corpus material and never writes the
    fleet knowledge bank. No candidate means no brief; nightly fleet research
    handles corpus demand. The headline remains overnight-only.
11. Resend submission identity, RFC reply identity, bounce truth, and
    post-acceptance retry state remain separate and durable. Terminal webhook
    reconciliation may update a completed run, but no dispatch finish follows
    atomic v2 finalization.
12. Local rollout evidence compares the pinned legacy baseline and v2
    treatment inside an explicit time range. Branch ancestry integration,
    remote migration, deployment, flags, and live verification remain separate
    gates.
13. Journal, custom, and pinned-legacy morning tasks terminalize from
    run-locked durable delivery rows, including explicit save-only. Their Tasks
    status and channel events never use the earlier in-memory transport
    aggregate.

Durable v2 records are preparations, family knowledge use, and feedback.
`conversation_open_loops.resolved_outcome` is nullable accepted, declined, or
answered. All supplied identifiers are re-scoped in authenticated family
context. Fleet task runs with a null family cannot create family-scoped rows.
