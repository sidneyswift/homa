# Structured outline / essay scaffold

Golden anchor: every generate_image call for a structured outline
carries `anchorIds: ["five-paragraph-essay-outline"]`. The anchor leads
the reference set and holds the Homa outline bar (two-column
instruction and work layout, numbered section headers, labeled sub-fields
with blank writing lines, warm and grown-up). Write your own prompt with
your own content; the anchor sets the visual bar, not the specifics.

A structured outline breaks a complex task, such as writing an essay, planning
a research project, or outlining a book report, into a fill-in-the-blank
framework with labeled sections. The structure teaches the process:
the child learns what goes where by filling it in. This is the format
when the parent asks for essay outlines, writing scaffolds, planning
sheets, or process organizers.

Always html path. Text precision, table alignment, and cheap surgical
revision are the whole point. No organic art, no images. Structure IS
the design.

Design patterns (all binding for outlines):

- **Two-column layout**: left column = instruction (what goes here,
  in italic or muted color), right column = blank lines for student
  work. The left column teaches; the right column practices.
- **Section headers**: bold, with Roman numerals or numbered steps.
  A thin top border separates sections. Header carries the section
  name ("I. Introduction", "II. Body Paragraph 1").
- **Sub-fields**: each section breaks into labeled sub-parts
  ("a. topic sentence", "b. supporting evidence", "c. explanation").
  Sub-labels in the left column; blank lines in the right.
- **Blank lines**: `border-bottom: 1.5px solid #6b6259; min-height:
  24px;`. Use generous spacing so the child can write comfortably.
  3-4 lines per sub-field for younger writers, 2 lines for older.
- **Difficulty variants**: same layout, different field counts. A
  simpler version has 2 evidence slots per body paragraph; a harder
  version has 3. Generate the version that matches the child's level
  (from the difficulty-from-evidence rules in the router), and offer the
  other if the parent wants it.
- **Process metadata header**: name, date, topic/title, and optionally
  draft-due and final-due date fields. Reinforces writing-as-process.
- **No decoration**: stark, clean B&W. No doodles, no clipart, no
  color accents. The absence of visual noise signals "this is serious
  work" and keeps the focus on the writing.
- **Print-friendly**: portrait, single page when possible. A five-
  paragraph essay outline fits one page for grades 7+; for younger
  kids with more writing space, allow two pages.

```html
<style>
  .outline-header { display: flex; flex-wrap: wrap; gap: 8px 24px;
    margin-bottom: 20px; font-size: 13px;
    font-family: 'Plus Jakarta Sans', sans-serif; }
  .outline-header .field { flex: 1 1 40%; }
  .outline-header .field-line { border-bottom: 1.5px solid #6b6259;
    min-width: 120px; display: inline-block; margin-left: 4px; }
  .section { border-top: 2px solid #221e1a; margin-top: 16px;
    padding-top: 10px; }
  .section-title { font-weight: 700; font-size: 15px;
    margin-bottom: 8px; font-family: 'Plus Jakarta Sans', sans-serif; }
  .two-col { display: grid; grid-template-columns: 170px 1fr;
    gap: 4px 12px; margin-bottom: 6px; }
  .two-col .label { font-size: 12px; color: #6b6259;
    font-style: italic; padding-top: 4px; }
  .two-col .blank { border-bottom: 1.5px solid #6b6259;
    min-height: 24px; }
</style>

<div class="outline-header">
  <div class="field">Name: <span class="field-line"></span></div>
  <div class="field">Date: <span class="field-line"></span></div>
  <div class="field">Essay Topic: <span class="field-line"></span></div>
  <div class="field">Essay Title: <span class="field-line"></span></div>
</div>

<div class="section">
  <div class="section-title">I. Introduction</div>
  <div class="two-col">
    <div class="label">a. attention getter</div>
    <div class="blank"></div>
  </div>
  <div class="two-col">
    <div class="label">b. background information</div>
    <div class="blank"></div>
  </div>
  <div class="two-col">
    <div class="label">c. thesis statement</div>
    <div class="blank"></div>
  </div>
</div>

<div class="section">
  <div class="section-title">II. Body Paragraph 1</div>
  <div class="two-col">
    <div class="label">a. topic sentence</div>
    <div class="blank"></div>
  </div>
  <div class="two-col">
    <div class="label">b. example / evidence</div>
    <div class="blank"></div>
  </div>
  <div class="two-col">
    <div class="label">c. explanation</div>
    <div class="blank"></div>
  </div>
  <div class="two-col">
    <div class="label">d. transition</div>
    <div class="blank"></div>
  </div>
</div>
<!-- Repeat for Body Paragraphs 2-3, then V. Conclusion -->
```

Adapt the section names and sub-fields to the actual task. A book
report outline replaces "thesis" with "main idea" and adds a
"characters" section. A research outline adds "sources" fields. The
two-column instruction|work pattern stays constant; the labels change.
