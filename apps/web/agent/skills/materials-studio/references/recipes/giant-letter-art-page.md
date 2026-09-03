# Giant letter art page

Golden anchor: pass `anchorIds: ["giant-letter-art-page"]` to generate_image
so the output matches the Homa letter-art bar (one capital-lowercase pair on a
shared baseline drawn as a single thick uniform outline that fills the sheet,
an empty interior with no shading or fill, a one-line instruction and a short
name line up top, clear paper below the letters with no spot art, pure white
background everywhere with no paper texture or tint). Write your own prompt
with your own content; the anchor sets the visual bar, not the specifics.

One page-filling, thick-outline letter (a capital with its own lowercase, or
a single capital) that the child decorates however the house allows: paint,
dot stickers, torn tissue, cereal, glued buttons. The letter is a canvas,
not a tracing exercise: the child meets its shape by filling it, then the
page is cut out and kept, one letter per unit, until the pages make an
alphabet portfolio. Extracted from ref-2026-07-19-alphabet-pages-y1 (26
capital bubble letters, letter-only, "the letter IS the page"), the
alphabet-art-page recipe suggested while ingesting
cur-2026-07-19-playing-preschool-y1 (both cases, a few themed images at the
bottom), the large-letter-coloring page in
ref-2026-07-18-habitat-schoolhouse-prek-workbook5 (capital and lowercase on
one sheet), and the pre-K letter pages of ref-2026-07-17-human-heart-unit-study
(H h with one small heart) and ref-2026-07-18-beach-unit-study (B b with a
beach scene illustration). Every measurement below is Homa's own floor,
derived from a 0.75in dot sticker, the 7.3in x 9.5in html content box, and
Nunito Black's font file (1000 upm, cap 0.705em); none is a library extraction.

Great for: ages 2.5-6, letter recognition and letter sounds before any pencil
work, fine motor through gluing and sticking, play-based and letter-of-the-week
preschool programs, Spanish capital-lowercase pairs, and the pre-K page of a
family unit study. Not for motor memory of strokes
(letter-number-formation-practice), not for stamping circles
(dot-marker-activity), not for a laminated dough surface (playdough-mat), and
not for a scene around a letter or a crayon-only reward page (coloring-page).

## Creation paths

- **html (SVG derived outline)**: the default, and always the path for a
  portfolio set. One `<text>` per glyph in Nunito Black, filled white with a
  48-unit stroke painted under the fill (`paint-order: stroke fill`), so the
  visible line is the stroke's outer half: one clean 0.25in outline around the
  silhouette and inside its counters, whatever the font's contours do
  underneath. Identical letterforms across 26 pages at no image cost, a 2-3
  second letter swap, exact accented glyphs the image model does not hold
  reliably; no organic art, so CSS reads fine. Page `background: #fff`, set
  explicitly. Never stroke a `<text>` with `fill: none` (Fredoka's overlapping
  contours drew a line across the b's bowl that way, and its heavy B has one
  merged counter; anchor work, 2026-09-02). Nunito Black's B has two counters
  and its g is single-story; its a is the two-story book form, so a program
  that insists on the single-story a gets that one page image-direct, with
  "a single-story a" in the prompt.
- **image-direct**: one themed craft canvas where a hand-drawn bubble
  letter and its spot objects are the point ("a big S with three seashore
  animals"). Pass the golden anchor and spell out every count and size with
  the prompt template in the variants file (letter-number-formation-practice
  proved on 2026-09-02 that anchor plus explicit prompt holds a fixed template).
- **hybrid**: a themed portfolio set. HTML owns the letter and header; one
  generate_image call per page supplies the spot objects as one strip for
  the bottom band: `shape: "wide"`, no `anchorIds` (the anchor carries a
  letter and this call must not), prompt "black line art on a pure white
  background, no paper texture or tint, exactly [N, 1-3] objects in a row,
  [a boat, a bee, a button], each the same height and filling nearly the
  full image height, no text, no letters, nothing else." Place it as an
  `<img>` 7.3in x 1.25in, `object-fit: contain`, in the band at canvas y
  680-800, and set the page `background: #fff` explicitly, never a paper
  token, so strip and page meet with no seam. Rendered footprint: the
  variants file.

## Design patterns (all binding for giant-letter-art-page)

- **One letter per page.** A single capital, or one capital with its own
  lowercase. Never two different letters on a sheet, even when the
  curriculum introduces two in one unit (Playing Preschool pairs Cc with
  Jj; each still gets its own page). A digit 0-9 gets the same treatment.
  Sole exception: the digraph page (Scaffolded versions), where ch, ll, or
  rr is one letter of the family's own alphabet.
- **Case follows the curriculum.** Default to the capital and lowercase pair on
  one baseline (letters subject rule: they register as one letter). Capital only
  when the family's program does it (Playing Preschool's companion is 26
  capitals) or the parent asks; never gate case on age.
