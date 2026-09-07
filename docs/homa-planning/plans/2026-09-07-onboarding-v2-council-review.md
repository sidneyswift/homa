<!-- Provenance: produced 2026-09-07 by a multi-agent council workflow (12 expert lenses plus 3 gap lenses named by a completeness critic; one fact-and-law auditor per lens; a chair wrote the tensions memo; a synthesizer wrote this document). Inputs: the v2 design brief presented to the founder that day and docs/homa-planning/plans/2026-09-07-keiki-onboarding-reference-analysis.md. Council findings are advice under review, not decisions; founder rulings live in journeys/10-reconciliation.md. -->

# Homa mobile onboarding v2: council synthesis

Date: 2026-09-07. Source: 157 findings from 15 lenses (mom-new, mom-veteran, growth, assessment, native-ux, architecture, legal-privacy, voice-brand, edge-cases, retention-day2, competitive, data-strategy, materials-studio delivery owner, design-contract steward, eve context engineer), each fact-checked and law-checked; zero findings refuted; chair's tensions memo. Written for the founder. Keiki's visual direction and the account-last bet are taken as decided and improved, never relitigated.

Copy conventions used throughout: "Maya", "Texas", "dinosaurs", "The Good and the Beautiful" are placeholders rendered from rows, never hand-typed. Every child reference is the name or they/them; no proposed line guesses a gender. No proposed line carries a population statistic, a user count, a rating, or a verdict on a child. Counts of the family's own answers (the report header's existing `observationCount`) may render as a receipt; the copy below leaves them out.

---

## 1. Executive summary

1. **Cut the IEP modal. Replace the Building interrupts with the two facts the week cannot be placed without: school days and lesson length.** Ten lenses converged on cutting it (mom-new, mom-veteran, growth, assessment, legal-privacy, voice-brand, edge-cases, competitive, data-strategy, materials owner): no field consumes it, the narrative gate bans the vocabulary, D6 requires a sensitive flag that does not exist, and "To move forward, specify" is an order. Six lenses independently asked for the school-days question the design never poses.

2. **Every Building caption must name work the code actually does.** "Comparing to Texas benchmarks" is false (benchmarks are national; the state drives only the StateCard and hours rules), "Reading your curriculum's scope" is false (the plan builder never reads `curriculums`), and in v2.0 there is no backend at all. Nine lenses (assessment, native-ux, architecture, voice-brand, edge-cases, data-strategy, materials owner, design steward, competitive) converged; the making screen's honest-theater law already forbids it.

3. **Payoff order flips: Monday's page first, the report second as the why, the week last, and "ready by tomorrow morning" leaves the copy.** Page-first is the one lever real data supports (growth, retention-day2, competitive, gh#1053 H2); the report opens with what she said Maya does easily (mom-new). Seven lenses found "ready by tomorrow morning" a promise no layer can keep: no push, no worksheet-to-day join, a one-page-per-child idempotency key, and no trigger that enqueues Tue-Fri.

4. **Account-last has three server branches the brief assumes exist and that do not.** The mobile bootstrap returns 400 `no-email` for an anonymous user, so the walk cannot persist a single answer (architecture, edge-cases, both critical). A returning web mom's Apple or email link fails with `identity_already_exists` or `email_exists` and the no-fold rule orphans her whole sitting seconds after the aha (growth, architecture, legal-privacy, edge-cases, competitive, five lenses). AI-processing consent is recorded after the child's data has gone to the model (architecture, legal-privacy); this also holds for today's live v1 walk. Three lenses want a quiet "I already have a Homa account" link on Hello.

5. **Monday's page must read the ladder, and the ladder must be shaped so it can.** Today the page is built from whole-year age plus one chip, the root cause of the 28% first-delivery approval (materials owner, critical). Reorder the ladder so the start-with subject runs first with its rungs and two deep-dive items, kick the job at that subject boundary with a deterministic item-id contract, and run the other fifteen subjects under the ~85 second draw (materials owner, assessment, competitive, growth: cover and level fit converge here).

6. **The ladder needs a floor for the anxious mom.** It only climbs, so a mother whose child is not at the age-typical item taps Not yet sixteen times and never sees the corroborating beat (mom-new, critical). Add one capped downward rung so every subject ends on something the child does and the receipts list is never empty; drop the 16-segment bar (mom-new, growth), the Easily-only rewards (assessment), and any minutes claim (voice-brand, 08-31 ruling).

7. **Ten asks about mom and curriculum before the child's name will not survive cold traffic.** Reorder so the child exists by bubble three, cap the pre-value run at seven asks and two typed fields, and move styles, how closely, values, and how'd you find me to the week screen or the first chat turn, where each has a visible consumer (growth, mom-new, mom-veteran, data-strategy, legal-privacy, five lenses). Data-strategy: strictness has one reader (the settings display), and values, curriculums, and styles never reach materials-studio or Homa's per-turn context today.

8. **Keiki's persuasion beats are population statistics; Homa's are facts about her.** Four lenses (growth, assessment, voice-brand, competitive) converged on the replacement: after the state, a fact from `state_requirements`; after the curriculum tag, the atlas profile spoken back; after birth month, one named milestone with its source. Never a percentage, count, or star.

9. **The morning after the walk, Homa knows none of it.** No context block renders the scored report, the placed week, Monday's page, or the four queued builds, so her first question ("where is Tuesday's page?") depends on Homa guessing (eve context engineer, critical). The design ends at the paywall; the day-after loop (section 6) is where the founder's stated failure gets fixed or repeated.

10. **Two rulings and one live bug need action before the first lab file.** Record the 09-07 direction as a later ruling superseding the 08-21 bubble-grammar ruling and extending the Quiet authority contract with a bounded guided-conversation phase; add a `labs/` classification rule to the brand manifest (design steward, native-ux). **Live production failure:** iOS chat has quoted "$19 a month" since the 09-01 reprice; the one-line fix is PR #1135, unmerged. Also: five lines of the design copy guess the child's gender, the 2026-07-07 scar (voice-brand).

---

## 2. Must fix before building the lab

Critical and high findings that would make the lab misleading or violate a Homa law if ignored. Grouped by consequence.

### 2a. Live production failures (fix or escalate this session)

- **iOS chat quotes $19 a month.** `apps/web/agent/instructions/ios-mode.ts:27` still reads the pre-reprice price; the 09-01 ruling is $9.99/mo and $99.99/yr. Any parent asking the price in iOS chat since 09-01 has been told a number the paywall beside her contradicts. Status: fix committed as PR #1135 (branch `fix/ios-mode-price-ruling`, one line, 688 of 700 bytes in the ratchet, `pnpm check:agent-budget` 6/6). **Not merged, not deployed.** Action: merge #1135, watch Vercel READY, probe an iOS chat price question live. Housekeeping: rebase so the diff stops carrying the re-added Keiki reference doc; remove the scratch worktree `wt-ios-price` via `scripts/remove-worktree-safely.mjs`. Guard: assert in `lib/voice/ios-mode.test.ts` that `IOS_MODE_MARKDOWN` contains no `$19` and names one price per merchandised period from `APPLE_NEW_PURCHASE_PRODUCTS`. `sms-mode.ts:158` and `phone-rules.md:52` correctly keep $19 for web and phone. [eve context engineer]
- **AI-processing consent is recorded after processing in the live v1 walk.** The current TestFlight walk starts the first-making job and the report narrative before `record_ai_processing_consent` is written (the consent card sits after the walk). App Review 5.1.2(i). This is an inherited gap v2 widens. File as `bug`, `production`, `P1` today, or fix v1 in the same session: one affirmative consent tap before making, and the making and score routes checking consent server-side. [architecture, legal-privacy]

### 2b. Laws the design as drafted violates

| Design element | Law broken | Fix (detail in section 4) |
|---|---|---|
| "knowing if she's on track", "Where should I start with her?", "Here's her week." | Voice law 5, never guess a child's gender; `GENDERED_PRONOUNS` in `copy-laws.ts`, 2026-07-07 scar | Name or they/them everywhere; lint the lab string table with `GENDERED_PRONOUNS` [voice-brand] |
| "Does Maya have an IEP or learning difference?" modal over a paused bar, captioned "To move forward, specify:" | Never a verdict on a child; diagnosis vocabulary (`narrative-gate.ts`, `copy-laws.ts`); ruling D6 (sensitive flag, no artifact, analytics-excluded, TTL) with none of it built; she decides, Homa suggests; cadence law 11 | Cut. Replace with school days and lesson length [10 lenses] |
| "Comparing to Texas benchmarks", "Reading your curriculum's scope", "Picking Monday's lesson" | Tool honesty; `making.tsx` honest-theater law; true before clear | Captions from real stages only [9 lenses] |
| Stat interstitials, star ratings, credibility seals, "800K+", "82% of parents" | Claims law (no counts, ratings, percentages); copy-writer hard law | Fact receipts from `state_requirements`, atlas, item bank [growth, assessment, voice-brand, competitive] |
| "Just between us, promise" and "We never share or sold any information" | True before memorable; contradicts `/privacy` subprocessor list; shareable report and PDFs by design (D7) | Third bubble becomes the no-verdict promise; privacy demoted to the name-field caption using the policy's exact sentence [mom-new, legal-privacy, voice-brand] |
| Paywall screens 1 and 2 with "Try for $0.00" and no price | ROSCA, California ARL, App Review 3.1.2; S10 law: charge sentence directly under the button | Two screens: A narrative with "See the plans" (no StoreKit), B the shipped S10 [growth, legal-privacy, voice-brand, competitive] |
| App Store review request on the trial screen | 5.6.1, HIG timing; one-star exposure | Never in the walk [growth, legal-privacy, competitive] |
| "Ok, last step!" before three paywall screens; email plus password field | True first; passwordless ruling 2026-08-18 | "Save Maya's report and week so they're here tomorrow." plus three doors [mom-new, voice-brand, competitive] |
| "Tue-Fri ready by tomorrow morning" | Button and caption honesty; `get_agent_job_status` "never guess a finish date"; week-fills §5 | Status enum planned / queued / ready; no clock [7 lenses] |
| "I'll remind you each morning" | 08-31 ruling (never mid-walk) unrecorded reversal; promise nothing fires | Re-rule explicitly; body names the plan row, first DATE trigger at her chosen time [growth, legal-privacy, retention-day2, competitive] |
| Every prompt in a bubble; Homa docked top-left | 08-21 bubble-grammar ruling (`walk-scene.tsx` comment); four typed contract assertions in `brand.ts`, `identity.ts`; 08-02 quiet-authority ruling | Record 09-07 as a later ruling scoped to `labs/onboarding-v2`; contract extension at graduation [native-ux, design steward] |
| "Who should we start with?" with veteran's "the one you're wondering about most" | Never compare siblings | "Everyone gets a turn. Who's first?", entry order, no default highlight [edge-cases, voice-brand] |
| Any "you're covered" state line | No compliance promises (wall-copy guard, gh#423, gh#318) | Port StateCard's four laws; copy guard on compliant / covered / satisfies / counts toward [legal-privacy] |
| Any beat addressed to the child | `/privacy`: "We do not give children accounts or ask them to talk to Homa"; COPPA posture | Every bubble to the mother, child in third person; word-boundary lint [legal-privacy] |
| Fredoka for bubbles; coral fill with white text on the CTA | Contract typography roles; approved pairs (3.44:1 on white fails) | EB Garamond display and DM Sans; midnight CTA fill [design steward] |

### 2c. Things that would make the lab lie to the founder

- **v2.0 must compute the report and week with the real `@homa/core` pure functions on device**, not "plausible content". `scoreMap` and `buildMonthPlan` are pure, millisecond, no model. Three slots are server-only and must carry a visible "sample" stamp inside the lab: Monday's page (use an archived first-making preview from the eval:sandbox Walker fixture), the letter-shaped note, and the StateCard. [data-strategy, materials owner]
- **Simulate the real ~85 second build.** If the lab shows a ten second Building screen, the founder feels a wait that will never exist. Drive the bars from a scripted job-status fixture with a dev-only "simulated" banner. [growth, native-ux, design steward]
- **Run the anxious-mom answer pattern through the lab** (Not yet on most base items) alongside the strong-kid pattern. Without the downward rung the anxious pattern produces sixteen segments filling on sixteen admissions and an all-growing report; that is the persona the product is for. [mom-new, assessment]
- **The week screen needs the three-state status enum in the component** (ready / queued / planned) so the lab cannot render a promise the production path cannot back. [competitive, native-ux]
- **Anchor the week to the next school day, not Monday.** A Wednesday-evening walk that dates the first page six days out forfeits the first 48 hours. [mom-new, edge-cases, retention-day2, architecture]
- **Add the `labs/` classification rule to `scripts/brand-surfaces.mts` before the first lab file.** Today every `apps/mobile/src/app/**/*.tsx` (tracked or untracked) is classified `native-product`, so a regenerated `surfaces.json` would assert a Keiki-styled screen is a Quiet authority surface, exactly as `walk-scene.tsx` already does with its unlisted hex. [design steward]
- **The lab layout must not redirect on missing session** (v2.0 has no auth). Route per phase, push between phases, `usePreventRemove` during Building, `router.replace` into the report, `Stack.Protected` after link. [native-ux]
- **Reuse the vertical radio list from `checklist-takeover.tsx` for the ladder**, not four horizontal chips; Dynamic Type XL breaks the chip row and the 16-segment bar. [native-ux]
- **Payoff order page-first** in the lab from day one, so the founder feels the sequence the evidence supports, not the one that died on web. [growth, retention-day2, chair]

---

## 3. What was copied from Keiki that Homa cannot or should not do

| Keiki mechanic | Why Homa cannot or should not | Replacement |
|---|---|---|
| Third hello bubble is a privacy promise ("Just between us, promise") | Keiki puts a toddler on a device; the anxious homeschooler's fear is being told her child is not where they should be. Also untrue: the report is a shareable URL, PDFs are shareable by design, subprocessors receive data | Bubble 3: "You'll see what your kid can do right now, and exactly where to start Monday." Privacy becomes the name-field caption: "We never sell your data or share it with advertisers." linking /privacy [mom-new, legal-privacy, voice-brand] |
| "We never share or sell any information" caption | Contradicts `/privacy`; Section 5 exposure | The policy's exact sentence, above [legal-privacy] |
| Stat interstitials ("800K+ 3-year-olds", "82% of parents", "34% increase", "3x focus") and 5-star buddy cards | No paying customers: no counts, ratings, percentages anywhere | One true fact per slot from a real row: state fact, atlas profile, bank milestone with source. Identity line "Made by two homeschooling mothers" on the paywall, never a count [growth, assessment, voice-brand, competitive] |
| "Science-backed" credibility seal | Same claims law | The named sources per subject ("Sources I used"), which are the receipt [competitive] |
| Learning-buddy carousel | Homa is the companion; no alternates; stars barred | "Who should I start with?" as kid cards, or the first-focus carousel that decides Monday's subject [voice-brand, competitive] |
| "Does your kid have ADHD?" transposed to IEP | No consumer, diagnosis frame, D6 unbuilt, pre-account sensitive data | "Which days are school days?" and "About how long can Maya sit for a lesson?" [10 lenses] |
| "To move forward, specify:" | An order; she decides and Homa suggests | Never ship the phrase [voice-brand, native-ux, legal-privacy] |
| Three cosmetic Personalizing bars | `making.tsx` is a real job-status view; honest-theater law; motion contract `truthful-live-state-only` | Bar 1 scoring plus narrative, bar 2 instant check for plan rows, bar 3 the job's `progressNote` stream, no percentage [architecture, native-ux, design steward, materials owner] |
| Wave on hello; held heart and bell; confetti burst | Homa has no arms, hands, or mouth; anti-slop law 1; `hapticSuccess` limited to three moments | Speaking pop pulse plus gaze bias and one blink; parked `heart` and `bell` acts beside her like the crayon; gold sky plus one `hapticSuccess`, no particles [native-ux, design steward] |
| "Ok, last step! Sign up to track progress" with email and password | False before a paywall; passwordless ruling | "Save Maya's report and week so they're here tomorrow, on any phone." with Apple, Google, email code; then "Then I'll show you the plans." [mom-new, voice-brand, competitive] |
| Three-screen paywall, "Try for $0.00" on screens 1 and 2 | ROSCA, ARL, 3.1.2; S10 law | Two screens: A narrative (CTA "See the plans", no StoreKit), B the shipped S10 unchanged; reminder screen conditional on real permission state [growth, legal-privacy, voice-brand, competitive] |
| Review request on the trial screen | 5.6.1; TestFlight no-op; one-star exposure | Never in onboarding or on a billing screen; if ever, after a confirmed print via expo-store-review [growth, legal-privacy, competitive] |
| "7-day plan" preview of library activities | Keiki's activities exist at render; Homa's pages cost ~85 seconds and $0.45 each | Staged week with a status enum; Tue-Fri as the trial's object or a fleet library floor [growth, retention-day2, competitive] |
| Notification soft-ask promising "insights" / "each morning" | No remote push; a daily promise made in the walk must be kept forever | Body names the plan row: "Tomorrow for Maya: counting to 10. Open Homa." at her chosen time [retention-day2, legal-privacy, competitive] |
| Kid-facing beats ("Let Daniel pick a buddy") | Homa's privacy posture: children never operate the app | Every bubble to the mother [legal-privacy] |
| Purple field continuous from the splash | Homa's splash is a canvas identity asset; changing `app.json` orphans OTA | Field grows out of canvas over ≤320ms [design steward] |
| Rounded geometric sans for bubbles and chips | Fredoka is wordmark-only | EB Garamond display for bubble questions, DM Sans for chips and captions [design steward] |
| Green fill on selected chips | Borrowed semantic success (`states.ts`) | Midnight fill, paper text, `accessibilityState` selected [design steward] |
| One segment per question group visible up front | 07-06 web review: sixteen reads long at the moment she decides to commit | One continuous bar segmented by phase [mom-new, growth] |
| Account skippable before payment | Purchase would land on an anonymous identity with no claimable owner | Account before paywall, honestly framed [competitive] |

Two Keiki asks the design dropped and should restore: **"Who are you to Daniel?"** (a dad or grandparent is called mom for the whole walk otherwise; `family_members.role` already exists) and the **"I have an account" link on the welcome screen** (the cheapest fix for the returning-mom orphaning). [edge-cases, legal-privacy, competitive]

---

## 4. Improvements by phase

### Phase 1: Hello

**Copy.** Three bubbles, advancing on tap, never a timer:
1. "Hi, I'm Homa."
2. "Tell me about your family. I'll plan the week and draw Monday's page."
3. "You'll see what your kid can do right now, and exactly where to start Monday."
Bubble 2 promises exactly what the staged payoff delivers and reuses the walk's verb "draw". Bubble 3 is the promise this persona needs; the ladder keeps it visibly with "Skipped. Never counts against them." "No wrong answers. 'Not sure' is one of them." moves to the ladder's first bubble where it primes the escape chip. [mom-new, voice-brand, legal-privacy; chair below-the-line]

**Returning door.** One caption-weight text link below the third bubble: "I already have a Homa account", routing to the existing three-door `signin.tsx` and the D6 web world. Not a button; the founder asked for no chrome. [legal-privacy, edge-cases, competitive]

**Privacy and consent.** No consent control on Hello; consent lands on the first-child add (phase 2). The name-field caption carries the policy's exact sentence with a link to /privacy. [chair, legal-privacy]

**Speaker.** Bubbles are Homa in first person. Chips and captions carry no pronoun. "We" appears only when it means mom and Homa together. Persistent strings become "Sources I used" and "How I made this". [voice-brand]

**Cold open.** First frame is canvas with the mark where the splash left it; the field rises behind her over ≤320ms (Reduce Motion: final still); then bubble one grows. Do not touch `app.json`. [design steward]

**Shrink-and-dock spec.** Add `posture: 'big' | 'docked'` to the character provider, set once by Hello's third bubble, never reverted by a screen hook (today's `useWalkCharacterSize` reverts on unmount). Big = 160pt centered on the crest; docked = 48pt at (insets.top + 8, 16). One outer `Animated.View` with translateX, translateY, scale; pixel `transformOrigin` at her base (never a percentage string, the 2026-07-31 Fabric scar); 350ms, SETTLE bezier (0.22, 0.8, 0.28, 1), no overshoot. Hide Aura (a ~125pt box at 48pt) and the crayon in docked posture; keep the ground shadow. Reduce Motion: hard cut plus 150ms crossfade. No haptic on the dock (system-initiated motion; the tap already carried it). [native-ux]

