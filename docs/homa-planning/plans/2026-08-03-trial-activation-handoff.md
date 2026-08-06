# Trial activation handoff

**Date:** 2026-08-03  
**Status:** Partially shipped, 6 of 10 completion criteria complete  
**Scope:** The journey from account commitment through the first independently useful week, with emphasis on the report-to-planner handoff observed in one real trial family.

## Reconciliation on 2026-08-06

GitHub issue #817 is the live tracker. The diagnosis and target journey below
remain the specification and evidence layer.

Six outcomes have shipped through PRs #818, #823, #824, and #853: truthful
trial copy, immediate deterministic report access, authenticated report
opening, grounded month previews, durable activation milestones, early
unfinished-plan rescue, same-email recovery, returning-device continuity, and
the provider-backed duplicate-trial implementation.

Four outcomes remain open:

1. Guide the report, current week, one real adjustment, and first captured
   learning loop as one sequence.
2. Complete provider-backed duplicate-trial protection after the production
   repair tracked by #873.
3. Repair phone report and signup comprehension defects.
4. Replay the complete observed journey with delayed narrative, return
   behavior, the guided first-week loop, and duplicate-trial recovery.

The numbered risks below record the 2026-08-03 diagnosis. They are not a live
status list. Use #817 and its linked production repair #873 for current state.

## Executive ruling

The observed family did not fail the questionnaire. She completed it twice, received two reports, opened the Planner, and asked a high-intent question about weekly planning. The failure started at the report reveal and continued through her request for an August plan.

Under founder ruling `onboarding-completion-milestones`, a scored report ends onboarding. Keep that policy. Name the next stage **activation handoff**: the guided transition from a scored report to an understood, adjusted, and usable first plan. Track activation separately from onboarding so a family can be correctly marked setup-complete without being mistaken for independently successful.

The product should guarantee a recoverable path, not promise that no person will ever feel confused. Every state that trapped this family must have one visible next action, a deterministic product effect, and a measured recovery path.

## Evidence boundary

### Direct observations

- Production currently has chat onboarding and the signup paywall enabled.
- The family completed 37 checklist answers on the first account and 34 on the second.
- She explicitly said the experience was good before the handoff.
- On the first account she asked where the report was, then asked how to reach the home page.
- On the second account she asked how to start weekly plans, asked for August instead of July, and tapped the generated “Explain next step” suggestion.
- The product had already built a month before the reply told her to wait and tap later.
- Her last human action was the request for the next step. Later automated messages received no human reply.
- A second trial account was created for the same family and later had to be removed.

### Inferences, not proven motives

- Repeated report, Planner, and Calendar views are consistent with hunting for the promised result, but do not prove why she moved between them.
- Silence after the August exchange is consistent with unresolved confusion, but does not prove that confusion alone caused disengagement.
- The 18-minute elapsed period before the first chat includes human decision and form time. It is not evidence of 18 minutes of system latency.

## What has already improved since the observed sessions

- The current report reveal card explicitly names the progress report and offers “See the whole report.”
- The July 30 onboarding changes build the first month at scoring and instruct Homa to open the Planner after the report.
- The current planner skill requires `open_planner` before edits and can open the board beside web chat.
- The August 1 month workflow supports an exact calendar month, preview, revision, restore, and explicit approval before saving.
- The account form detects an existing account when the same email is reused.

These changes reduce the original failure surface. They do not yet prove that the exact observed conversation now succeeds end to end.

## Current live and repository risks

1. **Live billing-copy contradiction.** The production onboarding entry promises seven free days, while the public sample report still says “30 free days, then $19 a month.” This is a live trust failure and must be corrected before broader activation work.
2. **Report access waits on optional prose.** The deterministic report can exist while the reveal card hides its open action until narrative generation settles. The report page already has truthful template fallback, so optional prose can still delay the exact action a parent is looking for.
3. **Rendered is treated too much like understood.** The chat reveal emits the report-viewed beacon when the live card mounts. That proves rendering, not that the parent opened or understood the report.
4. **The official onboarding finish and user success are different facts.** Report scoring correctly completes onboarding, but no durable activation state records whether the report was opened, the plan was understood, or the family completed a first loop.
5. **The default month and a calendar month are different objects in the experience.** The fast report plan is an undated four-week sequence. A request for “August” is a dated-month intent and must route to the preview-first planner workflow.
6. **The activation rescue arrives too late.** The loop-back drip waits seven days after plan creation, which coincides with the end of a seven-day trial. It cannot rescue an unresolved day-one plan handoff before conversion.
7. **The public sample is stale as a continuity proxy.** It is useful marketing evidence, but its own signup calls to action make it unsuitable as the screen a signed-in parent should see after answering questions.
8. **Phone comprehension is fragile.** The live public screens show a password hint colliding with the visibility control, a very small trajectory chart, negative month values before their unit is easy to understand, and several screens of nearly identical subject rows before a growing subject appears.

