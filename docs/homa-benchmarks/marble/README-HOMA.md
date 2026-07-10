# Marble skill taxonomy · vendored reference corpus

Homa's local copy of Marble's open skill taxonomy, pulled so the strand-layer
work can build on it directly.

- **Upstream:** https://github.com/withmarbleapp/os-taxonomy
- **Version:** v1 · upstream commit `96a7933754af672e1bfdbf7ecb05c325860c6e0d`
- **Pulled:** 2026-07-10 (full `data/`, `schema/`, `validate.mjs`; `media/` skipped)
- **Integrity:** `node scripts/validate.mjs` passes from this folder (checksums + referential integrity)

## What it is

1,590 micro-topics across 8 subjects and 54 domains (ages 4 to 14), wired into
a prerequisite DAG of 3,221 hard/soft edges with reasons, aligned to 3,261
standards across 7 curricula, plus 183 parent-friendly cluster summaries.
Shape: subject → domain → micro-topic, with per-topic `evidence[]`,
`assessmentPrompt` ({{name}} placeholder), `type`
(conceptual/procedural/representational/language/meta), age range, and
computed graph `centrality`.

## How Homa uses it

Source material for the taxonomy build (see build-log 2026-07-10): the strand
naming map, the level-3 topic corpus for ages 4 and up, the prerequisite
edges, and the evidence/probe assessment shape. Homa authors its own scoring
anchors (typical-by months), the under-4 extension, and the six subjects
Marble does not cover (gross motor, fine motor, self-care, music, art, second
language). Keep Marble's `mt_` ids on any imported row (as `marble_id`) so
re-syncs and provenance stay possible.

## License posture (founder ruling 2026-07-10)

Upstream is ODbL 1.0 (database) + CC BY-SA 4.0 (authored text); license files
are vendored alongside. Founder call: do not gate the build on licensing now,
attribute when it matters (public-facing use or redistribution of a derived
taxonomy). ODbL obligations trigger on public use of a derivative database,
not on private internal use, so today's import is the low-risk case. The
attribution line, ready when needed:

> Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) ·
> https://withmarble.com · ODbL 1.0 (database), CC BY-SA 4.0 (content).
