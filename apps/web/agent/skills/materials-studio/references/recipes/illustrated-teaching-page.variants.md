# Illustrated teaching page: variants, worked HTML, prompt template

Companion to `illustrated-teaching-page.md`. Every binding pattern there
(one question headline, one picture carrying half the meaning, three or
four body sentences in Homa's words, one check of the type the age rule
names, the 3.9in illustration floor, size as a floor, hybrid path) still
binds here; this file carries the age variants, the worked page with its
arithmetic, the kicker and caption insertions, and the prompt template so
the recipe stays a router.

## Variants by age (the level still comes from the child's evidence)

- **Read-aloud (ages 4-5)**: the parent reads. The headline stays the one
  question ("What is a tuna?"). The four study questions the preschool
  animal-study pages ask (what does it look like, what does it eat, where
  does it live, what is it good at; ref-2026-07-18-habitat-schoolhouse-prek-workbook2)
  become exactly four sentences, each opening with one bold lead-in,
  each sentence at 24px and under about 50 characters so it holds one
  line: "**It looks like** a silver torpedo with a forked tail. **It
  eats** smaller fish and squid. **It lives** in the open ocean, far from
  shore. **It is good at** swimming fast." The lead-ins take the bold
  slot; there is no separate bold vocabulary word at 4-5 because the
  child is listening, not decoding. Check type is `point-to` (the one
  directive "Point to the tuna's tail" is the whole check, no question
  and no line) or `draw` (one open box 1.6in tall under "Draw a tuna"),
  never a written line. Four 24px sentences run four 36px lines (144px);
  with the constants from the worked HTML below (36px name row, 37px
  headline, four 14px gaps), the draw page leaves the picture 397px,
  about 4.1in (912 minus 36, 37, 144, the 242px check box, and 56), and
  the point-to page leaves it 561px, about 5.8in (the 78px check box in
  place of 242). The 3.9in floor holds and there is no ceiling.
- **Early reader (ages 6-7)**: the default. Three sentences at 20-22px
  (about 60 characters per line at 21px, so a one-line sentence is about
  10 words), one bold word, check type `written-1` with one 40px ruled
  line. The worked HTML below is this variant.
- **Fluent reader (ages 8-9)**: four body sentences at 18px (about 70
  characters per line, so a 12-word sentence holds one line), one bold
  word, check type `written-2` (a why question, two 34px ruled lines,
  sitting at the 34px blank floor on purpose because a why answer at 8-9
  is a sentence in small handwriting, not a word),
  and one optional "Did you know" caption sentence directly under the
  illustration in its own grid row (`.itp-caption`, Andika Italic 16px,
  one line). The caption is the one allowed extra line; it never replaces
  a body sentence, never carries the bold word, and is the first thing
  cut if the page overflows.
- **Photo variant**: when the real thing must look real (a real monarch,
  real leaf shapes), replace the illustration with one kept web photo
  (search_photos, then keep_photo, the only usable URL), same frame, same
  size floors, and name the source site when the parent asks.

## Worked HTML (early reader, ages 6-7)

