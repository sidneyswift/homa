# Decodable story page

A short original connected-text page constrained to phonics patterns the
child has already been taught. It gives those patterns a reason to be read,
then supports one or two rereads without turning the story into a test.

Great for: applying a taught grapheme set in connected text, building reading
stamina after word-level practice, and making a small personalized phonics
story from a validated decoding inventory.

Always html through the packet path. Text content, line breaks, token
validation, page roles, and parent notes must be exact.

## Required validated text contract

Before layout, build a structured story record with:

- `targetSkillIds`: trusted taught skill ids.
- `allowedGraphemeIds`: the closed grapheme inventory.
- `allowedWordIds`: validated regular words available to the story.
- `heartWordIds`: a short explicit list of taught irregular words.
- `sentences`: original sentence records whose tokens reference those ids.
- `validationResult`: a deterministic pass for every printed token and its
  grapheme spans.

The model chooses the story idea, characters, and clear sentence sequence.
Code verifies the closed vocabulary and exact grapheme coverage. A model may
not certify its own story as decodable. If the validator or trusted inventory
is unavailable, stop and ask for the named phonics scope. Do not print a story
and call it decodable on plausibility alone.

## Copyright-safe content

- Write an original story from the child's interests and the validated word
  inventory. Never copy or closely paraphrase a source story, sentence set,
  character, title, plot sequence, word list, page arrangement, or art.
- A curriculum may reveal the connected-text mechanic. Its authored reading
  material remains outside Homa.
- Use Homa-made spot art only when it does not cue an unknown word. The text
  must remain readable without the illustration.

## Design patterns (all binding for decodable-story-page)

- **Two-page packet**: child story page, then parent guide and validation key.
  Pass `pageRoles: ["child", "parent_guide"]`.
- **One complete tiny story**: a beginning, a change, and a satisfying close.
  Use 6 to 10 short sentences, adjusted downward when the inventory is small.
- **Age from evidence, not grade labels**: early readers get 24 to 28px Andika,
  short lines, and generous leading. Never print a grade or reading level.
- **Controlled vocabulary is visible to the parent**: the guide names the
  newly practiced pattern and separately lists any heart words. It does not
  expose a child-facing answer key.
- **Exact text status**: print "Validated for this taught word set" only when
  the deterministic result passed. Otherwise do not render under this recipe.
- **No picture guessing**: one small illustration may set mood, but it cannot
  stand beside a hard word as a rebus or answer cue.
- **Reread marks are optional**: include two small date circles or check boxes,
  never a speed timer or words-per-minute target.
- **Comprehension stays conversational**: one optional "Tell me what changed"
  prompt may follow the story. It is not scored and does not gate advancement.
- **No generated placement**: story completion never moves a child forward in
  the map. Durable evidence comes only from a parent's concrete later report.

## Worked HTML

```html
<style>
  .story-head { display: flex; justify-content: space-between;
    align-items: end; margin-bottom: 20px; }
  .story-title { font: 750 28px 'Plus Jakarta Sans', sans-serif; }
  .rereads { font: 600 12px 'Plus Jakarta Sans', sans-serif; color: #6b6259; }
  .story-text { font: 500 26px/1.65 Andika, sans-serif; color: #221e1a;
    max-width: 6.7in; }
  .story-text p { margin: 0 0 15px; }
  .talk { margin-top: 24px; border-top: 1.5px solid #b3a492;
    padding-top: 12px; font: 600 15px 'Plus Jakarta Sans', sans-serif; }
</style>
<div class="story-head">
  <div class="story-title">{{original_story_title}}</div>
  <div class="rereads">Read again: ○ &nbsp; ○</div>
</div>
<div class="story-text">
  <p>{{validated_sentence_1}} {{validated_sentence_2}}</p>
  <p>{{validated_sentence_3}} {{validated_sentence_4}}</p>
</div>
<div class="talk">Tell me what changed from the beginning to the end.</div>
```

## Final quality gate

- Every printed token and grapheme span passed the deterministic validator.
- The practiced patterns were already taught and heart words are explicit.
- The story is original, coherent, short, and readable without art.
- No grade, timed-fluency target, score, mastery claim, or placement rule
  appears on the child page.
- No source story, sentence set, character, title, word list, layout, or art
  was copied or closely paraphrased.
