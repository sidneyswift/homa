---
name: reflective-inquiry
description: How we think about ambiguous product problems, distilled from Dewey's How We Think. Use BEFORE committing to a diagnosis, roadmap bet, feature request, or fix when the cause is uncertain: a metric moved without explanation, a stakeholder or co-founder wants a feature, research sounds positive, a launch behaved unexpectedly, or the team is stuck in analysis. Turns suggestions into testable hypotheses: define the felt difficulty, generate rival explanations, reason through predictions, pick the smallest useful test, record the learning. Also the template source for assumption ledgers, negative case logs, if-then PRD sections, and corroboration reviews. Not needed for reversible mechanical work with a known cause.
---

# Reflective inquiry · how we think about product problems

Product work fails when teams treat suggestions as conclusions. This skill
teaches a better habit: pause at the point of doubt, define the real
problem, form rival hypotheses, reason through what each one predicts, then
test against the world. It is John Dewey's How We Think translated into a
product operating loop.

The one idea to remember: thinking is not the same as having thoughts.
Everyone has hunches, opinions, and associations. Reflective thought is
active, persistent, and careful. It examines a belief by looking at the
grounds that support it and the consequences that follow from it. The goal
is not to be slower. The goal is to be disciplined about what counts as
evidence.

- A thought says: "Users seem lost."
- A belief says: "The onboarding step lacks feedback, so users seem lost."
- Reflective thought asks: "What evidence would show confusion? What else
  could explain the same behavior? If feedback is the cause, what should
  change after we add it?"

## The core model

1. Something feels wrong.
2. The team defines what is uncertain.
3. Several possible explanations appear.
4. The team reasons through what each explanation would imply.
5. The team observes, tests, or ships in a way that can confirm or weaken
   the explanation.
6. The team updates its belief and carries the learning into the next
   decision.

Reflective thought is the path from "I think users need this" to "we have
earned enough confidence to act, and we know what would prove us wrong."

## The five phases of reflective thought

### 1. Felt difficulty

Reflective thought starts when smooth action breaks: activation dropped, a
stakeholder request does not fit the roadmap, a research quote contradicts
an assumption, a launch behaves unexpectedly. The first signal is often
discomfort. The trap is to treat discomfort as a request for immediate
action.

"Users seem lost", "sales needs this feature", and "activation dropped" are
not problem definitions. They are felt difficulties. They tell you where to
look.

Useful question: what changed, broke, surprised, slowed, or contradicted
what we expected?

### 2. Definition of the difficulty

Locate the problem precisely. A vague difficulty has too many possible
causes; a defined one narrows the field enough that inquiry can begin.

- Bad: "The new onboarding is bad."
- Better: "Invited teammates on mobile complete account creation but do
  not reach the workspace because the next action is hidden below the
  fold."

The better version names the user slice, the situation, the broken step,
and the suspected mechanism.

Useful question: which part of the situation is uncertain?

### 3. Suggested solution

Possible solutions appear. Treat them as working ideas, not final answers.
A feature idea enters the room as a hypothesis, never as a commitment
wearing a nicer shirt.

- "Add onboarding tooltips" becomes "If users are missing the next step,
  then an explicit signifier near the completed action should increase
  continuation."
- "Build a dashboard" becomes "If managers cannot coordinate because
  status lives in six places, then a shared status view should reduce
  follow-up messages."

Useful question: what belief would need to be true for this solution to be
the right one?

### 4. Reasoning through consequences

A hypothesis earns attention only when the team reasons through what should
happen if it is true. Do not stop at "we believe X." Ask what X predicts.

If the onboarding issue is a hidden next action:

- Smaller screens should perform worse.
- Session recordings should show users pausing or scrolling.
- Support questions should mention "what now?" or "where do I go?"
- Moving the action into view should improve continuation for the affected
  segment.

If those implications do not appear, the explanation weakens.

Useful question: if this explanation is right, what else should we see?

### 5. Experimental corroboration

Contact with reality. Test, observe, compare, ship, or vary conditions in
a way that can strengthen or weaken the belief. A launch is not proof by
itself; a launch is a test of whether predicted consequences appear.

