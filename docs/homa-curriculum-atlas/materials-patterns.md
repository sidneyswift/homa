# Materials pattern library

What publisher-grade learning materials do structurally, distilled from
the atlas (129+ profiles, 13+ comparisons, the TPT marketplace data, and
the flagship lesson anatomy). Written 2026-07-13 as the wave 3 "materials
pattern library" item from `backlog.md`.

Audience: the materials studio (see
`docs/homa-planning/plans/2026-07-10-materials-studio-v2.md` and the
`materials-studio` agent skill) and anyone specifying generated-material
formats. Each pattern names its evidence in the atlas.

The legal frame, restated from `methodology.md`: these are structural
patterns, which no publisher owns. Homa expresses every one of them in
its own design language (`docs/homa-design/`), never as a clone of any
publisher's page. Patterns describe what works; expression stays ours.

Homa's standing content laws apply on top of everything here: no red, no
"behind" framing, never compare siblings, reassure before inform, and
the anti-guilt display law in `BUILD.md`.

## How to use this file

When generating or specifying a material, walk the relevant patterns:
the format patterns (1-6) decide the shape, the pedagogy patterns (7-11)
decide the internals, the trust patterns (12-16) decide the details that
make a parent keep it. A generated worksheet that follows the family's
declared curriculum vocabulary (front matter tags plus `sequences/`
position) and applies these patterns should read as native to the
family's stack, not as a generic printable.

## Format patterns

### 1. Per-page difficulty ramp

Every exercise page carries an internal easy-to-hard gradient with named
bands, and completing every item is explicitly optional.

- Evidence: Dimensions Math workbooks band every exercise Basics,
  Practice, Challenge, and the publisher tells parents not everyone
  finishes every problem (`curricula/math/dimensions-math.md`, A lesson
  up close). Differentiated bundles are evergreen TPT top sellers
  (`marketplaces/teachers-pay-teachers.md`). Moving Beyond the Page
  gates by level (`curricula/all-in-one/moving-beyond-the-page.md`).
- Homa spec: default every generated practice page to three labeled
  bands in Homa's own naming, with the band boundary visible so the
  parent can stop cleanly. Never grade the bands by color-coded
  judgment; the ramp is an offer, not a test.
- Watch out: a ramp without permission-to-stop reads as "finish it all."
  The stop permission is part of the pattern.

### 2. Response ladder (one prompt, many output levels)

One stimulus with a family of response formats at different demand
levels: trace it, use the word bank, write a sentence, write a
paragraph, write an essay.

- Evidence: Gather Round's five-rung response ladder is the cleanest
  implementation and a stated reason for its rise
  (`comparisons/classical-charlotte-mason.md`); Mystery of History's
  Younger/Middle/Older tracks and Berean Builders' three-level reviews
  are the same pattern statically
  (`comparisons/history-geography.md`, `comparisons/science.md`).
- Homa spec: for any content prompt, generate the rung the child's map
  position calls for, and offer the neighboring rungs one tap away.
  This is the atlas's strongest multi-kid opening: one family lesson,
  per-child outputs, dynamically.
- Watch out: never label rungs by age or grade in family-facing copy
  (see pattern 8); rung names describe the task, not the child.

### 3. Ritual formats

Recurring daily and weekly formats that install a habit: morning work,
spiral review, paragraph of the week, problem of the day, nightly read
log.

- Evidence: ritual formats dominate TPT's all-time best sellers
  (`marketplaces/teachers-pay-teachers.md`); Saxon's whole pedagogy is
  ritualized mixed review (`curricula/math/saxon-math.md`); Story of the
  World's read, narrate, map, activity loop is a ritual at week scale
  (`comparisons/history-geography.md`).
- Homa spec: materials ship as installable rituals, not one-offs: "a
  Tuesday review page that knows what she did Monday." The morning
  brief and tasks surfaces already carry rhythm; materials should plug
  into it.
- Watch out: rituals die at restart cost (see pattern 6). A ritual that
  needs the parent to regenerate it manually every day is a one-off in
  disguise.

### 4. One-lesson-many-outputs (family style)

A single content spine consumed together, with per-child artifacts
produced after.

- Evidence: the category norm in history, science, and unit studies:
  MOH tracks, Berean reviews, TGTB family-style science and history,
  Konos-lineage unit studies, Five in a Row
  (`comparisons/history-geography.md`, `comparisons/science.md`,
  `comparisons/secular-literature-based.md`).
- Homa spec: when a family teaches a shared subject, generate one
  parent-facing spine brief plus per-child follow-ups at each child's
  rung (pattern 2). Never generate per-child spines for shared
  subjects; that breaks the family-style economics moms chose.
- Watch out: sibling comparison is a hard law. Per-child outputs must
  never be displayed side-by-side with judgment language.

### 5. Game-board and no-worksheet formats

For some children and some pedagogies the worksheet itself is the
failure mode; games, oral formats, and manipulative tasks are the
material.