The content box is 7.3in wide by 9.5in tall (912px). The illustration row
is `minmax(3.9in, 1fr)` so it absorbs the slack; the body row is `auto` on
purpose so the sentences never stretch into a dead band, and the check
lands at the bottom because everything above it fills. The arithmetic for
this page: the name row is 36px (a 34px blank over a 2px rule); the
headline is one line at 32px with line height 1.15, 37px; the three
sentences run three lines at 21px with line height 1.5, 94.5px (each
sentence in the example is 55 to 59 characters, under the roughly 60 that
fit one 700.8px line at 21px Andika; a sentence that wraps costs the
picture one 31.5px line and nothing else, because the 1fr row absorbs
it); the check box is 130px (2px borders top and bottom, 14px padding top
and bottom, a 16px label plus its 6px margin, a 24px question plus its
10px margin, and a 40px line with its 2px rule); four 14px gaps are 56px.
That leaves 912 minus 353.5, so the picture gets 558.5px and renders at
about 5.8in tall, well above the 3.9in floor.

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Andika:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
  .itp { height: 9.5in; display: grid; font-family: Andika, sans-serif;
    color: var(--homa-ink);
    grid-template-rows: 36px auto minmax(3.9in, 1fr) auto auto;
    row-gap: 14px; }
  .itp-name { font-size: 18px; line-height: 36px; justify-self: end; }
  .itp-name span { display: inline-block; width: 2.6in; height: 34px;
    vertical-align: bottom; margin-left: 8px;
    border-bottom: 2px solid var(--homa-control-boundary); }
  .itp-kicker { font-size: 18px; line-height: 1.4; margin: 0; }
  .itp-kicker b { font-weight: 700; }
  .itp-headline { font-family: Fredoka, sans-serif; font-weight: 600;
    font-size: 32px; line-height: 1.15; }
  .itp-figure { width: 100%; height: 100%; min-height: 0; object-fit: cover;
    box-sizing: border-box; border: 2px solid var(--homa-ink); border-radius: 8px; }
  .itp-caption { font-size: 16px; font-style: italic; line-height: 1.4; margin: 0; }
  .itp-body { font-size: 21px; line-height: 1.5; margin: 0; }
  .itp-body b { font-weight: 700; }
  .itp-check { border: 2px solid var(--homa-ink); border-radius: 8px;
    padding: 14px 16px; }
  .itp-check-label { font-size: 14px; line-height: 16px; font-weight: 700;
    color: var(--homa-control-boundary); margin-bottom: 6px; }
  .itp-check-q { font-size: 19px; line-height: 24px; margin-bottom: 10px; }
  .itp-check-q:last-child { margin-bottom: 0; }
  .itp-line { height: 40px; border-bottom: 2px solid var(--homa-control-boundary); }
  .itp-draw { height: 1.6in; box-sizing: border-box;
    border: 2px solid var(--homa-control-boundary); border-radius: 6px; }
</style>
<div class="itp">
  <div class="itp-name">Name<span></span></div>
  <div class="itp-headline">Why do my teeth fall out?</div>
  <img class="itp-figure" src="{{illustration_url}}" alt="">
  <p class="itp-body">Under each baby tooth, a bigger <b>permanent</b>
    tooth is growing. The new tooth pushes up, and the baby tooth gets
    loose. When it falls out, the permanent tooth takes its place.</p>
  <div class="itp-check">
    <div class="itp-check-label">Check</div>
    <div class="itp-check-q">Why does a baby tooth get loose?</div>
    <div class="itp-line"></div>
  </div>
