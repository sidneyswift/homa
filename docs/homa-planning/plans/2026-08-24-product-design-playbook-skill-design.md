# Product Design Playbook skill design

> Status: Design validated with the founder and fresh-reader tested on
> 2026-08-24. The repository skill, deterministic scorer, scoring reference,
> and focused checks are implemented. The native onboarding golden run is a
> provisional E1 calibration, not an accepted product audit.

## Decision

Create one repository-specific coding-agent skill named
`product-design-playbook` under `.agents/skills/`.

The skill will help agents building Homa:

- Diagnose product goals and weak metrics.
- Select coherent Product Design Playbook strategies and plays.
- Design new user flows.
- Audit rendered flows or meaningful sections.
- Produce fit-weighted maturity scores.
- Prioritize score-moving improvements.
- Route approved changes through Homa's existing design, copy,
  accessibility, and policy authorities.
- Re-score after implementation with stronger evidence.
- Roll audited flows into strategy and whole-app scorecards.

This is not an Eve fleet skill and is never exposed as a family-facing Homa
capability.

## Source archive

The external 206-page PDF has been extracted into a page-complete source
archive:

- [`docs/product-design-playbook/INDEX.md`](../../product-design-playbook/INDEX.md)
  is the archive entry point.
- [`FRAMEWORK.md`](../../product-design-playbook/FRAMEWORK.md) explains the
  source's operating model, strategy graph, measurement loop, Homa boundaries,
  and cautions.
- [`CATALOG.md`](../../product-design-playbook/CATALOG.md) normalizes all 33
  plays and their companion links.
- `strategies/` contains 12 source-faithful strategy modules.
- `plays/` contains 33 source-faithful play modules.
- `source/pages/` contains one Markdown transcription per PDF page.
- `screenshots/` contains one readable full-page image per PDF page.
- [`AUDIT.md`](../../product-design-playbook/AUDIT.md) records completeness
  checks and confirmed source anomalies.

The archive contains 206 page transcriptions and 206 valid screenshots. Its
page manifest covers pages 1 through 206 exactly once.

The archive is the canonical home of the extracted playbook knowledge. The
skill must point to it instead of copying the same knowledge into a second
reference tree.

## Source interpretation

The playbook is a graph, not a checklist:

- Product strategies name a goal.
- Each strategy recommends a set of modular plays.
- Each play describes applicability, execution guidance, failure modes,
  companion plays, adaptation prompts, and examples.
- Each strategy names metrics and diagnostic questions.
- The intended loop is goal, metric, diagnosis, plays, implementation,
  measurement, and iteration.

The source says to combine, remix, skip, use what fits, and drop what does not.
The score must therefore reward the right plays used well. It must not reward
the largest number of plays.

The source layer remains neutral. It describes each tactic on its own terms.
Homa readiness is evaluated separately through the project's existing
privacy, safety, truthfulness, accessibility, billing, design, and copy
authorities.

## Authority boundaries

The new skill owns product-design strategy and audit judgment.

It does not replace:

- `homa-design`, which owns Quiet authority, exact visual values, channel
  profiles, states, accessibility, motion truth, and rendered evidence.
- `homa-uxui-reviewer`, which owns a fresh user's one-pass reaction to real
  screens and flows.
- `homa-copy-writer`, `homa-copy-reviewer`, and `homa-copy-editor`, which own
  words, comprehension, and copy craft.
- Product policy, privacy, billing, child-safety, or tenant-isolation laws.
- Analytics instrumentation or production evidence.

A high playbook score cannot declare a Homa flow ready when any existing hard
gate fails. The playbook score remains source-neutral. Readiness does not.

## Trigger policy

The skill loads automatically for:

- Designing or materially changing a user journey.
- Product strategy work involving onboarding, activation, retention,
  engagement, growth, monetisation, conversion, experience, trust, intent,
  habit, or premium positioning.
- Diagnosing a product metric or funnel drop-off.
- Auditing or scoring an implemented flow, section, strategy, or the app.
- Planning a coordinated set of product-design improvements.

The skill does not load for:

- Routine styling or token application.
- Tiny component edits that do not change a user journey.
- Copy editing by itself.
- Domain behavior, database, billing-policy, or infrastructure work by itself.
- A pure accessibility or design-system compliance check.

For mixed work, the journey-changing intent controls routing. Load this skill
as the product-design orchestrator, then invoke the relevant accessibility,
copy, billing, or design authority at its boundary. A task that remains purely
inside one of those domains does not load this skill.