## Failure inventory and required behavior

| Moment | What happened | What should happen |
|---|---|---|
| Trial commitment | A long pre-value path ended in card capture before product use. | Keep the card-upfront policy, but measure decision time separately from system latency and keep the sample proof one tap away before commitment. |
| Existing-family return | A second email created a second family and trial. | Offer a prominent “Continue your family” path and recover an existing device session before creating another family. Never auto-merge identities. |
| Rich child context | The parent gave specific interests and family style. | Reflect one exact detail immediately in the report, plan, or material so she sees that Homa listened. |
| First material promise | A personalized page was promised for later. On the first account it was never opened and remained draft. | Show one durable pending card, then replace it with ready or failed. Ready has one open action and names where it was saved. |
| Report generation | Narrative generation took roughly a minute and ran repeatedly. | Make the deterministic report openable immediately. Let optional prose finish in the background under a single-flight claim and bounded fallback. |
| Report reveal | The parent asked where the report was. | Put the report in a clearly labeled active card with one primary open action. If she asks, open it instead of describing where it is. |
| Report explanation | Homa said the chat summary was the report card. | Distinguish the summary from the full report and perform the open action. |
| Home orientation | The parent asked how to reach the home page. | Do not invent a “home page” abstraction or give a raw route. Open the right surface and name the product object she can see, such as Chat, Progress, Planner, or Binder. |
| Report navigation | Opening the full report leaves the conversational context. | Preserve a visible way back to the same conversation, or open the report in a panel or sheet where the device supports it. |
| Report comprehension | The phone chart makes a negative month number look like a score before its unit is clear. | Lead with the plain-language growth label and next action. Keep exact measurement available without making the parent decode it first. |
| First plan creation | The system built a four-week month, but the parent still had to ask how to begin weekly planning. | After the report, open the real Planner and name one concrete week already made from her answers. |
| Weekly versus monthly intent | The parent asked for weekly plans and was sent through a month-plan explanation. | Open the current week first. Offer a new month only when her request is actually about a new month. |
| Calendar-month request | She asked for August instead of July after a plan already existed. | Read the existing plan, recognize the dated-month intent, preview an August 1 month, and wait for approval before replacing anything. |
| State grounding | Homa told her to wait even though the plan had already been built. | Planner questions always load the planner skill and call `open_planner` before any claim about what exists. |
| Agent assistance | Homa repeated instructions instead of performing the supported action. | Prefer an authenticated open, preview, edit, or schedule action over directions to buttons. |
| Generated suggestion | “Explain next step” appeared when the next step should have been concrete. | During activation, suggestions name executable outcomes, such as “Make this start August 1” or “Open this week.” |
| First habit rehearsal | No in-session debrief, hour log, observation receipt, or check-off loop was completed. | Ask for one thing they did today, save the supported effects, show receipts, and offer an appropriately timed check-in. |
| Return after silence | Automated research arrived after the family left the plan handoff unresolved. | Before general enrichment, resume the nearest unfinished activation object with one direct action. |
| Trial reminder | Billing disclosure did its billing job but did not rescue the unfinished activation. | Keep billing disclosure exact and separate. Send any activation rescue earlier and ground it in a real unfinished object. |
| Account removal | Duplicate-account cleanup required founder intervention. | Ship self-service family deletion under gh#809 and keep duplicate-trial recovery separate from deletion. |

## The target activation handoff

The journey remains one conversation, even when cards and panels change around it:

