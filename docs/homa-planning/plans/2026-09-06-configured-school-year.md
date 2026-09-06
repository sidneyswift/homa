# One configured school-year window

Implementation and evidence for [#1096](https://github.com/sidneyswift/homa/issues/1096), from F08 in the [meeting review](2026-09-05-cofounder-feedback-review.md). **FIXED** by [PR #1119](https://github.com/sidneyswift/homa/pull/1119), main `b8b7969393e9421c36e33e33e623b2ce5a4a5375`. The [hosted receipt](../journeys/evidence/2026-09-06-school-year-live-verification.md) records READY deployment, 381 passing assertions, actual Settings saves, nine Hours states, a summary read and complete fixture cleanup. GitHub holds live status.

## Expected and observed behavior

Carolyng expected school-year totals to describe her family's school year. At the September 6 audit, Hours used July 1, chat and Progress used August 1, and compliance used the saved family date. Hours also discarded records before its assumed school-year start before calculating week and month totals. That made those shorter periods wrong when they crossed the year boundary. Current-period totals could include future-dated records, and bounded reads could report incomplete totals as complete.

The existing family field, `school_year_start_on`, already defines a recurring month/day anniversary. This change reuses that contract. It introduces no academic-calendar policy, assessment score, state-law interpretation or schema change.

## Implementation contract

- `schoolYearStartFor` validates complete Gregorian dates and finds the latest valid anniversary on or before family-local today. February 29 remains February 29, including the eight-year gap around 2100. No February 28 substitute is invented.
- `resolveHoursWindow` supplies the same school-year window to Hours, chat and Progress. State Records and current packet reads use the same anniversary and through-today boundary. Week and month are calculated independently. Explicit historical Day and Week views retain their supplied dates.
- Missing or invalid settings produce an explicit All time label through today, with the existing Settings link. The Settings action accepts an explicit blank as a clear, preserves the date when the field is absent, validates nonblank input against the family's local date, and derives the family from authenticated membership.
- Caller-JWT reads request an exact count; pinned SQL returns a window count. A capped or unverifiable read cannot produce period or day totals. Chat returns `found: null, complete: false` on incomplete reads and handled read failures, rather than claiming no entries exist.
- Progress Hours remain display-only, separate from skill evidence. Current shared-family inclusion in Hours and Progress is preserved. State Records names the exact resolved start instead of assuming a one-year interval for leap-day settings.

## Verification before publication

Root applied the reviewed v2 candidate after the isolation guard passed. The original candidate had failed to hide incomplete day totals and omitted its new test file from CI; those defects were corrected before integration. Root verified every frozen candidate hash and inspected the actual readers and call sites.

- Disposable PostgreSQL applied all 191 migrations and passed the existing atomic activity/Hours contract plus eight school-year reader groups. These executed actual caller, pinned, Progress and packet functions, including foreign-family RLS denial, family-local midnight, missing settings, future records, lower response caps, exact 3,000 versus 3,001 rows, absent counts and read errors. The local caller SDK used a read-only HTTP adapter executing real PostgreSQL and RLS; this was not a hosted PostgREST or cookie-authentication test. The disposable cluster was removed.
- Hours: 100 pure assertions and nine actual-component checks passed. Progress UI: 374 tests passed. State-pack checks, including the actual Settings action/writer and exact date-caption contracts: 299 tests passed. Test counts overlap in their coverage and are not a reliability percentage.
- Root inspected three 390px captures of the actual Hours component with real compiled CSS and local fonts: configured start, unset start and incomplete read. They had no document overflow. These were static React renders in a fresh offline browser, not a hydrated route, authenticated journey or mobile-device certification.

The fresh technical reviewer found no introduced blockers and independently passed 76 deterministic tests in an empty environment. Reader feedback added the exact school-year start beside totals and a recovery instruction for incomplete reads. Interface review confirmed the setting link is recognizable and identified existing small-label and shared-total explanation limits; the actual embedded Planner supplies scope guidance and omits the standalone compliance heading. The final error notice distinguishes a loading failure from a record change. Root retained the complete gate outputs locally.

The Next production build and Chromium traces, standalone hosted-shape Eve build, all three stream-duration checks, typecheck, changed-path lint and design contract/parity passed. Both required checks passed on exact PR head `633760a6220f947cf0858285fe4de96dcb04f911`; production deployment and the bounded authenticated journey subsequently passed as recorded above. No model judgment procedure changed; date arithmetic, tenancy and completeness are tested at the deterministic layer.

## Boundaries carried forward

The whole-history cap can conservatively hide a recent total even if all recent rows were returned. Full pagination and shared-child chat semantics remain [#1095](https://github.com/sidneyswift/homa/issues/1095). Historical Day/Week lists retain their existing bounded-reader behavior. Future-dated records remain visible as records in Hours while being excluded from through-today totals.

The separately reviewed hosted operator defaults to no-op. Its successful fixture used two children, six Hours rows, two actual Settings saves and six actual child-scope changes. Hosted Settings, Hours and the read-only compliance summary are distinct from local execution of deployment-identical Progress/packet readers against the same production fixture. A generated compliance PDF, native screen, physical printout and model conversation are not implied by these checks. Its first run discovered an older approved but unapplied Second language constraint migration, repaired as #1120 before the successful journey; this release introduced no new schema design.

## Local screen evidence

[Configured start](../journeys/evidence/2026-09-06-school-year-configured.png), [unset start](../journeys/evidence/2026-09-06-school-year-unset.png), [incomplete read](../journeys/evidence/2026-09-06-school-year-incomplete.png), and [source and image hashes](../journeys/evidence/2026-09-06-school-year-local-captures.json). These show actual component markup and final copy in an offline browser; they are not a substitute for the live journey.
