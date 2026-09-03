# Reference poster / binder cover

Golden anchor: pass `anchorIds: ["reference-poster"]` to the one
generate_image call on every hybrid poster so the output matches the Homa
poster-illustration bar (one line-art subject filling a landscape frame
with a little air around it, thick clean warm brown and charcoal outlines,
one accent color at most on soft cream, no shading, no text anywhere).
The anchor sets the bar, not the subject, and it is the illustration band
alone, text-free, so the title and facts are always html.

Anchor landing: the anchor ships with this recipe in one PR
(`apps/web/lib/materials/anchor-sources/reference-poster.jpg`, a REGISTRY
entry in `apps/web/lib/materials/anchors.ts`, a `build-material-anchors`
rerun, the id in `anchors.test.ts`); `pnpm check:fleet-skills` fails until
the id resolves, so this file never lands ahead of the anchor.

Sourced patterns, from four library items: the illustration-plus-facts
info card and frameable single-subject posters in
`ref-2026-07-17-human-heart-unit-study`; the whole-sheet comparison poster
whose source admits its sizes are artistic, in
`ref-2026-08-01-watercolor-space-reference-cards`; the page-1 scene poster
(a winter forest holding twelve named animals and their tracks) in
`ref-2026-07-18-winter-animal-tracks-montessori`; and the two lyric sheets
tagged "poster" in `ref-2026-07-19-los-pollitos-unit1-activities`, which
taught the negative scope. Band heights, fact counts, word caps, and the
label-colon format are Homa's decisions, not source measurements.

What it is: one topic on one sheet, meant to hang on a wall or slide into
a binder's clear front pocket. Three bands, top to bottom: a title band
with the child's name, one dominant illustration (a single subject, a
labeled sequence, or a scene), and short labeled facts the child can read
from across the room. A display piece, not a worksheet: nothing to fill
in, nothing to answer. The reference chart (one exact grid, no facts
band) and the binder cover (no facts) change the bands.

Routing, four edits landing in the same change as this file:

1. SKILL.md format table row: `| Reference poster / binder cover | hang
   one topic on a wall: title, one dominant illustration, 3-8 labeled
   facts, nothing to fill in; also the html-alone reference chart
   (alphabet, multiplication, order of operations); not a labeled species
   grid (nature-identification-poster) or a parts diagram
   (labeled-anatomy-diagram) | reference-poster |`.
2. SKILL.md "Judgment rules": the "Coloring page or poster: image-direct"
   bullet is reworded so a coloring page stays image-direct, a poster is
   hybrid, and the reference chart is html alone, pointing here. The photo
   example "a poster of the child beside their favorite character" stays
   and builds as this recipe's hybrid poster.
3. SKILL.md creation-path table: the image-direct row's "Reaches its best
   on" cell drops "posters", so the table and the bullet share the rule.
4. `apps/web/agent/activity-formats.md`, the `[poster]` entry keeps its
   slug, name, and "Ages: 3-14"; its existing "Creation path" line names
   the two paths and this recipe. No new field. Exact wording for edits
   2 and 4: the variants file, "Landing edits".

Great for: ages 3-12 (the reference chart variant carries its own age
bands in the variants file, the order-of-operations chart reaching 14),
science, history and geography, unit study openers and closers, "what we
are learning" walls, math and alphabet wall charts, and binder covers.

Creation paths (two; the variant decides which, never habit):

- **hybrid, every poster except the reference chart**: one generate_image
  call, `anchorIds: ["reference-poster"]`, for the illustration band, no
  text in the image; html owns the title, name line, every fact, and the
  geometry. The binder cover, scene poster, color-it poster, and a toddler
  poster whose three facts are a label and a word each all take this
  path. Reason: fact sentences are the density SKILL.md already routes to
  html (image lettering degrades there), and poster revisions are wording:
  seconds and free in html, keeping the same image URL, where a whole-page
  image re-rolls the page each time (the 2026-07-10 calibration proved an
  image can spell a title, not that it is cheaper to revise).
- **html alone, the reference chart variant only**: a closed set of
  three: alphabet chart, multiplication table, order-of-operations chart.
  Every cell is an exact letter, product, or step that html owns, and the
  page is complete and correct with zero images. Its only image is
  optional spot art under the order-of-operations steps, one small
  generate_image call with `anchorIds: ["order-of-operations-chart"]`, the
  fleet anchor that already exists; the other two charts carry no image
  (no anchor names them, and the anchor rule forbids a near-miss).
  Geometry in the variants file. A chart outside the set is a fact poster
  (hybrid) unless it is phonics (phonics-pattern-reference-chart) or asks
  the child to read a graph (chart-and-graph-skill-practice).

