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

## 8. Cost per family, measured

Answered 2026-07-29 from `public.model_usage` in production, priced with
`MODEL_RATES` from `apps/web/lib/model-pricing.ts` applied exactly as
`estimateUsageCostUsd` does (cache reads and writes subtracted from input
and billed at their own rates). Zero unpriced calls in every query, so
nothing is silently costing $0.

**What a sitting costs today**

| | Families | Avg | Median | Max |
|---|---|---|---|---|
| Chat-first sitting, all surfaces | 15 | **$0.498** | $0.337 | $1.31 |
| of which the conversation itself | 15 | $0.411 | | |
| Real families, any era, first 60 min | 40 | $0.432 | $0.216 | $5.04 |

The chat-first row is measured on this session's sandbox walk families,
because production has exactly ONE real chat-first family with chat
usage. Same code path, same prompts, real tokens; it is the arc's cost,
not a guess, but it is not yet a sample of real parents.

The conversation is 83% of it. 6.2 model calls per sitting, averaging
319,911 input tokens, of which 183,056 are cache reads at a tenth of the
input rate. Cache hits are already doing most of the work of keeping
this cheap.

**What a made lesson costs**

| | n | Avg | Median | p90 |
|---|---|---|---|---|
| One materials-studio job, all in | 4 | **$0.453** | $0.512 | $0.531 |
| The artifact calls alone (image + review) | 450 materials | $0.023 | | |

The gap between those two rows is the point: the image and review calls
are 5% of a making. The other 95% is the skill's own orchestration,
14.8 model calls per job. Anyone estimating this from the image cost
would be twenty times low.

**So, per family**

| | Model cost | Note |
|---|---|---|
| Today | $0.50 | |
| Wave A, the week fills | **$0.50** | `buildMonthPlan` is a pure function, so this is free |
| Wave B, one lesson | **$0.95** | |
| Wave C, a lesson per subject (5) | **$2.75** | |

Against founder ruling T1, which treats trial token cost of roughly $25
to $45 per family as CAC, wave C spends 6 to 11% of that budget on the
single moment where she decides whether the product is real. That is
affordable. The number is not the reason to hesitate.

**The reason to hesitate is the clock, not the money**

A materials-studio job takes a median of 6.3 minutes and has run as long
as 26.6. The checklist she is meant to be busy behind takes about five.
So a lesson started at the first subject boundary does NOT land before
she comes out of the questions, and the tail lands long after she has
closed the laptop.

Wave C as described, five lessons appearing in her week while she
answers, does not work with materials-studio as the generator. Three
honest options:

1. **Let them land later.** They arrive in the binder and the week after
   she leaves, which is what `start_first_making` already promises and
   what the "Coming back" beat is built for. Cheapest, and it moves the
   wow to her second visit.
2. **Use a lighter generator for onboarding lessons.** The existing
   `subject_lesson` surface averages $0.035 and one model call, against
   materials-studio's $0.45 and 14.8. A text lesson per subject could
   plausibly land inside the checklist window. It is not a printable
   worksheet.
3. **Generate one making, not five.** Wave B, at $0.95 per family, with
   the other four subjects filled by the deterministic plan activities
   that wave A already puts there.

All three are cheaper than wave C. The decision is about what she sees
during those five minutes, not about spend.

Caveats worth carrying: the job-cost sample is four jobs, and the
window-join that produced it attributes every model call in the job's
window to the job, so it may run slightly high. The materials count
(450) spans the full studio, not just onboarding-shaped makings.

## 9. Still open

- **Day, week and month views.** The ask names all three. The plan is
  four weeks of activities and the shipped grid is a week; a day view and
  a month view are UI work not yet scoped here.
- **What "inspect" means for an activity.** A plan activity is a
  sentence, not a document. Clicking one should show something worth the
  tap, and what that is has not been designed.