The eventual frontmatter description must carry both the positive and negative
scope because metadata is the routing layer.

## Operating modes

### Diagnose

Start from a product goal, weak metric, funnel break, or observed user problem.
Investigate the real flow and evidence before choosing a strategy. Load the
relevant "Behind the Data" questions. Do not treat a metric as its own
diagnosis.

### Design

Define the user, flow boundary, goal, states, and target outcome. Select a
coherent set of core, supporting, and polish plays. Explain why each applies,
which companion plays reinforce it, and where plays conflict.

### Audit

Score one rendered flow or meaningful section. Inspect the actual route,
transitions, loading, empty, error, interruption, recovery, and completion
states. Code-only evidence produces a provisional result.

### Improve

Identify the smallest high-leverage change set. Show an estimated score delta,
but do not present it as achieved. Wait for approval, route work through
existing Homa authorities, implement, verify, and re-score.

### Portfolio

Aggregate compatible flow snapshots into strategy and whole-app scores. Keep
critical journey floors visible. Do not average unaudited surfaces as zero and
do not imply full-app coverage when the inventory is incomplete.

## Progressive disclosure

Load knowledge in this order:

1. The core `SKILL.md` procedure.
2. `docs/product-design-playbook/FRAMEWORK.md`.
3. One or more relevant strategy modules.
4. Only the candidate play modules.
5. The scoring rubric and evidence protocol.
6. Existing Homa authorities when the task reaches their boundary.

A flow audit first selects one or more strategies. Its candidate play universe
is the union of those strategies' source play stacks plus any additional play
reached through an explicit "Pair with" route. Every play in that candidate
universe receives an applicability record. Plays outside the candidate
universe do not need to load or receive placeholder records.

Pair expansion is one hop only and never recurses automatically. The auditor
must explicitly choose each added companion play. This prevents cycles in the
source graph from expanding the candidate set. If multiple strategies or pair
routes introduce the same play, keep one candidate record with every unique
provenance route sorted by source ID.

The audit records the selected strategy IDs, candidate play IDs, and the source
route that introduced each candidate. The scorer verifies that every candidate
has exactly one applicability record and that no scored play sits outside the
candidate universe.

A normal flow task must not load all 206 pages or all 33 play modules. A
whole-app audit still evaluates one flow at a time, then aggregates compatible
snapshots.

The skill is "fat" because it owns the complete judgment process, quality bar,
tool sequence, evidence rules, improvement loop, and stop conditions. Fat does
not mean context-heavy.

## Future scoring authorities

Implementation will add:

- `docs/product-design-playbook/SCORING.md` as the canonical human-readable
  judgment rubric, evidence protocol, and golden-anchor index.
- `.agents/skills/product-design-playbook/scripts/score-contract.ts` as the
  canonical closed IDs, schema version, enum sets, formula constants, and exact
  arithmetic contract.
- `.agents/skills/product-design-playbook/scripts/score-product-design.mts` as
  the command that validates inputs and calculates outputs from that contract.

`SKILL.md` points to those authorities instead of restating them. Formula or
enum changes begin in `score-contract.ts`, require a schema version bump, and
update the human rubric and tests in the same change.

## Scoring unit

Score user flows and meaningful sections first.

Strategy scores aggregate the flows that support that strategy. Whole-app
scores aggregate audited flows. Individual screens and components may be cited
as evidence, but they are not the default scoring unit because plays usually
operate across moments and transitions.

## Applicability and leverage

Every candidate play receives exactly one applicability classification for the
current scope:

- `not_applicable`: excluded from the denominator, with a short reason.
- `core`: essential to the flow's goal, weight `3`.
- `supporting`: materially improves the core journey, weight `2`.
- `polish`: adds useful refinement after the core works, weight `1`.

The same play can have a different tier in another flow. Time to Value may be
core in onboarding, supporting in a settings journey, and not applicable on a
static legal page.

The agent makes this contextual judgment. Deterministic code validates the
closed values and the required rationale.

If no candidate play is applicable after classification, the flow is
`unscorable`. The scorer returns no numeric maturity and requires the auditor
to revisit the strategy selection or explain why the playbook does not fit the
scope. It never divides by zero and never converts an empty set into zero.

## Per-play rating

Every applicable play receives one anchored rating:

