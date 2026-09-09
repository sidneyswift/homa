# Full lesson packet

A complete one-skill lesson in one PDF: teach it, practice it, check it,
and hand the parent a closed answer key, in that order. This is the
format when the parent asks for a full lesson, a whole lesson on one
skill, "teach this and give her practice and a test", or a lesson she
can run start to finish without you.

Works for: any subject where a concept is taught, then drilled, then
checked. Math operations, phonics and spelling, grammar rules, science
vocabulary, geography facts. Not for a themed multi-topic bundle (that
is unit-study-packet) and not for a bare worksheet with no teaching or
check attached (that is a single materials-studio format).

Uses the packet path via create_printable's `pages` input: every page is
`html`, in print order, with a matching `pageRoles` entry.

## Use only when

- The parent asked for a full lesson or a complete lesson on one skill,
  not a single worksheet, not a themed unit, not a multi-week program.
- There is evidence for the target skill: what the parent said, the
  child's map snapshot, or a saved observation. No evidence means one
  short calibrating question before building, never a quiz.
- The lesson targets exactly one skill. A lesson that tries to teach two
  unrelated skills to look more complete is two lessons, not one packet.

For a single page with no teaching or check attached, use materials-studio's
own format library instead. For a themed bundle of activities across many
topics, use unit-study-packet. For a multi-week program, that is
curriculum-studio's job, not this recipe's.

## Page sequence (binding)

A full lesson packet is 4 to 6 pages, in this exact order:

1. **Teach** (`child`): one guided-notes page introducing or reviewing the
   skill, with one or two worked examples. Cornell-style two-column layout:
   a narrow term or step column, a wider explanation column, fill-in
   blanks for key terms or values, 2-3 blank lines per section for the
   child's own notes.
2. **Practice** (`child`, one or two pages): numbered practice items that
   rehearse the exact same skill just taught, easiest first. Every
   practice item is a complete, concrete item: exact numbers, words, or
   objects, never a placeholder the parent must invent. Respect any
   numeric bound the skill names (a target capped at 10 never asks for a
   combined total above 10).
3. **Check** (`child`): a short skill check, 5 to 8 items for ages 4 to 8
   and 6 to 10 for ages 9 and up, of the same skill just practiced. Every
   item has one closed expected answer or a closed set of accepted
   variants, written before the child sees the page. The child-facing
   title says "Quick check" or the skill name, never diagnosis,
   assessment, screening, percentile, grade placement, or a score box.
   No picture cue that gives away a decoding or spelling answer.
4. **Answer key** (`answer_key`): the closed answers for both the practice
   page and the check, in the same order, on its own page, never on a
   child-facing page.
5. **Parent guide** (`parent_guide`, optional, include for a first-time
   skill or an approach-following family): names the target skill in one
   line, says what to read aloud or how to introduce it, states the stop
   rule, and explains that "not yet" on the check is where to aim
   tomorrow's practice, never a verdict on the child.

`pageRoles` must have exactly one entry per rendered page, in this same
order: `["child", "child", ..., "child", "answer_key"]`, with
`"parent_guide"` appended last only when that page is included. Never
give the child page and the answer key the same role, and never omit
`pageRoles` when an answer key is present.

## Deterministic rules for the check page

Same discipline as any closed-answer check in this codebase:

1. Every check item has one closed expected answer or an explicit closed
   set of accepted variants, decided before the child sees the page.
2. If a response cannot be checked by literal equality or membership in
   that closed set, remove the item rather than asking a model to judge
   "close enough" later.
3. Homa does not machine-score speech, handwriting, or a photographed
   page. The parent applies the closed answer key by hand.
4. No score, percentile, grade level, reading age, or sibling comparison
   anywhere on any page. The answer key states exact answers, not a
   verdict.
5. Stop the check immediately if the child asks to stop or looks
   distressed; two consecutive no-response or not-yet answers is also a
   stop. A stopped check is not a result.

## Design patterns (all binding for full-lesson-packet)

- **Visual continuity**: every page shares the same header style (Name
  and Date fields), font family, and spacing so the packet reads as one
  unit, not four unrelated pages stapled together.
- **Teach page**: 2 to 4 concept sections, each with one worked example
  the child can follow before attempting the practice page.
- **Practice items**: numbered, one skill per item, an answer blank or
  work box per item, `border-bottom: 2px solid var(--homa-control-boundary); width: 80px;`
  for a short-answer blank.
- **Check items**: one numbered item per row, large type for early
  readers (at least 22px), no decorative art, no visible answer.
- **Answer key**: two labeled sections, "Practice answers" and "Check
  answers", each numbered to match its source page exactly.
- **Parent guide, when included**: plain text, no decoration, states the
  skill, the read-aloud line, the stop rule, and the "not yet" framing
  in four short lines, nothing longer.
- **Ink-light**: black text, white or cream background, rules rather than
  filled boxes on every child-facing page.

