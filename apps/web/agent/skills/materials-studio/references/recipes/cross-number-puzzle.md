# Cross-number puzzle

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