- `0`: absent or counterproductive.
- `1`: materially weak.
- `2`: partial or inconsistent.
- `3`: strong.
- `4`: exemplary.

A counterproductive implementation receives rating `0`, `harm: true`, and a
required harm explanation. `harm: true` is invalid with any other rating. A
rating `0` caused by simple absence uses `harm: false`; its implementation
reference may point to the expected insertion location instead of a present
implementation.

Harm creates a highest-priority playbook finding. It does not automatically
change Homa readiness unless an existing Homa gate also identifies a blocker.
The flag keeps urgency visible rather than hiding it inside arithmetic.

Every rating cites:

- The relevant playbook page or module.
- The implementation location.
- The rendered or behavioral evidence available.
- The concrete reason the anchor applies.

## Flow coherence

Rate the whole flow's coherence using the closed set `0`, `0.25`, `0.5`,
`0.75`, or `1`.

Coherence asks whether:

- The chosen plays form one understandable journey.
- Companion plays reinforce one another.
- Conflicting plays are resolved deliberately.
- Important non-happy-path states are handled.
- The flow has a clear next move.
- The amount of intervention remains appropriate for the user and moment.

Anchor guidance:

- `0`: contradictory, fragmented, or materially broken.
- `0.25`: several moments work, but the flow has major gaps or conflicts.
- `0.5`: workable but uneven.
- `0.75`: coherent and strong.
- `1`: intentionally connected, resilient, and unusually clear.

## Flow maturity formula

For applicable play `i`:

- `wᵢ` is the leverage weight `1`, `2`, or `3`.
- `rᵢ` is the execution rating `0` through `4`.

```text
Play execution = Σ(wᵢ × rᵢ) ÷ Σ(wᵢ × 4)

Flow maturity = round(
  100 × (
    0.85 × Play execution
    + 0.15 × Flow coherence
  )
)
```

The score ranges from 0 to 100.

The scorer uses exact integer and rational arithmetic and stores every
maturity value in basis points from `0` to `10000`. It computes the formula
directly as one rational expression, then rounds once to the nearest basis
point, with an exact half rounded upward. It does not round Play execution as
an intermediate value.

The displayed maturity is the basis-point value divided by `100`, rounded to
the nearest integer with an exact half rounded upward. Portfolio, strategy,
and estimated-delta calculations consume stored basis points, never displayed
integers. They also round once to basis points and then once for display.

The `0.85` execution share, `0.15` coherence share, and leverage weights are
versioned scoring-policy constants. Changing any of them requires a score
schema version bump. Play-specific calibration comes from each play's source
guidance plus accepted golden audits, beginning with native onboarding.

## Evidence companion signal

Evidence remains outside the maturity number. Levels are cumulative:

- `E0`: assumption or unsupported claim.
- `E1`: source code or static specification inspected.
- `E2`: every required representative state has rendered evidence.
- `E3`: every critical transition and required variant was exercised, in
  addition to E2.
- `E4`: valid user research or production outcome evidence exists, in
  addition to E3.

A final audit should reach at least `E3`. Lower evidence levels remain useful
for planning but must be labeled provisional and cannot enter a strategy or
whole-app rollup.

The flow-level evidence grade is the highest cumulative level for which all
required artifacts exist. One strong artifact cannot raise the flow above a
missing required state.

Evidence strength cannot be inferred from file presence. It must name the
artifact, environment, state, and date.

The accepted flow inventory is the enforceable evidence manifest. Every
required state, transition, and variant has a stable ID and declares the
artifact types needed for E2 and E3. The scorer verifies complete ID coverage.

An E4 record additionally requires:

- E3 completion.
- Evidence source type `user_research` or `production_metric`.
- Population and sample size.
- Collection and comparison windows.
- Consent or approved aggregate-data basis.
- Repository path or immutable captured artifact with SHA-256.
- Named reviewer acceptance.

The scorer validates this structure. It does not decide whether a research
method was substantively good; the audit rationale and reviewer own that
judgment.

## Outcome companion signal

Outcome also remains outside the maturity number:

- `unknown`
- `declining`
- `flat`
- `improving`
- `target_met`

Each target metric declares its expected direction, baseline window,
comparison window, minimum sample, flat tolerance, and optional target.
Deterministic code assigns:

- `unknown` when instrumentation, sample, or window requirements are not met.
- `target_met` when the declared target is reached.
- `improving` when change exceeds the flat tolerance in the expected
  direction.
- `declining` when change exceeds the flat tolerance in the opposite
  direction.
