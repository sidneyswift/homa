# Dictation writing practice

Golden anchor: pass `anchorIds: ["dictation-writing-practice"]` to
generate_image so the output matches the Homa dictation child-page bar
(a title-plus-Name/Date header row, one direction line, five big
numbered solid writing lines, a taller two-line sentence area, a rounded
open-response box with faint ruled lines filling the sheet to the
bottom, pencil and star motifs only in the corners). Write your own
prompt with your own content; the anchor sets the visual bar, not the
specifics.

A short packet where a parent reads exact words and one original sentence,
the child writes what they hear, and both compare the work with a closed key.
An optional final prompt turns talk about a just-read text into a brief
child-authored response. This is guided practice, not a spelling test.

Great for: applying one already-taught spelling pattern, rehearsing sentence
conventions, connecting word study to real writing, and moving from oral
discussion into one manageable written response.

Always html through the packet path. The child page, parent script, and exact
key need separate roles, stable item ids, and line-by-line verification.

## Build the dictation blueprint

Use one already-taught skill and create a private blueprint with:

- `targetSkillId`: one trusted current catalog id.
- `wordItems`: stable ids, exact target words, and one original spoken cue per
  word when the word needs disambiguation.
- `sentenceItem`: one original dictated sentence, its exact written answer,
  and validated target spans.
- `conventions`: the closed punctuation and capitalization features included
  in the sentence.
- `responsePrompt`: an optional open question about a text the child just
  read, with no expected answer or score.
- `stopRule`: pause when the child asks or the task has become frustrating.

The model may choose the taught skill, author an original sentence, and write
an age-appropriate open response prompt. Deterministic validation owns item
ids, exact answers, literal target spans, accepted variants, and any scoring
or progression result. Drop an item that fails validation. Never invent a
pass threshold, mastery result, grade level, or timer in generated prose.

## Copyright-safe content

- Build original word cues, dictated sentences, and response prompts from the
  child's skill goal. Never copy a publisher's list, passage, sentence,
  script, order, scoring table, or page design.
- A response prompt may refer to the family's current text by title, but it
  must not reproduce the source passage or its proprietary questions.
- Each spoken cue makes the intended word unambiguous without revealing its
  spelling. If a cue cannot do that, remove the item.
- Keep one taught pattern per packet. Do not turn a practice page into a broad
  survey of unrelated conventions.

## Design patterns (all binding for dictation-writing-practice)

- **Three-page packet**: child writing page, parent guide and script, then
  answer key. Pass `pageRoles: ["child", "parent_guide", "answer_key"]`.
- **Child page stays answer-free**: numbered writing lines only. It never
  prints target words, cue sentences, answers, scores, or the source passage.
- **Short exact set**: 4 to 6 words plus one sentence for ages 6 to 8, or 6 to
  8 words plus one sentence for ages 9 and up. Evidence sets difficulty.
- **One calm routine**: the parent says the word, reads its original cue,
  repeats the word once, and gives the child time to write. No coaching one
  letter at a time during the first attempt.
- **Compare and repair**: the answer page supports checking each exact item,
  noticing the target pattern, and rewriting one corrected form. It records
  observation without generating a score or verdict.
- **Open response stays open**: when included, place a talk-first prompt and
  a generous response box after the dictated sentence. It has no answer key,
  rubric, or required wording.
- **No timing policy on paper**: this practice is untimed unless a versioned
  code-issued policy explicitly supplies neutral timing fields. The model
  never authors a clock target or interprets elapsed time.
- **Readable writing space**: every answer line is at least 42px tall for
  ages 8 to 10, with larger space when evidence calls for it.

## Tool sequence

1. Read the relevant phonics, spelling, or writing subject reference and
   select one already-taught skill from family evidence.
2. Build the original blueprint, then validate ids, answers, target spans,
   accepted variants, and convention fields before rendering.
3. Call `create_printable` once with all three pages in exact order and the
   required page roles. Fill child, subject, skill, curriculum, and text
   metadata completely.
4. Verify that every parent script item maps one-to-one to the child line and
   answer key. Confirm the open response has no generated expected answer.
5. Revise through `revisesId` when needed. Finalize only after parent
   approval.

## Worked child-page HTML

```html
<style>
  .dictation { font-family: Andika, sans-serif; color: var(--homa-ink); }
  .head { display: flex; justify-content: space-between;
    align-items: baseline; margin-bottom: 18px; }
  .title { font: 750 28px 'Plus Jakarta Sans', sans-serif; }
  .meta { font: 500 14px 'Plus Jakarta Sans', sans-serif; }
  .direction { font: 600 17px 'Plus Jakarta Sans', sans-serif;
    margin-bottom: 14px; }
  .items { display: grid; gap: 11px; }
  .item { display: grid; grid-template-columns: 34px 1fr;
    align-items: end; min-height: 58px; }
  .number { font: 700 16px 'Plus Jakarta Sans', sans-serif; }
  .line { border-bottom: 1.8px solid var(--homa-control-boundary); min-height: 46px; }
  .sentence { margin-top: 20px; }
  .sentence .line { min-height: 64px; }
  .response { margin-top: 22px; border: 1.5px solid var(--homa-control-boundary);
    border-radius: 10px; padding: 16px; }
  .response p { font: 600 17px 'Plus Jakarta Sans', sans-serif;
    margin: 0 0 10px; }
  .response-space { min-height: 145px;
    background: repeating-linear-gradient(#fff 0 34px, var(--homa-control-boundary) 35px 36px); }
</style>
<main class="dictation">
  <header class="head">
    <div class="title">Listen, write, check</div>
    <div class="meta">Name: {{child_name}} &nbsp; Date: ______</div>
  </header>
  <p class="direction">Write each word you hear. You can ask for it one more time.</p>
  <div class="items">
    <div class="item"><span class="number">1.</span><span class="line"></span></div>
    <div class="item"><span class="number">2.</span><span class="line"></span></div>
    <div class="item"><span class="number">3.</span><span class="line"></span></div>
    <div class="item"><span class="number">4.</span><span class="line"></span></div>
  </div>
  <section class="sentence">
    <p class="direction">Now write the whole sentence.</p>
    <div class="line"></div>
  </section>
  <section class="response">
    <p>{{optional_open_response_prompt}}</p>
    <div class="response-space"></div>
  </section>
</main>
```

## Final quality gate

- One already-taught skill owns every closed dictation item.
- Every item id, spoken cue, exact answer, accepted variant, and target span
  matches the validated blueprint.
- The child page leaks no word, sentence, cue, answer, or scoring rule.
- Parent script, child lines, and answer key map one-to-one in the same order.
- The optional response prompt is original, open, and unscored.
- No source sentence, publisher sequence, threshold, timer, or layout remains.
- Page roles, writing space, metadata, and every rendered item pass review.
