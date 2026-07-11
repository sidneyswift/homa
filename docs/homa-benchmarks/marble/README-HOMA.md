# Marble skill taxonomy · provenance and license home

The dataset itself lives at `packages/taxonomy/data/` (the runtime copy the
skill graph assembles from; refresh via
`node packages/taxonomy/scripts/sync-upstream.mjs`, validate via
`pnpm check:taxonomy`). This folder holds the licensing and provenance
paperwork plus this usage note, so the data has exactly one in-repo copy.

- **Upstream:** https://github.com/withmarbleapp/os-taxonomy
- **Version:** v1 · vendored from upstream commit `96a7933754af672e1bfdbf7ecb05c325860c6e0d`
- **Pulled:** 2026-07-10 (`media/` skipped)
- **Integrity:** `pnpm check:taxonomy` (upstream checksums + referential integrity + the Homa graph laws)

## What it is

1,590 micro-topics across 8 subjects and 54 domains (ages 4 to 14), wired into
a prerequisite DAG of 3,221 hard/soft edges with reasons, aligned to 3,261
standards across 7 curricula, plus 183 parent-friendly cluster summaries.
Shape: subject → domain → micro-topic, with per-topic `evidence[]`,
`assessmentPrompt` ({{name}} placeholder), `type`
(conceptual/procedural/representational/language/meta), age range, and
computed graph `centrality`.

## How Homa uses it

Source material for the taxonomy build (see build-log 2026-07-10 and
`docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md`): the domain
naming map, the level-3 topic corpus for ages 4 and up, the prerequisite
edges, and the evidence/probe assessment shape. Homa authors its own scoring
anchors (typical-by months), the under-4 extension, and the six subjects
Marble does not cover (gross motor, fine motor, self-care, music, art, second
language).

Every imported topic gets a Homa id following the existing bank convention
(`<subject>.<slug>`, e.g. `math.comparing-groups`); Marble's `mt_` keys never
become Homa identifiers (founder ruling 2026-07-10). Lineage for re-syncs
lives in each topic's namespaced `refs` array (`marble:mt__h7hvT4tEb`), the
same shape as standards refs (`ccss-math:K.CC.6`).

## License posture (founder ruling 2026-07-10)

Upstream is ODbL 1.0 (database) + CC BY-SA 4.0 (authored text); license files
are vendored alongside. Founder call: do not gate the build on licensing now,
attribute when it matters (public-facing use or redistribution of a derived
taxonomy). ODbL obligations trigger on public use of a derivative database,
not on private internal use, so today's import is the low-risk case. The
attribution line, ready when needed:

> Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) ·
> https://withmarble.com · ODbL 1.0 (database), CC BY-SA 4.0 (content).