- A discovery call tests whether the problem exists in a user's real life.
- A prototype tests whether the concept makes sense before engineering
  investment.
- An A/B test tests whether one controlled change caused a measurable
  difference.
- A beta tests whether the workflow survives real context.
- A launch tests whether the market behaves as expected at full scale.

Useful question: what observation would make us update our belief?

## Key terms

- **Reflective thought**: active, persistent, careful consideration of a
  belief, including the evidence for it and the consequences that follow.
  It turns "I think this matters" into "we have a reasoned bet, named
  assumptions, and a way to learn."
- **Suggestion**: the first possible meaning or solution that appears.
  Feature requests, design ideas, and stakeholder interpretations are
  suggestions until tested.
- **Belief**: something accepted as true or probable. Every roadmap item
  rests on beliefs about users, incentives, constraints, and outcomes.
- **Inference**: the move from what is present to what is absent. "Users
  abandoned the flow, so they must be confused" is an inference: the
  abandonment is present, the confusion is inferred.
- **Proof**: inference that has survived disciplined checking. Proof rarely
  means certainty; it means the belief has been tested well enough for the
  decision at hand.
- **Observation**: purposeful search for relevant facts, not staring at
  dashboards. Look for facts that bear on the uncertainty.
- **Induction**: moving from particulars toward a possible general pattern.
  After ten customer calls: "The real pain is not reporting. It is
  reconciling data across tools."
- **Deduction**: reasoning from a general idea toward what should follow if
  it is true. If reconciliation is the pain, users should already have
  spreadsheets, exports, manual checks, and recurring cleanup meetings.
- **Suspended judgment**: holding a possible conclusion without accepting
  it too quickly. It means "do not commit yet", never "never decide."
- **Experimental inquiry**: varying conditions to learn what causes what.
  Changing copy, layout, audience, and timing at once may move a metric,
  but it will not explain why.

## The reflective inquiry loop

Use this whenever a decision is ambiguous enough to deserve thought.

### Step 1: state the felt difficulty

One sentence: we expected [X], but observed [Y], in [situation].

### Step 2: define the problem

The problem appears to be [mechanism] affecting [specific user/context]
during [specific moment], causing [observable cost].

### Step 3: generate rival hypotheses

Write at least three. Do not accept synonyms; each hypothesis must imply
different evidence. Rival hypotheses prevent the first plausible story from
becoming the truth by default.

### Step 4: reason through predictions

For each hypothesis: if this were true, what else would we expect to see?

### Step 5: choose the smallest useful test

The test should reduce the uncertainty enough for the decision. Options,
roughly cheapest first: segment analysis, session replays, five targeted
customer conversations, support-ticket search, prototype test, controlled
copy or layout change, beta with explicit success criteria, launch with a
corroboration review.

Match the rigor to the risk. Do not run a research circus for a reversible
copy change. Do not use vibes for a strategic bet.

### Step 6: record the learning

After the test, write: what we believed, what we observed, what changed in
our belief, what remains uncertain, and what principle can travel to the
next decision. Teams waste learning when they only record decisions.
Record the judgment that produced the decision.

## How the model changes product work

### Discovery

Less collecting opinions, more locating real difficulties. Do not ask
"would you use this?" or "do you like this idea?" Ask: when did this last
happen? What did you do next? What made that difficult? What did you try
before? What would have changed the outcome?

### Roadmapping

Roadmaps are bundles of beliefs. Each item should expose the belief
underneath: this segment has this difficulty, the difficulty matters now,
the proposed work attacks the cause rather than a symptom, the appetite is
proportional to risk and value, and these signals will appear if the bet
works.

### Stakeholder requests

A request is evidence of pressure, not automatic evidence of user need.
Translate the ask into inquiry: what difficulty is this request trying to
remove? Who feels the pain? What facts led to this request? What would
happen if we did nothing? What alternative explanations fit the same
facts? Do not dismiss the stakeholder. Improve the request until it can be
tested.

### PRDs and specs

