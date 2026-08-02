# Planner feedback follow-ups implementation notes

## 2026-08-02 18:28 ET

**Plan-confirmed**

Carolyn's first real-use feedback after the Day-first Planner launch identifies three related expectations: one appointment or activity can belong to several children, recorded hours appear on the date they happened with subject and child context, and appointments or activities can repeat through an end date.

**Discovery**

The felt difficulty is not that Planner lacks views. It is that one family day is split across ownership, scheduling, and recorded-time concepts. The working hypothesis is that the Day view should remain the calm default while progressively disclosing richer family context inside that date.

Rival explanations to check before implementation:

1. Multi-child selection may be only a missing control over an existing many-child event model, or the database may currently permit only one child per event.
2. Hours may already be available to Day but visually hidden, or Day may deliberately skip the hours query for performance.
3. Recurrence may already exist in the event schema and only need a Planner control, or the production expansion path may be incomplete.

The smallest useful test is a code and schema inventory followed by focused fixtures: one shared appointment for two children, one family-wide read-aloud hours record on today's date, and one weekly co-op series with an explicit end date. No implementation choice is committed until those three fixtures can map to durable, tenant-scoped records without duplication or invented data.

## 2026-08-02 18:44 ET

**Discovery**

The inventory resolved all three rival explanations:

1. `family_events` stores one nullable `child_id`, so multiple children require a real ownership model. Duplicating an event row per child would make edits, deletes, and recurring-series changes drift. The implementation will keep one canonical event and add tenant-scoped child links, following the repository's existing `family_asset_children` pattern.
2. Day intentionally skips `hours_log`; only Hours loads the full record. Day will load the visible bounded date range and render recorded time after the day's plan. The full Hours view keeps its existing 3,000-row record query.
3. Weekly recurrence already exists and native expands it, but the web composer neither saves nor expands it. The missing work is UI and read-path completion, not a second recurrence model.

**Design decision**

The direct event composer owns appointments, co-op, trips, and other dated family commitments. Generated school-plan activities keep their existing Homa scheduling path. This preserves the established authoring-versus-scheduling boundary while allowing a recurring co-op or shared appointment to be added directly.

The Day hierarchy stays: fixed commitments, unfinished activities, finished activities behind a disclosure, then a compact Recorded time section. Child filtering is one local chip row shown only when the family has multiple children. Multi-child selection uses small pressed pills, not large checkboxes.

**Guard evidence**

`pnpm check:isolation` passed before any schema or query change against the configured isolation target. The first attempt failed because the clean worktree had no dependencies; dependencies were installed offline with the repository's pinned pnpm 10.12.1, then the guard completed successfully.

## 2026-08-02 19:35 ET

**Implemented**

- Added one canonical family event plus a tenant-scoped child-audience junction. Empty child links mean the whole family. The existing `child_id` remains as a compatibility marker for older clients.
- Added an atomic `save_family_event_with_children` RPC so the event and its audience cannot partially save.
- Added bounded Day-view hours reads and a compact Recorded time section grouped by subject with child or whole-family context.
- Added weekly recurrence with interval, weekdays, and an optional end date. Occurrences are expanded only for the visible Planner range, while edits and deletes continue to target the one series.
- Added the same multi-child, recurrence, recorded-hours, and device-calendar behavior to native and web Planner surfaces.

**Progressive disclosure gate**

The default composer now asks only what is happening and when. Time is optional. Audience and recurrence sit behind one `Who and repeat` row whose summary exposes the current defaults. Multi-day duration is hidden behind `Lasts more than one day`. The Day view shows child filters only for families with multiple children and Recorded time only when entries exist.

Fresh Homa UX, copy-reader, and copy-editor passes reviewed real simulator captures. Accepted fixes included removing competing end-date concepts, changing `Set a time` to `Add a time`, naming destructive actions explicitly, standardizing `device calendar`, and adding recovery steps to save, delete, and refresh failures.

**Verification**

- Tracking: GitHub issue #704.
- Signed-in iOS Planner loaded without the prior refresh error and opened the compact event composer.
- Disposable Postgres migration exercise passed multi-child save, idempotent retry, wrong-family rejection, and whole-family transition.
- Full isolation guard passed, including cross-family child-audience and RPC rejection.
- `pnpm check:mobile-planner`: 29 passed.
- `pnpm check:calendar-ui`: 151 passed.
- `pnpm check:hours-ui`: 51 passed.
- Focused unified Planner and family-event tests: 38 passed.
- Mobile and web typechecks passed.
- Full lint passed with only pre-existing warnings outside this change.
- Node 24 `VERCEL=1` Eve build passed, followed by all three stream-duration checks.

## 2026-08-02 19:47 ET

**Preview build correction**

The first Vercel preview correctly rejected a client bundle that imported recurrence and audience helpers through `family-events.ts`, which also owns raw Postgres access. The pure helpers now live in `family-events-model.ts`; client Planner modules import that boundary directly, while the server module re-exports the same functions for tools and tests. The exact full Next 16 production build then passed locally, followed again by web typecheck, lint, all 38 focused Planner tests, the Node 24 Eve build, and the stream-duration guard.
