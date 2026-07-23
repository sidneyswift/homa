# Letter & number formation practice

A single letter or digit practiced through its own individual strokes: a
labeled model at the top, guided trace repetitions inside a lined
"formation box," and one independent write-it-yourself box at the end.
Built for early handwriting curricula that teach letters and numbers stroke
by stroke and group them by the shapes they share (all the letters made
from a big line and a little line together, then all the ones built from a
curve), not in alphabet or counting order.

Great for: ages 3-6, pre-K and kindergarten handwriting readiness,
multisensory or developmental handwriting curricula, pre-writing stroke
practice before real letters begin.

Always html path. The box height, baseline placement, and stroke-guide dot
must be exact and repeatable across every letter and number in a set.

Design patterns (all binding for letter-number-formation-practice):

- **One target per page (or one target per half-page for a two-up
  layout)**: a single capital letter, lowercase letter, or digit. Never mix
  more than one new target on a page; a review target from an earlier page
  may repeat inside the independent-write box only.
- **Model at the top**: the letter or number large and bold
  (`font-size: 84px; font-weight: 700;`) inside its own formation box (see
  below), with a short one-line verbal stroke cue underneath in plain
  words, for example "Big line down. Little line across the top." or "Big
  curve, then a little line down." Keep the cue to the same handful of
  words every time: line, curve, big, little, up, down, across, around. Do
  not invent a new vocabulary per letter.
- **Formation box, capitals and digits**: a single rectangle
  (`border: 2px solid #221e1a; height: 96px;`) with no interior guide line.
  Capitals and digits are single-story: every stroke reaches from the top
  of the box to the bottom, or stops at a marked midpoint for a letter like
  E or F.
- **Formation box, lowercase**: a three-band box (a solid top border for
  the "ceiling," a dotted border at the vertical midpoint for the "chair
  rail," and a solid bottom border for the "floor"), since lowercase
  letters are two-story: tall letters (l, t, h) reach the ceiling, round
  letters (a, c, o) sit between chair rail and floor, and descenders (g, p,
  y) drop below the floor into a shallow fourth band.
- **Trace repetitions**: 4-6 boxes in a row, a pale gray model letter in
  the first 2-3 (`color: #c9c2b8;`), a faint dotted outline in the next
  1-2, then one or two fully blank boxes for independent writing with no
  model at all. Fade the support left to right across the row, never all
  at once.
- **Starting dot**: a small green dot at the exact stroke-start point of
  the model letter, matching the tracing-guide starting-dot convention
  used elsewhere in materials-studio.
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
  straight line, a curve, a cross, an X) in place of a letter. Use the same
  box geometry and the same fading trace rows.

```html
<style>
  .lf-page { font-family: 'Andika', sans-serif; padding: 24px; text-align: center; }
  .lf-model { font-size: 84px; font-weight: 700; color: #221e1a; }
  .lf-cue { font-size: 15px; color: #6b6259; margin: 4px 0 20px; }
  .lf-box-capital { display: inline-block; width: 96px; height: 96px;
    border: 2px solid #221e1a; border-radius: 4px; margin: 0 6px;
    position: relative; }
  .lf-box-lowercase { display: inline-block; width: 96px; height: 128px;
    border-top: 2px solid #221e1a; border-bottom: 2px solid #221e1a;
    margin: 0 6px; position: relative; }
  .lf-chair-rail { position: absolute; left: 0; right: 0; top: 64px;
    border-top: 2px dotted #a39c8f; }
  .lf-model-pale { color: #c9c2b8; font-size: 64px; line-height: 96px; }
  .lf-start-dot { position: absolute; top: 6px; left: 6px; width: 6px;
    height: 6px; border-radius: 50%; background: #4f9d5e; }
</style>
```
