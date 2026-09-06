# Recorded-time editing production verification

[Issue #1092](https://github.com/sidneyswift/homa/issues/1092) is FIXED by [PR #1117](https://github.com/sidneyswift/homa/pull/1117), merge `78f3b4e67f957370c9acecb21250ff68dda76b1d`. Required build-and-check and Vercel checks passed on exact head `f9b7647a2f3ffc971c623796879a25d9d6cb3e18`; CI run `34051879635` succeeded. Production deployment `dpl_3uBkrQWyiyhsFBwb7cBkLCCrWoNT` reached READY, its Git SHA matched, and both production aliases and an HTTP 200 probe were checked before the browser run.

## What actually passed

From 18:55:03 to 18:55:48 UTC on September 6, a fresh isolated browser signed into one new synthetic sandbox family at `thankshoma.com`, at 390px width. Its eight edit/delete submissions, nine context reads, fourteen rendered states, exact database snapshots and cleanup produced **465 passing assertions**. [Sanitized machine receipt](2026-09-06-hours-live-receipt.json).

- Day opened the full saved note. Cancel left the record unchanged. Correcting an intentionally mismatched linked record reconciled the activity and both children's Hours to 17 minutes and Science, while changing only Avery's category/note and preserving Blair's annotations and original source provenance.
- Week opened the same corrected record and saved a note-only correction. School hours read back the same authoritative context. Selected-child view, route and date remained intact.
- The combined Planner detail save changed title, Planner note and duration to 19 in one action, with both linked Hours at 19 and their row-specific notes preserved. Avery's displayed total progressed from 33 to 39 to 41 minutes as expected.
- Shared deletion explicitly named both children, removed both time records and retained the finished activity with its Planner notes and null duration. The selected total became 22 minutes.
- Standalone time changed to 18 minutes with its category/note, then deletion removed only that row. The total moved from 23 to 5 minutes.
- Whole-family time changed to 6 minutes, then deletion removed that time while preserving the finished activity. No recorded-time rows remained; both finished activities and their original provenance remained before fixture cleanup.

Root inspected all six final production screenshots: [full note and editor](2026-09-06-hours-full-owned-record.png), [Planner correction and total](2026-09-06-hours-planner-and-hours-corrected.png), [shared deletion](2026-09-06-hours-delete-shared-confirmation.png), [standalone deletion](2026-09-06-hours-delete-standalone-confirmation.png), [whole-family deletion](2026-09-06-hours-delete-whole-confirmation.png), and [finished activities retained](2026-09-06-hours-finished-activities-kept.png). The full-page capture is browser evidence, not a physical phone or keyboard certification.

## Database deployment

The additive migration source `20260906170000_atomic_hours_edits.sql` was applied once as live version `20260906183819`, before the code release. Its exact stored statement matched the source, with SHA-256 `b61fdaec47a3c1c19220338ee43322836e4773a9d4ba79b5a4ad082528509b38` and stored MD5 `aa64440e748be3c56a9aa9d13e7ce3c3`. All five function bodies and empty search paths matched. Anonymous execution is denied; the lock helper also denies direct authenticated execution. The hosted probe checked the four public function definitions before writing.

## Probe failures and limits

Two earlier runs failed in the probe, not in a demonstrated product mutation. The first used an incorrectly scoped nested Playwright locator before saving. Root reproduced that locator failure and fixed it. The second observed a successful save and correct 17-minute durable fan-out, then hung awaiting `response.finished()`. In installed Playwright 1.62.1, an aborted request after response headers can leave that promise unresolved. Three actual-method replays reproduced the observer behavior. The corrected probe uses a bounded per-request transport observer and retains exact request arguments, durable-state and refreshed-UI gates. It never resends an uncertain mutation.

The successful run still records browser `net::ERR_ABORTED` terminal events after several successful RSC actions. It proves visible and durable completion; it does not claim every HTTP body reached EOF. Each earlier fixture was fully removed. Native direct writers, forced hosted concurrency/rollback injection, model judgment, physical touch/keyboard and the full provider account-deletion lifecycle are not certified by this browser run. Local real-PostgreSQL concurrency/rollback and browser failure-state tests are documented in the [implementation contract](../../plans/2026-09-06-hours-atomic-editor.md).

## Cleanup

The final probe removed its family, Auth user/sessions, children, memberships, all Hours/activity links, activities and conversation rows, with exact zero-count readback. No email, model usage, material, asset, studio run, schedule, phone, event or working-plan side effect appeared. Deletion job `110846ef-765f-4326-94e5-dd23106a89e9` and its artifact-denial tombstone remain for the canonical cleanup worker and token drain.

The earlier three chat-created Hours/Planner fixtures in the existing ActivationTest sandbox were separately removed only after full row/link snapshot equality under locks. Readback found zero of those owned Hours and activities. Its existing worksheet `00a8c07c-1b5b-456d-a751-beb062410d15`, source audit message, family and children were preserved. This does not claim all data in that pre-existing sandbox was deleted.
