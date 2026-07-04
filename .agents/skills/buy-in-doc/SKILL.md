---
name: buy-in-doc
description: Package a finished feature (prototype, spec, implementation notes) into a single stakeholder-ready pitch that leads with a demo, pre-answers every reviewer objection with evidence, and names exactly who must sign off on what. Use when work is built and needs approval to ship, or when the user says "get buy-in", "write it up for Slack", "ship proposal", "pitch this", or asks to package work for stakeholders.
---

# Buy-in Doc

## Overview

Shipping means other people inheriting your unknowns. A buy-in doc removes the reviewers' unknowns before they become objections: it shows the thing working, answers the questions they were about to ask with pointers to evidence, and turns "looks interesting, let's discuss" into a named list of sign-offs with a date.

## Output shape

One self-contained HTML doc (droppable in Slack as a link or file), badged as a "90-second read". Sections in this order:

### 01 · Watch it work

Lead with the demo, always. An animated or looping walkthrough of the core flow (select, act, done), built from the prototype with realistic fake data. If animation is impossible, a stepped screenshot sequence. Nobody grants sign-off to a wall of text.

### 02 · The pitch

One paragraph: the user pain with its evidence ("the single most-cited gap in churn interviews, 41% of departed teams"), what the feature does in one sentence, why it is cheap or safe ("uses infrastructure we already run"), its current state ("built, flagged, load-tested"), and the ask ("the only thing between here and shipped is the four sign-offs below").

### 03 · What reviewers will ask

Pre-answer the 4 to 6 objections reviewers would raise, each as a question with a direct answer and a citation link into the spec, the implementation notes, or a metric. Cover the recurring five:

- **Leakage/permissions**: can this expose something it should not? Cite the resolver and the test count.
- **Scale**: what happens on the monster case? Cite the stress run against real production data.
- **Why this shape**: why files not an API, why now not later? Cite the demand evidence.
- **Operational cost**: what new infrastructure does this add? Best answer is "zero new services", cited.
- **Compliance/audit**: where do artifacts go, who can see them, when do they expire?

### 04 · Spec at a glance

A compact table: area, decision, spec-section reference. Formats, entry points, permissions, limits, telemetry events, flag ramp schedule.

### 05 · Risk, rollback, and the asks

- **Risk and rollback**: rollback cost ("one toggle, no schema migrations to unwind"), blast radius bound, the worst credible failure and why it is survivable, and known gaps stated honestly as phase-2 items.
- **What I need from you**: one card per approver with name, role, and the exact thing they are approving ("sign off on reusing the render worker pool, spec §5.1, the only shared-infra dependency"). Close with the mechanism and deadline ("reply with a check on your piece; target: ramp starts Monday").

## Quality bar

- Every claim carries evidence: a test count, a p95 number, a ticket tag analysis, a spec section. No adjectives doing load-bearing work.
- Name real people and scope each one's approval to their actual authority. A vague "please review" gets silence.
- State known gaps yourself. An omission a reviewer finds costs more than one you disclose.
- Keep it a 90-second read. Depth lives behind the citation links, not in the doc.

Source: Thariq Shihipar, "A Field Guide to Fable: Finding Your Unknowns", example 10 at thariqs.github.io/html-effectiveness/unknowns/.
