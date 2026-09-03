# Counting and manipulative mat

Golden anchor: pass `anchorIds: ["counting-and-manipulative-mat"]` to
generate_image so the output matches the Homa counting-mat bar (one small
theme object drawn as clean warm brown and charcoal line art, no fills,
white background, no text, letters, or numerals, sized to sit inside a
label band). Write your own prompt with your own content; the anchor sets
the visual bar, not the specifics.

A page the child works ON, not IN. The mat has numbered or themed spots,
a five- or ten-frame, or stacking columns, and the child sets real
things on it: buttons, dry beans, cereal, coins, pom-poms, small toys,
playdough balls, linking cubes. Nothing is written. Laminated or slipped
into a sheet protector, one mat carries a whole season of counting, and
the same sheet works with whatever is in the kitchen drawer today.
(Patterns extracted from ref-2026-07-18-habitat-schoolhouse-prek-workbook5,
the numbered strawberry page that asks for "buttons, coins, stones or
whatever item you choose" on four numbered spots, built for lamination;
ref-2026-07-18-habitat-schoolhouse-prek-workbook1, the cloud count page
where the child places an item on each cloud: it ends in a how-many
answer box, which this recipe drops so the mat stays reusable;
ref-2026-07-17-dm-WKA2, five-frames as the key representation for
counting to 5 and 10; ref-2026-07-17-dm-WKB6, number bonds with linking
cubes handed out before each page; and ref-2026-07-17-dm-WPKA, PreK
(48-60 months) pages that work with no numerals at all, which is why a
pre-numeral variant exists. The dot cluster as the pre-numeral label, the
`compare-two` mechanic, and the staircase reading of stacking columns are
Homa design derivations, not extracted patterns; no cited source shows
quantity comparison.)

