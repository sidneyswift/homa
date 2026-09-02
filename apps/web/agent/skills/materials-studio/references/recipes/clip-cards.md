# Clip cards

Golden anchor: pass `anchorIds: ["clip-cards"]` to generate_image so the
output matches the Homa clip-card bar (six big rounded-rectangle cards
in a 2 by 3 grid, target objects filling the top two-thirds of each
card, three large numerals flush along the bottom edge with clip-width
gaps, dashed cut lines with a scissors mark in the gutters, corner-only
clothespin and star motifs). Write your own prompt with your own
content; the anchor sets the visual bar, not the specifics.

A set of cards, each with a target item on top and 3 answer choices along
the bottom edge. The child clips a clothespin (or drops a coin, or marks
with a dot marker) on the correct answer. Self-checking when the back of
the card carries a small dot behind the right choice.

Great for: ages 3-7, counting (count the objects, clip the numeral),
letter sounds (picture on top, clip the letter), rhymes, shapes, colors,
Spanish vocabulary. A core fine-motor-plus-recognition format.

Always html path for the card grid; hybrid when the target images need
illustration. 6-8 cards per letter page, 2 columns.

Design patterns (all binding for clip-cards):

- **Card geometry**: rounded rectangle (`border: 2px solid var(--homa-ink);
  border-radius: 12px;`), roughly 3.5in wide so a clothespin fits the
  bottom edge. Answer choices sit in a row flush with the bottom edge
  with clear space between them for the clip.
- **One question per card**: the target (image or numeral or word)
  dominates the top two-thirds.
- **Three choices, one clearly correct**: distractors are plausible but
  not tricky at this age. Large type or large icons.
- **Self-check dots**: a small filled dot printed on the reverse behind
  the correct answer (a second page, mirrored, with the note "print
  double-sided to make the cards self-checking").
- **Cut lines** between cards, lamination note once, per the printed
  manipulative rules above.
