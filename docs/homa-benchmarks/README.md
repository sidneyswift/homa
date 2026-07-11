# National benchmark corpus (ages 2 to 16)

Web-sourced reference library of US national benchmarks, standards, and
developmental milestones across every subject Homa tracks, commissioned
2026-07-06 to give progress reports (the map report, weekly notes, the
dashboard) a deeper, citation-backed anchor base than the bank shipped with.
Produced by parallel research agents, one file per lane, then synthesized
in `00-synthesis.md`.

## How to read this folder

Start with `00-synthesis.md` (coverage map, crosswalk to the product's 16
map subjects, gaps, and recommended next anchors). Drill into the numbered
lane files for the raw benchmark tables and sources.

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

- Every factual claim carries an inline source link with an access date.
  FACT and INFERENCE are separated; derived numbers show their derivation.
- No number is invented. Anything unverifiable is logged in the lane's
  "dry wells" section instead of being estimated.
- No em dash character anywhere, per repo law. Sentence case headings.
- These files are internal reference, never parent-facing. Statistical
  vocabulary (percentile, norm, delay) is allowed HERE, but anything
  ported into product surfaces must pass the content laws in
  `packages/core/src/map/content.ts` (parent-observable statements, banned
  words list, citations) and the anti-guilt display law (BUILD.md law 4).

## Relationship to the product

`packages/core/src/map/content.ts` is the shipped question bank: 16
domains, ages 2 to 16, every item anchored to a `typicalMonths` age
(exposure-based domains like spanish and computer_science track what the
family does instead). This
corpus is the raw material for expanding and re-verifying those anchors,
and for the richer benchmark positions that progress reports (FR-7
dashboard, FR-8 weekly notes) will draw on. Porting happens deliberately,
item by item, with a `MAP_BANK_VERSION` bump and `pnpm check:map` green;
nothing here auto-flows into the product. The first pass (bank v2026.07.2,
2026-07-06) is documented in `00-synthesis.md` under "Porting status".

The 16 map subjects (renamed from "domains" 2026-07-10; "domain" now means the level-2 skill line), for tagging: math, literacy, phonics, writing,
language, science, social_studies, art, music, gross_motor, fine_motor,
social_emotional, self_care, executive_function, spanish,
computer_science (shipped 2026-07-06).

## Shared conventions

**Age anchors are whole months.** Where a source speaks in grades, lanes
convert with this table (US convention, end-of-grade anchor, matching the
anchors already in `content.ts`: gr 3 = 108mo, gr 5 = 132mo, gr 8 = 168mo,
gr 10 = 192mo):

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

Grade-to-month conversions are a convention, not a fact about a child;
lanes mark converted anchors as such. The scored range is 24 to 204
months (`packages/core/src/map/bands.ts`), with ladder headroom to about
17 years for detecting ahead at the top, so grade 11 anchors are welcome
where a source offers them cheaply.

**Update cadence.** Re-verify a lane before porting anchors from it, and
prefer refreshing this corpus alongside any `MAP_BANK_VERSION` bump.
Standards bodies revise: capture the edition and year of every framework.
Tooling: `pnpm check:sources` probes every bank source URL and tracks
verified dates and revision watches (runbook:
`docs/homa-planning/runbooks/benchmark-freshness.md`); `pnpm report:norms`
is the Homa-native re-norm loop over our own stored answers (runbook:
`docs/homa-planning/runbooks/map-renorm.md`).