Design patterns (binding on every hybrid poster; the reference chart
keeps the title band and the ink rules and swaps the rest for its grid):

- **Three bands, exact heights in the 7.3in x 9.5in content box**: title
  1.2in, illustration 5.0in, facts 3.3in. Only the 5-fact rung of the
  ladder below gives 0.4in of illustration to the facts (1.2in, 4.6in,
  3.7in), never the reverse; two columns at 6-8 facts fit inside 3.3in,
  so the illustration keeps 5.0in. Never add a fourth band.
- **Title band**: one topic title of 2 to 5 words and at most 20
  characters, no single word past 15, at 48px Fredoka, line-height 1,
  left-aligned; that almost always wraps to 2 lines or fewer, 106px inside
  the 115.2px band (width arithmetic in the variants file). A title that
  still needs a third line (one 13-letter word between two short ones can)
  gets shortened, never set smaller. The name line sits at the right of
  the same band: `Name: ______` (blank at least 34px tall and 2.2in wide)
  or the child's name pre-printed, spelled as the family spells it.
- **One dominant illustration, one generate_image call**: a single
  subject, a labeled sequence (8 moon phases in one image, left to
  right), or one scene containing every item the facts mention. The
  prompt names your own subject, copying nothing from the anchor's, and
  asks for the illustration only (no text, letters, or numbers). Shape
  landscape (1536x1024) on every hybrid poster except the binder cover;
  with `object-fit: contain`, centered, its shorter side is at least
  4.2in in the 5.0in and 4.6in bands alike (fit arithmetic in the variants
  file). Never two images, never a species grid, never sprite slicing.
- **Facts band**: 3 facts at ages 3-5, 4-5 at 6-7, 5-8 at 8-10, 3-4 at
  11-12 with a higher word cap. Each fact is one sentence opening with a
  bold 1-3 word label and a colon ("Wings: four wings that beat about
  200 times a second." is 10 words, the 3-fact rung's cap). Columns, type
  size, and the word cap come from the ladder, never from habit; the cap
  counts every word, label included, and a fact at its cap or one word
  under holds the ladder's line count. Every rung is 20px or larger (16px
  is a desk floor; a wall is read from farther). Round dot bullets by
  default; numbered for a sequence (the `.sequence` counter in the
  variants file). The html box cuts off overflow and never shrinks, so a
  clipped fact is a build failure: cut or shorten, never drop the size.
- **Two columns at 6-8 facts**: `grid-template-columns: 1fr 1fr;
  column-gap: 16px;` and explicit rows, `grid-template-rows: repeat(3,
  auto)` at 6 facts, `repeat(4, auto)` at 7-8: always the ceiling of
  facts / 2, never 4 rows for 6 facts. Fill order: `grid-auto-flow:
  column` for a sequence (1-3 down the left, 4-6 down the right; at 7,
  four left and three right), default row flow otherwise; both give the
  same row count. A row is the rung's line count times 28.6px (22px x
  1.3): 85.8px at 6 facts, 57.2px at 7-8. Under the 115.2px title and
  480px illustration, 912px - 595.2px = 316.8px remains, so the tallest
  rung (289.4px) fits with 27.4px to spare and the 7-8 rung (270.8px)
  with 46px, both inside the 0.5in rule. A 7-word fact spilling to a
  third line fits once (299.4px), clips twice (328px); at 6 facts any
  spill clips (318px): the caps are exact.
- **Facts are checkable public facts** in the child's own words, units on
  every number; unsure of a number, use a qualitative fact. Never a
  publisher's wording, order, or fact list (the heart study's info card
  taught the shape, not its sentences).
- **Honest about scale**: when the illustration compares sizes or
  distances (planets, a whale beside a bus), make the ratio true or set
  "Not to scale" in 16px ink at the illustration's lower corner, as the
  space cards' source admits and Homa says.
- **Scale to the bottom**: the ladder's type sizes are set so facts
  written to their word cap end within 0.5in of the band's bottom. The
  band fills by type size, never by gap: row gap stays 10px and the list
  uses `align-content: start`, never `space-evenly` or `space-between`.
  No "try this together" box: the display is the whole page.