## Worked page geometry

```html
<!-- PAGE 1: Teach -->
<style>
  .lesson-header { display: flex; flex-wrap: wrap; gap: 8px 24px;
    margin-bottom: 16px; font-size: 13px;
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .lesson-header .field-line { border-bottom: 1.5px solid var(--homa-control-boundary);
    min-width: 120px; display: inline-block; margin-left: 4px; }
  .lesson-title { font-family: 'Fredoka', sans-serif; font-size: 22px;
    font-weight: 700; margin-bottom: 16px; text-align: center; }
  .lesson-section { border-top: 1.5px solid #d9d2c7; margin-top: 14px;
    padding-top: 10px; }
  .lesson-two-col { display: grid; grid-template-columns: 120px 1fr;
    gap: 4px 14px; margin-bottom: 8px; }
  .lesson-term { font-size: 13px; font-weight: 700; color: var(--homa-ink);
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .lesson-explanation { font-size: 13px; line-height: 1.8;
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .lesson-notes-lines div { border-bottom: 1.5px solid #d9d2c7;
    min-height: 22px; margin-bottom: 4px; }
</style>
<div class="lesson-header">
  <div>Name: <span class="field-line"></span></div>
  <div>Date: <span class="field-line"></span></div>
</div>
<div class="lesson-title">Adding Two-Digit Numbers</div>
<div class="lesson-section">
  <div class="lesson-two-col">
    <div class="lesson-term">Line up the ones</div>
    <div class="lesson-explanation">Stack both numbers so the ones digits
      sit in the same column. 24 + 13: the 4 and the 3 line up.</div>
  </div>
  <div class="lesson-notes-lines"><div></div><div></div></div>
</div>
```

```html
<!-- PAGE 3: Check -->
<style>
  .check-head { display: flex; justify-content: space-between;
    align-items: baseline; margin-bottom: 18px;
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .check-title { font-size: 22px; font-weight: 750; }
  .check-items { display: grid; gap: 13px; }
  .check-item { display: grid; grid-template-columns: 32px 1fr;
    align-items: center; min-height: 60px;
    border-bottom: 1.5px solid var(--homa-control-boundary);
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; }
</style>
<div class="check-head">
  <div class="check-title">Quick check: two-digit addition</div>
  <div>Name: ______ &nbsp; Date: ______</div>
</div>
<div class="check-items">
  <div class="check-item"><span>1.</span><span>34 + 22 = ____</span></div>
  <div class="check-item"><span>2.</span><span>41 + 16 = ____</span></div>
</div>
```

```html
<!-- PAGE 4: Answer key -->
<style>
  .key-title { font-family: 'Fredoka', sans-serif; font-size: 20px;
    font-weight: 700; margin-bottom: 12px; }
  .key-section { margin-bottom: 18px; }
  .key-section h3 { font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; }
  .key-list { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px;
    line-height: 1.9; }
</style>
<div class="key-title">Answer key</div>
<div class="key-section">
  <h3>Practice answers</h3>
  <div class="key-list">1. 47 &nbsp; 2. 63 &nbsp; 3. 58</div>
</div>
<div class="key-section">
  <h3>Check answers</h3>
  <div class="key-list">1. 56 &nbsp; 2. 57</div>
</div>
```

Path choice: html for every page, always. Exact numbers, matched
geometry across the practice and check pages, and cheap per-page
revision through `revisesId` matter more than art on any page in this
packet.

## Tool sequence

1. Read the subject file that matches the lesson (and the approach file,
   when the family follows a named one) from materials-studio's own
   `references/subjects/` and `references/approaches/`, the same way any
   materials-studio page does.
2. Decide the target skill from the child's evidence, the page count (4
   without a parent guide, 5 with one), and draft the practice and check
   items before writing any HTML.
3. Call `create_printable` once with `pages` in the order above,
   `recipe: "full-lesson-packet"`, and matching `pageRoles`. Metadata
   names the one target skill, not a unit theme or grade level.
4. Read the returned review. Practice and check items must show no
   overlap; the answer key must match every item exactly.
5. Revise any failed page through `revisesId`, keeping the target and the
   passing pages unchanged. Finalize only after the parent approves.

## Final quality gate

- Exactly one target skill drives every page; no page teaches or checks
  a second, unrelated skill.
- Every practice and check item is complete and concrete: no invented
  placeholder, no missing example, every numeric bound respected.
- The check page carries no diagnosis, assessment, screening,
  percentile, grade placement, or score box anywhere a child can see it.
- The answer key matches every practice and check item exactly, in order,
  on its own page.
- `pageRoles` has one entry per rendered page, ending in `answer_key`
  (then `parent_guide` when included), never shared with a child page.
- No source-specific words, sentences, scripts, or page geometry were
  copied from an ingested curriculum; the workflow shape is Homa's own.
