# Retention bridge Step 1 report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Scope delivered

- Restored `POST /api/map/subject-lesson/build`.
- Restored `GET /api/map/subject-lesson/status`.
- Restored `POST /api/map/subject-lesson/retry`.
- Reused the recovered owner authorization, build/status/retry policies,
  route contracts, action-cost surface, trusted `HOMA_INTERNAL_ORIGIN`
  starter, current-fingerprint and historical reuse, queued restart, and
  atomic failed-run retry.
- Kept the existing wall-compatible ordering. Reuse and queued recovery run
  before a create-capable wall decision.
- Kept the feature flag as the first policy branch, before authentication,
  token reads, lesson reads, or writes.
- Kept build and retry owner-only.
- Kept token status read-only, ready-only, and bounded. Pending state remains
  owner-only and excludes error codes, attempt counts, and runtime session
  identifiers.
- Kept retry failed-only. A duplicate attempt that loses the atomic claim
  starts no second session and emits no second retried event.
- Removed the uncommitted Complete route, Complete route policy, exported
  Complete handler, Complete route dependency contract, and Complete event.
- Left `completed_at`, its database fields, and recovered store helpers
  untouched.
- Event parity now covers exactly requested, started, ready, failed, and
  retried. No Complete emitter exists.

## TDD evidence

### RED

Command:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/subject-lessons/route-adapters.test.ts apps/web/lib/subject-lessons/routes.test.ts packages/core/src/events.test.ts
```

Result: exit 1, 37 tests, 34 passed, 3 failed.

Expected failures:

1. `does not ship Complete route or policy artifacts`
2. `does not expose a Complete route policy in Step 1`
3. `subject lesson event registry contains all five Step 1 names`

The failures proved that the Complete route/policy/export and sixth registry
event still existed before the implementation change.

### GREEN

The same focused command after implementation returned exit 0:

- 37 tests
- 37 passed
- 0 failed

## Final verification evidence

### All subject lesson tests

Command:

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test "apps/web/lib/subject-lessons/*.test.ts" packages/core/src/events.test.ts packages/core/src/map/lesson-target.test.ts apps/web/components/billing/wall-copy.test.ts
```

Result: exit 0, 111 tests, 111 passed, 0 failed.

The first aggregate attempt exposed incomplete local dependency links in this
isolated worktree. The links were repaired with the repository-pinned pnpm
10.12.1, without changing package versions. The final result above is the
post-repair run.

### Core typecheck

```sh
corepack pnpm --filter @homa/core typecheck
```

Result: exit 0.

### Web typecheck

```sh
corepack pnpm --filter web typecheck
```

Result: exit 0.

### Event parity

```sh
corepack pnpm check:events
```

Result: exit 0. Requested, started, ready, failed, and retried each have a
registered emitter. No Complete event is registered or emitted.

### Lint

```sh
corepack pnpm lint
```

Result: exit 0. ESLint reported one warning in the unchanged
`apps/web/lib/chat-history.ts`: `ChatHistoryMessage` is defined but unused.
There were no lint errors.

### Eve build and stream policy

```sh
VERCEL=1 corepack pnpm --filter web exec eve build
VERCEL=1 corepack pnpm check:eve-stream-duration
```

Results:

- Eve build: exit 0.
- Stream-duration guard: exit 0, 3 checks passed.

The build emitted the expected local warning that sandbox template prewarming
was skipped because `VERCEL_DEPLOYMENT_ID` is absent. No deployment was
attempted.

## Remaining blockers

None for retention bridge Step 1.

The live model behavioral evaluation from recovered Task 4B still requires
Gateway credentials that are intentionally absent from this isolated
worktree. That is outside this route-adapter step and did not prevent the
111-test local suite, typechecks, event parity, lint, or Eve build from
passing.

## Explicitly not performed

- No Complete route was created.
- No migration was applied or rewritten.
- No environment value was persisted or changed.
- No commit, push, deployment, or production probe was performed.
