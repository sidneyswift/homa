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

## Production receipt, September 6

[PR #1130](https://github.com/sidneyswift/homa/pull/1130) merged as `7ce8f66f57285a137029d38b239fc4172d7f7919` after required CI run `34069083033` and Vercel passed. Exact production deployment `dpl_4k3TW9esV8WVK6YZHNjWuV3NotXK` reached READY before enforcement. Live migration versions are `20260907000650` (operation expansion), `20260907000700` (context provenance), and `20260907002838` (enforcement). The capture and immutable-identity triggers are enabled, and the obsolete coarse unique index is absent.

The separately reviewed recovery committed two missing 30-minute entries, two immutable receipts and one link to the already-completed activity. September 3 reading changed from 35 to 95 minutes. No new activity was created. Only the target’s duration, false already-counted note and update timestamp changed; original completion and source history remained intact. A fresh post-commit inspection confirmed identical full-row fingerprints for all preexisting Hours, other activities, participants, old links/receipts, canonical sources and family membership. Sibling activity and Hours rows matched exactly. Raw family evidence remains private and outside Git.

The recovery template SHA-256 was `108f2dfb546872a739f50102dc0469f939e727e6ce3b6e7b20ce5e5170338372`; the reviewed execution SHA-256 was `f6c591fc659ee9d5c48e564430e6599f5dd17b7087cfd26397ca081364de6d89`. The inspection and post-commit digests were `0a20d73f406aaa4aae200afb4a5b114412c251c841c5f4412a7a7ce4c6b8970f` and `3ac4c8409b1bb8b44666ce7ad46c378c1f85fc662de269beb981dce67db09b02`. This certifies that exact recovery and database safeguards, not an unrun full conversational journey or a broad historical backfill.

## September 7 category implementation notes, #1035

- 2026-09-07, plan-confirmed: implementing persistent family categories under canonical Hours subjects, category reuse and rename, mobile-web filters/subtotals, and exact chat reads. The main checkout belongs to onboarding work; implementation uses `codex/gh-1035-hours-categories` in the existing Binder checkout.
- 2026-09-07, discovery: the current CSV already separates Subject and Category after #1122. Preserve that shape and update only subject display names. The former audit paragraph describes the earlier state.
- 2026-09-07, discovery: all writers still save `custom_label`, and family transfer moves Hours rows. Add a catalog synchronized at the database boundary so chat, Planner, and existing clients reuse categories consistently. Preserve original operation receipts and exact minutes.
- 2026-09-07, plan-confirmed: unused categories remain available. Duplicate exact names reuse the same family/subject category; names in different subjects remain separate. Category renaming applies to existing entries atomically. Time never enters a progress score.

- 2026-09-07 14:01 UTC, discovery and repair: independent review reproduced the risk of a concurrent rename missing an uncommitted Hours insert. The catalog relationship now has a composite foreign key with cascading rename and a key-share lock at every writer. The exact two-transaction test passes without orphan labels or changed capture identity.
- 2026-09-07 14:01 UTC, discovery and repair: saved categories accepted 40 Unicode codepoints while chat and voice still limited UTF-16 units. One shared name schema now covers catalog, chat, pinned capture and voice receipts; a saved 40-emoji name parses through the real writer schemas.
- 2026-09-07 14:01 UTC, plan-confirmed: nine PostgreSQL groups, 17 current-component browser journeys, 153 Hours unit checks and 17 focused category/tool checks pass. Full web typecheck, Eve build and all three stream-duration checks passed. Independent review accepted the final source and artifacts.
- 2026-09-07 14:01 UTC, deviation: the initial named-category model rubric prescribed catalog lookup before a filtered read. The model instead returned the exact Portuguese subtotal from a complete scoped `byCategory` receipt. Independent review accepted that valid path; the rubric now tests exact scope and evidence, preserving the initial failure. The separate create/rename routing failures were fixed by putting skill loading first in the tool description. Both reruns load the skill and return correct saved receipts and familiar subject names.
- 2026-09-07 14:01 UTC, plan-confirmed: root applied the additive migration as production version `20260907140103`, source `20260907120000_hours_categories.sql`. A fresh read verified 348 Hours rows unchanged, two catalog rows, no orphan labels, RLS, validated deferrable FK and enabled triggers. Code deployment and authenticated hosted verification remain pending. [Source hashes, screenshots and model receipts](../journeys/evidence/2026-09-07-hours-categories/receipt.json).

- 2026-09-07, final display check: the common entry label now keeps parent subject and category together in Day, Week and Hours. All 25 label/scoping checks, 17 browser journeys and web typecheck passed after this final consistency change.

### What this changes for the next Hours change

- Preserve category relationships at the database boundary because chat, Planner and older clients all write Hours.
- A catalog read is not the only exact read path: complete scoped category aggregates are authoritative, while a bounded entry sample is not.
- Use canonical subject ids only in tool inputs and stored data. Parent-facing names belong in the UI and response.
- Test concurrent rename with an uncommitted insertion, not just sequential rename and read.
