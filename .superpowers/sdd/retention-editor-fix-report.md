# Retention bridge copy-editor fix report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Scope

This pass applies the accepted final copy-editor changes to the retained
subject lesson bridge. It keeps the deterministic lesson target,
deeper-question copy, worksheet preview, `Print it`, Keep authorization,
Binder behavior, schema, and deployment state unchanged.

## Test-first evidence

The focused copy, UI, and workflow tests passed their 57-test baseline before
the changes.

The first copy regression run produced the expected RED result:

```text
tests 58
pass 44
fail 14
```

Those failures covered worksheet naming, goal framing, retry actions, Keep
copy, post-Keep handoff copy, owner and stale-wall notes, and command-shaped
lesson steps.

A second tool-result regression produced:

```text
tests 8
pass 6
fail 2
```

It proved that both trusted subject lesson tool results still called the
artifact a practice page.

After the implementation changes, the focused copy, UI, and workflow run
passed all 58 tests. The trusted tool-result run passed all 8 tests.

### Final must-fix follow-up

The two remaining editor issues and the accepted craft suggestion each began
with a focused RED run:

```text
retry target:       22 tests, 21 passed, 1 failed
phone destination:   3 tests,  1 passed, 2 failed
active wording:     16 tests, 14 passed, 2 failed
```

The failures proved that retry errors shared one generic lesson message, the
phone CTA only scrolled to Parents, and the passing generated fixtures still
repeated weak `can` constructions.

## Delivered behavior

### One worksheet name

The active build status is `Making the worksheet...`. Ready and partial-failure
sections use the heading `Worksheet`. The partial-failure message is:

```text
The lesson is saved. The worksheet did not finish.
```

The membership included-value line and trusted internal tool results now use
`worksheet` too. The lesson surface suppresses the generic `Worksheet ready`
material-card status because the section heading already names the artifact.
The shared chat material card keeps its existing status headline.

### Retry actions

Saved lesson content uses:

```text
Make the worksheet again
Making the worksheet...
```

A build with no saved content uses:

```text
Make the lesson again
Making the lesson...
```

The body messages no longer repeat a retry command. The shared button receives
a typed `worksheet` or `lesson` retry target. Its failure copy now matches that
target:

```text
The worksheet did not start. Your lesson is still saved.
The lesson did not start. Your request is still saved.
```

### Keep and post-Keep handoff

The draft helper is:

```text
Binder saves this worksheet for later.
```

A failed Keep leaves `Keep in Binder` available and shows:

```text
The worksheet is still on this page, but it was not saved to Binder.
```

The kept state now uses:

```text
Kept in Binder
HOMA can help you adjust the lesson or talk through how it went.
Message HOMA about this lesson
```

The primary handoff still links to `/app`. Families without a linked phone
also see:

```text
HOMA sends one research note by text each weekday morning.
Open phone settings
```

The phone settings link is now `/app/settings?edit=phone#parents`. The settings
server accepts only the exact `edit=phone` value and passes a boolean to the
existing `ParentsSection`. That opens and focuses only the signed-in adult's
existing cell-number editor. Another adult's row remains read-only, and no
adult id is accepted from the URL.

### Goal and report notes

`Lesson goal` remains the heading. Its helper is now:

```text
This is the goal for this lesson.
```

The reviewed target below it is unchanged.

The owner and stale-wall notes are now declarative:

```text
Your report is safe. This lesson can only be built from the account that created the report.
Your report is safe. Refreshing this page will reopen the lesson option.
```

`Answer a few deeper questions` remains unchanged.

### Generated lesson voice

The subject lesson skill now requires every teaching step to use an offer or
declarative statement. It includes concrete accepted and rejected examples,
keeps exact options in each step, and checks the voice shape before completion.

The workflow evaluator now rejects direct-command steps. The passing fixture,
skill example, and browser-review fixture prefer active subject-verb wording
without repeated weak `can`, while preserving specific letters, words,
actions, and fallback behavior.

### Accessibility

The redundant visible `Worksheet ready` and kept-body restatement were removed.
The ready state retains one polite accessibility announcement:

```text
Lesson and worksheet ready.
```

Successful Keep still moves focus to `Kept in Binder`.

## Verification

### Focused copy, UI, and skill tests

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  "apps/web/app/onboarding/r/[[]token[]]/lesson/[[]subjectId[]]/lesson-view.test.tsx" \
  "apps/web/app/onboarding/r/[[]token[]]/subject-lesson-button.test.tsx" \
  apps/web/app/app/settings/parents-section.test.tsx \
  apps/web/components/billing/wall-copy.test.ts \
  apps/web/lib/subject-lessons/workflow-eval.test.ts
```

Result: 63 passed, 0 failed.

The shared material-card regression run also passed 25 tests.

### All subject lesson tests

The retained subject lesson command passed 164 tests in 40 suites with no
failures.

### Progress UI

`corepack pnpm check:progress-ui` passed 128 tests in 38 suites with no
failures.

### Event and skill guards

```text
check:events                  passed
check:fleet-skills            passed
check:skills-targeting        passed
check:fleet-skills-dormant    passed
check:taxonomy                passed
```

The fleet-skill and targeting commands emitted the existing package-module
warning only.

### Typechecks and lint

All four workspace typechecks passed. The first post-capture run found a stale
generated `.next/dev/types/validator.ts` reference to the removed review route.
Clearing only `apps/web/.next/dev` and rerunning produced the passing result.

Lint exited 0 with no errors. The existing unused `ChatHistoryMessage` warning
remains in `apps/web/lib/chat-history.ts`.

### Eve build

`VERCEL=1 corepack pnpm --filter web exec eve build` exited 0.
`VERCEL=1 corepack pnpm check:eve-stream-duration` passed all 3 checks.

The expected local warning reported that `VERCEL_DEPLOYMENT_ID` is absent. No
prebuilt deployment was attempted.

### Browser review

The retained Playwright script captured 18 updated screenshots through the
real report, lesson, worksheet, retry, Keep, handoff, and Parents settings
components:

- 9 phone screenshots at exactly 390 by 844 pixels;
- 9 desktop screenshots at exactly 1440 by 900 pixels;
- one mocked Build, one mocked Keep, and two mocked Retry requests per
  viewport;
- both retry-target errors rendered with their matching action;
- the exact phone-editor URL was verified;
- the signed-in adult's existing cell-number field opened and received focus;
- the other adult's row remained read-only;
- no browser console errors;
- no uncaught page errors; and
- no real API, database, Blob, analytics, or provider request.

All 18 screenshots were visually reviewed. No copy or layout blocker was
found.

Updated corpus:

```text
.superpowers/sdd/retention-final-copy.md
.superpowers/sdd/retention-final-review-artifacts.md
.tmp-retention-bridge-review/capture_review.py
.tmp-retention-bridge-review/screenshots/
```

The temporary route and development-only proxy bypass were removed after
capture. `apps/web/proxy.ts` has no retained diff.

### Final hygiene

- IDE diagnostics retain the existing Edge Tools false positives for dynamic
  `aria-busy` and inline avatar sizing. ESLint reports 0 errors.
- `git diff --check`: passed.
- Updated code, skill, fixture, script, and corpus text contain no em dash.
- No temporary review route remains.

## Constraints honored

- This pass created or edited no migration.
- This pass changed no environment file or value.
- No commit was created.
- No push was attempted.
- No deployment or production probe was attempted.

## Blockers

None.
