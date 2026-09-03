# Letter & number formation practice

Golden anchor: pass `anchorIds: ["letter-number-formation-practice"]` to
every generate_image call for this format so the output matches the Homa
formation-practice bar (warm, uncluttered, generous white space, a bold
model and an equal-size trace row that fades in support, never in size).
Write your own prompt with your own content (your own letter, your own
cue); the anchor sets the visual bar, not the specifics.

A single letter or digit practiced through its own individual strokes: a
labeled model at the top, guided trace repetitions inside a formation box,
and one independent write-it-yourself box at the end. Built for early
handwriting curricula that teach letters and numbers stroke by stroke and
group them by the shapes they share (all the letters made from a big line
and a little line together, then all the ones built from a curve), not in
alphabet or counting order.

Great for: ages 3-6, pre-K and kindergarten handwriting readiness,
multisensory or developmental handwriting curricula, pre-writing stroke
practice before real letters begin.

Always image-direct path (changed 2026-09-02; this recipe was html until
today). The prior reasoning was that box geometry, baseline placement, and
the stroke-guide dot needed to be pixel-exact and repeatable, and an image
model could not be trusted to hold that across a set the way it could not
hold a maze's number sequence. That reasoning was tested, not assumed: with
the golden anchor above passed as `referenceImageUrls` and a fully spelled
out prompt (every box, every fade step, the starting dot, the stroke-order
arrows, all stated explicitly, none left to inference), four independent
generations, two of the same letter and two of different letters, produced
trace-row boxes at identical pixel positions and identical sizes, correct
stroke-order decomposition (a genuinely correct 4-arrow breakdown for E,
not a garbled one), and a starting dot that landed in the same relative
spot every time. That is a different task from the maze's failure: an
unbroken ascending count across ten branching positions is a numeric-
sequencing problem these models are bad at; repeating one fixed visual
template with a substituted glyph and a shared reference image is not, and
did not behave like one here. Four samples across three letters is a
directional result, not a guarantee: spot-check a new letter's output
before trusting it blind, especially descenders and diagonals (g, y, k, x,
z), which were not in the tested set.

Design patterns (all binding for letter-number-formation-practice; write
every one of these into the generate_image prompt explicitly, since
nothing here is inferred by the model on its own):

- **One target per page (or one target per half-page for a two-up
  layout)**: a single capital letter, lowercase letter, or digit. Never mix
  more than one new target on a page; a review target from an earlier page
  may repeat inside the independent-write box only.
- **Model at the top**: the letter or number large and bold, inside its
  own bordered formation box, with numbered stroke-order arrows (one arrow
  per stroke) and a small green starting dot at the exact stroke-start
  point. A short one-line verbal stroke cue sits underneath in plain words,
  for example "Big line down. Little line across the top." or "Big curve,
  then a little line down." Keep the cue to the same handful of words every
  time: line, curve, big, little, up, down, across, around. Do not invent a
  new vocabulary per letter.
- **Formation box, capitals and digits**: a single bordered square with no
  interior guide line. Capitals and digits are single-story: every stroke
  reaches from the top of the box to the bottom, or stops at a marked
  midpoint for a letter like E or F.
- **Formation box, lowercase**: a bordered box divided into three bands (a
  solid top "ceiling," a dotted middle "chair rail," a solid bottom
  "floor"), since lowercase letters are two-story: tall letters (l, t, h)
  reach the ceiling, round letters (a, c, o) sit between chair rail and
  floor, and descenders (g, p, y) drop below the floor into a shallow
  fourth band. State this three-band structure explicitly in the prompt;
  do not assume the model infers it from "lowercase."
- **Trace repetitions**: exactly four bordered boxes in a row, every box
  the SAME size as the model box and as each other, never smaller. Boxes
  1-2 show a solid pale tan/gray model letter, box 3 a faint dotted outline
  only, box 4 blank except for the starting dot. Fade the support left to
  right across the row (solid, solid, dotted, blank); never fade the size.
  State the exact box count and the exact fade sequence in the prompt every
  time; do not say "fading trace boxes" and leave the count or the pattern
  to the model's judgment.
