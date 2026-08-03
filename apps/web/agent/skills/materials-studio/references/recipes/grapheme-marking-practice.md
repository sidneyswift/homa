# Grapheme marking practice

A precise word-marking page where the child reads a word and marks the letter
or letter group representing each sound. It makes grapheme boundaries visible
without turning the page into a broad spelling test.

Great for: noticing digraphs and trigraphs, comparing two spellings of one
sound, mapping a taught word pattern, and preparing for word sorting.

Always html. Exact text, character spans, baselines, and the parent key matter
more than illustration.

## Required blueprint and verification

Use one taught skill and 6 to 10 validated item records. Each record carries:

- `word`: the exact printed word.
- `graphemeSpans`: ordered, non-overlapping start and end indices.
- `targetSpan`: the one span emphasized by this practice set.
- `answerLabel`: a parent-facing label for the sound or spelling pattern.

The model chooses the taught skill from trusted child evidence and proposes
age-appropriate items. Deterministic code verifies that every span is in
bounds, the spans cover the intended letters in order, and `targetSpan`
literally matches the printed word. A failed record is dropped, never repaired
by a model guess after rendering.

## Copyright-safe content

- Build a fresh list for the trusted skill. Never transcribe a publisher's
  list, item order, modeled example, annotation marks, directions, or key.
- Do not copy a proprietary underline, dot, arc, or color notation system.
  Homa uses one plain underline convention explained on the page.
- Do not use a sentence or picture that gives away the word.

## Design patterns (all binding for grapheme-marking-practice)

- **Two-page packet**: one child page and one parent key. Pass
  `pageRoles: ["child", "answer_key"]`.
- **One marking convention**: underline each grapheme once. Do not mix arcs,
  dots, boxes, colors, and slash marks on the same page.
- **Modeled geometry, fresh item**: show one original practice example whose
  answer is not repeated in the scored rows. Label it "Try this together."
- **Letter-safe markup**: render each word as character spans so the underline
  sits under the intended letters. Never draw one approximate line beneath a
  rasterized word.
- **Generous baseline**: at least 18px beneath each 30px word for a pencil
  mark. Use 6 rows for ages 5 to 6 and up to 10 for older learners.
- **One target pattern**: the page may ask the child to mark every grapheme,
  but all items practice the same taught target span.
- **Exact parent key**: reproduce every word with its validated grapheme spans
  marked. Keep the key off the reverse of the child page when ink show-through
  could reveal answers.
- **No aggregate score**: this is practice. The parent may note a pattern, but
  the page never prints a pass threshold or placement rule.

## Worked HTML

```html
<style>
  .mark-title { font: 750 27px 'Plus Jakarta Sans', sans-serif; }
  .mark-cue { font: 600 16px 'Plus Jakarta Sans', sans-serif;
    margin: 10px 0 20px; }
  .mark-list { display: grid; gap: 12px; }
  .mark-row { display: grid; grid-template-columns: 36px 1fr;
    align-items: end; min-height: 72px; border-bottom: 1px solid var(--homa-control-boundary); }
  .mark-word { font: 600 31px Andika, sans-serif; letter-spacing: 0.04em;
    padding-bottom: 18px; }
  .grapheme-answer { border-bottom: 3px solid var(--homa-ink); }
</style>
<div class="mark-title">Mark the sound spellings</div>
<div class="mark-cue">Read each word. Underline the letters for each sound.</div>
<div class="mark-list">
  <div class="mark-row"><span>1.</span><span class="mark-word">{{word_1}}</span></div>
  <div class="mark-row"><span>2.</span><span class="mark-word">{{word_2}}</span></div>
</div>
```

On the answer page only, wrap each validated grapheme span in
`<span class="grapheme-answer">...</span>`.

## Final quality gate

- Every word belongs to one trusted taught skill and has validated spans.
- Underlines align with exact character spans on the answer page.
- The modeled example is original and does not repeat a child-page item.
- Child rows leave enough room for pencil marks and leak no answers.
- No source list, order, notation system, directions, or key was copied.
