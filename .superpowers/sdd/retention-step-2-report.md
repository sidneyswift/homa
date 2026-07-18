# Retention bridge Step 2 report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Scope delivered

- Restored the side-effect-free server page at
  `/onboarding/r/[token]/lesson/[subjectId]`.
- Restored shared lesson layout and state rendering.
- Restored bounded 2.5-second polling only for queued and running lessons.
- Restored owner-only retry through the existing Step 1 retry route.
- Restored queued, running, ready, partial failure, full failure, ready
  token-only, and nonready token-only states.
- Restored `MaterialCard` worksheet preview and `Print it`.
- Restored AA-safe clay and rose tokens, one polite ready announcement, and
  tested polling cancellation and terminal behavior.
- Added an owner-only retained material seam for the later Keep step without
  rendering a Keep control.

## Explicitly excluded

- No completion button or completion client was restored.
- No completion API call was added.
- No planner code was restored or changed.
- No Keep UI was added.
- No material was finalized automatically.
- No Binder visibility claim was added.

The existing `completed_at` database field and store helpers from earlier steps
remain untouched.

## Accepted copy

The restored page uses:

- target heading: `Lesson goal`;
- full failure:
  `The lesson did not finish. Your request is saved. Try again.`; and
- retry failure:
  `The lesson did not start. Your request is saved. Try again.`

The partial worksheet failure keeps:

> The lesson is saved. The practice page did not finish. Try the page again.

## State behavior

### Queued and running

Only the authenticated account owner can see pending state. The page shows the
child and subject, `Lesson goal`, the deterministic target, and
`HOMA is making this lesson`. Polling is active only in these two states.

### Partial failure

Saved lesson content remains visible in this order:

1. `Lesson goal`;
2. `The lesson`;
3. optional materials;
4. three-to-five ordered steps;
5. `Practice afterward`; and
6. `Practice page`.

Only the owner receives `Try again`.

### Full failure

The request and target remain visible. The owner receives the accepted failure
copy and `Try again`.

### Ready

The page renders the goal, lesson title, optional materials, ordered steps,
practice suggestion, worksheet preview, and `Print it`. It emits exactly one
visually hidden polite status:

> Lesson and practice page ready.

The page does not render completion or Keep controls.

### Token viewers

A token-only viewer can read and print an existing ready lesson. Lesson ids,
material ids, material status, retry, and other mutation controls are absent.
A token-only nonready request fails closed with the generic inactive-link view.

## Authentication and side effects

The page checks `HOMA_SUBJECT_LESSONS_ENABLED` before any lesson store access.
It starts the ready-only token projection and owner authorization together.

- Ready token content is readable without mutation authority.
- Nonready state requires account-owner authorization and a family-pinned
  token lookup.
- Retry sends only `lessonId` to the existing owner-only route.
- No family id crosses into a client prop.
- The page GET calls no build, retry, session-start, or write function.

## Retention seam for Step 4

The family-pinned owner state now includes:

- current lesson id;
- attached material id;
- attached material status;
- child display name; and
- subject display name.

The query joins material status only through the lesson's family-scoped child.
The page derives `ownerMaterial` only when:

1. the viewer is the authenticated account owner;
2. the newer owner row matches the ready token lesson id;
3. the owner row and ready projection name the same material id; and
4. the family-pinned material status exists.

The result contains only `{ lessonId, materialId, status }`. It remains in the
server component tree and is not rendered or passed into a client component.
This gives Step 4 a narrow input for Keep without shipping Keep now.

## Polling behavior

The dependency-injected controller:

- schedules every 2,500 ms;
- starts only for queued or running;
- never overlaps a slow request;
- aborts the active request on effect cleanup;
- clears scheduled work on cancellation;
- retries after transient transport or server failure;
- stops on terminal auth denial;
- marks ready or failed terminal before calling one refresh; and
- schedules no later request after terminal state.

## Design and accessibility

- Uses existing Homa tokens and components only.
- Uses `clay-700` for filled controls, the normal-size worksheet headline,
  ordered-list markers, and unfilled action text.
