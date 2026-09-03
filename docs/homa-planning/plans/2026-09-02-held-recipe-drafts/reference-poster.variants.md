# Reference poster / binder cover: variants

Companion to `reference-poster.md`. Every binding pattern there (three
bands, text-free anchor, html title and facts, the facts ladder, size as a
floor, ink-light line art) still binds here; this file carries the variant
geometry, the fit arithmetic, the worked HTML, and the prompt template.
Two creation paths, and the variant decides: every poster is hybrid (one
generate_image call with `anchorIds: ["reference-poster"]`, html for the
title band and the facts band) except the reference chart, which is html
alone (its only image is optional spot art on the order-of-operations
chart, `anchorIds: ["order-of-operations-chart"]`). The content box is
7.3in x 9.5in, 700.8px x 912px at 96px per inch.

## Landing edits (exact wording for the recipe's routing edits 2 and 4)

- SKILL.md "Judgment rules", the "Coloring page or poster: image-direct"
  bullet becomes: "Coloring page: image-direct. Put any exact wording in
  quotes in the prompt. A poster is hybrid, and its reference chart
  variant is html alone; read reference-poster." One home for the rule.
  The photo-personalization example "a poster of the child beside their
  favorite character" stays as written: it is this recipe's hybrid poster
  with the photo passed as the one illustration call's reference.
- `apps/web/agent/activity-formats.md`, the `[poster]` entry: slug, name
  "Poster / reference chart", and "Ages: 3-14" stay (planner activities
  tagged `[poster]` still resolve; the order-of-operations chart reaches
  14). Its existing "Creation path" line becomes "hybrid; html alone for
  the reference chart variant (alphabet, multiplication, order of
  operations); procedure in the reference-poster recipe". No new field:
  the entry is the format registry, the recipe is the procedure.

## Binder cover (hybrid)

Bands become title 2.2in, illustration 6.0in, footer 1.3in (2.2 + 6.0 +
1.3 = 9.5in). Title 60px or larger, one illustration, zero facts. Pass
`shape: "square"` (1024x1024) for the cover illustration: with
`object-fit: contain` a square image fills the full 6.0in (576px) band
height and sits centered with (700.8px - 576px) / 2 = 62.4px, 0.65in, of
air on each side, so the band is the illustration, edge to edge. A
landscape image in the same band would be width-limited at 700.8px, so
700.8 / 1.5 = 467.2px, 4.87in tall, leaving 1.13in of dead air, which is
why the landscape default does not apply here. The heart study's cover
shows only a script title and one illustration; the pre-printed child's
name at 30px under the title ("Ellie's science binder") and the single
subject-and-year footer line ("Science · 2026-2027") are Homa's additions
with no library source.

## Scene poster (unit opener, hybrid)

One illustration that shows every item the unit will cover in one setting
(the winter forest with all twelve animals and their tracks), and the
facts band names the items in the order the child will meet them. Facts
stay at the ladder rung for the child's age; the scene carries the rest.
Shape landscape, bands per the rung.

## Color-it poster (hybrid)

The default line art already colors well; add nothing. Do not thin the
outlines or add gray fills for this variant. It still carries the title
and facts.

## Illustration fit (hybrid path)

A landscape image is 1536x1024, a 1.5 ratio, and the band is 700.8px
wide. In the 5.0in (480px) band it is width-limited (480 x 1.5 = 720px
would overflow), so it renders 700.8px wide by 467.2px tall, 4.87in. In
the 4.6in (441.6px) band of the 5-fact rung it is height-limited
(441.6 x 1.5 = 662.4px fits), so it renders 662.4px wide by 441.6px tall,
4.6in. The shorter side is at least 4.2in either way, which is the floor
the recipe states.

## Reference chart (html alone)

The wall chart the `[poster]` slug has always covered. A closed set of
three kinds; every cell is exact text or arithmetic Homa writes and
re-checks, and the page is complete and correct with zero images: no band
waits on a picture. The title band is the poster's own (1.2in, title of
at most 20 characters, name line at the right); the facts band is gone
and the chart band is 8.3in (796.8px). A chart is a display the child
reads by finding one cell, so the item-density rungs do not apply to it;
the type floors below do. No picture in any cell of any kind: 26 pictures
would be 26 image calls or a sliced sheet, both banned; a picture alphabet
is a flash-cards or nomenclature-cards job. The one image the variant
ever carries is optional spot art in the order-of-operations chart's foot
strip, described in that kind's bullet; the alphabet chart and the
multiplication table carry no image, since no fleet anchor names them and
generate_image's anchor rule forbids a near-miss.

