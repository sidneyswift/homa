# The week fills while she answers

Status: proposal, 2026-07-29. Founder ruling `onboarding-lesson-per-subject`
(build-log, same date). Companion to
`docs/homa-planning/plans/2026-07-29-onboarding-wow-evals.md`, which is the
bar this has to clear and the walk log that will judge it.

Founder ask, verbatim in shape: the system moment should show a planner with
day, week and month filled in beautifully, all clickable, lessons and
worksheets she can see and inspect and understand. As she answers, an agent
builds a lesson per subject. She should be wowed, understand it, and know
that the plan keeps changing as Homa learns and that she can tweak all of it.

## 1. The finding that makes this cheap

`buildMonthPlan(ageMonths, answers, { interests, style })` is a pure exported
function in `@homa/core`. No model. No cost. Milliseconds. It returns a real
`FourWeekPlan` with a `startingLine`, two `targets`, four weeks of
activities "parametrized by the target skill and an interest", and a
`styleNote` for how the plan bends to this family.

It already consumes exactly what the founder described as the templatized
inputs, and more: the child's age in months, every answer she has given so
far, **the interests she tapped on the child card**, and her homeschool
approach.

Three consequences, and they reshape the whole design:

1. **The "mock" is not a mock.** It is the product's real plan. There is
   nothing to fake and therefore nothing that can be caught faking.
2. **It needs no server call, no report and no token.** The checklist client
   already holds age, answers and interests in React state. `getOrBuildPlan`
   needs a report token only because it also persists; the pure builder does
   not.
3. **Preview and saved plan cannot diverge**, because the live board and the
   month written at scoring time call the same function with the same inputs.

So the half the founder most wants to see, a week that fills as she answers,
is the cheap half. The expensive half is only the generated worksheets.

## 2. Two clocks, which is what made the timing feel hard

| | Speed | Cost | Where it can run |
|---|---|---|---|
| The plan and its activities | milliseconds, pure function | free | anywhere, including the browser |
| A printable worksheet | minutes | a model call per lesson | background job only |

Conflating them is why "at what point does it show her" had no obvious
answer. Separated, each has an obvious home.

The plan can update **on every single answer**. The worksheets need cover,
and the checklist is the only stretch of sitting one where she is genuinely
busy: roughly five minutes behind a full-screen takeover while Homa is
otherwise idle. That is also exactly the dead time that currently produces
the 20 to 45 second blank-screen waits measured in walks 003 to 006.

## 3. What she sees

Ruled: the week fills **during** the questions, at the subject boundary.

The checklist already has a subject boundary and already marks it: the
kicker slot shows a domain intro ("First up: numbers.") when a new subject
opens, and the full-page flow has a `ReportRail` captioned "BUILDING AS YOU
ANSWER" that the compact chat dock drops. So the beat exists, the compact
variant is what is missing.

At each subject boundary, and only there, never mid-question:

- The board shows what her answers just added to the week, by name.
- One quiet line ties it to her: her child's interest is already woven into
  the activity text, so she sees "horses" in her own week without being told
  it was personalized.
- It does not block. She can keep answering through it.

The founder chose this over showing it at the reveal, having been told the
risk: the checklist is the most exposed beat in the product, and anything
competing for attention there is competing at the worst moment. The
mitigation is the boundary, not a persistent panel. If a walk shows it
pulling focus mid-subject, move it to the reveal rather than shrinking it.

At the reveal the board is already full, so beat 7 hands her a report and a
week that visibly built itself from what she just said, which is the
sentence the whole feature exists to earn.

## 4. Three implementation constraints, found by reading rather than guessing

**A. No report token during the checklist.** `getOrBuildPlan(reportToken,
subjectId)` resolves the child through `child_reports`, and no report exists
until scoring. This does not block the live board (the pure builder needs no
token) but it does mean the live board is computed, not persisted, until the
reveal scores the report and writes the month.

**B. The job guard is keyed on family + skill + child.** `startAgentJob`
enforces "one active job per family + skill + child", so five per-subject
lessons for one child collide and only the first starts. Varying the key by
subject is a small change and must be a deliberate one: that guard is the
thing standing between this feature and a runaway fan-out. Whatever replaces
it stays bounded per family per sitting.

**C. `start_first_making` enforces one making in code, not just prose.** Its
result carries `alreadyStarted` and returns the same build on a second call.
The founder ruling overturns the skill's sentence; it does not by itself
change this tool. Either the per-subject path uses a different mechanism, or
the tool's contract changes deliberately and its description changes with it.

## 5. The line that must not move

Everything in the ruling is about how much is shown. Nothing in it relaxes
honesty, and the failure mode here is specific and severe: she is deciding
whether to pay, and a beautiful week whose lessons turn out to be
placeholders inverts trust at the exact moment it is being earned. This
house has already shipped that failure once, on the phone line that
fabricated binder and worksheet claims.

So:

- Every activity in the board is real, because the builder is deterministic
  and its output IS the plan.
- Anything clickable is either finished or plainly labelled as still being
  made. A worksheet that is still generating says so.
- Nothing says "your worksheets are ready" until the tool result says they
  are. `start_first_making`'s rule, promise only after the tool confirms,
  applies unchanged to every lesson in this feature.

## 6. What is honest to tell her, and already true

The founder's message, "as we learn, your child's calendar and plans can
change, and you can update them yourself to tweak them", is true today and
costs nothing to say. `edit_plan` edits activities, `schedule_plan_activity`
places them on real dates, and the unified week grid with drag and reshuffle
shipped 2026-07-27. The plan is also literally a function of her answers, so
"it changes as I learn" is a description of the mechanism rather than a
promise about the future.

## 7. Waves

**Wave A, the week fills. Deterministic, free, no model.**
Compute the plan client-side from answers so far, show it at each subject
boundary, and persist the real month at scoring so the planner is full at
beat 9 instead of reading "There's no month set up for Ellie yet". This
alone closes gh#426 and delivers most of the visible ask.

**Wave B, one real lesson.** Generate during the checklist, land it
clickable in the week. Proves the clickable-lesson path end to end under the
existing one-making guard, before touching that guard.

**Wave C, a lesson per subject.** Only after B works and B's cost per family
is measured. Requires constraints B and C above to be resolved deliberately,
with a bound per family per sitting.

Wave A is worth shipping alone. It is free, it cannot fabricate, and it
turns the arc's weakest beat into its most legible one.

## 8. Open

- **Cost per family for wave C.** Five generated lessons per onboarding
  family, against a trial that already treats token cost as CAC (T1). Needs
  a number before C ships, not after.
- **Day, week and month views.** The ask names all three. The plan is
  four weeks of activities and the shipped grid is a week; a day view and a
  month view are UI work not yet scoped here.
- **What "inspect" means for an activity.** A plan activity is a sentence,
  not a document. Clicking one should show something worth the tap, and what
  that is has not been designed.
