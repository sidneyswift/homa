# Coloring page: variants and prompts

Companion to `coloring-page.md`. Every binding pattern there (image-direct
only, the three-band layout inside the image, one subject per page, density
by age with the item definition, subject fills the art zone, thick closed
contours, crayon-sized fill areas set by the page, lines-only ink, a name
line plus at most one 5-word / 22-character caption up top, size as a
floor, grayscale by construction) still binds here; this file carries the
variant choice rules, the worked subject notes, the prompt template, and
three worked prompts. Each variant maps to one of the recipe's closed
subject scopes, named in its heading.

## Choosing the variant

Pick by what the parent asked for and the child's age, in this order:

1. A letter or digit to decorate is not this recipe at all: route to
   giant-letter-art-page.
2. A story the family is reading: picture-talk page.
3. A `photoUrl` in family context and the parent wants the child in it:
   child as the hero (laid out as an object or scene page by age).
4. Color-word practice: color-naming companion (the page itself is still
   an object or scene page by age).
5. Otherwise, by age: ages 2-3 object page, ages 4-10 scene page, and the
   pattern-fill page only as the pattern-fill rule below allows.

## Object page (ages 2-3, scope `object`)

One giant object plus 1 or 2 giant supporting objects, 2-3 items in all
under SKILL.md's density table (a ball with one seam beside one sun; an
apple with one leaf beside two clouds; a fish with one fin line and one
eye beside one bubble). Zero background, every region wider than 3/4in
(121 px, 12% of the image width), every supporting object at least 1.5in
across (243 px). The caption is the object's name in one or two words, or
no caption at all.

## Scene page (ages 4-10, scope `scene`)

The focal subject in a place, with the supporting-object count from the
density bullet in the recipe: 2 to 4 at ages 4-5 (3-5 items), 3 to 5 plus
a ground line at 6-7 (4-6 items), 4 to 7 with fine interior detail at 8-10
(5-8 items). Fill floor 3/4in (121 px, 12%) at ages 4-5 and 3/8in (61 px,
6%) at ages 6-10. Name every supporting object with its count in the
prompt. A ground line, when used, is one line spanning the image in its
bottom tenth with the ground filling below it to the edge, never a horizon
band with hatching.

## Pattern-fill page (scope `pattern-fill`)

A mandala, a patterned animal, a tiled shell or leaf: fewer and deeper
regions, the pattern living inside the subject's silhouette, never as a
busy border. Still lines only, still one subject. Who gets it and what
binds it is the recipe's rule, repeated here word for word:

Pattern-fill rule (closed). The pattern-fill page goes to a child
aged 11 or older, or to a child aged 8-10 whose parent explicitly asks
for intricate detail; a child under 8 never gets it, whatever the parent
asks (the age's object or scene page with fine interior detail is the
answer). A pattern-fill page always uses the pattern-fill floor and
count, whatever the child's age: no enclosed area narrower than 1/4in
(40 px, 4% of the image width), and the subject plus 0 to 2 supporting
objects. The quality gate checks the page's floor, never the age's.

## Letter or number to decorate

A capital-lowercase pair to decorate is giant-letter-art-page, not this
recipe; this recipe owns a pictured subject or scene. A scene that happens
to contain a letter (a big B drawn in beach sand) stays here, because the
page is the scene and the letter is one supporting object of it.

## Picture-talk page (scope `story-picture`)

The illustration for a story the family is reading (the
cur-2026-07-19-100-easy-lessons picture-comprehension mechanic). The 2 or 3
open questions the parent asks ("what do you think happens next?") go in
Homa's chat reply or on a separate `parent_guide` page with `pageRoles`,
never on the child's page. The caption may be the story's closing line
(the way the Los pollitos page captions its chicks) when it fits the 5-word
/ 22-character cap; a longer line goes in the chat reply, and a whole verse
is a chant-and-rhyme-card page. The page is laid out as an object or scene
page by age, with that page's fill floor and count.

## Color-naming companion (scope `object` or `scene`)

The page stays task-free; the parent names each color as the child picks
it up and the child practices staying in the lines
(cur-2026-07-19-handwriting-without-tears Colors & Coloring, color naming
and crayon control). Homa's reply carries that suggestion. No legend, no
swatches, no "color the sky blue" line; a legend turns this into a
color-by-code page, which is a math page under the math practice laws.

## Child as the hero (scope `child-hero`)