- Evidence: Ronit Bird's explicit no-worksheets rule for dyscalculia
  (`curricula/math/ronit-bird.md`), RightStart's games-instead-of-drill
  (`curricula/math/rightstart-mathematics.md`), the special-needs
  comparison's finding that the worksheet can be the trauma trigger
  (`comparisons/special-needs-intervention.md`), CM narration culture
  (`comparisons/classical-charlotte-mason.md`).
- Homa spec: the studio needs at least three non-worksheet output
  shapes: a printable game board with rules for the parent, an oral
  activity script (narration prompts, mental-math strings), and a
  manipulative task card using household items. Family settings and
  philosophy tags decide the default shape.
- Watch out: game formats still need the skill-position targeting;
  "fun" without position is TPT filler.

### 6. Zero restart cost

Materials engineered so a skipped day, week, or month costs nothing to
resume: short lessons, no cliffhangers, two-supply activities, no
prep.

- Evidence: the electives comparison names skip-resistance as the real
  product spec (`comparisons/languages-electives.md`); science's
  most-skipped-subject problem is a supply-friction problem
  (`comparisons/science.md`); "NO PREP" is a genre name on TPT; TGTB's
  open-and-go promise built the fastest-growing brand
  (`curricula/all-in-one/the-good-and-the-beautiful.md`).
- Homa spec: every generated material states its time cost and supply
  list up front (household items by default); nothing generated
  depends on yesterday's material having been completed; regeneration
  at today's position is always one tap.
- Watch out: streaks and completion chains create the opposite
  incentive; Homa celebrates resumption, never penalizes gaps
  (anti-guilt law).

## Pedagogy patterns

### 7. Visual grammar fidelity

Each pedagogy has a visual language that is the pedagogy: bar models,
number bonds, and place-value discs for Singapore-method families; base
blocks for MUS; ten frames; CPA staging everywhere conceptual.

- Evidence: the flagship anatomy (`curricula/math/dimensions-math.md`,
  Materials and visual design), MUS blocks
  (`curricula/math/math-u-see.md`), TouchMath's counting points
  (`curricula/math/touchmath.md`).
- Homa spec: generated math practice for a family on a declared
  curriculum uses that curriculum's visual grammar (from the profile's
  anatomy section), drawn in Homa's design language. A bar-model
  problem for a Dimensions family, block imagery for an MUS family.
  The atlas front matter plus `sequences/` position select the grammar.
- Watch out: mixing grammars in one page confuses the child and
  signals ignorance to the parent. One grammar per material.

### 8. De-graded level naming

Skill-position names instead of grade labels, because the emotional
center of much of this market is a child whose skill age and calendar
age differ.

- Evidence: universal in the special-needs aisle (Barton levels, Nessy
  islands, Simply Classical readiness levels,
  `comparisons/special-needs-intervention.md`); MUS Greek letters; AAR
  levels; the wave 2 addendum names this as direct validation of Homa's
  map philosophy (`homa-implications.md`).
- Homa spec: generated materials carry skill-position labels from
  Homa's own map, never grade equivalents, on the child-facing page.
  Grade translation exists only in parent-facing contexts that ask for
  it.
- Watch out: age-respect in content (pattern 9) is the sibling rule;
  de-graded labels on babyish content fool no one.

### 9. Age-respecting content at skill level

Content difficulty and content dignity are independent axes: a
twelve-year-old practicing CVC words needs material that respects
twelve.

- Evidence: the special-needs comparison names this as the structural
  hole print products cannot fill
  (`comparisons/special-needs-intervention.md`); hi-lo readers exist as
  a whole publishing category because of it.
