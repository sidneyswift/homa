# Recovered Task 4A report

## Result

Status: `DONE`

The final reviewed Task 4A implementation, including the truthful attachment
success note, was reapplied only in the isolated `subject-lessons` worktree.
Recovered Tasks 1 through 3 remain intact. No shared checkout file, commit,
remote branch, deployment, migration state, or environment value was changed.

Task 4B remains intentionally absent. No subject lesson Eve channel or fleet
skill was created.

## Recovered behavior

- Added `SubjectLessonSessionInput`, string-only trusted auth attributes, and
  the exact-target internal model message.
- Added strict trusted-context parsing for exact `subject_lesson`, UUID family
  and lesson ids, and a positive string build attempt.
- Added `save_subject_lesson_content` with bounded title, materials, steps, and
  practice input. Family, lesson, and attempt identity come only from auth.
- Added `attach_subject_lesson_material` with only one model-facing material
  UUID. The existing store re-scopes family, child, review eligibility,
  provenance, and attempt.
- Restored the truthful attachment result:
  `The practice page is attached to the lesson.`
- Added exact pinned family access and family-context loading without widening
  near-miss channels.
- Blocked scheduled-task mutations from the internal lesson lane.
- Excluded internal lesson prompt and terminal chatter from conversation
  persistence and recall.
- Added exact material row, material event, and model-usage channel support.
- Widened the existing unapplied migration's material and model-usage check
  constraints for `subject_lesson`.
- Added trusted `lessonId` to printable generation metadata without adding it
  to the model-facing printable input.
- Preserved all six temporary Task 3 `STAGED_EVENTS` entries for Task 4B.

## Test-first recovery evidence

The focused tests were restored before production files.

Initial focused RED:

```text
pnpm exec tsx --test \
  apps/web/lib/subject-lessons/dispatch-input.test.ts \
  apps/web/lib/family-context-security.test.ts

Exit code: 1
tests 7
pass 2
fail 5
```

Failures included the absent narrow attachment tool, absent pinned-family
helper, absent persistence helper, unguarded task mutations, and the missing
model-usage channel.

Initial receipt and event contract RED:

```text
pnpm exec tsx --test \
  apps/web/lib/subject-lessons/store-contract.test.ts \
  packages/core/src/events.test.ts

Exit code: 1
tests 21
pass 19
fail 2
```

The failures proved the persisted receipt constraints and material event
schemas did not yet accept exact `subject_lesson`.

## Verification

```text
pnpm exec tsx --test \
  apps/web/lib/subject-lessons/dispatch-input.test.ts \
  apps/web/lib/family-context-security.test.ts

PASS
tests 14
pass 14
fail 0
```

```text
pnpm exec tsx --test \
  apps/web/lib/subject-lessons/store-contract.test.ts \
  packages/core/src/events.test.ts

PASS
tests 21
pass 21
fail 0
```

```text
pnpm --filter web typecheck
PASS

pnpm --filter @homa/core typecheck
PASS

pnpm check:events
PASS

pnpm lint
PASS, 0 errors
One pre-existing warning remains in apps/web/lib/chat-history.ts.

VERCEL=1 pnpm --filter web exec eve build
PASS

git diff --check
PASS

IDE diagnostics
PASS, no errors in Task 4A files
```

`pnpm check:events` reported all six staged `map.subject_lesson_*` events as
still unemitted and ended with `All events checks passed.`

The local Vercel-mode Eve build warned that sandbox template prewarm was
skipped because `VERCEL_DEPLOYMENT_ID` is unavailable. The build completed
successfully.

## Supplemental repository guard

The newer `VERCEL=1 pnpm check:eve-stream-duration` guard was also run. It
failed because the worktree's pre-existing `pnpm-lock.yaml` modification
removes the repository's `eve@0.19.0` patched-dependency entry, so the installed
Eve module and generated function config omit `maxDuration: "max"`.

That lockfile modification was already present in the initial recovered
worktree status before Task 4A began. Task 4A did not edit or restore it because
the request forbids unrelated behavior changes. The requested Eve compilation
itself passed. The patch-state issue must be resolved before this branch is
treated as fully deployable.

## Files recovered

Created:

- `apps/web/lib/subject-lessons/dispatch-input.ts`
- `apps/web/lib/subject-lessons/dispatch-input.test.ts`
- `apps/web/agent/tools/save_subject_lesson_content.ts`
- `apps/web/agent/tools/attach_subject_lesson_material.ts`
- `.superpowers/sdd/recovered-task-4a.md`

Modified:

- `apps/web/lib/agent-db.ts`
- `apps/web/agent/instructions/family-context.ts`
- `apps/web/lib/tasks/guard.ts`
- `apps/web/agent/hooks/persist-conversation.ts`
- `apps/web/agent/tools/create_printable.ts`
- `apps/web/lib/materials/artifact-store.ts`
- `apps/web/lib/model-usage.ts`
- `apps/web/lib/family-context-security.test.ts`
- `apps/web/lib/subject-lessons/store-contract.test.ts`
- `packages/core/src/events.ts`
- `packages/core/src/events.test.ts`
- `supabase/migrations/20260715210000_subject_lessons.sql`

No Task 4B channel, skill, route, emitter, commit, push, deployment, migration
application, or environment change was made.
