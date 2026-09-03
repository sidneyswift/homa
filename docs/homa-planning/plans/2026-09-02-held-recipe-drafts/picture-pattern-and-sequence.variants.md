# Picture pattern and sequence: variants

Companion to the picture variant section of `cut-and-paste-word-work.md`.
Every binding pattern there (1.25in piece floor, 1.375in targets, the fixed
four-cells-plus-gap row at 6.875in, three pattern rows, the one landscape
3 x 2 composed sheet at 1.75in cells and 1.925in targets, shuffled sheet,
wordless pieces, the 96px header, answer key on its own page) still binds
here; this file only carries the worked markup and the prompt template so
the recipe stays a router. Every size is an outer size: `box-sizing:
border-box` is set on each cell, gap, target, and piece below, and the
line-heights are pinned so the header is exactly 34 + 8 + 24 + 6 + 24 =
96px (1in) on both pages.

## Composed-sheet prompt template (`sequence`)

One call, `shape: "landscape"`, `anchorIds: ["cut-and-paste-word-work"]`.
The shape returns 1536 x 1024, so a 3 x 2 grid of equal cells is six 512px
squares; the prompt never mentions a ratio, size, or pixel count. Every
count stated: "Warm hand-drawn line art on a plain white background: a grid
of exactly {K} objects, three across and two down, six equal square cells,
each object centered in its own cell with white space at least a quarter
cell wide on every side. No text, no numbers, no frames, no tiles, no grid
lines, no shadows. In reading order: {object 1}, {object 2}, ..." listed in
the shuffled sheet order, distractor included at ages 6+; when K is under
six add "the last {6 - K} cells, ending bottom right, stay empty white".
K is the piece count plus the one distractor when a cell is spare at
ages 6+, so K is 4, 5, or 6.

Sheet math, the same on every `sequence` page: `.pcp-sheet` is 5.25in wide
with `aspect-ratio: 3 / 2`, so it stands 3.5in (5.25 x 1024 / 1536) and the
image fills it edge to edge under `object-fit: contain` (both are 3:2, no
letterbox). The overlay's six cells are 5.25 / 3 = 1.75in wide and
3.5 / 2 = 1.75in tall, the piece cell the recipe states, and each maps to
one 512px cell of the image. Undrawn spare cells are `.pcp-piece.pcp-spare`
(no border), always the last in reading order.

## Themed `pattern` (ages 4-7, the hybrid path for a pattern page)

Two path-2 calls, `shape: "square"`, the same anchorIds: "one {object}
isolated on white, warm hand-drawn line art with a thick outline, no text,
no frame, no shadow", one per element. Swap each `.pcp-shape` div in the
pattern page for `<img src="{{a_url}}" alt="">` or
`<img src="{{b_url}}" alt="">`; the two URLs repeat across every row cell
and strip piece. Nothing else changes.

## Shared styles (paste above either page)

```html
<style>
  .pcp-cell, .pcp-gap, .pcp-piece, .pcp-target { box-sizing: border-box; }
  .pcp-name { font-size: 18px; line-height: 34px; color: var(--homa-ink);
    margin-bottom: 8px; }
  .pcp-name span { display: inline-block; width: 3in; height: 34px; vertical-align: bottom;
    margin-left: 6px; border-bottom: 1.5px solid var(--homa-control-boundary); }
  .pcp-instr { font-size: 20px; line-height: 24px; font-weight: 600; color: var(--homa-ink);
    margin: 6px 0; }
  .pcp-cut { border-top: 2.5px dashed var(--homa-control-boundary); margin: 26px 0 10px;
    padding-top: 4px; text-align: center; font-size: 16px; line-height: 18px;
    letter-spacing: 0.1em; color: var(--homa-control-boundary); }
  .pcp-piece { border: 2px dashed var(--homa-control-boundary); border-radius: 8px;
    display: grid; place-items: center; }
  /* pattern: CSS shapes, outlines only; themed pages put an img in the same slot */
  .pcp-row { display: flex; align-items: center; gap: 12px; margin: 22px 0; }
  .pcp-cell, .pcp-strip .pcp-piece { width: 1.25in; height: 1.25in; }
  .pcp-cell { border: 2px solid var(--homa-ink); border-radius: 8px;
    display: grid; place-items: center; }
  .pcp-shape { width: 60%; height: 60%; border: 3px solid var(--homa-ink); }
  .pcp-circle { border-radius: 50%; }
  .pcp-square { border-radius: 4px; }
  .pcp-cell img, .pcp-strip .pcp-piece img { width: 80%; height: 80%; object-fit: contain; }
  .pcp-gap { width: 1.375in; height: 1.375in; border-radius: 8px;
    border: 2.5px dashed var(--homa-control-boundary); }
  .pcp-strip { display: grid; grid-template-columns: repeat(3, 1.25in); gap: 16px;
    justify-content: center; }
  /* sequence: three-column targets, then the landscape sheet under a 3 x 2 overlay */
  .pcp-targets { display: grid; grid-template-columns: repeat(3, 1.925in); gap: 12px;
    justify-content: center; margin: 18px 0; }
  .pcp-target { height: 1.925in; border: 2.5px dashed var(--homa-control-boundary);
    border-radius: 8px; display: grid; place-items: center;
    font-size: 28px; font-weight: 700; color: var(--homa-control-boundary); }
  .pcp-sheet { position: relative; width: 5.25in; aspect-ratio: 3 / 2; margin: 0 auto; }
  .pcp-sheet img { position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain; }
  .pcp-overlay { position: absolute; inset: 0; display: grid;
    grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); }
  .pcp-overlay .pcp-piece { border-radius: 0; }
  .pcp-overlay .pcp-spare { border: none; }
</style>
```

