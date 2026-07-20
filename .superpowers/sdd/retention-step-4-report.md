# Retention bridge Step 4 report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Implementation notes

- **Plan-confirmed, 2026-07-16:** Work is limited to owner-only direct Keep,
  first-transition event receipts, the kept lesson handoff, a boolean phone
  presence read, the existing Parents settings target, and focused contracts.
- **Plan-confirmed, 2026-07-16:** Planner, Complete, deep-dive redirect,
  migrations, environment changes, Binder behavior changes, commits, pushes,
  and deployment remain outside this step.
- **Discovery, 2026-07-16:** Binder already requests only
  `status: "final"`. A focused contract passed before implementation, so
  Binder production behavior was not changed.
- **Plan-confirmed, 2026-07-16:** The material finalization core now returns a
  first-transition receipt. The family-pinned agent path and the direct lesson
  path share the same transaction planner and writer.
- **Discovery, 2026-07-16:** The existing agent finalizer allowed a parent to
  choose another revision after an earlier finalization. The shared core keeps
  that behavior only when `approved_at` proves the superseded revision was
  previously final and its bytes were retained.
- **Discovery, 2026-07-16:** The caller-JWT finalizer performed target and
  sibling updates as separate Data API requests. A process or network failure
  between them could leave two final candidates or incomplete cleanup.
- **Deviation, 2026-07-16:** The original Step 4 prompt excluded migration
  changes. The review explicitly requires an atomic caller-JWT RPC in the
  unapplied subject lesson migration. The conservative choice is to edit only
  that existing unapplied migration, preserve security-invoker RLS, and apply
  nothing. Revisit only if production evidence shows this migration has
  already shipped.
- **Discovery, 2026-07-16:** A superseded draft with null `approved_at` may
  already have lost its Blob bytes. Only a superseded row proven previously
  final by non-null `approved_at` remains eligible for reactivation.
- **Plan-confirmed, 2026-07-16:** Direct lesson Keep is stricter than explicit
  agent approval. Its attached material must currently be `draft` or `final`.
  It never reactivates `superseded`, even when `approved_at` is non-null.

## Evidence

### Initial RED

- Event registry: 13 tests, 10 passed, 3 failed because
  `map.subject_lesson_kept` did not exist.
- Route policy and adapters: 29 tests, 20 passed, 9 failed because the Keep
  route and policy did not exist.
- Lesson UI: failed because `lesson-keep-button.tsx` did not exist.
- Material finalization: 3 tests failed because transition planning and direct
  lesson finalization did not exist.
- Binder contract: 21 tests passed and proved the page already reads only
  final materials.
- Review regression: 3 material tests ran, with 1 pass and 2 expected failures
  proving that the first refactor had narrowed existing agent approval and had
  not yet excluded superseded materials at the lesson selector.
- Atomic caller review RED: 6 material tests ran, with 2 passes and 4 expected
  failures proving the missing RPC, unsafe superseded-draft reactivation, and
  pre-RPC caller writes.
- Accessibility review RED: 21 lesson tests ran, with 20 passes and 1 expected
  failure proving the kept handoff lacked a persistent polite status region
  and focus target.
- Complete-chain review RED: 7 material tests ran, with 6 passes and 1
  expected failure proving the pinned planner stopped after 50 chain rows.
- Critical direct-Keep RED: 8 finalization tests ran, with 7 passes and 1
  expected failure because the direct-only planner did not exist. The 21 route
  tests then ran with 20 passes and 1 expected failure, returning no kept
  result only through the thrown missing helper rather than the locked policy.

### Focused GREEN

- Event registry: 13 of 13 passed.
- Keep route policy and adapters: 29 of 29 passed.
- Lesson page, Keep, handoff, phone link, contrast, retry, and polling:
  21 of 21 passed.
- Material finalization and Binder: 28 of 28 passed.
- Atomic RPC, unsafe superseded draft, complete-chain, and cleanup ordering:
  7 of 7 focused finalization tests passed.
- Critical direct-Keep regression plus route behavior: 29 of 29 focused tests
  passed.
