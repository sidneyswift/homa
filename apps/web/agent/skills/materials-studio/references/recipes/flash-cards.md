# Flash cards

Golden anchor: pass `anchorIds: ["flash-cards"]` to generate_image so
the output matches the Homa flash card bar (2 by 2 grid of tall rounded
cards with dashed cut borders, one huge charcoal prompt centered per
card, tiny gray deck id at each card's bottom-left, a Name line header
with one child instruction, a parent note box filling the bottom). Write
your own prompt with your own content; the anchor sets the visual bar,
not the specifics.

A cut-apart deck for quick retrieval practice. Each card carries one exact
prompt, with any cue or answer kept on the reverse or in a parent key. The
same physical format works for vocabulary, math facts, symbols, and phonics.

Great for: brief recall rounds, letter and grapheme practice, matching games,
portable review, and duplicate tile sets for word building.

Always html. Card dimensions, cut lines, front-to-back registration, and
repeatable typography must be exact.

## Choose the deck before laying it out

Write a private deck blueprint with a stable `deckId`, one learning purpose,
and one record per card:

- `cardId`: unique within the deck.
- `front`: the exact child-facing prompt.
- `back`: an optional closed answer or parent cue.
- `setId`: an optional grouping key for sorting or matching.
- `copies`: the exact number of physical copies needed.

For phonics, use one trusted taught grapheme set. A model may choose which
taught set fits the family evidence, but every printed grapheme and cue must
come from the supplied blueprint. Do not invent a pronunciation, alternate
spelling, cue word, or skill order while composing the page. If the trusted
set is missing, ask for the target rather than making a broad alphabet deck.

## Copyright-safe content

- Build every deck from the child's skill goal and Homa's own blueprint.
  Never transcribe a publisher's deck, category names, examples, order, color
  system, illustrations, or card backs.
- Use original cues and public facts. A source may teach the useful mechanic,
  but it does not donate its word list or visual identity.
- A decoding card has no picture or model word on its front. A picture that
  reveals the answer turns decoding into recognition.
- Keep assessment and placement elsewhere. Cards are practice materials, not
  evidence that a skill is mastered.

## Design patterns (all binding for flash-cards)

- **One prompt per card**: the prompt fills the visual center. No directions,
  answer, skill label, or decorative sentence competes with it.
- **Large early-reader type**: at least 42px for a single letter or grapheme
  and 30px for one short word. Use Andika for child-facing phonics text.
- **Stable grid**: use 2 by 2 cards on letter paper by default, each card
  the binding 2.5in by 3.5in. The worked HTML below sets exactly that:
  fixed 2.5in columns and 3.5in rows, centered on the page, never `1fr`
  cells that stretch to fill it. A larger deck continues four cards at a time on
  additional pages, and only the deck's last page may hold fewer. A family
  naming another card size still gets the largest whole row and column
  count that exact size fits, every cell equal.
- **Cut-safe border**: a dashed outer cut line and at least 0.2in of quiet
  space inside it. Nothing important sits on a trim edge.
- **Deck identity stays small**: put the deck id and card number in 9px type
  at the bottom. This helps a parent re-sort mixed decks without cueing the
  answer.
- **Mirrored backs**: when backs matter, render a second page whose card order
  is mirrored across the long edge for the selected duplex mode. State the
  print flip setting on the parent page.
- **Duplicate tiles are explicit**: for word building, `copies` controls the
  duplicates. Never assume one of each grapheme can build every target.
- **One parent note**: name the taught set, suggest a 3 to 5 minute round, and
  say to stop before frustration. Do not print a speed target or pass score.

## Worked HTML

```html
<style>
  .deck { display: grid; grid-template-columns: repeat(2, 2.5in);
    grid-auto-rows: 3.5in; gap: 0.3in; justify-content: center; }
  .card { box-sizing: border-box; border: 2px dashed #8c8175;
    border-radius: 10px; padding: 18px; display: grid; place-items: center;
    position: relative; background: #fff; }
  .prompt { font: 700 52px Andika, sans-serif; color: var(--homa-ink);
    text-align: center; line-height: 1.1; }
  .card-id { position: absolute; left: 10px; bottom: 8px;
    font: 500 9px 'Plus Jakarta Sans', sans-serif; color: var(--homa-control-boundary); }
</style>
<div class="deck">
  <div class="card">
    <div class="prompt">{{front_1}}</div>
    <div class="card-id">{{deck_id}} · 1</div>
  </div>
  <div class="card">
    <div class="prompt">{{front_2}}</div>
    <div class="card-id">{{deck_id}} · 2</div>
  </div>
  <!-- Continue in blueprint order. -->
</div>
```

## Final quality gate

- Every card id, front, back, set id, and copy count matches the blueprint.
- No child-facing card leaks its answer or a decoding picture cue.
- Front and back grids align for the named duplex setting.
- Every card has a complete cut border and trim-safe content.
- The deck is original and carries no source-specific list, order, script,
  category system, artwork, or back design.

The countable part of that gate is also the reviewer's checklist.
create_printable reads it from this block when you pass
`recipe: "flash-cards"` and asks the quality check to answer every item
against the rendered pages; a blocking no holds the page back as
`Checklist (<id>)`.

```homa-checklist
- blocking card-count: Cards fill a whole grid of equal cells (2 by 2 unless the brief names another card size or count); only the deck's last card page may hold fewer, and a parent key or back page is not a card page.
- blocking one-prompt: Each card front carries one prompt filling its center, with no answer, direction, or picture cue beside it (backs and parent key pages may carry answers).
- blocking cut-border: Every card has a complete dashed cut border with quiet space inside it.
- advisory no-shading: No card carries a filled background.
```
