# Product Design Playbook scoring contract

This is the canonical human-readable rubric for Homa product-design audits.
Exact IDs, constants, validation, and arithmetic live in
`.agents/skills/product-design-playbook/scripts/score-contract.ts`.

The score measures how well the applicable playbook tactics form one coherent
flow. It does not measure how many of the 33 plays appear.

## Contents

- Required audit frame
- Candidate play universe
- Applicability and leverage
- Per-play rating
- Coherence and flow formula
- Evidence, outcomes, and Homa readiness
- Improvement estimates
- Flow importance and whole-app eligibility
- Durable output
- Golden anchor
- Common failures

## Required audit frame

Define before scoring:

- One user or audience.
- One flow or meaningful section with explicit start and stop points.
- One primary strategy and any secondary strategies.
- Named outcome metrics.
- Required states, transitions, and variants.
- Available implementation and rendered evidence.
- Applicable Homa readiness gates.

A screen may be evidence. The default scoring unit is the whole user flow.

## Candidate play universe

1. Read `FRAMEWORK.md`.
2. Select one or more relevant strategy modules from `strategies/`.
3. Take the union of their play stacks.
4. Add a companion play only through an explicit one-hop "Pair with" choice.
5. Record every unique strategy and pair provenance route.
6. Classify every candidate. Do not create records for the rest of the catalog.

Pair traversal never recurses automatically.

## Applicability and leverage

Use exactly one classification per candidate:

- `not_applicable`: does not belong in this user moment. Exclude it from the
  denominator and explain why.
- `core`: essential to the flow's outcome. Weight `3`.
- `supporting`: materially strengthens the core journey. Weight `2`.
- `polish`: useful refinement after the core works. Weight `1`.

The same play may carry a different classification in another flow.

If no candidate is applicable, return `unscorable`. Revisit strategy selection
instead of assigning zero.

## Per-play rating

Rate each applicable play from `0` to `4`:

- `0`: absent or counterproductive.
- `1`: materially weak.
- `2`: partial or inconsistent.
- `3`: strong.
- `4`: exemplary.

Judge against the play's complete source module:

- What it is.
- Why and when it works.
- Positive guidance.
- Misuses to avoid.
- Adaptation prompts.
- Visual examples.

Every rating needs:

- Playbook source reference.
- Implementation reference or expected insertion location.
- Evidence reference.
- One concrete reason for the anchor.

Use `owned:<repository-path>` for implementation evidence and
`artifact:<evidence-id>` for rendered or behavioral evidence. Every owned path
must appear in the audit's current SHA-256 file manifest. Every artifact ID
must resolve to a hashed evidence record.

Counterproductive execution uses `rating: 0`, `harm: true`, and a harm
explanation. Simple absence uses `rating: 0`, `harm: false`.

## Coherence

Use exactly `0`, `0.25`, `0.5`, `0.75`, or `1`.

- `0`: contradictory, fragmented, or materially broken.
- `0.25`: some moments work, with major gaps or conflicts.
- `0.5`: workable but uneven.
- `0.75`: coherent and strong.
- `1`: intentionally connected, resilient, and unusually clear.

Check whether the selected plays reinforce one another, important states work,
and the journey ends in one clear next move.

## Flow formula

For applicable play `i`:

- `wᵢ` is leverage weight `1`, `2`, or `3`.
- `rᵢ` is rating `0` through `4`.

```text
Play execution = Σ(wᵢ × rᵢ) ÷ Σ(wᵢ × 4)

Flow maturity = round(
  100 × (
    0.85 × Play execution
    + 0.15 × Flow coherence
  )
)
```

Never calculate this manually in a final audit. Write a score input document
and run:

```sh
pnpm exec tsx \
  .agents/skills/product-design-playbook/scripts/score-product-design.mts \
  <score-input.json>
```

The scorer stores basis points and rounds half upward. Do not substitute a
different formula, rating scale, or weight.

Use command mode `audit` for an actual audit. It validates the flow score
together with evidence manifests, per-metric outcomes, readiness gates,
acceptance, synthetic or demo data classification, and current SHA-256 file
hashes. Use `estimate` to compare compatible current and proposed judgments;
it requires a hashed, accepted E3 or E4 baseline audit file and the result
remains a prediction. Command mode `flow` exposes low-level arithmetic for
tests and draft calculation only.

## Evidence

Evidence is separate from maturity and cumulative:

- `E0`: assumption or unsupported claim.
- `E1`: implementation or specification inspected.
- `E2`: every required representative state rendered.
- `E3`: every critical transition and required variant exercised, plus E2.
- `E4`: valid user research or production outcome evidence, plus E3.

