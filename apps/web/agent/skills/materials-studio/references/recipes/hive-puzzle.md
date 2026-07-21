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
- **Touching-pair-sum variant ("Pairs")**: instead of filling blank
  hexagons, every hexagon already holds a given number. The child circles
  pairs of numbers that add up to a stated target, with two binding
  constraints: circled pairs must sit in hexagons that touch each other,
  and every number in the cluster must end up part of exactly one pair
  (no leftovers). Confirmed directly from Beast Academy 1B (Art of
  Problem Solving), pages 44-45 and 74-79 (target sums 7-12, addition
  chapter) and page 196 (target sums 9 or 19, review section, a larger
  19-hexagon cluster). This is a genuinely different constraint from the
  smallest-number-not-adjacent rule above, not a restatement of it: the
  child is pairing existing numbers by sum, not deducing a missing one.
