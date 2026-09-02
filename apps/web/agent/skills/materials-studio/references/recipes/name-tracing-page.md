# Name tracing page

Golden anchor: pass `anchorIds: ["name-tracing-page"]` to generate_image
so the output matches the Homa name tracing bar (seven evenly spaced
three-line guide rows with a centered dashed midline, three
dotted-outline name rows fading to two pale-fill rows then two empty
rows, letters pinned to the baseline with descenders dropping below it,
one green starting dot on the first row only, one short warm header and
corner-only motifs). Write your own prompt with your own content; the
anchor sets the visual bar, not the specifics.

The child's own name (or a loved word) repeated down the page on real
three-line writing guides, traced letters fading to empty lines. The
single most requested first handwriting page, and the format a
co-founder family corrected for three days straight (2026-07-28 to
07-31, twenty drafts, none approved) before this recipe existed. Every
law below is a correction a real parent actually sent.

Great for: ages 3-6, first name writing, "practice writing her name,"
Spanish or English, any word the child loves enough to write.

Always html path. Guide geometry and letter placement must be exact,
and the parent will judge them against store-bought sheets.

## The guide row (binding): one SVG per line, one coordinate system

Letters must sit ON the guides. HTML text floated near CSS border
"guides" cannot be pinned: font metrics move the baseline and the
letters float in the middle of the box, which is precisely the failure
the family corrected for three days. An SVG row puts the three lines
AND the name in one coordinate system, so the baseline is a number, not
a hope.

```html
<style>
  .name-row { margin-bottom: 26px; }
  .name-row svg { display: block; width: 100%; height: 132px; }
</style>
<div class="name-row"><svg viewBox="0 0 700 132" preserveAspectRatio="none">
  <line x1="0" y1="2"   x2="700" y2="2"   stroke="#3a3a3a" stroke-width="3"/>
  <line x1="0" y1="66"  x2="700" y2="66"  stroke="#9b9b9b" stroke-width="2" stroke-dasharray="7,6"/>
  <line x1="0" y1="130" x2="700" y2="130" stroke="#3a3a3a" stroke-width="3"/>
  <circle cx="8" cy="9" r="6" fill="#4f9d5e"/>
  <text x="16" y="129" font-family="Fredoka, sans-serif" font-size="174"
    fill="none" stroke="var(--homa-control-boundary)" stroke-width="2.5" stroke-dasharray="5,5">Amalia</text>
</svg></div>
```

- Top line and baseline solid, midline dashed and EXACTLY centered
  (y=66 of 132; a midline near the bottom was a real correction). The
  midline is why the format works: it tells the child where R and B
  break, where round letters live, where tall letters pass through.
- Text `y` pins the letters to the baseline (baseline minus 1). Size
  the font so round letters (a, o, e) fill midline to baseline and
  ascenders touch the top line; 174px inside a 132px row is right for
  Fredoka. Descenders (y, g, p) drop below the baseline; that is
  correct handwriting, never a defect.
- The starting dot marks the first stroke's start on the FIRST trace
  row only.

## Trace typography (binding)

- The name is something the child FILLS IN, never a solid dark word she
  scribbles over (verbatim parent correction). Two allowed styles:
  dotted outline (`fill="none" stroke="var(--homa-control-boundary)" stroke-width="2.5"
  stroke-dasharray="5,5"`, the store-bought look) or pale solid fill
  (`fill="#c9c2b8"`, no darker). Solid dark ink is for the model row
  only, if the page has one.
- The name fills the line's width: tune `font-size` and letter spacing
  so the name spans most of the row, never bunched small at the left
  with a dead right half (a real correction). A short name may repeat
  twice on one line ONLY if both stay guide-height; smaller-but-more
  loses to bigger-but-fewer every time.

## Page structure

- Separate, clearly spaced line groups (verbatim parent praise for the
  store-bought sheet): one SVG row per line, at least 24px between
  rows. Never stack rows so tight they read as one ruled block.
- Fade the support down the page: two or three dotted trace rows, then
  one or two pale-fill rows, then one or two EMPTY guide rows for
  writing alone. The empty rows are the point of the page.
- Row height by age: 126-140px for ages 3-5, 96-110px for 6-7. Fill
  the printable area with rows per the scale-to-fill law; the page is
  guide rows, not decoration, and a decorative border never steals
  width from the writing lines.
- Header: one short line, warm, the child's name spelled exactly as
  the family spells it ("Traza tu nombre, Amalia"). Nothing else
  competes with the rows.

## The reviewer's checklist

create_printable reads this block when you pass
`recipe: "name-tracing-page"` and asks the quality check to answer every
item against the rendered page; a blocking no holds the page back as
`Checklist (<id>)`. Each item is one of the corrections above, asked as
a question the picture can settle.

```homa-checklist
- blocking guide-lines: Every writing row has three guide lines: a solid top line, a dashed midline centered between them, and a solid baseline.
- blocking letters-on-guides: On every traced row the name sits on its guides: round letters fill midline to baseline and tall letters reach the top line.
- blocking name-fills-row: The traced name spans most of each row's width at full guide height, never bunched small at the left with a dead right half.
- blocking fade-to-empty: Trace rows come first and at least one empty guide row for writing alone comes last.
- advisory trace-style: Trace letters are a dotted outline or a pale fill the child writes over, never solid dark ink.
- advisory row-spacing: Rows are clearly separated by visible space, never stacked so tight they read as one ruled block.
```

## What not to do (each one a sent correction)

- HTML text near CSS-border guides: decoupled, unpinnable, the
  three-day bug. Use the SVG row.
- A solid dark name to trace over.
- Single baseline-only lines with no midline.
- Letters floating small inside oversized boxes or guides.
- Rebuilding the row with flex, tables, or grid to "spread letters":
  the SVG row already owns spacing.
- Uneven or cramped gaps between rows (5px is cramped; 24px or more).

Letter-by-letter formation practice in curriculum boxes (Handwriting
Without Tears style) is a different page: letter-number-formation-
practice owns that geometry. This recipe is the whole name on writing
guides.
