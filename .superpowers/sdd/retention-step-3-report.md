# Retention bridge Step 3 report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Scope delivered

- Restored `SubjectLessonButton` and focused report/button tests.
- Restored the flag-on per-subject `Build the next lesson` and
  `Open the lesson` branch.
- Restored one AA-safe strong primary lesson action on every eligible scored
  subject.
- Kept `Answer a few deeper questions` as the separate secondary action.
- Restored current-target owner summaries and ready-only token summaries.
- Restored owner-aware permanent-token and signed-in app report call sites.
- Restored safe sample and founder-mirror labels.
- Added explicit negative eligibility and Build/Open exclusivity assertions.
- Kept the whole-child month untouched.
- Kept the exact flag-off legacy per-subject four-week-plan action.

## Explicit exclusions

- No scoring-step change.
- No map-flow change.
- No deep-dive redirect.
- No planner change.
- No Complete route, control, or event.
- No Keep control or effect.
- No migration or environment change.

Focused tests assert that `scoring-step.tsx` and `map-flow.tsx` contain no
subject-lesson build redirect or retained lesson loading copy.

## Subject action behavior

An eligible action requires all of these:

- the exact subject lesson flag is on;
- the score is not exposure-based; and
- the score position is not `not_mapped`.

Each eligible subject renders one strong primary action:

- no current target-matching lesson: `Build the next lesson`;
- current target-matching lesson: `Open the lesson`.

The deeper-question action remains secondary.

When the flag is false, the existing `DoorLink` remains unchanged:

```text
Build the 4-week plan
door: plan
/onboarding/r/{token}/plan/{subjectId}
```

No subject lesson query runs while the flag is false. The whole-child
`MonthButton`, `MONTH_PLAN_SUBJECT`, and month offer logic were not changed.

## Access and safe shared reads

### Owner build

The permanent-token and signed-in app pages confirm the first family member
with `isFamilyAccountOwner`.

- Only that owner receives a build control.
- An invited member receives no build control.
- An auth lookup failure leaves the action read-only.
- The build route remains the server authority for owner scope, wall state,
  idempotency, and session startup.

### Token viewer

A token-only viewer cannot build. The report loads only current ready lesson
summaries through the permanent token. If one matches the current target, the
viewer receives the safe `Open the lesson` link.

Queued, running, and failed state remains owner-only.

### Founder mirror

The founder-gated mirror loads the same current-target summaries as the family
view so its label matches:

- `Build the next lesson`; or
- `Open the lesson`.

The lesson and deeper-question controls remain inert with `hers to tap`.

### Sample

The sample performs no lesson query. Its flag-on subject action remains bound
to `/onboarding` and reads:

```text
Get your own report to build lessons
```

## Current-target filtering

Both report summary readers load their complete source facts in one query:

- the report child's birth date;
- all current `child_answers`;
- current lesson candidates; and
- each candidate's stored source fingerprint.

There is no per-subject database query loop.

The shared pure helper
`filterSubjectLessonSummariesForCurrentTargets` reuses:

- Task 1 `selectSubjectLessonTarget`; and
- Task 2 `lessonSourceFingerprint`.

It recomputes one fingerprint per candidate subject and keeps only matching
rows. A changed answer that selects a new target removes the old lesson from
the card summary, so the owner sees `Build the next lesson`. The read does not
supersede or mutate the old row. The existing build transaction remains the
only supersession authority.

The token reader also requires:

- an unrevoked permanent report;
- a non-deleted family;
- `superseded_at is null`; and
- `build_status = 'ready'`.

Only the bounded `SubjectLessonSummary` leaves either reader. Stored source
fingerprints never enter report props.

## SubjectLessonButton

An existing lesson is a plain link. A new build tap:

1. sends the exact beacon:

   ```text
   { kind: "door_tap", door: "lesson", childId }
   ```

2. opens a preloaded `WallModal` before any POST when the wall is present;
3. otherwise posts only `{ childId, subjectId }` to
   `/api/map/subject-lesson/build`; and
4. navigates only after an HTTP-successful `{ ok: true, url }` response.

The accepted copy is:

```text
Making the lesson...
Your report is safe. The lesson didn't start. You can try again.
Your report is safe. Only the account that created this report can build the lesson. Sign in with that account, then try again.
Your report is safe. Refresh this page, then try the lesson again.
```

The button and link use:

- a 44px minimum target;
- `clay-700` normal and `clay-600` hover;
- white action text;
- the existing report motion contract; and
- the existing focus token.

Info notes use `text-strong` on `info-soft`. The focused test resolves those
tokens to stone-900 and sky-100 and verifies at least 4.5:1 contrast.

## TDD evidence

### Current-target filter RED

The changed-answer regression was added before the shared helper:

```text
corepack pnpm exec tsx --test \
  apps/web/lib/subject-lessons/summary-filter.test.ts

exit code 1
tests 1
pass 0
fail 1
Cannot find module './summary-filter'
```

