# Atlas taxonomy

Tag vocabulary for profile front matter. This is product-adjacent: the same
vocabulary should eventually describe a family's stack inside Homa, so a mom
saying "we use Saxon and Apologia" resolves into structured facts.

For the full sourced treatment of homeschool philosophies (definitions,
popularity, community evidence), see
`docs/homa-planning/icp-research/10-homeschool-methods-glossary.md`. This
file only defines the enums used in front matter.

## category (one per profile, matches folder)

- `math`
- `language-arts` (reading, phonics, spelling, writing, grammar, handwriting)
- `science`
- `history-geography` (history, geography, civics, social studies)
- `all-in-one` (multi-subject packages, publishers, and spines, including
  classical, Charlotte Mason, literature-based, unit-study, and boxed
  traditional programs)
- `online-digital` (courseware, apps, and live-class platforms where the
  delivery model is the defining trait)
- `preschool` (early-years programs where "preschool" is the product
  identity, ages 2 to 5; a publisher's preschool level stays with the
  publisher profile, cross-linked)
- `electives` (world languages, art, music, typing, coding, logic, PE,
  personal finance: the subjects moms shop as their own aisle)
- `marketplace` (resource marketplaces like TPT that sell many authors'
  materials rather than one curriculum; profiled in `marketplaces/` at
  marketplace level, not per resource)

A curriculum that could sit in two places sits where a mom would look for
it, with cross-links. Example: Mystery Science is `science` (format online),
not `online-digital`.

## subjects (list)

`math`, `reading`, `phonics`, `spelling`, `writing`, `grammar`,
`handwriting`, `literature`, `science`, `history`, `geography`, `civics`,
`bible`, `art`, `music`, `logic`, `latin`, `spanish`, `french`,
`sign-language`, `typing`, `computer-science`, `pe-health`, `life-skills`,
`preschool`, `multi` (use `multi` for all-in-ones instead of listing ten
subjects).

## approach_tags (list, pick what genuinely applies)

Pedagogy family:

- `traditional-textbook`: school-at-home, textbook and workbook driven
- `classical`: trivium staging, memory work, great books, Latin culture
- `charlotte-mason`: living books, short lessons, narration, nature study
- `literature-based`: real books as the spine (broader than CM)
- `unit-study`: one topic integrating many subjects
- `montessori`: montessori-derived materials and sequence
- `waldorf`: waldorf-derived rhythm and arts integration
- `interest-led`: child-directed, unschooling-adjacent
- `project-based`: learning organized around projects and output

Teaching mechanics:

- `mastery`: stay on a concept until mastered (also set mastery_or_spiral)
- `spiral`: continuous review, incremental introduction
- `conceptual`: prioritizes why over procedure
- `procedural`: prioritizes fluency and algorithms
- `scripted`: open-and-go teacher script, word-for-word
- `open-and-go`: minimal prep even if not scripted
- `teacher-led`: parent actively teaches lessons
- `self-directed`: student works independently by design
- `video-taught`: instruction delivered by recorded video
- `game-based`: games are a core mechanic, not a reward layer
- `hands-on`: manipulatives, experiments, kits are core
- `orton-gillingham`: structured literacy lineage (reading programs)
- `community-based`: designed around a co-op or community meeting

## religious_orientation (one)

- `secular`: no religious content, evolution and standard science taught
- `neutral`: avoids both religious content and contested topics (the
  "religion and evolution both absent" posture; common in math)
- `faith-based-christian`: explicit Christian worldview in the content
- `faith-based-other`: explicit non-Christian religious worldview
- `varies`: marketplaces and multi-author platforms only; individual
  items span the whole spectrum with no platform-level vetting

Use `religious_notes` for nuance: denomination, young-earth vs old-earth
science, "LDS founder, broadly Christian content" (The Good and the
Beautiful), "Christian publisher but subject line is neutral", and so on.
This nuance decides real purchases; do not flatten it.

## parent_involvement (one)

- `high`: parent teaches or facilitates most lessons (RightStart, CM)
- `medium`: parent starts lessons or checks work daily (many workbooks)
- `low`: student self-runs after setup (Teaching Textbooks, courseware)

## format (list)

`print`, `pdf`, `online-course`, `video`, `app`, `live-class`, `kit`,
`audio`.

## status (one)

- `active`: currently sold and maintained
- `legacy`: still sold or circulating but superseded (older editions with
  active resale markets count; note it in prose)
- `discontinued`: no longer sold new

## homa_tier (one)

`flagship`, `deep`, `standard`, `stub`. Defined in the README.

## Mapping to Homa product data

Two existing structures this taxonomy must stay compatible with:

- `HOMESCHOOL_STYLES` in the product (family onboarding): the methods
  glossary (§6) already flagged gaps there (virtual charter school-at-home,
  microschool/hybrid). This atlas uses the finer `approach_tags` and can be
  rolled up to whatever the product enum becomes.
- `packages/taxonomy/` (Homa's subject, domain, topic skill graph): the
  eventual crosswalk target. A curriculum's scope and sequence maps onto
  skill-graph nodes; the benchmarks corpus crosswalk files
  (`docs/homa-benchmarks/13-*.md`, `14-*.md`) are the proof of concept for
  math and ELA.
