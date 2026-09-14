# Bounded investigation of Homa chat latency

Owner: gh#1171. Existing experimental draft: PR #1191. Prepared September 14,
2026 at the founder's request. This plan defines the next investigation; it
does not start another test batch or authorize a production promotion.

## Decision and limits

Decide whether targeted changes can make simple chat reliably faster on Astra
medium, and whether five seconds is a supportable product target. A useful
improvement below that ambition is still worth considering. Failure to reach
five seconds in this investigation does not prove that it is impossible.

Hard limits, whichever arrives first:

- Eight elapsed hours from the first execution action, including builds,
  deployments, test setup, analysis, and reporting. Record start and deadline
  on the issue. No overnight continuation or automatic extension.
- Three isolated candidate changes, at most three candidate deployment builds,
  plus one shared instrumented control deployment.
- 240 synthetic app Sends total. A Send may generate multiple paid model/tool
  calls; record their cost separately. Retries and invalid measurements still
  consume the Send budget. Do not replace inconvenient results.
- Spend no more than 30 minutes resolving access or measurement setup. If that
  fails, stop and report the prerequisite instead of opening another project.

At two, four, and six elapsed hours, give the founder the observed result,
remaining budget, and next decision. These are checkpoints within execution,
not a request to schedule an automation. Stop sooner when evidence answers the
decision. Reserve the last hour for the report; start no new experiment then.

## Scope and measurement

Hold Astra medium fixed. Work in protected previews with owned synthetic
families. Keep authentication, tenant boundaries, message saving, approvals,
cross-tab recovery, and required quality checks intact. Preserve all previous
experimental work as evidence; do not ship the accumulated draft as a bundle.

Three request classes have separate results:

1. Simple conversation: introductions, definitions, and general advice that
   requires neither private records nor an artifact.
2. Personalized assistance: answers requiring saved family information.
3. Creation: worksheets or activities requiring substantial tool work.

The five-second hypothesis applies to class 1. For classes 2 and 3, report
first useful visible response, completion time, and correctness. Do not impose
an invented completion deadline or include them in a simple-chat pass rate.

The primary clock is Send to the first useful visible answer. Separately record
first answer characters, preparation before model dispatch, model/tool rounds,
and completion. Hidden reasoning, acknowledgements, spinners, empty stream
events, and an initial isolated word do not count as a useful answer. Freeze
the useful-prefix rubric before testing and retain snapshots for review.

Use one clock for browser intervals; label cross-system phase estimates as
approximate. Record source/deployment, prompt, reasoning, history length,
fresh-session versus continuing-session state, cache usage, model/tool calls,
saved outcome, failure, and cost. Report median, observed p95, five-second pass
fraction, and paired differences; do not add component p95 values together.

## Phase 1: establish the limiting factor, up to 90 minutes

Use 60 Sends: a frozen set of 12 simple, four personalized, and four creation
questions, three repetitions each. Include fresh sessions and continuing
conversations, varied but equivalent synthetic histories, and all startup
samples. Reset or isolate fixtures where a task changes records so repeated
questions do not silently become easier. Reserve separate unseen simple
questions for final validation.

Choose a single production-derived control with the same measurement code as
the candidates. Reuse a verified existing control where possible. Do not use
the invalid early app-timing median as a baseline. The prepared experimental
previews can inform diagnosis but are not automatically the control.

Break down the slow simple replies before choosing a change. In particular:

- If preparation dominates, locate the waiting operation and determine whether
  it is necessary before model dispatch.
- If extra model/skill rounds dominate, assess whether they improve the answer
  or are unnecessary routing for general advice.
- If a single model call consumes the budget, inspect context and cache behavior
  before blaming the app. More than five percent of such calls exceeding five
  seconds is evidence that removing preparation alone will not meet the goal
  in that sample; it is not a universal lower bound.

At the end, identify at most two measured bottlenecks. If the trace cannot
identify them within this phase, stop and report the measurement limitation.

## Phase 2: at most three experiments, up to three hours

Each candidate gets a prediction written on the issue before implementation:
which measured wait it removes, expected seconds saved, and the behavior that
must remain correct. Test one variable at a time against its stated control.

Candidate directions, selected by Phase 1 evidence rather than attempted by
default:

- Remove a measured unnecessary preparation wait or repeated history read.
- Improve the existing fleet-skill routing so general advice does not take a
  personalized workflow unnecessarily. No keyword-based intent shortcut.
- Preserve reusable model context or reduce measured unnecessary context work.

Use 40 Sends per candidate: 20 matched pairs with equivalent starting history,
balanced order, and identical prompts. Include positive and negative routing
cases if routing changes. Run the applicable deterministic guards and assess
answer quality, successful saves, and tool behavior. No replacement run just
because results disappoint; a failed build still uses one candidate slot.

A candidate advances only if the paired median saving is at least one second
AND at least 20% of the control median, the candidate's observed p95 does not
worsen, and no material quality, durability, or safety regression appears.
These thresholds are screening rules, not proof of statistical significance.
Reject weak or mixed changes. Stop after two consecutive non-advancing
experiments instead of automatically using the third slot. Do not combine
individually unproven changes.

## Phase 3: validate one winner, up to two hours

If a candidate advances, test the best candidate in 60 new simple-chat Sends:
20 held-out prompts, three repetitions, across at least two time windows and
fresh/continuing sessions. Use remaining time to review complicated-task
regression evidence from Phase 1 and relevant guards; do not claim a new
complex-task speedup from simple-chat validation.

Provisional five-second success means at least 57/60 useful replies within
five seconds, with no material regression and all required checks passing.
Report it as an observed sample result. Sixty tests do not certify that 95% of
future production replies will meet the target, particularly under untested
concurrent load. A 95% service-level promise requires subsequent representative
production/load evidence with uncertainty reported.

If no candidate advances, skip this phase and conclude early. Do not spend the
remaining budget to hunt for lucky fast answers.

## Exit decision and final hour

Return one of three decisions, with baseline versus candidate results, exact
sample counts, total time/cost, quality findings, and remaining uncertainty:

- **Recommend a release candidate:** meaningful gains replicated and checks
  pass. State separately whether the five-second sample target passed. Prepare
  only the demonstrated changes for review. Production rollout and live
  verification are a separate explicit next step, not hidden inside this cap.
- **Keep the current version:** changes were too small, inconsistent, or harmful.
  Preserve findings and stop this optimization round.
- **Request a product/architecture decision:** evidence indicates that meeting
  the ambition requires changing model/effort, conversation behavior, or the
  execution architecture. Present one leading option, its expected gain and
  cost, and what evidence supports it. Do not implement a rewrite speculatively.

No automatic continuation after the deadline, two failed screens, or exhausted
budget. A further investigation needs a new explicit decision from the founder,
with a specific hypothesis and its own cap. Update gh#1171 with the decision and
PR #1191 with the resulting disposition. Do not claim the five-second goal
achieved or impossible merely because this round ends.

## Evidence informing this plan

- [September 14 Homa screen and prior-baseline correction](https://github.com/sidneyswift/homa/issues/1171#issuecomment-5664195964).
- [Research findings and source links](https://github.com/sidneyswift/homa/issues/1171#issuecomment-5665427144).
- [Anthropic's delayed execution-environment startup case](https://www.anthropic.com/engineering/managed-agents).
- [MLPerf Endpoints measures latency under load](https://mlcommons.org/benchmarks/endpoints/).