- **Size is a floor, not a target.** Once a size for the model and trace
  row has rendered acceptably, by default or by a parent confirming a fix,
  that size is a floor for every later revision of the same material. This
  applies to the embedding as much as the generation: a later fix for an
  unrelated problem (page overflow, an added activity, fitting a second
  letter) must never shrink the display size of the embedded image to make
  room, since that scales every letter and box down with it exactly like a
  font-size cut would have. Solve overflow by regenerating at a different
  aspect ratio, dropping content elsewhere on the page, or splitting onto
  another page; if nothing else closes the gap, ask the parent before
  trading size away, never trade it away silently. create_printable
  enforces this: a revision whose largest picture, text, or box measures
  more than a tenth smaller than the version it revises is refused until
  `allowSizeReduction: true` records that she asked for or agreed to it.
- **Group letters and numbers by shared strokes, not alphabet or count
  order**, when the family's curriculum specifies a teaching order (ask or
  infer it from their materials); default to straight-line letters and
  single-stroke digits first, then curved, then diagonal, when no order is
  given.
- **One small supporting activity below the trace rows (optional)**: a
  "find it" row of 4-5 letters or numbers where the child circles the
  target, or a "color the picture that starts with this sound" cue for
  letters. Keep it small; the page's job is the formation practice, not a
  second worksheet bolted on.
- **No distracting decoration.** Calm, high-contrast, and plenty of white
  space around each box so little hands are not cramped.
- **Pre-writing variant**: for a child not yet ready for real letters, the
  same box-and-fade-trace pattern works with a plain stroke shape (a
  straight line, a curve, a cross, an X) in place of a letter. Describe the
  same box geometry and the same fading trace rows in the prompt.

The reviewer's checklist for this format. create_printable reads it from
this block when you pass `recipe: "letter-number-formation-practice"`
and asks the quality check to answer every item against the rendered
page; a blocking no holds the page back as `Checklist (<id>)`.

```homa-checklist
- blocking trace-box-count: Each model box has exactly four trace boxes in one row beneath it.
- blocking trace-box-size: Every trace box is the same size as the model box, and where a letter is shown, it is as large as the model letter, never smaller.
- blocking one-target: The page practices one target (a capital and its lowercase count as one), or two targets in the recipe's two-up half-page layout, or one plain pre-writing stroke shape in place of a letter; a review target appears only in the independent write box.
- advisory model-size: The model letter or digit is big enough for a 3 to 6 year old to trace, about a quarter of the page width tall or more.
- advisory fade-order: Support fades left to right across the trace row: solid, solid, dotted, blank with a starting dot.
```

Prompt template (adapt the bracketed parts; keep every structural
instruction explicit, the way the tested prompt did):

```
Using the attached reference image as the exact style and layout guide,
build the same worksheet format for [the letter/number]. A warm, friendly
children's handwriting worksheet page, ink-line illustration style on a
soft cream/off-white background, warm brown and charcoal ink, small
decorative pencil icon and stars in the corners, no photorealism, no
shading. Header 'Letter Practice: [X]' with Name/Date lines. A large bold
black [capital letter/digit] X inside a bordered square box, with numbered
stroke-order arrows ([one arrow per stroke]) and a green starting dot. Cue
text beneath: '[stroke cue in plain words]'. Below that, a row of exactly
FOUR bordered square boxes, all the SAME size as the model box and as each
other, each containing [X] at the SAME large size as the model (never
smaller), each with its own green starting dot: boxes 1-2 solid pale
tan/gray [X], box 3 a faint dotted outline [X] only, box 4 blank except the
starting dot. [If a lowercase pass is needed:] a dashed divider, then a
'lowercase [x]' section with a three-band ruled box (solid top, dotted
middle, solid bottom) containing a bold lowercase [x], followed by a row of
four more three-band boxes at the same size showing the same
solid-solid-dotted-blank fade.
```
