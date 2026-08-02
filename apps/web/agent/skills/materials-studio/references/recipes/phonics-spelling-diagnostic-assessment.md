# Phonics and spelling diagnostic assessment

A parent-use packet for checking already-taught phonics or spelling skills at
home. Its default mode checks one skill with two equivalent forms. With a
code-issued progression policy, the same exact-answer surface may also render
a one-form mastery observation or a bounded instructional-starting-point
screen across named skills. It is not a standardized, clinical, or grade-placement instrument.

Great for: locating a working edge before choosing practice, checking a
recently taught sound-spelling, comparing the same skill on two dates without
repeating items, and rendering a trusted progression's exact observation
pages without letting prose invent the result.

Always html through the packet path. Exact words, stable geometry, answer
keys, page roles, and cheap item-level revision matter more than art.

## Use only when

- The parent asks to check a specific phonics or spelling skill, observe a
  taught skill before moving on, or make a repeatable home skill check.
- There is evidence for the target skill from this conversation, the
  child's map snapshot, or a saved observation. If there is no evidence,
  ask one short calibration question before building.
- The skill has already been taught. A check never introduces a new rule.
- A multi-skill screen has a versioned policy id, ordered trusted skill ids,
  exact item records, stop conditions, and result routing supplied by
  deterministic code. If any one is absent, use the single-skill check and
  report observations only.

For open-ended "where is she in reading?" requests, start a verified child
progress check-in instead of pretending one printable can assign a reading
level. A code-issued screen may find a starting skill inside its own named
progression only. For ordinary practice, use the matching phonics recipe. Do
not turn every worksheet into a test.

## Model judgment and exact work

The model chooses the exact skill and the age-appropriate presentation for a
single-skill check. Use a real skill id from the current child map or taxonomy
catalog, never a made-up label. Age shapes type size and item count; evidence
sets the skill. For a progression screen, deterministic code supplies the
ordered skill ids and policy. The model may not reorder, merge, skip, or add a
skill because another sequence looks plausible.

Deterministic rules own validation and scoring:

1. Every item has one closed expected answer or an explicit closed set of
   accepted variants written before the child sees the form.
2. If the response cannot be checked by literal equality or membership in
   that closed set, remove the item. Never ask the model to decide later
   whether an answer was "close enough."
3. When an item targets a printed grapheme or affix, the named target span
   must appear literally in the expected answer. A failed item is dropped,
   never relabeled as a different skill.
4. Normalize only case and surrounding whitespace for written answers.
   Never use fuzzy matching, token overlap, or a model verdict.
5. Count three observable outcomes separately: independent, self-corrected,
   and not yet. The independent count never absorbs self-corrections.
6. Mastery and starting-point results come only from the supplied policy id
   and its code-owned routing table. Never write a threshold, weighted score,
   stopping branch, or placement rule in generated prose.

This is a paper workflow. Homa does not currently machine-score speech or
handwriting, and must not claim that it did. The parent applies the closed
answer key. If the parent later reports a concrete result in her own words,
`manage_child_progress` may record that current-message evidence; its
deterministic validator owns child identity, catalog ids, provenance, and
durable scoring.

## Build the blueprint before the pages

For the default skill-check mode, choose one skill per packet. Write a private
blueprint with:

- `targetSkillId`: a trusted current catalog id.
- `responseMode`: letter name, oral real-word reading, or spelling from
  dictation.
- `itemCount`: 5 to 6 for ages 4 to 5, 6 to 8 for ages 6 to 8, and 6 to 10
  for ages 9 and up.
- `difficultySlots`: the same ordered slots for both forms, such as two
  simple, three typical, and one transfer item.
- `acceptedAnswers`: the closed answer set for every item.
- `stopRule`: stop immediately when the child asks, looks distressed, or
  gives two consecutive no-response or not-yet answers.

Forms A and B are equivalent only when targetSkillId, responseMode,
itemCount, difficultySlots, directions, and scoring rules are identical.
Their item prompts and answers must not overlap. Reordering one word list is
not a second form.

For a mastery observation or instructional-starting-point screen, the private
blueprint also carries:

- `mode`: `mastery-observation` or `instructional-starting-point`.
- `policyId` and `policyVersion`: issued by deterministic code.
- `orderedSkillIds`: a closed ordered list of trusted catalog ids.
- `sections`: code-validated item records grouped under those ids.
- `stopBranches`: code-owned branch ids attached to observable outcomes.
- `resultRoutes`: code-owned next-skill ids or observation-only outcomes.

The printable may explain how to mark observable responses, but it never
authors or interprets these fields. If a policy is missing or fails
validation, remove the mastery or starting-point claim and render a
single-skill observation packet instead.

## Original item rules

- Draft every item from the Homa skill blueprint. The ingested source
  contributed the workflow shape only. Never copy a source word list,
  sentence, script, threshold, form label system, or page geometry.
- Use familiar real words whose meaning does not become a second test. A
  spelling prompt gets one short original sentence that makes the intended
  word unambiguous without showing its spelling.
- Keep one sound-spelling pattern per packet. Do not mix short vowels,
  digraphs, silent-e words, and vowel teams to make the page look broad.
- Do not generate made-up decoding words until a deterministic phonotactic
  and real-word validator exists. A plausible-looking invented word can be
  ambiguous, accidentally real, or test a different pronunciation.
- Isolated letter-sound items are allowed only when accepted pronunciations
  are closed and unambiguous for the family's language variety. Otherwise
  use the sound inside a real-word task.
- No picture cue on a decoding or spelling item. Decoration must never give
  away the word.

## Design patterns (all binding for phonics-spelling-diagnostic-assessment)

