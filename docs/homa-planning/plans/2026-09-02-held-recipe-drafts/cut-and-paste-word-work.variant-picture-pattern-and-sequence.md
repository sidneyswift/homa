## Variant: picture pattern and sequence

Golden anchor: reuses cut-and-paste-word-work. Pass
`anchorIds: ["cut-and-paste-word-work"]` on every image call for this
material, the isolated objects and the composed sheet included: the tool
asks for a format's anchor on spot art as much as on a full page, and this
anchor holds the warm hand-drawn line-art bar. Your prompt owns the rest,
and every prompt below says wordless, no frames, no tiles, no lettering, so
nothing from the anchor's word page leaks into art that must have none.

The child cuts PICTURE pieces from a sheet at the bottom and glues each one
into a target up top. No model word, no writing line, no text on any piece:
the thinking is in choosing the piece and the slot, and a pre-reader can do
the whole page. Two target kinds, a closed set; pick exactly one per page:

- `pattern`: rows of a repeating shape sequence with one gap each.
  ref-2026-07-18-winter-patterns-cut-paste supplies the cut-and-glue
  mechanic (it also names ABB, ABC, and AABB rows; those leave for the
  width reason under Piece cell floor); the two-cycles and AB-first rules
  are borrowed from pattern-extension-practice (row layout is Homa's own,
  see Pattern rows).
- `sequence`: numbered empty slots the pieces fill in order: planets from
  the sun (ref-2026-07-18-solar-system-cut-paste, which cuts labels too;
  Homa keeps every word in HTML); lifecycles and seasons are the same
  mechanic, Homa's own extension.

Choose this variant over the base form when the parent says cut and paste,
cut and glue, or scissor work and the pieces are pictures or shapes rather
than words to read and write; a word sort such as the Harcourt -id / -ide
sort (cur-2026-07-18-harcourt-trophies-2nd) stays in the base form's word
tiles. Choose classification-sorting-mat for any sort into labeled boxes,
glued or loose: the hot/cold and up/down sorting pages named as a gap in
ref-2026-07-19-treasury-year-round-pk-activities are that mat, glued or
laminated. Themed AB patterns (mittens and snowflakes, the winter-patterns
request itself) stay here at ages 4-7 as the one hybrid path for a
`pattern` page (sequence pictures are hybrid by default); the creation
paths below say how. Not for circle-or-color pattern answers or any rule
longer than two elements (AAB, ABB, ABC, AABB), none of which fits a
glue-size row; pattern-extension-practice owns those as circle-or-draw
pages. Not for draw-a-line matching; matching-visual-discrimination owns
that.

Great for: ages 4-7 for `pattern`, ages 4-10 for `sequence`; AB patterns
and sequencing, science ordering (planets, lifecycles, seasons), scissor
and glue practice riding along with the concept.

Creation paths (follow `references/image-call-strategy.md`):

- html for `pattern` with CSS shapes, the default: the elements are CSS
  shapes or simple symbols (path 1), so the page uses no generated image.
  Pieces stay wordless; a numeral or letter on a piece is text, and text
  belongs to the base form.
- hybrid for themed `pattern` at ages 4-7: exactly two path-2 calls,
  `shape: "square"`, one isolated object on white per element, the same
  two URLs repeated in every row cell and strip piece. The geometry stays
  HTML; never a composed sheet, never a call per cell.
- hybrid for `sequence` with pictures: the whole piece sheet as ONE
  composed image (path 3), `shape: "landscape"`, which returns 1536 x
  1024. The prompt asks for a 3 x 2 grid of six equal square cells (512px
  each in that image) and never states an aspect ratio: generate_image
  honors only its five shapes (square, landscape, wide, portrait, tall),
  and a ratio written in prose changes nothing. The image sits whole
  behind an HTML dashed cut grid of the same 3 x 2 whose box is
  `aspect-ratio: 3 / 2`, the proportion landscape actually returns, so
  the grid lands on the cells with no letterboxing (worked in the sibling
  file). Never slice it with CSS background positioning, never one call
  per piece, never another shape. A `sequence` of plain shapes (smallest
  to largest) is html like `pattern`.