- Homa spec: generation parameterizes interest register (from the
  child's profile interests) separately from skill position. This is
  something only generation can do per-child, and it is the single
  clearest materials-studio advantage over every print product in the
  atlas.
- Watch out: register mismatch in the other direction too: young gifted
  kids need hard content with young-kid warmth.

### 10. Scaffold fading as visible progress

Supports that thin measurably over a sequence: dots fade, guides
lighten, hint boxes shrink, until the bare skill stands.

- Evidence: TouchMath's fadeable dots (`curricula/math/touchmath.md`),
  Handwriting Without Tears' gray-to-blank progression
  (`curricula/language-arts/handwriting-without-tears.md`), decodable
  ramps in the OG lineage (`comparisons/language-arts.md`).
- Homa spec: sequences of generated pages carry a scaffold parameter
  that steps down over time, and the fading itself is narratable to
  the parent as progress evidence ("she did today's page without the
  number line").
- Watch out: fading is per-skill, not per-child; regression days are
  normal and the scaffold can step back up without ceremony.

### 11. Evidence-staged reading materials

Reading practice labeled by its position in a structured-literacy
progression (decodable stage, phonogram coverage), because the
science-of-reading wave taught buyers to shop by evidence stage.

- Evidence: SOR-tagged decodables dominate TPT's current best sellers
  (`marketplaces/teachers-pay-teachers.md`); the LA comparison's
  finding that the OG lineage owns phonics mindshare
  (`comparisons/language-arts.md`).
- Homa spec: generated reading material states its stage in plain
  parent language and matches the family's phonics program position
  (via `sequences/` once reading programs are extracted). A decodable
  generated ahead of the child's taught phonograms is a defect, not a
  variation.
- Watch out: decodability is a hard constraint on generation, not a
  style; this needs a real phonogram-position check, not vibes.

## Trust patterns

### 12. The parent apparatus

Answer keys, worked solutions, and "accept any correct method" notes
live with the parent, never on the child's page; the teacher-facing
layer teaches the parent the why.

- Evidence: Dimensions' HIG carries answers and background notes, and
  its workbook page explicitly tells parents to accept differing
  methods (`curricula/math/dimensions-math.md`); Math with Confidence
  sells parent scripting with the why
  (`curricula/math/math-with-confidence.md`); MODG sells consultation
  around syllabi (`comparisons/catholic.md`).
- Homa spec: every generated material has a parent side: answers,
  the one-paragraph why of the method, what to say if the child is
  stuck, and what today's page is evidence of. The parent side is
  where Homa's voice does its reassure-before-inform work.
- Watch out: the parent side must be skimmable in ten seconds; a
  teacher's-guide essay defeats the open-and-go promise.

### 13. Ambient evidence shapes

Progress artifacts that feel like keepsakes and life, not assessment:
narration cards, nature logs, story maps, read-aloud logs, portfolio
pages.

- Evidence: the secular/lit comparison's finding that accepted evidence
  is ambient and narrative, never quiz-shaped, outside gifted framing
  (`comparisons/secular-literature-based.md`); FIAR's story-disk map;
  Oak Meadow's per-lesson assessment forms; CM narration
  (`comparisons/classical-charlotte-mason.md`).
- Homa spec: for gentle-tagged families, generated evidence formats
  default to ambient shapes, and those shapes feed ChildProgress as
  real evidence (the records thesis in `homa-implications.md`). The
  quiz shape exists but is opt-in by philosophy.
- Watch out: an ambient format that secretly scores is a trust breach;
  what feeds the map must be visible to the parent.

### 14. Beauty floor

Page aesthetics create loyalty that survives pedagogical doubt, and
"AI generic" is disqualifying in this market.

- Evidence: TGTB's fine-art identity and Beast Academy's comics prove
  design loyalty (`comparisons/math.md`); TPT's winners are visually
  consistent seller-brands (`marketplaces/teachers-pay-teachers.md`).
- Homa spec: generated materials use the Homa design system
  (the Quiet authority doctrine plus `packages/design`) with consistent,
  recognizable layout DNA across every page, so a Homa page is
  identifiable at arm's length. Typography, spacing, and illustration
  style come from the design system, never from model defaults.
- Watch out: beauty is the floor, not the pitch; a gorgeous page at
  the wrong skill position still fails (the TPT lesson in reverse).

### 15. Consumables economics deleted

Per-child regeneration removes the multi-kid consumables tax that
boxed publishers charge, and print-at-home is already normalized.

- Evidence: the consumables tax finding
  (`comparisons/all-in-one-traditional-christian.md`); TGTB normalized
  home printing (`homa-implications.md` wave 2 addendum); perforated
  consumable workbooks across the atlas.
- Homa spec: say it in product copy where relevant ("print another,
  it's included"), and design pages to print well on a home printer:
  black-and-white-safe, ink-light backgrounds, US Letter.
- Watch out: print-shop-quality color spreads that look terrible on a
  home inkjet break the promise; test the grayscale rendering.

### 16. Calendar hooks

Seasonal and rescue-moment formats: back-to-school resets, summer
review packets, holiday units, and the documented November and
February burnout rescue windows.

- Evidence: seasonal packets dominate TPT merchandising
  (`marketplaces/teachers-pay-teachers.md`); burnout seasonality is
  documented in the segments research (ICP research §7 card 6) and
  echoed in every all-in-one churn section.
- Homa spec: the studio's ritual formats (pattern 3) get seasonal
  skins and a rescue register for burnout windows: lighter days,
  shorter pages, explicit permission framing, per the copy laws.
- Watch out: holidays are worldview-sensitive territory; the family's
  settings gate which calendar hooks exist at all.

## What not to build, restated

From `homa-implications.md`, binding on materials work: no child-facing
tutor personas, no cloned publisher pages, no teacher-life products
(planners, decor), no quiz-shaped defaults for gentle families, no
grade labels on child-facing pages, and no worldview signaling Homa
does not hold.

## Where this goes next

- Wire patterns 1, 2, 7, and 12 into the materials studio's generation
  contracts first; they are the highest-frequency and the most
  curriculum-aware (they consume atlas front matter and `sequences/`
  position).
- Pattern 11 (decodability) needs the reading-program sequence
  extractions before it can be a hard constraint.
- Calibration runs in `docs/homa-planning/materials/calibration/`
  should grow pattern-conformance checks alongside the existing
  quality rubric.
