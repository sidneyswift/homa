# Preserve distinct Hours entries and their work context

Source: [September 5 meeting review](2026-09-05-cofounder-feedback-review.md), F02-F03. Tracking: #1090 and #1093.

## Current repair

Separate activities no longer share an identity merely because child, subject, date and minutes match. New work uses its canonical parent message plus the model-selected activity ordinal; existing Planner completions use their exact saved target. The operation receipt and effect commit together. Retrying returns the current saved row, preserves manual corrections and deletions, and refuses a changed accepted payload.

The Planner fleet procedure chooses activity boundaries and one capture path. Exact code verifies identity, tenancy, source quotation, dates and writes. It never guesses activity sameness from text similarity. Family transfer preserves distinct rows and their linked record graph, or refuses the whole transfer on an actual identity collision.

Hours annotations preserve the saved activity title and note. A later standalone duration can refer to a book named in an earlier parent message through separately verified current and earlier source receipts. Both source role/visibility/member access and exact quoted spans are checked; a Homa suggestion is not parent provenance. Long visible notes respect the existing limit while the operation retains full context. Shared Hours annotations remain shared; private receipt payloads do not become a second route to another adult's private conversation.

## Verification already completed

The integrated identity PostgreSQL contract passed all 17 groups, including concurrent retries, same-shaped distinct sessions, edited/deleted replay, exact timestamps, real caller SDK/RLS, rollback/deadline and family-transfer races. The Planner contract passed its existing editor/Voice checks, 23 context groups, 39 caller-privacy requests and the receipt privacy/invariant cases. TypeScript, the Next build, the compiled print worker contract, Eve build and stream duration guard passed. Hours UI passed 153 unit checks and the current browser cases; the local browser command also discovered old Eve snapshot copies, which are not counted as additional product coverage. Calendar checks passed.

No new paid Hours model eval or final hosted capture journey is claimed. The initially prepared generic Eve evals cannot supply the canonical member/current-message context required by these writes. Those two invalid fixtures were kept outside the release, and the replacement test-only harness was frozen incomplete rather than shipped as evidence. Sidney directed shipment without further optional testing on September 6. Required CI and deployment checks remain the shipping gate.

## Rollout

1. Apply the expansion migration `20260907010000_learning_write_operations.sql` and additive context functions `20260907030000_hours_context_provenance.sql`.
2. Deploy compatible code and verify exact Vercel READY.
3. Apply all of `20260907011000_enforce_hours_capture_identity.sql` in one transaction. It installs the writer fences before removing the old coarse unique index.

Do not put enforcement ahead of compatible code or recreate the coarse index on rollback. The legacy phone writer without canonical per-call identity returns an honest no-write response. The revision-checked web editor remains supported. No broad backfill is included; the separately authorized exact historical recovery retains its own source and transaction review.

Production migration receipts, deployment and remaining follow-ups live on #1090 and #1093. This document records verified boundaries and does not substitute for issue status.
