# Current-material print handoff

Issue [#1105](https://github.com/sidneyswift/homa/issues/1105), transcript reference F26 in the [meeting review](2026-09-05-cofounder-feedback-review.md). GitHub holds release status. This file records the behavior, implementation and evidence.

## What the parent expected

A request to print the visible material should lead to usable pages on that device. The meeting's idea of a worksheet appearing at a printer without further interaction remains a separate concept in #1108. Opening a PDF, presenting Apple's print sheet and producing paper are different observable outcomes.

The active `prepare_material_print` tool was available to web chat but returned a claim that Apple's sheet was opening. Web had no consumer for its `printRequest`. Native voice consumed the request, while native text did not. The audit verified this producer/consumer mismatch in code; it did not find a specific Carolyng tool call exhibiting it.

## Implemented procedure and exact effects

The existing fleet `materials-studio` skill owns interpretation: identify the visible material, preserve the parent's requested copies and answer-key preference, and resolve ambiguity. A change-plus-print request first creates a revision for the parent to review. A plain positive reaction remains the existing keep workflow. This adds no printer provider or automatic printing.

The existing preparation tool returns a coherent receipt for the exact current material, its page count, ordered page indexes, requested copies and answer-key selection. It finalizes an approved visible draft only after validating the selection. A request to exclude an answer key is preserved even when the document contains no answer-key pages; the receipt does not falsely claim any page was removed. Unknown roles and stale or foreign records refuse. The current revision is the newest available final or review-passing draft; a failed newer draft cannot hide a kept final. Binder keeps the final in its saved shelf while a passing revision awaits review. This selection is shared by chat, active-material authorization and the transactional print precondition.

SMS receives a sign-in link carrying the exact selected-page options and copy reminder. After sign-in, the PDF route revalidates the current material. A stale SMS link refuses; this release does not add a new landing page.

Web and native text render the same validated receipt. Merely loading conversation history has no preparation or print side effect. Explicit activation rechecks the exact material and options; a changed selection requires the parent to view it again. Web opens the selected PDF and asks the parent to confirm copies in the print dialog. Native passes the selected PDF to its existing system-sheet integration and preserves cancellation, failure and system-completion outcomes. System completion still does not establish physical printing. Native status announcements use the shared accessibility hook.

The new authenticated selected-PDF route uses caller JWT/RLS, rechecks the current revision before and after fetching, and accepts only the family's configured artifact store. It copies the selected static pages, preserving their dimensions. The parser runs in a terminable worker with bounded bytes, pages, time and memory. Interactive, encrypted, corrupt and mismatched documents refuse. No new durable PDF is written for selection. Existing historical PDF access stays available through the authenticated original-PDF route.

The additive three-argument `finalize_family_material` variant takes the exact current-material precondition under family/material locks. Concurrent finalization, stale revisions and chain changes cannot approve a different node. The ordinary two-argument Keep operation remains compatible. Caller and pinned server paths are covered by a disposable PostgreSQL contract, now wired into required CI.

## Verification on the integrated branch

Base: `8e70c942e6016119c58110a9b8e32d9ac96269e0`. The initial prepared bundle predates this base; it is separate evidence. Root integrated and reviewed the current code, installed exact `pdf-lib` 1.17.1 and updated the lockfile.

- 509 material checks and 54 real PostgreSQL groups pass with all 194 migrations. The latter includes 20 title-search cases covering literal punctuation, caller RLS, pinned scope, old records beyond the recent shelf, and legacy schema fallback. The PostgreSQL cluster was disposable and removed.
- 313 chat UI checks pass. The two-tab browser case passes; local Playwright also discovered four archived Eve snapshots of that same case, so those five executions are not five unique scenarios.
- 112 native chat and 150 native voice checks pass. Native accessibility passes its source guard, 18 deterministic tests and 36 rendered tests. The initial guard caught the new card bypassing the announcement adapter; that was corrected. Native interface gauntlet: 33 checks.
- Web and native typechecks, focused web lint, native lint, fleet hygiene and 25 tool deadline checks pass. The final native announcement edit is rechecked separately.
- The real Next production build passes. Its selected-PDF function trace contains 304 files, no missing paths, and every required PDF-library dependency. This is a packaged-build proof; live route execution remains a release gate.
- A root rerun using the integrated React card and actual preparation/download handlers passes 10 browser checks at 390px and 320px. It opens a real two-page subset from a three-page fixture, verifies no history side effects, refuses stale preparation/download, and handles blocked popups. Authentication and artifact retrieval in this local run are synthetic. The narrow-screen result was visually inspected.
- The integrated native fingerprint equals the prior production fingerprint, `bc62e95f737ecb7dec5083286e8dc4f08813b7b1`. Publication and installed-device behavior require their own evidence.

The final integrated Next build, Vercel-mode Eve build and all three stream-duration checks pass after the routing and retrieval corrections below. Web/native typechecks and fleet hygiene pass. Focused lint has no errors; one unchanged unused-import warning remains in an existing eval-blob-store test.

The six-case sandbox run passed four cases and failed two: preparation skipped the fleet skill, and a change-plus-print request did not deliver a usable revision. The revision fixture was replaced with a dedicated, valid four-row Sound practice page, rendered through the real PDF renderer and inspected; its synthetic kept state is not a fabricated review result. The corrected run delivered the requested revision but exposed a named Binder retrieval failure: the tool searched title words as subject/theme filters. The existing tool now accepts an optional literal title search on both authenticated paths, with exact escaping and deterministic database checks. The fleet procedure distinguishes generated Binder work from uploaded Library sources.

The next eight-case model run passed seven; the older named packet was correctly found and shown, but that case skipped skill loading. Explicit routing descriptions corrected the remaining load omission. The final four-case routing run passed all 16 gates: named Binder reopening, print handoff, adjacent negative routing and uploaded worksheet reopening. The other exact-print, revision-before-print, SMS and cross-object cases passed in the eight-case run. Original failures remain preserved; none is relabeled as a pass. Required CI, additive migration, READY deployment and hosted acceptance remain release gates. No physical-device or printer certification is claimed by local checks.

## Evidence locations

The local integration receipts are under `/tmp/homa-feedback-implementation/1105-*`. The reviewed preparation is retained under `1105-prepared` and `1105-refreshed-bc8f00af`; original failures are preserved. Repository screenshots and release receipts accompany the final PR evidence.
