---
name: marketing-idea-generator
description: Top up the signal reservoir when it runs thin (fewer than 5 status-new signals) by mining the planning corpus (docs/homa-planning positioning, personas, journeys) and keyword research already in marketing/raw/ for content-worthy angles. Every generated idea still cites its source doc + line range. Use when the orchestrator finds the reservoir thin or the founder asks for content ideas. NOT for extracting fresh raw files (marketing-signal-extraction) and NOT for drafting (marketing-demand-engine).
---

# Marketing idea generator

The reservoir's backstop. Same output format as extraction, different allowed
inputs: the planning corpus instead of new field material.

## Allowed sources, and only these

- `docs/homa-planning/journeys/07-positioning-messaging.md` (pillars, objection
  catalog, copy kit): every objection in §4 is a content idea; every pillar
  proof point in §3 is a content idea.
- `docs/homa-planning/journeys/01-personas-jtbd.md` (pains, day-in-the-life,
  jobs): every named pain is a search query someone types at 10pm.
- `docs/homa-planning/journeys/02-acquisition-activation.md` (channel notes).
- `docs/homa-planning/00-product-brief.md` (the value stack).
- Keyword research files already sitting in `marketing/raw/`.

Banned as always: `homa-macmini/`, `homa-research/`, `homa-template/`, and
anything about a real family. The `[inv]` quotes in journeys/01 are invented
persona voice: they may inspire an angle but may never be quoted as if real
(journeys/01 §0 quote honesty rule).

## Procedure

1. Read `marketing/AGENTS.md` if not already in context.
2. Count `status: new` signals in `marketing/signals/`. If 5 or more, say so
   and stop; the reservoir does not need topping up.
3. Mine the allowed sources for angles that serve the funnel: worries she
   searches (SEO), moments that stop a scroll (video), problems Homa's pillars
   actually answer. Prefer angles grounded in the validated demand signals
   (hours tracking, per-child customization) over speculative ones.
4. Dedup against every existing signal hook (all statuses).
5. Write each idea as a standard signal file (same frontmatter as
   `marketing-signal-extraction`, see that skill for the schema), with
   `source.type: planning-doc` and `source.ref` + `locator` pointing at the
   exact section that grounds it.
6. Write 3 to 7 signals per run, quality over volume, then report them.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish. No source, no signal: a generated idea without a planning
doc citation does not get written. No family data. Voice per
`marketing/voice/house-style.md`.
