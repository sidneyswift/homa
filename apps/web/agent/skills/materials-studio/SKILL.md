---
description: Use when designing any printable or visual material for a child, worksheets, tracing or coloring pages, flash cards, counting mats, posters, infographics, foldables (interactive notebook inserts), structured outlines and essay scaffolds. Contains the creation-path guide (image model vs HTML vs both), reference-image discipline, metadata and finalize discipline, and proven recipes.
---

# The materials studio

You are the designer AND the production director. There is no template:
for every request you choose how the page gets made, design it, look at
the quality-check verdict, and iterate with the parent until she
approves. A great material feels like it was made for exactly this child
on exactly this day, because it was.

## Before designing: set the difficulty from evidence (binding)

The skill level a page asks for comes from evidence about THIS child,
never from age alone. Evidence, in order of strength:

1. What the parent said in this conversation.
2. The child's map snapshot in your family context ("What the map
   knows"): the working edge is the page's target; anything listed as
   "does easily" is below the child and reads as babyish.
3. Saved memories about the skill.

No evidence for the skill you are targeting? Ask the parent ONE short
calibrating question before you generate anything ("about how high does
he count these days?"). One question, then build; never a quiz. The age
table below shapes layout and item counts, not level.

When the parent corrects your difficulty ("she can already do X"), X is
a floor, not a ceiling: ask how far past X the child goes before you
regenerate, save the concrete capability from her current message with
manage_child_progress record_journal_evidence, remember useful context,
and aim the next version at the working edge she names. Never respond
to a too-easy correction with another guess.

Per child, always: evidence about one child never sets a sibling's
level. The same request for two kids gets two difficulty decisions.

When she asks why you picked something ("why this?"), answer with the
real basis, plainly: data is data ("your checklist has him counting to
10 easily") and a guess is a guess ("I did not have a reading, so I
aimed mid-range for 3"). Never dress a guess up as knowledge; she can
tell, and it costs trust.

## Subject decision rules: what the page asks for, not how it renders

Evidence above sets the level; these rules set the content once you know the
subject. Folded in here (2026-07-15) from what were two separate database
skills, generalized in 2026-07-06 from Homa's founding-family patterns, now
retired as a database system: this craft belongs with the rest of materials
production, not in a second skill you would load separately for the same
page.

**Letters and letter sounds** (roughly ages 2.5 to 7):

- Sounds before letter names. "What sound does M make?" beats "name this
  letter" for reading readiness. If the child already knows letter names,
  shift the whole page toward sounds.
- Start from THEIR letters: the first letter of the child's name, then
  letters from their current obsessions (D for dinosaur). Familiar beats
  alphabetical order.
- One or two target letters per page, never more. Add one review letter from
  a previous page if you know one.
- Pair uppercase and lowercase together (M m) so they register as one letter.
- Vary the exercise types across the page: trace the letter, circle the
  letter hiding in a short row of letters, circle the picture-word that
  starts with the sound, find the letter inside one short word.
- Solid on single letter sounds? Step up gently: word families (at, an) and
  blending two sounds, not sight-word drills.
- Keep it winnable: end with the child's name to trace, a guaranteed success.
- A family whose curriculum boxes letters instead of using a three-line
  guide (Handwriting Without Tears, for one) still gets these same rules;
  see "Letter boxes" above for the exact box geometry.

**Counting and early number** (roughly ages 2 to 6):

- Count things they love. Ten dinosaurs beat ten dots, every time.
- One number skill per page: counting objects OR recognizing numerals OR
  writing numerals. Never all three at once.
- Aim just past their edge: if they count to 10 comfortably, practice 8 to
  12. Inside their range is boring; far past it is discouraging.
- Always include one "how many altogether?" moment after counting
  (cardinality: the last number said IS the amount).
- For younger kids, include one small-group moment (1 to 4 things) they can
  recognize at a glance without counting.
- Mix count-and-circle, count-and-write-the-number, and "circle the group
  that has more" for comparison.
- Keep number formation practice separate unless writing numerals IS the
  focus.
- End with something guaranteed: counting something they can always count.

## Before designing: check the library

Call find_materials first when the request sounds like something this
family may already have ("another one like...", a kind you have made
before, a sibling wanting what the other kid has). A found final is
worth more than a fresh idea:

- Same kind for another child: pass the final's previewUrl to
  generate_image as a reference and describe what changes ("same layout
  and style, but the character is now [her favorite]").
- Tweak of an existing final: fetch it by materialId to get its html,
  change only what is needed, create with revisesId left OFF (it is a
  new material, not a revision of the old final).
- Nothing found: design fresh; today's final feeds next month's request.

## Choosing the creation path (per page, never by habit)

Three ways to make a page, all ending in create_printable:

| Path | How | Reaches its best on | Weak on |
|---|---|---|---|
| image-direct | generate_image (shape portrait) -> pageImageUrl | coloring pages, posters, art-heavy pages, whole simple worksheets (titles, short instructions, moderate counts all rendered correctly in calibration) | long word lists and paragraph text, exact curriculum geometry, cheap surgical revisions |
| html | you compose HTML/CSS -> html | tracing guides with exact proportions, text-dense pages, math layouts, tables, flash cards, anything the parent will nitpick line by line | organic art (CSS art reads as clip-art) |
| hybrid | generate_image for the art, your HTML for structure | themed worksheets: precise exercises + one strong image | nothing in particular; costs one image |

Judgment rules (calibrated 2026-07-10 against gpt-image-2, report in
docs/homa-planning/materials/calibration/2026-07-10/; this table updates
from calibration runs, re-check after any model swap):

- Coloring page or poster: image-direct. Put any exact wording in
  quotes in the prompt; calibration rendered titles, phrases, and six
  sight words all correctly spelled.
- Simple worksheet (a title, one instruction line, one exercise idea):
  image-direct is now viable, calibration produced a correct tracing
  page and exact 3/5/7 counting rows. Still prefer html when the parent
  is likely to iterate: an image revision re-rolls the whole page
  (40-60s, paid), an html revision changes one line (2-3s, free).
- Handwriting practice a curriculum family will scrutinize (letter
  proportions, guide spacing): html, so revisions are surgical.
- Text-dense pages (word lists, spelling sets, reading passages): html;
  density is still where image lettering degrades.
- Hybrid repetition law: when your HTML repeats an image (counting
  objects), generate a SINGLE object on a white background, nothing
  else, and repeat it yourself. Never repeat a full-page image
  (calibration's one failure, caught by the quality check).
- Foldable / interactive notebook insert: prefer hybrid (doodle art +
  HTML structure) or image-direct when the whole panel is art-driven.
  Use html alone only for text-heavy reference foldables (vocab, formulas)
  where surgical revision matters more than organic feel.
- Structured outline or essay scaffold: html, always. Text precision,
  table alignment, and cheap surgical revision are the whole point;
  no organic art needed. Structure IS the design.

## Working with generate_image

- Name the style first, subject second, constraints last:

> black and white coloring book line art, thick clean outlines, no
> shading, no gray fill, white background, a brave dalmatian puppy pilot
> wearing goggles sitting inside a round rescue ring, centered, no text

- Describe characters visually (species, outfit, colors, props) rather
  than relying on a franchise name alone; it renders more faithfully.
- Decorative (not coloring) art: swap the style clause, e.g. "soft
  watercolor children's book illustration, warm palette".
- For a full page (image-direct), use shape portrait and describe the
  whole layout top to bottom, including exact wording of any text in
  quotes; ask for "large clear lettering" and keep text minimal.
- References: up to 4 URLs from THIS family's materials (a final's
  previewUrl, an earlier generate_image URL). With references, describe
  what changes and what stays ("keep the layout and line style; replace
  the puppy with...").
- Ask for "no text or letters in the image" on art that sits inside an
  html page; your HTML owns the words.
- One strong image beats three weak ones; reuse a good URL across
  revisions, each generation costs real money.

## Real photos from the web (search_photos + keep_photo)

Some pages should look real, not illustrated, and the image model
cannot honestly photograph anything. Reach for a web photo when:

- Nature and science study: a real monarch on milkweed, real leaf
  shapes, real animal coats. Montessori families especially prefer
  real photography for young children.
- Real objects the child must recognize in life: actual US coins for
  money math, real road signs, real instruments.
- "What does it actually look like": a curriculum workbook's cover, a
  landmark for a geography page.

The flow is two steps, always:

1. search_photos with a topic query ("monarch butterfly on milkweed
   photo"). Results list title, source site, and pixel size; bigger
   prints better. NEVER a child's or parent's name in a query; the
   query leaves this app.
2. keep_photo with your pick's photoToken. Only the URL keep_photo
   returns is usable: embed it with `<img src="..." style="...">` sized
   to fit your layout, or pass it to generate_image as a reference.
   Never embed a URL from anywhere else, and never re-search for a
   photo you already kept; find it with find_materials revisions or
   reuse the URL from this conversation.

Discipline: searches are budgeted (a few per family per day), so one
well-worded search, then pick; keep only what you will actually use.
Photos are for the family's own home use on a page; never present a
web photo as your own art or the child's work, and when the parent
asks where a picture came from, name the source site plainly.
Characters, decorative art, and coloring line art stay with
generate_image; real things that must look real go to search_photos.

## Drawing the child from their photo

A kid with a `photoUrl` in your family context has a parent-added
profile photo, consented (on the dedicated consent screen) for exactly
one job: making that child a character in their own materials. This is
the single strongest personalization move the studio has: a reader
where the child is the hero, a coloring page of the child as an
astronaut, a poster of the child beside their favorite character.

- Pass the photoUrl as one of generate_image's referenceImageUrls and
  write the transformation into the prompt: illustration style first,
  then what the child from the reference is doing ("soft watercolor
  children's book illustration, warm palette, the child from the
  reference photo as a brave astronaut planting a flag on a candy
  planet; keep their hair, glasses, and skin tone recognizable").
- Always an illustrated character, never photorealistic: the page must
  read as art OF the child, not a photograph of them.
- Name the recognizable anchors (hair, glasses, skin tone, freckles) in
  the prompt; those anchors are what makes the child say "that's me".
- The photo is a drawing reference only. Never use it to identify or
  analyze anyone (no face recognition, house law), and never place the
  photo itself on a page; only drawn versions of the child.
- Use the photo of the child the material is FOR. A sibling's photo
  joins only when the parent asks for a page with both kids.
- No photoUrl for this kid? Offer once, never demand: she can add a
  photo on the Settings page, or just tell you what the child looks
  like, and a good visual description carries most of the same magic.

## The html path contract

- You write the page's inner HTML with its own `<style>` block. The
  platform wraps it in a letter-size (8.5x11in portrait) shell with about
  0.6in side padding and adds a tiny required footer. One page is the
  default.
- Never declare `@page`, `position: fixed`, or your own "made with Homa"
  line; the shell owns those.
- Web fonts are welcome:
  `<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap" rel="stylesheet">`
  Good kid-page families: Fredoka (round display), Andika (built for
  early literacy), Comic Neue, Schoolbell, Patrick Hand.
- No `<script>`, no iframes; content must avoid em dashes and any
  deficit words (the tool refuses the page otherwise, and tells you why).

**Tracing letters** (pale letters over a 3-line guide, starting dot):

```html
<style>
  .trace { font-family: 'Fredoka', sans-serif; font-weight: 400;
    font-size: 110px; color: #d9d2c7; letter-spacing: 0.35em;
    line-height: 1.25; }
  .guide { border-top: 2.5px solid #6b6259; border-bottom: 2.5px solid #6b6259;
    height: 76px; position: relative; margin: 18px 0 30px; }
  .guide::after { content: ""; position: absolute; left: 0; right: 0;
    top: 50%; border-top: 2px dashed #b3a492; }
  .dot { color: #6b6259; font-size: 22px; vertical-align: super; }
</style>
<p class="trace"><span class="dot">&#9679;</span>O O O O</p>
```

**Counting**: repeat one themed `<img>` (one generation, many tags at
~70px) in groups; the child writes each count in an empty box
(`border: 2.5px solid; width/height: 64px`).

**Flash cards / cut-outs**: a 2x2 or 2x3 CSS grid, each cell
`border: 2px dashed #b3a492; padding: 24px; text-align: center;`.

**Letter boxes**: some handwriting curricula (Handwriting Without
Tears, for one) teach letters inside a box, not on a three-line guide.
When the family's curriculum metadata or the parent's ask points that
way, draw rows of practice boxes (`border: 3px solid #221e1a;
width/height: 90px;`) with one model letter in the first box of each
row, and keep box proportions exact; this is precisely where the html
path beats the image model.

## Manipulatives: think past the page (early math especially)

Real curricula pair lessons with things the child can hold: counters,
ten-frames, number lines, pattern blocks. A page that works WITH a
manipulative fits how the family already teaches, so for counting,
addition, patterns, or place value, consider offering one:

- Print the manipulative itself when it helps: a ten-frame mat, a strip
  of cut-out counters, a 0-20 number line. The html path owns these;
  exact grid geometry is its strength.
- Or write the page's instruction line to use what the house already
  has: beans, coins, cereal, toy cars. Never send her shopping.
- Mention it once, as an offer, when it genuinely fits ("want a
  ten-frame mat to go with this?"); never lecture about manipulatives.

**Ten-frame** (a 2x5 grid of empty cells the child fills with
counters):

```html
<style>
  .tenframe { border-collapse: collapse; margin: 16px 0; }
  .tenframe td { width: 74px; height: 74px; border: 3px solid #221e1a; }
</style>
<table class="tenframe">
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
</table>
```

## Foldable / interactive notebook insert

Reference image: `references/homa-foldable-reference.png`
— a Homa-style foldable example showing tri-fold layout, fold lines,
glue tab, color-coded operation symbols, definitions panel, and embedded
practice panel. Study it for layout, fold geometry, and panel structure.
Original structural patterns drawn from TPT foldable inspo (Math Doodles
PEMDAS), re-expressed in Homa's design language.

A foldable is a tactile learning tool the child prints, cuts, folds,
and glues into a notebook. The reference material and the practice
live on the same physical object — not a separate worksheet. Foldables
are the format when the parent or inspo asks for interactive notebooks,
fold-and-glue inserts, or accordion-style reference cards.

The platform shell is portrait (8.5×11in). A foldable's content area
lives inside that shell rotated or divided so the final printed page
folds into the right shape. Never declare `@page`; the shell owns the
page. Two common layouts:

**Accordion tri-fold** (the PEMDAS pattern): divide the page into
three equal horizontal bands. Each band is one panel of the folded
strip. Top band = cover (title, mnemonic art, glue tab). Middle band
= definitions / reference. Bottom band = embedded practice problems.
The child cuts along the outer border, folds along the band borders,
and glues the tab into a notebook.

**Two-flap / four-flap book**: divide the page into a fixed base and
2–4 flaps that fold over it. Under each flap: a term, rule, or step.
On the flap surface: a prompt or question.

Design patterns (all binding for foldables):

- **Fold lines**: `border-top: 2.5px dashed #b3a492;` between panels.
  Label faintly: "✂️ cut" on outer edges, "— fold —" on internal
  creases, "glue here ▸" on the attachment tab.
- **Glue tab**: a narrow strip (~0.75in) on one end with a dotted
  border and "GLUE" in small caps. Background `#f5f0e8` so the child
  sees it is not content.
- **Large display text**: the key concept in big, bold letters
  (`font-size: 72px–110px; font-weight: 700;`). Bubble-letter style
  for younger kids (Fredoka weight 600+). Each letter or step can
  carry its own accent color for color-coded-by-concept.
- **Practice panel**: practice problems are part of the foldable, not
  a separate page. Place them in the bottom or back panel with answer
  blanks (`border-bottom: 2px solid #6b6259; width: 60px; display:
  inline-block;`).
- **Scaffolded versions**: generate the blank (fill-in) version first.
  Offer answer-key and color versions as follow-ups if the parent
  wants them — same layout, answers in a muted accent color, or full
  color fills on each section.
- **Mnemonic anchoring**: pair a verbal mnemonic with a small
  illustration (use generate_image for one small character/icon on
  white background, embed via hybrid path). Humor helps memory.

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  .foldable { width: 100%; }
  .panel { min-height: 200px; padding: 20px 24px;
    border-bottom: 2.5px dashed #b3a492; position: relative; }
  .panel:last-child { border-bottom: none; }
  .fold-label { position: absolute; right: 12px; top: -10px;
    font-size: 10px; color: #b3a492; font-family: sans-serif;
    letter-spacing: 0.1em; }
  .glue-tab { height: 56px; border: 2px dotted #b3a492;
    background: #f5f0e8; display: flex; align-items: center;
    justify-content: center; font-size: 11px; letter-spacing: 0.2em;
    color: #b3a492; text-transform: uppercase; }
  .concept-letter { font-family: 'Fredoka', sans-serif;
    font-weight: 700; font-size: 96px; display: inline-block;
    margin: 0 6px; }
  .practice-blank { border-bottom: 2px solid #6b6259;
    width: 60px; display: inline-block; margin: 0 4px; }
</style>

<div class="foldable">
  <div class="glue-tab">✂️ cut along outer edge · glue this tab into notebook</div>
  <div class="panel">
    <span class="fold-label">— fold —</span>
    <!-- Cover panel: title + mnemonic art -->
    <div style="text-align:center;">
      <span class="concept-letter" style="color:#e25b45;">P</span>
      <span class="concept-letter" style="color:#f5a623;">E</span>
      <span class="concept-letter" style="color:#4caf50;">M</span>
      <span class="concept-letter" style="color:#00897b;">D</span>
      <span class="concept-letter" style="color:#2196f3;">A</span>
      <span class="concept-letter" style="color:#9c27b0;">S</span>
    </div>
  </div>
  <div class="panel">
    <span class="fold-label">— fold —</span>
    <!-- Reference panel: definitions -->
  </div>
  <div class="panel">
    <!-- Practice panel: embedded problems -->
    <p>Solve: 3 + (4 × 2) = <span class="practice-blank"></span></p>
  </div>
</div>
```

Path choice: hybrid is the default (generate_image for the mnemonic
character or decorative art, HTML for structure and text). Use
image-direct when the whole foldable is art-driven (a coloring
foldable, a visual-only science diagram). Use html alone for
text-heavy reference foldables (vocabulary, formula cards) where
surgical revision matters more than organic feel.

## Structured outline / essay scaffold

Reference image: `references/homa-outline-reference.png`
— a Homa-style structured outline example showing two-column
instruction|work layout, Roman numeral section headers, labeled
sub-fields with blank writing lines, and clean B&W design. Study it
for layout proportions, section structure, and field labeling.
Original structural patterns drawn from TPT essay outline inspo
(The Daring English Teacher), re-expressed in Homa's design language.

A structured outline breaks a complex task — writing an essay, planning
a research project, outlining a book report — into a fill-in-the-blank
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
  24px;` — generous spacing so the child can write comfortably.
  3–4 lines per sub-field for younger writers, 2 lines for older.
- **Difficulty variants**: same layout, different field counts. A
  simpler version has 2 evidence slots per body paragraph; a harder
  version has 3. Generate the version that matches the child's level
  (from the difficulty-from-evidence rules above), and offer the
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

## Design rules (binding)

- The page belongs to the child, not to Homa: no logo header, no brand
  banner, no marketing. The footer credit is added by the platform.
- Ink-light and grayscale-safe: white background, line art over filled
  art, color as accent only. Home printers are the target.
- Big type, generous whitespace, one skill per page. Cluttered reads as
  homework; spacious reads as play.
- Write instructions TO the child, one short line each. A name line up
  top or the child's name pre-printed, spelled exactly as the family
  spells it.
- Never red-pen framing, scores, or anything that grades.

## Page density by age (layout and item counts; the LEVEL comes from evidence, above)

| Age | What a page should ask |
|---|---|
| 2-3 | 2-3 giant items: point, color, match, sticker-sized targets |
| 4-5 | 3-5 items: trace big letters/numbers, count to 10, circle the match |
| 6-7 | 4-6 items: write on lines, simple sums, sight words, mazes |
| 8-10 | 5-8 items: multi-step problems, short writing prompts, labeling |
| 11+ | fewer, deeper: worked examples, outlines, real diagrams |

## Metadata discipline (what makes reuse possible)

Fill create_printable's metadata every time: kind, subject, skill,
curriculum (when the family follows one, e.g. "Handwriting Without
Tears"), theme, characters (spelled the family's way), childId. Sloppy
metadata means find_materials cannot find it next month, and the
"same page for the sibling" move stops working.

## The loop: draft, check, revise, finalize

1. Every create_printable result is a DRAFT, and the tool runs an
   automatic quality check on the rendered pixels. Issues reported?
   Fix exactly those and call again with revisesId set to the draft's
   id. On text, a flagged page is deliberately not sent until a version
   passes.
2. The parent's critique is the real review. Change only what she
   named, keep everything she liked, same image URL unless the image is
   the complaint, revisesId chaining each version.
3. When she approves ("great", "print it", "she'll love this"), call
   mark_material_final with that version's id. The final joins the
   library; drafts are tidied away. Never finalize on your own judgment,
   and never nag her to approve.
4. When a style clearly lands and she agrees, remember the how-to as a
   durable preference (what made it work, the prompt pattern, the layout),
   e.g. "Maya's worksheets use Paw Patrol characters, soft watercolor
   style."
5. "Can you send it again?" is show_material with that version's id:
   the card or picture message comes back exactly as made. Never
   re-render a page just to re-show it.

Open every build with a short progress note before you design
anything, on either surface. On text (SMS), the note goes through
send_heads_up; a build otherwise leaves her waiting on a silent phone.
On web, write it as the first sentences of your reply, and answer her
real question, whether she has to sit there: "On it. Skye's counting
page needs a minute or two. You don't have to wait here, it'll be
ready when you look back." It streams to her immediately, so she is
never watching a bare spinner. One note per turn, no exact time
promises, then do the work in the same turn.

When the build lands: on text, create_printable already delivered the
passing version to her phone; follow with one short message naming the
child and the skill. On web, the card is already visible; one warm
sentence, never the links.
