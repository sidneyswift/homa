## Choosing the creation path (per page, never by habit)

Three ways to make a page, all ending in create_printable:

| Path | How | Reaches its best on | Weak on |
|---|---|---|---|
| image-direct | generate_image (shape portrait) -> pageImageUrl | coloring pages, posters, art-heavy pages, whole simple worksheets (titles, short instructions, moderate counts all rendered correctly in calibration) | long word lists and paragraph text, exact curriculum geometry, cheap surgical revisions |
| html | you compose HTML/CSS -> html | tracing guides with exact proportions, text-dense pages, math layouts, tables, flash cards, anything the parent will nitpick line by line | organic art (CSS art reads as clip-art) |
| hybrid | generate_image for the art, your HTML for structure | themed worksheets: precise exercises + one strong image | nothing in particular; costs one image |

Before the first generate_image call in every build, read
`references/image-call-strategy.md` and follow its page-level art plan and
QA defect classification. This is binding: one ordinary single page uses
zero or one generated image by default, and crop, scale, whitespace, or
placement feedback revises HTML/CSS with the same image URL.

Judgment rules (calibrated 2026-07-10 against gpt-image-2, report in
docs/homa-planning/materials/calibration/2026-07-10/; this table updates
from calibration runs, re-check after any model swap):

- Coloring page or poster: image-direct. Put any exact wording in
  quotes in the prompt; calibration rendered titles, phrases, and six
  sight words all correctly spelled.
- Simple worksheet (a title, one instruction line, one exercise idea):
  image-direct is now viable, calibration produced a correct tracing
  page and exact 3/5/7 counting rows. Still prefer html when the parent
  is likely to iterate: an image revision re-rolls the whole page
  (40-60s, paid), an html revision changes one line (2-3s, free).
- Handwriting practice a curriculum family will scrutinize (letter
  proportions, guide spacing): html, so revisions are surgical.
- Text-dense pages (word lists, spelling sets, reading passages): html;
  density is still where image lettering degrades.
- Hybrid repetition law: when your HTML repeats an image (counting
  objects), generate a SINGLE object on a white background, nothing
  else, and repeat it yourself. Never repeat a full-page image
  (calibration's one failure, caught by the quality check).
- Sprite slicing is banned: never generate one image of a grid or sheet
  of objects and slice it into cells with CSS (background-size,
  background-position, overflow crops). The image model does not place
  objects on an exact pixel grid, and the print engine renders
  background-image positioning differently from the screen, so a sliced
  page can look right in the on-screen check and still ship broken.
- Many distinct objects on one page (a search-and-find ring, an I-spy
  mat, a sorting mat, a card sheet, a timeline, a comic): hybrid, with
  the complete composition as ONE
  generate_image call. Ask for a single image that already contains
  every object arranged the way the page needs, with no text or letters
  in the image. Your HTML owns the title, instructions, labels, and
  exact exercise geometry.
  Never go image-direct with the title baked into the art here; a wrong
  title means re-rolling the whole page. Never build the scatter from
  many separately positioned pieces or a sliced sheet.
- Foldable / interactive notebook insert: prefer hybrid (illustrated art +
  HTML structure) or image-direct when the whole panel is art-driven.
  Use html alone only for text-heavy reference foldables (vocab, formulas)
  where surgical revision matters more than organic feel.
- Structured outline or essay scaffold: html, always. Text precision,
  table alignment, and cheap surgical revision are the whole point;
  no organic art needed. Structure IS the design.

