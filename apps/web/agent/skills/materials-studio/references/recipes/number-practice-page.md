# Number practice page

A single-number focus page with 4-5 activities on one sheet: tracing/writing
the numeral, ten frame fill-in, number word coloring, object counting
(color N stars/items). Repeatable template across numbers 1-20.

Great for: ages 3-6, number recognition, numeral formation, one-to-one
correspondence, cardinality. Especially effective as a daily warm-up or
number-of-the-week anchor page.

Always html path. Precise grid layout for multiple activity zones on a
single page requires surgical positioning the image model cannot guarantee.

Design patterns (all binding for number-practice-page):

- **Zone layout**: divide the page into 4-5 bordered sections
  (`border: 1.5px solid #6b6259; border-radius: 6px;`), each with a
  different activity targeting the same number.
- **Large numeral model**: top-center of the page, oversized
  (`font-size: 96px; font-weight: 700;`) so the child sees the target
  number at a glance.
- **Section 1 · trace the numeral**: starting dot in green on a 3-line
  guide (top, mid, baseline) matching the handwriting-practice
  baseline. 4-6 repetitions across the row, first dotted, last blank.
- **Section 2 · ten frame**: 2×5 grid of square cells. Fill exactly N
  cells with a colored dot or themed icon; remaining cells empty. Child
  can color or stamp the filled cells.
- **Section 3 · number word**: the word ("three") in large dotted
  outline letters for tracing or coloring.
- **Section 4 · count and color**: exactly N themed objects (stars,
  apples, dinosaurs) in a row with the instruction "Color N [objects]."
  Objects are outline-only for coloring.
- **Section 5 (optional) · independent writing**: 2-3 blank 3-line
  guide rows with the prompt "Write the number" and no model.
- **Name/date header** at top of page.

```html
<style>
  .np-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .np-numeral { text-align: center; font-size: 96px; font-weight: 700;
    color: #221e1a; margin-bottom: 16px; }
  .np-section { border: 1.5px solid #6b6259; border-radius: 6px;
    padding: 14px 16px; margin-bottom: 12px; }
  .np-section-title { font-size: 14px; font-weight: 600;
    color: #6b6259; margin-bottom: 8px; }
  .np-ten-frame { display: grid; grid-template-columns: repeat(5, 48px);
    gap: 4px; }
  .np-ten-cell { width: 48px; height: 48px; border: 2px solid #6b6259;
    border-radius: 4px; }
  .np-trace-line { border-bottom: 2px solid #6b6259;
    min-height: 48px; margin-bottom: 8px; }
</style>
```
