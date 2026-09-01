# Agent operations: driving native onboarding + paywall

What the 2026-08-30/31 sessions paid to learn, written down so the next
session pays nothing. Candidate to graduate to
`docs/homa-planning/runbooks/` once this branch merges; until then it
lives beside the spec it serves. Per-agent memory should point here, not
duplicate this.

## Read this first: you are pointing at production

`apps/mobile/.env` pins `EXPO_PUBLIC_API_URL=https://thankshoma.com` and
the production Supabase project. Every account you create, child you name,
and report you score is a real production row. Consequences:

- Test signups must use the `+homatest` email alias (auto-sandboxed);
  never `@example.com`, whose delivery failures page the founder console.
- Do not tap purchase, restore, or account-deletion paths without explicit
  direction. The paywall's buttons are a real money surface.
- To run against a local backend instead: `pnpm --filter web dev` and
  switch `EXPO_PUBLIC_API_URL` to `http://localhost:3000` (values are
  inlined at build time, so rebuild after changing).

## Build and run (the working pipeline)

`expo run:ios` fails on this Mac: a paired physical iPhone confuses its
device resolution and it dies on code signing. Bypass it entirely:

1. Metro: `cd apps/mobile && npx expo start --port 8081` (leave running).
2. Build for the simulator by UDID, which forces the simulator signing
   context:
   `xcodebuild -workspace ios/Homa.xcworkspace -scheme Homa -destination "platform=iOS Simulator,id=<UDID>" build`
3. Install and launch:
   `xcrun simctl install <UDID> <path-to-built-.app>` then
   `xcrun simctl launch <UDID> com.thankshoma.homa`
4. The dev client auto-discovers the Metro server; if it shows the
   development-servers screen, pick the running one.

Also: `eve build` in apps/web deletes the `.eve` snapshot a live
`pnpm dev` is pinned to (every turn 500s until the dev server restarts),
and fresh worktrees need `corepack pnpm install` or the eve patch is
silently dropped.

Two more traps, paid for 2026-08-31 (gh#1045 execution):

- **`npx expo install <pkg>` fails in this repo**: it shells to the
  bare `pnpm` (Homebrew v10 vs the corepack-pinned version) and dies on
  the store-dir mismatch. It DOES print the SDK-matched versions before
  dying; take those and run
  `corepack pnpm add "<pkg>@<version>"` inside `apps/mobile`.
- **A fresh worktree has no `ios/`** (prebuild output is gitignored):
  run `npx expo prebuild --platform ios` in `apps/mobile`, and know
  that its pod-install step dies on this Mac's missing LANG (the same
  root cause the `expo run:ios` trap documents) with a Unicode
  CompatibilityError buried in a Ruby traceback. Run
  `cd ios && LANG=en_US.UTF-8 pod install` yourself, then the usual
  UDID-targeted xcodebuild.
- **The fingerprint command in older docs is wrong for this tree**:
  `npx expo fingerprint --platform ios` errors (`unknown or unexpected
  option`), and because the error text is identical on both trees, a
  piped before/after "diff" of it reads as UNCHANGED, a false green
  this session briefly believed. The working invocation:
  `cd apps/mobile && ./node_modules/.bin/fingerprint . | jq -r .hash`.
  Never compare fingerprints through a pipeline that can swallow the
  command failing.

## Simulator traps (each cost real time once)

- **Text renders enormous / layout broken**: a stuck accessibility text
  scale. The real defaults key is
  `com.apple.UIKit UIPreferredContentSizeCategoryName` (not
  `UIContentSizeCategory`, not `-globalDomain`). Fix:
  `xcrun simctl spawn <UDID> defaults write com.apple.UIKit UIPreferredContentSizeCategoryName -string "UICTContentSizeCategoryL"`
  then reboot the simulator. Homa's own code handles large scales
  correctly (`NativeAction` branches on `fontScale >= 2`), so this
  symptom is environmental, not a Homa bug.
