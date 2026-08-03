# 3-part nomenclature cards

Montessori three-part (or four-part) nomenclature card set:
(1) labeled image cards (control), (2) unlabeled image cards,
(3) name-only label cards, (4) optional definition cards.
Self-correcting by design: the child matches parts 2 and 3 against
the control card to check their work.

Great for: ages 3-8, Montessori families, vocabulary building, science
concepts, geography. Realistic imagery preferred over cartoon.

Always hybrid path. generate_image or search_photos for realistic
imagery; HTML for card grid layout and labels.

Design patterns (all binding for 3-part-nomenclature-cards):

- **Three grids** on separate pages (or clearly separated sections):
  Grid 1 = image + label below (control cards, red border
  `border: 2px solid #c0392b;`), Grid 2 = image only (blue border
  `border: 2px solid #2980b9;`), Grid 3 = label only (blue border).
- **All cards same size**: ~3×4 inches (`width: 216px; height: 288px;`).
- **Dashed cut borders**: `border: 2px dashed var(--homa-control-boundary);` on the outer
  cut line of each card.
- **Montessori color convention**: red border on control cards, blue on
  parts 2 and 3.
- **Realistic imagery**: prefer search_photos with keep_photo for
  photographs, or generate_image with "realistic, detailed" style.
  No cartoon.
- **Optional 4th grid**: definition cards with fill-in-the-blank
  sentence using the vocabulary term.
- **Card backs**: optionally print category name on the back of each
  card for sorting.
