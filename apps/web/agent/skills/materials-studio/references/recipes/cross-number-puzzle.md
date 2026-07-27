# Cross-number puzzle

Golden anchor: pass `anchorIds: ["cross-number-puzzle"]` to
generate_image so the output matches the Homa cross-number bar (six
grids per page where operator and equals cells interleave with given
numbers and blank answer cells, every row and column reading as an
equation, a short rule statement under the title). Write your own
prompt with your own content; the anchor sets the visual bar, not the
specifics.

Grid-based puzzles with row + column sum constraints (Beast Academy
style). Like a crossword but with numbers and mathematical operations.

Great for: ages 7-12, math practice (addition, multiplication),
logical reasoning, problem-solving. Self-checking by constraint
satisfaction.

Always html path. Precise grid layout and borders require exact
positioning.

Design patterns (all binding for cross-number-puzzle):

- **Grid**: N×N (3×3 for beginners, up to 5×5 for advanced). Cells
  are square (`width: 56px; height: 56px;`).
- **Pre-filled cells**: some cells contain given numbers
  (`font-weight: 700; color: #221e1a;`), others are blank for the
  child to fill in.
- **Constraints at edges**: row and column sums (or products) shown
  outside the grid in circles or boxes (`width: 36px; height: 36px;
  border-radius: 50%; border: 2px solid #6b6259; font-size: 16px;`).
- **Bold outer border**: `border: 3px solid #221e1a;`. Thinner inner
  borders: `border: 1px solid #6b6259;`.
- **No decoration**: pure mathematical puzzle. Clean B&W. No
  characters, no illustrations.
- **Rules box**: at top of page with brief explanation of how to solve
  (`border: 1.5px solid #6b6259; border-radius: 6px; padding: 12px;
  font-size: 13px;`).
- **Answer key**: on a separate page (or upside-down at bottom).
- **Embedded-operator plus-shaped variant**: instead of sum/product
  constraints shown at the edges, the grid itself is a 5x5 plus-sign
  shape (a center cell with an arm of cells in each of the four
  directions) where the `+`, `-`, and `=` symbols occupy their own cells
  interleaved with the number cells, so the same grid reads as one
  horizontal equation and one vertical equation crossing at a shared
  number. Confirmed directly from Beast Academy 1B (Art of Problem
  Solving), pages 144-147 and 224-231: e.g. a grid reading `19 - _ = _`
  across the top row and `19 - 6 - _ = 10` down a column, sharing the
  `19`. Some cells are given, the rest blank; a few of the hardest
  puzzles per page are starred. Build the operator and equals cells with
  the same square dimensions as the number cells
  (`font-size: 20px; font-weight: 700; color: #6b6259;`) so the grid
  reads as one continuous lattice, not numbers-with-decorations.
