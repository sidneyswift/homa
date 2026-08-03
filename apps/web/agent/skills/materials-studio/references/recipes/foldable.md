# Foldable / interactive notebook insert

Golden anchor: every generate_image call for a foldable carries
`anchorIds: ["foldable"]`, whether the image is the whole panel or one
small mnemonic character. The anchor leads the reference set and holds
the Homa foldable bar (tri-fold layout, fold lines, glue tab,
color-coded panels, embedded practice). Write your own prompt with
your own content; the anchor sets the visual bar, not the specifics.

A foldable is a tactile learning tool the child prints, cuts, folds,
and glues into a notebook. The reference material and the practice
live on the same physical object, not a separate worksheet. Foldables
are the format when the parent or inspo asks for interactive notebooks,
fold-and-glue inserts, or accordion-style reference cards.

The platform shell is portrait (8.5x11in). A foldable's content area
lives inside that shell rotated or divided so the final printed page
folds into the right shape. Never declare `@page`; the shell owns the
page. Two common layouts:

**Accordion tri-fold** (the PEMDAS pattern): divide the page into
three equal horizontal bands. Each band is one panel of the folded
strip. Top band = cover (title, mnemonic art, glue tab). Middle band
= definitions / reference. Bottom band = embedded practice problems.
The child cuts along the outer border, folds along the band borders,
and glues the tab into a notebook.

**Two-flap / four-flap book**: divide the page into a fixed base and
2-4 flaps that fold over it. Under each flap: a term, rule, or step.
On the flap surface: a prompt or question.

Design patterns (all binding for foldables):

- **Fold lines**: `border-top: 2.5px dashed var(--homa-control-boundary);` between panels.
  Label faintly: "✂️ cut" on outer edges, "fold" on internal
  creases, "glue here ▸" on the attachment tab.
- **Glue tab**: a narrow strip (~0.75in) on one end with a dotted
  border and "GLUE" in small caps. Background `#f5f0e8` so the child
  sees it is not content.
- **Large display text**: the key concept in big, bold letters
  (`font-size: 72px-110px; font-weight: 700;`). Bubble-letter style
  for younger kids (Fredoka weight 600+). Each letter or step can
  carry its own accent color for color-coded-by-concept.
- **Practice panel**: practice problems are part of the foldable, not
  a separate page. Place them in the bottom or back panel with answer
  blanks (`border-bottom: 2px solid var(--homa-control-boundary); width: 60px; display:
  inline-block;`).
- **Scaffolded versions**: generate the blank (fill-in) version first.
  Offer answer-key and color versions as follow-ups if the parent
  wants them. Keep the same layout, with answers in a muted accent color or full
  color fills on each section.
- **Mnemonic anchoring**: pair a verbal mnemonic with a small
  illustration (use generate_image with `anchorIds: ["foldable"]` for
  one small character/icon on white background, embed via hybrid
  path). Humor helps memory.

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  .foldable { width: 100%; }
  .panel { min-height: 200px; padding: 20px 24px;
    border-bottom: 2.5px dashed var(--homa-control-boundary); position: relative; }
  .panel:last-child { border-bottom: none; }
  .fold-label { position: absolute; right: 12px; top: -10px;
    font-size: 10px; color: var(--homa-control-boundary); font-family: sans-serif;
    letter-spacing: 0.1em; }
  .glue-tab { height: 56px; border: 2px dotted var(--homa-control-boundary);
    background: #f5f0e8; display: flex; align-items: center;
    justify-content: center; font-size: 11px; letter-spacing: 0.2em;
    color: var(--homa-control-boundary); text-transform: uppercase; }
  .concept-letter { font-family: 'Fredoka', sans-serif;
    font-weight: 700; font-size: 96px; display: inline-block;
    margin: 0 6px; }
  .practice-blank { border-bottom: 2px solid var(--homa-control-boundary);
    width: 60px; display: inline-block; margin: 0 4px; }
</style>

<div class="foldable">
  <div class="glue-tab">✂️ cut along outer edge · glue this tab into notebook</div>
  <div class="panel">
    <span class="fold-label">fold</span>
    <!-- Cover panel: title + mnemonic art -->
    <div style="text-align:center;">
      <span class="concept-letter" style="color:#e25b45;">P</span>
      <span class="concept-letter" style="color:#f5a623;">E</span>
      <span class="concept-letter" style="color:#4caf50;">M</span>
      <span class="concept-letter" style="color:#00897b;">D</span>
      <span class="concept-letter" style="color:#2196f3;">A</span>
      <span class="concept-letter" style="color:#9c27b0;">S</span>
    </div>
  </div>
  <div class="panel">
    <span class="fold-label">fold</span>
    <!-- Reference panel: definitions -->
  </div>
  <div class="panel">
    <!-- Practice panel: embedded problems -->
    <p>Solve: 3 + (4 × 2) = <span class="practice-blank"></span></p>
  </div>
</div>
```

Path choice: hybrid is the default (generate_image for the mnemonic
character or decorative art, HTML for structure and text). Use
image-direct when the whole foldable is art-driven (a coloring
foldable, a visual-only science diagram). Use html alone for
text-heavy reference foldables (vocabulary, formula cards) where
surgical revision matters more than organic feel.
