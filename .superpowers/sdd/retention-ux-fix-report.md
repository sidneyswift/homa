# Retention bridge final UX fix report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Scope

This pass applies only the accepted final UX findings for the lesson wait
state, ready Keep helper, post-Keep handoff, and synthetic no-phone screenshot
fixture. It preserves report hierarchy, Not mapped labels, planner, Complete,
deep-dive behavior, phone-save behavior, and existing settings copy.

## Implementation log

- 2026-07-16 12:42 EDT, plan-confirmed: isolated the work to the requested
  subject-lessons worktree and mapped the existing focused tests, product
  components, capture script, copy corpus, and review artifact report.
- 2026-07-16 12:55 EDT, discovery: the real settings page already derives
  `phoneDisplay` from family phone rows and the editor already renders an empty
  value for `null`. Only the synthetic capture route and retained capture
  assertion carry the populated no-phone value.
- 2026-07-16 13:03 EDT, plan-confirmed: added the accepted behavior assertions
  first. The focused lesson test failed in the four expected wait, ready
  helper, draft Keep, and kept-handoff cases.
- 2026-07-16 13:07 EDT, plan-confirmed: changed only the wait view and Keep
  component needed to satisfy those failing tests. The settings product code
  remained unchanged.
- 2026-07-16 13:25 EDT, discovery: Next development hydration required the
  review server to bind explicitly to `127.0.0.1`, matching the retained
  capture process. Reusing that command produced the complete clean capture.
- 2026-07-16 13:36 EDT, discovery: the removed temporary route remained in
  Next's generated development validator. Clearing only
  `apps/web/.next/dev` removed the stale reference, then the full typecheck
  passed.

## Test-first evidence

The focused lesson and settings baseline passed 25 tests before behavior
changes.

The accepted assertions were written before product code. Their first lesson
run produced:

```text
tests 22
pass 18
fail 4
```

The four expected failures covered:

- the combined wait heading, readiness status, and saved-request helper;
- the ready Keep boundary helper;
- the owner draft Keep helper; and
- the chat-first kept handoff with its separate optional phone section.

After the minimal product changes, the focused lesson and settings run passed
all 25 tests.

## Delivered behavior

### Wait

Queued and running owner states now present one unambiguous group:

```text
HOMA is making the lesson and worksheet
This page updates when both are ready.
You can leave and come back. Your request is saved.
```

The previous split lesson and worksheet status strings are absent.

### Ready Keep boundary

`Print it` and `Keep in Binder` are unchanged. The helper now says:

```text
Binder saves the worksheet for later. The lesson stays at this link.
```

### Post-Keep handoff

`Message HOMA about this lesson` remains the dominant filled primary action.
Families without a linked phone then see a separate section made only with
existing tokens:

```text
Prefer text?
Phone setup is optional. HOMA sends one research note by text each weekday morning.
Open phone settings
```

The complete section is absent when a phone is linked.

### Synthetic no-phone fixture

The temporary review fixture supplied `null` phone values, matching the real
settings data shape for a family without a linked phone. The retained capture
script now requires the focused `#my-phone` input to have an empty value.
Neither the settings data derivation nor phone-save behavior changed.

## Verification

### Focused and subject lesson tests

```text
focused lesson, Keep, handoff, settings: 25 passed
complete subject lesson suite:            164 passed in 40 suites
```

### Progress UI

`corepack pnpm check:progress-ui` passed 128 tests in 38 suites.

### Event and skill guards

```text
check:events                  passed
check:fleet-skills            passed
check:skills-targeting        passed
check:fleet-skills-dormant    passed
check:taxonomy                passed
```

The fleet-skill and targeting commands emitted their existing package-module
warnings only.

### Typechecks and lint

All four workspace typechecks passed after the stale generated development
route cache was removed. Lint exited 0 with no errors. The existing unused
`ChatHistoryMessage` warning remains in `apps/web/lib/chat-history.ts`.

### Eve

`VERCEL=1 corepack pnpm --filter web exec eve build` exited 0.
`VERCEL=1 corepack pnpm check:eve-stream-duration` passed all 3 checks.
The expected local build warning reported that `VERCEL_DEPLOYMENT_ID` is
absent. No prebuilt deployment was attempted.

### Browser capture

The retained Playwright process captured and checked all 18 screens:

- 9 phone screenshots at exactly 390 by 844 pixels;
- 9 desktop screenshots at exactly 1440 by 900 pixels;
- one mocked Build, one mocked Keep, and two mocked Retry requests per
  viewport;
- the exact accepted wait, ready helper, and post-Keep strings;
- chat as the dominant handoff action;
- absence of the phone section for the phone-linked state;
- the no-phone editor focused with an empty field;
- no browser console errors; and
- no uncaught page errors.

All 18 screenshots were visually reviewed. The temporary route and
development-only proxy bypass were removed after capture.

### Final hygiene

- `git diff --check` passed.
- The temporary review route is absent.
- `apps/web/proxy.ts` has no retained diff.
- The final capture script passes Python syntax compilation.
- Edited product files have no IDE linter errors.
- Changed product, fixture, corpus, and report text has no trailing whitespace
  or em dash.

## Constraints honored

- No migration was created, edited, or applied.
- No environment file or value was added, changed, or copied.
- No commit was created.
- No push was attempted.
- No deployment or production probe was attempted.
- Not mapped labels, report hierarchy, planner, Complete, deep-dive behavior,
  phone-save behavior, and existing settings copy were not changed.

## Blockers

None.
