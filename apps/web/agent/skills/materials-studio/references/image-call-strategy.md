# Image call strategy

Read this before the first `generate_image` call in every material build.
This procedure keeps normal single pages fast by designing the art once. It is
not a time, token, or image quota, and a parent never supplies a budget.

## Plan at page level

For each page, decide among these paths before calling a tool:

1. **No generated art.** Use HTML/CSS for exact words, numbers, lines, tables,
   grids, cut marks, answer areas, geometric shapes, and simple symbols.
2. **One reusable object.** Generate one isolated object on white, then reuse
   that exact URL in HTML for repetitions such as counting groups or patterns.
3. **One composed scene.** Generate all distinct visual subjects that belong
   together as one coherent illustration. Use this for search-and-find pages,
   comparisons, timelines, comics, schedule-card sheets, and bingo boards.
   Ask for the page's whole visual composition with no text. HTML owns exact
   labels and exercises when they can sit outside or around the composition.
4. **One complete page.** Use image-direct when the image model can own the
   entire simple page and the wording is short enough to verify reliably.

An ordinary single-page material therefore uses zero or one generated image by
default. A multi-page packet may use a different image on a page that genuinely
needs different art, but plan all pages first and reuse shared characters,
objects, and scenes wherever possible.

Do not make separate image calls for every object, card, panel, event, question,
or decorative spot on one page. If one composed illustration cannot preserve
the page's exact geometry, switch that structure to HTML/CSS. Do not trade one
slow failure mode for an unreliable sprite-slicing workaround.

## Classify QA feedback before revising

The quality check can report two different defect classes. Treat them
differently:

### Layout defects: reuse the exact image URL

- cropped, clipped, cut off, or outside a frame
- too small, too large, or surrounded by whitespace
- poor placement, alignment, spacing, or page fill
- title, label, answer line, or cut line in the wrong place

These are HTML/CSS or page-composition defects. Keep the original generated URL
and change `object-fit`, `object-position`, container dimensions, margins,
padding, grid placement, typography, or page HTML. A layout complaint never
authorizes another `generate_image` call.

### Pixel defects: regeneration may be appropriate

- wrong subject, missing required subject, or unusable composition
- misspelled text that cannot be moved into HTML
- watermark, stray lettering, malformed anatomy, or broken visual detail
- provider refusal or an image-tool error

Regenerate only the defective page art, not other passing pages. Preserve the
same anchor and good references. If the same page fails twice, stop and ask the
parent as the main skill requires.

## Final check

Before each `generate_image` call, answer internally:

- Which page needs this image?
- Why can the existing URL, HTML/CSS, or a single composed scene not do it?
- Is the defect in the pixels, or only in how the pixels are placed?

If the answer is placement, do not generate. Revise the printable with the same
URL.
