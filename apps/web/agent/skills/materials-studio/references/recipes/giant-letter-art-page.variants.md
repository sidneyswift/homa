# Giant letter art page: variants

Companion to `giant-letter-art-page.md`. Every binding pattern there (one
letter per page, case follows the curriculum, the letter fills the sheet,
size is a floor, one uniform 0.25in outline, small header, clear cutting
margin, spot art none or one to three, ink-light) still binds here; this
file carries the layout geometry the body only summarizes, the width
table, and the image-direct prompt template. All numbers are Nunito Black
(weight 900) measured from its font file (1000 upm): cap 0.705em (round
glyphs overshoot to 0.716), ascender 0.714em, x-height 0.503em, descender
0.19em, accented capitals 0.94-0.96em. The canvas is
`viewBox="0 0 700 826"` (7.3in x 8.6in at 96 units per inch) and the
visible outline is 24 units (0.25in) outside the filled glyph.

## The outline construction

`fill: #fff; stroke-width: 48; paint-order: stroke fill` on every `<text>`.
The stroke is painted first, centered on the glyph's edge (24 units out,
24 in), then the white fill covers the inner half along with every line
the font's overlapping contours would have drawn inside the letter. What
remains is a 24-unit line outside the silhouette and inside each counter,
so a glyph's visible footprint is its ink box grown by 24 on every side
and the white interior is exactly the letterform. Every position below
already includes that 24.

## Ink widths (em, Nunito Black) and center offsets

`text-anchor="middle"` centers the advance box, not the ink. The offset
column is how far the ink center sits right (+) or left (-) of that point,
in em; the position formulas subtract it.

| Cap | Width | Offset | Low | Width | Offset |
|---|---|---|---|---|---|
| A | 0.730 | +0.001 | a | 0.489 | -0.009 |
| B | 0.598 | +0.012 | b | 0.539 | +0.011 |
| C | 0.607 | +0.006 | c | 0.443 | +0.008 |
| D | 0.677 | +0.009 | d | 0.540 | -0.011 |
| E | 0.507 | +0.011 | e | 0.501 | +0.002 |
| F | 0.501 | +0.025 | f | 0.425 | +0.012 |
| G | 0.642 | -0.006 | g | 0.545 | -0.011 |
| H | 0.658 | 0.000 | h | 0.505 | +0.002 |
| I | 0.184 | 0.000 | i | 0.197 | 0.000 |
| J | 0.342 | -0.039 | j | 0.301 | -0.050 |
| K | 0.610 | +0.013 | k | 0.498 | +0.011 |
| L | 0.507 | +0.025 | l | 0.295 | +0.025 |
| M | 0.752 | 0.000 | m | 0.797 | +0.002 |
| N | 0.629 | -0.001 | n | 0.505 | +0.002 |
| O | 0.716 | +0.001 | o | 0.543 | -0.001 |
| P | 0.590 | +0.021 | p | 0.539 | +0.011 |
| Q | 0.716 | +0.001 | q | 0.540 | -0.011 |
| R | 0.591 | +0.007 | r | 0.377 | +0.024 |
| S | 0.582 | +0.009 | s | 0.445 | +0.005 |
| T | 0.650 | 0.000 | t | 0.439 | -0.004 |
| U | 0.630 | 0.000 | u | 0.500 | -0.002 |
| V | 0.709 | +0.001 | v | 0.509 | +0.001 |
| W | 1.049 | +0.001 | w | 0.826 | 0.000 |
| X | 0.611 | 0.000 | x | 0.480 | +0.001 |
| Y | 0.600 | +0.001 | y | 0.510 | +0.001 |
| Z | 0.578 | +0.013 | z | 0.441 | +0.010 |
| Ñ | 0.629 | -0.001 | ñ | 0.505 | +0.002 |
| Á | 0.730 | +0.001 | á | 0.489 | -0.009 |
| É | 0.507 | +0.011 | é | 0.501 | +0.002 |
| Í | 0.261 | +0.039 | í | 0.254 | +0.039 |
| Ó | 0.716 | +0.001 | ó | 0.543 | -0.001 |
| Ú | 0.630 | 0.000 | ú | 0.500 | -0.002 |