- `flat` when absolute change stays inside the tolerance.

An `unknown` outcome still names the intended metric and the exact missing
requirement. A design score cannot manufacture an outcome signal when
instrumentation or sufficient data is absent.

Outcome is a vector of per-metric signals, not one blended flow, strategy, or
app status. Reports show every declared primary metric first, then secondary
metrics. They do not average unlike units or collapse mixed results into one
word.

Each metric record includes:

- Stable metric ID and authority path.
- Role `primary` or `secondary`.
- Unit.
- Expected direction `increase` or `decrease`.
- Baseline and comparison values.
- Baseline and comparison start and end timestamps.
- Baseline and comparison sample sizes.
- Minimum sample.
- Flat tolerance in the metric's unit.
- Optional target value and comparison operator.
- Instrumentation source and query or artifact.

Per metric, evaluation order is exact: return `unknown` first when data
requirements fail; otherwise return `target_met` when the target comparison
passes; otherwise compare change with the flat tolerance to return
`improving`, `declining`, or `flat`.

Portfolio views preserve these per-metric records. They do not synthesize an
app-wide outcome signal.

## Flow importance

Each flow receives three founder-reviewable values from `1` to `3`:

- User value.
- Usage frequency.
- Product or user risk.

```text
Flow importance = (2 × user value) + usage frequency + (2 × risk)
```

Value and risk receive greater weight than frequency. The model proposes the
values with rationale. A human may override them before a portfolio score is
accepted.

Use these anchors:

- User value `1`: convenience; `2`: meaningful supporting outcome; `3`: core
  product promise.
- Frequency `1`: occasional or minority path; `2`: recurring path; `3`: used
  by most target users or used repeatedly in the core rhythm.
- Risk `1`: low-stakes and readily reversible; `2`: meaningful frustration,
  data, or commercial consequence; `3`: safety, privacy, payment, account
  access, irreversible action, or core trust.

Each proposal names the target population and expected usage window. An
override records the approver, timestamp, previous value, new value, and
reason.

## Whole-app formula

Before aggregation, create a versioned flow inventory with mutually exclusive
scope IDs, boundaries, importance values, and critical-flow designations. The
model proposes the inventory. The founder or delegated product owner accepts
it. The scorer reads the accepted inventory and cannot invent or change
critical status.

A flow inventory lives under
`artifacts/product-design-audits/inventories/<inventory-id>-v<integer>.json`.
It lists authorized approver IDs. Acceptance records `accepted_by`,
`accepted_at`, and a repository-local decision reference or GitHub URL. The
scorer validates that the approver ID appears in the inventory allowlist; it
does not authenticate the human.

Adding, removing, splitting, merging, re-bounding, reweighting, or changing the
critical status of a flow requires a new integer inventory version. Old
snapshots remain attached to their original inventory version.

A flow is critical when failure prevents access to a core promise, first
value, payment, core use, recovery, or a safety-sensitive action. A whole-app
inventory must contain at least one critical flow.

The inventory also defines, per flow:

- Required states, transitions, and variants.
- Primary and secondary strategy mappings.
- Applicable external Homa gate IDs and owners.
- Target audience and product channel.
- Authorized approver IDs.

For flow `j`:

- `Iⱼ` is flow importance.
- `Mⱼ` is stored flow maturity in basis points.

```text
Weighted app average = Σ(Iⱼ × Mⱼ) ÷ Σ(Iⱼ)

App maturity = min(
  weighted app average,
  lowest critical-flow maturity
)
```

The critical-flow ceiling prevents polished secondary surfaces from hiding a
weak signup, first-value, payment, core-use, or recovery journey.

The report must show both the weighted average and the critical ceiling so the
reader can see what constrained the headline.

Only accepted snapshots at `E3` or `E4` enter the rollup. Unaudited and
provisional flows are reported as coverage gaps and are not silently assigned
a score.

```text
Coverage =
  Σ(importance of eligible audited flows)
  ÷ Σ(importance of all inventory flows)
```

A report may use the label `whole-app maturity` only when every declared
critical flow has an eligible audit and coverage is at least `80%`. Otherwise
it is a `portfolio preview`: show coverage and any partial weighted average,
but do not publish a headline app maturity.

No audited flows, no critical flows, overlapping flow boundaries, or an empty
inventory produce no portfolio score.