**Bubble grow-in spec.** Render at final layout size, then scale 0.6 to 1 plus opacity 0 to 1, origin at the tail tip in pixels, 240ms SETTLE, text fades in over the last 120ms. Big posture: bubble below her, tail at top center pointing up to her base (WalkSpeech's existing geometry). Docked: tail left, tip at her right edge at about 40% of her height. Swaps: shrink to 0.85 plus fade 150ms, then grow the new one. `layout={LinearTransition}` on the container for height changes only (the one acceptable layout animation). `speaking` while the bubble grows, `listening` while she waits. Reduce Motion: opacity only. Reuse `WalkSpeech` with a `tail: 'top' | 'left'` prop; radius and padding read from native-projection (today 18 and 20 are literals). [native-ux, design steward]

**No wave.** Speaking pop pulse, a pupil bias toward the bubble (needs a gaze-target prop), one blink timed to bubble one's settle (needs a one-shot blink; blink is a free-running loop today). [native-ux, design steward]

**Typography.** Bubble question = display cardTitle 20/26 or sectionTitle; bubble caption = body; chip label = control (DM Sans 600, 15px, 14px floor); never Fredoka outside `Logo`. [design steward]

**Accessibility.** `announceForAccessibility` on each bubble's arrival and on screen change; VoiceOver focus to the bubble text. [eve context engineer, native-ux]

**Ruling.** Record 09-07 as a later ruling (`walk-mascot-leads-before-first-artifact`) superseding the 08-21 bubble-grammar ruling, scoped to `labs/onboarding-v2`, in `build-log.md` and `10-reconciliation.md` §5; note promotion re-opens it; back-fill the unrecorded 08-21 rulings as historical rows. [native-ux, design steward]

### Phase 2: You (was "Mom")

**Rename the phase "You".** The design itself should stop assuming. [edge-cases]

**Reorder so the child exists by bubble three** (see section 8 for the full run): "Who's learning at home?" first, then "And you? What should I call you?" (reciprocity after the child), then relationship, then state. Every later bubble can say the name. [mom-new, growth]

**Relationship.** "And you're Maya's..." chips Mom / Dad / Grandparent / Someone else, stored as `family_members.role` plus a display term in `families.context`. Bubbles use "you" and the child's name, never "mom". The report note and Friday letter read the display term. [edge-cases]

**Name.** Write both `families.parent_display_name` and the caller's `family_members.display_name` in one authenticated route (extend `/api/onboarding/basics`), or `speakingWith` renders null on the first morning. Sequence: bubble grows, focus the field after settle (~300ms), `returnKeyType` done advances. [eve context engineer, native-ux]

**State.** Bubble carries its why: "Which state? Each one has its own homeschool rules and I'll keep yours straight." Control: a single "Texas" pill opening a searchable formSheet with two-letter abbreviations (no device-region preselect; it needs location permission). Add "I'm outside the US" (sets `us_state` null, hides the StateCard, skips hours). [mom-new, native-ux, edge-cases]

**State fact give-back**, rendered from the `state_requirements` row, source named, never hand-typed: "Texas: no hours log, no notice to file. One less thing." For a high-regulation state: "New York asks for a notice of intent and quarterly reports. I'll keep the dates straight." Never "compliant", "covered", "satisfies", "counts toward", "meets New York's"; add that copy guard to the lab. [growth, voice-brand, competitive, legal-privacy]

**"Homeschooling already, or getting started?"** 44pt chips (Keiki grammar): already / starting this year / just exploring. Branches the curriculum ask in phase 3. Store `context.homeschoolStatus`. [mom-new, growth, data-strategy, native-ux]

**"What's hardest right now?"** Revised chips, multi-kid reality included, duplicate escape removed: "Keeping a schedule", "Knowing if they're on track", "Finding materials", "Juggling more than one kid at once", "Keeping the little one busy while I teach", "Hours and records" (shown only when the state's regulation level is moderate or high), "All of it, honestly". One reactive bubble per answer, each true under the page-first payoff:
- on track: "That's the report's whole job: where Maya is right now and what comes next."
- materials: "Then Monday's page comes first."
- schedule: "I'll put the week on your calendar before you're done."
- juggling / little one: "Then the week will have a shared block first, and a page for the little one while you teach."
- hours and records: "I'll keep the hours you teach in one place."
- all of it: "Fair. Let's start with one kid and one week."
Store `context.hardestNow` as an enum via `mapExtrasSchema`. Consumers that must ship in the same PR: the one caption under the week (phase 6) and a `family_memories` row for the first chat turn. If neither ships, cut the question rather than store it dark. Do not route the payoff order by it in v2.0. [mom-new, mom-veteran, voice-brand, data-strategy, retention-day2, edge-cases; chair #4, #7]

**"How'd you find me?"** Out of the pre-value run: the account step (or a Building slot if one is free). Chips are the five constrained `families.source` values in her words: "A friend", "Instagram or TikTok", "A conference", "Searching", "Somewhere else". Skippable. Keep it in first person. [data-strategy, growth, mom-veteran, voice-brand]

**"Styles you follow?" and "How closely?"** Out of the pre-value run. Styles: single-select (only `styles[0]` is ever consumed), asked post-payoff or, for already-homeschooling families, prefilled from the atlas `approach_tags` after the recognition bubble so it is one confirming tap. How closely: post-payoff, and only when a curriculum or style exists (web already gated it). [growth, data-strategy, mom-veteran]

**Budget.** At most seven asks before the FRAME; two typed fields for starting/exploring (kid name, mom name), three for already-homeschooling (plus curriculum tags). Every ask carries its one-line use, the pattern `kids.tsx` already set. [growth, mom-new]

**Chip mechanics.** flexWrap, minHeight 44, no fixed width, one column at `fontScale >= 1.35`; role radio or checkbox; selected = midnight fill, paper text, `accessibilityState` selected; press-in scale 0.97 over 100ms, fill via `interpolateColor` 120ms, `hapticTick` same frame; CTA disabled-to-enabled crossfade 150ms, no glow; `hapticAdvance` once on the tap. Reduce Motion: instant color, haptics stay. Record the four numbers once in the lab token file. [native-ux, design steward]

**Keyboard.** Add `react-native-keyboard-controller` (native module: new TestFlight build before OTA resumes; run `npx expo fingerprint --platform ios` before and after). Dock, bar, and bubble fixed at top; primary button in a `KeyboardStickyView`. [native-ux]

**Silent captures.** Device time zone via `/api/onboarding/basics` (already accepted). [data-strategy]

### Phase 3: Curriculum and the first child

**"Who's learning at home?"** (now the first question of the walk). Per kid: "First name or nickname" with the existing caption "First name is enough. It goes on their worksheet." Birth month and year via two native wheels (years = last 18), writing `birth_month` and `birth_year`; store day 15 with `birthdayApproximate` true when the day is absent. Decide the 07-11 full-birthday ruling: add the day as an optional third wheel on the same screen, or record the supersession in the build-log. Cap at five: "Up to five, and you can add more later." Compute months immediately; branch on `inRange` (under 24 or over 203 months): under 2 gets no questionnaire and "Maya's progress report opens at 2. Here's a week of play for now."; 17+ gets the top band with beyondScale honesty. [legal-privacy, assessment, edge-cases, native-ux]

**First child add = the trust moment.** Lazily mint the anonymous user here (not on Hello) and make this Continue the affirmative AI-processing consent tap in Homa's voice ("I'll use what you tell me to make Maya's pages and report."), calling `record_ai_processing_consent` on the anonymous membership, with `LegalLine` under it. Building routes require consent server-side. [chair #1, architecture, legal-privacy]

**Persistence.** Every answer written to AsyncStorage on each tap, keyed by the anonymous user id, reconciled to `mobile_onboarding_state` when online, with a small "saved" / "will save when you're back online" state in the docked chrome; on resume, hydrate local first, land on the exact bubble, and say "Picking up where we left off." [edge-cases, mom-veteran, architecture]

**Curriculum, branched.** Already-homeschooling: the tag input, with autocomplete rendered as a horizontal chip strip in the sticky keyboard accessory (or a formSheet search), never a dropdown. Starting / exploring: one chip question, "Have you picked a curriculum yet?" (yes, let me type it / still looking / building my own), with "tell me more" expanding into the atlas. [mom-new, growth, native-ux]

**Recognize the curriculum out loud** from atlas fields the moment a tag resolves: "Math-U-See: mastery-based, one concept at a time. I'll keep math in step with it, not on top of it." / "The Good and the Beautiful: open-and-go, faith-based, K through 8. I know it well." Unmatched: "Haven't met that one yet. I'll follow your lead." Store `context.curriculumProfileIds`. Then per curriculum, two chips: which kid(s) use it and an optional level ("Gamma", "Level 3"), stored in family context jsonb for v2.1 unless `child_curricula` fits. Put this bubble before the ladder as the first proof of competence. [mom-veteran, competitive, voice-brand, data-strategy]

**"Anything that matters to your family?"** Out of the pre-value run; on the week screen as "Anything I should weave into Tuesday's pages?" or in post-payoff settings (which already renders it). Wherever it lands: Skip as a first-class chip; chips first (faith-based / secular / nature and outdoors / low screens / add a note); textarea optional, multiline, three-line max, with a pedagogy-first placeholder ("Nature every day, no screens before lunch, we read the Bible together") and a hint that welcomes how a child learns; write straight to context jsonb; add `scanMemoryContent` to `/api/map/extras` (a real gap). Same PR: /privacy lists "values, faith, and family preferences you choose to share" and "your state"; ASC App Privacy answers add Sensitive Info; `PrivacyInfo.xcprivacy` `NSPrivacyCollectedDataTypes` (empty today) brought into agreement. [legal-privacy, mom-new, growth, data-strategy, mom-veteran]

**Wire the fields that claim to be read.** Before v2.1: add `context.styles/curriculums/values` to `loadFamilyContextPinned`'s select and render a bounded `homeschool` object in `renderFamilyContext` (values capped at 500 chars); pass `curriculums` into the plan builder (a `PlanContext` slot exists and is dead at `plans.ts:477, 505`). Fix the three false claims: `save_homeschool_profile.ts:17-20`, `homeschool-step.tsx:111`, `settings/homeschool-section.tsx:23`. Until wired, no caption mentions curriculum. [data-strategy, eve context engineer, mom-veteran, architecture]

**Per-child warm asks.** "What's Maya loving right now?" (tag input). "Where should I start with Maya?" as a chip pick over the 16 `MAP_SUBJECTS` or a swipeable first-focus carousel of three or four cards for the age ("Letters and sounds", "Numbers", "Pencil and hands", "A bit of everything"), each with one line on what Monday's page becomes and its own "Start here". No stars. The chosen subject is deterministic by construction (or model-proposed and code-verified against the enum, never a keyword table). Write both `profile.focus` (joined string) and `context.helpWith` (array) from one save. Rotate interests across days in the week builder (`plans.ts:477` picks `interests[0]` for every activity today) and say so: "Monday is dinosaurs, Wednesday is drawing." [competitive, materials owner, data-strategy, assessment]

**Lesson length, before the kick.** Synthesizer note: because Monday's page now starts at the first subject boundary (phase 4), the fact that sizes the page must be known before it. Ask "About how long can Maya sit for a lesson?" (10 / 20 / 30 / 45 min, default preselected, one tap or skip) here, after the start-with pick, and write `context.lessonMinutes` into a typed `materialPlanSchema` field. The chair's memo placed both days and minutes as Building interrupts; days stays there (it only shapes placement). [data-strategy, materials owner, mom-new]

**"Who should I start with?"** (not "we"). "Everyone gets a turn. Who's first?" with a caption "I'll map one now, the others after." Chips in entry order, no default highlight, name plus age label (twins and same names stay distinguishable), in-range kids only, and a mixed family defaults to an in-range child. Store `context.firstChildId`. Never ask why. [edge-cases, voice-brand, mom-veteran, assessment, data-strategy]

**Response mode (optional, child profile tag).** "Does Maya write with a pencil yet, or mostly draw and point?" (write / trace / point) may sit here as a tag, feeding format choice; not a Building modal. [materials owner; chair below-the-line]

### Phase 4: Questionnaire

**FRAME, then anchor, then the escape.** Bubble before the ladder: "Sixteen quick subjects, then Maya's report and the first week." Count named once, no minutes (the 08-31 mobile ruling stands; the 07-06 minutes cue stays web). First ladder bubble: "No wrong answers. 'Not sure' is one of them." Scale anchor once: "Easily means you've seen it this week without help. Getting there means sometimes, or with help." [growth, voice-brand, assessment; chair #6]

**Order: the start-with subject first.** Run its base item, its rungs, and two deep-dive items via `nextDeepDiveItem` (stored with source `deep_dive`) so it reaches `highConfidence`. At its boundary: write those `child_answers`, call `selectSubjectLessonTarget`, POST the making with the target contract, and show one beat: "Monday's page starts from this." The remaining fifteen subjects run under the ~85 second draw. Score the full report with `createReport` at the ladder's end. [materials owner, assessment, competitive, growth; chair #3]

**Depth: a guaranteed floor, then an optional climb.** Sixteen base items plus one capped downward rung whenever a base gets Not yet, so every subject ends on something the child does and the receipts list is never empty. Homa's reaction on that Easily: "Got it, that's where Maya is in numbers. Perfect place to start." Then, only for subjects that earned it: "Want me to find where Maya's math run ends? Two or three more." Amend `bank.ts:11-12` to say downward drilling is off in the climb and one capped downward rung is on at the base. [mom-new, assessment; chair #6]

**Kids seven and up** get a per-subject "not now, ask me later" that defers rather than discards and renders as "not mapped yet" (the header already counts subjects mapped). The `computer_science` and `spanish` intros name a skip; give those two segments a visible Skip. Every skip flashes "Skipped. Never counts against them." One escape chip per question otherwise: "Not sure". [mom-veteran, voice-brand, mom-new, assessment]

**Rewards.** Drop the "On a roll" badge; kicker neutral ("One more on this."); never an answer-reactive reward after a chip tap. The one citation receipt allowed, after an Easily on an above-age rung only: "Counting past 20 is typical closer to 4½, per Head Start's framework. Noted." Never after Not yet or Getting there, never a percentage. [assessment]

**Controls.** Reuse `checklist-takeover.tsx`'s vertical radio list (44pt rows) and its progress header (parent role progressbar, `accessibilityValue` text, decorative segments hidden). One continuous bar docked with small Homa, segmented by phase (you, family, Maya, building), never by subject; subject name in Homa's bubble ("Next: books and reading."). Header chevron returns to the previous question with its answer selected (upsert, never append). [native-ux, mom-new, growth]

**Subject intros** rendered unchanged from `content.ts` as the mascot bubble; any fix happens there followed by `pnpm check:map`. [voice-brand]

**Evidence floor before Building.** If fewer than three subjects are mapped: "I don't have enough to draw Maya's picture yet. Three quick ones about what you've actually seen them do?" re-asking math, literacy, and social_emotional bases with Not sure visually quieter. If still unmet, degrade honestly: no report card, a week from age plus interests, captions naming only real work. An all-not-sure walk today produces a week targeting the lowest rung in the bank regardless of age. [edge-cases]

**"Not sure" becomes Monday's observation.** When a core base item is not_sure or skipped, exclude the subject from position words and let Monday's real page target that item: "You weren't sure about counting to 10. Monday's page will show us." Build the week from raw answers, never `blendTypicalWithAnswers` or `buildAgeTemplatePlan`. [assessment]

**Persistence.** Per item to `child_answers` via `/api/map/answer` (v2.1), never into the 20,000-char `answers` jsonb; resume lands on the exact subject intro. [architecture, edge-cases, data-strategy]

**Precedence written into the plan schema.** Theme from "loving" (interests, rotated); subject from "start with" (`MAP_SUBJECTS` id); level from the ladder target; format from age band plus response mode. Four labelled slots; the build may not move a value between them. [materials owner]

### Phase 5: Building

**Cut the IEP modal.** Never ship "To move forward, specify". Any support-needs ask lives post-report as optional what-helps chips ("Big text", "Fewer items per page", "Extra movement breaks") stored as `context.accommodations` on the child and read by materials-studio, never by the scorer or narrative, and only once D6's sensitive-flag storage exists if a diagnosis is ever collected. [10 lenses]

**The one interrupt: school days.** "Which days are school days?" Mon through Fri chips, all preselected, single tap proceeds, captioned with the real dependency ("So I can put the week on your calendar"). Store `context.schoolDays` (int[]). Show the interrupt only while the job is still running; otherwise it is the last bubble before Building. [data-strategy, mom-veteran, competitive, retention-day2, mom-new; chair #5]

**Bars bound to real stages.** Bar 1: scoring plus narrative, captions from real steps ("Reading everything you told me about Maya", "Checking age-4 milestones from CDC and Head Start", sources derived from subjects answered; "Looking up Texas's homeschool rules"). Bar 2: instant check, "Placing five lessons on your week". Bar 3: the making job's `progressNote` stream ("Drafting Monday around dinosaurs", "Drawing Monday's page"), no percentage. "Reading The Good and the Beautiful's scope" only when an atlas match exists and the builder reads it; else omit. "Drafting", not "picking". Bars animate `scaleX` from a left origin, 300ms SETTLE per step, `cancelAnimation` while a modal is up, instant under Reduce Motion. Payoff renders as soon as bar 1 completes; bar 3 finishes behind Monday's card. [architecture, native-ux, voice-brand, assessment, data-strategy, materials owner, design steward]

**Multi-kid line, true.** A bubble, not a caption: "Ben and Lucy are next, after Maya." [mom-veteran]

**Failure map.** Making failed, cancelled, or `agentJobsEnabled()` false: the report and week still render, Monday marked "still drawing, saved here when it lands". Score failure: retry re-POSTs `/api/map/score` (idempotent). Network drop mid-ladder: queue the item POST locally, reconcile against `/api/map/state`. Backgrounding: safe, polling resumes. `usePreventRemove` while the job is in flight. [architecture, native-ux]

**Character.** Docked, `thinking` state (BOB.thinking is tuned for 60 to 90 second silences); no crayon at 48pt. [native-ux, design steward]

**Item-id contract and age in months.** Extend `materialPlanSchema` with server-derived `subjectId`, `targetItemId`, `targetStatement`, `startingLine`, `ageMonths`, `determinantAnswers`, `lessonMinutes`, `responseMode`, `printer`; `buildStageBrief` renders the evidence line ("Checklist: counts to 10 (getting there)") and the "4y 8m" label and drops the "sensible level for their age" fallback when a target is present. Never append to `plan.request` (600-char cap vs the route's 900 slice, a mismatch worth closing). Replace `ageFromBirthDate` with `ageInMonths` from `@homa/core`. [materials owner, assessment]

**QC that can catch a level miss.** Put `targetStatement` and `startingLine` verbatim into `create_printable`'s `requestSummary`; add one closed reviewer question for onboarding first pages: "Does every exercise rehearse the target statement, at or above the starting line?" Run the eval:sandbox first-making eval with three Walker fixtures (counts-to-5 not yet, counts-to-10 getting there, counts-past-20 easily) and ratchet item-range fit, not the QC pass rate. [materials owner]

**Server work for v2.1.** `POST /api/mobile/onboarding/anonymous-start` (verify bearer, require `is_anonymous`, `startAnonymousFamily({source:'mobile'})`, insert `family_members` with no email); change the `/api/map/score` guard from "email required" to "email required unless the verified caller is an anonymous member of a source=mobile family with an active onboarding record"; require consent on anonymous-start, making, and score; `pnpm check:isolation` first. Cap spend server-side: one report and one first-making per anonymous family until an identity is linked; child ceiling of 8+ as an abuse tripwire; per-install nonce on anonymous sign-ins; App Attest or Turnstile as a follow-up issue. Gate Building on a minimum answered-subject count so `buildMonthPlan` cannot return null after the bars fill. [architecture, edge-cases, legal-privacy]

**v2.0.** Three bars as choreography from a scripted job-status fixture, dev-only "simulated" banner, real wait length; binding to stages is the promotion gate. [native-ux, design steward, growth]

### Phase 6: Payoff and funnel

**Order.** (1) Monday's page, big, "Made for Maya. Nobody else." with the interest in the sub-line, "Print it" primary via `runPrintHandoff` with the answer-key toggle, tap to zoom. (2) The report as the why, opened by three bubbles: "Here's what you told me Maya does easily." (the Easily items verbatim; the downward rung guarantees the list); "Where I'd begin: counting to ten out loud. That's Monday." with the source in one line; "Here's what I see. Maya's edge right now is counting past 10 and rhyming. Monday starts there." (edge names from scored subjects, two at most, no adjectives). Full report behind "See the whole report". (3) The week: "Here's Maya's week. Move anything. It's yours." [chair #4, growth, retention-day2, mom-new, voice-brand]

**Mobile report.** Basis line first, not collapsed: "From what you told me about Maya, checked against the ages CDC, Head Start and Common Core publish. Not a test, not a percentile, and it sharpens as you tell me more." Under the age line: "This is your own answers, organized against what national sources teach at each age. It is not a developmental screening or a medical opinion. Questions about development belong with Maya's pediatrician." Subtitle "Where we start". Per row: position word always; the months number only in the full report, only when `highConfidence`; growing rows show "Next up: {frontierStatement}" and no number; beyondScale rows say "the checklist stops here, not Maya."; typical window rendered as a band, never a single dot; per-subject "Sources I used". Drop the header metric row; drop `noteGreeting` and the sign-off on this surface (the bubble delivers the note). Ban "ahead", "advanced", "gifted", "on level", "assessment", "evaluation", "screening" from the payoff string table. Native renderer: one static `react-native-svg` chart, `subject-card.tsx` below, tabular numerals, selectable text. Report fully open on mobile v2 (a later ruling scoped to mobile). [assessment, legal-privacy, mom-new, voice-brand, native-ux; chair #2]

**Week screen.** A vertical five-row list from `learning-activity-row.tsx` and `day-agenda.tsx`, columns from her school days, first row = the next school day ("Tomorrow for Maya: counting to 10. Print it tonight."), Monday only when onboarding lands Friday through Sunday ("Your week starts Monday"). Each row: a status the UI cannot bypass (ready: thumbnail; queued: "Drawing tonight", only after the server confirms the job row; planned: subject and rung, no time promise); three facts (about 20 min; crayons and the printed page; "Homa walks you through it" opening a two-minute parent script); "Because you said: {determinant statement}"; provenance "from what you told me". Three verbs live at render: print the first real day, read any later day, move a day (with `schedulePlanActivityPinned` semantics and reflow). Per-day day-off toggle; a small Homa mark on Homa's rows; her curricula as `family_events` blocks labelled by name (kid-tone, recurrence), with Homa never placing a lesson in a subject a named curriculum covers; mastery curricula read "Math-U-See, wherever you are". Siblings as kid-tone rows carrying names, curriculum blocks, and a chip "Ben's five minutes" plus their provisional week labelled "a typical week for their age until you answer their questions" (read-only, no check-off). No metric, badge, or months number anywhere two children are visible; reports open one child at a time. Unschoolers get the same rows in invitation vocabulary. Check-off visible on the first row. One caption keyed to hardest-now: schedule "Each day is set. Move any of them; the week reflows."; on track "Every lesson here is the next rung from Maya's report."; materials "Monday's page is made. The rest land here."; hours "I'll keep the hours you teach in one place." (upgrade to "Check a day off and the hours log themselves." only once the tap check-off writes `hours_log`, see section 9); starting "One page a day. That's the whole plan for week one." Vocabulary fixed once: page, lesson, week, progress report; never "worksheet" and "page" for the same object on adjacent screens; never "Binder" in walk copy. [retention-day2, mom-veteran, mom-new, assessment, competitive, edge-cases, voice-brand, data-strategy]

**Acceptance chips under Monday's card**, before notifications and account: Looks right / Too easy / Too hard. Looks right marks the material final (family-scoped mobile route). Too easy writes `child_answers[targetItemId] = easily`, rescores via `createReport`, retargets via `selectSubjectLessonTarget`, enqueues one redraw under `first-making-redraw:{childId}:1`. Too hard downgrades the determinant from easily to getting_there (its floor drops six months and it becomes the target); when the determinant is already getting_there the derivation refuses to go lower and the redraw changes scaffolding and format instead. Copy: "Got it. I'll redraw Monday a notch up. It lands here when it's done." One redraw in the walk; further correction is chat's job. [materials owner]

**Notifications soft-ask**, directly after the week, before account (see the ruling in section 7 #9). Fold in "What time does school start at your house?" (7 / 8 / 9 / after lunch). Render a mock push with the real body: "Tomorrow for Maya: counting to 10. Open Homa." Button "Tell me when it's time", visible "Not now". On grant: one permission request for both this and the trial-end reminder; first DATE trigger at her start time on the next school day; later bodies name the plan row only, never "ready", never "each morning". Add a notification response listener routing to the planner day view; cancel a day's pending notification on check-off and all on sign-out. [retention-day2, growth, competitive, legal-privacy]

**Account.** Bubble: "Save Maya's report and week so they're here tomorrow, on any phone." Sub-line: "Apple, Google, or a code to your email. No password." Then: "Then I'll show you the plans." Doors LINK: `linkIdentity({provider:'apple'|'google', token})` for native id tokens (Google via the PKCE deep-link exchange), `updateUser({email})` then `verifyOtp` type `email_change` for the code. Not skippable before the paywall (the purchase must land on a claimable identity; `apple/confirm`'s transaction-already-claimed guard). Collision state, not a toast: "You already have a Homa family. Bring Maya's new report and week into it, or open what you had?" (mechanism per section 7 #1). Then `POST /api/mobile/onboarding/claim` runs the account moment (`attachAuthUser`: `families.email`, status claimed, +homatest sandbox flag, `seedWhatWorksMemories`) and sends the report email `sendReportEmailOnce` skipped. "How'd you find me?" lives here. Founder actions, by exact name: Allow anonymous sign-ins; Allow manual linking; the Change Email Address template rendering `{{ .Token }}`. [architecture, growth, competitive, legal-privacy, edge-cases, voice-brand]

**Paywall, two screens.** A (narrative, big posture allowed, parked `heart` act): Monday's page as hero, "I'd love to keep making Maya's pages. {trialDays} days free." (interpolated from the selected product; no number when `introFreeTrialDays` is null), "Built from what you told me about Maya", identity line "Made by two homeschooling mothers", CTA "See the plans" (navigational, never StoreKit). B: the shipped S10 unchanged (StoreKit prices, annual default with full price and per-month caption, price sentence "{trial} days free, then {displayPrice} a {period}. Cancel anytime in the App Store." directly above "Try it for $0.00", "Nothing due today.", charge-date beat, Restore, Terms, Privacy, "No thanks"). Keiki's reminder screen becomes conditional: the bell screen ("I'll remind you 2 days before your 14-day trial ends", derived from `trialDays`, fix `TRIAL_REMINDER_BODY`'s "free week") when permission is granted, the charge-date screen when not. "Best value", never "Most popular". No review request. Mobile test: no purchase-shaped label on a screen without the price sentence. [growth, legal-privacy, voice-brand, competitive]

**Decline.** Lands on the week screen with Monday's page and the reminder set: "Monday's page and Maya's report are yours to keep." Add "Tuesday's on me if you come back tomorrow" only once the free-page credit (gh#1048) exists. Decliners are not walled from chat in week one (gate the keystone on `paywallShownAt`, section 6). [growth, mom-new, eve context engineer]

**Handoff to the shell.** Field resolves to canvas before the paywall (account and pricing sit on canvas and paper). Her last act is an `objectContinuity` move under 320ms (transform and opacity, Reduce Motion straight to the still) from the docked position into the `AppTopBar` Logo mark (same `logoGeometry`) or a new passive presence, never the VoiceDock. The first chat frame carries a scripted Homa message continuing the bubble voice and naming the week (section 6). After purchase `dismissTo` the app root; `Stack.Protected` keyed on `is_anonymous === false`. [design steward, native-ux]

**Tue-Fri mechanics.** Enqueue at account link plus trial start, serially, under `week-page:{childId}:{isoWeek}:{weekday}`, each from `selectSubjectPlanTargets` so the week teaches five frontier rungs; change the active-job guard to a per-child queue cap of 5 during onboarding; add nullable `material_id` on `plan_activity_schedule` (or key materials on child, subject, week, activity index following `subject_lesson_id`); `schedulePlanWeekPinned` writes the five rows in one transaction with an idempotency key on (child, anchor week, day). A fleet template library keyed on `target_item_id` (week-fills §9) is the decliner's floor, never the free tier's ceiling. [materials owner, architecture, retention-day2, edge-cases; chair #2]

---

## 5. Blind spots

Things the design had not considered at all.

**Server and identity**
- The only mobile family-creation path returns 400 `no-email` for an anonymous user; `/api/map/score` returns 409 `not-claimed`; nothing creates a `family_members` row without an email. v2.1 needs an anonymous-start route and a guard change. [architecture, edge-cases]
- A mom with a web account cannot link; `attachAuthUser` never folds (a dormant `allowExistingFamilyFold` branch has zero callers). Her sitting is orphaned. [architecture, edge-cases, legal-privacy, growth, competitive]
- App routing has two auth states and needs three: an anonymous session walks into the shell, `BillingGate` renders, and `FamilyReadinessGate`'s "Switch account" calls `signOut`, the permanent loss of the only credential. Expose `anonymous` from `SessionProvider`; redirect anonymous sessions to the v2 resume route; hide every sign-out path while anonymous. [architecture]
- Consent recorded after processing (and in the live v1 walk). [architecture, legal-privacy]
- Anonymous sign-ins are an unmetered model-spend surface: no captcha, client-side child inserts, an in-memory per-instance rate limiter. [architecture, legal-privacy]
- Orphan cleanup is a deletion pipeline, not a purge query: `purgeEmptyAnonymousLeads` is hard-coded to return 0; the account-deletion job with tombstones is the right worker; family first, auth user last; the console will count walkers as new families unless filtered. TTL 30 days, never under 8 days, never a family with a reminder scheduled. An in-walk "Start over and erase what I told you" control. [architecture, legal-privacy, retention-day2]
- Walk state: `STEP_ROUTES[step]` has no fallback (unknown step = `Redirect href={undefined}`); the step CHECK constraint needs an additive widening before the code deploy; the 20,000-char answers bag cannot hold the ladder; the anonymous identity lives only in AsyncStorage. [architecture, edge-cases]
- Linking needs three dashboard settings, not one, and no mobile route runs the account moment after a link today. [architecture]

**The day after**
- Homa knows nothing of the walk on her first chat turn; no context block renders the report, week, page, or queued builds. [eve context engineer]
- The in-flow report completes onboarding by keystone; with the paywall flag on, a decliner opens chat, `familyId` is dropped, and Homa says setup continues at thankshoma.com from inside the iOS app. [eve context engineer]
- `next.tsx` still drafts "Let's plan our week." into the composer, asking Homa to build a second week; `open_planner` marks a rowless week provisional and refuses to schedule it. [eve context engineer]
- No join between a plan activity and a material; the binder has no "new" badge; the only "page is ready" banner is inside the walk. [retention-day2, architecture]
- The `first-making:{childId}` key blocks any Tue-Fri page or redraw. [materials owner]
- An anonymous abandoner is unreachable by any rail except a pre-scheduled local reminder; every drip is email-shaped. [retention-day2]
- No D2 or week-used definition, no reminder telemetry, no per-screen beacons, no kill test. [growth, retention-day2]
- Friday never re-asks the week's targets, so the report cannot move from onboarding data. [assessment]

**People the design forgot**
- A dad, grandparent, or helper is called mom for the whole walk. [edge-cases]
- A child under 2 or 17 and up reaches Building with nothing to build. [assessment, edge-cases]
- Four kids or twins: one week, three kids with nothing, an ambiguous chooser, no name uniqueness. [edge-cases, mom-veteran]
- An unschooler answers "my own" and is handed five worksheets. [edge-cases]
- A family outside the US has no state option. [edge-cases]
- A veteran whose calendar arrives pre-filled with five Homa lessons on top of the system she runs, or on her co-op Friday. [mom-veteran]
- A mother of three who is interrupted and killed mid-ladder, more than once. [mom-veteran, edge-cases]
- A Spanish-speaking family (no localization plumbing) and a VoiceOver user (no announcements, no focus management). [eve context engineer]
- Android (no Apple door, `POST_NOTIFICATIONS`, inexact alarms); v2 should say iOS-only. [edge-cases]

**Data that goes nowhere or comes from nowhere**
- Values, curriculums, and styles never reach materials-studio or the per-turn prompt; strictness has one reader. [data-strategy, eve context engineer]
- School days, lesson length, start time, and start date are needed to place the week and are asked nowhere; `families.school_year_start_on` exists and is starving. [data-strategy, competitive, mom-veteran, retention-day2]
- Monday's page never reads the ladder; whole-year age in the brief; QC is brief-relative so a level miss passes. [materials owner]
- Three level sources (chips, free text, ladder) with no precedence; `focus` and `helpWith` are split keys; only `interests[0]` is used. [materials owner, data-strategy]
- Most subjects are scored on one parent-report item and render low-confidence; the mobile payoff would still attach a position word to each. [assessment]
- Hardest-now and homeschooling status have no storage and no consumer, repeating the dead intent enum. [data-strategy]
- Faith and values are "Sensitive Info" for the App Privacy label; `PrivacyInfo.xcprivacy` declares nothing today. [legal-privacy]

**Design system and native**
- The brand manifest classifies any `labs/` file as native-product; two unaware guards. [design steward]
- A mascot-led walk breaks four typed contract assertions; the 08-21 rulings live only in code comments. [design steward, native-ux]
- Graduation is a route move plus a contract flip plus a step-enum migration, and `signin.tsx` changes role. [design steward]
- The landing after the paywall: a talking guide becomes a 24px static mark in one `router.replace`. [design steward]
- Shrink-and-dock has no spec and fights the existing size plumbing; keyboard behavior, back and one-way doors, Dynamic Type, and the absence of any native chart renderer are unaddressed. [native-ux]
- The saturated field, dark mode, and increased contrast are unspecified; `#F2703A` and `#F7BE6E` already live unlisted in production files. [design steward]

---

## 6. The day-after loop

The founder's stated failure was a dead-end report. Everything below is what happens after the payoff, and each item is buildable without server push.

**Arrival surface (the app itself, not a notification).**
- Add the join: nullable `plan_activity_schedule.material_id` written when a job finalizes, so each day row renders one of three honest states: made (opens the printable via `material-print-flow.ts`), making ("still drawing, saved here when it lands"), plan only. [retention-day2, architecture]
- Persist the Tue-Fri job ids in `mobile_onboarding_state` and reconcile on every cold open with the existing `getMakingStatus` poll. [retention-day2]
- The week is real stored rows: a deterministic server writer (`lib/plan-first-week.ts` or beside `schedulePlanActivityPinned`) composing `schedulePlanActivityPinned` and `applyPlanEdits`, five `plan_activity_schedule` dates, Monday's material linked, one transaction, idempotent on (child, anchor week, day). Retire `planIntent=week`; the week screen's chip opens chat with the planner skill's existing prepared message "One part of Maya's first week does not fit". [eve context engineer, architecture]
- Tapping a row mid-walk renders the day view in place with the same planner component; after account it navigates into the Planner tab, so "already on the calendar" is true and navigable. [native-ux]

**Homa's memory of the walk.**
- A bounded "## Her first week" block in `family-context.ts`, fail-soft like `recentCallsContext`, rendered for ~7 days after `mobile_onboarding_state.completed_at` (server-read), on every channel: `reportScoredAt` per child; this week's rows (title, subject, date, `materialId` or building); active builds from `getJobStatus` (title, stage, never an ETA); provenance (age, answers, atlas match or none). Register it in `CONTEXT_BUDGETS`. [eve context engineer]
- Walk answers that are not columns become `family_memories` rows (kind fact, source `onboarding`) written deterministically at walk end: "Hardest right now: keeping a schedule", "Homeschooling since 2024, follows The Good and the Beautiful loosely". Add the bounded `homeschool` object to `renderFamilyContext`. [eve context engineer, data-strategy]
- A scripted first chat message, a constant rendered from rows, no model turn: "Monday's page is in your binder, printed or not. Tuesday through Friday are building; ask me anything about the week." Written as the continuation of the bubble voice. [eve context engineer, design steward]
- A second dynamic module `instructions/ios-first-week.ts`, resolved on `turn.started` for channel mobile within 7 days of `completed_at`, with its own budget: where the week lives (Planner), where Monday's page is, that the rest are building, where membership shows (Settings). Do not raise the 700-byte `ios-mode` ratchet. Definition of done for every v2 screen PR: this module updated in the same PR. [eve context engineer]
- Routing fixtures: "where is Tuesday's page?" (mobile, first morning); "plan our week" (Homa opens the existing week, never drafts a month); mobile, onboarding-done, walled, first message. [eve context engineer]

**Decliners are not walled in week one.** Either gate the keystone so `resolveOnboardingCompletion` runs only after `paywallShownAt` is set, or make the account-gate text in `eve.ts` channel-aware (Settings, never a URL) and family-loaded. Confirm `HOMA_CHAT_ONBOARDING` is on in prod, since `familyOnboardingActive` returns false without it. [eve context engineer]

**The reminder ladder (local DATE triggers scheduled at week-screen time; iOS allows 64 pending).**
- Day 0 (the walk): Monday's page printed, week placed, reminder armed at her chosen start time.
- Day 1 (first school morning): "Maya's page today: counting to 10 with horses. Tap to print." Tap lands on the planner day view; print or answer key; check off.
- Day 2 morning: names Tuesday's plan row; the app reconciles the overnight job and shows the page or its honest making state.
- Day 3 (more than one kid): "Ben's turn? Five minutes and his week goes next to Maya's." deep-linking into the second questionnaire. This is where phase 4's deferred siblings live.
- Day 5 (Friday afternoon): "Tell me how the week went", two or three chips re-asking exactly the week's target items with the same four answers, stored as answers so `scoreMap` reruns and the affected rows move ("Counting to 10: getting there on Monday, easily on Friday"). Then a receipt, never a verdict: what was checked off and hours logged, plus "Next week is already on the calendar", true because the plan is four weeks.
- Day 7 (Sunday evening): "Monday's page is {lesson}" for week 2.
- Cancel each pending notification when its action happens; cancel all on sign-out. [retention-day2, assessment]

**Hours.** "Check a day off and the hours log themselves" is not yet true for the UI check-off as built (the server function exists; the RPC does not call it). Either extend the tap check-off to write an `hours_log` row with the lesson's planned duration and subject before v2.1, then show the line for reporting states, or keep the line off the screen. [mom-veteran, retention-day2]

**Tue-Fri and the fleet floor.** Per-family pages are the trial's object, enqueued at account link plus trial start, four jobs serially, each day card moving planned to queued to ready; a paused job shows "Homa hit a snag, tap to retry", never an empty day. A fleet template library (about 40 lessons keyed on `target_item_id`, `subject_lessons` as the per-child overlay) is the decliner's floor: "a Homa lesson for this skill, made yours as I learn Maya." [materials owner, retention-day2; chair #2]

**Second kid.** Siblings already have a free provisional week (`withAgeTemplates`); render it read-only beside the mapped child's, and make "Ben's questions, about five minutes" the second item on the post-payoff next list. [data-strategy, mom-veteran]

**Server rails after the account.** Drip emails for mobile-born families must deep link into the app (universal link to the planner day), not to `/onboarding/r/[token]`; audit `drip_report_unviewed`'s emailed-and-unopened signal, which assumes a web email mobile never sends. Send the report email at link. Route post-account, pre-paywall abandons into the existing drip; accept the pre-account win-back loss explicitly. [retention-day2, growth, architecture]

**Measurement.** Events `mobile_onboarding.reminder_scheduled`, `mobile_onboarding.reminder_opened`, `planner.activity_checked`, added to `events.ts` and the mobile event relay (`pnpm check:events`). D2 return = app open within 48h of `mobile_onboarding.completed`; week-used = at least one check-off within 7 days. Both on the founder console's family row. v2.1 beacons via the existing `reportOnboardingStep` and `saveOnboardingStep` from Hello onward. Kill test written before real traffic: thresholds for start to ladder-complete, ladder to payoff, payoff to account, account to trial; decision date four weeks after real traffic. [retention-day2, growth]

---

## 7. Founder decisions

The chair's tensions memo, lightly edited for consistency. Ranked by how much the decision changes the build.

### 1. Account-last's three unresolved branches: the returning mom, the fold boundary, and when the anonymous user is minted

**Side A (edge-cases, growth):** catch `identity_already_exists` / `email_exists` at the account step and offer "Bring Maya's new report and week into it, or open what you had?", with "bring it in" calling `attachAuthUser` under `allowExistingFamilyFold` so the dormant `foldFamilyInto` merges the anonymous sitting. Architecture's option (b) is the narrow version: permit a fold only when the source family's sole member is an `is_anonymous` user from this device, JWT-verified, no billing rows, recorded as a new ruling.

**Side B (architecture option a, legal-privacy):** never fold. Rebuild deterministically inside her existing family (copy child plus `child_answers`, `createReport`, `getOrBuildPlan`, five pinned schedules, copy the one material) behind a server-verified handoff token, or sign her into the old account and delete the anonymous family. The no-fold rule at `store.ts:227-235` exists because of duplicate trials and is not an engineer's to reopen.

**Two coupled sub-decisions.** Legal-privacy, edge-cases and competitive want a quiet "I already have an account" link on Hello; the founder said Hello has no chrome. Architecture and edge-cases want the anonymous user minted lazily at the first server write (first child added) to bound orphans and model spend; legal-privacy wants AI consent recorded on Hello's Continue, which needs a `family_members` row and therefore an eager mint; Section 2 mints at walk start.

**What is traded:** a standing security boundary and a small diff vs. the single highest-intent parent in the funnel (a web questionnaire completer) losing fifteen minutes of work seconds after the aha; orphan count and abuse surface vs. consent-before-processing and a resumable identity.

**Recommendation:** (1) Put the returning-account link on Hello as one caption-weight text line; it is the cheapest prevention and the only one that avoids collecting a second child profile (5.1.1(iii)). (2) For those who still reach the account step with an existing account, choose rebuild over fold. It needs no ruling change, nothing crosses the trust boundary except her own answers re-submitted under her own JWT, and a Building replay of a few seconds is honest. The rebuild must carry its own proof of ownership: a short-lived single-use handoff token minted server-side by the anonymous user before the session swap, or both bearers presented and verified with `supabase.auth.getUser`; the anonymous `familyId` is never accepted bare from the client. If the founder prefers the smaller fold diff, it must be option (b) as a recorded ruling and must never grant a fresh trial. (3) Mint lazily at the first child add and make that tap the affirmative AI-consent moment in Homa's voice; Hello's third bubble stays a promise, not a consent control. Eager minting turns every ad tap into an auth user and a family with children's data and no owner.

**Evidence that settles it:** the two-hour Supabase spike (anonymous, then `linkIdentity` with a native Apple id token, Google PKCE, and `updateUser` plus `verifyOtp` type `email_change`, for fresh and already-registered addresses, with Allow manual linking on) tells you whether the collision branch is rare or the default; a count of how many TestFlight and web emails would collide; v2.0 dwell traces showing what fraction of Hello taps reach the first child add, which sizes eager vs. lazy minting.

### 2. What the trial buys and what a decliner keeps

**Side A (growth, competitive):** Tue-Fri are the paywall's concrete object: "Start the free trial and Tuesday to Friday land tonight." The decliner keeps the report, the week plan and Monday's page. Assessment adds that the report must be fully open pre-paywall because the week's lessons point at report rows.

**Side B (retention-day2):** Tue-Fri should be "here now" from a fleet template-lesson library (week-fills §9, roughly 40 lessons, about $18 once), which dissolves most of the day-2 arrival problem and makes the promise true. That removes Tue-Fri as a paywall object.

**Side C (standing rulings and code):** the 2026-07-18 report lock opens four fixed subjects on web, and the wall has been on in prod since 07-18. The eve context engineer found that the walk's in-flow report completes onboarding by keystone, so with `HOMA_SIGNUP_PAYWALL_ENABLED` a decliner opens chat the next morning, `familyId` is dropped, and Homa tells her from inside the iOS app that setup continues at thankshoma.com. mom-new and growth both require the decline path to land on the week screen so the paywall never becomes the new dead end. The materials owner adds that today's `first-making:{childId}` key blocks any Tue-Fri or redraw job at all.

**What is traded:** a legible, honest paywall object and compute discipline vs. a week that is real for everyone on day one; web and mobile parity on what is free vs. a plan whose evidence rows are readable; and whether a decliner is a family with a week or a walled lead.

**Recommendation:** Rule the trial's object as "Homa keeps making pages for Maya" and set the mechanics: (a) the report is fully open on mobile v2, recorded as a later ruling scoped to mobile, because the report-to-week contract needs readable rows and the web lock was chosen for a report-terminal funnel that no longer exists here; (b) per-family Tue-Fri pages are the trial's object, enqueued at account link plus trial start under `week-page:{child}:{isoWeek}:{weekday}`, with day cards reading planned until a job row exists, then queued, then ready; (c) the fleet library, if built, is the decliner's floor ("a Homa lesson for this skill"), never the free tier's ceiling, so the decline path is alive and "Tuesday's on me" has a backing; (d) decliners are not walled from chat in their first week: gate the keystone on `paywallShownAt` or make the account-gate text channel-aware and family-loaded. "Yours to keep" plus a wall is the web dead end with a bill attached.

**Evidence that settles it:** cost of four per-family pages per trial start (about $0.45 each) vs. the one-time library; the pre-committed kill-test thresholds for payoff to account to trial on the first real cohort; a query of whether web families with a locked report converted at a different rate than those without one (does hiding twelve rows sell anything); confirmation of `HOMA_SIGNUP_PAYWALL_ENABLED` and `HOMA_CHAT_ONBOARDING` state in prod.

### 3. When Monday's page starts and what it is allowed to read

**Side A (competitive, growth, today's `making.tsx`):** kick `startFirstMaking` right after the loves and working-on tags and run the 16-subject ladder over the ~85 second draw. Building collapses to seconds and the page is ready when the ladder ends. Cost: the page is built from age plus one chip, the age-only brief the 07-28 delivery study named as root cause of the B3 bucket (28% first-delivery approval).

**Side B (materials owner, assessment):** Monday's page must be a deterministic item-id contract from the ladder (`selectSubjectLessonTarget` writing `targetItemId`, `startingLine`, `ageMonths` into `materialPlanSchema`). The materials owner wants the start-with subject's rungs run first and the job kicked at that subject boundary; assessment wants sweep (16 bases) then climb, with two deep-dive items on the two or three subjects that carry worksheets so they reach `highConfidence` before the page is drawn. The design as drafted does neither: whole ladder, then an uncovered 85 second Building (growth's 15 to 25% loss window).

**What is traded:** covering the one real dead-time asset Homa has vs. the level fit that decides whether the page is usable at all; and the ladder's order, since sweep-first delays the kick until the remaining ladder may no longer cover the wait.

**Recommendation:** Side B's contract with Side A's discipline. Reorder the ladder so the start-with subject (a chip pick over `MAP_SUBJECTS`, or a model-proposed id verified against the enum, never a keyword table) runs first including its rungs and two deep-dive items; kick the job at that boundary with the target contract; run the remaining fifteen subjects under the build. That fires roughly 60 to 90 seconds in and leaves several minutes of cover. Reject kick-before-ladder outright: it hard-codes the failure the delivery study measured. Reject sweep-then-kick: it optimizes cover for the strong kid whose climb is long, the wrong child to design around. The 07-29 `onboarding-lesson-per-subject` ruling already blessed the subject-boundary mechanism.

**Evidence that settles it:** the eval:sandbox first-making eval with three Walker fixtures at different frontiers (counts-to-5 not yet, counts-to-10 getting there, counts-past-20 easily), scoring item-range fit against the target; lab timing of subject one vs. subjects two to sixteen under anxious-mom and strong-kid answer patterns against the 72 to 211 second build bench.

### 4. Payoff order: the report as the aha or the page in her hand

**Founder:** the progress report is the aha, then "Here's her week."

**Growth, retention-day2:** Monday's page first ("Made for Maya"), the report second as the why, the week last. H2 is the only supported product lever from real data (returners 31% vs. 9% had a worksheet before or with the report), and report-then-nothing survived a full form-to-chat rebuild.

**mom-new:** for the anxious mom an all-growing report reads as sixteen euphemisms; the payoff should be three bubbles (the Easily receipts, one place to start, the week) with the full report behind a tap. native-ux adds that mobile has no chart renderer at all, so porting the web report is net-new work.

**mom-new (hardest), data-strategy, assessment:** let "What's hardest right now?" set the order per family (on-track leads with the report, materials or schedule leads with the page or week).

**What is traded:** the founder's conviction that the report is the moment worth the walk vs. measured evidence that the artifact is what brings her back; a fixed, testable sequence vs. per-family routing that doubles the payoff variants before there is a single measured completion; and the v2.0 rendering scope (a page hero plus a report behind a tap is far less to build than a native report with charts as the first screen).

**Recommendation:** Page first for everyone, report second framed as the why ("Here's how I picked it"), week last, with the Easily receipts as the report's opening bubble and the typical-range band carried over so no reading is a single dot. Do not route the order by hardest-now in v2.0: it has no stored consumer yet and no completions to measure against. Keep the hardest-now answer as the one caption under the week so the answer visibly mattered without forking the sequence. The report remains the aha in substance because it explains the page; it stops being the terminus.

**Evidence that settles it:** the retention re-run planned around 2026-10-01 with D2 and week-used defined on `mobile_onboarding.completed`; a blind five-reviewer lab comparison (the 09-01 method) of report-first vs. page-first with identical content; per-screen dwell on the two candidate first screens.

### 5. What fills the week: the report, her curriculum, or her kid's interests

**Side A (assessment, materials owner):** the week is a pure function of (ageMonths, answers, interests, startWith): `buildMonthPlan` focus subjects plus sprinkle plus the start-with subject, each day keyed to a `targetItemId`, with a unit test that every day's target is a `next_up` rung and no day is built from blended or typical answers.

**Side B (mom-veteran):** Homa's lessons fill only the empty slots and the subjects her curricula do not cover; mastery curricula get "Math-U-See, wherever you are" with no invented lesson; her curricula render as her blocks; four-day weeks are common. The veteran also wants a "What does a school day already look like?" screen with draggable curriculum blocks before Building, which collides with growth's ask budget.

**Side C (data-strategy, architecture):** the builder today reads `interests[0]` and `style` only; `curriculums` is a dead slot in `PlanContext`; "Reading your curriculum's scope" is false until atlas profile ids are stored and wired; values and curriculums never reach materials-studio. edge-cases adds that unschoolers get five worksheets, the thing they left school to avoid.

**What is traded:** a deterministic, testable report-to-week contract (the whole actionability argument) vs. a week that respects the system a veteran already runs; and the honest scope of v2.1, since wiring curriculum into the builder is a builder change.

**Recommendation:** A two-layer week. Layer 1 (v2.1): keep the pure function untouched for what Homa places, but filter its subject set by a deterministic "covered by your curriculum" exclusion derived from the atlas profile's `subjects` when a tag resolved, and its dates by the school-days answer. Her curricula render as `family_events` blocks labelled by name; Homa never places a lesson in a subject her named curriculum covers; if the filter empties the focus set, the start-with subject and the sprinkle remain, and Monday's page targets the start-with subject regardless because she named it. Layer 2 (later): read the atlas scope into the builder itself. Ask school days as chips in the Building interrupt, not as a drag-to-days screen before Building. Unschoolers get the same rows in invitation vocabulary. This keeps the item-id contract intact, honors she-decides for what she already runs, and needs only the atlas profile id the recognition bubble already requires.

**Evidence that settles it:** for TestFlight and web families with `context.curriculums` set, the share of tags that resolve to an atlas profile with `subjects` (if low, the veteran case is copy, not code); the week-fills §9 finding that the age plan equals the answered plan for a typical child, which bounds how much the ladder changes the week at all.

### 6. Ladder depth vs. the walk's length, and how she is told how long it is

**Depth (mom-new, assessment, founder ruling at `bank.ts:209-216`):** the founder would "rather give way more questions if it gives way more accurate results." mom-new wants a downward rung so every subject ends on something the child does and the Easily receipts are never empty. Assessment wants sweep then climb plus deep-dive items, because most subjects are scored on one parent-report item today and render low-confidence. Note the internal collision: the downward rung contradicts the bank's own design law that downward drilling is "deliberately impossible" (`bank.ts:11-12`), even though `nextDeepDiveItem` already walks down post-report.

**Length (growth, mom-veteran, mom-new):** growth estimates 1 to 2% loss per ladder item on an unframed cold run and notes the 95% per-step web figure was a survivor cohort after account creation; the veteran's nine-year-old still gets self-care and gross-motor items and she wants a per-subject "not now"; a strong kid can be served 68 items; the anxious mom taps Not yet sixteen times.

**Scale cue, where two recorded rulings collide:** mom-new and growth want one continuous bar plus "about N min left" (the 07-06 web review replaced "subject 4 of 16" because sixteen reads long). voice-brand wants no duration promises at all (the 08-31 mobile ruling removed the time claim from S8) and would use the segmented subject bar instead. The veteran wants segments with names so she can see the end. Assessment notes the 18 second per-subject estimate is wrong for a strong kid anyway.

**What is traded:** report confidence and a never-empty receipts list vs. completion on cold traffic; and which honesty the progress cue carries (a count is true but reads long; a time is short but is a guess the build cannot keep).

**Recommendation:** Depth, staged. A guaranteed floor (16 base items plus the downward rung when a base gets Not yet) that always yields a complete report, then a clearly optional climb ("Want me to find where Maya's math run ends? Two or three more.") for subjects that earned it, with the two deep-dive items inside the walk only for the start-with subject that Monday's page needs. Kids seven and up get a per-subject "not now, ask me later" that renders as "not mapped yet." Amend the `bank.ts` comment to say downward drilling is off in the climb but one capped downward rung is on at the base. On the cue: segment by phase (you, family, Maya, building), never by subject; name the subject in Homa's bubble; show no minutes. Record that the 08-31 no-time-claim ruling governs mobile while the 07-06 minutes cue stays web.

**Evidence that settles it:** v2.0 dwell per ladder item under anxious and strong answer patterns; the kill test's start-to-ladder-complete threshold; `highConfidence` and mapped-subject counts on the eval fixture with and without the downward rung for a not-yet-heavy child.

### 7. "Collect as much as possible" vs. an ask budget before value

**Founder:** collect as much as possible during onboarding: mom, curriculum, kids, family setup, per-child questionnaires, notifications, anything useful. The design runs six mom bubbles and four family bubbles before the child exists.

**Growth:** at most seven asks before the FRAME, two typed fields (three for already-homeschooling). mom-new: the child by bubble three. data-strategy: strictness has one reader (the settings display), values and curriculums never reach the per-turn context or materials-studio, hardest-now and status have no consumer, so several asks are "collected, consumes nothing." legal-privacy: the values textarea is Sensitive Info for the App Privacy label. The veteran wants the curriculum ask kept and the recognition bubble placed before the ladder as the first proof of competence. The auditors relocated styles, how-closely, values and how'd-you-find-me post-payoff rather than deleting them.

**What is traded:** day-one data yield vs. completions; and the honesty of asking things no reader consumes, which is the anti-pattern the design says it is fixing.

**Recommendation:** Read "collect as much as possible" as "over the first week, not before the first artifact." Pre-value run: kid name plus birth month and year, your name, relationship (dad, grandparent), state with its state-fact give-back, already or starting, hardest-now only if its consumer ships in the same PR (week caption plus a `family_memories` row for the first chat turn), the curriculum tag only for already-homeschooling with the recognition bubble, lesson length before the kick, and school days as the Building interrupt. Styles, how closely, values, how'd you find me, and reminder timing land on the week screen or the first chat turn where each has a visible consumer. Rule: an ask ships in the walk only when a named row and a named reader exist in the same PR. The one measured fact (17% lost at address and phone) points the same way as growth's estimates, and data-strategy shows the moved fields have almost no reader today, so nothing is lost by moving them.

**Evidence that settles it:** the v2.1 per-screen beacons and the pre-committed kill test; before that, a count of web families whose `context.values`, `styles` or `strictness` were ever read by any product path, which is the true yield of those asks so far.

### 8. Full Keiki in a lab vs. a contract that must be extended before she can lead

**Founder:** a self-contained v2 token set inside `labs/` so the walk can go full Keiki without touching `packages/design/src/contract`; decide production later.

**Design-contract steward:** a mascot-led walk breaks four typed assertions (`homaShortEdgePercent {10,16}`, `realObjectVisualWeightPercent`, `homaMayLeadOnlyWhen`, `character-over-object`), the 08-02 quiet-authority ruling bars a superseded system on a default surface, and the fix is a contract extension (a `guidedConversation` block ending at the first real artifact) with a recorded ruling, not a lab exemption or a second profile. Lab tokens must mirror contract names so graduation is a `git mv`; the saturated field needs approved pairs and dark and increased-contrast values; a coral-filled CTA with white text fails contrast at 3.44:1. Graduation is a route move plus a contract flip and the brand manifest classifies any `labs/` file as native-product today.

**native-ux:** every question in a bubble overturns the 08-21 bubble-grammar ruling (reply gets a bubble, a prompt is the sheet's serif heading), and both 08-21 rulings live only as code comments; the auditor says record 09-07 as a later ruling scoped to the lab.

**What is traded:** speed to "feel it" and freedom to copy Keiki vs. a lab that can graduate without a redesign; and whether prompts-in-bubbles becomes Homa's grammar (three grammars in her first ten minutes: walk, chat, voice) or stays a bounded walk exception.

**Recommendation:** Both, in this order. Now: record the 09-07 direction as a later ruling (`walk-mascot-leads-before-first-artifact`, scoped to `labs/onboarding-v2`, superseding the 08-21 bubble grammar for that surface, noting promotion re-opens it); add the `labs/` classification rule to `scripts/brand-surfaces.mts` so the manifest stops asserting a Keiki screen is Quiet authority; build the lab with its own values in a token file shaped exactly like `colors.ts` and `typography.ts`. Defer the contract extension itself (block, version bump, DESIGN.md regen) to graduation and make it an explicit exit criterion of the feel-it phase. Do not defer the two cheap choices that prevent a rewrite: midnight as the enabled-CTA fill (never coral with white text) and EB Garamond and DM Sans roles (never Fredoka outside Logo). The founder's "decide later" is legitimate for the contract; the ruling and the manifest rule cost an hour and prevent the quiet failure the steward already found live in `walk-scene.tsx`.

**Evidence that settles it:** whether the lab's payoff screens, once felt, actually end the bubble grammar at the first artifact (if they want bubbles over the report too, the exception is not an exception and the contract question is larger); `pnpm check:brand-surfaces --check` after the first lab file; contrast measurements of the chosen field against ink for bubble text.

### 9. The notification soft-ask: where it sits, what it promises, and what it does to the paywall

**Ruling 2026-08-31 (`trial-reminder.ts` header):** never mid-walk; ask right after a purchase confirms. legal-privacy: drop it or move it after purchase; "each morning" is a promise nothing can fire.

**retention-day2:** directly after the week screen, before account, because an anonymous abandoner has no other rail (every server re-engagement path is email-shaped) and the walk's screens are the only place a return trigger can be armed; schedule the first local reminder at grant. growth (as corrected): after the week screen for cadence, and before S10 because the D13 gate renders the paywall's reminder line only when permission is already granted. competitive: treat 09-07 as superseding by default, bind the ask to a chosen time, and route it and the trial-end reminder through one permission request.

**Downstream collision (competitive, legal-privacy):** Keiki's paywall screen two (reminder reassurance) can only render if permission was granted earlier, so the paywall's shape depends on this placement.

**What is traded:** the one-shot iOS permission spent on a parent who may abandon vs. the only re-engagement rail the pre-account cohort will ever have; and whether the paywall's second beat exists at all.

**Recommendation:** Supersede the 08-31 ruling for v2 explicitly. Place the soft-ask directly after the week screen, before account, fold in "What time does school start at your house?", render it as a mock push whose body names the plan row ("Tomorrow for Maya: counting to 10. Open Homa."), never "ready" and never "each morning", schedule the first DATE-trigger reminder at grant, and route the trial-end reminder through the same permission. Paywall screen two becomes conditional: the bell screen if granted, the charge-date screen if not. H3 (reminders fired for 2 of 85 real families ever) is the retention inquiry's most damning number, and the anonymous cohort has literally no other channel; a permission decline is recoverable in Settings, an unreachable abandoner is not. Record the reversal in the build-log, the ruling index, and the `trial-reminder.ts` header.

**Evidence that settles it:** grant rate on the soft-ask in the first real cohort vs. v1's post-purchase grant rate (unmeasured today); `mobile_onboarding.reminder_scheduled` and `reminder_opened` events; whether D2 return correlates with a fired reminder.

### Below the line: smaller collisions, one line each

- **Birth month plus year vs. the 2026-07-11 full-birthday ruling** (assessment auditor): add a day picker on the same screen or record the supersession; either way store day 15 with `birthdayApproximate` when the day is absent.
- **Hello's third bubble is wanted by three lenses** (legal-privacy: a true privacy line and consent; mom-new: the no-verdict promise; voice-brand: "No wrong answers. 'Not sure' is one of them."): give the slot to the no-verdict promise phrased as what she gets, move "No wrong answers" to the ladder's first bubble where it primes the escape chip, and demote privacy to the name-field caption linking /privacy.
- **"Who should I start with?"**: the veteran's "pick the one you're wondering about most" invites the sibling comparison edge-cases warns against; use "Everyone gets a turn. Who's first?" with no default highlight.
- **Which Building interrupts**: every lens agrees the IEP modal goes and captions must be true, but candidates differ (days plus lesson length; printer plus answer key; response mode plus printer). Days is the one the week cannot be placed without and stays the interrupt; lesson length moves before the kick because the page now starts mid-ladder; printer belongs on the payoff's print action; response mode in the child profile as a tag.
- **What Monday's page is by age band** (materials owner): practice at the working edge for 4 and up, a picture-first activity plus a parent script under 4, recipe shortlist chosen deterministically by age band; the week calls each day by what it is ("Monday: counting mat"), never "worksheet" for a 3-year-old.

---

## 8. Revised design deltas

Edits to the brief, ready to apply.

### Section 1: the arc

**Phase 1, Hello.** Replace the three bubbles with: "Hi, I'm Homa." / "Tell me about your family. I'll plan the week and draw Monday's page." / "You'll see what your kid can do right now, and exactly where to start Monday." Add: bubbles advance on tap; one caption-weight text link "I already have a Homa account" below bubble three routing to `signin.tsx`; the field grows out of canvas (≤320ms); the shrink-and-dock is a once-set `posture` state with the spec in section 4; no wave (speaking pop pulse, gaze bias, one blink); privacy lives in the name-field caption as the policy's exact sentence. Record the 09-07 direction as a later ruling superseding the 08-21 bubble grammar, scoped to the lab.

**Phase 2, rename "Mom" to "You and your kids".** New order: "Who's learning at home?" (name or nickname, birth month and year via two native wheels, up to five; first add mints the anonymous user, records AI consent, renders `LegalLine`) → "And you? What should I call you?" → "And you're Maya's..." (Mom / Dad / Grandparent / Someone else) → state (pill plus searchable formSheet, "I'm outside the US") with the state-fact give-back → "Homeschooling already, or getting started?" → "What's hardest right now?" (revised chips, reactive bubble, stored enum with a shipped consumer). Remove "how long" (unstored, no consumer) and move "How'd you find me?" to the account step. State is load-bearing for the StateCard and hours rules only; delete "drives benchmark sources".

**Phase 3, rename to "Curriculum and the first child".** Curriculum branched: already-homeschooling gets the tag input with the recognition bubble, which-kid and level chips, and `context.curriculumProfileIds`; starting/exploring gets "Have you picked a curriculum yet?" with a "tell me more" expansion. Remove "How closely?", "Styles you follow?", and "Anything that matters to your family?" from the walk (they land on the week screen or the first chat turn). Then: "Who should I start with?" ("Everyone gets a turn. Who's first?", in-range kids only) → "What's Maya loving right now?" → "Where should I start with Maya?" (chip over `MAP_SUBJECTS` or the first-focus carousel) → "About how long can Maya sit for a lesson?" → FRAME bubble.

**Phase 4, the questionnaire.** Start-with subject first (base, rungs, two deep-dive items), Monday's job kicked at its boundary with the item-id contract and the beat "Monday's page starts from this."; remaining fifteen subjects run under the draw. Sixteen base items plus one capped downward rung on Not yet; optional climb; "not now, ask me later" per subject for kids seven and up; visible Skip for computer_science and spanish; flash "Skipped. Never counts against them." Vertical radio list, not four chips. One continuous bar segmented by phase, no minutes. No streak badge, neutral kicker, at most one citation receipt per phase. Subject intros from `content.ts` unchanged. Evidence floor of three mapped subjects before Building. Answers persist per item to `child_answers` (v2.1) and to AsyncStorage on every tap.

**Phase 5, Building.** Delete the IEP modal and "To move forward, specify". One interrupt: "Which days are school days?" (Mon-Fri preselected, one tap). Captions only from real stages: bar 1 scoring plus narrative ("Reading everything you told me about Maya", "Checking age-4 milestones from CDC and Head Start", "Looking up Texas's homeschool rules"), bar 2 instant ("Placing five lessons on your week"), bar 3 the job's `progressNote` stream ("Drafting Monday around dinosaurs", "Drawing Monday's page"); curriculum caption only when an atlas match is wired. Payoff unblocks when the report exists; a failed job shows Monday "still drawing". Docked, thinking state. v2.0 simulates the real wait from a scripted fixture with a dev-only banner.

**Phase 6, Payoff and the funnel.** Order: Monday's page ("Made for Maya. Nobody else.", "Print it") → report as the why (opening bubbles: the Easily receipts, "Where I'd begin", the working edge; basis line and not-a-screening line; "Where we start"; full report behind "See the whole report"; fully open on mobile) → week (next school day first, status enum, three facts and three verbs per row, "Because you said", her curriculum blocks, sibling rows with "Ben's five minutes", acceptance chips Looks right / Too easy / Too hard, hardest-now caption, "Here's Maya's week. Move anything. It's yours.") → notifications soft-ask with start time and a mock push naming the plan row → account ("Save Maya's report and week so they're here tomorrow, on any phone.", three doors that LINK, collision state, "How'd you find me?") → two-screen paywall (A narrative "See the plans"; B the shipped S10; reminder screen conditional) → decline lands on the week screen → handoff to the shell with an objectContinuity move and a scripted first chat message. Delete "ready by tomorrow morning" and "I'll remind you each morning" everywhere.

**Visual.** Replace "Homa orange as the single accent" with: coral for Homa presence, roof thread, and chip selection border; midnight for the enabled CTA fill and selected chip fill with paper text. Replace "big friendly type" with EB Garamond display for bubble questions and DM Sans for chips and captions; Fredoka in `Logo` only. The lab token file mirrors `colors.ts` and `typography.ts` names so graduation is a `git mv`; declare dark-adaptive and increased-contrast values or rule the walk light-only with a reason. Add the `labs/` classification rule to `scripts/brand-surfaces.mts` (targetProfile `native-lab`) before the first file.

### Section 2: how the account-last bet works

- **Minting.** Replace "when the walk starts the app calls `signInAnonymously()`" with: the anonymous user is minted lazily at the first child add, which is also the affirmative AI-processing consent tap; Hello and the You screens run on device until then.
- **Server contract (new v2.1 tasks).** `POST /api/mobile/onboarding/anonymous-start` (JWT `is_anonymous` required, `startAnonymousFamily({source:'mobile'})`, `family_members` row with no email); `/api/map/score` guard widened for anonymous members of source=mobile families with an active onboarding record; consent required server-side on anonymous-start, making, and score; `/api/onboarding/basics` also writes `family_members.display_name`; every route the walk touches tolerates `families.email` null; `pnpm check:isolation` before each.
- **Linking.** Replace "`linkIdentity` / `updateUser`" with: `linkIdentity({provider, token})` for native Apple and Google id tokens (Google through the PKCE deep-link exchange), `updateUser({email})` then `verifyOtp` type `email_change` for the code door; then `POST /api/mobile/onboarding/claim` runs `attachAuthUser` and sends the report email. Founder actions by exact name: Allow anonymous sign-ins; Allow manual linking; the Change Email Address template rendering `{{ .Token }}`.
- **Returning account (new branch).** On `identity_already_exists` or `email_exists`: the collision state "You already have a Homa family. Bring Maya's new report and week into it, or open what you had?"; "bring it in" rebuilds deterministically inside her family behind a server-verified handoff token (or option (b) fold as a recorded ruling that never grants a trial); the anonymous family is deleted after. Hello's returning link prevents most of this.
- **Routing.** `SessionProvider` exposes `anonymous`; `(tabs)/_layout.tsx` redirects anonymous sessions to the walk's resume route; `signin.tsx` redirects only non-anonymous sessions; all sign-out paths hidden while anonymous; `Stack.Protected` after link.
- **Orphans (replace "needs a cleanup job").** A selector feeding the existing account-deletion job: `auth.users` where `is_anonymous`, created more than 30 days ago, no non-anonymous member; family first, auth user last; never a family with a reminder scheduled; enqueued from the hourly cron where `purgeEmptyAnonymousLeads` returns 0; an anonymous marker the founder console filters on; an in-walk "Start over and erase what I told you" control; /privacy updated. TTL stated to her once.
- **Spend and abuse.** One report and one first-making per anonymous family until linked; child ceiling 8+ as a tripwire; per-install nonce; App Attest or Turnstile as a follow-up issue; the score route gets the same per-family ceiling.
- **Staged week (replace the paragraph).** Report, plan rows, Monday's page real; Tue-Fri rows exist as plan rows with a status enum (planned / queued / ready); the four jobs are enqueued at account link plus trial start under `week-page:{child}:{isoWeek}:{weekday}`; the active-job guard becomes a per-child cap of 5; `plan_activity_schedule.material_id` (additive migration) joins a day to its page; `schedulePlanWeekPinned` writes the week in one transaction; week start computed server-side from `families.time_zone` as the next school day; a fleet template library is the decliner's floor. Copy never names a clock.
- **Walk state.** Additive migration widening the step CHECK to the v2 phases before the code deploy, plus `events.ts` parity; `?? WALK_START_ROUTE` fallback in `STEP_ROUTES`; ladder answers to `child_answers`, never the answers bag; new keys in `families.context` via `mapExtrasSchema` (homeschoolStatus, hardestNow, schoolDays, lessonMinutes, curriculumProfileIds, firstChildId, reminderHourLocal); existing columns for name, state, time zone, source, school year start.
- **Lab staging (replace).** v2.0 = complete flow with real `@homa/core` `scoreMap` and `buildMonthPlan` on device, three sample-stamped server-only slots (Monday's page from the Walker fixture archive, the note, the StateCard), a scripted job-status fixture at the real wait length, a local per-screen dwell trace. v2.1 = anonymous auth, real report, Monday's real page, plan rows, beacons via `reportOnboardingStep`, the pre-committed kill test.
- **After the walk (new).** "## Her first week" context block; `family_memories` rows from walk answers; scripted first chat message; `ios-first-week.ts`; keystone gated on `paywallShownAt`; `planIntent=week` retired.
- **Platform.** v2.0 and v2.1 target iOS; doors render by platform.
- **Rulings to record.** 09-07 bubble grammar and docked mascot (supersedes 08-21, scoped to the lab); notification soft-ask in-walk (supersedes 08-31); report fully open on mobile v2 (scoped); birth month and year (vs. 07-11) or add the day wheel.

### Section 3: the question run

Replace the three paragraphs with:

**You and your kids (at most 7 asks before the FRAME; 2 typed fields, 3 for already-homeschooling):** "Who's learning at home?" (name or nickname; birth month and year wheels; up to five; first add = anonymous user, consent, LegalLine) → "And you? What should I call you?" → "And you're Maya's..." (Mom / Dad / Grandparent / Someone else) → "Which state? Each one has its own homeschool rules and I'll keep yours straight." (formSheet; "I'm outside the US") → state-fact bubble from `state_requirements` → "Homeschooling already, or getting started?" (already / starting this year / just exploring) → "What's hardest right now?" (Keeping a schedule / Knowing if they're on track / Finding materials / Juggling more than one kid at once / Keeping the little one busy while I teach / Hours and records, moderate and high states only / All of it, honestly) → reactive bubble.

**Curriculum and the first child:** already-homeschooling: "Curriculums you're using?" (tag input, atlas chip strip) → recognition bubble → which kid(s) and level chips; starting or exploring: "Have you picked a curriculum yet?" (yes, let me type it / still looking / building my own). Then "Who should I start with?" ("Everyone gets a turn. Who's first?") → "What's Maya loving right now?" → "Where should I start with Maya?" (subject chips or focus cards) → "About how long can Maya sit for a lesson?" (10 / 20 / 30 / 45) → FRAME: "Sixteen quick subjects, then Maya's report and the first week."

**The ladder:** "No wrong answers. 'Not sure' is one of them." plus the scale anchor; start-with subject first with rungs and two deep-dive items, job kicked at its boundary; fifteen subjects follow with base item plus one downward rung on Not yet; optional climb per subject that earned it; "not now" for kids seven and up; vertical radio list; phase-segmented bar; no minutes.

**Moved to the week screen or the first chat turn:** "Styles you follow?" (single-select, prefilled from `approach_tags`), "How closely?" (only with a named curriculum or style), "Anything I should weave into Tuesday's pages?" (chips, optional note, Skip first-class), reminder time (in the soft-ask). **Moved to the account step:** "How'd you find me?" (A friend / Instagram or TikTok / A conference / Searching / Somewhere else). **Building interrupt:** "Which days are school days?"

Scar honored: address and phone stay out of the walk. New rule: an ask ships in the walk only when a named row and a named reader exist in the same PR.

---

## 9. Open questions and what would answer them

1. **Does the tap check-off write `hours_log`?** Two lenses disagree (retention-day2 says the row links completion to Hours; mom-veteran's auditor says the RPC never calls the server function). Answer: one test in the sandbox, check a planner row off, query `hours_log`. Until then the hours line stays off the week screen.
2. **How often will the account step collide with an existing account?** Answer: the two-hour Supabase spike (section 7 #1) plus a count of TestFlight and web emails.
3. **Is the report lock selling anything?** Answer: a query of web families with a locked report vs. without, on conversion. If nothing, the mobile-open ruling costs nothing.
4. **Does the ladder-targeted page actually land at the working edge?** Answer: the eval:sandbox first-making eval with three Walker fixtures at different frontiers, scoring item-range fit; ratchet that number.
5. **Report-first or page-first, felt?** Answer: a blind five-reviewer lab comparison (the 09-01 method) with identical content, plus per-screen dwell on the two candidate first screens.
6. **How much does the ladder change the week for a typical child?** Answer: week-fills §9 already found the age plan equals the answered plan for a typical child; re-run it with the downward rung and an anxious pattern.
7. **Do web families' `context.values`, `styles`, `strictness` get read by any product path?** Answer: a grep of readers (data-strategy found one for strictness) plus a query of rows ever set. This is the true yield of those asks so far.
8. **Are `HOMA_SIGNUP_PAYWALL_ENABLED`, `HOMA_CHAT_ONBOARDING`, and `HOMA_AGENT_JOBS_ENABLED` on in prod?** Answer: check by name (Sensitive env reads blank on pull). The decliner path, the mobile exemption, and Tue-Fri all depend on them.
9. **What share of curriculum tags resolve to an atlas profile with `subjects`?** Answer: a query over TestFlight and web `context.curriculums`. If low, the veteran's covered-subject filter is copy, not code.
10. **Does the bubble grammar end at the first artifact once felt?** Answer: the lab's payoff screens. If the founder wants bubbles over the report too, the contract question is larger than a phase.
11. **Does `child_curricula` fit per-kid curriculum assignment from the walk?** Answer: read its columns; otherwise store in family context jsonb for v2.1.
12. **What is Monday's page for a 2 or 3 year old?** Answer: founder ruling (section 7 below the line); the recipe shortlist by age band already exists.
13. **What grant rate does the in-walk soft-ask earn vs. v1's post-purchase ask?** Answer: `mobile_onboarding.reminder_scheduled` on the first real cohort; v1's rate is unmeasured today.
14. **How many Hello taps reach the first child add?** Answer: v2.0 dwell traces, which also size eager vs. lazy minting.

---

## 10. What the council rejected and why

The auditors refuted nothing: all 157 findings survived fact-check and law-check. What the audit did do was narrow several claims, and the chair rejected specific options inside tensions. For the record:

**Auditor corrections that changed a recommendation**
- Native `linkIdentity` was asserted unsupported (growth); the installed auth-js supports id tokens, so the account step needs LINK variants of all three doors, not a claim endpoint by default. The claim endpoint is still needed for the collision and merge case.
- "Fire `hapticAdvance` on the dock" (native-ux): rejected under the haptics vocabulary (one per user action; the dock is system motion).
- Device-region preselect for the state pill (native-ux): rejected, it needs location permission for one pill.
- "Never ask the day" (assessment): softened; the 07-11 full-birthday ruling stands until superseded or a day wheel is added.
- "The first honest reminder any real family has received" (growth): 2 of 85 have had one; reworded.
- "Drop styles" and "drop How closely" (growth, mom-veteran, data-strategy): relocated post-payoff rather than deleted, to honor "collect as much as possible".
- "Tracking hours: every lesson logs its own hours" (mom-new): not true for the UI check-off as built; line withheld pending verification.
- "Tue-Fri only after a linked identity" (architecture): already the design; reframed around spend caps.
- The IEP objection "reads as a verdict on a child" (growth): dropped as the reason; cadence law 11 plus the paused bar suffice. The legal, D6, and no-consumer grounds stand from other lenses.
- "Comparing to Texas benchmarks" as a law violation via caption (mom-new): reframed as voice preference there, while the falsity of the caption stands from nine other lenses.
- The manifest as a CI gate (design steward): it is a local and SKILL.md gate since 08-27; severity lowered, the quiet-failure risk kept.
- "Finding materials: Monday's page is printed" week caption (retention-day2): not always true at render; changed to "made".

**Options the chair rejected inside tensions**
- Kick Monday's page before the ladder: hard-codes the age-only brief the delivery study measured (28% approval).
- Sweep all sixteen bases then kick: optimizes cover for the strong kid, the wrong child to design around.
- Fold the anonymous sitting into an existing family by default: reopens a security boundary; allowed only as recorded option (b) that never grants a trial.
- Eager anonymous mint on Hello: every ad tap becomes an auth user and a family with children's data and no owner.
- Route the payoff order by hardest-now in v2.0: no stored consumer, no completions to measure against.
- A drag-to-days curriculum screen before Building: collides with the ask budget; school days become one interrupt.
- Minutes in the ladder's progress cue: the 08-31 mobile no-time-claim ruling governs.
- A second visual profile for the walk: a channel is a delivery constraint, not a second Homa; a bounded phase inside nativeProduct instead.
- Keeping the notification soft-ask out of the walk per 08-31: the anonymous cohort has no other rail; supersede explicitly.
- Confetti, a wave, held props, and a review request: the rig has no limbs, the motion contract bans untruthful loops, and the claims and 5.6.1 posture forbid the prompt.

---

## Appendix A: the chair's tensions memo, unedited

# Council chair: genuine tensions in mobile onboarding v2

Ranked by how much the founder's decision changes the build. Each is a place where two or more surviving findings, or a finding and the stated direction, cannot both be satisfied.

## 1. Account-last's three unresolved branches: the returning mom, the fold boundary, and when the anonymous user is minted

**Side A (edge-cases, growth):** catch `identity_already_exists` / `email_exists` at the account step and offer "Bring Maya's new report and week into it, or open what you had?", with "bring it in" calling `attachAuthUser` under `allowExistingFamilyFold` so the dormant `foldFamilyInto` merges the anonymous sitting. Architecture's option (b) is the narrow version: permit a fold only when the source family's sole member is an `is_anonymous` user from this device, JWT-verified, no billing rows, recorded as a new ruling.

**Side B (architecture option a, legal-privacy):** never fold. Rebuild deterministically inside her existing family (copy child plus `child_answers`, `createReport`, `getOrBuildPlan`, five pinned schedules, copy the one material) behind a server-verified handoff token, or sign her into the old account and delete the anonymous family. The no-fold rule at `store.ts:227-235` exists because of duplicate trials and is not an engineer's to reopen.

**Two coupled sub-decisions.** Legal, edge-cases and competitive want a quiet "I already have an account" link on Hello; the founder said Hello has no chrome. Architecture and edge-cases want the anonymous user minted lazily at the first server write (first child added) to bound orphans and model spend; legal wants AI consent recorded on Hello's Continue, which needs a `family_members` row and therefore an eager mint; Section 2 mints at walk start.

**What is traded:** a standing security boundary and a small diff vs. the single highest-intent parent in the funnel (a web questionnaire completer) losing fifteen minutes of work seconds after the aha; orphan count and abuse surface vs. consent-before-processing and a resumable identity.

**Recommendation:** (1) Put the returning-account link on Hello as one caption-weight text line; it is the cheapest prevention and the only one that avoids collecting a second child profile (5.1.1(iii)). (2) For those who still reach the account step with an existing account, choose rebuild over fold. It needs no ruling change, nothing crosses the trust boundary except her own answers re-submitted under her own JWT, and a Building replay of a few seconds is honest. If the founder prefers the smaller fold diff, it must be option (b) as a recorded ruling and must never grant a fresh trial. (3) Mint lazily at the first child add and make that tap the affirmative AI-consent moment in Homa's voice; Hello's third bubble stays a promise, not a consent control. Eager minting turns every ad tap into an auth user and a family with children's data and no owner.

**Evidence that settles it:** the two-hour Supabase spike (anonymous, then `linkIdentity` with a native Apple id token, Google PKCE, and `updateUser` plus `verifyOtp` type `email_change`, for fresh and already-registered addresses, with Allow manual linking on) tells you whether the collision branch is rare or the default; a count of how many TestFlight and web emails would collide; v2.0 dwell traces showing what fraction of Hello taps reach the first child add, which sizes eager vs. lazy minting.

## 2. What the trial buys and what a decliner keeps

**Side A (growth, competitive):** Tue-Fri are the paywall's concrete object: "Start the free trial and Tuesday to Friday land tonight." The decliner keeps the report, the week plan and Monday's page. Assessment adds that the report must be fully open pre-paywall because the week's lessons point at report rows.

**Side B (retention-day2):** Tue-Fri should be "here now" from a fleet template-lesson library (week-fills §9, roughly 40 lessons, about $18 once), which dissolves most of the day-2 arrival problem and makes "ready by tomorrow morning" true. That removes Tue-Fri as a paywall object.

**Side C (standing rulings and code):** the 2026-07-18 report lock opens four fixed subjects on web, and the wall has been on in prod since 07-18. gap-3 found that the walk's in-flow report completes onboarding by keystone, so with `HOMA_SIGNUP_PAYWALL_ENABLED` a decliner opens chat the next morning, `familyId` is dropped, and Homa tells her from inside the iOS app that setup continues at thankshoma.com. mom-new and growth both require the decline path to land on the week screen "so the paywall never becomes the new dead end." gap-1 adds that today's `first-making:${childId}` key blocks any Tue-Fri or redraw job at all.

**What is traded:** a legible, honest paywall object and compute discipline vs. a week that is real for everyone on day one; web and mobile parity on what is free vs. a plan whose evidence rows are readable; and whether a decliner is a family with a week or a walled lead.

**Recommendation:** Rule the trial's object as "Homa keeps making pages for Maya" and set the mechanics: (a) the report is fully open on mobile v2, recorded as a later ruling scoped to mobile, because the report-to-week contract needs readable rows and the web lock was chosen for a report-terminal funnel that no longer exists here; (b) per-family Tue-Fri pages are the trial's object, enqueued at account link plus trial start under `week-page:{child}:{isoWeek}:{weekday}`, with day cards reading planned until a job row exists, then queued, then ready; (c) the fleet library, if built, is the decliner's floor ("a Homa lesson for this skill"), never the free tier's ceiling, so the decline path is alive and "Tuesday's on me" has a backing; (d) decliners are not walled from chat in their first week: gate the keystone on `paywallShownAt` or make the account-gate text channel-aware and family-loaded. "Yours to keep" plus a wall is the web dead end with a bill attached.

**Evidence that settles it:** cost of four per-family pages per trial start (about $0.45 each) vs. the one-time library; the pre-committed kill-test thresholds for payoff to account to trial on the first real cohort; a query of whether web families with a locked report converted at a different rate than those without one (does hiding twelve rows sell anything); confirmation of `HOMA_SIGNUP_PAYWALL_ENABLED` and `HOMA_CHAT_ONBOARDING` state in prod.

## 3. When Monday's page starts and what it is allowed to read

**Side A (competitive, growth, today's `making.tsx`):** kick `startFirstMaking` right after the loves and working-on tags and run the 16-subject ladder over the ~85 second draw. Building collapses to seconds and the page is ready when the ladder ends. Cost: the page is built from age plus one chip, the age-only brief the 07-28 delivery study named as root cause of the B3 bucket (28% first-delivery approval).

**Side B (gap-1 materials owner, assessment):** Monday's page must be a deterministic item-id contract from the ladder (`selectSubjectLessonTarget` writing `targetItemId`, `startingLine`, `ageMonths` into `materialPlanSchema`). gap-1 wants the start-with subject's rungs run first and the job kicked at that subject boundary; assessment wants sweep (16 bases) then climb, with two deep-dive items on the two or three subjects that carry worksheets so they reach `highConfidence` before the page is drawn. The design as drafted does neither: whole ladder, then an uncovered 85 second Building (growth's 15 to 25% loss window).

**What is traded:** covering the one real dead-time asset Homa has vs. the level fit that decides whether the page is usable at all; and the ladder's order, since sweep-first delays the kick until the remaining ladder may no longer cover the wait.

**Recommendation:** Side B's contract with Side A's discipline. Reorder the ladder so the start-with subject (a chip pick over `MAP_SUBJECTS`, or a model-proposed id verified against the enum, never a keyword table) runs first including its rungs and two deep-dive items; kick the job at that boundary with the target contract; run the remaining fifteen subjects under the build. That fires roughly 60 to 90 seconds in and leaves several minutes of cover. Reject kick-before-ladder outright: it hard-codes the failure the delivery study measured. Reject sweep-then-kick: it optimizes cover for the strong kid whose climb is long, the wrong child to design around. The 07-29 `onboarding-lesson-per-subject` ruling already blessed the subject-boundary mechanism.

**Evidence that settles it:** the eval:sandbox first-making eval with three Walker fixtures at different frontiers (counts-to-5 not yet, counts-to-10 getting there, counts-past-20 easily), scoring item-range fit against the target; lab timing of subject one vs. subjects two to sixteen under anxious-mom and strong-kid answer patterns against the 72 to 211 second build bench.

## 4. Payoff order: the report as the aha or the page in her hand

**Founder:** the progress report is the aha, then "Here's her week."

**Growth, retention-day2:** Monday's page first ("Made for Maya"), the report second as the why, the week last. H2 is the only supported product lever from real data (returners 31% vs. 9% had a worksheet before or with the report), and report-then-nothing survived a full form-to-chat rebuild.

**mom-new:** for the anxious mom an all-growing report reads as sixteen euphemisms; the payoff should be three bubbles (her Easily receipts, one place to start, the week) with the full report behind a tap. native-ux adds that mobile has no chart renderer at all, so porting the web report is net-new work.

**mom-new (hardest), data-strategy, assessment:** let "What's hardest right now?" set the order per family (on-track leads with the report, materials or schedule leads with the page or week).

**What is traded:** the founder's conviction that the report is the moment worth the walk vs. measured evidence that the artifact is what brings her back; a fixed, testable sequence vs. per-family routing that doubles the payoff variants before there is a single measured completion; and the v2.0 rendering scope (a page hero plus a report behind a tap is far less to build than a native report with charts as the first screen).

**Recommendation:** Page first for everyone, report second framed as the why ("Here's how I picked it"), week last, with the Easily receipts as the report's opening bubble and the typical-range band carried over so no reading is a single dot. Do not route the order by hardest-now in v2.0: it has no stored consumer yet and no completions to measure against. Keep the hardest-now answer as the one caption under the week (retention-day2's set) so the answer visibly mattered without forking the sequence. The report remains the aha in substance because it explains the page; it stops being the terminus.

**Evidence that settles it:** the retention re-run planned around 2026-10-01 with D2 and week-used defined on `mobile_onboarding.completed`; a blind five-reviewer lab comparison (the 09-01 method) of report-first vs. page-first with identical content; per-screen dwell on the two candidate first screens.

## 5. What fills the week: the report, her curriculum, or her kid's interests

**Side A (assessment, gap-1):** the week is a pure function of (ageMonths, answers, interests, startWith): `buildMonthPlan` focus subjects plus sprinkle plus the start-with subject, each day keyed to a `targetItemId`, with a unit test that every day's target is a `next_up` rung and no day is built from blended or typical answers.

**Side B (mom-veteran):** Homa's lessons fill only the empty slots and the subjects her curricula do not cover; mastery curricula get "Math-U-See, wherever you are" with no invented lesson; her curricula render as her blocks; four-day weeks are common. The veteran also wants a "What does a school day already look like?" screen with draggable curriculum blocks before Building, which collides with growth's ask budget.

**Side C (data-strategy, architecture):** the builder today reads `interests[0]` and `style` only; `curriculums` is a dead slot in `PlanContext`; "Reading your curriculum's scope" is false until atlas profile ids are stored and wired; values and curriculums never reach materials-studio. edge-cases adds that unschoolers get five worksheets, the thing they left school to avoid.

**What is traded:** a deterministic, testable report-to-week contract (the whole actionability argument) vs. a week that respects the system a veteran already runs; and the honest scope of v2.1, since wiring curriculum into the builder is a builder change.

**Recommendation:** A two-layer week. Layer 1 (v2.1): keep the pure function untouched for what Homa places, but filter its subject set by a deterministic "covered by your curriculum" exclusion derived from the atlas profile's `subjects` when a tag resolved, and its dates by the school-days answer. Her curricula render as `family_events` blocks labelled by name; Homa never places a lesson in a subject her named curriculum covers; if the filter empties the focus set, the start-with subject and the sprinkle remain, and Monday's page targets the start-with subject regardless because she named it. Layer 2 (later): read the atlas scope into the builder itself. Ask school days as chips in the Building interrupt, not as a drag-to-days screen before Building. Unschoolers get the same rows in invitation vocabulary. This keeps the item-id contract intact, honors she-decides for what she already runs, and needs only the atlas profile id the recognition bubble already requires.

**Evidence that settles it:** for TestFlight and web families with `context.curriculums` set, the share of tags that resolve to an atlas profile with `subjects` (if low, the veteran case is copy, not code); the week-fills §9 finding that the age plan equals the answered plan for a typical child, which bounds how much the ladder changes the week at all.

## 6. Ladder depth vs. the walk's length, and how she is told how long it is

**Depth (mom-new, assessment, founder ruling at `bank.ts:209-216`):** the founder would "rather give way more questions if it gives way more accurate results." mom-new wants a downward rung so every subject ends on something the child does and the Easily receipts are never empty. Assessment wants sweep then climb plus deep-dive items, because most subjects are scored on one parent-report item today and render low-confidence. Note the internal collision: the downward rung contradicts the bank's own design law that downward drilling is "deliberately impossible" (`bank.ts:11-12`), even though `nextDeepDiveItem` already walks down post-report.

**Length (growth, mom-veteran, mom-new):** growth estimates 1 to 2% loss per ladder item on an unframed cold run and notes the 95% per-step web figure was a survivor cohort after account creation; the veteran's nine-year-old still gets self-care and gross-motor items and she wants a per-subject "not now"; a strong kid can be served 68 items; the anxious mom taps Not yet sixteen times.

**Scale cue, where two recorded rulings collide:** mom-new and growth want one continuous bar plus "about N min left" (the 07-06 web review replaced "subject 4 of 16" because sixteen reads long). voice-brand wants no duration promises at all (the 08-31 mobile ruling removed the time claim from S8) and would use the segmented subject bar instead. The veteran wants segments with names so she can see the end. Assessment notes the 18 second per-subject estimate is wrong for a strong kid anyway.

**What is traded:** report confidence and a never-empty receipts list vs. completion on cold traffic; and which honesty the progress cue carries (a count is true but reads long; a time is short but is a guess the build cannot keep).

**Recommendation:** Depth, staged. A guaranteed floor (16 base items plus the downward rung when a base gets Not yet) that always yields a complete report, then a clearly optional climb ("Want me to find where Maya's math run ends? Two or three more.") for subjects that earned it, with the two deep-dive items inside the walk only for the start-with subject that Monday's page needs. Kids seven and up get a per-subject "not now, ask me later" that renders as "not mapped yet." Amend the `bank.ts` comment to say downward drilling is off in the climb but one capped downward rung is on at the base. On the cue: segment by phase (you, family, Maya, building), never by subject; name the subject in Homa's bubble; show no minutes. Record that the 08-31 no-time-claim ruling governs mobile while the 07-06 minutes cue stays web.

**Evidence that settles it:** v2.0 dwell per ladder item under anxious and strong answer patterns; the kill test's start-to-ladder-complete threshold; `highConfidence` and mapped-subject counts on the eval fixture with and without the downward rung for a not-yet-heavy child.

## 7. "Collect as much as possible" vs. an ask budget before value

**Founder:** collect as much as possible during onboarding: mom, curriculum, kids, family setup, per-child questionnaires, notifications, anything useful. The design runs six mom bubbles and four family bubbles before the child exists.

**Growth:** at most seven asks before the FRAME, two typed fields (three for already-homeschooling). mom-new: the child by bubble three. data-strategy: strictness has one reader (the settings display), values and curriculums never reach the per-turn context or materials-studio, hardest-now and status have no consumer, so several asks are "collected, consumes nothing." legal-privacy: the values textarea is Sensitive Info for the App Privacy label. The veteran wants the curriculum ask kept and the recognition bubble placed before the ladder as the first proof of competence. The auditors relocated styles, how-closely, values and how'd-you-find-me post-payoff rather than deleting them.

**What is traded:** day-one data yield vs. completions; and the honesty of asking things no reader consumes, which is the anti-pattern the design says it is fixing.

**Recommendation:** Read "collect as much as possible" as "over the first week, not before the first artifact." Pre-value run: kid name plus birth month and year, your name, relationship (dad, grandparent), state with its state-fact give-back, already or starting, hardest-now only if its consumer ships in the same PR (week caption plus a `family_memories` row for the first chat turn), the curriculum tag only for already-homeschooling with the recognition bubble, and school days plus lesson length as the Building interrupts. Styles, how closely, values, how'd you find me, and reminder timing land on the week screen or the first chat turn where each has a visible consumer. Rule: an ask ships in the walk only when a named row and a named reader exist in the same PR. The one measured fact (17% lost at address and phone) points the same way as growth's estimates, and data-strategy shows the moved fields have almost no reader today, so nothing is lost by moving them.

**Evidence that settles it:** the v2.1 per-screen beacons and the pre-committed kill test; before that, a count of web families whose `context.values`, `styles` or `strictness` were ever read by any product path, which is the true yield of those asks so far.

## 8. Full Keiki in a lab vs. a contract that must be extended before she can lead

**Founder:** a self-contained v2 token set inside `labs/` so the walk can go full Keiki without touching `packages/design/src/contract`; decide production later.

**Design-contract steward:** a mascot-led walk breaks four typed assertions (`homaShortEdgePercent {10,16}`, `realObjectVisualWeightPercent`, `homaMayLeadOnlyWhen`, `character-over-object`), the 08-02 quiet-authority ruling bars a superseded system on a default surface, and the fix is a contract extension (a `guidedConversation` block ending at the first real artifact) with a recorded ruling, not a lab exemption or a second profile. Lab tokens must mirror contract names so graduation is a `git mv`; the saturated field needs approved pairs and dark and increased-contrast values; a coral-filled CTA with white text fails contrast at 3.44:1. Graduation is a route move plus a contract flip and the brand manifest classifies any `labs/` file as native-product today.

**native-ux:** every question in a bubble overturns the 08-21 bubble-grammar ruling (reply gets a bubble, a prompt is the sheet's serif heading), and both 08-21 rulings live only as code comments; the auditor says record 09-07 as a later ruling scoped to the lab.

**What is traded:** speed to "feel it" and freedom to copy Keiki vs. a lab that can graduate without a redesign; and whether prompts-in-bubbles becomes Homa's grammar (three grammars in her first ten minutes: walk, chat, voice) or stays a bounded walk exception.

**Recommendation:** Both, in this order. Now: record the 09-07 direction as a later ruling (`walk-mascot-leads-before-first-artifact`, scoped to `labs/onboarding-v2`, superseding the 08-21 bubble grammar for that surface, noting promotion re-opens it); add the `labs/` classification rule to `scripts/brand-surfaces.mts` so the manifest stops asserting a Keiki screen is Quiet authority; build the lab with its own values in a token file shaped exactly like `colors.ts` and `typography.ts`. Defer the contract extension itself (block, version bump, DESIGN.md regen) to graduation and make it an explicit exit criterion of the feel-it phase. Do not defer the two cheap choices that prevent a rewrite: midnight as the enabled-CTA fill (never coral with white text) and EB Garamond and DM Sans roles (never Fredoka outside Logo). The founder's "decide later" is legitimate for the contract; the ruling and the manifest rule cost an hour and prevent the quiet failure the steward already found live in `walk-scene.tsx`.

**Evidence that settles it:** whether the lab's payoff screens, once felt, actually end the bubble grammar at the first artifact (if they want bubbles over the report too, the exception is not an exception and the contract question is larger); `pnpm check:brand-surfaces --check` after the first lab file; contrast measurements of the chosen field against ink for bubble text.

## 9. The notification soft-ask: where it sits, what it promises, and what it does to the paywall

**Ruling 2026-08-31 (`trial-reminder.ts` header):** never mid-walk; ask right after a purchase confirms. legal-privacy: drop it or move it after purchase; "each morning" is a promise nothing can fire.

**retention-day2:** directly after the week screen, before account, because an anonymous abandoner has no other rail (every server re-engagement path is email-shaped) and the walk's screens are the only place a return trigger can be armed; schedule the first local reminder at grant. growth (as corrected): after the week screen for cadence, and before S10 because the D13 gate renders the paywall's reminder line only when permission is already granted. competitive: treat 09-07 as superseding by default, bind the ask to a chosen time, and route it and the trial-end reminder through one permission request.

**Downstream collision (competitive, legal):** Keiki's paywall screen two (reminder reassurance) can only render if permission was granted earlier, so the paywall's shape depends on this placement.

**What is traded:** the one-shot iOS permission spent on a parent who may abandon vs. the only re-engagement rail the pre-account cohort will ever have; and whether the paywall's second beat exists at all.

**Recommendation:** Supersede the 08-31 ruling for v2 explicitly. Place the soft-ask directly after the week screen, before account, fold in "What time does school start at your house?", render it as a mock push whose body names the plan row ("Tomorrow for Maya: counting to 10. Open Homa."), never "ready" and never "each morning", schedule the first DATE-trigger reminder at grant, and route the trial-end reminder through the same permission. Paywall screen two becomes conditional: the bell screen if granted, the charge-date screen if not. H3 (reminders fired for 2 of 85 real families ever) is the retention inquiry's most damning number, and the anonymous cohort has literally no other channel; a permission decline is recoverable in Settings, an unreachable abandoner is not. Record the reversal in the build-log, the ruling index, and the `trial-reminder.ts` header.

**Evidence that settles it:** grant rate on the soft-ask in the first real cohort vs. v1's post-purchase grant rate (unmeasured today); `mobile_onboarding.reminder_scheduled` and `reminder_opened` events; whether D2 return correlates with a fired reminder.

## Below the line: smaller collisions the synthesizer should carry, one line each

- **Birth month plus year vs. the 2026-07-11 full-birthday ruling** (assessment auditor): add a day picker on the same screen or record the supersession; either way store day 15 with `birthdayApproximate` when the day is absent.
- **Hello's third bubble is wanted by three lenses** (legal: a true privacy line and consent; mom-new: the no-verdict promise; voice-brand: "No wrong answers. 'Not sure' is one of them."): give the slot to the no-verdict promise phrased as what she gets, move "No wrong answers" to the ladder's first bubble where it primes the escape chip, and demote privacy to the name-field caption linking /privacy.
- **"Who should we start with?"**: the veteran's "pick the one you're wondering about most" invites the sibling comparison edge-cases warns against; use "Everyone gets a turn. Who's first?" with no default highlight.
- **Which two Building interrupts**: every lens agrees the IEP modal goes and captions must be true, but candidates differ (days plus lesson length; printer plus answer key; response mode plus printer). Days plus minutes are the two the week cannot be placed without; printer belongs on the payoff's print action, response mode in the child profile as a tag.