- **The letter fills the sheet.** Single capital: font-size 900 (cap 6.6in);
  A, M, Q, and W step down for width or tail (6.5, 6.3, 5.9, 4.55in), named
  in the reply. Pair, side by side: font-size = floor(562 / the two glyphs'
  ink widths in em, added), capped at 583 (4.28in); B b lands at 494
  (3.63in), and every unaccented pair holds the 3.5in floor except D d
  (3.39in), G g (3.47in), and Q q (3.28in), named in the reply. Stack A a,
  M m, O o, V v, and W w at 480 (3.52in). Descenders (g, j, p, q, y) drop
  0.19em below the shared baseline, so the baseline centers the
  ascender-to-descender extent and a descender page carries no spot band;
  a band never moves the baseline and sits about 1in below a no-descender
  pair's outline. Exact x, y, and font-size per layout: the variants file.
- **Size is a floor, not a target.** Once a letter size has rendered acceptably,
  by default or by a parent confirming a fix, it is a floor for every later
  revision of that material and for every other page in the same portfolio.
  Spot art, a longer instruction, or a theme never shrinks the letter; drop the
  extra or move it to the band, and ask before trading size away, never silently.
- **One uniform outline.** 0.25in (24 canvas units) everywhere, sitting just
  outside the filled glyph, rounded joins and caps, no shading, fill, double
  line, interior detail, or drop shadow: a small hand is about to fill the
  interior. Rounded sans-serif letterforms, one face for the whole portfolio.
- **Room for the medium.** Nunito Black's stem is 0.184em and the outline
  sits outside it, so the white interior is the letterform itself: about
  1.7in clear in a single capital's limb, 0.95in on a pair page at 494. A
  0.75in dot sticker fits both; the counters (the holes in a B, an a, an e)
  are tighter, so suggest paint, tissue, or smaller stickers there.
- **Header stays small.** A band at most 0.9in tall: the child's name line (at
  least 34px tall, 3.2in wide) on the right and one short instruction to the
  child on the left ("Fill your B with anything blue."), sentence case, one
  line, 20px Nunito 800. No page title: the letter is the title. No stroke
  arrows, starting dot, or centerline.
- **Clear margin for cutting.** At least 0.4in of empty paper on every side of
  the letter (the page margin supplies it when the glyph stays inside the
  canvas). The outline's outer edge is the cut edge; no separate dashed cut
  line, which is one more thing to cut around and reads as clutter.
- **Spot art is either none or one to three, count stated in the prompt.**
  Default none. When a unit theme or a sound game asks for it, one to three
  small line-art objects the child already knows, names beginning with the
  letter's sound, sit in a row in the bottom band, each at most 1.25in tall,
  evenly spaced, never inside or touching the letter, never with printed labels
  (the parent names them aloud; a label turns a sound game into a reading
  task). Playing Preschool's ingestion suggested a few themed images, the heart
  study uses one, the beach study adds a whole scene; three keeps the letter the page.
- **Ink-light.** White page on every path (`background: #fff` on html and
  hybrid, "pure white background" in every image prompt), the outline is the only
  ink, no border, wash, or gray; a border on a cut-apart page is ink thrown away.
- **Spanish and accented letters** (Homa's own extension; no reference item
  yet). The tilde on n and the accent on a vowel are the same 0.25in outline,
  one closed shape above the glyph, never a thin flick. Accents reach
  0.94-0.96em, so a single accented capital drops to 770 (cap 5.65in, named
  in the reply), an accented pair keeps the width rule on a lower baseline
  with no spot band, never stacks, and Á á and Ó ó land under the floor
  (3.39in and 3.28in, named). Geometry: the variants file.