The displayed weighted average and app maturity use the basis-point rounding
contract defined above. The critical ceiling uses the lowest stored
critical-flow basis-point value.

## Strategy aggregation

Each flow declares exactly one primary strategy and zero or more secondary
strategies from the selected strategy set. Primary strategy relevance has
weight `2`; secondary relevance has weight `1`.

```text
Strategy score =
  Σ(flow importance × strategy relevance × flow maturity basis points)
  ÷ Σ(flow importance × strategy relevance)
```

A flow may contribute to multiple strategy views, but it appears only once in
the whole-app formula. Strategy views use only eligible `E3` or `E4`
snapshots, show their own coverage, and publish no numeric score when no
eligible flow maps to the strategy.

For strategy `s`:

```text
Strategy coverage =
  Σ(importance × relevance for eligible audited flows mapped to s)
  ÷ Σ(importance × relevance for all inventory flows mapped to s)
```

A strategy headline requires every critical flow mapped to that strategy and
at least `80%` strategy coverage. Otherwise the report labels it a strategy
preview.

## Snapshot compatibility

Portfolio aggregation accepts only snapshots that share:

- The exact full score schema version.
- Flow inventory version.
- Product channel and target audience declared by that inventory.
- Non-overlapping scope IDs.
- The latest accepted snapshot for each flow.

Each snapshot records the repository commit and content hashes for its owned
implementation and local evidence files. A snapshot becomes stale and
ineligible when an owned file changes or an evidence hash no longer matches.
Older incompatible snapshots remain readable historical evidence but are not
silently migrated or combined.

A snapshot enters aggregation only when its status is `accepted`, its evidence
is E3 or E4, its hashes are current, and its `accepted_by` ID appears in the
flow inventory's approver allowlist. Acceptance records the timestamp and
decision reference. Accepted means the judgment is approved for aggregation;
it does not mean Homa readiness is `ready`.

## Readiness

Readiness is separate from score:

```text
74/100 maturity · E3 evidence · improving · Homa readiness blocked
```

The readiness field names every blocking gate and its owner. A blocker cannot
be averaged away.

Readiness uses the closed states `not_checked`, `ready`, or `blocked`.
`not_checked` is provisional. `ready` requires every applicable external gate
to name its owner, evidence, and passing result. `blocked` names at least one
failed gate and owner.

The model identifies applicable gates and invokes their existing authorities.
Those authorities determine their own pass or fail result. The scorer validates
the readiness record but never reimplements policy. A failed gate does not
erase the source-neutral score; it blocks a ready claim and may block
implementation until the approved work addresses it.

The flow inventory's gate manifest is enforceable. Each gate has a stable ID,
owner path, required result artifact, and applicability reason. `ready` is
invalid unless every gate ID has a passing result. `blocked` is invalid unless
at least one gate ID has a failed result. New or removed gate requirements
require an inventory version bump.

## Estimated improvement

A proposed improvement may show:

- Current verified rating.
- Proposed target rating.
- Estimated maturity delta if the target is achieved.
- Evidence required to verify the target.

The estimate never replaces the baseline. Only implemented and verified
evidence creates a new dated score snapshot.

An estimate clones the current accepted score input. It may propose changes to
applicability, leverage tier, execution rating, harm, and coherence when the
change description explains why. Flow importance, evidence level, outcome,
critical status, and readiness remain unchanged in the estimate. The
structured prediction stores before and proposed values, rationale, affected
files, and required verification evidence.

## Deterministic scorer

The skill will include a narrow deterministic scorer. Its exact implementation
location will be:

`/.agents/skills/product-design-playbook/scripts/score-product-design.mts`

The model decides:

- Flow boundary.
- Strategy selection.
- Play applicability.
- Leverage tier.
- Execution rating.
- Harm flag.
- Coherence.
- Flow importance.
- Evidence interpretation.
- Outcome interpretation.

The scorer decides:

- Whether strategy and play IDs exist.
- Whether every enum and number is in range.
- Whether applicable ratings include rationales and evidence references.
- Whether cited local evidence paths exist.
- Whether all formulas are calculated exactly.
- Whether critical-flow aggregation follows the contract.
- Whether snapshots use a compatible schema version.
- Whether every not-applicable record has a reason.
- Whether coherence and importance values have rationales.
- Whether harm records have valid rating combinations and explanations.
- Whether source citations use registered strategy and play locations.
- Whether implementation and evidence references use safe paths.
- Whether evidence metadata and outcome fields satisfy their selected states.
- Whether readiness blockers name owners and evidence.