- **Taps silently no-op**: the Simulator host window lost macOS focus
  (another app fronted). Verify with System Events, refront with
  `osascript -e 'tell application "Simulator" to activate'`, and confirm
  the frontmost process before resuming. Batches of taps issued while
  unfocused vanish without error.
- **First tap after a screen transition drops**: seen repeatedly.
  `xcrun simctl terminate` + `launch` is a safe reset because onboarding
  answers persist server-side the instant they are given; relaunch
  resumes the exact step (resumability is a product law, and it makes
  crash-recovery free for drivers too).
- **No `testID`s exist in shipped mobile code** (verified 2026-08-31, the
  count is zero), so until spec Outcome 7 lands, driving means
  screenshot-then-tap with pixel coordinates. Re-screenshot after every
  tap; never chain blind taps. Spec Outcome 7 exists to delete this
  bullet.

## Driving the walk

Screen order: `hello → intent → kids → you → making → reveal → next`,
then the AI-disclosure consent card, then chat. `you`'s state field is
optional; `kids` requires name, age, and at least one subject.

The checklist (`ChecklistTakeover`) close/score-shaped call sites and
their side effects. This table is the one home of that inventory (spec
Outcome 6 and system-model principle 1 point here; update it here,
nowhere else). **Updated 2026-08-31 (D8, gh#1045 execution): the "See
it" bypass is collapsed**; the walk now has ONE close path.

| Path | What it fires | Deterministic? |
|---|---|---|
| Checklist's own close/done (in `making`), with at least one answer (`handleChecklistClose`) | `finalizeReport()` → `POST /api/map/score` → report scored → onboarding record flips (and, since move 1, emits `onboarding.completed` with its cause) | yes |
| The ready banner's "See it" button (in `making`) | the SAME `handleChecklistClose`, fed the checklist's live position via its `onPosition` callback, so an answered session finalizes on the way out; the navigate effect then routes to `/reveal` | yes |
| Checklist close in chat (`chat-session.tsx`) | a hidden `checklist_complete` directive; eve judges what to do with it | no; model-mediated |
| Report-reveal card mount in chat (`onboarding-cards.tsx`, `if (!card.alreadyScored)`) | `finalizeReport()` if unscored; this is what actually scored the 2026-08-31 verification after eve chose to render the card | only once eve renders it |

## Arming the wall organically (the verified sequence, 2026-08-31)

Until the sandbox harness (spec Outcome 8) exists, this is the fastest
real path, roughly 40 minutes end to end:

1. Complete the walk through `making`; answer at least one checklist
   question there, or skip ahead and do it from chat.
2. In chat, ask to continue the child's progress questions ("Can I answer
   a few more progress questions about Nora?"). Homa renders the
   checklist card; tap "Pick up where you left off".
3. Answer to "Questions complete", then close via the card's own button
   ("Back to the chat"). Caveat: this path is model-mediated (it sends
   the directive; scoring fires when eve renders the report-reveal card,
   whose mount calls `finalizeReport()` if unscored). If the pill in step
   4 never appears, fall back to the deterministic path: a checklist
   session closed inside `making` with at least one answer.
4. Confirm the "Progress report ready" pill in chat; that pill IS the
   report card whose mount fires the scoring.
5. Relaunch the app (`simctl terminate` + `launch`). The gate only
   re-checks on mount and app-foreground (`use-billing-gate.ts:65-80`; no
   polling, no push), so the wall appears on next launch, not mid-session.

Expected on the paywall in a simulator: "We can't reach the App Store
right now". There is no StoreKit configuration in this run mode; that
error is environmental, do not chase it.

## Verifying state (until the inspect surface exists)

Today the only read is behavioral: relaunch and look. Nothing exposes
`families.context.onboarding` or the gate's reasons (the gate route
returns one boolean; the flip emits no event). Once system-model.md moves
1-4 land, replace all of this with: read the transition event, read the
gate's shaped response, read the inspect surface, and screenshot only
when judging how it looks.
