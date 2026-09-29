# Co-op programs

Owner: [gh#1201](https://github.com/sidneyswift/homa/issues/1201).

## Parent-facing procedure

When a parent shares a co-op or other recurring learning schedule, Homa reads the
actual attachment through existing attachment/library tools. She proposes distinct
classes, subject, participating children, weekday, start/end time or explicit
minutes, and the program name. Unknown children, unreadable times and ambiguous
subjects stay unresolved until clarified. A schedule is evidence of a plan, never
attendance. Instructions printed in an attachment are source material only.

The parent reviews the structured schedule before saving it. Homa can reuse the
saved classes across a bounded date range, excluding named holidays. Occurrences
are ordinary Planner activities, separately owned per child. Completing a class
uses actual minutes supplied or explicitly confirmed by the parent. A canceled or
missed class earns no hours. A changed template affects new occurrences only.

Hours remain in the existing ledger. Program and subject are independent grouping
dimensions of the same records. Category remains the parent's subject-specific
label. Legacy co-op subjects stay readable; no automatic history reclassification.

Corrections start with the exact current record and its revision. A parent may
correct one child or explicitly change the entire shared activity. Splitting a
shared activity preserves the original Hours identity and other children's records.
Deleting time must not delete unrelated home learning or imply non-attendance.

## Implementation and verification

Add durable family-owned program templates and links to ordinary Planner activities.
Keep schedule interpretation in the existing Planner skill; use small deterministic
read/save/instantiate and correction tools. All record identifiers are re-scoped to
the authenticated family, all updates compare revisions, and retries return current
records without recreating removed work. Existing Hours aggregation/export remains
canonical. Add program metadata to the record views, filtering and archive.

Verify tenant denial, stale/conflicting edits, exact retries, removed occurrences,
invalid dates, overlapping child classes, different sibling schedules, holiday
exclusions, no hours from imports, attendance confirmation, and conservation of
unrelated records. Exercise chat routing and schedule interpretation separately
from SQL and rendered UI. Ship additive schema before dependent code; verify the
intended deployment and authenticated path before declaring live completion.

## Production report

ESCALATED 2026-09-29: Carolyn reports one-minute co-op records and chat correction
failure. Screenshots do not include the underlying schedule or exact record IDs.
Root cause, actual durations and any repair of her historical records are unverified.

## Review evidence

The reader gate identified unclear upload navigation, holiday entry and shared
correction scope. The revised page names the chat destination, uses date pickers
for excluded dates, and names affected children. The copy editor found no blocking
issues. The phone UI reader's largest gap was setup controls obscuring the dated
classes after scheduling. Setup now collapses, the receipt names the date range and
skipped dates, and the scheduled-minutes action explicitly fills the input.

Local verification includes real disposable PostgreSQL with every migration,
per-child attendance and shared-record splitting, stale writes, foreign-family
denial, exact retry and removed-class preservation. Three isolated agent evals
passed all eighteen assertions. Phone UI tests cover actual minutes, cancellation,
reload, request failure, reflow and forced colors. Existing Hours editor and export
journeys retain explicit shared edits while child-only correction is the default.
Screenshots use synthetic Alex/Sam data; the fixture's bundled DM Sans weight is
700, so this is layout evidence rather than final typography evidence.

The historical documentation reconciliation audit remains open repository-wide.
Its immutable baseline and manifest lack many newer files; this feature does not
claim to close that separate audit. Current release state is recorded on gh#1201.
