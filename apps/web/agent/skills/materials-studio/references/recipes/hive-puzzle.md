# Hive puzzle

Hexagonal grid logic puzzle where students fill empty hexagons
following a constraint rule (e.g., "each hexagon contains the smallest
number not appearing in any adjacent hexagon"). Derived from Beast
Academy's Hive Puzzles.

Great for: grades 2-5, logical reasoning, spatial thinking, number
sense, constraint-based problem solving.

Always image-direct path. Hexagonal geometry is impossible in pure
HTML/CSS at the precision needed.

Design patterns (all binding for hive-puzzle):

- **Hexagonal clusters**: 7-19 hexagons per puzzle, tessellated.
  Some filled with given numbers, rest blank for student.
- **Multiple puzzles per page**: 6-9 puzzles in a grid (3x2 or 3x3).
  Numbered labels for each.
- **Rule statement**: Clear instruction box at top explaining the
  constraint rule.
- **Difficulty progression**: early puzzles have more given numbers,
  later puzzles fewer.