Design patterns (all binding for the picture variant, on top of the base
form's dashed cut borders and labeled scissors line). Every size below is
an outer size: `box-sizing: border-box` on every cell, gap, target, and
piece, so a 1.25in cell prints 1.25in with its border inside; without it
every bordered cell grows by its border and the fits below fail.

- **Piece cell floor 1.25in square**, dashed border, no fill; every target
  is 10 percent larger (1.375in) so a crooked cut still fits. Against the
  7.3in x 9.5in box: a `pattern` row of four cells plus one gap is
  4 x 1.25 + 1.375 + 4 x 12px = 6.875in wide, and three rows (1.375in
  each, the gap sets the row height) with the 1in header, 22px row
  margins, cut line, and strip stand about 7.7in tall (738.5px, arithmetic
  in the sibling). A fifth cell pushes the row to 8.25in and two full
  cycles of a three-element rule need six cells (9.625in); both are
  clipped, never shrunk, which is why longer rules leave.
- **Composed sheet (`sequence`), one geometry for every page**: the sheet
  prints 5.25in wide, so landscape's 1536 x 1024 stands 5.25 x 1024 / 1536
  = 3.5in tall and each of the six cells is 1.75in square (5.25 / 3 and
  3.5 / 2). Targets are 1.925in (1.75 x 1.1) in a three-column grid, 3 x
  1.925 + 2 x 12px = 6.025in wide; four to six targets always make two
  target rows. Header, targets, cut line, and sheet total 892.1px, about
  9.3in, 20px under the box: no extra line fits above the targets, so the
  header stays at the name line and the two instruction lines. Pieces
  fill cells in reading order, in the shuffled order; the spare cells are
  always the last ones, empty white in the prompt and undrawn in the
  overlay. At ages 6+ exactly one spare cell takes a distractor (a real
  object from the same set that does not belong: the Moon among planets,
  an acorn in a butterfly lifecycle); the rest stay empty.
- **Size is a floor, not a target.** Piece cells never drop below the
  stated floor; a revision that adds a row or a distractor drops the extra
  item or moves it to a second page instead of shrinking pieces.
- **Piece count is one closed rule**, the SKILL.md density table applied
  to each target kind. Fill the sheet with bigger pieces, never more.

  | Age | `pattern` | `sequence` |
  |---|---|---|
  | 3 | none | none: six 1.75in cells want four pieces to earn their paper |
  | 4-5 | 3 rows, 3 pieces (one per gap) | 4-5 pieces, spares empty |
  | 6-7 | 3 rows, 4 pieces (three gaps plus one distractor) | 4-6 pieces, one distractor when a cell is spare |
  | 8-10 | none: `sequence`, never a fourth pattern row | 4-6 pieces, one distractor when a cell is spare |

  Seven or eight items are two pages with a sheet each: eight planets are
  an inner-planets page and an outer-planets page of four.
- **Shuffled strip**: sheet order never matches or mirrors target order, or
  the page becomes copying. Record the shuffle privately for the key.
- **Targets carry the words, pieces carry none.** A `sequence` slot shows
  its position number and, scaffolded, its label ("Mars"); a `pattern`
  cell shows its shape and nothing else. Wordless pieces mean HTML never
  lines text up with generated art, and a pre-reader can do the whole page.
- **Pattern rows**: every row shows two full cycles then the gap, always
  the fifth position, one gap per row, never a new rule mid-row
  (pattern-extension-practice). Rows differ by which element starts
  (A B A B _ then B A B A _) so the missing piece alternates, never by
  moving the gap. Homa's own layout choice, not from the winter-patterns
  reference: always three rows (the table above), the distractor at 6-7
  being one extra piece of either element, never a third element. Two
  elements that cannot be confused (circle and square, mitten and
  snowflake; never two rounded shapes).
- **Name line up top, then two instruction lines to the child**: "Cut out
  the pieces." then "Glue each one where it belongs." The name blank is
  34px tall; the whole header is 34 + 8 + 24 + 6 + 24 = 96px, exactly 1in.
  The scissors label sits at 16px here (the base form's 10px is under the
  body floor once a `sequence` page reaches ages 8-10).
- **Answer key**: both target kinds have one right answer, so the key
  ships as its own `answer_key` page, never on the child's page.
- **Cut-line drift versus a bad sheet.** The sheet box and the image share
  one proportion, so any mismatch is object placement inside cells, never
  scale. A dashed line crossing an object in a sheet whose objects are all
  present, equal, and evenly spaced is a layout defect: keep the same
  image URL and nudge the overlay's padding. A wrong object count, a
  missing object, a drawn grid line, or visibly unequal cells is a pixel
  defect (image-call-strategy): regenerate that one sheet with the same
  anchor and prompt, at most once, then ask the parent. Moving the grid
  never fixes a sheet with the wrong count.

Scaffolded versions: labeled `sequence` slots (match picture to name)
before unlabeled ones (order from memory); a `pattern` strip holding only
the missing pieces before one adding a distractor to the strip at ages 6-7.

What not to do: no writing lines (that is the base form); no laminate note
(glued pieces are one-and-done); no filled backgrounds behind pieces or
targets (ink there is spent twice); no title baked into generated art; no
composed sheet or per-cell image call on a `pattern` page; no shape other
than landscape for the sheet and no aspect ratio written into any prompt;
no third pattern element squeezed in by shrinking cells; no fourth pattern
row.

Worked HTML for both target kinds (shared styles, then an AB pattern page
and a six-piece 3 x 2 sequence page as two separate blocks with their
height arithmetic, plus the themed img swap) and the composed-sheet prompt
template live in
`/workspace/skills/materials-studio/references/recipes/picture-pattern-and-sequence.variants.md`;
read it before writing the page.

Landing edits to the base recipe, the SKILL.md Format library row,
activity-formats.md, and classification-sorting-mat are staged in
`picture-pattern-and-sequence.landing.md` beside this file; none of them is
part of the runtime section above.
