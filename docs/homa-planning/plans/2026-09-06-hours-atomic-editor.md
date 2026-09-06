# Hours and Planner atomic corrections

Implementation and evidence for [#1092](https://github.com/sidneyswift/homa/issues/1092), following F01 in [the September 5 feedback review](2026-09-05-cofounder-feedback-review.md). The issue owns rollout status. This document records the mobile-web repair and its local proof; it does not certify a hosted deployment or physical touch behavior.

## Problem and bounded contract

A parent could change an Hours row from 10 to 11 minutes while its explicitly linked Planner activity stayed at 10. Planner's detail form also sent title/note and time in separate transactions, so a rejected time change could leave the other fields saved.

One existing Planner activity has one subject and duration. Its child-specific Hours rows are projections of that activity, not independently timed child lessons. The correction follows that current contract:

| Action | Durable result |
| --- | --- |
| Edit standalone Hours | Update that row's minutes, subject, category, and note. |
| Edit explicitly linked Hours | Update the activity and all its valid linked rows to the same minutes and subject. Update only the selected row's category and note. |
| Delete standalone Hours | Delete only that row. |
| Delete explicitly linked Hours | Delete all the activity's linked recorded-time rows and clear its duration. Keep the completed activity, title, Planner note, audience, completion date, and source provenance. |
| Save Planner details | Save title, Planner note, and duration in one transaction, including the existing linked-time effect. Any duplicate-time conflict rolls back every requested field. |

Dates, participants, source channels, source quotes, message IDs, completion evidence, record IDs, and creation timestamps are not rewritten by the Hours editor. Planner title/note and the Hours note remain separate fields. The original Planner source quote is never copied into a title or overwritten by a correction. Raw source quotes and source message IDs are not returned by the editor-context endpoint.

No founder decision was needed to apply the existing activity-wide duration rule. Historical repair, per-child durations for one activity, moving time to another date/child, and immutable provenance for standalone mutable notes remain outside this repair.

## Implementation

- `supabase/migrations/20260906170000_atomic_hours_edits.sql` adds authenticated context, edit, delete, and combined Planner-save functions. The private resolver locks the activity before its links and Hours rows, checks family membership from `auth.uid()`, and validates the complete link/audience shape. The public context endpoint returns only the fields needed to explain and edit the record.
- Hours revisions include the affected Hours rows, Planner activity, and participant IDs. A stale editor, changed sibling row, multiple owner, mismatched date/audience, or partial fan-out returns a conflict before mutation. A known duration/subject mismatch is allowed so the requested correction can reconcile it. The transaction preserves the current coarse uniqueness constraint and rolls back the whole edit if it collides.
- `apps/web/app/app/hours/actions.ts` uses the new authenticated RPCs and accepts success only with a matching entry receipt. Invalid input and unexpected transport responses remain failures. Uncertain network responses tell the parent to reopen and check; they do not falsely claim rollback.
- `apps/web/app/app/planner/actions.ts` and `unified-planner-view.tsx` use one combined detail-save action with the activity's observed update timestamp. A rejected or interrupted action keeps the form open and releases pending state.
- `apps/web/app/app/hours/hours-entry-overlay.tsx` is shared by Hours, Day, and Week. It fetches authoritative link context even when Hours receives no Planner activities. It shows the full saved Hours note, separate Planner notes, recorded date, and affected audience. Shared edits explain the activity-wide fields and selected-row annotations; shared deletion names everyone and states that the finished activity stays.
- Day and Week recorded-time rows open the same editor in place. Week retains its Day navigation links and puts the recorded-time controls outside those links. `recordedHoursForDate` keeps recorded-date and selected-child scope, including whole-family time.
- Loading/retry, draft-preserving failure, pending controls, Escape/backdrop dismissal, keyboard focus containment, error focus, confirmation focus, cancellation return focus, and final-row deletion return focus are handled in the shared overlay. The surviving Planner/Hours root is the deletion fallback.
- `apps/web/lib/voice/action-receipts.ts` includes category in exact Hours undo comparisons. An older voice receipt cannot undo a subsequent category-only correction. Legacy receipts without a category match only null categories. `apps/web/agent/tools/log_hours.ts` now captures its existing category field so an unchanged categorized entry can still be undone.

## Compatibility limits

`apps/mobile/src/lib/hours.ts` remains a direct table writer. This change does not revoke its privileges or claim a database-wide invariant across native and legacy callers. A native direct edit can still create a cross-surface mismatch; adopting the authenticated correction primitives there is a follow-up candidate. Existing Planner RPC signatures remain callable.

The coarse Hours uniqueness key remains unchanged until [#1090](https://github.com/sidneyswift/homa/issues/1090). Collisions fail without partial saves. The new resolver rejects malformed linked fan-out rather than reconstructing missing historical rows. An activity with no linked rows follows the existing Planner time-save behavior when the parent deliberately records time.

Legacy `source='chat'` also covers some time manually entered in Planner. The editor therefore uses the supported generic school-time provenance line for that value instead of inventing a Chat utterance. Standalone Hours notes remain mutable; richer note/provenance composition belongs to [#1093](https://github.com/sidneyswift/homa/issues/1093).

No fleet judgment, routing, prompt, or model setting changed. Paid model evals were not used.

## Local evidence and test matrix

The unchanged isolation guard passed before query/schema edits using its established bounded fixture lifecycle. Migration-version guards passed before and after the new migration. Every new database test used a disposable PostgreSQL 17 cluster; no new migration was applied remotely.

| Layer | Cases and result |
| --- | --- |
| Real PostgreSQL | Single child, multiple children, whole family, standalone email source, 11/10 reconciliation, original metadata/IDs, scoped lookup, missing/foreign/malformed IDs, anonymous/helper denial, invalid bounds, Unicode note limits, stale sibling edits, malformed partial/multiple-owner links, uniqueness rollback, combined Planner rollback/success/clear, unfinish then re-record, concurrent edit versus delete, category-only correction versus old voice undo. Passed via `pnpm test:planner-learning-log:postgres`. |
| Voice PostgreSQL | Existing receipt lifecycle, retry, expiry, scope, interruption, Planner, task, and concurrent-state guards. Passed via `pnpm test:voice-action-receipts:postgres`. |
| Hours units and browser | `pnpm check:hours-ui`: 75 unit/static cases and 9 Chromium journeys. Day/Week/Hours full-note load, cancel, 11-minute save, unchanged route; 320px draft-preserving failure, pending dismissal prevention, shared deletion, focus after final-row refresh; lookup retry and Escape return focus; combined Planner detail transport failure, preserved draft, and successful retry; 320px and 390px widths with a shortened 420px viewport, fully visible focused Minutes and Save/Cancel, Unicode note limits before submission. |
| Planner units | `pnpm check:calendar-ui`: 225 cases passed. |
| Types and lint | Workspace typecheck/lint excluding unchanged mobile, plus web-focused checks. All five tasks passed, with three cache hits. No new lint warnings; four pre-existing unrelated warnings remain. |
| Agent build | Local `VERCEL=1` Eve build and stream-duration guard use the same generated co-deployed service signal as CI. This is local compilation evidence, not deployment evidence. |

`apps/web/e2e/hours-editor.spec.ts` bundles actual product React and application CSS. Its boundaries mock Next routing/actions and plan checks with synthetic family rows. The Hours fixture mirrors the real server's child scoping and omission of Planner activities. Browser tests do not substitute for the separate PostgreSQL contract or for a hosted route probe.

Set `HOURS_EDITOR_EVIDENCE_DIR` when running the Hours guard to preserve 390px Day/Week/Hours context, editor and lower-action views, plus 320px shared-delete confirmation. The local evidence directory is `/tmp/homa-feedback-implementation`; logs use `1092-*.log` and images use `1092-*.png`. Final local captures set `HOURS_EDITOR_DM_SANS_FONT` to the existing Next-generated variable DM Sans WOFF2 referenced by `.next/static/chunks/3auw4nk4dhl-i.css`, serving weights 400 through 700, and use the repository's EB Garamond 600. Without that optional font path, the test falls back to the repository's single DM Sans 700 file and must not be used to judge weight hierarchy. No font asset or product font changed. It does not certify physical touch, keyboard appearance, full device accessibility settings, or hosted RSC delivery.

Design token, contract, parity, and brand-residue guards passed.

Independent technical review identified the category-only undo gap and the disappearing last-row focus target. Both were corrected and included in regression evidence. Root's completed copy and UX gates are recorded below. Hosted deployment and live route/database probes remain separate rollout gates.


## Follow-up to the first local implementation

The first implementation is preserved in commit `5ae2df86034a94b78f1ad127f3b255b2b47bb687`. Root review found an intermediate uniqueness conflict: changing a linked row from 10 minutes with no category to 30 minutes with category `club` was rejected if a separate 30-minute, uncategorized entry already existed. The final requested row was unique, but the first bulk update evaluated the old category before the next statement changed it.

A new real PostgreSQL regression reproduced `conflict` instead of `applied` before the fix. The linked bulk update now applies the selected row's category and note in the same statement as subject and minutes, preserving sibling annotations. The two-child regression then passed; requesting an actually duplicate final category still rolled back all requested fields. Logs: `1092-simultaneous-before.log` and `1092-simultaneous-after.log`. The unchanged isolation guard and migration-version guards passed again before the query/migration edit. The migration remains local and unapplied remotely.

Fresh copy and UX feedback accepted by root produced these bounded changes:

- The top identifies the activity and everyone affected by time/subject changes. An unqualified selected-child label no longer precedes shared consequences.
- The selected child's category and note are grouped under a disclosure named for that child. Planner notes are a separate read-only disclosure. The category hint distinguishes it from Subject, and a Unicode-consistent live 200-character note counter prevents an over-limit submission.
- Save and Cancel sit outside the scrolling content. Focused fields scroll only as far as needed to remain fully visible. Tests use 320px and 390px widths at 420px height as a constrained layout test, not an assertion about physical keyboards.
- Deletion has its own state with only `Delete recorded time` and `Go back`. The mounted hidden form retains drafts when the parent goes back. Both entry into deletion and its confirmation name the shared audience and explain that the deleted rows' categories/notes go too; the finished Planner activity and its notes remain.
- Malformed shared records explain that the change cannot safely save, identify the mismatch, and offer refresh/contact support as the next steps. The message does not imply an approval process or promise a Homa repair capability. Uncertain transport-response messages are unchanged.

Final follow-up logs use `1092-hours-ui-followup.log`, `1092-typecheck-lint-followup.log`, and `1092-design-tokens-followup.log`. Final captures replace the earlier local `1092` screenshots and use the same variable DM Sans build asset. The additional shortened-viewport captures are `1092-day-320-short-editor.png` and `1092-day-390-short-editor.png`. These builder checks remain subject to root's fresh review and hosted acceptance.


## Settled reader decisions

The final narrow copy pass adds the recorded date to both shared and standalone deletion confirmation. Deleted data, retained Planner data, and the irreversible warning occupy separate paragraphs. The category hint calls it a label, with Math club and Piano lesson as examples; it promises no grouping or filtering. The malformed-record message explains that nothing changed and gives refresh/support as the next steps. Uncertain Hours mutations explicitly say to close the editor and reopen the record; Planner detail errors continue to identify the activity.

`1092-hours-ui-final-copy.log` records 75 unit/static cases and nine browser journeys, including the shared/standalone confirmation date and paragraph checks and an uncertain Hours response. `1092-typecheck-lint-final-copy.log` records the final type/lint check. No SQL, deletion semantics, taxonomy, or duplicate-identity rule changed in this pass. The final corpus is `/tmp/homa-feedback-implementation/1092-final-copy-corpus.md`; screenshot filenames remain the same, with `1092-hours-390-standalone-delete.png` added.

## Root release review, September 6

Fresh contexts performed the copy reader, interface reader, revised copy/interface reads, and final copy editor. The final interface reader inspected the recaptured five-screen flow after the deletion date, paragraph separation and editor wording changes. Dispatches include the complete required personas and protocols. The installed Codex CLI ran these reviewers ephemerally in read-only mode because the built-in fresh-agent thread limit was exhausted. No real family data was given to a reviewer.

The final editor's four required corrections were accepted: use one noun, `time record`, for the saved Hours item; name the deletion consistently; explicitly name the editor in recovery instructions; and give missing-record errors a next step. Its grammar and uncertain-response consistency suggestions were also accepted. Planner errors continue to identify the activity instead of sending the parent to a different surface. The generic provenance line now names the actual School hours destination without claiming that a legacy `chat` source proves a chat utterance.

The final interface reader could complete the correction, understood shared effects and deletion consequences, and found Save/Cancel usable in the constrained viewport. Root retained the following reviewed tradeoffs:

- The Week row already is a full-width button, including its small visible Edit label. Its child label describes the actual selected Hours row; the editor explains the wider linked mutation before Save. Labeling that row as both children's time would misdescribe its underlying record.
- Category/note and Planner notes are collapsed during the ordinary minutes correction. The third screenshot deliberately opens details and scrolls; that movement is not automatic. Keeping every heading fixed would reduce editable space on a short phone.
- Deletion remains discoverable, with its shared consequences stated before the separate confirmation. It follows the optional details, and Save/Cancel remain fixed. Concealing it would repeat the meeting's Binder discoverability failure. The reader's anxiety about irreversible deletion is retained as feedback, not represented as an inability to complete the correction.
- Each independently reached destructive state names the affected children. Root kept this explicit scope despite the cost of a long-name fixture wrapping. The note field retains its full editable value and native scrolling; the screenshot is not a truncated saved note.

Root independently inspected the current screenshots, SQL, mutation boundaries and final copy delta. `1092-editor-polish-check.log` records 75 passing unit/static cases. The first browser run found one outdated exact-text test locator; after correcting the locator, `1092-editor-polish-browser-check.log` records all nine journeys passing. Focused lint passed with no diagnostics. The final surface-specific error check passed six cases. The integrated Eve build at `71216f8c` and the three-case stream-duration guard passed after merging the deployed dense-PDF correction; the subsequent edits only refine UI/error wording and evidence.

Final fresh review outputs are `1092-final-copy-editor-result.md` and `1092-final-ux-reader-result.md` in the local evidence directory. These are local review and test results. CI, the production migration, deployment readiness and the separately reviewed hosted acceptance probe must still establish the release outcome.
