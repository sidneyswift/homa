# Counting and manipulative mat: variants

Companion to `counting-and-manipulative-mat.md`. Every binding pattern
there (one mechanic per mat, the lane rule, label band, size as a floor,
laminate-safe outlines, no answer box) still binds here with three
declared exceptions to the label band: stacking columns carry their
numeral under the shared baseline and use the N cells themselves as the
subitizing reference (no top band, no dot cluster); compare-two keeps the
band but leaves it empty or holds the theme object; part-part-whole leaves
empty the band of whatever the child is finding (the whole band when
composing, both part bands when decomposing). Every non-empty band still
carries a numeral plus exactly that many dots. This file only carries the
geometry and snippets for the mechanics other than `numbered-spots`; all
heights below sit inside the 7.85in the worked mat grid leaves for spots.

## Five-frame and ten-frame

A five-frame is exactly 1 row by 5 cells; a ten-frame exactly 2 rows by 5.
Cells are square, outer border 4px, inner lines 3px. Cell size follows the
manipulative: 1.25in for loose one-inch counters (buttons, milk caps,
pom-poms, dough balls), 0.85in for linking cubes (0.75in cube plus
clearance). Each frame is a block: its 0.7in band sits directly on the
frame's top edge (the band drops its own bottom rule; the frame's 4px outer
border is the rule), and blocks stack in one centered column that replaces
the 2-column `.spots` grid of the worked HTML. The `.band`, `.num`, `.dots`,
and `.try` styles come from the worked HTML:

```html
<style>
  .stack { display: grid; gap: 0.2in; justify-items: center; align-content: start; }
  .block { display: grid; grid-template-rows: 0.7in max-content; }
  .block .band { border: 4px solid var(--homa-ink); border-bottom: 0; border-radius: 18px 18px 0 0; }
  .frame { border-collapse: collapse; border: 4px solid var(--homa-ink); }
  .frame td { width: 1.25in; height: 1.25in; border: 3px solid var(--homa-ink); }
</style>
<div class="stack">
  <div class="block">
    <div class="band"><span class="num">7</span><span class="dots"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div>
    <table class="frame">
      <tr><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  </div>
</div>
```

Two blocks stacked ("Show 7", "Show 4") fill the sheet for a 5-6 year
old: a ten-frame is about 2.6in tall (2 x 1.25in cells plus the 4px outer
and 3px inner borders), so two frames plus two 0.7in bands plus one 0.2in
gap is about 6.8in of the 7.85in, and the remaining 1.0in holds a second
0.2in gap and the try-this box (about 0.8in) as a third stack item. Frame cells are the lane rule solved
by construction: one counter per cell, so a frame never needs a lane check.

Adding on ("start with 3, make 5") is a five-frame build, never a
part-part-whole mat: the band carries the target numeral 5 and exactly 5
dots as usual; the child first places 3 counters because the instruction
line says so ("Put 3 in. Now fill it to make 5.") and the empty cells ARE
the add-on. The band never shows the start count, so every numeral still
matches its dots.

## Part-part-whole

The whole zone spans the full width above two equal part zones, every zone
at least 3.2in wide by 1.6in tall of open surface, 4px outlines, 0.15in
gutters, and every zone passes the lane rule for the largest count it can
receive. A part is never more than one less than the total, because the
other part is at least one counter.

- Totals to 5: `grid-template-rows: 1fr 1fr`, so both rows are
  (7.85 - 0.15) / 2 = 3.85in. After the 0.08in of outline and the 0.7in
  band the whole zone is about 7.2in x 3.1in (two lanes of seven) and each
  part zone about 3.5in x 3.1in (two lanes of three, six counters, so a
  part of 4 or a whole of 5 fits with room).
- Totals 6 to 10: `grid-template-rows: 3in 1fr`. The whole zone is about
  7.2in x 2.2in (3 - 0.08 - 0.7 = 2.22in: two lanes of seven, fourteen
  counters, so 10 fits); the parts row is 7.85 - 0.15 - 3 = 4.7in, so each
  part zone is about 3.5in x 3.9in (4.7 - 0.08 - 0.7 = 3.92in: three lanes
  of three, nine counters, and no part of a total to 10 exceeds 9).
- Never squeeze part zones under a frame; part-part-whole is always the
  whole mat.

What the three bands carry, the declared exception to "numeral plus N dots"
on every band:

- Decomposing a known total ("make 5 two ways", "break 8 apart"): the whole
  band carries the target numeral and exactly that many dots; both part
  bands stay empty, because the parts are the child's choice and have no N
  to print.
- Composing from two known parts ("put 3 here and 2 here, then how many
  altogether?"): each part band carries its part numeral and exactly that
  many dots; the whole band stays empty, because printing the total would
  be the answer.
- Pre-numeral: the bands that carry a label keep their dot cluster and lose
  the digit; the empty bands stay empty. The instruction line names the
  counts aloud ("Put this many here and this many here.").

Nothing is written in any zone; a page that ends in a number bond diagram
or number sentence is singapore-workbook-page, not this mat.

## Stacking columns (1-5 run only)

One column per number in a 1-5 run, each column a stack of exactly N
outlined cells standing on a shared baseline, numeral 56px under the
baseline (the declared exception to the label band: no top band, no dot
cluster, the N cells are the subitizing reference), 4px outer outline per
column and 3px lines between cells. Cells are 1.25in square for loose
counters, 0.85in square for linking cubes. Five 1.25in cells, their 4px
outer plus 3px inner rules, and a 56px numeral row is about 7.05in tall,
inside the 7.85in the worked grid leaves for spots; five 1.25in cells plus
their 4px outlines (about 1.33in per column) and four 0.15in gutters is
about 7.27in wide, filling the 7.3in content box edge to edge, so no
centering is needed. A 6-10 run is 12.5in of cells and fits no sheet: 6-10
is a second mat built as a ten-frame or part-part-whole, never ten stacked
cells and never shrunken cells. Columns rise left to right so the staircase
reads "one more"; that reading is a Homa design derivation, not an
extracted pattern.

## Compare-two

Two big spots side by side, each about 3.5in wide and at least 3in tall of
open surface (two lanes of three, so groups to six compare cleanly), one
instruction line ("Put a group on each spot. Which has more?"), and the
declared exception to the label band: the band stays, with no numeral and
no dots, and either holds the theme object or stays empty. This mechanic
is a Homa design derivation; the WPKA source compares size, weight, and
length, not quantity.

## Pre-numeral (dots only)

For a child who does not read numerals yet: numbered-spots and frames with
the digit removed from every band and the dot cluster kept; part-part-whole
as declared above (labeled bands keep dots, empty bands stay empty);
stacking-columns with the numeral under the baseline removed, the N cells
being the label; compare-two unchanged, since it carries no numeral. The
variant exists because ref-2026-07-17-dm-WPKA shows PreK (48-60 months)
pages that work with no numerals at all; the dot cluster as the pre-numeral
label is a Homa design derivation, not an extracted pattern.
