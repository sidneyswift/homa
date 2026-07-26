# Hive puzzle

Golden anchor: pass `anchorIds: ["hive-puzzle"]` to generate_image so
the output matches the Homa hive-puzzle bar (numbered hexagon
clusters with given and blank cells, a plain-language rule statement
up top, light bee-and-hive theming in the margins). Write your own
prompt with your own content; the anchor sets the visual bar, not the
specifics.

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
- **Sequential-path variant ("Path")**: the hexagons start empty except
  for a labeled Start hexagon (holding 1) and a labeled End hexagon
  (holding the cluster's highest number). The child fills every remaining
  blank hexagon with the next number in counting order, 2, 3, 4, and so
  on, subject to one binding rule: consecutive numbers must sit in
  hexagons that touch, so the finished numbers trace a single unbroken
  path that visits every hexagon in the cluster exactly once. Confirmed
  from Beast Academy 1A (Art of Problem Solving) as a distinct hive
  pattern. This is a third, genuinely different constraint from both
  patterns above, not a restatement of either: the smallest-number rule
  above is deduction by elimination (find the one number that cannot
  appear), Pairs is matching existing numbers by sum, and Path is
  connected sequential completion, where adjacency governs an entire
  ordered chain rather than one deduction or one pair at a time. It keeps
  the same tessellated hexagonal grid, image-direct path, and 6-9
  puzzles-per-page shell as the other two variants, so it belongs here as
  a third variant rather than as its own recipe file.
