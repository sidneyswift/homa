# Size attribute comparison page

A page where the child compares two or three illustrated items along one
physical attribute (length, height, weight, or overall size) and marks the
answer: circle the longer/taller/bigger/heavier one, color the
shorter/smaller/lighter one, or draw a new item that is longer or shorter
than the model. A balance-scale variant shows two items on a seesaw or
balance and asks which side is heavier or lighter.

Great for: ages 3-6, pre-number measurement readiness (before any unit of
measurement is introduced), Singapore-style Pre-K/K comparison lessons
(big/small, long/short, tall/short, heavy/light), any early-math or
early-science curriculum that teaches comparative adjectives through
paired objects rather than rulers or scales.

Hybrid path preferred: generate every compared item together in one
composition so their shared baseline and relative scale are intrinsic to
the art. Never make a separate call per item. HTML owns the instruction
line, circle/color prompts, and the optional balance-scale frame. Html-only
works for a simple two-shape
version (e.g. two rectangles of different length) where precise geometry
matters more than illustration appeal.

Design patterns (all binding for size-attribute-comparison-page):

- **One attribute per page**: never mix length and weight, or size and
  height, on the same page. The comparison must be along a single,
  clearly named dimension.
- **Two or three items, one comparison**: most items pair (this one vs.
  that one); a three-item row is fine for "circle the biggest" once the
  child has the two-item version down, never more than three.
- **Shared baseline or shared anchor point**: items being compared for
  length or height must start from the same visual baseline (bottom-
  aligned for height, left-aligned for length) so the comparison is
  purely about the attribute, not position on the page.
- **Instruction line at top**, plain and short: "Circle the longer one,"
  "Color the smaller thing," "Draw a longer pencil than this one."
- **Response modes**: circle the correct item (`border: 3px solid
  #e25b45; border-radius: 50%;` drawn around it), color the correct item,
  or draw-your-own in a blank response box beside a fixed model (for the
  "draw a longer/shorter one" variant).
- **Balance-scale variant**: a simple seesaw or two-pan balance
  illustration with one item on each side; the heavier side sits visibly
  lower, the lighter side higher, so the correct answer is legible even
  before the child reasons about it. Ask "which is heavier?" or "which is
  lighter?", never both on the same balance.
- **No numbers or units anywhere on the page.** This format is for
  comparative language (bigger, longer, taller, heavier) before any
  measurement unit is introduced; a ruler, scale reading, or numeral
  belongs on a different format.
- **Large, simple, real-world items**: pencils, ribbons, snakes, animals,
  buildings, boxes. Thick outlines, minimal internal detail, so the size
  difference is the only thing competing for attention.
