# Recovered Task 3 report

## Result

Status: `DONE`

The reviewed Task 3 implementation was reapplied only in the isolated
`subject-lessons` worktree. Recovered Tasks 1 and 2 remain intact. No shared
checkout file, migration state, environment value, commit, remote branch, or
deployment was changed.

## Recovered behavior

- Added the single `ACTION_COSTS.subjectLessonWithWorksheet` record with the
  reviewed `$0.12` estimate, plan inclusion, and `subject_lesson` usage
  surface. No credits or billing ledger were added.
- Exported `ACTION_COSTS`, `mapSubjectLessonBuildSchema`, and
  `mapSubjectLessonMutationSchema` from `@homa/core`.
- Added strict build and mutation schemas. Both reject extra properties.
- Appended `lesson` to `WALL_DOORS` without renaming or repurposing `month` or
  the legacy `plan` door.
- Added exactly six strict `map.subject_lesson_*` event contracts with UUID,
  positive-attempt, bounded-error-code, and extra-property coverage.
- Restored the approved lesson included-value copy and stale lesson
  reassurance.
- Added all six temporary subject-lesson names to `STAGED_EVENTS` under
  `subject-card-single-lesson`. Tasks 4 and 5 remove each entry when its real
  emitter lands. No fake emitter was added.

## Verification

```text
pnpm exec tsx --test packages/core/src/events.test.ts apps/web/components/billing/wall-copy.test.ts
PASS, 15 tests

pnpm --filter @homa/core typecheck
PASS

pnpm --filter web typecheck
PASS

pnpm check:events
PASS

strict public export smoke
PASS

IDE diagnostics
PASS, no linter errors

git diff --check -- <Task 3 files>
PASS
```

The strict export smoke verified the exact action-cost record and proved both
lesson route schemas reject unknown keys.

`pnpm check:events` reported all six staged subject-lesson names as still
unemitted and ended with `All events checks passed.`

## Files recovered

- `packages/core/src/action-costs.ts`
- `packages/core/src/index.ts`
- `packages/core/src/map/schemas.ts`
- `packages/core/src/events.ts`
- `packages/core/src/events.test.ts`
- `apps/web/components/billing/wall-copy.ts`
- `apps/web/components/billing/wall-copy.test.ts`
- `scripts/events-check.mts`
- `.superpowers/sdd/recovered-task-3.md`
