# Native accessibility source foundation evidence

**Issue:** [gh#633](https://github.com/sidneyswift/homa/issues/633)

**Award plan:** `docs/homa-planning/plans/2026-08-02-native-mobile-award-gauntlet.md`

**Observed:** 2026-08-02

**Implementation commit:** `94e78cd62db3d2717caf68f6f5dfcf5199c8168f`

**Base commit:** `49e9f8ecfb73a2688b7ce3f8e7f5cdedbd65b81c`

**Branch:** `codex/native-accessibility-foundation`

**Status:** Source foundation verified. Rendered, simulator, physical-device, and study evidence remain open.

## Verdict

The implementation commit removes the confirmed source-level P0 and P1 accessibility defects found in the native route gauntlet. It also adds a repeatable accessibility contract to CI and the mobile OTA workflow.

This is not closure evidence for gh#633. Source inspection and unit tests cannot prove final native VoiceOver order, physical target frames, Dynamic Type geometry, system handoff recovery, spoken Voice cadence, or task parity for an accessibility-setting user. The acceptance manifest deliberately leaves those dimensions open.

## What the source foundation changes

### Shared interaction contract

- `AccessibleModal` owns modal isolation, required visible-heading focus, the VoiceOver Escape gesture, Reduce Motion transitions, and optional explicit return focus.
- `IconButton` gives icon-only actions a named 44-point target.
- `LoadingStatus` exposes one named progress state through the shared announcement adapter.
- `TextField` associates its visible label with its input, guarantees a 48-point frame, and uses contrast-safe idle and focused boundaries.
- `Button` uses the approved darker brand interaction token and respects Reduce Motion.
- The shared announcement hook deduplicates one occurrence across rerenders and accepts an occurrence ID when the same message is valid for a later event.
- The bounded focus helper retries for at most three animation frames rather than waiting indefinitely.

### Route and journey corrections

- The navigation drawer hides closed descendants, isolates the background while open, moves focus to the close action, supports Escape and explicit return focus, distinguishes dismissal from navigation, scrolls at large text, owns safe areas, and removes motion when requested.
- Voice and the persistent Voice dock share state-specific listening, working, speaking, paused, muted, and failure announcements. The dock owns the bottom safe area and reflows at large text.
- Chat stacks the composer at large text, avoids motion-based scrolling when Reduce Motion is active, announces a bounded safe completion once per turn, and gives retry and queued-message removal real 44-point targets.
- Planner switches to a chronological list at the largest text size, expands target frames, names child ownership and time boundaries, keeps source links operable, stacks dense action rows, and makes sheets scrollable.
- Progress, Binder, Hours, Tasks, Settings, family setup, account recovery, lesson recording, print, share, calendar export, and state records use the shared modal, status, contrast, scaling, or motor contracts where applicable.
- Recovery screens now retain a centered normal-size layout while gaining a scroll escape at the largest text size.

### Regression system

`check:mobile-accessibility` now runs before merge and before an OTA publish. Its AST-based scanner and tests enforce:

- All Expo routes are classified. The non-production Voice lab has one explicit exclusion.
- All discovered native and external system handoffs are registered.
- The five award journeys name loading, streaming, success, error, interruption, empty, recovery, and system-handoff states.
- Production code does not bypass the shared modal, loading, announcement, or scaling policies.
- Essential text is not clamped without a full-text alternative.
- Normal text does not use known under-contrast semantic tokens.
- Bespoke input placeholders do not use the under-contrast placeholder token.
- Approved text pairs meet 4.5:1 and approved control boundaries meet 3:1.

## Source verification

All commands below ran in the isolated worktree against the implementation commit using the repository Node 24 runtime where `tsx` was involved.

| Check | Result |
|---|---|
| `corepack pnpm --filter mobile typecheck` | PASS |
| `corepack pnpm --filter mobile lint` | PASS |
| `corepack pnpm check:mobile-chat` | PASS, 107 of 107 tests |
| `corepack pnpm check:mobile-bootstrap` | PASS, 15 of 15 tests |
| `corepack pnpm check:mobile-planner` | PASS, 26 of 26 tests |
| `corepack pnpm check:mobile-progress` | PASS, 49 of 49 tests |
| `corepack pnpm check:mobile-voice` | PASS, 147 of 147 tests |
| `corepack pnpm check:mobile-accessibility` | PASS, 14 of 14 tests |
| `git diff --check` | PASS |
| `node scripts/em-dash-check.mjs` | PASS, 0 violations |

`corepack pnpm check:docs -- --allow-open` remains FAIL on the repository's pre-existing documentation reconciliation state. The run reported 244 open manifest rows, an invalid immutable baseline, broad coverage gaps, migration evidence drift, and claim-ledger errors. This evidence file also appears as an unregistered candidate among the many current planning and evidence files outside that historical manifest. That result is not represented as an accessibility failure or as a passing documentation gate.

The accessibility command additionally reported:

- 14 Expo surfaces classified.
- 18 native or external handoffs registered.
- Five priority journeys carrying all required evidence dimensions.
- Production source using the shared modal, loading, scaling, and announcement policies.

An independent read-only review of the final source tree found no confirmed surviving source-level P0 or P1 accessibility defects.

## Acceptance status

| gh#633 criterion | Source evidence | Current status |
|---|---|---|
| VoiceOver order and focus match visual meaning | Shared modal and drawer isolation, visible-heading focus, Escape, named controls, source review | OPEN, requires physical VoiceOver traversal and every system handoff |
| Largest Dynamic Type keeps actions and status available | Removed essential clamps, large-text reflow branches, scroll escapes, static guard | OPEN, requires AX5 on compact and large supported iPhones |
| Increased Contrast and Differentiate Without Color preserve state | Tested semantic pairs, checked and expanded states, labels, icons, thumb position, and non-color receipts | OPEN, requires rendered and device evaluation with system settings |
| Reduce Motion removes nonessential movement without hiding state | Shared modal, drawer, Voice, Chat, and Button motion policies plus explicit text and state | OPEN, requires release-build observation during Voice and route transitions |
| Targets are at least 44 points and primary actions remain reachable | Shared primitives and route corrections establish source-level floors | OPEN, requires final accessibility frames and one-handed physical-device reach |
| State changes are announced once in plain language | Shared deduplicating adapter, event occurrence IDs, safe Chat completion, semantic Voice states | OPEN, requires real speech cadence and duplicate-speech observation on iOS |
| Five-participant study includes an accessibility-setting user | No repository artifact can satisfy this | OPEN, study not run |

## Open device and user evidence

For every journey in `apps/mobile/src/lib/accessibility/acceptance-manifest.ts`, record the release build, iPhone model, iOS version, system settings, expected result, actual result, defect, fix commit, and rerun result.

### VoiceOver

- Traverse every priority route, sheet, modal, overlay, drawer, and system handoff in semantic order.
- Confirm only the active modal is reachable.
- Confirm the visible heading receives initial focus.
- Confirm Escape dismisses every dismissible surface.
- Confirm focus returns to the invoking control when it remains mounted.
- Confirm status, error, interruption, and completion speech occurs once and does not mask Homa's audio.

### Dynamic Type and motor use

- Run AX5 on the smallest and largest supported iPhone layouts.
- Include keyboard-open forms, recovery screens, sheets, Planner month and scheduler, Voice controls, Chat composer, and account gates.
- Inspect final accessibility frames for 44-point size, overlap, reachability, and one-handed access.
- Confirm no required action is available only through precise drag, swipe, or color recognition.

### Visual accessibility settings

- Increased Contrast.
- Bold Text.
- Differentiate Without Color.
- Smart Invert.
- Reduce Motion.
- Switch Control.

### System and hardware handoffs

- Apple sign-in.
- Google sign-in.
- StoreKit purchase and restore.
- Microphone prime, permission, denial, Settings recovery, and return.
- Calendar permission, destination picker, event creation, partial failure, cancellation, and return.
- Print destination sheet, cancellation, completion wording, and return.
- Share destination sheet, cancellation, completion wording, and return.
- Browser and PDF opening, then focus recovery on return.
- A real spoken Voice turn covering capture, playback, interruption, route changes, audio-route changes, incoming interruption, weak network, and recovery.

### Usability study

The five-participant priority-journey study must record setting used, normal proficiency, completion, moderator rescue, errors, parity, and recommendation intent. A participant who uses a non-screen-reader setting does not substitute for a regular VoiceOver evaluation.

## Known product gates outside this source foundation

The acceptance manifest keeps product absence separate from accessibility implementation:

- gh#304 owns native onboarding and the first useful family outcome.
- gh#303 owns the missing native Today surface.
- gh#623 and gh#645 own the complete evidence-first Progress next-move loop.
- gh#620 owns a verified physical spoken Voice turn and hardware recovery.
- gh#606 and gh#618 remain blocked on the founder's re-added-adult privacy ruling before caregiver collaboration can ship safely.

No source-level accessibility result changes those product statuses.

## Closure rule

Do not close gh#633 from this evidence. Close it only when every issue criterion has physical or study proof attached, every defect found in those runs has a fix commit and passing rerun, and the exact release build carrying the fixes is verified on the production mobile channel.