The scorer must not use keyword matching or other lexical heuristics to decide
what a design means.

## Durable audit output

Save each completed audit under:

`artifacts/product-design-audits/YYYY-MM-DDTHHMMSSZ-<scope>-<run-id>/`

Each snapshot contains:

- `audit.md`: human-readable scope, findings, score explanation, evidence,
  blockers, and prioritized improvements.
- `score.json`: versioned structured input and exact calculated output.
- Evidence files or links required to reproduce the judgment.

Snapshots are immutable evidence. A re-score creates a new dated snapshot.

The run ID is a generated UUID. Local evidence is copied into the snapshot or
recorded with a content hash. Every path must remain inside the repository and
pass path-safety validation. Captures use synthetic or designated demo data,
never real family data. The audit records the redaction check.

Path and evidence validation is exact:

- Store repository-relative POSIX paths only.
- Reject absolute paths, `..` segments, NUL bytes, and paths outside the
  repository after `realpath` resolution.
- Reject symlinks for copied evidence and hash the final regular file with
  SHA-256.
- Allow evidence file types declared by the score contract, initially Markdown,
  JSON, TXT, PNG, JPEG, WEBP, and MP4.
- Treat external URLs as references only. A URL cannot satisfy immutable
  evidence unless its reviewed content is captured locally and hashed.
- Reject files under secret-bearing or restricted path classes defined by
  `AGENTS.md`.

Every capture declares `data_classification` as `synthetic` or
`designated_demo`, the fixture ID, and `real_family_data: false`. Missing or
different values fail validation. The operator records a manual redaction
reviewer and timestamp. Deterministic checks backstop path and metadata safety;
they do not pretend to semantically prove that pixels contain no identifying
information.

Unfinished fixes are tracked in GitHub Issues with one type and one priority,
linked back to the audit. An audit document is not a work tracker.

## Structured score input

The eventual versioned schema must include:

- Schema version.
- Audit date.
- Scope ID and title.
- Flow boundary.
- Target users and devices.
- Strategy IDs.
- Candidate play IDs and the strategy or pair route that introduced each.
- Named target metrics.
- Critical-flow boolean.
- User value, frequency, and risk values with rationale.
- Applicable and not-applicable play records.
- Per-play tier, rating, harm flag, rationale, source citation, and evidence.
- Flow coherence value and rationale.
- Evidence level and artifacts.
- Per-metric outcome records, raw values, units, samples, windows, thresholds,
  source, and calculated state.
- Homa readiness status and named blockers.
- Repository commit, owned-file hashes, flow inventory version, and run ID.
- Evidence paths, hashes, environment, device, operating-system version,
  state, timestamp, and redaction result.
- Any human overrides with actor, time, old value, new value, and reason.

The output adds calculated play execution, flow maturity, and any portfolio
rollup fields.

Stable strategy and play IDs use the lowercase slugs already established by
the archive filenames, such as `onboarding`, `time-to-value`, and
`progressive-disclosure`. Dates and timestamps use ISO 8601 UTC. Optional
values are explicitly nullable, not omitted conditionally.

Schema compatibility requires an exact full version match. There is no
implicit migration. A future migration command must create a new snapshot and
preserve the original.

## Improvement workflow

1. Define the real user, flow boundary, goal, and named outcome metrics.
2. Inventory the route, transitions, states, and existing Homa gates.
3. Capture actual evidence at the required devices and states.
4. Load the framework, relevant strategies, and candidate plays.
5. Produce structured ratings with source and implementation citations.
6. Run the deterministic scorer.
7. Identify the smallest high-leverage improvement set.
8. Save the dated baseline.
9. Present proposed changes and wait for approval.
10. Route approved work through existing Homa authorities.
11. Implement within the approved scope.
12. Re-capture evidence and run relevant product checks.
13. Create a new dated score snapshot.
14. Compare verified before and after results.
15. File or update GitHub Issues for unfinished work.

## Stop conditions

Stop and report honestly when:

- The flow boundary cannot be established from code or product authority.
- Required screens or states cannot be rendered.
- Evidence contains real family data.
- The target outcome lacks instrumentation or a sufficient time window.
- A policy decision is required.
- A critical Homa gate fails.
- The requested implementation exceeds the approved change set.
- Source guidance conflicts with a later Homa authority.

The skill may still produce a provisional audit when evidence is incomplete,
but it must name the gap and must not claim a final score.