- Core typecheck: exit 0.
- Web typecheck: exit 0.

## Delivered behavior

### Owner Keep boundary

- `POST /api/map/subject-lesson/keep` is behind the exact subject lesson
  feature flag and the existing first-family-member owner policy.
- The body accepts only `{ lessonId }`. The server derives `familyId` from the
  authenticated owner and never accepts a material id from the browser.
- A missing, foreign, non-ready, superseded, or unattached lesson cannot choose
  a material. Unknown and wrong-family lesson ids return the same 404.
- Token-only viewers receive no Keep UI. A direct token-only POST has no
  authenticated actor and is denied.
- The route calls the family-pinned material finalizer directly. It starts no
  Eve session and creates no agent turn or model usage.

### First-transition finalization

- `finalizeMaterialPinned` and the direct lesson finalizer use the same
  transaction planner and writer.
- Caller/web-agent finalization makes one `finalize_family_material` RPC through
  the caller's Supabase client. The function is security invoker, verifies
  `auth.uid()` membership, and retains RLS.
- The RPC locks the family material rows and complete connected revision chain.
  Target-final and sibling-supersession writes commit in one function call.
  Only then does the caller receive draft URLs for best-effort Blob cleanup.
- The direct path locks family material rows, then accepts only the attached
  material of a current, ready, unsuperseded lesson in the authenticated
  family whose current material status is exactly `draft` or `final`.
- A draft-to-final transition returns `transitioned: true`, supersedes its
  revision chain, and cleans up superseded draft bytes once.
- A replay of an already final material returns `transitioned: false`,
  performs no cleanup, and emits no event.
- A superseded row with null `approved_at` never returns a kept result and can
  never re-enter Binder. Explicit `mark_material_final` approval may select a
  superseded row with non-null `approved_at` because its bytes were retained
  when it was previously final. Direct lesson Keep rejects every superseded
  row regardless of `approved_at`.
- `mark_material_final` now uses the same transition receipt, so repeated
  agent approval does not emit another `materials.finalized` event.

### Typed events

The first transition emits:

```text
materials.finalized
  family_id
  channel: web
  versions_superseded

map.subject_lesson_kept
  family_id
  child_id
  subject
```

Neither event contains a lesson id, material id, title, URL, phone value, or
worksheet content. A replay emits neither event.

### Parent path

```text
/onboarding/r/{token}/lesson/{subjectId}
  -> Keep worksheet
  -> POST /api/map/subject-lesson/keep
  -> Kept in Binder
  -> Ask Homa about today's lesson
  -> /app
```

The ready owner page shows `Keeping...` while the request is pending. A failed
request keeps the draft treatment and shows:

```text
The worksheet wasn't kept. It's still here. Try again.
```

The client renders kept state only after an HTTP-successful response carrying
both `ok: true` and `kept: true`. A final worksheet renders the kept handoff on
the next page load.

The kept panel remains mounted as a `role="status"` region with
`aria-live="polite"` and `aria-atomic="true"`. After a new successful Keep,
focus moves to the `Kept in Binder` heading. An already-final page load does
not steal focus.

The handoff says:

```text
The worksheet is in Binder. Homa can help with what happens next.
```

When the family has no row in `family_phones`, the handoff also links:

```text
Add your phone for weekday morning texts
-> /app/settings#parents
```

`hasFamilyPhone` returns only a family-scoped boolean. No phone value enters
lesson props. The existing Parents section now owns `id="parents"`.

### Binder contract

The new focused contract proved `/app/binder` already calls
`findMaterialsCaller` with `status: "final"`. Binder production code was not
changed.

## Final verification

### Critical direct-Keep focused tests

```text
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  apps/web/lib/materials/finalization.test.ts \
  apps/web/lib/subject-lessons/routes.test.ts

tests 29
suites 7
pass 29
fail 0
```

The behavioral regression uses the production direct-Keep planner. An attached
previously approved `superseded` material returns not kept, emits no event,
performs no simulated chain write, and leaves the chain snapshot unchanged.

### All retained subject lesson tests