Great for: ages 2-7 (age 2 comes from the page-density table; the cited
sources start at 36 months), one-to-one counting, cardinality ("how many
altogether?"), subitizing small groups, composing and decomposing numbers
to 5 and 10 (number bonds, adding on), more/fewer comparison, and any
family that teaches concrete before pictorial: Montessori, Singapore Math
(CPA), play-based, and daily-life grounding all pair a mat with the lesson.

Not for pressing dough into the SHAPE of a numeral or letter; playdough-mat
owns that (dough is a counter here, never the thing being formed). Not for
sorting cut-out pieces into category columns; classification-sorting-mat
owns that. Not for a pencil counting page where the child writes "how
many" in a box; that is the counting subject rules plus the html Counting
sketch in SKILL.md, or number-practice-page when one numeral is the focus.
Not for the companion ten-frame widget in SKILL.md's Manipulatives section,
which is dropped onto another page and sized for cubes; a standalone frame
mat sized to one-inch counters is this recipe. Not for a workbook page that
ends in a number sentence or answer box, even with ten-frames and number
bonds; singapore-workbook-page owns that, so a Singapore Math parent asking
to "make 5 two ways" gets this mat only when nothing will be written; this
mat is the concrete stage that page assumes.

Creation paths:

- html by default. Every spot, cell, and column is sized to a real one-inch
  counter and every numeral is exact by construction; a laminated mat cannot
  be re-rolled, so exact geometry is the html path's whole strength.
- hybrid when the parent wants a theme (nests, ponds, plates, a favorite
  animal). Generate ONE object on a white background with no text or
  letters, passing `anchorIds: ["counting-and-manipulative-mat"]` on that
  one call (the only generate_image call this recipe makes). Repeat it once
  per spot inside the label band at band height, or place it once as corner
  art; the placement zone stays empty and HTML keeps the numeral, dots,
  frame, and instruction line. Never generate a composed multi-spot sheet and
  float HTML numerals over it: the image model has no pixel grid and print
  positions backgrounds differently from screen, so numerals land beside the
  wrong spot (the sprite-slicing scar in SKILL.md).
- Never image-direct. SKILL.md's creation-path table lists exact curriculum
  geometry and cheap surgical revisions as its weaknesses; this mat is both,
  and a laminated sheet has no cheap revision: a wrong count is wrong for
  the year.

Design patterns (all binding for counting-and-manipulative-mat):

- **One mechanic per mat**, drawn from this closed set: `numbered-spots`
  (place N counters on the spot labeled N), `five-frame` or `ten-frame`
  (fill cells to show a number), `part-part-whole` (two part zones under a
  whole zone; compose or decompose one target), `stacking-columns` (build
  a tower of N cubes in the column labeled N), `compare-two` (two big
  spots, put a group on each, point to more). Never mix two mechanics on
  one sheet; a second mechanic is a second mat. Geometry and snippets for
  every mechanic other than `numbered-spots` live in the variants file:
  `read_file /workspace/skills/materials-studio/references/recipes/counting-and-manipulative-mat.variants.md`.
- **The lane rule sizes every zone.** A one-inch counter (bingo chip,
  pom-pom, milk cap, dough ball) needs a lane 1in tall, and one lane holds
  one counter per inch of zone width: a 3.5in lane holds three, a 7.2in
  lane seven. Whenever N exceeds one lane, the zone is at least 2in tall
  (two aligned lanes; 1.9in staggered is the bare minimum, never plan to
  it) and at least 3in tall past two lanes. Area alone (about 1.2 sq in per
  counter) is necessary, never sufficient: a 7.2in x 1.7in strip is 12.5 sq
  in and still holds seven, not ten. Zones are never under 3.2in wide by
  1.6in tall of open surface. Frame and stacking cells are at least 1.2in
  square (1.25in in the worked snippets) with a 3px outline for loose
  counters; for linking cubes (the WKB6 manipulative; a standard cube is
  0.75in) cells are 0.85in square. Write nothing inside a zone.
- **Spot count follows the page-density table**: 2-3 spots at ages 2-3,
  4 spots at ages 4-5 (the 2x2 grid), and at ages 6-7 the density is
  carried by cells or columns, never a fifth numbered spot: two stacked
  ten-frames, a 1-5 stacking run, or part-part-whole to 10. The range comes
  from the child's evidence, never from age. `numbered-spots` layouts in
  the 7.85in the worked grid leaves: two or three targets to 3 sit one per
  row in one column (three rows are 2.52in, zones about 7.2in x 1.7in, one
  lane of seven); four targets from 1 to 5 sit in the 2x2 grid (rows 3.85in,
  zones about 3.5in x 3.1in, two lanes of three, so 5 fits); targets 6 to
  10 sit one per row in one column, at most two per mat (rows 3.85in, zones
  about 7.2in x 3.1in, two lanes of seven), and a single-target mat is the
  one-row case (zone about 7.2in x 7.1in). Past 10 is a ten-frame or
  part-part-whole, never spots.
- **Label band, not label inside**: each spot and frame carries a 0.7in
  band along its top edge (about 64px of interior under its 3px bottom
  rule) with the numeral at 56 to 62px (the 64px interior is the ceiling;
  the band carries `overflow: hidden`, so a taller digit clips inside the
  band instead of spilling into the zone) and, beside it, exactly N dots as
  a subitizing reference: 10-12px dots in a real five-frame arrangement (a
  5-column mini grid or inline SVG, one row for 1 to 5, two rows for 6 to
  10), never a letter-spaced string of bullets. The child's check is "count
  your counters, then count the dots." Counters go below the band, so the
  label stays visible under a full spot. Pre-numeral variant: dots only, no
  digit. Binds for spots and frames; the variants file declares the three
  exceptions: stacking-columns (numeral under the baseline, no band),
  compare-two (band kept, empty or theme object), and part-part-whole (the
  band of whatever the child is finding stays empty: the whole band when
  composing, both part bands when decomposing).
- **Size is a floor, not a target.** Once a spot, cell, or column size has
  rendered acceptably, it is a floor for every later revision: a fix for
  something else (a title, a theme image) never shrinks a zone below the
  lane rule. Drop a spot, drop the try-this row, or split onto a second
  mat, and ask the parent before trading size away, never silently.
- **Thick, laminate-safe outlines**: `border: 4px solid var(--homa-ink)`
  on every spot, `3px` on frame cells, `border-radius: 18px` on spots, no
  fills, no gray backgrounds, no edge-to-edge color. Grayscale-safe by
  construction; the color on this page is the counters.
- **Spots stay together and fill the sheet**: even 0.15in gutters, rows
  sized so the last row reaches the bottom of the content box; four spots
  fill the 2x2 grid exactly and a single-column run fills its rows the same
  way. Never spread spots across the width with air between them.
- **One instruction line, to the child, under the title**: "Put that many on
  each spot." "Fill the frame to show 7." Short enough to read aloud once.
- **Name line up top**, then the title at 30px or more. No logo or brand banner.
- **One parent line at the bottom**, small (12px): what to use from the
  house and that a sheet protector or lamination makes it last the year.
  Name household counters; never send her shopping.
- **No answer key page.** Nothing is written, so there is no work to key;
  the math answer-key law governs pages with written answers.
- **Frames are exact**: frame and part-part-whole geometry in the variants file.
- **Stacking columns fit a 1-5 run only**: exactly N outlined cells per
  column on a shared baseline, numeral below; a 6-10 run is 12.5in of cells
  and fits no sheet, so 6-10 is a ten-frame or part-part-whole mat instead.

What not to do:

- No "how many?" answer box. The moment the child writes, it is a
  worksheet, and the mat stops being reusable.
- No picture inside the placement zone; the one theme object stays small
  in the band or the corner so the zone reads as empty surface.
- No shrinking spots to fit more numbers. A range to 10 is the 2x2 mat for
  1 to 4 plus single-column mats of two targets each (5-6, 7-8, 9-10), or a
  ten-frame, never ten small spots and never a fifth spot on the 2x2 mat.
- No counts, dots, or numerals rendered by the image model. No scores, no
  red pen, no "can you beat" language.

Worked HTML (numbered-spots mat, targets 1 to 4 for a 4-5 year old, fills
the 7.3in x 9.5in content box). The mat grid leaves 9.5 - 0.9 - 0.45 - 0.3
= 7.85in for spots; the 2x2 grid with one 0.15in gutter makes rows of
(7.85 - 0.15) / 2 = 3.85in and columns of (7.3 - 0.15) / 2 = 3.575in.
After 8px of outline (0.08in) and the 0.7in band each zone is about 3.5in
x 3.1in: two aligned lanes of three, so the 4 spot (or a 5 spot on a 2-5
mat) fits, and the 56px numeral sits inside a 64px band without clipping.
An optional try-this row (`.try`, 0.7in, between the grid and the parent
line) costs the grid 0.7in: rows drop to 3.5in and zones to about 3.5in x
2.7in, still two lanes, so every target to 5 still fits.

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap" rel="stylesheet">
<style>
  .mat { font-family: Fredoka, sans-serif; color: var(--homa-ink); display: grid;
    grid-template-rows: 0.9in 0.45in 1fr 0.3in; height: 9.5in; }
  .name { font-size: 18px; border-bottom: 2px solid var(--homa-control-boundary); align-self: end; margin-bottom: 8px; }
  .title { font-size: 32px; font-weight: 600; display: inline-block; margin-right: 18px; }
  .say { font-size: 20px; }
  .spots { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: 0.15in; }
  .spot { border: 4px solid var(--homa-ink); border-radius: 18px; display: grid; grid-template-rows: 0.7in 1fr; }
  .band { display: flex; align-items: center; gap: 18px; padding: 0 14px; border-bottom: 3px solid var(--homa-ink); overflow: hidden; }
  .num { font-size: 56px; font-weight: 600; line-height: 1; }
  .dots { display: grid; grid-template-columns: repeat(5, 12px); gap: 5px; }
  .dots i { display: block; width: 12px; height: 12px; border-radius: 50%; background: var(--homa-ink); }
  .zone { /* open surface for counters, keep it empty */ }
  .try { border: 2px dashed var(--homa-control-boundary); border-radius: 18px; padding: 12px 14px; font-size: 16px; }
  .parent { font-size: 12px; color: var(--homa-control-boundary); align-self: end; }
</style>
<div class="mat">
  <div class="name">Name</div>
  <div><span class="title">Counting mat</span><span class="say">Put that many on each spot.</span></div>
  <div class="spots">
    <div class="spot"><div class="band"><span class="num">1</span><span class="dots"><i></i></span></div><div class="zone"></div></div>
    <div class="spot"><div class="band"><span class="num">2</span><span class="dots"><i></i><i></i></span></div><div class="zone"></div></div>
    <div class="spot"><div class="band"><span class="num">3</span><span class="dots"><i></i><i></i><i></i></span></div><div class="zone"></div></div>
    <div class="spot"><div class="band"><span class="num">4</span><span class="dots"><i></i><i></i><i></i><i></i></span></div><div class="zone"></div></div>
  </div>
  <div class="parent">Use buttons, beans, cereal, coins, or dough balls. A sheet protector or lamination makes this mat last the year.</div>
</div>
```

Final quality gate:

- Every numeral matches its dot count; every frame has exactly its cell
  count; every stacking column has exactly N cells and no run passes 5;
  no mat carries more than four numbered spots, and targets 6 to 10 sit one
  per row, at most two per mat; at ages 6-7 the density is carried by cells
  or columns, never a fifth spot.
- Every zone passes the lane rule for the largest count it must hold (one
  counter per inch of width per lane, at least 2in tall past one lane),
  nothing is drawn inside one, no zone is under the 3.2in x 1.6in floor,
  and no numeral clips its band.
- The last row reaches the bottom of the content box; no dead band, no
  spots spread thin.
- Theme art is one generated object, repeated by HTML inside bands or
  placed once as corner art, no text in the image; the numerals are HTML.
- One mechanic, one instruction line, one parent line, no answer box.