</div>
```

The name row: the `span` is 34px tall with its 2px rule drawn below that
height (content-box), so the blank is 34px of writing room and the row is
exactly the 36px track; `line-height: 36px` on the label puts the word
"Name" on the same line box, and `vertical-align: bottom` keeps the rule
on the row's bottom edge. The 18px label is sized to the line it names.

Kicker insertion (only when the family's program does the hands-on step
before the reading): change the grid to six rows,
`grid-template-rows: 36px auto auto minmax(3.9in, 1fr) auto auto;`, and
insert `<p class="itp-kicker"><b>First, try this:</b> Hold your breath and
count to five.</p>` between the name row and the headline (the
`.itp-kicker` rule is already in the style block). It is one 25px line
plus its own 14px gap, so the picture drops from about 5.8in to about
5.4in (558.5 minus 39 is 519.5px). Add the track only when the kicker is
present: an empty track still takes its 14px gap and lifts the check box
off the bottom.

Fluent-reader variant: set `.itp-body` to 18px, add a fourth sentence
(four sentences of up to about 70 characters, roughly 12 words, run four
27px lines, 108px), and stack two `.itp-line` rows at 34px each (each
with its 2px rule, 72px, so the check box is 160px). Without the caption
the picture lands at about 5.4in
(912 minus 36, 37, 108, 160, and 56 of gaps leaves 515px). If the page
uses the "Did you know" caption, change the grid to six rows,
`grid-template-rows: 36px auto minmax(3.9in, 1fr) auto auto auto;`, and
insert `<p class="itp-caption">Did you know? ...</p>` between the `img`
and the body paragraph (the `.itp-caption` rule is already in the style
block, and the font link loads Andika's italic axis so it renders as real
Andika Italic). Add the sixth track only when the caption is present: an
empty track still takes its 14px gap and would lift the check box off
the bottom. With four 18px sentences, one 22px caption line, five gaps,
and the two-line check, the picture lands at about 5in (912 minus 433
leaves 479px). A kicker and a caption together make seven rows and take
the picture to about 4.6in, still above the floor.

Read-aloud variant: set `.itp-body` to 24px (about 50 characters per
line), write exactly four sentences with a bold lead-in opening each, and
rebuild the check box one of two ways. For `point-to`, replace both the
`.itp-check-q` and the `.itp-line` with the directive as the one and only
`.itp-check-q` under the label; the last-child rule drops its trailing
margin, so the box is 2 + 14 + 16 + 6 + 24 + 14 + 2 = 78px and the
picture gets 561px, about 5.8in. Never keep the written question and add
the directive as a second `.itp-check-q`: that box is
2 + 14 + 16 + 6 + 34 + 24 + 14 + 2 = 112px, the picture drops to 527px
(about 5.5in), and the page carries two prompts, which the one-check law
forbids. For `draw`, keep the `.itp-check-q` as the prompt ("Draw a
tuna") and replace `.itp-line` with an empty `<div class="itp-draw"></div>`
(a 1.6in, 153.6px bordered box), so the check box is
2 + 14 + 16 + 6 + 34 + 153.6 + 14 + 2 = 241.6px, about 242, and the
picture gets 397px, about 4.1in.

## Illustration prompt template

One generate_image call, shape landscape,
`anchorIds: ["illustrated-teaching-page"]`; swap in the page's own
subject and keep every word about text out of the picture. Choose a
subject the picture can state by itself: one thing, drawn so the claim
is visible in the thing (a leaf that is green on one half and orange on
the other), never explained by an inset, a label, an arrow, or a
callout; a cutaway with a pointer is a diagram, and
labeled-anatomy-diagram owns those. The worked example is the page
"Why do leaves change color in fall?":

```
Warm children's science illustration, ink line art, thick clean outlines,
warm brown and charcoal ink on soft cream paper, flat color, no shading,
no photorealism, no text or letters. One large maple leaf on a short
brown stem, its left half still summer green and its right half already
autumn orange, the color changing along the center vein of the same
leaf. Landscape composition; keep the whole leaf inside the middle 80% of
the frame both across and up and down, with only plain cream background
in the outer 10% on all four sides.
```

## Crop direction by variant

generate_image accepts only the five shapes square, landscape, wide,
portrait, and tall; a prose aspect ratio in the prompt is not honored.
`landscape` is 1536 by 1024, aspect 1.5. The figure frame is always
7.3in wide, so `object-fit: cover` changes direction at a frame height of
7.3 divided by 1.5, 4.87in: a frame taller than that is scaled to its
height and loses width at the left and right edges; a frame shorter than
that is scaled to its width and loses height at the top and bottom. What
each variant's figure box actually crops:

| Variant | Frame | Aspect | Cropped axis | Kept | Lost per edge |
|---|---|---|---|---|---|
| Early reader default | 7.3 x 5.82in | 1.25 | width | 83.7% | 8.2% left and right |
| Early reader with kicker | 7.3 x 5.41in | 1.35 | width | 89.9% | 5.0% left and right |
| Fluent, no caption | 7.3 x 5.36in | 1.36 | width | 90.7% | 4.6% left and right |
| Fluent with caption | 7.3 x 4.99in | 1.46 | width | 97.5% | 1.2% left and right |
| Fluent, kicker and caption | 7.3 x 4.58in | 1.59 | height | 94.2% | 2.9% top and bottom |
| Read-aloud point-to | 7.3 x 5.84in | 1.25 | width | 83.3% | 8.4% left and right |
| Read-aloud draw | 7.3 x 4.14in | 1.77 | height | 85.0% | 7.5% top and bottom |

The worst case either way is under 10% per edge, so one safe zone covers
every variant: the subject stays inside the middle 80% of the frame in
both axes, and the prompt never asks the subject to "fill the frame top
to bottom" or "edge to edge". That line is what keeps the crop from
removing the exact claim the sentences make; keep it in every prompt. Do
not switch the draw variant to `wide` (1792 by 1024, aspect 1.75) to
dodge the crop: the anchor is a landscape composition, and a 1.77 frame
on a 1.75 image still crops, just less.