```text
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  apps/web/lib/subject-lessons/*.test.ts \
  "apps/web/app/onboarding/r/[[]token[]]/lesson/[[]subjectId[]]/lesson-view.test.tsx" \
  "apps/web/app/onboarding/r/[[]token[]]/subject-lesson-button.test.tsx" \
  packages/core/src/events.test.ts \
  packages/core/src/map/lesson-target.test.ts \
  apps/web/components/billing/wall-copy.test.ts

tests 157
suites 40
pass 157
fail 0
```

### Material and Binder tests

```text
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  apps/web/lib/materials/*.test.ts

tests 28
suites 11
pass 28
fail 0
```

### Progress UI

```text
corepack pnpm check:progress-ui

tests 128
suites 38
pass 128
fail 0
```

### Event parity

```text
corepack pnpm check:events

All events checks passed.
```

The scanner found emitters for both `materials.finalized` and
`map.subject_lesson_kept`, and found both names in the typed registry.

### Typechecks

```text
corepack pnpm --filter @homa/core typecheck
exit code 0

corepack pnpm --filter web typecheck
exit code 0
```

### Lint

```text
corepack pnpm lint
exit code 0
0 errors
```

One unchanged warning remains in `apps/web/lib/chat-history.ts` for the unused
`ChatHistoryMessage` type.

### Selective Next.js build

```text
corepack pnpm --filter web exec next build \
  --debug-build-paths="app/onboarding/r/[token]/lesson/[subjectId]/page.tsx,app/app/settings/page.tsx,app/app/binder/page.tsx,app/api/map/subject-lesson/keep/route.ts"

Compiled successfully
Finished TypeScript
```

The selected route manifest contains:

- `/api/map/subject-lesson/keep`
- `/app/binder`
- `/app/settings`
- `/onboarding/r/[token]/lesson/[subjectId]`

Next.js emitted the known nested-worktree root-inference warning. The build ran
inside this isolated worktree.

### Eve build

```text
VERCEL=1 corepack pnpm --filter web exec eve build
exit code 0

VERCEL=1 corepack pnpm check:eve-stream-duration
3 checks passed
```

The expected local prewarm warning reported that
`VERCEL_DEPLOYMENT_ID` is absent. No prebuilt deployment was attempted.

### Patch and diagnostics

- `git diff --check`: exit 0.
- Edited-file IDE diagnostics: no new code errors.
- New and edited Step 4 files contain no em dash.

## Files

Created:

- `apps/web/app/api/map/subject-lesson/keep/route.ts`
- `apps/web/lib/subject-lessons/keep-route-policy.ts`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-keep-button.tsx`
- `apps/web/lib/materials/finalization.test.ts`
- `.superpowers/sdd/retention-step-4-report.md`

Modified for Step 4:

- `apps/web/README.md`
- `apps/web/agent/tools/mark_material_final.ts`
- `apps/web/app/app/settings/parents-section.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/page.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-layout.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-view.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-view.test.tsx`
- `apps/web/lib/family-phone.ts`
- `apps/web/lib/materials/binder.test.ts`
- `apps/web/lib/materials/library.ts`
- `apps/web/lib/subject-lessons/route-adapters.test.ts`
- `apps/web/lib/subject-lessons/route-contracts.ts`
- `apps/web/lib/subject-lessons/routes.test.ts`
- `apps/web/lib/subject-lessons/routes.ts`
- `apps/web/lib/subject-lessons/store.ts`
- `apps/web/lib/subject-lessons/types.ts`
- `packages/core/src/events.test.ts`
- `packages/core/src/events.ts`
- `supabase/migrations/20260715210000_subject_lessons.sql`

## Remaining local blockers

- The isolated worktree intentionally has no secret-bearing local environment
  files. `corepack pnpm check:isolation` exited 2 before any remote operation
  because `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are absent. A real
  authenticated PostgreSQL/browser Keep journey remains unavailable locally.
- No migration was applied. No environment value, commit, push, deployment, or
  production probe was performed, as required.
- Planner, Complete, and deep-dive redirect remain outside this retention
  bridge.