- **Portfolio order follows the family, never the alphabet.** Ask which
  letter the current unit teaches, or read the sequence from their curriculum
  (Playing Preschool runs Aa, Rr, Nn, Cc, Jj by design). Build each letter as
  its own material so find_materials can pull one later; when she wants one
  book, 26 letters plus a cover exceed the 12-page cap: three volumes, her order.

## Scaffolded versions and variants

- **Starter page**: the first letter of the child's name, spelled the
  family's way; a guaranteed win for the first page in the book. Offer a
  single capital when the parent wants one giant shape to fill (a first
  page, a sticker-heavy medium); the pair stays the default at every age.
- **Pair page**: capital and lowercase on one baseline, the default.
- **Themed page**: pair plus one to three spot objects from the current
  unit (S s with a starfish, a shell, a sandcastle in a beach unit). On a
  descender letter, a stacked pair, or an accented pair, html and hybrid
  build the plain pair and the parent names the objects aloud; if she wants
  them on the page, image-direct with the template places them without a band.
- **Digraph page** (ch, ll, rr; only for a Spanish program that teaches
  them as letters, confirmed with the parent): lowercase only, one `<text>`
  holding both glyphs at x=350, y=566, font-size 583 (all three fit at the
  cap); no descenders, so the pair page's spot-band rule applies unchanged.
- **Portfolio cover**: one html page, the family's own title in big type
  ("Mila's Alphabet Book"), optional blank name line, no publisher's icon strip.
- **Numbers portfolio** (Homa's own extension; no reference item yet):
  digits 0-9, same rules, one digit per page.

## What not to do

- No tracing cues of any kind (arrows, numbered strokes, a starting dot, a
  dotted midline): that is formation practice, and mixing it in says "test".
- No circles inside the letter body (dot-marker-activity owns stamping); no
  "Playdough mat" label, laminate note, or 2-4 shapes per page (playdough-mat).
- No scene inside or around the letter. This is a stated deviation from
  ref-2026-07-18-beach-unit-study, which pairs B b with a beach scene: a scene
  fights the child's own decoration and doubles the ink on a page that gets
  cut apart. A parent who wants the scene gets coloring-page.
- Never shrink the letter to fit a theme, a title, or a second letter, and
  never a gray fill, pattern fill, or pre-decorated interior; the decoration
  is the child's.
- Never reproduce a publisher's bubble font, cover, or icon border. The
  library items above donate the mechanic, never the artwork.

## Worked HTML (pair page, side by side, no spot band)

```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&display=swap" rel="stylesheet">
<style>
  body { background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-end;
    height: 0.85in; font: 800 20px Nunito, sans-serif; color: var(--homa-ink); }
  .name { width: 3.2in; min-height: 34px; border-bottom: 2.5px solid var(--homa-ink); }
  .canvas { display: block; width: 7.3in; height: 8.6in; }
  .glyph { font-family: Nunito, sans-serif; font-weight: 900; fill: #fff;
    stroke: var(--homa-ink); stroke-width: 48; stroke-linejoin: round;
    stroke-linecap: round; paint-order: stroke fill; }
</style>
<div class="head"><div>Fill your B with anything blue.</div><div class="name"></div></div>
<svg class="canvas" viewBox="0 0 700 826" xmlns="http://www.w3.org/2000/svg">
  <!-- Nunito Black: B is 0.598em of ink (center offset +0.012), b 0.539em (+0.011). Size
       floor(562 / 1.137) = 494, cap 0.705em = 348 units = 3.63in; the visible outline is the outer
       24 units of the 48 stroke. Group left edge (566 - 1.137 * 494) / 2 = 2: B at x = 2 + 24 + 148 - 6
       = 168, b at x = 2 + 110 + 295 + 133 - 5 = 535, outlines 0.4in apart. Baseline y = 413 + 0.2625 *
       494 = 543 centers ascender to descender (b tops out at y=166; a g tail would end at y=660).
       Spot band: same baseline, canvas cut to viewBox 0 0 700 680, band <img> 7.3in x 1.25in below. -->
  <text class="glyph" text-anchor="middle" x="168" y="543" font-size="494">B</text>
  <text class="glyph" text-anchor="middle" x="535" y="543" font-size="494">b</text>
</svg>
```

Stacked, single, accented, digraph, and spot-band geometry, the width table,
and the image-direct template:
`/workspace/skills/materials-studio/references/recipes/giant-letter-art-page.variants.md`.
If the preview letterform is not Nunito, the font did not load; the quality check says so.
