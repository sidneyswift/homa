# Recovered Task 1

Status: DONE

Recovered the reviewed Task 1 implementation in the isolated
`feat/subject-lessons` worktree:

- recreated the deterministic lesson target selector and six focused tests;
- refactored `buildFourWeekPlan` to use the shared two-target selector;
- exported the new public interfaces;
- restored map-wide lesson and legacy-plan target parity coverage;
- registered the dated founder ruling and exact ruling-index row; and
- recreated the approved design spec with the corrected Binder verification
  wording.

Origin/main already had a newer 2026-07-16 build-log entry, so the recovered
2026-07-15 ruling was placed immediately after it to preserve newest-first
ordering.

Verification:

- `pnpm exec tsx --test packages/core/src/map/lesson-target.test.ts`: PASS,
  6 tests.
- `pnpm check:map`: PASS, all map checks and 31 Node tests.
- `pnpm --filter @homa/core typecheck`: PASS.
- IDE diagnostics: no errors in the changed TypeScript files.
- `git diff --check`: PASS for tracked Task 1 changes.

No commit, push, deploy, or migration was created or applied. The pre-existing
`pnpm-lock.yaml` modification and
`.superpowers/sdd/recovery-progress.md` were not changed.

Concerns: none.
