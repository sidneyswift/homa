# Homa curriculum atlas

A structured competitive and reference atlas of the homeschool curriculum
market: what each major curriculum is, how it teaches, what its materials
actually look like on the page, what it costs, why families choose it, why
they leave it, and what Homa should learn from it.

Started 2026-07-13. Profiles are dated research snapshots (see
`methodology.md`); re-verify prices and product lineups before quoting them
anywhere parent-facing.

## Why this exists

Homa's long-term objective is a curriculum knowledge base deep enough to:

1. Know what Homa is competing against, at the level of actual worksheets,
   lesson structure, and visual design, not just names and prices.
2. Serve as the baseline for building Homa's own curriculum and materials.
3. Let a mom build off the curriculum she already uses: when she says "we do
   Dimensions Math 2A and The Good and the Beautiful", Homa should know what
   that means, what those lessons look like, what they cover, where the gaps
   are, and how to generate materials that fit alongside them.

This folder is the human-readable and machine-readable seed of that system.
Every profile carries YAML front matter with a stable schema (defined in
`methodology.md`) so profiles can later be parsed into product data.

## How this relates to existing research

This atlas does not duplicate what the repo already knows. Link, do not
re-research:

- Segment sizes, buying behavior, philosophy demand cards:
  `docs/homa-planning/icp-research/08-segments-curricula.md`
- Every named homeschool method, ranked and sourced:
  `docs/homa-planning/icp-research/10-homeschool-methods-glossary.md`
- Level-to-grade crosswalks for math and ELA programs (Saxon 5/4 semantics,
  Singapore ahead-ness, MUS ladder divergence):
  `docs/homa-benchmarks/13-curriculum-crosswalk-math.md` and
  `14-curriculum-crosswalk-ela.md`
- Homa's own skill graph (the thing curricula will eventually map onto):
  `packages/taxonomy/`

The atlas adds what none of those have: per-curriculum product anatomy.
What a lesson actually looks like, what the workbook page contains, how the
teacher's guide is scripted, what the visual language is, and what that
means for Homa's materials and positioning.

## How to read this folder

| File or folder | What it is |
|---|---|
| `methodology.md` | Research protocol, depth tiers, sourcing rules, copyright policy, front matter schema |
| `taxonomy.md` | Tag vocabulary used in profile front matter, with definitions |
| `market-overview.md` | Rankings, awards, discovery behavior: how curricula win mindshare |
| `profile-template.md` | The exact template every profile follows |
| `curricula/math/` | Math curriculum profiles |
| `curricula/language-arts/` | Reading, phonics, spelling, writing, grammar, handwriting profiles |
| `curricula/science/` | Science curriculum profiles |
| `curricula/history-geography/` | History, geography, and social studies profiles |
| `curricula/all-in-one/` | Full-curriculum publishers and boxes (traditional, classical, Charlotte Mason, literature-based, unit study) |
| `curricula/online-digital/` | Online courseware, apps, and live-class platforms |
| `curricula/preschool/` | Early-years programs (wave 2) |
| `curricula/electives/` | World languages, art, music, typing, logic, finance (wave 2) |
| `marketplaces/` | Resource marketplaces (TPT and kin): profiled at marketplace level as materials-studio competitors |
| `comparisons/` | Cross-curriculum comparison and switching-path notes per category |
| `sequences/` | Structured scope-and-sequence data (YAML) extracted from publisher documents; schema in its README |
| `catalog.json` | Generated front matter index (never hand-edit; rebuild with `pnpm atlas:index`) |
| `materials-patterns.md` | The materials pattern library: 16 structural patterns publisher-grade materials use, with atlas evidence and Homa specs |
| `homa-implications.md` | What the atlas means for Homa's product and materials strategy |
| `backlog.md` | Curricula and categories not yet profiled, and the acquisition roadmap |

Tooling: `pnpm check:atlas` validates every profile (schema, enums, ids,
links, dash law) and `pnpm atlas:index` validates then regenerates
`catalog.json`. Both run `scripts/curriculum-atlas-index.mts`.

## Depth tiers

Every profile declares a tier in front matter:

- `flagship`: full anatomy, down to individual lesson and worksheet structure.
  The reference example is `curricula/math/dimensions-math.md`.
- `deep`: full template, all sections researched with sources.
- `standard`: full template, tighter treatment.
- `stub`: front matter, snapshot, reputation, links. A placeholder that marks
  the curriculum as known but not yet profiled.

## Status board

Waves 1, 2, and 2b completed 2026-07-13: 155 profiles, 18 comparison
docs, market overview, flagship deep dive, 6 marketplace profiles,
catalog tooling, the materials pattern library, 11 structured sequence
extractions (109 levels, 5,171 lesson entries), and the first
sequence-to-taxonomy crosswalk seed. Front matter validated atlas-wide
(schema, enums, unique ids, links, dash law) after each wave; rerun
`pnpm atlas:index` for live counts.

| Category | Profiles | Flagship | Deep | Standard | Stub |
|---|---|---|---|---|---|
| `curricula/math/` | 18 | 1 (Dimensions Math) | 5 | 9 | 3 |
| `curricula/language-arts/` | 14 | 0 | 4 | 6 | 4 |
| `curricula/science/` | 11 | 0 | 2 | 6 | 3 |
| `curricula/history-geography/` | 9 | 0 | 2 | 4 | 3 |
| `curricula/all-in-one/` | 50 | 0 | 12 | 22 | 16 |
| `curricula/online-digital/` | 24 | 0 | 3 | 14 | 7 |
| `curricula/preschool/` | 7 | 0 | 1 | 3 | 3 |
| `curricula/electives/` | 16 | 0 | 0 | 11 | 5 |
| `marketplaces/` | 6 | 0 | 2 (TPT, Etsy) | 1 | 3 |

Comparison docs in `comparisons/`: per-folder lenses (math,
language-arts, science, history-geography, online-digital, preschool,
languages-electives) plus cross-cutting lenses (all-in-one-traditional-
christian, classical-charlotte-mason, secular-literature-based, catholic,
high-school, special-needs-intervention, online-academies-unit-studies,
international, coding-accessibility, marketplaces).

The synthesis of what all of it means for the product is
`homa-implications.md` (wave 2 addendum at the end). The materials
pattern library is `materials-patterns.md`. What is not yet covered is
`backlog.md`.
