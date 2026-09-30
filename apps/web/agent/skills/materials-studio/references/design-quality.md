## Design rules (binding)

- The page belongs to the child, not to Homa: no logo header, no brand
  banner, no marketing. The footer credit is added by the platform.
- Ink-light and grayscale-safe: white background, line art over filled
  art, color as accent only. Home printers are the target.
- Big type, one skill per page, and content SCALED to fill the sheet. A
  page is full because its items are big, never because there are many:
  two giant items fill a page for a 3-year-old, and eight cramped rows
  can leave a quarter of the sheet dead. Blank space at the bottom is
  not design air, it is items that should have been scaled up (type,
  answer blanks, pictures, the spacing between rows) until the content
  reached the bottom of the printable area. Cluttered still reads as
  homework, so the answer to a short page is bigger, never denser.
  Founder ruling 2026-07-29 (`worksheet-scale-to-fill`) retires the old
  "generous whitespace, spacious reads as play" wording here: it was
  being read as license to leave a dead band at the bottom, and a
  co-founder asked seven times across three days for pages that reach
  the bottom of the sheet. Her complaint was never simplicity versus
  complexity, it was space where things could have been scaled to fit.
  And scaling means the ITEMS get bigger, never the gaps: spreading
  three objects across the full sheet width is the same dead space
  turned sideways (a real page shipped three trucks with six inches of
  air between them, 2026-07-30). Things that belong together stay
  together, close enough to read as one group, and an answer box sits
  at the end of the row it answers, never floating on its own.
- Write instructions TO the child, one short line each. A name line up
  top or the child's name pre-printed, spelled exactly as the family
  spells it.
- Never red-pen framing, scores, or anything that grades.
- When a page has room, a small "try this together" box at the bottom
  offers the parent one playful real-world extension of the skill (count
  the forks while setting the table). An offer for connection, never
  homework, never required to finish the page.

## Page density by age (layout and item counts; the LEVEL comes from evidence, above)

| Age | What a page should ask |
|---|---|
| 2-3 | 2-3 giant items: point, color, match, sticker-sized targets |
| 4-5 | 3-5 items: trace big letters/numbers, count to 10, circle the match |
| 6-7 | 4-6 items: write on lines, simple sums, sight words, mazes |
| 8-10 | 5-8 items: multi-step problems, short writing prompts, labeling |
| 11+ | fewer, deeper: worked examples, outlines, real diagrams |

Typographic floors for child-facing pages, never a target: body text at
least 16px for ages 8-10 (smaller strains reading at that age), and
every answer blank at least 34px tall (room for a child's handwriting,
not an adult's signature line). Bigger is always fine when the page has
room; these are floors under a page's readability, not a size to stop
at.

## Metadata discipline (what makes reuse possible)

Fill create_printable's metadata every time: kind, recipe (the slug you
built from, when one fit), subject, skill, curriculum (when the family
follows one, e.g. "Handwriting Without Tears"), theme, characters
(spelled the family's way), childId. Sloppy metadata means
find_materials cannot find it next month, and the "same page for the
sibling" move stops working.

`sourceFamilyAssetIds` is provenance, not discovery metadata. Supply it only
from exact Family Library retrieval as described above. A source-grounded
material still belongs in Binder; its source card points back to the original
in Library.

