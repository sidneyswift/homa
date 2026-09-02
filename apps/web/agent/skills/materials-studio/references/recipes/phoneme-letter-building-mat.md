# Phoneme-letter building mat

Golden anchor: pass `anchorIds: ["phoneme-letter-building-mat"]` to
generate_image so the output matches the Homa phoneme-letter building
mat bar (child mat, page 1 of the phoneme-letter building packet) for
segmenting and blending a taught word pattern). Write your own prompt
with your own content; the anchor sets the visual bar, not the
specifics.

A reusable sound-position mat plus cut-apart grapheme tiles. The child says
the sounds in order, places one tile or tile group in each sound position,
then blends the completed word.

Great for: segmenting and blending a taught word pattern, comparing phoneme
count with letter count, building words before writing them, and short
hands-on phonics practice.

Always html through the packet path. The sound boxes, tile dimensions, answer
maps, and page roles must stay exact.

## Required blueprint

Use one taught skill and a supplied, validated set of target records:

- `targetSkillId`: a trusted current catalog id.
- `wordId`: stable within the packet.
- `spokenWord`: the parent prompt.
- `phonemes`: the ordered sound ids.
- `graphemes`: the ordered printed tiles that realize those sounds.
- `tileCounts`: the exact multiset required across the practice set.

The model chooses an age-appropriate theme and presentation. Deterministic
validation owns the ordered sound and grapheme records, verifies that each
sound position has an answer, and verifies the tile multiset. Never infer a
segmentation from spelling while writing HTML. Drop a word whose validated
mapping is absent or ambiguous.

## Copyright-safe content

- Generate a fresh practice set from the trusted skill blueprint. Never copy
  a source word sequence, lesson grouping, prompt script, box layout, or tile
  sheet.
- Do not reuse a publisher's color code for sound types. Homa's neutral box
  styling is enough.
- Use no picture cue on a decoding target. Optional decoration stays outside
  the sound boxes and never reveals the word.

## Design patterns (all binding for phoneme-letter-building-mat)

- **Three-page packet**: child mat, grapheme tiles, parent guide and key. Pass
  `pageRoles: ["child", "child", "parent_guide"]`.
- **One sound position per box**: the number of boxes comes from the validated
  phoneme array, not the number of printed letters. A multi-letter grapheme
  stays on one tile when it represents one sound.
- **Two mat bands at most**: give one large three-position band and one large
  four-position band, or repeat the one size the target set needs. Do not mix
  five unrelated word shapes on one page.
- **Move, say, blend**: print the same three-step cue once: say each sound,
  move the tiles, sweep and blend. No long teaching script.
- **Reusable surface**: wide boxes, rounded corners, and a parent note to use
  a sheet protector or laminate if available. Lamination is optional.
- **Complete tile multiset**: include every needed grapheme in the exact count
  required for one target at a time, plus no decoy unless the blueprint names
  a closed-choice activity.
- **Parent key stays separate**: list each spoken prompt and its ordered tile
  answer on the guide, never on the child mat or tile fronts.
- **No mastery verdict**: this is guided practice. Record observations only
  when the parent later reports concrete evidence through the progress tool.

## Worked HTML

```html
<style>
  .mat-title { font: 750 28px 'Plus Jakarta Sans', sans-serif;
    margin-bottom: 14px; }
  .cue { font: 600 16px 'Plus Jakarta Sans', sans-serif;
    margin-bottom: 24px; }
  .sound-row { display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 14px; margin: 22px 0 36px; }
  .sound-box { height: 150px; border: 3px solid var(--homa-ink);
    border-radius: 14px; background: #fff; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .tile { min-height: 90px; border: 2px dashed #8c8175;
    display: grid; place-items: center; font: 700 40px Andika, sans-serif; }
</style>
<div class="mat-title">Build it by sound</div>
<div class="cue">Say each sound · move the tiles · sweep and blend</div>
<div class="sound-row">
  <div class="sound-box"></div><div class="sound-box"></div>
  <div class="sound-box"></div>
</div>
<div class="tiles">
  <div class="tile">{{tile_1}}</div><div class="tile">{{tile_2}}</div>
  <div class="tile">{{tile_3}}</div><div class="tile">{{tile_4}}</div>
</div>
```

## Final quality gate

- One trusted taught skill drives the packet.
- Every target has validated ordered phonemes and graphemes.
- Box count follows phoneme count; tile text follows validated graphemes.
- The tile multiset can build every target exactly as intended.
- Child pages reveal no answer and contain no source-specific word list,
  script, color system, or geometry.
