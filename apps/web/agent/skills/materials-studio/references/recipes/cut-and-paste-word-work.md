# Cut-and-paste word work

**Golden anchor (binding):** pass `anchorIds: ["cut-and-paste-word-work"]` to generate_image so the output matches the Homa visual bar for this format. If the material teaches a topic with its own anchor (see the router Golden anchors table), ride that instead. Your prompt supplies the content; the anchor sets the bar.

A multi-sensory word work page where the child sees the model word,
writes it on a practice line, then cuts out a tile and pastes it into
a notebook or sorting activity. Four modalities for one concept: see,
write, cut, paste. This is the format when the parent asks for
cut-and-paste activities, word work, word sorts, or multi-sensory
phonics practice.

Great for: CVC words, word families, sight words, vocabulary,
sorting activities. Especially effective for K-2 phonics and
special education where kinesthetic manipulation reinforces learning.

Always html path. Precise grid geometry, dotted cut lines, and
writing lines need surgical precision that the image model cannot
reliably produce.

Design patterns (all binding for cut-and-paste):

- **Grid layout**: 2-column grid, one word per cell. 6-8 words
  per page for K-2; can increase to 10-12 for older students.
- **Cell structure**: each cell contains three elements stacked
  vertically: (1) printed model word in large clear type, (2) a
  writing practice line matching the handwriting-practice baseline,
  (3) a cut-out tile at the bottom of the cell.
- **Dotted cut borders**: `border: 2px dashed #b3a492;` on cut-out
  tiles and the horizontal separator line between the practice area
  and the tile strip.
- **Cut tiles strip**: a horizontal band at the bottom of the page,
  separated from the main grid by a labeled cut line
  ("✂️ cut along this line"). Each tile repeats the word in a
  bordered box the child cuts out individually.
- **Writing lines**: match the tracing-guide baseline style
  (`border-bottom: 2px solid #6b6259; min-height: 28px;`).
- **Consistent cell sizing**: all cells equal height and width for
  clean grid alignment.
- **Visual clarity**: large, clear font for model words
  (`font-size: 32px; font-weight: 600;`). Enough spacing between
  cells for small hands to cut.

```html
<link href="https://fonts.googleapis.com/css2?family=Andika&display=swap" rel="stylesheet">
<style>
  .cwp-grid { display: grid; grid-template-columns: 1fr 1fr;
    gap: 16px; margin-bottom: 24px; }
  .cwp-cell { border: 1.5px solid #6b6259; border-radius: 6px;
    padding: 14px 16px; text-align: center; }
  .cwp-model { font-family: 'Andika', sans-serif; font-size: 32px;
    font-weight: 600; color: #221e1a; margin-bottom: 8px; }
  .cwp-write-line { border-bottom: 2px solid #6b6259;
    min-height: 28px; margin: 8px auto; width: 85%; }
  .cwp-cut-separator { border-top: 2.5px dashed #b3a492;
    margin: 20px 0 12px; position: relative; padding-top: 4px; }
  .cwp-cut-label { font-size: 10px; color: #b3a492;
    letter-spacing: 0.1em; text-align: center; }
  .cwp-tiles { display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 10px; }
  .cwp-tile { border: 2px dashed #b3a492; border-radius: 4px;
    padding: 10px; text-align: center; font-family: 'Andika', sans-serif;
    font-size: 22px; }
</style>

<div class="cwp-grid">
  <div class="cwp-cell">
    <div class="cwp-model">cat</div>
    <div class="cwp-write-line"></div>
  </div>
  <div class="cwp-cell">
    <div class="cwp-model">hat</div>
    <div class="cwp-write-line"></div>
  </div>
  <!-- repeat for remaining words -->
</div>

<div class="cwp-cut-separator">
  <div class="cwp-cut-label">✂️ cut along this line</div>
</div>

<div class="cwp-tiles">
  <div class="cwp-tile">cat</div>
  <div class="cwp-tile">hat</div>
  <!-- one tile per word -->
</div>
```

Path choice: html, always. The grid geometry, dotted cut lines, and
writing-line precision are exactly what the html path exists for.
Image-direct would lose the cut-line fidelity that makes this format
work as a physical manipulative.