- Uses AA-safe `clay-600` hover states.
- Uses `rose-600` for retry mutation errors.
- Keeps focus treatment on the existing `--shadow-focus` token.
- Keeps new interactive targets at least 44 px tall.
- Uses `motion-safe` for press transforms.
- Uses one `h1`, ordered section headings, `aria-busy`, status regions, and an
  alert region for retry failure.
- Uses HOMA casing on UI surfaces.
- Contains no em dash.

Measured contrast:

- white on `clay-700`: `6.874:1`;
- white on `clay-600`: `4.768:1`;
- `clay-700` on white: `6.874:1`;
- `rose-600` on white: `5.225:1`; and
- `rose-600` on `gold-100`: `4.691:1`.

## TDD evidence

### RED

The complete rendered-state and component test was added before any lesson page
file existed.

Command:

```sh
pnpm exec tsx --test \
  "app/onboarding/r/[[]token[]]/lesson/[[]subjectId[]]/lesson-view.test.tsx"
```

Result: exit 1.

Expected failure:

```text
Cannot find module './lesson-retry-button'
tests 1
pass 0
fail 1
```

This proved the retained client and page modules were absent.

### GREEN

The same focused command after implementation returned:

```text
tests 14
suites 4
pass 14
fail 0
```

The suite covers:

- queued and running;
- ready;
- partial and full failure;
- token-ready and token-nonready access;
- owner-only retry route use;
- accepted copy;
- no completion or Keep artifacts;
- AA contrast;
- ready announcement;
- owner material projection precedence;
- no rendered retention identity;
- side-effect-free page source;
- nonoverlapping polls;
- cancellation abort;
- transient retry; and
- exactly one terminal refresh.

## Verification

### All subject lesson tests

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  "apps/web/lib/subject-lessons/*.test.ts" \
  packages/core/src/events.test.ts \
  packages/core/src/map/lesson-target.test.ts \
  apps/web/components/billing/wall-copy.test.ts
```

Result:

```text
tests 111
pass 111
fail 0
```

### MaterialCard regressions

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  apps/web/app/app/message-parts-attachments.test.tsx \
  apps/web/app/admin/chats/thread.test.tsx
```

Result:

```text
tests 16
pass 16
fail 0
```

### Web typecheck

```sh
corepack pnpm --filter web typecheck
```

Result: exit 0.

### Lint

```sh
corepack pnpm lint
```

Result: exit 0. One unchanged warning remains in
`apps/web/lib/chat-history.ts` for the unused `ChatHistoryMessage` type. No
warning or error was introduced by Step 2.

### Selective Next.js build

```sh
corepack pnpm exec next build \
  --debug-build-paths="app/onboarding/r/[token]/lesson/[subjectId]/page.tsx"
```

Result:

```text
Compiled successfully
Finished TypeScript
ƒ /onboarding/r/[token]/lesson/[subjectId]
```

Next.js emitted a workspace-root inference warning because this is a nested git
worktree with its own workspace file. The command ran from the isolated
`apps/web` directory, and the selected route was classified as dynamic.

### Isolation guard

```sh
corepack pnpm check:isolation
```

The command could not start because this isolated worktree intentionally has
no `NEXT_PUBLIC_SUPABASE_URL` or
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No environment value was set. Static
family scoping remains covered by the store contract and page tests.

### Whitespace and IDE diagnostics

- `git diff --check`: exit 0.
- Edited-file IDE diagnostics: no errors.

## Files

Created:

- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/page.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-layout.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-view.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-status-poll.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-retry-button.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-view.test.tsx`
- `.superpowers/sdd/retention-step-2-report.md`

Modified:

- `apps/web/app/app/material-card.tsx`
- `apps/web/lib/subject-lessons/store.ts`
- `apps/web/lib/subject-lessons/types.ts`

The subject lesson store and type files were already untracked Step 1 work.
Step 2 changes only the owner projection fields needed by this page and the
later retention action.

## Explicitly not performed

- No migration was applied.
- No environment value was set or changed.
- No commit or push occurred.
- No deployment or production probe occurred.
