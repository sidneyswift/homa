---
name: materials-studio-eval
description: Use when testing or improving the materials-studio fleet skill: running the customer-scenario decision scorecard, diagnosing where a parent request fails (routing, format, recipe read, anchor, theme customization, thrash), driving end-to-end bench runs, and iterating the skill until customers get a keeper on the first try.
---

# Materials-studio eval loop

The materials studio is a cornerstone capability. Every change to its
skill package (SKILL.md router, recipes, subjects, approaches, anchors)
must be tested against customer-shaped scenarios BEFORE families feel it.
Three tiers, cheap to expensive; run the cheapest tier that answers the
question.

## Tier 1: routing (does the ask load the skill at all?)

`apps/web/evals/materials-studio/*-routing.eval.ts` (defineEval, run out
of band via eve's eval runner). Add a positive and an adjacent-negative
routing eval whenever the skill description changes.

## Tier 2: decisions (the core loop, run this most)

    pnpm evals:materials-studio                # deterministic + LLM judge
    pnpm evals:materials-studio -- --scenario activity-pack-space-theme
    pnpm evals:materials-studio -- --no-judge  # objective gate only, cheaper

Real model + the real shipped skill package. The stubbed read_file serves
the REAL reference files at their /workspace paths, so load-on-demand is
honestly exercised; stubbed generate_image and create_printable record
every decision free of image cost. Two grading layers:

- Deterministic checks (routing, recipe reads, anchor, theme keywords,
  thrash): the objective gate. Pure logic, unit-tested in check:materials
  (`studio-harness.test.ts`), so the grading contract cannot silently rot.
- LLM judge (`judge.ts`): scores "delighted first try" 1 to 5, rates how
  genuine the customization is, and returns the single most useful skill
  fix. The feedback-at-scale layer; it grades decisions and the built
  spec, never rendered pixels.

Needs the AI Gateway (run with `apps/web/.env.local` present, same as
`pnpm materials:calibrate`); without it the model call hangs, while the
deterministic grader still runs and is CI-tested. Scenarios live in
`scenarios.ts`, the harness in `studio-harness.ts`. The scorecard lands in
`docs/homa-planning/materials/evals/<date>-decision-scorecard.md` with
per-check verdicts, the judge verdict, a rolled-up skill-fix list, and the
full decision trace (files read, anchors, image prompts, final reply).

What the checks mean when they fail:

- "reads references/..." failed: the router did not point the model at
  the file, or the pointer is not compelling. Fix the Format library or
  subject/approach routing tables in SKILL.md, not the recipe body.
- "rides anchor X" failed: the Golden anchors table row is missing,
  mis-worded, or the recipe does not name its anchorId. Fix there.
- "material includes/avoids theme" failed: customization is weak. The
  recipe likely reads as a fixed example rather than a template; make the
  recipe state what varies (theme, objects, names) vs what is structural.
- "asks one calibrating question" failed: the difficulty-from-evidence
  section is being skipped; strengthen its binding language.
- "builds without thrash" failed: the loop section or path choice is
  unclear for this format.

The iteration loop: run scorecard, read the failing trace, patch ONE
layer (router pointer, recipe wording, anchor table), re-run only that
scenario, then re-run the full suite before shipping. Never fix by
adding a scenario-specific hack to the skill; fix the general rule.

## Tier 3: end to end (real images, real QC; sample, do not sweep)

The admin bench engine is programmatic: POST
`<deployment>/eve/v1/materials-lab/run` with header
`authorization: Bearer $CRON_SECRET` and JSON
`{familyId, childId?, request, startedBy}`. familyId MUST be a sandbox
family (the route re-verifies server-side). The response carries runId
and sessionId. Results land in `materials_studio_runs` joined to
`materials` (preview_url, pdf_url, review pass/issues); query via the
authorized Supabase MCP (homa-prod) or read /admin/studio. Judge the
preview against the scenario expectation by reading the image (the agent
IS the vision judge) and against the golden anchor for that format; log
verdicts in the scorecard file for that date. Reserve tier 3 for: after
a tier-2 green on changed scenarios, after any HOMA_IMAGE_MODEL change
(also run `pnpm materials:calibrate`), and for a weekly sampled sweep.

## Adding scenarios

Add one whenever: a new format/recipe/anchor ships (positive + one
theme-customization variant), a real family hits a failure the suite
missed (encode the exact ask), or a founder ruling changes studio
behavior. Keep asks verbatim-parent-shaped, not engineer-shaped: "one of
those fold-up reference charts", not "generate a foldable via hybrid
path".

## Honesty rules

The harness tests decisions, not pixels: never claim image quality from
tier 2. The tier-2 family context approximates runtime dynamic
instructions; when a failure looks context-shaped, confirm on the bench
before changing the skill. Report scorecard numbers as measured, never
rounded up.
