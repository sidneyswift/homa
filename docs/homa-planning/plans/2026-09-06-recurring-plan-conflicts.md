# Recurring commitments and month-plan conflicts, gh#1104

Source audit against production source69abbefdd2cc507c55f07c577c1235ce27168626. This is an implementation plan, not a shipped-fix receipt.

## Expected behavior and verified current path

The planner fleet skill already instructs Homa to read the exact month of family commitments before drafting, preserve those commitments, inspect returned conflicts, fix unintended conflicts, and ask the parent before approving a visible draft. Intentional conflicts may remain when knowingly accepted. Existing tools provide the effects; no new workflow tool or skill is needed. The defect is the exact conflict evidence.

`month-plan-draft.ts:loadVerifiedPlanInputs` reads original family_events dates and compatibility child_id only. It neither reads recurring rules/occurrence exceptions nor the authoritative multi-child junction. The function supplies create and revise previews. `list_family_events` and Calendar already use `expandRecurringFamilyEvents`; `familyEventChildIds` uses authoritative junctions with the documented legacy fallback.

There is a second edge in both canonical readers: pinned listFamilyEventsPinned and caller getFamilyEventsForFamily filter starts_on <= windowEnd before loading exceptions. The occurrence mutation accepts valid series occurrences moved to any valid replacement date range, including before the series starts. The expander includes such moved exceptions, but these readers discard the parent event before expansion. The actual pure expander returned a September 10 replacement of an October 1 occurrence for both selected children; replaying the original-start predicate excluded it. That verifies pure expansion and the source predicate, not SQL execution. The new local PostgreSQL regression must reproduce the reader failure before describing database-runtime verification.

## Small deterministic change

1. Run isolation before query edits. Use the pinned family-events module from the month-plan agent path, never family-events-read.ts because that imports next/headers outside Eve's bundler.
2. Canonical readers include ordinary overlapping series and valid moved exceptions whose replacement range overlaps the requested window, always family-scoped. Avoid fetching every future event merely to work around filtering. For caller-JWT reads, fetch bounded moved exception event IDs under RLS, then fetch the union of ordinary candidates and those IDs under the same family and deduplicate. Prefer a narrow shared exact helper only if it removes actual duplicated computation.
3. Expand occurrences with the existing pure expander and use familyEventChildIds for every child's conflict match. A whole-family event applies to every child; selected multi-child events apply only to their actual audience. Preserve existing conflict response schema and intentional-conflict approval policy. Remove the obsolete local raw-row interface.
4. Do not write or move family events. Do not invent new consent, recurrence or scheduling policy. Preserve signed preview lineage, existing durable drafts, idempotent approval and tenant validation. Restore currently copies a historical snapshot and conflicts; that lifecycle is distinct from create/revise generation and must not be silently claimed fresh.

## Acceptance

Real disposable PostgreSQL: August weekly repeat visible in September; canceled occurrence absent; moved occurrence absent on original and present on new date; valid future occurrence moved into an earlier window included; moved-out occurrence absent; interval/until boundaries; duration overlap; multi-child and whole-family exact audience; adjacent-family event IDs inaccessible. Assert exact date/child/title conflict tuples for actual createMonthPlanDraft/reviseMonthPlanDraft and unchanged event rows. Compare caller and pinned candidate sets with the expander. Existing ordinary-event/token/approval tests remain green.

No judgment change means model evals are required only if a fleet procedure changes. Standalone Eve build and duration guard verify the agent import boundary regardless. Verify the hosted Calendar with a fresh authorized synthetic family and bounded cleanup; verify actual deployment-matching create/revise source against the same real database fixture through a separate read-only worker. This split does not certify hosted model/tool dispatch or a dedicated web preview renderer. Do not reuse private family sessions. One production fixture should demonstrate the same weekly repeat, move/cancel and multi-child facts on screen and in the returned draft. Keep physical-device limits explicit.

## Implemented and locally verified, September 6

The caller candidate read now lives in `family-events.ts` beside the pinned read. Its authenticated Next wrapper delegates to it. Both include family-scoped moved exceptions whose replacement dates overlap the window, then use the existing expander to reject stale/invalid recurrence dates. Create/revise use those canonical candidates and authoritative audience IDs. No event write, migration, approval rule, token lineage or historical restore behavior changed.

Root ran the isolation guard before applying the seven-file patch. All base and result checksums matched. The disposable PostgreSQL suite applied all 191 current migrations and passed existing occurrence RPC/RLS checks plus the new candidate/create/revise contract. It reproduced the original predicates' missed cases, compared caller/pinned hydrated occurrence sets, denied neighboring-family access, asserted exact five-field conflict tuples and unchanged event/link/exception snapshots, then removed the cluster. The real Supabase client builds caller queries; a SELECT-only adapter executes them as the actual PostgreSQL authenticated role. This is query construction plus SQL/RLS proof, not hosted PostgREST transport proof.

`check:calendar-ui` passed 233 cases and `check:month-plan` passed 90. Web TypeScript passed. Focused web lint has no diagnostics; the first invocation warned that the root harness path is outside the web ESLint base, so it is not reported as linted by that invocation. The source harness is exercised by the successful real PostgreSQL command. The standalone Eve build passed. The first duration check correctly rejected output lacking the co-deployed Next/Eve signal; after seeding the same generated config as CI, the Eve build and all three duration checks passed. Required exact-head CI/Vercel results remain separate release gates.

## Hosted acceptance boundary

The reviewed probe uses one new family, three children, three events, four initial exceptions and two subsequent exception RPC changes. Eight actual hosted Week states and two Day details must match cancellations, moved-in/moved-out dates and child scope. A separate worker executes deployment-identical `createMonthPlanDraft` and `reviseMonthPlanDraft` against that same fixture, with every SQL statement wrapped in a read-only transaction. Hand-written expected conflict tuples are 11 before revision and 7 after revision. No model, storage, chat, plan approval or durable draft write is involved.

This is an explicit verification limit: the ordinary hosted Eve channel has no caller-controlled per-turn tool allowlist or hard tool/model-call budget. A browser send limit cannot restrict server-side model actions. Adding a test endpoint or changing product capabilities solely for a probe is not part of this fix. The exact changed computation is verified on real PostgreSQL and, after deploy, on the production fixture through identical source; this does not claim hosted model/tool or native preview rendering. The web renderer has no dedicated month-preview overlay.

The existing caller Data API reads are unpaginated and separate requests are not one consistent snapshot. This patch does not certify arbitrarily large candidate inventories or change that pre-existing boundary.