- **Alphabet chart** (ages 3-7): a 4-column x 7-row grid, 12px gaps, 12px
  top padding: cells (700.8px - 36px) / 4 = 166px wide by (796.8px - 12px
  - 72px) / 7 = 102px tall; 26 cells hold "Aa" through "Zz", the last two
  stay empty. Each pair is 64px Andika, line-height 1, centered (about
  80px wide inside 166px, 64px tall inside 102px); each cell has a 2px
  rounded rule, no fill. Row order left to right, then down.
- **Multiplication table** (ages 7-12): products 1 to 10 by default (an
  11 x 11 grid counting the header row and column), 1 to 12 only when the
  parent asks (13 x 13). The grid is square and 700.8px wide under 12px
  of top padding: 63.7px cells for 1-10, 53.9px for 1-12; 700.8px tall
  either way, leaving 796.8px - 12px - 700.8px = 84px under it for one
  caption line to the child at 20px, centered ("Find the row, find the
  column, meet in the middle." is 50 characters, about 520px at 10.4px a
  character). Products at 24px Andika, centered: a three-digit product is
  about 37px wide (3 x 0.52 x 24px), inside the 53.9px cell of the 12s
  table. Header row and column bold, each closed off with a 2px rule;
  inner cells 1px rules, no fill; the corner cell holds the times sign.
  Every product is row x column, written by Homa and re-checked before
  rendering: a wrong product on a wall is the one defect that teaches.
- **Order-of-operations chart** (ages 9-14): four step rows and a foot
  strip. 12px top padding, four rows of 140px with 12px gaps (12 + 4 x 140
  + 3 x 12 = 608px) leave 796.8px - 608px = 188.8px for the foot strip.
  Each row is a 1.5in (144px) left cell, a 16px gap, and a 540.8px right
  cell (700.8 - 144 - 16). The left cell holds the step's letters at 84px
  Fredoka, line-height 1 ("P" or "G", "E", "MD", "AS"; "MD" is about 92px
  wide at 0.55em, inside 144px). The right cell stacks the step name at
  32px bold Andika (41.6px) over one worked line at 28px (36.4px), 78px
  inside the 140px row. The four worked lines are one expression solved
  top to bottom, at most 36 characters each (36 x 14.56px = 524px inside
  540.8px), and row n's left side is row n-1's right side; check the
  arithmetic before rendering. PEMDAS or GEMDAS follows the family's
  curriculum word, never both. The foot strip holds one caption line to
  the child at 24px, centered ("Start at the top. One step at a time." is
  37 characters, about 462px), or, only when the parent asks for the
  mnemonic picture, the spot art in the caption's place: one generate_image
  call, `anchorIds: ["order-of-operations-chart"]`, shape landscape, a
  text-free four-step staircase with no letters or numbers anywhere; with
  `object-fit: contain` in the 188.8px strip it renders 188.8px tall by
  283.2px wide (188.8 x 1.5), centered. Never both in the strip, never a
  picture inside a row, and the chart ships complete without it.

## Title band width

The content box is 700.8px wide. The name block at the right ("Name: " at
18px, about 56px, plus the 2.2in = 211.2px blank) takes about 270px, and
the 16px flex gap leaves the title 414.8px. Fredoka 600 advances about
0.55em, so 48px type (26.4px a character) holds about 15 characters per
line. A title of at most 20 characters with no single word past 15
almost always breaks into at most 2 lines of 48px at line-height 1: 96px,
plus the 8px padding and the 2px rule, 106px inside the 115.2px band. The
exception is a long word between two short ones ("An Encyclopaedia Now",
20 characters, breaks An / Encyclopaedia / Now), which the recipe handles
by shortening the title, never the type. A 35-character title needs 3
lines (35 / 15 = 2.3), 144px, and clips, which is why the cap is
characters, not words.

## Two-column facts band (6-8 facts)

Add to `.facts`: `grid-template-columns: 1fr 1fr; column-gap: 16px;` and
an explicit row template, `grid-template-rows: repeat(3, auto)` at 6
facts, `repeat(4, auto)` at 7-8: the row count is always the ceiling of
facts / 2. Each column is (700.8px - 16px) / 2 = 342.4px wide, minus the
28px bullet indent, so 314.4px of text. The band stays 3.3in (316.8px),
which is the space left under the 115.2px title band and the 480px
illustration (912px - 595.2px); the illustration keeps 5.0in.

