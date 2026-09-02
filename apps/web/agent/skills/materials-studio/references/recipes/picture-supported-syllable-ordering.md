# Picture-supported syllable ordering

Golden anchor: pass `anchorIds: ["picture-supported-syllable-ordering"]`
to generate_image so the output matches the Homa syllable ordering bar
(a 2 by 3 grid of big rounded brown-outlined cards, one simple line-art
picture per card, bold lowercase syllable chips in separate teal-tinted
bordered boxes, one wide empty writing box per card, a title plus one
child instruction line and a Nombre line, corner pencil and star only).
Write your own prompt with your own content; the anchor sets the visual
bar, not the specifics.

A precise word-building page where the child identifies a pictured Spanish
word, puts a supplied set of syllable chunks in order, then writes the whole
word in one bounded response area.

Great for: early Spanish literacy after the pictured vocabulary and syllable
pattern have already been taught, especially two- and three-syllable concrete
words.

Use the hybrid packet path. HTML owns every printed word, chunk, number, and
answer cell. One composed image sheet may supply the picture cues, but each
image slot must remain bound to its stable item id.

## Required blueprint and verification

Use 4 to 8 trusted target records from one current Spanish skill. Each record
carries:

- `itemId`: stable within the packet.
- `targetSkillId`: a trusted current catalog id.
- `word`: the exact NFC-normalized Spanish answer.
- `syllables`: the trusted ordered syllable chunks. These come from a
  validated curriculum record or an exact parent-supplied segmentation.
- `scrambledOrder`: a permutation of the syllable indices that is not already
  the answer order.
- `picturePrompt`: one concrete visual description that identifies the word
  without printed text.

Deterministic validation verifies that every field is present, each syllable
is nonempty, the ordered chunks concatenate exactly to `word`, and
`scrambledOrder` is a complete non-answer permutation with no repeated or
missing index. It also verifies that every printed chunk comes from that
permutation and that the key reconstructs the exact answer.

The model may choose a suitable concrete picture treatment. It may not invent
Spanish syllable boundaries. If no trusted segmentation exists, stop and ask
for target words with their syllables instead of guessing.

## Copyright-safe content

- Build a fresh target set for the trusted skill. Never copy a source word
  list, order, directions, pictures, border system, or page geometry.
- Do not reuse a publisher's characters or illustrations. Generate original,
  simple object cues or use family-provided art that is authorized for reuse.
- A picture is an intentional vocabulary cue here. Do not route a decoding
  check into this recipe, because the cue would reveal the answer.

## Design patterns

- **Two-page packet**: child practice and a separate parent key. Pass
  `pageRoles: ["child", "answer_key"]`.
- **One action per card**: picture, bold scrambled chunks, then one writing
  cell. Do not add cutting, pasting, tracing, or a model word.
- **Bold, separated chunks**: render each syllable in its own bordered chip at
  least 24px high, with enough space that the chunk boundaries are obvious.
- **Bounded answer area**: use one wide cell or one short baseline per word.
  The child writes the reconstructed whole word, not one letter in every box.
- **Concrete picture cues**: choose readily pictured nouns or actions. Reject
  an abstract or ambiguous word whose image could name several answers.
- **Stable image map**: generate the full picture sheet in one call using
  item ids and fixed slots. Review every slot against its `picturePrompt`.
  Regenerate a mismatched slot set; never relabel the wrong picture.
- **Original scramble**: choose a fresh valid permutation. Do not preserve a
  publisher's target order or sequence.
- **Separate key**: the answer page repeats each item id, picture label, exact
  ordered syllables, and whole word. No answer appears on the child page.

## Worked HTML

```html
<style>
  .syllable-grid { display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 16px; }
  .syllable-card { border: 1.5px solid #8c8175; border-radius: 14px;
    padding: 14px; break-inside: avoid; }
  .picture-slot { height: 118px; display: grid; place-items: center;
    margin-bottom: 10px; }
  .chunks { display: flex; justify-content: center; gap: 10px;
    flex-wrap: wrap; margin-bottom: 12px; }
  .chunk { border: 2px solid var(--homa-ink); border-radius: 9px; padding: 7px 12px;
    font: 750 27px Andika, sans-serif; letter-spacing: 0.04em; }
  .answer-cell { min-height: 46px; border: 2px solid var(--homa-control-boundary);
    border-radius: 8px; }
</style>
<div class="syllable-grid">
  <section class="syllable-card" data-item-id="{{item_id_1}}">
    <div class="picture-slot">{{picture_1}}</div>
    <div class="chunks">
      <span class="chunk">{{chunk_1a}}</span>
      <span class="chunk">{{chunk_1b}}</span>
    </div>
    <div class="answer-cell"></div>
  </section>
</div>
```

## Final quality gate

- Every item belongs to one trusted taught skill and has trusted Spanish
  syllable segmentation.
- Every scramble is a complete non-answer permutation, and the key rebuilds
  the exact NFC-normalized word.
- Every picture cue names only its bound target and contains no answer text.
- Chunks are bold and visibly separated, with a generous whole-word response
  area.
- The child page contains no source word list, art, directions, sequence, or
  layout.