A PRD should preserve the thinking that made the build reasonable, not
just describe what to build. Include: felt difficulty, problem definition,
working hypothesis, rival hypotheses, predicted consequences, corroboration
plan, and negative cases (where the hypothesis might fail).

The if-then section: if we build [solution] for [user/context], we expect
[behavior/outcome] because [belief]. We will know the belief is stronger
if [signal]. We will weaken the belief if [negative signal].

### Experiments

Isolate causes. A weak experiment asks "did the metric move?" A strong one
asks "which condition caused the movement?" Empirical habit says "that
worked last time." Scientific inquiry asks "what condition made it work,
and can we reproduce it?" Name the variable before the test starts.

### Retrospectives

Extract causal learning, not sentiment. Replace "what went well / badly /
should improve" with: what did we expect? What happened after the change?
Which belief was strengthened? Which weakened? What negative case did we
miss? What principle can travel to the next project?

## Rituals and templates

- **Felt difficulty review** (weekly): what surprised us this week? Where
  did users behave differently than expected? Which requests point to
  unresolved tension? Which support tickets repeat the same hidden cause?
  Which metric moved without explanation? Output: a ranked list of
  difficulties worth inquiry.
- **Assumption ledger** (for any meaningful bet): columns for belief,
  evidence, confidence, rival explanation, prediction, next test, owner,
  review date. Makes hidden judgment visible.
- **Negative case log** (discovery, beta, experiments, launch): users who
  should have cared but did not, customers who adopted then churned,
  segments where the metric did not move, quotes that contradict the
  thesis, workarounds that solve the problem differently. Negative cases
  protect the team from flattering evidence.
- **Corroboration review** (after a launch or experiment): what did we
  predict? What happened? Which belief got stronger, which weaker? Which
  rival explanation still fits? What should we do differently? What
  reusable principle did we earn?
- **Interview batch ritual**: after every batch, write one section titled
  "What would make us wrong?"

## Day-to-day scenarios

### A senior person wants a feature

Do not just accept, reject, or negotiate scope. Ask: what difficulty is
this person reacting to? What belief makes the feature seem necessary?
What evidence supports it? What else could explain the same pressure? What
small observation would sharpen the decision? A useful response: "Before
we shape it, I want to identify the difficulty it is solving. If the
problem is enablement, the right answer might be a feature, a workflow
change, or better packaging. Let us find the constraint first."

### Customer research sounds positive

Positive interviews are dangerous because they feel like progress. Did
customers describe past behavior or future opinion? Did they give up
anything costly? Did they show a workaround? Did we ask for negative
cases? Did the facts support our belief, or did we hear what we hoped?

### A metric drops

Separate observation from inference. Observation: activation dropped from
42% to 34%. Inference: the redesign caused confusion. Rival inferences:
traffic mix changed, a bug hit one browser, a new segment entered through
a campaign. Force the top three explanations to be written before anyone
proposes a fix.

### The team is stuck in analysis

Reflection should terminate in tested belief and action. What decision are
we delaying? What uncertainty blocks it? What evidence would be enough?
What is the smallest action that would produce that evidence? What is the
cost of waiting? Set a decision threshold before gathering more
information.

### The launch worked, but nobody knows why

What did we expect? Which expected behavior appeared? Which unexpected
behavior appeared? Which segment drove the result? What would reproduce
this? Without that step, the organization gets motion but not learning.

## Cheat sheet

- No difficulty, no inquiry.
- Treat a request as a symptom until the team defines the problem.
- A feature idea is a hypothesis, not a conclusion.
- Suspended judgment means wait long enough to think, not wait forever.
- Observation is useful only when it bears on a live uncertainty.
- Induction builds a possible pattern from cases; deduction asks what the
  pattern predicts.
- A test should change your confidence, not just produce a number.
- Negative cases are not annoyances. They are how a belief gets sharper.
- A launch should produce learning, not just shipped work.
- Record the reasoning, not only the decision.

## Misconceptions

- **It is a rigid checklist.** The phases are a pattern of inquiry, not a
  ceremony. Real thinking loops, skips, and compresses steps. Ask: which
  step matters most for the decision in front of us?