Fill order: when the facts are a sequence, `grid-auto-flow: column` so
the numbers read down the left column and then down the right (1-3 left
and 4-6 right at 6 facts; 1-4 left and 5-7 right at 7; 1-4 and 5-8 at 8).
Otherwise leave the default row flow. Both flows produce the same row
count, so the band arithmetic below holds either way. `repeat(4, auto)`
with column flow at 6 facts is the clip to avoid: it stacks four 85.8px
rows in the left column, 4 x 85.8px + 3 x 10px + 12px = 385.2px in a
316.8px band, and the exact-height box cuts the fourth fact off.

The arithmetic, using Andika's average advance of about 0.52em and a word
at about 6.5 characters including its space; the label's colon adds one
character. The word cap counts the label as words like any other, so a
1-word and a 3-word label land in the same line count; the label's own
length is no longer a hidden variable. A fact written at its cap or one
word under holds the ladder's line count:

- At 22px a character is 11.44px, so a two-column line holds about 27
  characters. Seven words, label included, is about 46.5 characters, 1.7
  lines, so two lines with about 7 characters of margin. Eight words is
  about 53 characters, 1.96 lines, a coin flip on a third line: that is
  why the 7-8 fact rung caps at 7 words. Six words (40 characters, 1.5
  lines) still needs two lines, so the cap-or-one-under floor keeps the
  band full.
- 7-8 facts, two lines each: a row is 2 x 28.6px = 57.2px; 4 rows =
  228.8px + 3 x 10px gap + 12px padding = 270.8px inside 316.8px, with
  46px (0.48in) to spare. A fact that spills to a third line makes its
  row 85.8px: one such row is 299.4px and still fits, two are 328px and
  clip, so the 7-word cap holds at most one slip.
- 6 facts, three rows: the rung allows 10 words (about 66 characters,
  2.4 lines, so three lines; 9 words is 59.5 characters, 2.2 lines, still
  three). A row is 3 x 28.6px = 85.8px; 3 rows = 257.4px + 2 x 10px +
  12px = 289.4px inside 316.8px, 27.4px (0.29in) to spare. This is the
  tallest two-column rung. A row that spills to a fourth line adds
  28.6px, 318px, and clips, so the 10-word cap is exact here.
- 24px does not work: a character is 12.48px and a line holds about 25
  characters, so a 7-word fact at 46.5 characters runs to 1.86 lines,
  under 4 characters from a third line. Stay at 22px.

The one-column rungs, for the same model (text width 700.8px - 28px =
672.8px):

- 3 facts, 34px, 10 words: 38 characters per line, 66 characters is 1.7
  lines; 3 x 88.4px + 20px + 12px = 297.2px inside 316.8px.
- 4 facts, 26px, 12 words: 50 characters per line, 79 characters is 1.6
  lines; 4 x 67.6px + 30px + 12px = 312.4px inside 316.8px.
- 5 facts, 22px, 14 words: 59 characters per line, 92 characters is 1.6
  lines; 5 x 57.2px + 40px + 12px = 338px inside the 3.7in band
  (355.2px). This is the only rung that takes 0.4in from the
  illustration.
- 11-12, 3 facts, 22px, 20 words: 131 characters is 2.2 lines, so three
  (19 words is 124.5 characters, 2.1 lines, still three); 3 x 85.8px +
  20px + 12px = 289.4px inside 316.8px.
- 11-12, 4 facts, 22px, 15 words: 98.5 characters is 1.7 lines, so two;
  4 x 57.2px + 30px + 12px = 270.8px inside 316.8px.

## Numbered facts (any rung, when the facts are a sequence)

Render the list as `<ol class="facts sequence">` and the `.sequence`
rules in the worked HTML replace the dot with a bold counter ("1." to
"8."). The indent becomes 1.3em so the number fits at every rung: 28.6px
at 22px (the two-column arithmetic above is unchanged to the pixel),
33.8px at 26px, 44.2px at 34px. The widest shift is 16.2px of text width
on the 34px rung, under one 34px character (17.7px), so every line count
in the ladder holds. The ladder never reaches 10 facts, so the widest
number is "8.", about 23px at 22px (2 x 0.52 x 22px) inside the 28.6px
indent; a two-digit counter never occurs.

