# Retention bridge final prep report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Completed

- Read the current signed-in report subject action and its mutually exclusive
  Build, busy, failure, denial, wall-race, and Open branches.
- Read the active lesson shell, wait, ready, partial-failure, full-failure,
  retry, and inactive states.
- Read the worksheet `MaterialCard`, including visual and accessibility-only
  strings.
- Read the owner draft Keep control, pending and failed Keep states, and both
  post-Keep handoff variants.
- Read and verified the existing `/app/settings#parents` target.
- Extracted the retention copy in actual DOM reading order with mutually
  exclusive states labeled.
- Built and used a temporary development-only real-component route.
- Captured six states at 390 by 844 and six states at 1440 by 900.
- Clicked the real report Build control with a mocked successful Build response.
- Clicked the real Keep control with a mocked successful Keep response.
- Verified the new Keep moved focus to the persistent `Kept in Binder` status.
- Removed the temporary route and temporary proxy bypass after capture.
- Retained only the requested Playwright script and screenshots under the
  scratch directory.

## Final artifacts

Copy inventory:

```text
.superpowers/sdd/retention-final-copy.md
```

Review evidence and screenshot manifest:

```text
.superpowers/sdd/retention-final-review-artifacts.md
```

Capture script:

```text
.tmp-retention-bridge-review/capture_review.py
```

Screenshots:

```text
.tmp-retention-bridge-review/screenshots/
```

This prep report:

```text
.superpowers/sdd/retention-final-prep-report.md
```

## Verification

### Temporary route typecheck

The temporary review route was present for this command:

```sh
corepack pnpm --filter web typecheck
```

Result: exit 0.

### Real-component browser capture

The webapp-testing server helper started and stopped one local Next development
server around:

```sh
python3 .tmp-retention-bridge-review/capture_review.py
```

Result:

```text
Captured 12 screenshots
4 mocked action requests
0 browser console errors
0 uncaught page errors
```

The four requests are one Build and one Keep for each viewport. Every request
used synthetic identifiers. Playwright intercepted all `/api/**` requests.

The script checked each PNG after capture:

- six files are exactly 390 by 844;
- six files are exactly 1440 by 900.

All 12 screenshots were then visually inspected.

### Focused retained-state regression

```sh
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  "apps/web/app/onboarding/r/[[]token[]]/lesson/[[]subjectId[]]/lesson-view.test.tsx" \
  "apps/web/app/onboarding/r/[[]token[]]/subject-lesson-button.test.tsx"
```

Result:

```text
tests 40
pass 40
fail 0
```

This includes the report Build/Open split, wait and polling, ready worksheet,
partial and full failure, retry, Keep request contract, post-Keep focus,
conditional phone link, and `#parents` anchor checks.

### Retained script syntax

```sh
python3 -m py_compile .tmp-retention-bridge-review/capture_review.py
```

Result: exit 0. The generated Python cache was removed afterward.

### Cleanup and scope

- `git diff -- apps/web/proxy.ts`: empty.
- `apps/web/app/retention-bridge-review-dev`: removed.
- Final targeted status contains only the requested documentation and scratch
  artifacts.
- New artifact text contains no em dash.

## Constraints honored

- No real family data was read or rendered.
- Generated review content is synthetic Maya literacy content only.
- No migration was applied.
- No environment value was set, changed, copied, or persisted.
- No product behavior, copy, or styling edit remains.
- No commit was created.
- No push or deployment was attempted.
- No production probe was performed.

## Blockers

None.