- **More data means better thinking.** Data is useful when it reduces a
  named uncertainty. Ask: what question is this data meant to answer?
- **Suspended judgment means indecision.** It moves toward closure. Ask:
  what evidence would be enough to decide?
- **A/B testing is automatically scientific.** Only when it isolates a
  meaningful condition. Ask: do we know what changed the outcome?
- **Academic rigor always helps.** Some decisions need deep inquiry, some
  need quick action and fast feedback. Ask: how much uncertainty can we
  afford, and how reversible is this decision?
- **Customer quotes are facts.** A quote is evidence of what someone said
  in a situation, not of what customers will do. Ask: what behavior, cost,
  or prior action supports this quote?
- **The first cause is usually the cause.** The most visible cause is
  often the easiest story. Ask: what rival explanation fits the same
  facts?

## Failure modes to watch for

- **Opinion wearing the costume of evidence**: "we know users need this"
  really means "a senior person believes this." Fix: write the belief, the
  source of the belief, and what would change it.
- **Urgency replacing inquiry**: the team pretends the first explanation
  is true because a decision is needed. Fix: separate decision speed from
  confidence; you can move fast while naming the uncertainty.
- **Discovery as compliment collection**: enthusiasm counted as evidence.
  Fix: look for past behavior, costly commitment, workarounds, negative
  cases.
- **Experiments that cannot teach**: too many conditions changed at once.
  Fix: name the variable before the test.
- **PRDs that hide reasoning**: the document explains the solution but not
  the thought behind it. Fix: add beliefs, rivals, predictions,
  corroboration plan.
- **Retros that store sentiment**: what felt good or bad, causal learning
  lost. Fix: end every retro with one transferable principle.
- **Endless inquiry**: research keeps growing because deciding feels
  uncomfortable. Fix: define the decision threshold and stop when it is
  met.

## Operating checklist

Before committing to a meaningful product decision:

- What is the felt difficulty?
- Have we defined the problem before naming the solution?
- What belief are we treating as true?
- What rival explanations could fit the same facts?
- What evidence would change our mind?
- What negative cases have we written down?
- What should happen if our idea is right? What if it is wrong?
- What test or launch will corroborate or weaken it?
- Is this decision risky enough to deserve more inquiry, or reversible
  enough to move faster?
- Have we reached a decision, or are we hiding in analysis?

## A full worked example

Activation drops after a redesign. The quick story: "the redesign is bad."
The reflective path:

- **Felt difficulty**: activation dropped from 42% to 34% after the
  redesign.
- **Defined difficulty**: the drop appears only for invited teammates on
  mobile. They finish account creation but do not enter the workspace.
- **Rival hypotheses**: the next action is below the fold on mobile; the
  invite link routes some users into the wrong state; users do not
  understand that account creation is separate from workspace entry; page
  load time causes abandonment; a permission bug blocks access after
  signup.
- **Reasoned predictions**: if the next action is hidden, mobile should
  underperform desktop, recordings should show pauses and scrolling near
  the bottom, and raising the action should improve continuation. If
  routing is wrong, affected users should land on an unexpected page and
  the issue should cluster around invite links. If the concept is unclear,
  users should ask what the workspace is, copy changes should help more
  than layout changes, and similar confusion should appear on desktop.
- **Test**: review mobile invite sessions, reproduce the invite flow,
  segment continuation by device and invite state, ship the smallest
  visible-next-action fix if the first hypothesis holds.
- **Updated belief**: not "the redesign failed" but the narrower "mobile
  invitees lose the next action after account creation because the
  workspace-entry CTA is not visible at the moment they expect
  confirmation and direction." That belief can now shape the fix.

## When to use this reference

- Before discovery: define the felt difficulty and the assumptions that
  need testing.
- Before roadmap commitment: turn each candidate into a belief, a
  prediction, and a test.
- Before PRD or plan review: check that the document explains why the work
  should exist, not only what should be built.
- After launch: compare predicted consequences with observed behavior and
  record the transferable learning.
