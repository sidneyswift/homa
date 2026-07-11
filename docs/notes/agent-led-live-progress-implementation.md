# Agent-led live progress implementation notes

## 2026-07-11

### Plan-confirmed

- The build starts from the approved `ChildProgress` design.
- Existing `child_answers` and `child_reports` remain compatibility projections.
- Token reports remain available while the signed-in app gains a live Progress view.
- Shared question-queue behavior moved into `@homa/core` behind compatibility exports.
- Journal evidence classification now requires the child name in the same concrete skill clause. Ambiguous pronouns stay out of progress.
- Agent check-in selection ranks unanswered items, low-coverage subjects, then oldest evidence, with explicit bundled-item exclusion and fallback.

### Deviation

1. **What the plan said:** Use an isolated worktree.
2. **What the code revealed:** Required multi-parent and conversation-continuity changes are uncommitted in the current non-main branch.
3. **Conservative choice:** Build in the current branch without committing or touching unrelated changes.
4. **Revisit:** Move future work to an isolated worktree after prerequisite changes are committed.

### Discovery

- The current `recordObservation` path calls `createReport` for every item and therefore appends one legacy history entry per observation.
- The current bank contains bundled prompts such as `math.skip-counting`. Agent-led check-ins will exclude bundled items until individual skills have reviewed anchors.
- The existing app already has the needed hierarchy curation in `BANK_ITEM_DOMAINS`, but no parent-facing domain/topic read model.

### Todo for human

- Production migration application, feature-flag activation, Vercel READY verification, and authenticated production probes remain external rollout actions. They do not block local implementation or tests.

## 2026-07-11 Task 2

### Task 2 plan-confirmed

- The additive ChildProgress schema landed in the generated migration with all six planned tables, the real-answer legacy backfill, family-scoped reads, indexes, and isolation coverage.

### Task 2 discovery

- `child_answers.source` is unconstrained and existing writers can emit values outside the new evidence source set. The backfill preserves supported provenance and normalizes unsupported or null values to `legacy`.

### Task 2 deviation

1. **What the plan said:** The draft allowed authenticated family members to mutate ChildProgress rows through RLS.
2. **What the code revealed:** ChildProgress mutations belong to the server-only `mapDb` seam, matching conversation history and generated curriculum storage.
3. **Conservative choice:** Authenticated Data API callers receive SELECT policies only. No INSERT, UPDATE, or DELETE policy exists on any new table.
4. **Revisit:** Add a client mutation policy only if a future reviewed design deliberately moves a specific write out of the server seam.

### Task 2 todo for human

- Apply the migration through the approved deployment process before the remote isolation guard or ChildProgress end-to-end checks can pass. This local implementation does not apply it to any remote database.