With a `photoUrl` in family context, pass it in `referenceImageUrls`
alongside the anchor, follow the SKILL.md drawing-the-child rules, and add
"keep their hair, glasses, and skin tone recognizable, drawn as thick
outline line art, no shading." The child becomes the focal subject; the
age's density rules still set the supporting-object count.

## Prompt template

Adapt the bracketed parts and keep every count explicit. The fill floor is
the page's: 12% for an object or scene page at ages 2-5, 6% for a scene
page at ages 6-10, 4% for a pattern-fill page. N is ONE number from the
page's supporting-object range, never a range. Drop the caption sentence
when there is no caption, and the art then starts right under the name
band.

```
Using the attached reference image as the exact style guide, a children's
coloring page, portrait. Black-and-white line art only: thick uniform
charcoal outlines about 1% of the image width (about 10 pixels) for outer
contours and half that for interior details, no shading, no gray fill, no
hatching, no gradients, no watercolor, white interior everywhere, pure
white background with no paper texture or tint, no photorealism. Every
line closed so each region can be colored; no enclosed area narrower than
[12% | 6% | 4%] of the image width except eyes, buttons, and spots, which
may be solid. In the top sixteenth of the image: the word 'Name:' in
plain lettering about 40 pixels tall at the left, followed by one straight
blank line just under half the image width long. In the next sixteenth:
the caption '[caption, at most 5 words and 22 characters]' centered in
large clear lettering about 50 pixels tall. Below the header, ONE [subject,
described visually: species, pose, outfit, props], [facing direction,
expression], filling at least six sevenths of the space below the header
and at least four fifths of the image width, the art running to the bottom
edge with no empty band. Around it exactly [N] supporting objects: [list
each one with its count]. Nothing else in the image: no other text, no
labels, no speech bubbles, no numbers, no logo, no watermark, no border
[or: a single thin line frame about 40 pixels inside the image edge].
```

## Worked prompts

Three fills of the template, one per scope Homa builds most. Each keeps
the template's opening (style guide, ink, closed lines) and closing
(nothing else in the image) sentences unchanged; only the bracketed parts
are shown filled.

**Object page, age 3, caption "Apple" (5 characters), floor 12%, N = 2.**
"... no enclosed area narrower than 12% of the image width except eyes,
buttons, and spots, which may be solid. In the top sixteenth of the image:
the word 'Name:' ... In the next sixteenth: the caption 'Apple' centered in
large clear lettering about 50 pixels tall. Below the header, ONE round
apple with a short stem and a single large leaf, filling at least six
sevenths of the space below the header and at least four fifths of the
image width, the art running to the bottom edge with no empty band. Around
it exactly 2 supporting objects: one large round sun at the top right, one
large cloud at the top left, each at least a quarter of the image width
across. No ground line, no background. Nothing else in the image ..."
Items: apple, sun, cloud = 3, inside the 2-3 band for ages 2-3.

**Scene page, age 6, caption "Puppy in the garden" (19 characters), floor
6%, N = 4.** "... no enclosed area narrower than 6% of the image width
except eyes, buttons, and spots, which may be solid. ... the caption 'Puppy
in the garden' centered in large clear lettering about 50 pixels tall.
Below the header, ONE floppy-eared puppy sitting facing the viewer with a
happy open-mouth smile and a collar with one round tag, filling at least
six sevenths of the space below the header and at least four fifths of the
image width, the art running to the bottom edge with no empty band. Around
it exactly 4 supporting objects: one round sun at the top right, two
clouds at the top left, one round bush at the lower left, all standing on
a single ground line in the bottom tenth of the image with grass filling
below it to the edge. Nothing else in the image ..." Items: puppy, sun,
two clouds, bush = 5, inside the 4-6 band for ages 6-7.

**Pattern-fill page, age 12 (or age 9 with the parent explicitly asking
for intricate detail), caption "Sea turtle" (10 characters), floor 4%,
N = 1.** "... no enclosed area narrower than 4% of the image width except
eyes, buttons, and spots, which may be solid. ... the caption 'Sea turtle'
centered in large clear lettering about 50 pixels tall. Below the header,
ONE sea turtle seen from above, flippers spread, its shell divided into a
tiled pattern of large hexagons each holding one smaller shape (a spiral,
a leaf, a star), the flippers filled with rows of wide scales, filling at
least six sevenths of the space below the header and at least four fifths
of the image width, the art running to the bottom edge with no empty
band. Around it exactly 1 supporting object: one small fish at the lower
right. No ground line, no background. Nothing else in the image ..." The
pattern lives inside the silhouette; the page's floor is 4% whatever the
child's age, per the pattern-fill rule above.