### Current-target filter GREEN

```text
tests 1
suites 1
pass 1
fail 0
```

The test builds a Math lesson fingerprint, changes the answers so the
deterministic target moves to the next rung, and proves the old summary is
removed.

### Report and button RED

The focused report/button suite was added before the button, report branch,
summary queries, and call-site wiring:

```text
corepack pnpm exec tsx --test \
  "app/onboarding/r/[[]token[]]/subject-lesson-button.test.tsx"

exit code 1
tests 18
pass 3
fail 15
```

Expected failures included:

- no strong primary Build action;
- no Open action;
- missing `subject-lesson-button.tsx`;
- legacy sample and mirror labels;
- no ready-only token summary reader;
- no current-target source filtering; and
- no owner-aware report call-site wiring.

The three passing guards proved the legacy flag-off plan action, whole-child
month, and lack of deep-dive restoration before implementation.

### Report and button GREEN

```text
tests 18
suites 3
pass 18
fail 0
```

The initial focused suite covered flag-off retention, positive eligible
Build/Open treatment, token denial, ready shared links, mirror and sample
behavior, exact beaconing, wall-before-POST behavior, POST shape, accepted
copy, AA contrast, current-target filtering, one-query contracts, call-site
access, and the deep-dive exclusion.

### Step 3 review assertion closure

The review found that the production eligibility branch was correct but its
negative cases and mutual exclusion were not explicit enough in the focused
test. No production code changed for this closure.

The focused report test now asserts:

- every exposure-based card renders neither `Build the next lesson` nor
  `Open the lesson`, even when a lesson summary is supplied;
- every `not_mapped` card renders neither lesson action, even when a lesson
  summary is supplied;
- every eligible no-current card renders one Build action and no Open action;
  and
- every eligible current card renders one Open action and no Build action.

Final focused result:

```text
tests 19
suites 3
pass 19
fail 0
```

## Verification

### Focused report and button test

```text
corepack pnpm exec tsx --test \
  "app/onboarding/r/[[]token[]]/subject-lesson-button.test.tsx"

tests 19
suites 3
pass 19
fail 0
```

### Retained subject lesson suite

```text
corepack pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  "apps/web/lib/subject-lessons/*.test.ts" \
  packages/core/src/events.test.ts \
  packages/core/src/map/lesson-target.test.ts \
  apps/web/components/billing/wall-copy.test.ts

tests 112
suites 31
pass 112
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

### Web typecheck

```text
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
corepack pnpm exec next build \
  --debug-build-paths="app/onboarding/r/[token]/page.tsx,app/onboarding/sample/page.tsx,app/app/[childId]/report/page.tsx,app/admin/families/[familyId]/report/[childId]/page.tsx"

Compiled successfully
Finished TypeScript
```

The selected route manifest includes:

- `/onboarding/r/[token]`;
- `/onboarding/sample`;
- `/app/[childId]/report`; and
- `/admin/families/[familyId]/report/[childId]`.

Next.js emitted the same nested-worktree root-inference warning recorded in
Step 2. The build ran from this isolated worktree and selected only the report
surfaces.

### Isolation

```text
corepack pnpm check:isolation

exit code 2
Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The isolated worktree intentionally has no local secret-bearing environment
files. No environment value was copied or changed. Tenant scope and
target-current filtering remain covered by focused source contracts and the
pure changed-target regression.

### Whitespace and diagnostics

- `git diff --check`: exit 0.
- Edited-file IDE diagnostics: no new errors.
- New and edited Step 3 files contain no em dash.

## Files

Created:

- `apps/web/app/onboarding/r/[token]/subject-lesson-button.tsx`
- `apps/web/app/onboarding/r/[token]/subject-lesson-button.test.tsx`
- `apps/web/lib/subject-lessons/summary-filter.ts`
- `apps/web/lib/subject-lessons/summary-filter.test.ts`
- `.superpowers/sdd/retention-step-3-report.md`

Modified:

- `apps/web/app/onboarding/r/[token]/report-view.tsx`
- `apps/web/app/onboarding/r/[token]/report-button.ts`
- `apps/web/app/onboarding/r/[token]/page.tsx`
- `apps/web/app/app/[childId]/report/page.tsx`
- `apps/web/app/admin/families/[familyId]/report/[childId]/page.tsx`
- `apps/web/app/onboarding/sample/page.tsx`
- `apps/web/lib/subject-lessons/store.ts`
- `apps/web/lib/map/store.ts`
- `apps/web/components/billing/wall-copy.ts`
- `apps/web/components/billing/wall-copy.test.ts`

## Explicitly not performed

- No migration was applied or rewritten.
- No environment value was set or changed.
- No commit or push occurred.
- No deployment or production probe occurred.
- No file outside the isolated worktree was modified.
