# Curiosity-led notebook page

A spacious weekly notebook surface that helps a child preserve the part of a
shared reading theme that caught their own attention. The parent or Homa chooses
the page format and the broad theme, while the child chooses the book, page,
image, fact, or quotation to record.

Great for: literature-rich unit studies, thematic read-aloud baskets, mixed-age
family learning, child-led reading responses, and a weekly learning portfolio.

Always html path. This format is mostly intentional blank space for the child's
own mark making. Do not generate a completed reference illustration, a correct
answer, or a prescribed response.

Design patterns (all binding for curiosity-led-notebook-page):

- **One broad theme only**: the title may name the shared theme, such as
  "Flight" or "London," but it must not name the book or fact the child should
  choose.
- **Choice stays visible**: include one short invitation such as "Choose the
  page, picture, idea, or words that stayed with you." Never turn it into a
  comprehension question.
- **One generous canvas**: at least 55 percent of the printable area is an open,
  unruled box where the child may sketch, paint, diagram, label, or place a
  copied quotation.
- **Optional words, not required prose**: add no more than four wide writing
  lines beneath the canvas. Label them "Words I want to remember" or leave them
  unlabeled for dictation, captions, and quotations.
- **Multiple modes are welcome**: a child may sketch, paint, label, copy a short
  quotation, or combine them. The page must not imply that one mode is the
  complete or preferred response.
- **No answer key and no rubric**: this is a record of attention, not a scored
  reading check. The completed pages may form a chronological portfolio.
- **Mixed-age adaptation**: ages 4 to 7 get a larger canvas and two lines; ages
  8 to 14 may get four lines and a small source-title blank. Never make the
  younger version depend on independent writing.
- **Ink-light**: use one thin border, one small line-art motif tied to the broad
  theme, and no filled background. The child's work remains the visual focus.

```html
<style>
  .cn-page { font-family: 'Andika', sans-serif; padding: 28px; color: var(--homa-ink); }
  .cn-theme { font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
    color: var(--homa-control-boundary); }
  .cn-title { font-size: 24px; font-weight: 650; margin: 4px 0 8px; }
  .cn-invitation { font-size: 14px; margin-bottom: 16px; }
  .cn-canvas { min-height: 430px; border: 2px solid var(--homa-ink);
    border-radius: 6px; background: white; }
  .cn-words-label { margin-top: 16px; font-size: 13px; font-weight: 600; }
  .cn-line { min-height: 30px; border-bottom: 1px solid var(--homa-control-boundary); }
  .cn-source { display: flex; gap: 8px; margin-top: 14px; font-size: 12px; }
  .cn-source-line { flex: 1; border-bottom: 1px solid var(--homa-control-boundary); }
</style>
<main class="cn-page">
  <div class="cn-theme">This week's theme</div>
  <h1 class="cn-title">Flight</h1>
  <p class="cn-invitation">Choose the page, picture, idea, or words that stayed with you.</p>
  <section class="cn-canvas" aria-label="Open space for the child's notebook response"></section>
  <div class="cn-words-label">Words I want to remember</div>
  <div class="cn-line"></div>
  <div class="cn-line"></div>
  <div class="cn-source"><span>Book:</span><span class="cn-source-line"></span></div>
</main>
```
