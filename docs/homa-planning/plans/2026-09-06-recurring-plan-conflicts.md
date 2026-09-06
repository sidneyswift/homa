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

No judgment change means model evals are required only if a fleet procedure changes. Standalone Eve build and duration guard verify the agent import boundary regardless. Test actual hosted preview and calendar with a fresh authorized synthetic family and bounded cleanup. Do not reuse private family sessions. One production fixture should demonstrate the same weekly repeat, move/cancel and multi-child facts on screen and in the returned draft. Keep physical-device limits explicit.
