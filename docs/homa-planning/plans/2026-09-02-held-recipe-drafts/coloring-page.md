# Coloring page

Golden anchor: pass `anchorIds: ["coloring-page"]` to generate_image so the
output matches the Homa coloring bar (one big subject filling the sheet,
thick uniform charcoal contours with no shading or gray fill, every region
closed and wide enough for a crayon, a thin name line and one short caption
up top, pure white background everywhere with no paper texture or tint).
Write your own prompt with your own content; the anchor sets the visual
bar, not the specifics.

One line-art picture for the child to color, and nothing else to do. No
counting, no matching, no color code, no question on the page. The page is
a reward, a warm-up, a quiet-time anchor, or the picture half of a story
the parent will talk about, and its whole job is to be a pleasure to color
and to survive a home printer. Sourced patterns: one giant outline subject
filling the page for the child to colour and decorate freely
(ref-2026-07-18-habitat-schoolhouse-prek-workbook5, the letter-T page,
whose letter itself routes to giant-letter-art-page); B&W hand-drawn line
art with large simple shapes and light ink
(ref-2026-07-19-treasury-year-round-pk-activities); a single caption
carrying the song's closing line
(ref-2026-07-19-los-pollitos-unit1-activities p.8); a B&W story
illustration the parent talks about
(cur-2026-07-19-100-easy-lessons picture-comprehension); color naming and
staying-in-the-lines crayon control alongside a task-free page
(cur-2026-07-19-handwriting-without-tears Colors & Coloring). Line weight,
closed-region, fill-area, and fill-ratio floors below are Homa print rules,
not library extractions.

Great for: ages 2-10 by default (object page at 2-3, scene page at 4-10);
the pattern-fill page for ages 11+, or ages 8-10 when the parent explicitly
asks for intricate detail; fine-motor and crayon-control practice,
color-word naming with a parent alongside (HWT Colors & Coloring), a
story's picture for picture-talk (100 Easy Lessons), themed reinforcement
in any subject, and Homa's first making for a new family.

Creation path: **image-direct, always.** One generate_image call with
`shape: "portrait"`, its URL passed to create_printable as `pageImageUrl`;
the name line and the optional caption are composed INTO the image by the
prompt. No html shell, no hybrid path. Reasons: organic line art is the
image model's strength and CSS art reads as clip-art; the 2026-07-10
calibration passed coloring-page on image-direct
(docs/homa-planning/materials/calibration/2026-07-10/report.md row) and
SKILL.md's image-direct rule covers quoted titles; and the page carries no
exact text beyond a name line and one caption, so nothing needs HTML. The
model infers none of the line weight, closed regions, ink density, or
header layout from the word coloring, so state every bullet below in the
prompt.

Printed geometry (platform facts; lay the image out against them):
generate_image portrait is 1024x1536 px (2:3). create_printable's image page
(`imagePageBody`) fits it with `object-fit: contain`, top-aligned and
centered, into the 7.3in x 9.5in content box, so it prints 6.33in x 9.5in
(161.7 px per inch) with 1.08in of white paper between the art and each
side edge of the sheet. That side air is the format's only air; the art
never adds its own. Inside the image, three bands, top to bottom:

- **Name band**: the top 96 px (1/16 of the height, 0.59in). `Name:` in
  lettering about 40 px tall (0.25in) at the left, inset 48 px, then a
  straight blank line about 480 px long (3in, just under half the width).
- **Caption band (optional)**: the next 96 px (0.59in). One caption
  centered, lettering about 50 px tall (0.31in), at most 5 words AND 22
  characters including spaces. The arithmetic assumes a plain sans
  letterform with a mean advance of about 39 px per character at that
  height (about 0.55 em on a 71 px em): 22 characters run about 860 px,
  inside the 928 px between the 48 px side insets; 24 characters run
  about 936 px and do not reliably fit. Omit the band entirely when there
  is no caption.