## Worked HTML (hybrid path, 4-fact rung)

The 4-fact rung: 26px, 12 words label included, default bands. 4 rows x
67.6px + 3 x 10px gap + 12px padding = 312.4px inside the 316.8px band.
Other rungs swap `grid-template-rows` and the `.facts li` font-size from
the ladder in the recipe; 6-8 facts add the `.two-col` rules below (the
`repeat(3, auto)` shown is the 6-fact row template; 7-8 facts use
`repeat(4, auto)`), and a sequence adds the `.sequence` rules.

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Andika:wght@400;700&display=swap" rel="stylesheet">
<style>
  .poster { display: grid; grid-template-rows: 1.2in 5in 3.3in; height: 9.5in; width: 7.3in;
    color: var(--homa-ink); font-family: Andika, sans-serif; }
  .title-band { display: flex; align-items: flex-end; gap: 16px; padding-bottom: 8px;
    border-bottom: 2px solid var(--homa-control-boundary); }
  .title { font: 600 48px/1 Fredoka, sans-serif; margin: 0; flex: 1 1 auto; min-width: 0; }
  .name { font-size: 18px; flex: 0 0 auto; }
  .name span { display: inline-block; width: 2.2in; height: 34px; vertical-align: bottom;
    border-bottom: 2px solid var(--homa-ink); }
  .art { display: grid; place-items: center; position: relative; }
  .art img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .scale-note { position: absolute; right: 6px; bottom: 4px; font-size: 16px; color: var(--homa-ink); }
  .facts { list-style: none; margin: 0; padding: 12px 0 0; display: grid; align-content: start; gap: 10px; }
  .facts li { font-size: 26px; line-height: 1.3; padding-left: 28px; position: relative; }
  .facts li::before { content: ""; position: absolute; left: 6px; top: 0.5em; width: 10px; height: 10px;
    border-radius: 50%; background: var(--homa-ink); }
  .facts b { font-weight: 700; }
  /* 6-8 facts: two columns, rows = ceiling of facts / 2 (repeat(4, auto) at 7-8). */
  .facts.two-col { grid-template-columns: 1fr 1fr; column-gap: 16px; grid-template-rows: repeat(3, auto); }
  .facts.two-col.sequence { grid-auto-flow: column; } /* 1-3 down the left, 4-6 down the right */
  /* Sequence: bold counter in place of the dot, indent 1.3em so the number fits at every rung. */
  .facts.sequence { counter-reset: fact; }
  .facts.sequence li { padding-left: 1.3em; counter-increment: fact; }
  .facts.sequence li::before { content: counter(fact) "."; left: 0; top: 0; width: auto; height: auto;
    border-radius: 0; background: none; font-weight: 700; }
</style>
<main class="poster">
  <header class="title-band">
    <h1 class="title">{{topic_title}}</h1>
    <div class="name">Name: <span></span></div>
  </header>
  <section class="art">
    <img src="{{generated_illustration_url}}" alt="{{topic_title}}" />
    <div class="scale-note">Not to scale</div> <!-- only when the art compares sizes or distances -->
  </section>
  <ul class="facts">
    <li><b>{{label_1}}:</b> {{fact_1}}</li>
    <li><b>{{label_2}}:</b> {{fact_2}}</li>
    <li><b>{{label_3}}:</b> {{fact_3}}</li>
    <li><b>{{label_4}}:</b> {{fact_4}}</li>
  </ul>
</main>
```

## Illustration prompt template (hybrid path)

Pass `anchorIds: ["reference-poster"]` and `shape: "landscape"` as tool
parameters (`shape: "square"` for the binder cover). The order-of-operations
spot art is the one call that passes `anchorIds:
["order-of-operations-chart"]` instead, and its prompt names a text-free
four-step staircase rather than a subject. The prompt text is:

```
A single children's reference illustration of [the subject], line-art
style with thick clean warm brown and charcoal outlines on a soft cream
background, [one accent color] used sparingly, no shading, no
photorealism. [Describe the pose, parts, or sequence the facts will name,
left to right if it is a sequence, with every item stated.] The subject
fills the frame with a little air around it. No text, no letters, no
numbers, no labels, no border, no logo anywhere in the image.
```

Adapt the bracketed parts and keep every "no text" instruction explicit.