1. **Report exists.** Show the child-named report card immediately. One action: open the report.
2. **Report is understood.** Lead with one strength and one growing edge traceable to the parent's answers. Offer one correction door.
3. **The week appears.** Open the Planner beside the chat or in the native phone surface. Name that it came from her answers and the child's interests.
4. **The parent changes one real thing.** Ask which day is usually hardest, or honor the constraint she already gave. Perform the smallest visible edit.
5. **The parent completes one loop.** Capture one thing they did today, show the receipt, and let her see what changed or was recorded.
6. **The return is clear.** Offer one check-in time or show the exact unfinished object that will be waiting.

The first report remains onboarding completion. Steps 2 through 6 are the activation handoff.

## Aha opportunities

1. **Homa listened.** Her own words appear in the report, material title, and first plan.
2. **Homa is truthful.** She can correct one claim and see the record change.
3. **Homa does the work.** The first week opens without a navigation hunt.
4. **Her complaint is a command.** “August, not July” becomes a correct August preview in the same turn.
5. **The plan fits real life.** One hard day moves and the board visibly rearranges.
6. **Talking counts.** One plain sentence becomes an hours, observation, or progress receipt when supported.
7. **The artifact is real.** The promised page arrives with one tap to open and one place it is saved.
8. **Leaving is safe.** Returning opens exactly where she stopped, with no generic recap.
9. **The system remembers.** Homa uses the child's interests and the family's style without asking again.
10. **Billing is trustworthy.** Every surface agrees on trial length, charge timing, and cancellation.

## Explicit and implicit help signals

### Explicit

- “Where's her report?”
- “How do I get to the home page?”
- “How do we start making weekly plans?”
- “I actually want one for August, not July.”
- Tapping “Explain next step.”

### Implicit

- Repeated movement among report, Planner, and Calendar.
- A second account for the same family.
- A promised material not opened on the primary account.
- A plan built without a completed observation, check-off, or hour log.
- Silence after the final help request and later automated sends.

## Implementation plan

### P0: Restore truth and deterministic help

1. Correct every live trial-length surface from the same billing source of truth, beginning with the public sample report.
2. Make a scored report openable as soon as deterministic scoring succeeds. Narrative prose may improve in place but may not hold the open action hostage.
3. Add an executable report-open response for “where is the report?” and equivalent intent. Do not answer with a route.
4. Enforce planner grounding for every plan, week, month, calendar, and scheduling request. `open_planner` comes before any claim or mutation.
5. Replay the observed August request through the current preview-first workflow. The preview must begin on August 1, preserve the saved plan until approval, and update only after explicit approval.
6. Remove generic activation suggestions when a more specific executable action is available.

### P1: Add a durable activation state

Add a separate activation record or event-derived state with these milestones:

- `report_rendered`
- `report_opened`
- `planner_opened`
- `plan_constraint_changed`
- `first_loop_closed`
- `activation_handoff_complete`

Do not reuse the onboarding state and do not change the scored-report completion ruling. The activation state governs guided help, lifecycle rescue, and founder funnel reporting. It does not govern tenant access or billing entitlement.

Split the existing report beacon. Card mount records rendering. A deliberate open records opening. Neither alone claims comprehension.

### P1: Make the handoff one guided sequence

1. Keep one primary action at a time: open report, see week, adjust one constraint, close one loop.
2. Preserve the chat thread while opening report and Planner surfaces.
3. Put the current week before the full month when the parent asks how to get started.
4. Ask or infer an exact month only when the parent names a calendar month. Show the dates before saving.
5. Complete the existing mandatory rehearsal before offering broad exploration.

### P1: Repair artifacts and return paths

1. Give the first making explicit pending, ready, and failed states.
2. Auto-finalize only after the existing quality gate, then expose one open action in chat and Binder.
3. If the family leaves, resume with the unfinished report, plan, or material before a general research brief.
4. Move plan loop-back rescue early enough to act inside a seven-day trial. Keep the billing reminder separate and exact.

### P1: Prevent duplicate-family billing risk

