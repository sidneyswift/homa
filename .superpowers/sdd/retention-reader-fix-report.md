# Retention bridge parent-reader fix report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Scope

This pass applies only the accepted parent-reader feedback for the retained
subject lesson bridge. It does not change the deterministic lesson target,
deeper-question copy, report hierarchy, Keep authorization, Binder behavior,
database schema, or deployment state.

## Test-first evidence

The focused lesson and workflow tests were changed before production code.
The first focused run produced the expected RED result:

```text
tests 34
pass 23
fail 11
```

The failures proved that:

- wait, ready, partial-failure, and full-failure views lacked the new goal
  framing;
- the owner draft still used the old Keep label and lacked its helper;
- the kept handoff and phone prompt still used the old copy; and
- deterministic workflow findings did not reject hidden choices or assumptions
  about examples in external items.

After the smallest implementation changes and exact-option fixture updates,
the same focused command produced:

```text
tests 34
pass 34
fail 0
```

A second focused RED case then proved that a list of exact letters could mask
an unspecified word choice. That workflow-only run produced 13 passes and 1
expected failure. The evaluator was tightened to compare each choice with
options of the same kind, then the workflow-only run passed all 14 tests.

## Delivered behavior

### Lesson goal framing

`LessonTarget` now renders this persistent line before the unchanged target:

```text
This is the skill this lesson works toward.
```

The shared component keeps the line present in queued, running, ready,
partial-failure, and full-failure views. `Lesson goal` remains the section
heading, so the deterministic statement is framed as a goal rather than a
current verdict.

### Draft Keep clarity

The owner draft action now reads:

```text
Keep in Binder
```

Its adjacent helper reads:

```text
Keep this worksheet in Binder so you can find it later.
```

The Keep area still exposes one primary button. Pending and failure behavior
are unchanged.

### Post-Keep handoff

The persistent kept panel now says:

```text
The worksheet is in Binder. Message Homa if you want to adjust the lesson or share how it went.
```

Its primary CTA is:

```text
Message Homa about this lesson
```

The destination remains `/app`.

### Conditional no-phone prompt

When the family has no linked phone, the required CTA is preceded by:

```text
Get one weekday-morning research note about your kids by text.
```

The CTA remains:

```text
Add your phone for weekday morning texts
```

The destination remains `/app/settings#parents`. Both no-phone strings are
absent when a family phone exists.

### Generated lesson quality

The `subject-lesson-builder` skill now binds both checks before a successful
completion:

- every example, letter, word, or option needed by a step is supplied
  explicitly; and
- any step that expects a specific example in an external item includes an
  immediate fallback.

The deterministic workflow evaluator now reports:

- a hidden choice when a parent must invent an example, letter, or word; and
- an external-item assumption when a book, label, package, page, or similar
  item is expected to contain a needed example without a fallback.

Focused fixtures prove both rejection paths. Passing workflow fixtures now use
the exact letters `m, a, p, s, and t` and the exact words `map` and `sat`.

The synthetic browser-review lesson also became self-contained. It names the
exact uppercase and lowercase letters in its materials, steps, practice, and
worksheet instead of relying on a favorite book or a grown-up-selected letter.

## Preserved behavior

- The deterministic target text is unchanged.
- `Answer a few deeper questions` remains unchanged in the report.
- The report's subject hierarchy is unchanged.
- Token viewers remain read-only.
- Keep remains owner-only and idempotent.
- Existing pending, failure, retry, focus, and accessibility behavior remains
  in place.

## Verification

### Focused lesson, Keep, and workflow tests

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  "apps/web/app/onboarding/r/[[]token[]]/lesson/[[]subjectId[]]/lesson-view.test.tsx" \
  apps/web/lib/subject-lessons/workflow-eval.test.ts
```

Result: 35 tests passed, 0 failed.

### All retained subject lesson tests

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  apps/web/lib/subject-lessons/*.test.ts \
  "apps/web/app/onboarding/r/[[]token[]]/lesson/[[]subjectId[]]/lesson-view.test.tsx" \
  "apps/web/app/onboarding/r/[[]token[]]/subject-lesson-button.test.tsx" \
  packages/core/src/events.test.ts \
  packages/core/src/map/lesson-target.test.ts \
  apps/web/components/billing/wall-copy.test.ts
```

Result: 161 tests passed in 40 suites, 0 failed.

### Event and skill guards

```text
corepack pnpm check:events
All events checks passed.

corepack pnpm check:fleet-skills
All fleet-skill checks passed.

corepack pnpm check:skills-targeting
All targeting checks passed.

corepack pnpm check:fleet-skills-dormant
All dormant-window guard checks passed.
```

The two skill checks emitted the existing package-module warning. Neither
reported a failure.

### Typechecks

```sh
corepack pnpm typecheck
```

Result: all four workspace package typechecks passed.

The first post-capture run found a stale generated
`.next/dev/types/validator.ts` import for the already-removed temporary review
route. Removing only the generated `.next/dev` cache and rerunning produced
the passing result above.

### Lint

```sh
corepack pnpm lint
```

Result: exit 0 with 0 errors. The existing unused
`ChatHistoryMessage` warning remains in `apps/web/lib/chat-history.ts`.

### Eve build

```sh
VERCEL=1 corepack pnpm --filter web exec eve build
VERCEL=1 corepack pnpm check:eve-stream-duration
```

Results:

- Eve build exited 0.
- The stream-duration guard passed all 3 checks.
- The expected local warning reported that `VERCEL_DEPLOYMENT_ID` is absent.
  No prebuilt deployment was attempted.

### Browser review and copy inventory

The existing scratch capture process rendered the real report, lesson,
worksheet, Keep, retry, and handoff components with synthetic data.

```text
Captured 12 screenshots with 4 mocked action requests
```

The capture verified:

- 6 phone screenshots at exactly 390 by 844 pixels;
- 6 desktop screenshots at exactly 1440 by 900 pixels;
- one mocked Build and one mocked Keep request per viewport;
- no browser console errors or uncaught page errors;
- goal framing in wait, ready, and failure states;
- successful Keep focus;
- the revised no-phone prompt; and
- absence of both no-phone strings in the phone-linked state.

All 12 screenshots were visually reviewed. The updated copy inventory is:

```text
.superpowers/sdd/retention-final-copy.md
```

The screenshot evidence and refreshed SHA-256 manifest are:

```text
.superpowers/sdd/retention-final-review-artifacts.md
```

The temporary route and development-only proxy bypass were removed after
capture. `apps/web/proxy.ts` has no retained diff, and
`/retention-bridge-review-dev` does not remain in the app tree.

### Final hygiene

- Edited-file IDE diagnostics: no linter errors.
- `git diff --check`: exit 0.
- Changed code, copy, and artifact text contain no em dash.
- The retained capture script passes Python syntax compilation.

## Constraints honored

- No migration was created, edited, or applied by this pass.
- No environment value was added, changed, copied, or persisted.
- No commit was created.
- No push was attempted.
- No deployment or production probe was attempted.

## Blockers

None.
