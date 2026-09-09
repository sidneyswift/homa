# Onboarding v2 clarity pass

Owner: [#1141](https://github.com/sidneyswift/homa/issues/1141). Local prototype only.

The founder asked to apply the principles established through the parent and child forms to the remaining onboarding screens: explicit tasks, familiar questions, self-explanatory inputs, no duplicate instructions, timely guidance, editable defaults, grouped actions, a clear primary action, consistent forms, and keyboard/accessibility support.

| Surface | Decision and reason |
| --- | --- |
| Welcome | The shared sign-in screen uses “Homeschool, handled.” The v2 introduction has three illustrated benefit pages with Continue, then “Let's get started” leading to About you. Post-signup v2 routing remains part of account integration. |
| Parent and children | Preserve the approved form content and behavior. |
| Relationship | Ask the relationship directly; use full-width choices and a footer action. |
| State | Keep a stable question and searchable choices, show a no-results state, keep Continue reachable. |
| Homeschool status | Use readable full-width choices and a stable heading. |
| Help priorities | Ask what help is wanted; remove reactions that replace the question and promise work this screen does not do. |
| Curriculum | Ask which curriculum is used and show the searchable multi-select picker immediately; support 174 catalog choices and explicit custom-name additions. Keep alternate statuses as secondary text actions only while the selection is empty. [Research and verification](2026-09-09-onboarding-v2-curriculum-picker.md). |
| First child | Name the choice directly, label ages, keep the footer consistent. |
| Interests | Offer age-based suggestions, full-list search, multiple selections, and custom additions. Store answers per child and show removable selections as plain rows. |
| Subject and duration | Name the requested lesson preference and use explicit units. |
| Question introduction | Explain the real subject count and Not sure, then Start questions. |
| Progress questions | Select before Continue, allow Back corrections, keep actual subject progress visible. |
| School days | Preserve weekday defaults and use a task-specific creation action. |
| Preparing preview | Remove simulated completion percentages and separate job claims. |
| Lesson preview | Give the sample space; remove contradictory personalization claims. |
| Report | Remove forced narration taps, attribute answers to the parent, show readable subject evidence and actionable empty states. |
| Week | Show the plan without claiming a calendar write; provide a route to supply missing answers. |
| Reminder | Specify one reminder tomorrow, group actions, and show permission or scheduling failure when it occurs. |
| Account | Name account creation instead of Last step; keep legal copy at this decision. |
| Paywall | Preserve existing price/trial options; clarify selected state, renewal terms, and free continuation. Remove the unscheduled reminder promise. |
| Completion | Open the lesson preview directly, name it as a preview, and close it without repeating the account/paywall flow. |

## Boundaries

No production release, schema, or account integration is part of this pass. Existing scoring, free/paid rules, prices, and native configuration remain outside this refinement. The lesson remains a labelled sample; the account and trial paths remain prototype transitions. Notification permission is exercised only by the parent's explicit tap.

## Verification

Completed locally on 2026-09-09, across all 23 routes (21 remaining screens plus the previously approved parent and child forms).

- Mobile typecheck and lint passed after the implementation and final copy refinements.
- `check:mobile-chat`: 117 tests passed. Five new tests cover question resumption, abandoned-branch removal after a correction, early-finish drafts, completion/review, and exposure-subject skipping. The new test file is wired into the existing guard.
- `check:mobile-accessibility`: classification checks, 18 source/contrast tests, isolated runtime typecheck, and 36 rendered tests passed. This is a shared-guard result, not accessibility certification of the lab. The prototype is excluded from the production surface audit.
- iPhone 17 / iOS 26.5: walked the flow with synthetic Sarah Smith, Maya and Leo. Checked search no-results/recovery, full subject-list scrolling, keyboard-open forms, curriculum draft saved by Continue, visible interest Add, returning to saved input, selection before Continue, Back correction, adaptive follow-up, early finish, report evidence, full-week scrolling, reminder skip, both price/trial selections, free continuation, reopening the preview, membership rows, and empty report/week states.
- Read-only reader gate completed before the editor gate. The editor returned no must-fix notes; its repetition notes led to removing duplicate lesson/report headings. A fresh interface reader inspected a numbered 25-image sequence exactly once. Follow-up edits expose trial length on both plan cards, name the sample/preview truthfully, explain the one-day free limit before the paywall, and skip the reminder offer on empty-report continuation.
- `git diff --check` passed. No commit, push, deployment, schema change, or live account/purchase occurred.

### Evidence

Screenshots live in `/Users/sidneyswift/.codex/visualizations/2026/09/09/01a08407-0a8a-7070-ba55-c36c8dc9f58a/`, numbered `clarity-01-welcome.png` through `clarity-29-paywall-final.png`. The 25-image main sequence covers the flow and scroll stops; 26 covers a membership row, 27 and 28 cover empty states, and 29 shows final trial labels. The brief loading transition was also inspected directly in the simulator. Earlier captures precede the last small copy and footer-spacing refinements.

Largest text sizes and a physical VoiceOver walkthrough remain unverified. The existing automatic approval rejection of simulator text-size changes was respected. Notification permission/scheduling was not triggered during this pass; its skip path was exercised and failure handling reviewed. Real auth, billing, generated lessons, and delivery remain outside this local prototype.

## Review findings that require the next prototype phase

These are open product-behavior gaps tracked by #1141, not claims that this UI pass implemented them:

- The core week preview uses fixed daily activity templates. It does not yet honor the chosen lesson duration or turn those daily suggestions into discrete scheduled lessons. Subject/curriculum/interest preferences need a real planner/materials path that visibly follows those choices. Fix the producer when implementing this, not a rendered family's text.
- The flow plans for one selected child. A visible next-child path needs per-child answer and preference state so switching children never reuses another child's evidence.
- The free one-day versus member-week boundary is now disclosed in the preview. Actual post-signup entitlement and saved-plan behavior still need the real account/billing integration.
- The reader found the overall setup long despite early finish and explicit subject count. A later cadence pass should bound the work needed for the first usable lesson and reconsider when optional account/reminder/report steps appear.

The lab issue remains open under its original graduation/deletion criterion.

## Follow-up: multiple help priorities

Founder correction, 2026-09-09: the help-priority question accepts more than one answer. It now asks "What would you like help with?" and stores an array of topics. Rows expose checkbox semantics; "Choose all that apply" explains multiple selection and "Select all topics" selects all six concrete topics, and any can be removed independently. Continue requires at least one topic and retains the complete set across navigation. Other choice screens retain their radio semantics.

Verified in the iPhone simulator: two simultaneous selections, Continue then Back, select all, remove one from all, clear all with Continue disabled, and reselect two. Mobile typecheck/lint and diff whitespace checks passed. Screenshot: `help-priorities-multiple.png` in the evidence directory above.

A fresh screenshot reader confirmed the two selected rows are clear. Its feedback led to the explicit multi-select instruction and the unambiguous Select all topics label. Final screenshot: `help-priorities-multiple-final.png`.

## Follow-up: sign-in promise and new-parent introduction

Founder direction, 2026-09-09: shorten the shared sign-in subtitle to “Homeschool, handled.” and put the explanation in one new-parent introduction, replacing the existing v2 welcome. The introduction presents custom printable lessons, a clear picture of progress, and organized homeschool hours as three plain-text benefits. “Let's get started” opens About you. It removes the previous two-bubble reveal and duplicate Start free/Sign in decision.

The screenshot supplied by the founder is `(auth)/signin.tsx`, while v2 is a separately previewable lab. This iteration changes the shared sign-in copy and v2 welcome. The intended order is sign-in, introduction for new parents, then About you. The actual authenticated `OnboardingGate` still uses the existing native walk and bypasses it for completed and web-born families. Connecting the v2 preview to real account setup, durable answers, and the returning-parent routing remains #1141's integration work. No account creation or real post-login journey was exercised in this iteration.

Verified: both screens rendered in the iPhone 17 simulator; the introduction's action opens the first/last name form and Back returns. Mobile typecheck and lint passed; the accessibility guard passed, including 36 rendered tests covering the shared sign-in screen and other primitives. Evidence: `welcome-01-signin-tagline.png` and `welcome-02-benefits-introduction.png` in the same local evidence directory.

Copy reader completed before the editor, which returned no notes. A fresh visual reader confirmed the benefits were easy to scan and the primary actions were obvious and reachable. Both readers wanted concrete value before signup; retain the founder-approved order for this prototype and test that assumption with new parents before integrating the funnel. This is simulated reader feedback, not measured conversion evidence.

## Follow-up: illustrated feature introduction

Founder approval, 2026-09-09: replace the one-screen feature list with three pages based on the Headspace introductory carousel, specifically its headline, short explanation, large lower illustration, pagination, and stable Continue button. Reference: [Headspace onboarding](https://mobbin.com/flows/7cdc08c0-3bcb-4882-90dd-5cf92019616f).

The pages introduce printable lessons, child progress, and homeschool hours. Each keeps the v2 palette and serif headline. `IntroductionArt.tsx` composes decorative vector worksheets, a learning path, and a clock/journal with the existing native Logo adapter. These are illustrative objects, not generated lessons or family records. The last CTA opens About you; returning from that form preserves the last page. Continue, Back, and accessible page-dot buttons share the page index. Native horizontal paging supports swiping. Measured vertical overflow enables scrolling for tall content while the footer stays separate. Page announcements use the shared accessibility helper; Reduced Motion disables animated programmatic paging. Android Back handling is scoped to route focus.

Copy reader preceded the editor, which found no must-fix issues. Both flagged repeated hours copy as a possible refinement; keep the approved wording for this visual iteration. The screenshot reader found the purpose, pagination, and fixed CTA clear and reachable. Its concern about a rising graph feeling like a score led to a learning path with book, counting, and star milestones, without a score axis or completion verdict. These reviews are simulated feedback, not user research.

Simulator evidence: `intro-carousel-01-lessons.png`, `intro-carousel-02-progress.png`, and `intro-carousel-03-hours.png` in the evidence directory above. The second image records the initial graph before the learning-path refinement. Continue through all three pages, Back between pages, page-dot navigation, opening About you, and returning to the final page passed in the iPhone 17 simulator. The automated drag check was inconclusive and eventually returned `windowNotFoundAtPosition`; founder swipe verification was requested. Large text, physical VoiceOver, and Android device behavior remain unverified. The mobile accessibility guard passed 18 source/contrast tests and 36 rendered tests; it does not certify this excluded lab surface. No auth, database, billing, deployment, or real family data changed.

Final introduction artwork evidence: `intro-carousel-02-progress-final.png` captures the revised learning path in the simulator.

## Follow-up: state list uses available height

Founder screenshot, 2026-09-09: the state list stopped midway through a card with a large unused area above the footer. The state route imposed `maxHeight: 320` on a nested ScrollView. Replace the fixed cap with a flexing list and use the existing Stage `scroll={false}` mode, so this route owns one scroll area under its fixed search field. The existing footer retains its own measured space; state selection, search, and outside-US behavior are unchanged.

Verified on iPhone 17: seven complete rows fit above the footer at rest; keyboard opening and dismissal keep search and footer visible. Evidence: `state-picker-full-height.png`. Mobile typecheck, lint, and diff whitespace checks passed. Further pointer-driven scroll/search testing was limited by the simulator automation's window-position and clipboard errors; no production behavior was changed.

A fresh final screenshot reader found the revised progress artwork friendly without a score impression and the state question, rows, search, and footer easy to understand. Remaining suggestions were a clearer indication of additional states below the viewport and more concrete detail about progress data entry. Retain the founder-approved concise copy; the search field and native scrolling remain the current ways to reach other states.


## Follow-up: age-based interests and familiar favorites

Founder direction, 2026-09-09: offer choices as well as custom interests, adapt suggestions to the selected child's age, and include familiar shows and games such as Toy Story, PAW Patrol, Pokémon, and Roblox.

`InterestPicker.tsx` follows the curriculum picker interaction: searchable choices, multiple checks, a separate Add action for custom names, a stable Done button, and plain removable rows on the question screen. The default list contains 12 starter ideas; See all interests and search expose the complete 61-name catalog, including 21 franchises. Five editorial age groups cover under 3, 3 to 5, 6 to 8, 9 to 12, and 13-plus. These are starting suggestions, not developmental prescriptions, popularity rankings, or media safety ratings. All interests remain searchable at every age. Name matching ignores case, extra whitespace, and accents, so pokemon resolves to Pokémon. Names follow the planner's 40-character and eight-interest limits.

Selections now live on each local `V2Kid` instead of the shared `loving` answer. Switching children retains each child's choices; changing a birthday changes suggestions without clearing selections. Skip clears only the current child's interests. The week preview reads the selected child's interests. This remains the on-device lab state; no database migration, account integration, or production write is included.

Official context consulted: [PAW Patrol Academy](https://www.pawpatrol.com/academy) describes its preschool audience; [Pokémon Parents](https://parents.pokemon.com/en-us/) covers its family products; [Roblox Safety FAQs](https://about.roblox.com/safety-faqs) explains that content maturity varies by experience and parental settings. These references inform editorial handling, not a claim that a whole franchise has one approved age.

The copy reader prompted a shorter initial list, Choose a few favorites, reduced overlap between categories, and separate Add and Done actions. The copy editor returned no must-fix or suggestion notes. The founder's previously removed activities explanation remains omitted.

Verified locally: mobile typecheck and lint passed; check:mobile-chat passed 129 tests, including five new tests covering age boundaries, catalog availability, accent/case matching, custom entries, limits, and child isolation. The shared accessibility guard passed its 18 source/contrast tests and 36 rendered tests; the lab itself remains excluded from the production surface audit. In the iPhone 17 simulator, verified PAW Patrol plus Toy Story selection, accent-free Pokémon search, custom Rock collecting addition, keyboard-open layout, reopening saved checks, See all interests, the eight-selection limit and disabled unselected rows, and removal to re-enable choices. Age boundary and cross-child isolation checks are automated unit evidence, not a multi-child simulator walkthrough. No Android, physical VoiceOver, or large-text certification is claimed.

Evidence in the local directory above: interests-01-suggestions.png, interests-02-custom.png, and interests-03-selected.png. No commit, push, or deployment was made. The lab issue remains open.


The fresh interface reader found suggested selection and the final plain rows clear, but identified ambiguity between Add and Done for a new custom name, the count looking like a target, selected items outside the viewport, and Skip after answering. Final refinements put selected items first, show only the current selection count, hide Skip once answered, and promote an unmatched custom name to the primary Add button. Add saves the name and returns immediately; the keyboard submit also adds it. A partial search with matching choices still offers a separate explicit custom Add action. The redundant No matches message is removed. Existing 44-point removal hit areas are retained. Verified the final Add Kites action, immediate return, removal, Continue, Back, and retained selections in the simulator. Final evidence: interests-04-custom-final.png and interests-05-selected-final.png. Typecheck, lint, the 129 mobile tests, and whitespace checks passed after these refinements.