- **Skill-check packet**: Form A, Form B, parent guide, answer and recording
  page. Pass `pageRoles: ["child", "child", "parent_guide", "answer_key"]`.
- **Mastery or starting-point packet**: one or more child section pages, then
  a parent guide and answer and recording page. Every child page gets the
  `child` role; the last two roles are `parent_guide` and `answer_key`. Section
  order must match the code-issued policy exactly.
- **One form per sitting**: print both, but tell the parent to save Form B
  for another day in skill-check mode. A policy-driven screen follows its
  code-owned stop branch and never adds Form B in the same sitting.
- **Child pages stay warm**: use "Quick skill check" or the skill name in
  the visible title. Never print diagnosis, screening, assessment,
  percentile, grade placement, a score box, or a red-pen verdict.
- **Large isolated items**: one numbered item per row, at least 22px type
  for early readers, with no decorative art and no answer visible.
- **Matched geometry**: Forms A and B use the exact same CSS, row count,
  spacing, and direction line. Only the original items change.
- **Parent guide**: name the target skill, say exactly what to read aloud,
  include the stop rule, and explain that the page is a home snapshot.
- **Recording page**: one row per item and three closed marks: Independent,
  Self-corrected, Not yet. Put exact accepted answers in a separate column.
- **No generated aggregate verdict**: show the three counts and item pattern.
  A validated policy result may name one instructional starting skill. Never
  convert observations to a percentile, reading age, grade, diagnosis, or
  sibling comparison.
- **Ink-light**: black text, white background, rules rather than filled
  boxes. Parent-only pages may be denser than child pages but stay readable.

## Administration, stopping, and interpretation

The parent says one plain direction, gives no answer hints, and marks the
first response. A self-correction gets its own mark. Do not repeat a missed
item until after the form, because an immediate retry changes the check into
practice.

Stop on the blueprint rule. Stopping protects the child; it is not a result.
Do not continue into harder skills after the stop condition. Offer a shorter
practice page for the same or preceding taught skill on another day.

Interpret only what the closed record or code-issued policy result supports:

- Lead with exact counts: "6 independent, 1 self-corrected, 1 not yet."
- Name the item pattern, not a child verdict: "Both not-yet words used the
  same vowel team."
- Recommend one small next move: regular work, brief focused practice, or a
  fresh equivalent form later.
- Compare Form A with Form B only when both used the same blueprint. Never
  compare children.
- In mastery or starting-point mode, repeat the exact returned route and its
  policy id. If no route is returned, report counts only. Never improvise the
  nearest lesson.

## Tool sequence

1. Read `subjects/letters.md` for letter work or `subjects/cvc-phonics.md`
   for early word work. Use the child's trusted map evidence to choose one
   exact taught skill.
2. Build and validate the two-form blueprint, or accept the code-issued
   mastery or starting-point blueprint. Keep accepted answers and routing off
   every child page.
3. Call `create_printable` once with `pages` in packet order and exact matching
   `pageRoles`. Metadata names the skill and child, not a grade level.
4. Review every preview. Forms A and B must have matching geometry and no
   overlap; the answer page must match every item exactly.
5. Revise any failed item or page through `revisesId`. Finalize only after
   the parent approves.
6. If the parent reports results later, repeat her exact counts and use
   durable progress tools only for concrete evidence in her current trusted
   message. Never invent a result from an unmarked form or an unreadable
   photo.

## Worked child-page geometry

Use this same geometry for both forms. Replace the sample words with a newly
validated, non-overlapping set for the chosen skill.

```html
<style>
  .check-head { display: flex; justify-content: space-between;
    align-items: baseline; margin-bottom: 18px;
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .check-title { font-size: 27px; font-weight: 750; }
  .check-meta { font-size: 14px; }
  .direction { font: 600 17px 'Plus Jakarta Sans', sans-serif;
    margin-bottom: 18px; }
  .items { display: grid; gap: 13px; }
  .item { display: grid; grid-template-columns: 38px 1fr;
    align-items: center; min-height: 74px; border-bottom: 1.5px solid #b3a492;
    font-family: Andika, sans-serif; }
  .number { font: 700 17px 'Plus Jakarta Sans', sans-serif; }
  .word { font-size: 30px; letter-spacing: 0.02em; }
</style>
<div class="check-head">
  <div class="check-title">Short-a skill check</div>
  <div class="check-meta">Name: Maya &nbsp; Date: ______ &nbsp; Form A</div>
</div>
<div class="direction">Read each word once. It is fine to stop whenever you want.</div>
<div class="items">
  <div class="item"><span class="number">1.</span><span class="word">cab</span></div>
  <div class="item"><span class="number">2.</span><span class="word">yam</span></div>
  <div class="item"><span class="number">3.</span><span class="word">wax</span></div>
  <div class="item"><span class="number">4.</span><span class="word">yak</span></div>
  <div class="item"><span class="number">5.</span><span class="word">tax</span></div>
  <div class="item"><span class="number">6.</span><span class="word">zap</span></div>
</div>
```

## Final quality gate

- Single-skill mode has one trusted skill id and one taught skill, not a mixed
  survey.
- A multi-skill screen has a valid policy id, fixed ordered skills, exact
  stop branches, and code-owned routes. Otherwise it is not a screen.
- Every item has a closed answer set and passes the literal target-span rule.
- No prompt or answer repeats across Forms A and B.
- The two forms share one blueprint and identical geometry.
- The child pages reveal no answers and carry no grade or clinical language.
- The parent guide states the stop rule and one-form-per-sitting rule.
- The answer page matches every item and keeps three outcome counts separate.
- All four page roles are present and every rendered page passes review.
- No source-specific words, sentences, scripts, thresholds, or layout were
  copied.