Digits (single pages only): 0 0.538, 1 0.511, 2 0.524, 3 0.521, 4 0.572,
5 0.522, 6 0.534, 7 0.540, 8 0.550, 9 0.534, offsets within 0.03em. The
stem (I) is 0.184em; W is the one glyph wider than a full em.

## Pair, side by side (the default)

- `font-size = floor(562 / (capital width + lowercase width))`, capped at
  583. The 562 is the 700-unit canvas minus two outlines per glyph (96),
  minus a 0.4in gap between the outlines (38), minus 4 units of rounding
  room. At 583 the cap is 411 units (4.28in); I i, J j, L l, and F f reach
  it. B b lands at 494 (3.63in) and H h at 483 (3.55in); every other
  unaccented side-by-side pair sits at or above H h, except D d (461,
  3.39in), G g (473, 3.47in), and Q q (447, 3.28in). Name those three
  sizes in the reply, as for W; stacking does not rescue them, because d's
  ascender, g's tail, and Q's tail make the stack taller than the canvas
  at any size that holds 3.5in (a stacked Q lands its tail on the q).
- Positions, both `text-anchor="middle"`, rounded to whole units. The pair
  is one centered group: `left = (566 - (capitalWidth + lowercaseWidth) * fontSize) / 2`
  (about 2 when the size came from the formula, larger for a pair capped
  at 583), then the capital at
  `x = left + 24 + capitalWidth * fontSize / 2 - capitalOffset * fontSize`
  and the lowercase at
  `x = left + 110 + capitalWidth * fontSize + lowercaseWidth * fontSize / 2 - lowercaseOffset * fontSize`.
  The outlines then stand exactly 0.4in apart. B b: x=168 and x=535 at
  494; I i at 583: x=250 and x=447.
- Baseline with no spot band (the default): center the
  ascender-to-descender extent, `y = 413 + 0.2625 * fontSize` (0.2625 is
  half of 0.714 minus 0.189): y=543 at 494, y=566 at 583. Ascender
  outlines then top out at y=166 at 494 (y=109 at 583) and descender
  tails end at y=660 (y=699 at 583), both inside the canvas with more
  than 1.3in of clear paper.
- Baseline with a spot band: unchanged. A no-descender pair's outline ends
  at about y=572 at 494 (y=596 at 583), so the band at y 680-800 (1.25in)
  sits 0.9-1.1in below it; moving the baseline down would open a dead band
  under the header, which the scale-to-fill rule forbids. Cut the canvas
  to `viewBox="0 0 700 680"` (`height: 7.083in`) and place the band as an
  `<img>` 7.3in x 1.25in, `object-fit: contain`, directly below it, so it
  occupies canvas y 680-800; the whole page is header 0.85in + canvas
  7.083in + band 1.25in = 9.18in inside the 9.5in box. One to three
  objects, no labels. Only on an unaccented side-by-side pair without a
  descender (g, j, p, q, y take the whole lower canvas), so descender
  pages, stacked pages, and accented pairs never carry a band.