- **Art zone**: everything below, 1344 px (8.31in) with a caption or 1440
  px (8.91in) without, running to the bottom edge of the image with no
  empty band. The focal subject spans at least six sevenths of the art
  zone's height (1152 px, 7.13in, 75% of the printed image's 9.5in height,
  with a caption; 1234 px, 7.63in, just over 80% of it, without) and at
  least four fifths of the image width (819 px, 5.07in). A ground line,
  when the scene has one, sits in the bottom tenth of the image (within
  154 px, 0.95in, of the edge) and the ground fills below it to the edge.

Subject scopes (closed set, one per page): `object` (one thing alone),
`scene` (one focal subject in a place), `pattern-fill` (one subject whose
silhouette holds a pattern), `story-picture` (the illustration of a story
the family is reading), `child-hero` (the child from their photo as the
focal subject, laid out as an object or scene). A letter or digit to
decorate is none of these: it routes to giant-letter-art-page. The six
variants each map to one scope; their choice rules, the prompt template,
and worked prompts live in
`/workspace/skills/materials-studio/references/recipes/coloring-page.variants.md`.
Read it before picking one.

Design patterns (all binding for coloring-page; state each one in the
generate_image prompt, since none is inferred by the model on its own):

- **One subject per page.** Exactly one focal subject (one animal, one
  vehicle, one character) or one scene built around it. Never two scenes,
  never a scatter of unrelated objects; a scatter to find or count is
  another recipe.
- **Density by age, counted in the prompt.** SKILL.md's page-density table
  applied to a single-subject page. An item is one colorable thing the
  child can name: the focal subject is one item and each supporting object
  standing on its own (a sun, a cloud, a flower, a ball) is one item;
  interior lines, a ground line, and a frame are not items. Ages 2-3: 2-3
  items, the subject plus 1 or 2 giant supporting objects each at least
  1.5in across (243 px), zero background, a handful of interior lines. Ages
  4-5: 3-5 items, the subject plus 2 to 4 supporting objects. Ages 6-7: 4-6
  items, the subject plus 3 to 5 supporting objects and a simple ground
  line. Ages 8-10: 5-8 items, the subject plus 4 to 7 supporting objects
  with fine interior detail. The pattern-fill page has its own count, in
  the rule below. Name the exact count of every supporting object in the
  prompt; "a few flowers" becomes eleven.
- **Pattern-fill rule (closed).** The pattern-fill page goes to a child
  aged 11 or older, or to a child aged 8-10 whose parent explicitly asks
  for intricate detail; a child under 8 never gets it, whatever the parent
  asks (the age's object or scene page with fine interior detail is the
  answer). A pattern-fill page always uses the pattern-fill floor and
  count, whatever the child's age: no enclosed area narrower than 1/4in
  (40 px, 4% of the image width), and the subject plus 0 to 2 supporting
  objects. The quality gate checks the page's floor, never the age's.
- **The subject fills the art zone.** The six-sevenths height and
  four-fifths width floors above, stated in the prompt as fractions so the
  model has numbers it can act on. A small subject in white space is a
  failed composition on this format (see the quality gate), not a layout
  to fix in CSS: there is no CSS.
- **Thick, uniform contours.** Outer contours about 1/16in printed, about
  10 px in the image (1% of its width); interior detail lines about half
  that (5 px). Never hairlines, sketchy double strokes, or tapering brush
  lines. Every line is charcoal on white; one ink, one weight class.
- **Every region closed.** Every line meets another line so a crayon knows
  where to stop; no open contours, no gaps at joints, no lines that fade
  out. This is what makes the page colorable.
- **Smallest fill area is crayon-sized, set by the page.** On an object or
  scene page, no enclosed region narrower than 3/4in (121 px, 12% of the
  width) for ages 2-5 or 3/8in (61 px, 6%) for ages 6-10; on a pattern-fill
  page, 1/4in (40 px, 4%) whatever the age. Eyes, buttons, and spots are
  the only exceptions, and they may be solid.
- **Ink is lines only.** No shading, no gray fill, no hatching, no gradient,
  no filled black shapes except pupils and small accents, no watercolor
  wash, no textured paper rendering inside the art. White interior
  everywhere the child will color. The Habitat Schoolhouse references'
  full-color watercolor is poster art, never a coloring page.