- **Size is a floor, not a target.** Once the illustration and fact type
  have rendered at a size the parent accepted, that size is a floor for
  every later revision: an added fact or a longer title never shrinks
  them on its own. Cut or shorten a fact, or move to two columns; if
  nothing else closes the gap, ask the parent first. The one exception is
  the 5-fact rung: when she agrees to a fifth fact, the rebuilt rung
  (4.6in art, 22px type) is the new floor from then on.
- **Ink-light, grayscale-safe**: line art with thick clean outlines, one
  accent color at most, cream or white page, no full-bleed background, no
  border frame (a 2px rule under the title band is the most a poster
  gets). The heart study ships one heart five ways, two black-and-white; a
  poster gets printed more than once.

Facts ladder (binding; Andika, line-height 1.3, row gap 10px, 12px top
padding, 28px bullet indent; character arithmetic in the variants file).
At 6-7 use the 4-fact rung by default; take the 5-fact rung only when the
parent names five things the poster must say, since it alone shrinks the
illustration. At 8-10 build the count the parent named, 6 when they named
none; at 11-12 build 4, or 3 when the parent asks for depth over count.
Caps assume average words; a long-worded fact gives up one. "Band used"
is rows x row height + row gaps + 12px padding.

| Facts | Age | Columns | Bands: title / art / facts | Type | Words, label included | Lines each fact holds | Rows x row height | Band used / band |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 3-5 | 1 | 1.2 / 5.0 / 3.3in | 34px | 10 | 2 | 3 x 88.4px | 297.2 / 316.8px |
| 4 | 6-7 | 1 | 1.2 / 5.0 / 3.3in | 26px | 12 | 2 | 4 x 67.6px | 312.4 / 316.8px |
| 5 | 6-7 or 8-10 | 1 | 1.2 / 4.6 / 3.7in | 22px | 14 | 2 | 5 x 57.2px | 338.0 / 355.2px |
| 6 | 8-10 | 2 | 1.2 / 5.0 / 3.3in | 22px | 10 | 3 | 3 x 85.8px | 289.4 / 316.8px |
| 7-8 | 8-10 | 2 | 1.2 / 5.0 / 3.3in | 22px | 7 | 2 | 4 x 57.2px | 270.8 / 316.8px |
| 3 | 11-12 | 1 | 1.2 / 5.0 / 3.3in | 22px | 20 | 3 | 3 x 85.8px | 289.4 / 316.8px |
| 4 | 11-12 | 1 | 1.2 / 5.0 / 3.3in | 22px | 15 | 2 | 4 x 57.2px | 270.8 / 316.8px |

Variants: landing edits, binder cover, scene poster, color-it poster,
reference chart geometry, illustration fit, title-band width, the
two-column and one-column character arithmetic, numbered-sequence rules,
worked HTML (4-fact rung; other rungs swap the grid rows and `.facts li`
size), and the prompt template live in
`/workspace/skills/materials-studio/references/recipes/reference-poster.variants.md`.

What not to do:

- A grid of many labeled species: nature-identification-poster owns that.
  Leader lines, numbered parts, a word bank: labeled-anatomy-diagram owns
  that, even when the parent says "poster." A page read once with a check
  question at the foot: illustrated-teaching-page owns that; a poster has
  nothing to answer. A page whose only job is to be colored: coloring-page
  owns that; the color-it variant still carries a title and facts.
- A song, chant, or rhyme sheet: chant-and-rhyme-card owns that (the two
  Los Pollitos lyric sheets were tagged "poster" and belong there). Dated
  events in a row: biography-timeline-page owns that.
- A whole poster as one image, facts or a title baked into the image, two
  generated images on one poster, a picture inside a reference chart's
  grid, sibling comparison, scores, or a "you should know this" fact.

Final quality gate:

- One topic, one illustration, three bands at the rung's heights; fact
  count, columns, type size, and word cap match one ladder rung for the
  child's age; two columns only at 6-8 facts, rows the ceiling of facts /
  2, column flow only for a sequence; bold labels, units on numbers.
- Title at most 20 characters on at most 2 lines; nothing in the image
  reads as text; every word on the page is html.
- Last fact fully visible within 0.5in of the band's bottom, name blank
  34px or taller: no dead band, no clipped fact, no spread gaps. Line
  art, one accent color at most, no full-bleed fill, no frame.
- Reference chart: every letter, product, and step exact and re-checked;
  the grid fills its band; no picture in any cell; spot art, only when the
  parent asked and only on the order-of-operations chart, sits in the
  foot strip with `anchorIds: ["order-of-operations-chart"]`.
