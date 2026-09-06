# Hours records: chosen scope and recorded learning days

Implementation and evidence for [#1095](https://github.com/sidneyswift/homa/issues/1095), F06 and F07 in the [meeting review](2026-09-05-cofounder-feedback-review.md). This document describes work under verification. GitHub holds live status; no deployment is claimed here.

## What Carolyng expected

Choose a child and a period, inspect the record, and download those records. Count each child's dates separately, with several activities on the same date counting once. A sick sibling's day cannot be inferred from another child's activity.

The prior download always exported the entire family. The state packet matched entries to children but then grouped by display name, merging children who shared a name. Chat excluded whole-family time from a selected child's total although Hours included it. These are separate defects with a shared scope contract.

## Exact record contract

- Child IDs establish identity. Names label records. A selected child includes their own entries and shared whole-family entries unless shared time is explicitly excluded. A family entry counts once in the family total and toward each child's record when included.
- Dates are inclusive calendar dates. Invalid, reversed, duplicate or unknown query parameters are refused. The default form uses the selected child, configured school-year anniversary and family-local today. Clearing both bounds exports the full archive, including any future-dated records; current-period totals still stop at today.
- A recorded learning day has at least one timed entry. Missing time does not establish absence, and these counts are not legal attendance certification. A shared record does not carry individual participation exclusions. An untimed attendance ledger needs a separate product contract.
- CSV preserves raw child names and full child/entry IDs. Subject and custom category remain separate. Quotes, Unicode and spreadsheet formulas are handled as data. Same-name children get a stable record suffix in selection, preview and packet labels so their distinct records are recognizable.
- The preview and downloads use the same predicate. Downloads carry the preview's revision. If any relevant record or roster value changes, the route refuses the old preview and asks for a new one. A failed read cannot produce a partial CSV or an invented zero.
- Chat's `byChild` describes shared-inclusive child totals. `byEntryScope` separately describes raw row attribution. Adding child totals together is not a valid family total when shared time is included.

## Verified implementation and remaining gates

The archive reader executes a repeatable-read, read-only transaction with family predicates and child ownership checks. Its output has no display-row cap. Disposable PostgreSQL tests executed the real reader and caller/pinned chat paths, including a 3,001-row archive, foreign-family denial, explicit dates and shared inclusion. The caller path used the actual Supabase SDK with a local read-only REST adapter executing PostgreSQL/RLS; this is not hosted authentication evidence.

Actual browser tests use the shipped React component, compiled design CSS, and the real preview/CSV route with injected authentication and storage. They open both downloaded files and compare contents, check 320px/390px/desktop layout, scope changes, pending/read failure, empty windows and changed-record refusal. A Next Link dependency needed an explicit fixture boundary; its initial missing environment failure did not establish a product bug.

The real packet composer and Chrome renderer generated PDFs from a same-name and a renamed-child fixture. PDF text and rasterized pages preserved separate 30m/40m totals and two dates for each child. Independent review then found that equal printed names were still ambiguous. Fresh PDFs and seven export browser journeys pass after adding collision labels. The combined Hours guard passes 135 unit checks and 16 browser journeys. One existing editor test originally searched the whole page for a sibling name; it now checks the displayed Hours record specifically, because the export selector legitimately lists every owned child. These synthetic renders are not hosted packet generation or physical printing.

The first independent review ran 145 tests and found two issues: ambiguous raw chat attribution and same-name visible labels. Both have implementation corrections in this branch. The actual caller/pinned PostgreSQL contract now checks child-inclusive totals and the separately named entry attribution. A real-model evaluation also found that “Just Avery” could incorrectly exclude shared time. The final eight-case matrix passes with all 93 tools competing: the Hours procedure loads first and returns the expected child/shared/date/empty/incomplete answers. One positive and four negative routing samples also pass. Earlier failed samples and harness corrections remain preserved. Those model samples used the preceding reader; the current tool and receipt validator pass the same deterministic cases, with final Eve integration still required.

The chat cap is now replaced by a STABLE, SECURITY INVOKER scalar JSON read. It calculates complete totals in one database snapshot and returns at most 50 recent entries, with notes bounded to 200 Unicode codepoints. Caller JWT/RLS and server-pinned access call the same function. The old capped readHoursPinned helper is removed. SQL uses the snapshot's family settings and TypeScript verifies its window against the existing calendar helper. Reader deadlines are 15 seconds, with a 2-second pinned lock limit; the existing outer fetch-tool deadline is 90 seconds.

The final integrated disposable PostgreSQL run passed the nine school-year/archive groups and 14 complete-summary groups on reader hash `361e4253`. It proves over 4,000 entries, caller/pinned agreement, a concurrent old/new snapshot, February 29 around 2100, owned/foreign identities, empty results and actual timeout refusal. The first integrated run caught a fixture assumption: September 10 was still in the future for its Los Angeles family. The corrected test proves both the through-today zero and the explicitly requested date's 500 minutes. No product date rule was changed to satisfy that test.

Independent review found the initial receipt validator could accept totals contradicting their shared-entry breakdown. The correction checks exact child/shared arithmetic, positive recorded days, sample amounts/date bounds and the Unicode note limit. All 22 focused reader/evaluation tests pass, and independent replay rejects the four original malformed receipts. The final PostgreSQL run uses this corrected validator. Separate UI/PDF review passed 131 checks and inspected both PDFs and ten images. Counts overlap.

Remaining release gates are final Eve routing/behavior integration, builds and required CI, the additive function migration, READY deployment and a populated hosted journey with actual downloads and generated packet. The issue remains open until those gates pass. Hours' existing display/Progress row caps still refuse incomplete results honestly; this change makes the chat summary and archive complete.

## Readable local artifacts

[320px child preview](../journeys/evidence/2026-09-06-hours-record-320-child-preview.png), [family preview](../journeys/evidence/2026-09-06-hours-record-390-family-preview.png), [same-name selector and preview](../journeys/evidence/2026-09-06-hours-record-320-same-name-preview.png), and [changed-record refusal](../journeys/evidence/2026-09-06-hours-record-320-stale-preview.png).

[Same-name PDF](../journeys/evidence/2026-09-06-hours-record-same-name.pdf), [renamed-child PDF](../journeys/evidence/2026-09-06-hours-record-renamed.pdf), [printed summary](../journeys/evidence/2026-09-06-hours-record-same-name-summary.jpg), [printed detail](../journeys/evidence/2026-09-06-hours-record-same-name-details.jpg), and [source/artifact receipt](../journeys/evidence/2026-09-06-hours-record-local-receipt.json). The packet script is `scripts/hours-record-pack-smoke.mts`; it creates only local synthetic artifacts and closes its renderer.