## Page 1: `pattern` (html, AB with circle and square, three rows)

Height: header 96 + row margin 22 + three 1.375in rows (3 x 132 = 396) with
two 22px margins between them (44) + 26 (row margin collapsed into the cut
line's) + cut line 24.5 (2.5 border + 4 padding + 18 text) + 10 + strip 120
= 738.5px, about 7.7in of the 9.5in box. Row width 4 x 1.25 + 1.375 +
4 x 12px = 6.875in; strip 3 x 1.25 + 2 x 16px = 4.08in (four columns at
ages 6-7: 5.5in). A fourth row would add 154px (892.5px, 9.3in); the recipe
never authorizes one.

```html
<div class="pcp-name">Name:<span></span></div>
<div class="pcp-instr">Cut out the pieces.</div>
<div class="pcp-instr">Glue each one where it belongs.</div>

<!-- row 1 starts with the circle, so the gap wants a circle -->
<div class="pcp-row">
  <div class="pcp-cell"><div class="pcp-shape pcp-circle"></div></div>
  <div class="pcp-cell"><div class="pcp-shape pcp-square"></div></div>
  <div class="pcp-cell"><div class="pcp-shape pcp-circle"></div></div>
  <div class="pcp-cell"><div class="pcp-shape pcp-square"></div></div>
  <div class="pcp-gap"></div>
</div>
<!-- row 2 starts with the square (gap wants a square); row 3 starts with
     the circle again (gap wants a circle): three rows, always -->
<div class="pcp-cut">✂️ cut along this line</div>
<div class="pcp-strip">
  <div class="pcp-piece"><div class="pcp-shape pcp-square"></div></div>
  <div class="pcp-piece"><div class="pcp-shape pcp-circle"></div></div>
  <div class="pcp-piece"><div class="pcp-shape pcp-circle"></div></div>
  <!-- one piece per gap, shuffled (targets read circle, square, circle;
       the strip reads square, circle, circle, neither a match nor a
       mirror); at ages 6-7 a distractor adds a fourth column:
       grid-template-columns: repeat(4, 1.25in) -->
</div>
```

## Page 2: `sequence` (hybrid, six pieces, one landscape 3 x 2 sheet)

Height: header 96 + 18 (targets margin) + two 1.925in target rows
(2 x 184.8 = 369.6) with a 12px gap (381.6) + 26 (targets margin collapsed
into the cut line's) + cut line 24.5 + 10 + sheet 3.5in (336) = 892.1px,
about 9.3in, 20px under the 912px box: no extra line fits above the
targets. Targets 3 x 1.925 + 2 x 12px = 6.025in wide inside 7.3in. Four or
five pieces use this exact page: targets 1 to 3 fill the first row and the
rest start the second, and the sheet's spare cells (the last in reading
order) get `pcp-spare` so no cut line is drawn around empty white.

```html
<div class="pcp-name">Name:<span></span></div>
<div class="pcp-instr">Cut out the pieces.</div>
<div class="pcp-instr">Glue each one where it belongs.</div>

<div class="pcp-targets">
  <div class="pcp-target">1</div>
  <div class="pcp-target">2</div>
  <!-- through 6 in reading order; scaffolded: a label under each number -->
</div>
<div class="pcp-cut">✂️ cut along this line</div>
<div class="pcp-sheet">
  <img src="{{sheet_url}}" alt="">
  <div class="pcp-overlay">
    <div class="pcp-piece"></div>
    <!-- six empty dashed cells, one per cell of the composed image; a
         four-piece page at ages 4-5 gives the last two
         class="pcp-piece pcp-spare"; at ages 6+ the fifth holds the
         distractor and only the sixth is spare -->
  </div>
</div>
```
