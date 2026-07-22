# Magic square puzzle

An n-by-n grid (commonly 3x3 or 4x4) where the child fills in missing
numbers so every row, every column, AND both diagonals sum to the same
target. Some cells are given, some blank.

Great for: grades 2-5, addition fluency, logical reasoning, a
well-known, evergreen enrichment-math format that recurs far beyond any
one curriculum (Beast Academy uses it, but magic squares are a
centuries-old, cross-curriculum staple). Self-checking by constraint
satisfaction.

Always html path. Precise grid layout and borders require exact
positioning, the same way cross-number-puzzle does.

This is a distinct constraint from cross-number-puzzle: cross-number's
sums live OUTSIDE the grid at the edge of each row and column (or as
embedded operators reading like an equation), and only that row or
column has to satisfy its own constraint. A magic square has no
constraint labels at all: EVERY row, EVERY column, and BOTH diagonals
inside the same grid must independently reach the identical target sum,
which is what makes the same grid readable four, five, or more different
ways at once. It is not a cross-number variant; it needs its own file.

Design patterns (all binding for magic-square-puzzle):

- **Grid**: N×N (3×3 for beginners, up to 4×4 for advanced). Square
  cells (`width: 56px; height: 56px;`), matching cross-number-puzzle's
  cell dimensions so the two formats read as siblings.
- **Given vs. blank cells**: some cells hold a printed number
  (`font-weight: 700; color: #221e1a;`), the rest are blank
  (`border: 1px solid #6b6259;`) for the child to fill in.
- **Target sum stated once**: a single rules box at the top states the
  magic number every row, column, and diagonal must reach ("Every row,
  column, and diagonal adds up to 15."). Never repeat or vary the target
  anywhere else on the grid; one sum governs the whole square.
- **Diagonal emphasis (optional)**: a faint diagonal guideline
  (`background: linear-gradient(...)` or a thin dashed overlay) may hint
  at the two diagonals for a first 3x3 puzzle; drop the hint for harder
  puzzles once the child understands diagonals count too.
- **Bold outer border**: `border: 3px solid #221e1a;`. Thinner inner
  borders: `border: 1px solid #6b6259;`, matching cross-number-puzzle.
- **Difficulty progression**: a 3x3 with 5-6 given cells for a first
  puzzle; a 3x3 with only 3-4 given cells, or a 4x4, for advanced.
- **Optional historical or cultural aside**: a short factual footnote box
  may name a real magic square in history (the Lo Shu square from ancient
  Chinese legend, the magic square in Albrecht Dürer's 1514 engraving
  "Melencolia I," magic squares in Islamic architecture and talismans).
  Keep it brief, factual, and clearly optional; never fabricate a
  historical claim the source material does not support.
- **No decoration**: pure mathematical puzzle. Clean B&W. No characters,
  no illustrations.
- **Answer key**: on a separate page (or upside-down at bottom), matching
  cross-number-puzzle's convention.

```html
<style>
  .magic-square-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .magic-rules { border: 1.5px solid #6b6259; border-radius: 6px;
    padding: 12px; font-size: 13px; margin-bottom: 20px; }
  .magic-grid { display: grid; grid-template-columns: repeat(3, 56px);
    border: 3px solid #221e1a; width: fit-content; }
  .magic-cell { width: 56px; height: 56px; border: 1px solid #6b6259;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; }
  .magic-cell.given { font-weight: 700; color: #221e1a; }
  .magic-cell.blank { color: transparent; }
  .magic-aside { margin-top: 20px; font-size: 12px; color: #6b6259;
    font-style: italic; }
</style>

<div class="magic-square-page">
  <div class="magic-rules">Every row, column, and diagonal adds up to
    15. Fill in the missing numbers.</div>
  <div class="magic-grid">
    <div class="magic-cell given">2</div>
    <div class="magic-cell given">7</div>
    <div class="magic-cell blank">6</div>
    <div class="magic-cell blank">9</div>
    <div class="magic-cell given">5</div>
    <div class="magic-cell blank">1</div>
    <div class="magic-cell given">4</div>
    <div class="magic-cell blank">3</div>
    <div class="magic-cell given">8</div>
  </div>
  <div class="magic-aside">Magic squares like this one are thousands of
    years old: the earliest known example, the Lo Shu square, comes from
    ancient Chinese legend.</div>
</div>
```
