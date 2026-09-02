# Pattern extension practice

Golden anchor: pass `anchorIds: ["pattern-extension-practice"]` to
generate_image so the output matches the Homa pattern rows bar (one
instruction line per row, big uniform rounded cells in one close
horizontal line, solid-outlined shown cells and dashed empty response
cells, two-element AB patterns in high-contrast solid colors,
copy/continue/choose/create rows stacked to fill the sheet, no numbers).
Write your own prompt with your own content; the anchor sets the visual
bar, not the specifics.

A page built around one repeating sequence (an AB pattern like
red-blue-red-blue, or an AAB/ABB variant once AB is solid) using colors,
shapes, or small themed icons. The child copies a shown pattern, identifies
or circles what comes next, draws a line matching the sequence to its
correct continuation, or creates an original pattern of their own in a
blank row.

Great for: ages 3-6, pre-number pattern and sequence readiness, any
early-math curriculum with a dedicated patterns unit (Singapore-style
movement/sound/visual pattern lessons, Montessori pattern work,
general Pre-K/K "what comes next" pages), also reusable outside math for
any simple repeating-sequence teaching moment (rhythm patterns in music,
seasons or days-of-the-week sequences).

Html path preferred: the repeating units are simple geometric shapes or
small icons that need exact, evenly-spaced repetition, which CSS/HTML
grids deliver more reliably than an image model. Hybrid is fine when the
pattern units are themed illustrations (animals, food) rather than plain
shapes or colors.

Design patterns (all binding for pattern-extension-practice):

- **One pattern rule per row**: state or imply the rule through the shown
  repetitions (at least two full cycles) before asking the child to
  continue it. Never introduce a new rule mid-row.
- **Pattern unit size**: large, uniform cells or icons
  (`width: 56px; height: 56px;` minimum) in a single horizontal row,
  evenly spaced (`gap: 12px;`), so the repeat is visually obvious.
- **Four response variants, pick one per row/page**:
  - *Copy*: a completed model pattern above, blank matching cells below
    for the child to recreate it exactly (coloring or stamping).
  - *Continue*: the pattern shown for 2-3 cycles, then 1-2 blank cells at
    the end for the child to fill in or draw what comes next.
  - *Choose*: the pattern shown with a gap, plus 3 answer choices below
    or beside it; the child circles or draws a line to the correct
    continuation.
  - *Create*: an empty row with only a "make your own pattern using 2
    colors/shapes" prompt and no fixed answer; open-ended, not
    self-checking.
- **Two elements for the first pattern rule (AB)**; only mix in a third
  element (AAB, ABB, ABC) on a later page once the child has shown AB
  mastery. Name this explicitly in any multi-page set.
- **High contrast, unambiguous units**: solid-colored shapes or simple
  bold icons, never two units that could be confused (e.g. two similar
  shades of the same color) at this age.
- **Instruction line at top**, plain and short: "Copy the pattern," "Color
  the shapes to finish the pattern," "Circle what comes next," "Make your
  own pattern."
- **No counting or arithmetic on the page.** Pattern work at this age is
  about noticing and extending a visual/auditory sequence, not counting
  occurrences; keep it separate from a counting or number-practice page.

```html
<style>
  .pat-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .pat-cell { width: 56px; height: 56px; border: 2px solid var(--homa-ink);
    border-radius: 8px; display: flex; align-items: center;
    justify-content: center; }
  .pat-cell-blank { border: 2px dashed var(--homa-control-boundary); background: #fff; }
  .pat-instruction { font-size: 16px; font-weight: 600; color: var(--homa-ink);
    margin-bottom: 12px; }
</style>
```