- Hybrid strip footprint: `shape: "wide"` is 1792x1024 (1.75:1), so
  contained in the 7.3in x 1.25in band it renders 2.19in wide x 1.25in
  tall, centered, with clear paper either side; objects that fill nearly
  the full image height land about 1.1in tall, inside the 1.25in cap.
  Never `object-fit: cover` (it would crop the row) and never stretch the
  band taller to fit the image (the letter's size is the floor).

## Pair, stacked (A a, M m, O o, V v, W w)

Their widths sum past 1.2em, so side by side they would fall under 3.5in.
Both `<text>` elements at `text-anchor="middle"`, `x="350"` (their offsets
are under 0.002em, so 350 serves), `font-size="480"`, the capital at
`y="400"` (top of its outline at y=33) and the lowercase at `y="724"`
(top of its outline at y=459, 0.3in under the capital's; bottom at
y=753). Cap 3.52in. W w is 552 units wide with its outlines, inside the
700 canvas. No spot band on a stacked page. Q q is not stacked: Q's tail
(0.209em) would land on the q at any size that holds 3.5in, so it sits
side by side at 447.

## Single capital (and digits)

One `<text>` at `text-anchor="middle"`, `x="350"`, `y="760"`,
`font-size="900"` (cap 6.6in, top of the outline at y=92 to 102). Widths
past the canvas step down: A to `font-size="890"` (6.5in, 698 wide with
the outline), M to 860 (6.3in, 695 wide), W to 620 (4.55in, 699 wide).
Q's tail drops 0.209em, so Q takes `font-size="800"` with `y="629"`
(outline top at y=32, tail bottom at y=820, cap 5.9in). Name every
reduced size in the reply. Digits 0-9 are all under 0.58em wide and take
the 900 default.

## Accented capitals (Ñ, Á, É, Í, Ó, Ú) and ñ

The tilde or accent is the same 0.25in outline, one closed shape above the
glyph, never a thin flick. Accented capitals reach 0.94em (Ñ) to 0.96em
(Á, É, Í, Ó, Ú) above the baseline, so they get their own geometry:

- Single page: `font-size="770"`, `y="792"` (accent top at y=32 with the
  outline, glyph bottom at y=823, cap 5.65in). Name the size in the reply
  as for W. At 900 with `y="760"` the accent would clip off the top.
- Side by side: the width rule above, with the baseline centered on the
  accent-to-descender extent, `y = 413 + 0.38 * fontSize`: Ñ ñ at 495
  (y=601, accent top at y=113, cap 3.63in), Ú ú at 497 (y=602), É é at 557
  (y=625), Í í at 583 (y=635, accent top at y=54). No spot band on an
  accented pair: the glyphs end near y=630 to 665, too close to a band at
  680.
- Never stacked: a capital at y=400 puts the accent near y=-80, and
  lowering it pushes the lowercase off the bottom at any size that holds
  3.5in.
- Á á (font-size 461, cap 3.39in) and Ó ó (446, 3.28in) are the two pairs
  that hold neither the floor nor a stack; build them side by side at that
  size and name the size in the reply. They are rare as pages (the Spanish
  alphabet has Ñ; accented vowels are not letters of it), so confirm the
  parent wants the page before building it.

## Digraph page (ch, ll, rr)

Only for a Spanish program that teaches the digraph as a letter of its
alphabet, confirmed with the parent; lowercase only, since the pair rule
(capital with its own lowercase) has no capital form a child decorates.
One `<text>` holding both glyphs, `text-anchor="middle"`, `x="350"`,
`y="566"`, `font-size = floor(652 / the digraph's ink width in em)` capped
at 583. Run ink widths measured from the font file with its default
advances (no kerning between these pairs): ch 1.012em, ll 0.643em, rr
0.811em. All three therefore sit at 583 (cap 4.28in): ch spans 590 units
of ink, 638 with the outline, 0.32in of clear canvas each side; the h and
l ascenders top out at y=126 like a b. None has a descender, so the
spot-band rule of the side-by-side pair applies unchanged. Never two
digraphs, and never a digraph beside a single letter, on one sheet.

## Prompt template (image-direct)

```
Using the attached reference image as the exact style and layout guide,
build the same page for the letter [X x]. A children's craft page, thick
clean ink-line style, charcoal ink on a pure white background with no
paper texture or tint, no shading, no photorealism, no fill inside any
shape. At the top a short
header band: the words '[Make this letter yours.]' on the left and a single
horizontal name line on the right, nothing else. Below it ONE giant capital
[X] and ONE lowercase [x] side by side on the same baseline, rounded
bubble-letter shapes, drawn as a single uniform outline about a quarter
inch thick with an empty white interior, the capital at least three and a
half inches tall, fat limbs about an inch wide, with clear paper all around
them. [Either: Nothing below the letters. Or: Along the bottom, exactly
[N, 1-3] small line-art objects in a row, [a boat, a bee, a button], each
about an inch and a quarter tall, no words or labels near them.] No arrows,
no dots, no dotted lines, no border, no title, no other text anywhere on
the page.
```

Pass `anchorIds: ["giant-letter-art-page"]` with it; every count and size
is spelled out because the anchor holds the look, not the specifics.
