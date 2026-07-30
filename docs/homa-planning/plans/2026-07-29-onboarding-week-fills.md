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

## 9. The template question, measured

Founder ask, 2026-07-29: should a template week live in the DB and get
copied to a family at signup, then close the delta to the real plan over
time? And is the baseline just the kid's name and age?

The instinct is right and the implementation should not be a table.

**The baseline really is age, and it is already in the bank.** Every one
of the 224 items carries `typicalMonths`. Synthesising "what a typical
child of this age would answer" from that field and feeding it to the
same `buildMonthPlan` gives a real plan with no questions answered at
all. It is not a template of the plan, it IS the plan, produced by the
one builder, so it cannot drift from the thing it previews and there is
no seed data to maintain.

**The delta is already zero for a typical child.** Target overlap and
activity overlap between the age-derived plan and the plan built from
real answers, measured across ten ages:

| Child profile | Targets | Activities |
|---|---|---|
| Typical for age | **100%** at every age | **100%** at every age |
| Rachel's real 5-answer mix | 100% at 8 of 10 ages | 100% at 8 of 10 ages |
| Only 3 answers | 100% at 8 of 10 ages | 100% at 8 of 10 ages |
| Well behind age | 100% at 7 of 10 ages | 83 to 100% |
| Well ahead of age | 0% at most ages | **67 to 75%** |

So for most families the age plan is the final plan and there is no
delta to close. It diverges only for a child clearly ahead of their age,
and even then two thirds of the activities survive, because activities
are practice patterns attached to a subject and an interest rather than
to one exact skill.

That is a better story than a template anyway: what she sees during
onboarding is usually *confirmed* by her answers rather than replaced,
and being right about her kid before she has told you anything is its
own kind of proof.

**The plan needs exactly ONE answer, not a full checklist.** Zero
answers returns null; one answer produces a complete four-week plan.
So even without the age synthesis, the board can fill on her first tap.

**And this is what makes lessons nearly free.** Because the plan is
shared across families of the same age, the LESSONS for those plan
targets are shared too. The whole population of children aged 2 to 14
produces:

- **25 distinct age-template plans**
- built from **40 distinct target skills**

Forty lessons, generated once for the fleet, cover every child's opening
plan. At the measured $0.453 per making that is **about $18 one time**,
against $2.75 per family for wave C. It pays for itself at roughly seven
families, and there are already 196 in the usage ledger.

It also removes the clock problem entirely: a pre-generated lesson is
already there when she arrives, so nothing has to finish inside a
five-minute checklist. Personalising it is a cheap overlay rather than a
fresh 6.3-minute job, and the interest weaving in the activity text is
already a pure function ("Build the game around horses").

**Recommended shape, replacing wave C**

1. Derive the age-template plan from `typicalMonths` and put it on her
   planner the moment she enters a birthday, roughly ninety seconds in.
   Free, instant, real, and labelled honestly as a starting point.
2. Refine it on every checklist answer. Usually this confirms; when it
   changes, say what she told you that changed it.
3. Persist the real month at scoring, which already ships.
4. Pre-generate the 40 target lessons at fleet level, once, and attach
   them to plan activities. Per-family lesson generation becomes the
   exception rather than the rule.

**A day or a week?** A week, because the shipped grid already renders
one activity per weekday with free days between, so a "day" is already
the unit she reads. There is nothing smaller to start with.

**What still needs deciding.** Whether a pre-generated fleet lesson is
allowed to carry another family's flavour, and how the personalisation
overlay works without regenerating. Also whether the 40-lesson library
lives in the materials tables or somewhere new. Neither is a cost
question.

## 10. Wave A, shipped and walked

**The planner.** `withAgeTemplates` adds a provisional month for any
child with a birthday and no stored one. Verified live: a family with a
name, a birthday and zero answers opens the planner onto math Monday,
literacy Wednesday, phonics Friday, week 1 of 4.

**Honesty carried the whole way.** `provisional` flows through the
payload; `open_planner`'s note tells Homa to present it as a starting
point, never as built from her answers, and refuses edit and schedule
against it; the board says "this is a typical week for this age";
activities render a dot rather than a checkbox, because a greyed box
invites a tap and then refuses it; and the footer's check-off promise is
replaced rather than left contradicting the page.

**Two mistakes worth keeping**

1. **Wiring one reader.** The first pass wired `getPlanBoard`, the
   agent's reader. The /app pages read through `app-data`, so Homa could
   describe a week the planner would not show. There are two plan
   readers; the helper now lives in `plan-week.ts` and both call it.
2. **The month shrank when she helped.** Showing the template until she
   answers and the raw answered plan afterwards took the month from
   three focus subjects to one the moment she finished her first
   subject:

   | | Focus subjects |
   |---|---|
   | before answering | math, literacy, phonics |
   | after math | **math** |
   | after literacy | math, literacy |
   | after phonics | math, literacy, phonics |

   She watches her month get smaller immediately after helping. No test
   would have caught it; the walk did. `blendTypicalWithAnswers` fixes
   it and is the founder's framing made literal: start typical for the
   age, let each real answer write over one typical one. A skip never
   overrides, because declining to say is not saying no. Held as a
   property test across three ages and five answer counts.

**What this does NOT deliver, honestly**

The line during the checklist is now stable and truthful, and that is
the fix. It is also undramatic: a handful of answers among 224 rarely
move the month's focus subjects, so what she mostly sees is a line
renaming itself from "A month for Ellie" to "Ellie's month so far".

The vivid version of this moment is the one already shipped at beat 9,
where the full board opens after the report. If the during-the-checklist
line does not earn its place on a scored walk, cut it rather than making
it louder: a strip competing for attention at the most exposed beat in
the product is a worse trade than a quiet one that does not.

## 11. Still open

- **Day, week and month views.** The ask names all three. The plan is
  four weeks of activities and the shipped grid is a week; a day view and
  a month view are UI work not yet scoped here.
- **What "inspect" means for an activity.** A plan activity is a
  sentence, not a document. Clicking one should show something worth the
  tap, and what that is has not been designed.