E0 through E2 are provisional. Only accepted, current E3 or E4 snapshots enter
strategy or portfolio scores.

An audit command never self-declares portfolio eligibility. Eligibility is
derived only when the file-backed portfolio command binds and re-verifies the
audit against an accepted inventory.

Use synthetic or designated demo data. Never capture real family data.

## Outcomes

Keep outcomes separate from maturity. Each metric declares:

- Unit and expected direction.
- Baseline and comparison values and windows.
- Sample sizes and minimum sample.
- Flat tolerance.
- Optional target and comparison operator.
- Instrumentation source.

The scorer classifies each metric as `unknown`, `declining`, `flat`,
`improving`, or `target_met`. Do not blend unlike metrics into one outcome.
Missing instrumentation uses null measurements, zero or known samples, and an
explicit `missingReason`; it produces `unknown`, not a guessed trend.

Targets support strict `lt` and `gt` plus inclusive `lte` and `gte`. Use `lt`
for wording such as "under 6 minutes."

Nondirectional distributions, such as exit-door share, are diagnostic evidence
rather than outcome metrics. Report them separately instead of forcing an
increase or decrease direction.

## Homa readiness

Readiness is independent of the source-neutral playbook score:

- `not_checked`
- `ready`
- `blocked`

Route exact checks to their owners:

- `homa-design` for Quiet authority, states, accessibility, motion, and channel
  evidence.
- `homa-uxui-reviewer` for a fresh user's one-pass reaction to real screens.
- `homa-copy-writer`, then its reader and editor gates, for important words.
- Existing policy, privacy, billing, safety, and tenancy authorities.

A high maturity score cannot offset a failed Homa gate.

## Improvement estimates

Show:

- Current verified rating.
- Proposed target rating.
- Estimated maturity delta.
- Files likely to change.
- Evidence needed to verify the target.

Keep importance, evidence, outcome, critical status, and readiness unchanged in
an estimate. Only a new implemented and verified snapshot replaces a baseline.

## Flow importance

Rate each from `1` to `3`:

- User value: convenience, meaningful supporting outcome, core promise.
- Frequency: occasional, recurring, used by most users or in the core rhythm.
- Risk: reversible low stakes, meaningful consequence, safety/privacy/payment
  or core trust.

```text
Flow importance = (2 × user value) + frequency + (2 × risk)
```

The model proposes these values. A founder or delegated product owner accepts
the versioned flow inventory.

## Whole-app eligibility

```text
Coverage =
  eligible audited flow importance
  ÷ total inventory flow importance

Weighted app average =
  Σ(flow importance × flow maturity)
  ÷ Σ(flow importance)

App maturity =
  min(weighted app average, lowest critical-flow maturity)
```

Publish `whole-app maturity` only when:

- Every declared critical flow has an accepted, current E3 or E4 audit.
- Eligible coverage is at least 80%.
- Flow boundaries do not overlap.
- Snapshots share the exact score schema and inventory version.

Otherwise publish a `portfolio preview` with coverage, never a headline app
score.

Portfolio command inputs contain an accepted inventory plus SHA-256 references
to repository audit files. The scorer reloads and re-runs each accepted E3 or
E4 audit, verifies its current owned and evidence hashes, and binds its scope
keys, strategies, evidence requirements, readiness gates, and metric IDs to the
inventory. Inventory, audit, and estimate-baseline authority files must match
their committed Git bytes. Inline caller-authored maturity snapshots are not a
portfolio input.

## Durable output

Save an accepted audit under:

`artifacts/product-design-audits/YYYY-MM-DDTHHMMSSZ-<scope>-<uuid>/`

Include:

- `audit.md`
- `score.json`
- Local, hashed evidence or immutable references

Use repository-relative safe paths. Record device, environment, state,
timestamp, fixture, data classification, and redaction review.

## Golden anchor

The first golden flow is native onboarding:

`OnboardingGate → hello → intent → kids → making → reveal → next`

Its default boundaries and evidence requirements are in
`docs/homa-planning/plans/2026-08-24-product-design-playbook-skill-design.md`
under "Native onboarding pilot."

The first audit remains provisional until required simulator and physical
device evidence exists. Current event gaps keep outcomes `unknown`; do not
silently reinterpret completion.

## Common failures

- Inventing a formula, weight, rating scale, or confidence percentage.
- Counting every play as desirable.
- Scoring one screen as the whole journey.
- Mixing Homa readiness or missing outcomes into maturity.
- Publishing a whole-app score below the coverage gate.
- Treating code, events, or file presence as user or production evidence.
- Recommending polish before fixing a core or harmful play.