- **Header is a name line and at most one caption.** The two bands above
  and nothing else: the caption is the subject's name or a story's closing
  line (the way the Los pollitos page captions its chicks), in quotes in
  the prompt, at most 5 words and 22 characters. No other text anywhere in
  the image: no labels, speech bubbles, numbers, logo, watermark, or
  instruction line (the page needs none). A verse, a lyric, or picture-talk
  prompts never land on this page: a verse is a chant-and-rhyme-card page,
  prompts go in Homa's chat reply or on a separate `parent_guide` page with
  `pageRoles`, and the child's page keeps only the caption.
- **Frame is optional and quiet.** No frame, or a single thin line 1/4in
  (40 px) inside the image edge. Never a themed border busier than the
  subject; it steals ink and attention from the one thing the page is for.
- **Friendly faces, calm scene.** Smiling or neutral expressions, nothing
  frightening, no weapons aimed at the viewer, no text on clothing.
- **Size is a floor, not a target.** Once the subject's size has rendered
  acceptably, by default or by a parent confirming a fix, it is a floor for
  every later revision of the same material. A new caption or small element
  never shrinks the subject to make room: drop the addition or split to a
  second page, and ask the parent before trading size away.
- **Grayscale by construction.** Line art on white prints identically on a
  black-and-white printer, so never add color accents "for the screen." The
  background is the page, so it is white in the pixels.

What not to do:

- No count-and-color ("color 4 of the 7 trucks"): number-practice-page owns
  that. No color-by-answer or color-by-number: the math practice laws own
  those as a math page. No "color the big ones blue, the small ones
  yellow": size-attribute-comparison-page owns it. No letter or digit to
  decorate: giant-letter-art-page owns a capital-lowercase pair as the
  page. No pieces to cut and build: cut-and-assemble-craft. No dot circles
  to stamp: dot-marker-activity. No letter to trace:
  letter-number-formation-practice or name-tracing-page. No blank box for
  the child to draw in: narration-page. No illustration with reading text
  beside it: illustrated-teaching-page. If the parent's ask carries any
  task beyond coloring, route there and keep this page pure.
- Never build an html or hybrid shell around the art, whatever the
  complaint. The B1 revision spiral in
  docs/homa-planning/plans/2026-07-28-materials-first-delivery-approval.md
  §8 ("make page 4's coloring illustration bigger", then "larger still",
  "even larger", "even bigger") is what a CSS-capped coloring illustration
  costs a parent. Fix a bad composition by the quality gate, never a shell.
- Never describe a franchise character as a lookalike and hand it over as
  the real one; SKILL.md's franchise rules apply unchanged here.
- Never transcribe a publisher's illustration. The library items above
  donate the mechanic (a caption on a song's picture, a page-filling
  subject), never their drawings or words.

Prompt: the template and three worked prompts (object, scene, pattern-fill)
live in the variants file. Every prompt states, in order: the anchor as
the exact style guide; lines-only ink at the contour weights above; every
region closed and the page's fill floor (12% | 6% | 4% of the image
width); the name band and, only with a caption, the caption band with the
quoted caption; ONE subject described visually at the six-sevenths and
four-fifths floors, running to the bottom edge; exactly N supporting
objects, each with its own count, N being ONE number from the page's
range, never a range; and the closing "nothing else in the image" list.

Quality gate before create_printable, looking at the actual image. Pixel
defects, the one canonical list for this recipe: wrong or missing subject;
open contours; a region under the page's fill floor; gray or shaded area;
tinted background; name line or caption misspelled, missing, or placed
anywhere but the top bands; stray lettering; supporting-object count not
matching the prompt; and a failed composition, which on this all-pixels
format means a subject short of six sevenths of the art zone's height or
four fifths of the width, or an empty band at the bottom
(image-call-strategy's "unusable composition" class; an image-direct page
has no CSS to recompose it). Any of those: regenerate once with the failed
sentence restated, same anchor, same references. Two failed checks: stop
and ask the parent, never fall to a shell.
