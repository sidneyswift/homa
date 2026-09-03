# Phonics sound card game

Golden anchor: pass `anchorIds: ["phonics-sound-card-game"]` to
generate_image so the output matches the Homa phonics sound card game
bar (a cut-apart page of word cards forming closed pairs or families by
one taught sound-spelling relationship). Write your own prompt with your
own content; the anchor sets the visual bar, not the specifics.

A cut-apart matching game where cards form closed pairs or families by one
taught sound-spelling relationship. The child reads each card, then uses the
game's exact match rule to keep a pair or set.

Great for: repeated decoding without a worksheet, matching words that share a
grapheme, grouping alternate spellings for one known sound, and family game
rounds with a small taught word pool.

Always html through the packet path. Card ids, family keys, cut geometry,
backs, and the parent answer map must remain exact.

## Build a closed game blueprint

Each card record carries `cardId`, child-facing `text`, and a hidden
`matchFamilyId`. The blueprint also names one taught `targetSkillId`, the exact
number of cards per family, and one of these rules:

- `pair-same-grapheme`: two different words share the taught grapheme.
- `pair-same-phoneme`: two words use allowed spellings for the same taught
  sound.
- `family-sort`: three or four cards belong to each closed family.

The model chooses an appealing theme and proposes items from the trusted
taught pool. Deterministic validation verifies every family id, exact family
size, card uniqueness, and that no card belongs to two families. If the closed
answer map fails, drop the item or rebuild the set before rendering.

## Copyright-safe content

- Use an original card pool and Homa's own rules text. Never copy a source
  title, deck, family grouping, sequence, special-card mechanic, back pattern,
  illustrations, or directions.
- Do not imitate a commercially named matching game. Call the child page
  "Sound match" or use the family's own neutral title.
- Pictures may decorate the rule card but never reveal a decoding answer.
- Keep winning separate from mastery. A won round is not a progress score.

## Design patterns (all binding for phonics-sound-card-game)

- **Three-page minimum**: card fronts, one shared card-back page, and parent
  rules plus answer map. Pass child pages first and `parent_guide` last.
- **Small closed deck**: 12 to 24 cards. Use 6 to 8 pairs for a new pattern and
  no more than 6 families in a family-sort round.
- **One readable word per card**: at least 28px Andika, centered, with no
  visible family color or symbol that gives away the match.
- **Stable card ids**: put a tiny id in one corner. The parent key maps ids to
  family ids, so a mistaken or missing card can be diagnosed exactly.
- **Duplex-tolerant back**: one centered, rotation-safe Homa-made pattern with
  a generous quiet margin. Never place edge art that exposes print drift.
- **Three-step rules**: turn over cards, read each word, keep only a valid
  match. State what happens on a miss in one short sentence.
- **Closed answer map**: list every family and its card ids on the parent page.
  Do not ask a parent or model to judge whether two words sound close enough.
- **Warm stop**: suggest a 5 to 8 minute round and stop while it is still fun.

## Worked HTML

```html
<style>
  .game-grid { display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; }
  .game-card { min-height: 150px; border: 2px dashed #8c8175;
    border-radius: 10px; display: grid; place-items: center;
    position: relative; background: #fff; }
  .game-word { font: 700 31px Andika, sans-serif; color: var(--homa-ink); }
  .game-id { position: absolute; right: 8px; bottom: 6px;
    font: 500 9px 'Plus Jakarta Sans', sans-serif; color: var(--homa-control-boundary); }
</style>
<div class="game-grid">
  <div class="game-card">
    <div class="game-word">{{card_text_1}}</div>
    <div class="game-id">{{card_id_1}}</div>
  </div>
  <div class="game-card">
    <div class="game-word">{{card_text_2}}</div>
    <div class="game-id">{{card_id_2}}</div>
  </div>
</div>
```

## Final quality gate

- One taught sound-spelling skill and one match rule govern the deck.
- Every family is closed, unique, complete, and verified before rendering.
- Card fronts carry no visual family cue and every id matches the parent map.
- The shared back survives small duplex drift.
- The title, word pool, groupings, rules, and visual identity are original.
