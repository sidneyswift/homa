# Recurring Calendar and month-conflict verification

FIXED for [#1104](https://github.com/sidneyswift/homa/issues/1104) on September 6, 2026. [PR #1118](https://github.com/sidneyswift/homa/pull/1118) merged as `ff3258bf999f665a6ca7154ba0c7df73aae481f4` after `build-and-check` and Vercel passed on exact head `e26bb582679bef039c0222d832c8378118c509b3`, CI run `34053769856`. Production deployment `dpl_GqecEToGFhZepcQZgfTKzRx5uB1B` reached READY, its aliases included `thankshoma.com`, its Git source matched the merge, and the live root returned HTTP 200.

The successful authenticated mobile-web run finished at **19:20:28 UTC** with **205 checks passed**, eight complete seven-day Week states and two Day event details. Three synthetic children, three events and their occurrence exceptions established these outcomes:

- A weekly August series appeared in September for both selected children and excluded the third child.
- Canceled dates disappeared. A moved occurrence appeared only on its replacement date.
- An October occurrence moved earlier into September was included, with its original October date visible in details.
- Moving that occurrence again removed its old replacement dates and displayed the new date. A later weekly cancellation disappeared too.
- A whole-family event appeared for the child excluded from the shared series.

Root inspected the five screenshots: [moved-in event](2026-09-06-recurring-events-moved-in.png), [excluded child](2026-09-06-recurring-events-excluded-child.png), [original-date provenance](2026-09-06-recurring-events-moved-provenance.png), [whole-family audience](2026-09-06-recurring-events-whole-family.png), and [revised date](2026-09-06-recurring-events-revised-date.png). Every checked Week had a 390px viewport and document width.

Separately, the actual deployment-identical `createMonthPlanDraft` and `reviseMonthPlanDraft` functions read the same production fixture through a local worker that wrapped each source query in a read-only transaction. They returned exactly **11 initial conflicts and 7 revised conflicts**, comparing all five fields for every expected tuple. Event, child-link and exception snapshots remained unchanged during reads. The [sanitized receipt](2026-09-06-recurring-events-live-receipt.json) records the exact results, query hashes, hosted states and cleanup.

This deliberately distinguishes hosted Calendar rendering from local execution of deployed source against production data. It does **not** certify hosted model/tool dispatch, a dedicated web month-preview renderer, native touch behavior, or a curriculum-to-approved-month journey. The last belongs with the owned-curriculum work in #1101; full-year scheduling remains #1108. The implementation introduces no new scheduling or approval policy. Existing unpaginated Data API and separate-request consistency limits remain in the [implementation contract](../../plans/2026-09-06-recurring-plan-conflicts.md).

The browser admitted 320 requests out of 454 attempts, with one exact sign-in mutation, no other browser mutation and no uncaught page error. No model, materials, Hours, plans, working drafts, schedules or outbound messages were created. All owned family/Auth/session/child/event/link/exception/telemetry rows were verified removed. Deletion job `d8a328d4-7b85-4c9d-a699-eb4ac3fc0454` and its artifact-denial tombstone remain for the canonical worker and token drain; complete provider cleanup is not claimed.

The first attempt passed nine states and both calculations before the probe's request counter blocked the last document navigation. Its screenshot showed Chrome `ERR_BLOCKED_BY_CLIENT`; all owned data was removed. Root preserved that failed receipt and source, retained the 400 admitted-request cap, added a separate 600-attempt cap, and passed 81 offline assertions before starting the new fixture. No failed mutation was retried. The final probe SHA-256 is `173221cce0de991dfbee1fda197987da26bed7a90d16530b1a3708922a88acaa`.
