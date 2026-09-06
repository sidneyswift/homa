# Child scope verification, September 6, 2026

Issues: [#1106](https://github.com/sidneyswift/homa/issues/1106), [#1113](https://github.com/sidneyswift/homa/issues/1113). Intent and original evidence: [feedback review F22](../../plans/2026-09-05-cofounder-feedback-review.md#f22-make-the-actual-child-scope-visible).

## Observed failure and corrected path

A production Planner link focused on Jordan while the preference cookie selected Avery. The Hours list showed Avery's 11 minutes plus 5 shared minutes, but its child total showed Jordan's 5 minutes. The top-level selection, list and total did not agree. Ordinary selection worked, which is why checking only the switcher's presence missed this failure.

The page and both switcher hosts now use the same owned-child resolver. A single valid linked child takes precedence over the stored preference. Duplicate, stale or foreign query values fall back to the validated preference. This is a display preference only; authentication and family scoping remain authoritative.

Planner view/date links preserve the validated child. An explicit parent selection saves the preference and removes the temporary child/report-handoff query, including when the clicked child is already highlighted. The selector names the current child or whole family without requiring the parent to open it. Pending writes prevent duplicate clicks; a failed write exposes the current selection with retry/dismiss controls. Completing a slow write after navigating away does not take the parent back to the previous page. Reachable chat/report callers handle selection failure before navigating.

Hours explains that child scope includes shared family time. Binder labels its family-wide paperwork and month plans; kept and draft materials retain existing child-plus-shared filtering. The family-wide spreadsheet download is named accordingly until #1095 changes export scoping.

A separate production Binder defect showed a failed-search message when all kept materials were already on the default cover and no search was active. The default empty remainder is now omitted. A truly empty library and an active search with zero matches retain their different guidance.

## Verification completed before publication

- 62 focused deterministic tests passed across the resolver, Planner links, Hours scope, Binder cover/empty states and failed chat-entry actions.
- 180 onboarding checks passed, including callers affected by selection error handling.
- Web TypeScript, scoped ESLint, isolation preflight and full Next build passed. The build also verified real Chromium archives in all four required function traces.
- Independent source review found no remaining actionable findings. It checked selection precedence, query retirement, pending/retry/navigation behavior, reachable action callers, static-route Suspense boundaries and Binder search distinctions.
- Copy reader feedback was implemented; the subsequent copy editor reported no must-fix or suggested changes.

## Browser and production limits

Local browser verification uses the actual ContextSwitcher, HoursView, BinderView, shared scope helpers, family-wide cards and compiled production CSS with synthetic data. Next navigation, server preference persistence, data loading and artifact effects are explicit fixture boundaries. Its control page uses an exact-width iframe; earlier screenshots whose frame was shrunk by outer margins are not accepted as width certification.

The headless Chromium fixture passed eight scenario groups: URL/preference mismatch plus selecting the checked override; whole-family/each-child rows; failed selection and exact retry; leaving while pending; repeated/unowned query fallback; long-name selection at a measured 320-pixel viewport with 320-pixel document width; single-child control absence; and Binder cover, empty/search states with shared-child filtering. No page errors occurred. The 390- and 320-pixel captures use the corrected frame geometry. Headless clicks establish browser interaction behavior, not physical touch certification.

The screenshot reader identified a profile-like child control and an empty-state sentence that omitted shared family materials. The final version adds the existing dropdown icon, uses 44-pixel retry/dismiss targets and explicitly includes shared family items in the empty heading. The settled 320-pixel selector places the entire long-name option between y=700 and y=820 inside its 844-pixel viewport. Earlier animation-in-progress captures are superseded. A separate copy reader/editor pass accepted the clarified empty heading. The uncertainty wording on failed selection is intentional: a missing response cannot prove whether the server stored the preference.

Synthetic evidence: [browser results](2026-09-06-child-scope/scope-browser-results.json), [390-pixel selected view](2026-09-06-child-scope/scope-390-url-override.png), [failed switch](2026-09-06-child-scope/scope-390-switch-failure.png), [320-pixel closed control](2026-09-06-child-scope/scope-320-long-name.png), [open control](2026-09-06-child-scope/scope-320-open-selector.png), [Binder cover](2026-09-06-child-scope/scope-binder-cover-full.png), [empty search](2026-09-06-child-scope/scope-binder-search-full.png), [empty child view](2026-09-06-child-scope/scope-binder-empty-full.png). Fixture fonts use the local DM Sans 700 face for all DM Sans weights, so these captures establish layout and state distinctions, not exact production font-weight parity.

The signed-in desktop browser is temporarily unavailable while the Mac is locked. No deployment or production acceptance is claimed here. The production acceptance must repeat the contradictory URL/preference case, explicit switching and reload against the real server action, plus the populated Binder cover.
