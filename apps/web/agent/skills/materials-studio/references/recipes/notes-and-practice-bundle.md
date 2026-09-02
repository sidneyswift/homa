# Notes-and-practice bundle

Golden anchor: pass `anchorIds: ["notes-and-practice-bundle"]` to
generate_image so the output matches the Homa notes-and-practice packet
bar (two matching pages with Name and Date header lines, page 1 a
four-section two-column notes grid with a narrow bold term column and
fill-in blanks plus two ruled notes lines per section, page 2 eight
bold-numbered problems each with a short answer underline and a rounded
work box, warm brown rules on cream paper, a pencil and a star only in
the corners). Write your own prompt with your own content; the anchor
sets the visual bar, not the specifics.

A two-page format: page 1 is guided notes (Cornell-style two-column
layout with terms and fill-in-the-blank explanations), page 2 is a
practice activity (drill problems, fill-in-the-blank, or matching).
Teach then practice in one printable. This is the format when the
parent asks for notes-and-practice, guided notes with an activity,
or teach-then-drill pages.

Works for: any subject where concept introduction precedes drill.
Math operations, grammar rules, science vocabulary, history facts.
Especially strong for grades 3-8 where students are learning to
take notes and need structure.

Uses the packet recipe (two pages, one PDF) via create_printable's
`pages` input. Each page is an html entry.

Design patterns (all binding for notes-and-practice bundles):

- **Page 1: guided notes**:
  - Two-column layout: narrow term column (~120px) on the left,
    wide explanation column on the right.
  - Section dividers: thin horizontal rules between concept groups.
  - Fill-in-the-blank: key terms or values left as blank lines
    within the explanation text.
  - Student notes area: 2-3 blank lines at the bottom of each
    section for the student's own observations.
  - Header: topic title, name field, date field.

- **Page 2: practice activity**:
  - Numbered problems or matching columns.
  - Problems progress from straightforward application to
    multi-step or tricky edge cases.
  - Answer blanks: `border-bottom: 2px solid var(--homa-control-boundary); width: 80px;`
  - For matching: two columns with items to connect.
  - Include 8-12 problems for grades 3-5, 12-16 for grades 6-8.

- **Visual continuity**: both pages share the same header style,
  font family, and spacing conventions so they read as one unit.

```html
<!-- PAGE 1: Guided Notes -->
<style>
  .notes-header { display: flex; flex-wrap: wrap; gap: 8px 24px;
    margin-bottom: 16px; font-size: 13px;
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .notes-header .field { flex: 1 1 40%; }
  .notes-header .field-line { border-bottom: 1.5px solid var(--homa-control-boundary);
    min-width: 120px; display: inline-block; margin-left: 4px; }
  .notes-title { font-family: 'Fredoka', sans-serif; font-size: 22px;
    font-weight: 700; margin-bottom: 16px; text-align: center; }
  .notes-section { border-top: 1.5px solid #d9d2c7; margin-top: 14px;
    padding-top: 10px; }
  .notes-two-col { display: grid; grid-template-columns: 120px 1fr;
    gap: 4px 14px; margin-bottom: 8px; }
  .notes-term { font-size: 13px; font-weight: 700; color: var(--homa-ink);
    padding-top: 4px; font-family: 'Plus Jakarta Sans', sans-serif; }
  .notes-explanation { font-size: 13px; color: var(--homa-control-boundary);
    line-height: 1.8; font-family: 'Plus Jakarta Sans', sans-serif; }
  .notes-blank { border-bottom: 2px solid var(--homa-control-boundary); width: 80px;
    display: inline-block; margin: 0 4px; }
  .notes-student-lines { margin-top: 6px; }
  .notes-student-lines div { border-bottom: 1.5px solid #d9d2c7;
    min-height: 22px; margin-bottom: 4px; }
</style>

<div class="notes-header">
  <div class="field">Name: <span class="field-line"></span></div>
  <div class="field">Date: <span class="field-line"></span></div>
</div>
<div class="notes-title">Two-Step Equations</div>

<div class="notes-section">
  <div class="notes-two-col">
    <div class="notes-term">Two-step equation</div>
    <div class="notes-explanation">
      An equation that takes <span class="notes-blank"></span> steps to solve.
      First, use <span class="notes-blank"></span> operations (add/subtract),
      then use <span class="notes-blank"></span> operations (multiply/divide).
    </div>
  </div>
  <div class="notes-student-lines">
    <div></div><div></div>
  </div>
</div>
<!-- Repeat sections for each concept -->
```

```html
<!-- PAGE 2: Practice -->
<style>
  .practice-title { font-family: 'Fredoka', sans-serif; font-size: 20px;
    font-weight: 700; margin-bottom: 16px; text-align: center; }
  .practice-problem { font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; margin-bottom: 14px; display: flex;
    align-items: baseline; gap: 8px; }
  .practice-num { font-weight: 700; min-width: 24px; }
  .practice-blank { border-bottom: 2px solid var(--homa-control-boundary); width: 80px;
    display: inline-block; margin: 0 4px; }
  .practice-work-area { border: 1.5px solid #d9d2c7; border-radius: 4px;
    min-height: 48px; margin-left: 32px; margin-bottom: 8px; }
</style>

<div class="practice-title">Practice: Two-Step Equations</div>

<div class="practice-problem">
  <span class="practice-num">1.</span>
  <span>3x + 5 = 20 &rarr; x = <span class="practice-blank"></span></span>
</div>
<div class="practice-work-area"></div>

<div class="practice-problem">
  <span class="practice-num">2.</span>
  <span>2x - 7 = 11 &rarr; x = <span class="practice-blank"></span></span>
</div>
<div class="practice-work-area"></div>
<!-- Repeat for remaining problems -->
```

Path choice: html for both pages, always. Text precision, table
alignment, and cheap surgical revision matter on both the notes and
the practice page. Use the packet recipe to combine both pages into
one PDF via create_printable's `pages` input.
