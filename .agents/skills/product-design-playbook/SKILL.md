---
name: product-design-playbook
description: Use when designing or materially changing a Homa user journey, diagnosing onboarding, activation, retention, engagement, conversion, trust, or monetisation metrics, auditing or scoring a rendered flow, section, strategy, or the whole app, or prioritizing coordinated product-design improvements. Not for routine styling, copy-only edits, backend or domain work, or accessibility and design-system checks that do not change a journey.
---

# Product Design Playbook

## Overview

Treat the playbook as a graph from product goal to strategy, candidate plays,
implementation, and measured outcome. Reward the right plays used well, never
the number of plays present.

This skill owns product-design strategy and audit judgment. It does not replace
Homa's design, copy, accessibility, privacy, billing, safety, or tenancy
authorities.

## Load the source progressively

Always read:

1. `docs/product-design-playbook/FRAMEWORK.md`
2. `docs/product-design-playbook/SCORING.md`

Then use `docs/product-design-playbook/INDEX.md` to open only:

- The relevant strategy modules under `strategies/`.
- The candidate play modules under `plays/`.
- Full-page screenshots when extracted text loses visual meaning.

Do not load all 33 plays for a normal flow task. The archive is canonical; do
not copy its rules into this skill.

## Choose one mode

- **Diagnose:** investigate a weak metric or observed user problem before
  choosing interventions.
- **Design:** define a new or materially changed flow and select a coherent
  play combination.
- **Audit:** score one implemented flow or meaningful section.
- **Improve:** propose, approve, implement, verify, and re-score a small change
  set.
- **Portfolio:** aggregate accepted flow snapshots into strategy and app views.

Say which mode is active and name the flow boundary before analysis.

## Core workflow

1. Name the target user, device or channel, start state, stop state, primary
   strategy, and outcome metrics.
2. Inspect the product authority, implementation, transitions, and important
   loading, empty, error, interruption, recovery, and completion states.
3. Build or read the versioned flow inventory. For portfolio mode, establish
   non-overlapping flow IDs, importance, critical status, strategy mappings,
   required evidence, and readiness gates before scoring.
4. Capture rendered and behavioral evidence with synthetic or designated demo
   data. Never use real family data.
5. Select strategies, take the union of their play stacks, and explicitly add
   any one-hop companion plays.
6. Give every candidate exactly one applicability record with provenance and
   rationale. Do not create placeholder records for the rest of the catalog.
7. Rate applicable plays and flow coherence using `SCORING.md`. Cite the
   source module, implementation, and evidence for every rating.
8. Write a structured score input and run the deterministic scorer. Never
   calculate or revise the formula manually.
9. Report maturity, evidence, per-metric outcomes, readiness, harm findings,
   scope gaps, and the smallest prioritized improvements as separate truths.
10. Save accepted audits as dated Markdown, JSON, and hashed evidence. A
    re-score creates a new snapshot.

## Deterministic scoring

Run:

```sh
pnpm exec tsx \
  .agents/skills/product-design-playbook/scripts/score-product-design.mts \
  <score-input.json>
```

The model decides scope, strategy, applicability, leverage, ratings,
coherence, evidence interpretation, and importance. The scorer verifies closed
IDs, record completeness, legal values, exact arithmetic, evidence eligibility,
coverage, and critical-flow constraints.

Use command mode `audit` for a real flow audit so evidence, outcomes,
readiness, acceptance, data classification, and current file hashes are
validated with maturity. Use `estimate` to compare compatible current and
proposed judgments from a hashed, accepted E3 or E4 baseline audit without
changing evidence or claiming impact. Accepted baseline and portfolio
authority files must match their committed Git bytes. Mode `flow` is the
low-level arithmetic interface for tests and drafting only.

If the scorer rejects an input, fix the judgment record. Do not bypass or
reimplement the formula.

## Diagnose mode

Start with the relevant strategy's "Behind the Data" questions. An aggregate
metric is a location to investigate, not a cause.

- Separate observed facts from hypotheses.
- Check denominator, cohort, device, version, step, and timing changes.
- Do not invent experiment thresholds or causal explanations.
- Name missing instrumentation and leave outcomes `unknown`.

## Design mode

Produce:

- Flow boundary and state inventory.
- Primary and secondary strategies.
- Core, supporting, polish, and not-applicable plays.
- Explicit conflicts and companion routes.
- Target metrics and evidence plan.
- Homa authorities that own implementation details.

The output is a journey, not a 33-play wish list.

## Audit mode

Code-only evidence is E1 and provisional. Screenshots without exercised
transitions cannot exceed E2. A final flow audit requires E3.

Do not call a score whole-app unless every critical flow is eligible and
importance-weighted coverage is at least 80%. Otherwise label it a portfolio
preview.

## Improve mode

1. Save the verified baseline.
2. Propose the smallest high-leverage change set and estimated maturity delta.
3. Wait for user approval.
4. Route exact work through the existing owners:
   - `homa-design` for visual, state, motion, channel, and accessibility work.
   - `homa-uxui-reviewer` for the independent user reaction.
   - `homa-copy-writer`, then its reader and editor gates, for important copy.
5. Implement only the approved set.
6. Re-capture evidence, run the scorer, and save a new verified snapshot.

An estimated delta is not achieved impact.

## Portfolio mode

Use accepted, current E3 or E4 snapshots with the exact same schema and
inventory version. Exclude provisional, stale, incompatible, and overlapping
flows.

The portfolio command accepts hashed repository paths to accepted audit input
files, not caller-authored score snapshots. It re-runs each audit, verifies
owned and evidence hashes, and binds evidence, readiness, metrics, scope keys,
and strategy roles to the accepted inventory before aggregation.

Show:

- Eligible coverage.
- Partial weighted average when useful.
- Lowest critical-flow maturity.
- Strategy previews or scores.
- Whole-app maturity only when the eligibility gate passes.

Never lower maturity because outcomes are unknown. Never raise maturity because
instrumentation exists.

## Homa readiness

Keep the playbook score source-neutral and readiness separate:

`74/100 maturity · E3 evidence · outcomes unknown · readiness blocked`

A failed Homa gate blocks a ready claim even when the playbook execution is
excellent. Invoke the owning skill or check; do not reproduce its rules here.

## Golden flow

Use native onboarding as the first calibration anchor:

`OnboardingGate → hello → intent → kids → making → reveal → next`

Read the "Native onboarding pilot" section in
`docs/homa-planning/plans/2026-08-24-product-design-playbook-skill-design.md`.
Inspect resume, save, loading, checklist, failure, early exit, print, Reduced
Motion, and all three handoffs. Current instrumentation gaps keep outcomes
unknown until repaired and measured.

## Stop conditions

Stop the affected part of the workflow when:

- The flow boundary or product authority is unresolved.
- Required evidence cannot be captured.
- Evidence contains real family data.
- A founder decision or failed Homa gate blocks implementation.
- The scorer returns unscorable or rejects the input.
- The requested implementation exceeds the approved change set.

Produce a provisional audit when only evidence or outcomes are incomplete.
Name the exact gap and never imply finality.
