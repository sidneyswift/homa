---
name: implementation-notes
description: Keep a running log of every deviation from the plan while building, with the conservative call made at each fork, so unknowns discovered mid-implementation are captured instead of lost. Use when starting any long or multi-step build from a plan or spec, when executing autonomously for an extended stretch, or when the user asks to "keep notes", "log deviations", or wants to know what changed versus the plan.
---

# Implementation Notes

## Overview

No matter how much planning happens, unknowns lurk in the territory. During a long build, the code will contradict the plan several times. Without a log, those discoveries evaporate: the human cannot audit the judgment calls, and the next attempt rediscovers every surprise. The notes file turns deviations into a reviewable record and the next plan's head start.

## Setup

Create a notes file at the start of the build, before writing code. Default location: `docs/notes/<feature>-implementation.md` (follow the repo's existing convention if one exists). Add entries as work proceeds, each with a timestamp.

## Entry types

Tag every entry as one of four types:

- **Plan-confirmed**: a step landed as planned. One or two lines: what was built, where, matching what the plan said. These prove the plan was followed, not just abandoned quietly.
- **Discovery**: something learned that did not force a plan change but will trap the next person (a denormalized column that goes stale, an existing convention worth following). Note it and move on.
- **Deviation**: the code contradicted the plan. Use the four-part format below.
- **Todo for human**: a fork that is a product or policy call, not an engineering call. Log it, state the current conservative behavior, the size of the change if they decide otherwise, and whether it blocks merge or QA (prefer choices that block neither).

## The deviation format

Every deviation gets four parts:

1. **What the plan said**: the assumption, quoted or paraphrased
2. **What the code revealed**: the reality, with specifics (the percentage of rows affected, the serialization boundary, the file that already exists)
3. **Conservative choice**: the option taken, and why it is the safe one
4. **Revisit**: what a better fix might look like, left for a deliberate decision later

## Choosing the conservative option

When the territory contradicts the plan, do not stop and do not guess ambitiously. Pick the option that:

- Drops nothing silently (exclude from the main path, but keep the data in a sidecar with a flag)
- Takes the strictest defensible reading of permissions and policy
- Reuses existing tested machinery over adding dependencies
- Types data as what it actually is on the wire, not what the plan imagined
- Changes the smallest surface consistent with correctness

Then log it and keep going. Escalate to "todo for human" only genuine product calls.

## Closing the file: what this changes about attempt #2

End the log with 2 to 4 bullets to fold into the next plan or prompt, so the next run does not rediscover today's surprises. Patterns worth extracting:

- Data caveats that should be stated up front next time ("~12% of annotations have null `frame_ts`; decide interpolate-vs-sidecar before implementation starts")
- Bug classes worth retiring wholesale (queue payloads should be typed as wire formats; a shared codec would fix the class)
- Process fixes ("inventory existing utilities before adding dependencies; `zipStream.ts` already existed and beat the plan's version")

Source: Thariq Shihipar, "A Field Guide to Fable: Finding Your Unknowns", example 09 at thariqs.github.io/html-effectiveness/unknowns/.
