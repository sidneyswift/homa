# Unified Planner implementation notes

## 2026-08-02 10:00 ET

**Plan-confirmed**

Issue [#258](https://github.com/sidneyswift/homa/issues/258) remains the live tracker for merging Planner, Calendar, and Hours into one parent-facing Planner. The approved interaction model opens on one day, keeps Week, Month, and Hours one view switch away, uses one global Add action, and hides detail until the parent taps an item.

**Discovery**

The original `claude/planner-b1-unified-surface-258` worktree contains a large uncommitted implementation based on the earlier register-and-grid spec. Its changes are preserved untouched. This build starts from current `origin/main` and reuses only verified current production machinery.

**Deviation**

1. **What the plan said:** The 2026-07-27 one-planner ruling made a Today and this-week checklist register the default, with the week grid one toggle away.
2. **What the code and founder review revealed:** The resulting all-week prototype still presented too many day containers, controls, and decisions at once. On 2026-08-02 the founder approved a simpler Day-first prototype with Day, Week, Month, and Hours as the four explicit views.
3. **Conservative choice:** Preserve the existing authenticated data paths and mutations, but replace the presentation hierarchy. Keep detail, movement, hours editing, and calendar density behind explicit taps. Do not copy uncommitted work from the older worktree.
4. **Revisit:** Measure view use and check-off completion after release. If families routinely skip Day for Week, reconsider only the default, not the unified data model.

**Plan-confirmed**

The shipping branch is `codex/unified-planner-day-first`, created from `origin/main` at `fdf78a6b`. The unrelated `codex/admin-library-slack-ingestion` checkout and its untracked prototype files remain untouched.

## 2026-08-02 10:35 ET

**Discovery**

The production scheduler stores a calendar date for each plan activity, but it does not store an estimated duration. The production Hours record stores completed time as separate entries and cannot safely be attributed back to one scheduled activity. The Day and Week summaries therefore cannot truthfully repeat the prototype's estimated-minute totals.

**Deviation**

1. **What the approved prototype showed:** Day and Week summaries included estimated minutes for unfinished activities.
2. **What the code revealed:** `plan_activity_schedule` identifies the plan, week, and activity index plus the scheduled date. No duration field or verified activity-to-hours link exists.
3. **Conservative choice:** Show unfinished activity counts and appointment times. Do not estimate duration, and keep recorded time in the Hours view where its provenance is real.
4. **Revisit:** Add duration only after a product contract and durable source of truth exist for estimated activity time.

**Discovery**

The prototype's Ideas choice has no durable production model. Existing parent-facing mutations support family events, activity check-offs, and Hours edits. Scheduling and moving plan activities is agent-owned through the planner skill and its authenticated tool path.

**Deviation**

1. **What the approved prototype showed:** The global Add sheet offered Activity, Appointment, and Idea, with direct movement between days.
2. **What the code revealed:** A direct appointment editor exists. New learning plans and scheduled activity changes are intentionally handled by Homa, while no durable Ideas store exists.
3. **Conservative choice:** The one Add action offers `Appointment` and `Activity`, with activities handed to Homa for planning. Activity details offer a clear Homa handoff for schedule changes. Do not display an Ideas control that cannot persist.
4. **Revisit:** Add Ideas only with an approved durable model, tenancy contract, and retrieval flow.

**Plan-confirmed**

Next.js 16.2.10 documents `permanentRedirect` for canonical route changes and promise-based `searchParams` for App Router pages. `/app/calendar` and `/app/hours` will remain as permanent compatibility redirects into Planner views, so old links keep working while navigation has one Planner entry.

## 2026-08-02 11:30 ET

**Plan-confirmed**

The web Planner now uses one URL state model, `view` plus `date`. Day is the default. Week summarizes seven dates as rows, Month opens dates into Day, and Hours embeds the existing editable record without a second page title. Calendar and Hours were removed from the web navigation; their routes permanently redirect into Planner.

**Plan-confirmed**

Native parity uses the same Day, Week, Month, and Hours modes. Native Planner now defaults to Day, Hours was removed from native navigation, and the old native Hours route redirects to `Planner?view=hours`. The existing native event, check-off, schedule, export, and hours-edit mutations remain unchanged.

**Discovery**

Homa's planner skill and `schedule_plan_activity` tool description still directed parents to `/app/calendar`. Those route claims were part of the parent-facing capability, not harmless documentation. They now name Planner and explain that an activity appears only after it receives a real date.

**Plan-confirmed**

The founder ruling is registered as `planner-day-first-unification` in the build log and canonical founder-policy index. It supersedes only the old default register presentation in `one-planner-arc`; the shared data model, instrumentation, scheduling boundary, and native-parity direction remain.

**Discovery**

The first integration checkpoint passed the full web typecheck, the native typecheck, and 28 focused tests covering date math, the approved view hierarchy, check-off disclosure, navigation consolidation, Month linking, and embedded Hours behavior.

## 2026-08-02 14:58 ET

**Plan-confirmed**

The production-shaped Eve build passes under the repository's Node 24 runtime. The follow-on stream guard confirms that the shared `/eve/__server` function still ships with `maxDuration: "max"`. Tool deadlines, instruction splitting, fleet-skill packaging, design-token usage, isolation, map integrity, continuity, event registry parity, the full workspace typecheck, lint, and the focused web and native Planner suites also pass.

**Discovery**

The real React implementation was rendered from a temporary development-only fixture route with synthetic family data. At 390 by 844, Day, Week, Month, and Hours had no horizontal overflow. Every visible Planner control in the Day view met the 44 pixel target floor, the full Day fit in one viewport, and the browser logged no console errors. The same Day hierarchy stayed intact at 1440 by 900 inside the real Homa shell. The fixture route, generated route cache, and temporary local environment link were removed after capture and do not ship.

**Discovery**

A fresh read-only Homa parent review found the Day and Week structure immediately clear, calm, and scroll-free. It also found four small but meaningful disclosure issues: the activity detail action did not help her begin, `Open` could read as a command, Month required decoding tiny colored dots, and Hours led with sibling-shaped totals while its Edit target was small.

**Deviation**

1. **What the approved prototype showed:** Activity details emphasized scheduling, Week used `Open`, Month used colored dots plus a legend, and Hours exposed per-child totals first.
2. **What the fresh user read revealed:** Those elements added work after the main Day-first structure had already removed it.
3. **Conservative choice:** Keep the approved structure. Resolve activity-help composer text from authenticated family plan coordinates, say `Nothing planned`, show plain `N plans` counts in Month, lead Hours with the editable log, place per-child totals behind `Hours by child`, move source provenance into Edit, and give Edit a 44 pixel target.
4. **Revisit:** Use actual view-selection and activity-help behavior after release to decide whether the optional detail surfaces need more depth. Do not add estimated durations or invented activity instructions without a durable source.

**Discovery**

`pnpm check:docs -- --allow-open` remains red on the current repository baseline because the reconciliation manifest has hundreds of unrelated historical candidates, no immutable baseline, migration evidence drift, and pre-existing claim-ledger gaps. This Planner change adds one implementation note candidate to that already-red inventory but does not alter the reconciliation mechanism. The failure is recorded for the pull request rather than broadening a focused Planner release into a repository-wide documentation audit.

## 2026-08-02 16:10 ET

**Discovery**

The final fresh parent copy read found one trust-breaking Week summary: a date with a library appointment could say `Nothing planned` because the summary counted unfinished activities but not appointments. The copy editor also found several controls that required inference, including a generic Add label, two names for learning activities, and an unnamed appointment disclosure.

**Plan-confirmed**

Week summaries now count unfinished activities and appointments before declaring a day empty. Persistent copy consistently calls learning work an `Activity`, the primary action says `Add to planner`, the appointment disclosure names its hidden fields, finished counts name activities, and Hours explains that Homa records time the parent tells her about. The final focused Planner, Hours, date-model, and activity-help suite passes 24 of 24 tests after these changes.

**Plan-confirmed**

Final release gates pass: workspace typecheck, workspace lint with zero errors and nine unrelated existing warnings, 51 of 51 Hours UI tests, 149 of 149 calendar compatibility tests, the native Planner test, the em-dash guard, and `git diff --check`.

## 2026-08-02 22:14 ET

**Discovery**

Co-founder feedback on [#734](https://github.com/sidneyswift/homa/issues/734) clarified that a recurring event needs two different kinds of change. A parent may need to move or remove one date, while the underlying weekly series stays intact, or change the entire series.

**Plan-confirmed**

Planner now asks for scope only after the parent chooses Move or Delete. `This event` creates a dated exception keyed by the occurrence's original generated date. `Entire series` edits or deletes the canonical `family_events` row. Web and native use the same rule, while ordinary event details remain unchanged until the scope choice is relevant.

**Plan-confirmed**

The additive `family_event_occurrence_exceptions` table stores either a cancellation or replacement timing. Authenticated clients can read their family's exceptions but cannot write the table directly. The `save_family_event_occurrence_exception` function rechecks family membership, event tenancy, recurrence membership, replacement timing, and returns the exact original date as its mutation receipt. A disposable PostgreSQL replay of all migrations proves valid moves and cancellations, invalid-date rejection, direct-write denial, cross-family isolation, and cascade cleanup when the series is deleted.