1. Add “Continue your family” beside signup and retain exact-email account recovery.
2. On a device with a resumable family, offer to continue before creating a new one, without exposing family details to an unauthenticated visitor.
3. Evaluate a deterministic duplicate-trial guard using exact provider signals such as an existing authenticated family or payment-method fingerprint. Never infer identity from names, child details, or model judgment, and never auto-merge families.
4. If a possible duplicate is detected, stop the second trial and offer sign-in or support recovery. Do not reveal which other account matched.
5. Complete gh#809 for self-service deletion, including explicit typed confirmation and immediate billing cancellation behavior.

### P2: Reduce phone load in the report

1. Fix the password-placeholder collision at 390 pixels.
2. Explain the month unit before any negative trajectory value appears.
3. Let the plain-language “growing right now” summary lead the exact chart measurement on phone.
4. Make the subject the parent is most likely to act on reachable before several screens of stable subjects.
5. Keep movement receipts from covering the subject name.

### P2: Measure and recover, not merely observe

Add or separate events for report rendered, report deliberately opened, Planner deliberately opened, dated-month previewed, plan revised, plan approved, first activity checked, first observation or hours receipt, activation help requested, activation rescue sent, existing-family recovery, and duplicate-trial prevention.

Language-level help detection follows the repository law: a model may classify the intent into a closed schema and supply a verbatim quote; code verifies that the quote exists and that the referenced family object is authenticated. Exact button taps and route opens remain deterministic.

The founder funnel should show:

- time from trial start to first tangible personalized object;
- report rendered to report opened;
- report opened to Planner opened;
- Planner opened to one parent-directed change;
- plan created to first closed loop;
- help-request rate at each activation milestone;
- second-family and second-trial rate;
- return before the first charge.

Baseline these rates on fresh, non-sandbox families before setting outcome targets. Correctness guarantees, such as exact billing terms and preserving a plan until approval, stay at 100 percent in deterministic tests.

## Verification plan

### Deterministic tests on every relevant change

- Every trial surface derives the same term and price.
- A scored report opens when narrative generation is slow, failed, or off.
- Report card mount and report open emit different events.
- A month preview rejects dates outside the requested month and cannot save without approval.
- Existing plan data survives preview, revision, restore, abandonment, and failed approval.
- All IDs remain authenticated and family-scoped.
- The 390 by 844 entry and report screens have no text or control collisions.

### Behavioral evals on the nightly or manual cadence

Use a de-identified replay of the observed sequence:

1. “Where is her report?”
2. “How do I get to the home page?”
3. “How do we start making weekly plans?”
4. “I want one for August, not July.”
5. “Explain the next step.”

Grade tool calls and visible effects, not prose alone. The passing run opens the report, opens the real Planner, previews the requested month, preserves the existing month until approval, and never advises the parent to wait for a future date.

### End-to-end proof before rollout completion

- Use a new sandbox family at 390 by 844 and 1440 by 900.
- Start at the public account page, pass through test checkout, complete a partial and a full checklist, open the report, adjust the plan into the next calendar month, approve it, close one loop, leave, and return.
- Repeat with narrative generation delayed and failed.
- Repeat with an existing plan, a different email on the same device, and a trial already present.
- Verify the final deployed behavior, event rows, Stripe test state, and the actual return path. Screenshots or tool success alone are not completion evidence.

## Definition of done

- The live sample and every payment surface agree on the current seven-day trial.
- The exact observed help sequence passes as an end-to-end sandbox journey.
- No supported navigation request is answered only with a raw path or instructions to hunt for a button.
- A deterministic report is always openable even when optional prose is slow.
- A named calendar month produces that month's preview in the same turn.
- A saved plan does not change before explicit approval.
- Activation state is separate from onboarding and visible in the founder funnel.
- An unfinished activation gets one relevant rescue before the trial ends.
- Duplicate-trial recovery prevents a second charge without auto-merging or exposing another account.
- A parent can delete her family without founder intervention, with billing canceled as part of the verified flow.

## What not to change from this evidence

- Do not shorten or remove the checklist because of this case. She completed it twice and expressed positive sentiment before the handoff.
- Do not move or remove card-upfront billing without a separately specified paywall experiment and precommitted thresholds.
- Do not redefine onboarding completion without a new founder ruling. Add activation state beside it.
- Do not replace product effects with more explanatory copy. The central failure was that Homa described actions it could have performed.
