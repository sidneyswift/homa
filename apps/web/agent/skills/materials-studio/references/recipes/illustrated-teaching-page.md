# Illustrated teaching page

Golden anchor: pass `anchorIds: ["illustrated-teaching-page"]` to
generate_image so the illustration matches the Homa teaching-page bar (one
landscape line-art subject showing the exact claim the sentences make,
thick clean warm brown and charcoal outlines on soft cream, no shading, no
text anywhere). Write your own prompt with your own subject; the anchor
sets the visual bar, not the specifics.

The anchor is the text-free illustration band alone, never the whole page,
so a hybrid call cannot pull lettering into the image; the headline, the
sentences, and the check under it are always html.

A page that teaches instead of drills. The headline is the question the
child would actually ask ("Why do my teeth fall out?", "Where does rain
come from?"), three or four short sentences answer it, one illustration
shows the thing the sentences say, and one check closes it. This is the
"Learn" half of investigate-then-explain science and the per-lesson spine
of primary health and science textbooks: a non-reader can tell from the
picture what the page is about, and a reader finishes it in a minute
knowing one true thing she did not know before. Every other recipe in the
library produces a page the child works on; this one produces the page
she reads first. cur-2026-07-19-harcourt-science (2026-07-21) declined to
flag this shape as a gap; ref-2026-07-19-your-health (2026-07-29) reversed
that once a second textbook proved the spine repeats, and this recipe is
that gap closed (`question-headline-lesson-page` in .cosmo/open-gaps.json).

Great for: ages 4-9 (read-aloud at 4-5, early reader at 6-7, fluent
reader at 8-9), science, the human body and health, nature study, weather
and seasons, simple social studies. Families using an
investigate-then-explain science program (hands-on step, then a short
reading), Habitat Schoolhouse-style animal studies, or any parent who
says "explain it to her" rather than "give her practice."

Not for closing a lesson already taught; lesson-comprehension-check owns
the 2 recall + 1 open closer. Not for a multi-page passage with a skill
lesson and transfer text; reading-comprehension-mini-unit owns that. Not
for a diagram with parts to label; labeled-anatomy-diagram owns that. Not
for the hands-on step itself; art-project-instructions owns the
materials-and-steps Investigate page. Not for a story the child decodes;
decodable-story-page owns controlled text. Not for a fill-in notes page
followed by drill; notes-and-practice-bundle and guided-notes own the
older two-column scaffold.

Always hybrid path. HTML owns the headline, the sentences, the bold
vocabulary word, and the check box, because those words must be exactly
right by construction and a parent fixes one sentence at a time (an html
revision is seconds and free; an image re-roll is a minute and paid). One
generate_image call owns the illustration, because organic art is what
CSS cannot draw and the picture is half the teaching. Never image-direct:
three or four sentences is the density where image lettering degrades,
and one misspelling would re-roll the whole page. The photo variant
swaps generate_image for search_photos + keep_photo and changes nothing
else.

Design patterns (all binding for illustrated-teaching-page), in two
groups: sourced, extracted from ref-2026-07-19-your-health,
cur-2026-07-19-harcourt-science, and
ref-2026-07-18-habitat-schoolhouse-prek-workbook2 (hands-on-first rhythm
corroborated by cur-2026-07-20-dimensions-math-pka); and Homa's own
geometry, binding but not extracted from any source.

Sourced:

- **The headline is the child's question, exactly one**: a real question
  with a question mark, written the way the child would ask it, in first
  person when the topic is her own body or life ("Why do I need sleep?")
  and plain otherwise ("What is wind?"). Never a skill label, chapter
  number, or noun phrase ("Lesson 3: Dentition" is the same lesson nobody
  reads voluntarily).
- **One picture, and it carries half the meaning**: it shows the exact
  thing the sentences say, not a mood picture; if they say a bigger tooth
  is growing under the baby tooth, the picture shows that. Test: could a
  non-reader guess the headline from the picture alone?
- **Three or four body sentences, no more**: each one or two clauses, in
  the order the idea happens (cause, then effect). The source runs two to
  four short paragraphs; Homa caps at three or four sentences because
  this is one printed sheet, not a bound spread. The 8-9 "Did you know"
  caption under the illustration is the one allowed extra line and it
  never replaces a body sentence (its row and type are in the variants
  file). A source teaches the mechanic, it never donates its wording;
  Homa writes every sentence from the child's evidence.
- **One new word, bold, inside a sentence**: taught by use in the
  sentence, never by a definition list or word bank. The source bolds one
  or two words; Homa bolds one, because a second new word is a second
  page. (At 4-5 the page is exactly four sentences, each led by a bold
  lead-in, and the lead-ins take the bold slot; see the variants file.)
- **One check, in a box at the foot, of exactly one type**: one of the
  four ids `written-1`, `written-2`, `draw`, `point-to` (sizes and the
  age rule are the Check type bullet below). Label "Check" (or the
  family's curriculum wording, if it has one), one prompt the child can
  answer from the sentences or the picture. Never a second question,
  never a score.
- **Optional one-line "First, try this" kicker above the headline**, only
  when the family's program does the hands-on step before the reading
  (investigate-then-explain science; Explore-then-Learn early math) and
  the parent or the program says so; never by default. One sentence the
  child can do in a minute with what is in the room ("Hold your breath
  and count to five."). A hook, never the activity page; the full
  materials-and-steps investigation is art-project-instructions. Its row
  and type are the Kicker row bullet below.
- **One question per page, one page per question**: a topic with several
  questions is a packet of teaching pages via create_printable's `pages`
  input, each page its own headline, illustration, and check. Never stack
  two questions on one sheet.

Homa's geometry (binding, not extracted):

- **Name line and headline**: name line up top in its own 36px row, right
  aligned: the blank is 34px of writing room over a 2px rule, with the
  word "Name" in Andika 18px beside it, sized to the line it labels. The
  headline sits directly under it: Fredoka 600, 30-34px, left aligned, 3
  to 9 words. At 32px about 7 words fit one line; 8 or 9 words wrap to
  two lines and take about 37px (0.4in) from the picture.
- **Kicker row (only when present)**: one `auto` track between the name
  row and the headline, so the grid becomes
  `36px auto auto minmax(3.9in, 1fr) auto auto`. Andika 18px, line height
  1.4, one line: the words "First, try this:" in `font-weight: 700`,
  then the one-sentence task. It costs the picture 39px (its 25px line
  plus its 14px gap): on the default page the picture drops from about
  5.8in to about 5.4in. Add the track only when the kicker is present; an
  empty track still takes its 14px gap and lifts the check off the
  bottom.
- **Illustration frame**: one landscape composition, full content width,
  at least 3.9in tall, growing until the check box touches the bottom of
  the 9.5in box (on the default page this lands at about 5.8in), directly
  under the headline, `object-fit: cover`, `box-sizing: border-box` so
  its 2px border stays inside the track; no text or letters in the image.
  The `landscape` output is 1536 by 1024 (aspect 1.5), and a prose aspect
  ratio in the prompt is not honored, so the crop follows the frame: a
  frame taller than 4.87in (7.3 divided by 1.5) loses width at the left
  and right edges, up to about 8% each on the 5.8in default; a shorter
  frame loses height at the top and bottom, up to about 7.5% each on the
  4.1in read-aloud draw page. Every prompt therefore keeps the subject
  inside the middle 80% of the frame in both axes and never asks it to
  fill the frame edge to edge (per-variant crop table in the variants
  file).
- **Body type**: Andika, line height 1.5; 24px at ages 4-5, 20-22px at
  6-7, 18px at 8-9 (the 16px floor is a floor). A sentence holds one
  line at about 50 characters (24px), 60 (21px), or 70 (18px) on the
  7.3in row; longer sentences wrap and cost the picture one line each,
  nothing else. The bold word is `font-weight: 700`.
- **Check type**, one of four, chosen by age with no other pairing:
  `written-1` at 6-7 (one ruled line, 40px tall); `written-2` at 8-9 (a
  why question, two ruled lines, 34px each, at the blank floor on purpose
  because a why answer is a sentence in small handwriting); `draw` (one
  open box at least 1.6in tall) or `point-to` (one directive the parent
  reads, "Point to the tuna's tail", which is the whole check: no
  question above it, no line under it) at 4-5, the parent choosing
  between those two. Always bordered, always the last thing on the page.
- **Scale to fill, illustration first**: the picture grows until the
  check box touches the bottom of the box; the type grows next. A dead
  band means a taller picture or bigger type, never a fifth body
  sentence; the 8-9 caption is the one allowed extra line and it never
  replaces a body sentence.
- **Size is a floor, not a target.** Once the illustration height and the
  body type have rendered acceptably, they are floors for every revision.
  An overflow fix cuts a sentence back toward three or shortens the check
  prompt; it never shrinks the picture below 3.9in or the type below the
  age floor. If nothing else closes the gap, ask the parent first.
- **Ink-light and grayscale-safe**: line art, warm brown and charcoal on
  cream, color as accent only. The source textbooks are heavy-ink
  full-bleed photography that needs color (ref-2026-07-19-your-health
  printFormat): evidence that a realistic register is legitimate for body
  and health content, not a print style to copy.

Variants by age (read-aloud 4-5, early reader 6-7, fluent reader 8-9,
photo), the worked HTML with its arithmetic, the kicker and caption
insertions, and the illustration prompt template: read
`illustrated-teaching-page.variants.md`, next to this file
(/workspace/skills/materials-studio/references/recipes/illustrated-teaching-page.variants.md).
The level still comes from the child's evidence, never from the age
alone.

What not to do:

- Never a headline that is a label or a noun phrase, a second question in
  the headline slot, a "for more, visit" pointer, a page-number
  cross-reference, or a grade.
- Never transcribe a publisher's sentences, question, or bolded term;
  never bake the headline or any word into the image.
- Never more than one illustration, and never a scatter of spot art; a
  second picture is a labeled-anatomy-diagram or a
  then-and-now-comparison page.
- Never a word bank, a fill-in blank in the body text, or a labeling
  task; the body is read, not completed.
- Never two check questions or a "What Did You Learn?" box; that is
  lesson-comprehension-check closing a longer lesson.
- Never a kicker on a page whose program reads first; the kicker is the
  investigate-then-explain hook and nothing else.

Before finalize, five checks: (1) one question headline; (2) one
illustration that shows the sentences' exact claim, nothing baked into
it, the subject inside the middle 80% of the frame both ways; (3) three
or four body sentences in Homa's own words with exactly
one bold word (at 4-5, exactly four sentences each led by a bold
lead-in; at 8-9, at most one caption line under the picture); (4) one
check of the type the age rule names, box touching the bottom of the
page; (5) metadata (kind, subject, skill, theme, childId) filled so a
sibling "another one like this" request finds it.
