# One-page mini book

A single letter-size page with an 8-panel grid that folds into an 8-page
mini book. Requires precise panel placement so pages read in correct order
after folding: fold along all lines, fold in half, cut center dotted line,
fold lengthwise, push in ends, fold closed.

Great for: ages 3-8, sentence frame practice, emergent readers,
story retelling, vocabulary review. The child colors illustrations and
reads/traces the text on each page.

Always html path. Panel placement must be surgically precise for correct
reading order after folding. The image model cannot guarantee this.

Design patterns (all binding for one-page-mini-book):

- **2×4 grid**: `display: grid; grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(4, 1fr);` filling the full page.
- **Panel numbering**: panels numbered for fold sequence. The physical
  layout on the flat sheet is NOT the reading order; consult fold
  diagrams to place content correctly.
- **Center horizontal line = CUT line**: dashed, labeled "✂️ cut"
  (`border-top: 2.5px dashed #b3a492;`). All other internal lines are
  FOLD lines (`border: 1px solid #ccc;`).
- **Panel content**: cover (panel 1), story pages (panels 2-7), back
  cover (panel 8). Text must be oriented correctly for post-fold
  reading: some panels print upside-down on the flat sheet.
- **Sentence frame mini-books**: each page changes one variable (color,
  number, animal) with a B&W illustration the child colors. Pattern:
  "I see a [color] [animal]." with the variable word as a fill-in or
  pre-printed.
- **Large text**: `font-size: 24px;` minimum for early readers.
- **Fold instructions**: print on the back cover panel or as a small
  strip outside the grid.