These stops are scoped:

- Missing outcome instrumentation stops outcome classification above
  `unknown`; it does not stop a design audit.
- Missing rendered or exercised states stops evidence at E0-E2 and prevents
  portfolio eligibility; it does not prevent a provisional score.
- A policy decision or failed Homa gate stops a ready claim and may stop
  implementation; it does not erase the source-neutral audit.
- Real family data stops capture and audit processing immediately.

## Native onboarding pilot

The first golden case is the real native onboarding journey.

### Boundary

Include:

- `apps/mobile/src/features/onboarding/onboarding-gate.tsx`
- `apps/mobile/src/app/(onboarding)/hello.tsx`
- `apps/mobile/src/app/(onboarding)/intent.tsx`
- `apps/mobile/src/app/(onboarding)/kids.tsx`
- `apps/mobile/src/app/(onboarding)/making.tsx`
- `apps/mobile/src/app/(onboarding)/reveal.tsx`
- `apps/mobile/src/app/(onboarding)/next.tsx`

Post-onboarding product surfaces remain outside the first scorecard.

The default golden case starts after an authenticated session reaches
`OnboardingGate`. Authentication joins the scope only for an explicitly named
account-creation-to-first-value audit, which creates a different flow ID and
baseline.

The three default handoffs are:

- `/binder`
- `/chat?planIntent=week`
- `/`, the current app-root handoff

Handoff inspection stops when the destination route reaches its first stable,
interactive state or a truthful error state. Destination behavior after that
point belongs to a separate flow.

### Implemented sequence

The current code establishes this sequence:

```text
OnboardingGate
→ hello
→ intent
→ kids
→ making
→ reveal
→ next
→ /binder, /chat?planIntent=week, or /
```

The kids route contains name, age, love, and working substeps and can loop to
add another child.

### States the pilot must inspect

- Bootstrap loading and fail-open behavior.
- Web-born skip.
- Durable resume.
- Greeting-name loading.
- Intent saving.
- Kids hydration, saving, validation, and errors.
- Back navigation and multiple-child loops.
- Making start, build, polling, checklist, completion, failure, and early exit.
- Reveal retries, waiting, printing, print failure, and print skip.
- Final-door choosing and disabled states.
- Reduced Motion and accessibility semantics.
- Handoff into all three exit doors.

Every state case in the golden evidence manifest must declare:

- Synthetic fixture and starting durable state.
- Device, operating-system version, appearance, text size, and motion setting.
- User action or system trigger.
- Expected route and visible state.
- Expected persisted onboarding step or completion state.
- Expected emitted event, or an explicit statement that none is expected.
- Required screenshot, recording, accessibility output, or log evidence.

Use the current contract-owned simulator profile plus one supported physical
iPhone for device-only VoiceOver and interruption checks. Record the exact
device and OS in the snapshot rather than hard-coding a model into the skill.
The accessibility acceptance manifest defines required settings and remains
the authority for blocked evidence.

The default meaning of selected states is:

- `web-born skip`: bootstrap identifies a web-created world and the gate
  reaches the app without entering the native walk.
- `fail-open`: a bootstrap error permits app entry, does not cache successful
  onboarding, and remains retryable on a later session.
- `durable resume`: a saved onboarding step and answers survive process
  termination and return the user to the matching route without wiping input.
- `early exit`: the making screen marks the walk complete and enters the app
  without claiming the normal final-door event.
- `handoff`: the selected destination renders its first stable state and back
  navigation does not accidentally restart the walk.

### Existing evidence and gaps

The implementation emits:

- `mobile_onboarding.step_reached`
- `mobile_onboarding.resumed`
- `mobile_onboarding.completed`
- `materials.print_result`

The completion event currently fires from the final `next.tsx` choice, not the
making-screen early exit. The repository plan also names events that are not
currently wired. These are pilot evidence gaps, not assumptions the score may
silently fill.

The accessibility acceptance manifest marks the `native-first-family-win`
journey blocked pending evidence. The first score is therefore provisional
until simulator and required physical-device evidence exist.

### Pilot outcome metrics

The metric authority is
`docs/homa-planning/plans/2026-08-18-mobile-onboarding-v1-plan.md` under its
`## Score` section.

Use the approved mobile onboarding plan's primary metrics:

- Signed-in to `reveal_shown` rate.
- Median minutes from signed-in to `reveal_shown`, target under 6.

