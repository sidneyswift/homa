# National benchmark corpus (ages 2 to 16)

This README is the current index and use policy for a dated internal research
corpus. The numbered files `00` through `16` preserve research captured on
2026-07-06. They are historical snapshots, not current legal, provider,
standards, product, or production guidance. Re-verify volatile facts and
source freshness before using any claim.

The corpus covers US benchmarks, standards, developmental milestones,
assessment norms, and curriculum crosswalks for the subjects Homa tracks.
Parallel research lanes produced the source records, then `00-synthesis.md`
summarized that dated pass.

## How to read this folder

Start with `00-synthesis.md` for the historical coverage map and porting
record. Drill into the numbered lane files for the dated tables and source
links. Treat recommendations and status labels inside those files as part of
the 2026-07-06 record unless a current authority explicitly adopts them.

| File | Lane |
|---|---|
| `00-synthesis.md` | Synthesis: coverage map, domain crosswalk, gaps, recommended anchors |
| `01-early-childhood-2-5.md` | Ages 2 to 5, all domains: CDC milestones, ELOF, ASQ-3, speech, motor, self-help |
| `02-math-k-10.md` | Math K to 10: CCSS-M by grade, required fluencies, trajectories, NAEP |
| `03-reading-k-10.md` | Reading K to 10: foundational skills, phonics scope, ORF norms, text complexity |
| `04-writing-language-k-10.md` | Writing, grammar, spelling stages, handwriting, keyboarding K to 10 |
| `05-science-k-10.md` | Science K to 10: NGSS performance expectations, practices, typical sequences |
| `06-social-studies-k-10.md` | Social studies K to 10: C3, NCSS themes, typical scope, civics, financial literacy |
| `07-arts-pe-health.md` | Visual art, music, theatre, dance, PE, health: NCAS, SHAPE, NHES, motor skills |
| `08-sel-ef-life-skills.md` | Social-emotional (CASEL), executive function, self-care and independence ages |
| `09-languages-cs-digital.md` | World languages (ACTFL), computer science (CSTA), digital and AI literacy |
| `10-assessment-norms.md` | Norm tables: NAEP levels, MAP RIT, Lexile bands, ORF percentiles, course of study |
| `11-score-distributions.md` | Wave 2: percentile curves and spreads (CDI, ORF, MAP, Lexile), tolerance-band method |
| `12-nd-2e-trajectories.md` | Wave 2: neurodivergent and 2e trajectories, per-domain tolerance implications |
| `13-curriculum-crosswalk-math.md` | Wave 2: homeschool math curricula levels mapped to grades and bank items |
| `14-curriculum-crosswalk-ela.md` | Wave 2: reading and LA curricula levels mapped to grades and bank items |
| `15-refresh-sweep-2026-07.md` | Wave 2: dated resolution pass over lanes 01 to 10's dry wells |
| `16-state-assessment-requirements.md` | Wave 2: 50-state homeschool assessment requirements (not legal advice) |

## Rules of this folder

- Preserve the numbered records as history. Correct a present-day use rule in
  this README or the relevant runbook instead of silently rewriting old
  research findings.
- New research must link its sources, record access dates, separate facts from
  inference, and show how derived numbers were calculated. Unverified values
  belong in a clearly labeled gap, not an estimate.
- No em dash character anywhere, per repo law. Sentence case headings.
- These files are internal reference, never parent-facing. Statistical
  vocabulary such as percentile, norm, and delay is allowed here, but anything
  ported into product surfaces must pass the content laws in
  `packages/core/src/map/content.ts` (parent-observable statements, banned
  words list, citations) and the anti-guilt display law in `BUILD.md`.

## Relationship to the product

Nothing in this corpus flows into the product automatically. The current bank
lives in `packages/core/src/map/content.ts`; its version lives in
`packages/core/src/map/bank.ts`. At the 2026-07-11 reconciliation snapshot it
contains 224 items across 16 subjects at `MAP_BANK_VERSION` `2026.07.5`, and
`pnpm check:map` passes. Any future port must be deliberate, item by item,
with an appropriate version bump and a green map guard. The earlier
`2026.07.2` port remains documented as history in `00-synthesis.md`.

The current subject identifiers are `math`, `literacy`, `phonics`, `writing`,
`language`, `science`, `social_studies`, `art`, `music`, `gross_motor`,
`fine_motor`, `social_emotional`, `self_care`, `executive_function`,
`computer_science`, and `spanish`. In current taxonomy language, a domain is
the level below a subject.

## Shared conventions

**Age anchors are whole months.** The dated lanes use this US end-of-grade
conversion when a source speaks in grades. It is a research convention, not
a statement about an individual child.

| Grade | Typical age during grade | End-of-grade anchor (months) |
|---|---|---|
| PreK3 | 3 to 4 | 48 |
| PreK4 | 4 to 5 | 60 |
| K | 5 to 6 | 72 |
| 1 | 6 to 7 | 84 |
| 2 | 7 to 8 | 96 |
| 3 | 8 to 9 | 108 |
| 4 | 9 to 10 | 120 |
| 5 | 10 to 11 | 132 |
| 6 | 11 to 12 | 144 |
| 7 | 12 to 13 | 156 |
| 8 | 13 to 14 | 168 |
| 9 | 14 to 15 | 180 |
| 10 | 15 to 16 | 192 |

The current scored range is 24 months inclusive through 204 months exclusive,
as defined in `packages/core/src/map/bands.ts`.

**Update cadence.** Re-verify a lane before porting anchors from it, and
prefer refreshing this corpus alongside any `MAP_BANK_VERSION` bump.
Standards bodies revise: capture the edition and year of every framework.
Tooling: `pnpm check:sources` probes every bank source URL and tracks
verified dates and revision watches (runbook:
`docs/homa-planning/runbooks/benchmark-freshness.md`). A zero exit can still
include `BLOCK` results that require manual verification. The latest captured
audit result belongs in
`docs/homa-planning/reconciliation/evidence/repository-baseline.md`, not in
this standing policy. `pnpm report:norms` is a private-data reporting tool
with important limitations documented in
`docs/homa-planning/runbooks/map-renorm.md`; its output does not authorize an
anchor change.