Use these secondary metrics:

- Print completion rate.
- Resume rate after abandonment.
- Children captured per family.
- Step-by-step drop-off.
- Final exit-door distribution.

The current implementation does not emit every event required by that metric
set. Until event coverage and completion semantics are reconciled, outcome is
`unknown`. In particular, the making-screen early exit marks onboarding
complete without emitting the normal `mobile_onboarding.completed` event. The
pilot must record that distinction rather than treating both paths as the same
measured completion.

Each pilot metric keeps its own outcome signal. The two approved primary
metrics are both shown and are not blended. Metric units are percentage points
for reveal rate and minutes for time to reveal. Secondary metric units are
declared individually in the pilot flow inventory.

### Likely source modules

The pilot should begin with the Onboarding and Activation strategies, then
evaluate candidate plays including:

- Time to Value.
- Setup Defaults.
- Progressive Disclosure.
- Personalisation.
- Loading Feedback.
- Success Moments.
- Permission Serve where a real permission appears.
- Momentum Bias.
- Empty States.
- JTBD Copywriting.
- Pattern Alignment.
- Micro Interactions.
- Fail Safe for recovery and exits.

This is a candidate set, not a predetermined applicability judgment. The audit
must inspect the rendered flow before classifying plays.

## Testing the future skill

### Routing

Add positive fixtures for:

- Designing a new onboarding flow.
- Diagnosing weak activation.
- Auditing native onboarding.
- Scoring a progress journey.
- Improving a material-generation flow.
- Producing a whole-app score.

Add adversarial negative fixtures for:

- Changing a token value.
- Fixing a database query.
- Editing one sentence.
- Running an accessibility-only check.
- Refactoring an internal helper with no user-journey change.

### Scorer

Test:

- All closed strategy and play IDs.
- Candidate-universe completeness and pair-route provenance.
- One-hop pair expansion, duplicate provenance, and cycle resistance.
- Every applicability and evidence enum.
- Rating and coherence boundaries.
- Not-applicable denominator exclusion.
- Core, supporting, and polish weights.
- Harm flags.
- Empty applicable sets.
- Empty, overlapping, and critical-free flow inventories.
- Missing rationales and evidence.
- Exact flow formula.
- Exact half-up rounding and stored basis-point portfolio inputs.
- Basis-point arithmetic for flow, strategy, app, and estimated deltas.
- Exact importance formula.
- Critical-flow ceiling.
- Whole-app 80% coverage eligibility.
- Strategy aggregation and multi-strategy flow mapping.
- Mixed schema versions.
- Inventory version bumps and approver allowlists.
- Stale owned-file or evidence hashes.
- Unsafe paths and same-day run uniqueness.
- Evidence-level cumulative requirements.
- State, transition, variant, E4, and readiness manifest completeness.
- Outcome threshold and insufficient-sample behavior.
- Multiple outcome metrics with unlike units and no synthetic aggregate.
- Readiness record validation without policy reimplementation.
- Predicted versus verified snapshots.

### Behavioral quality

Use the native onboarding pilot to test whether a fresh agent:

- Scopes the whole coherent journey rather than one attractive screen.
- Loads only relevant source modules.
- Finds non-happy-path states.
- Separates source score from Homa readiness.
- Refuses to invent analytics outcomes.
- Produces prioritized changes rather than a 33-play wish list.
- Routes approved changes to existing Homa authorities.
- Re-scores only after new evidence exists.

## Non-goals for the first version

- Building a database-backed score dashboard.
- Automatically scoring every repository route.
- Replacing user research or analytics.
- Turning all 33 plays into mandatory requirements.
- Copying the PDF archive into the skill.
- Creating a new Homa visual system.
- Letting a numeric score override a hard product law.
- Automatically implementing changes without approval.
- Treating predicted score movement as achieved impact.

## Implementation status

Implemented in:

- `.agents/skills/product-design-playbook/SKILL.md`
- `.agents/skills/product-design-playbook/scripts/`
- `docs/product-design-playbook/SCORING.md`
- `pnpm check:product-design-playbook`
- `.github/workflows/ci.yml`

The skill was tested against baseline agents without its guidance, the same
scenarios with the skill loaded, and the actual native onboarding golden
boundary. Deterministic tests cover scoring, catalog provenance, evidence,
outcomes, readiness, path safety, inventory eligibility, and estimates.

No native onboarding product behavior was changed by this implementation.
