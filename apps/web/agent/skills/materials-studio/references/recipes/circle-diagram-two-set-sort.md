# Circle diagram two-set sort

Golden anchor: pass `anchorIds: ["circle-diagram-two-set-sort"]` to
generate_image so the output matches the Homa two-circle Venn sort bar
(two large equal circles in blue and brick-red with a wide lens overlap,
bold category labels outside and above each rim in the circle's color,
empty circle interiors, a light gray "neither" cue outside both circles,
a dashed item bank of ten bold number chips in two close rows, one
reasoning prompt with writing lines that carry to the bottom margin).
Write your own prompt with your own content; the anchor sets the visual
bar, not the specifics.

Two large overlapping circles (a two-circle Venn diagram), each labeled
outside its rim with one category, where the child places items, numbers,
or words into one circle only, the other circle only, the overlapping
middle (has both attributes), or outside both circles entirely (has
neither). Unlike a T-chart or column sort, the whole point of this format
is the overlap: some items genuinely belong to both categories at once,
and the child has to reason about that shared region rather than pick a
single bucket.

Great for: ages 6-9, classifying numbers by two properties at once (odd
vs. even, perfect square vs. odd, prime vs. even), sorting words or
letters by two spelling or vocabulary rules, science classification by
two traits (flies vs. swims, has fur vs. lays eggs), and any "sort by two
rules where some things qualify for both" task. A stronger fit than
classification-sorting-mat whenever an item can legitimately belong to
more than one category; classification-sorting-mat's columns are mutually
exclusive and cannot represent that overlap.

Creation path: html for a plain number, word, or letter sort (precise
circle geometry and label placement matter more than illustration); hybrid
when the items being sorted are illustrated attribute cards (animals,
characters, objects) where generate_image supplies the item art and HTML
places it in the correct region.

Design patterns (all binding for circle-diagram-two-set-sort):

- **Two large overlapping circles**, each a distinct stroke color, drawn
  with enough overlap that the shared middle region can comfortably hold
  2-3 items, not a sliver. Each circle's exclusive region should hold 3-5
  items without crowding.
- **Category label outside each circle**, near its outer edge, never
  inside the circle where it would compete with placed items
  (`font-size: 15px; font-weight: 700;`, one label per circle in that
  circle's stroke color).
- **Item bank below or beside the diagram**: the full set of items to
  place, presented once, not pre-sorted. For a fill-in-the-diagram
  version the items are blank lines or an empty grid instead, and the
  child writes or draws directly into the correct region.
- **At least one item in every region**: left-only, right-only, overlap,
  and outside-both should each have a genuine member for a given puzzle,
  so the child cannot solve it by ignoring one region. A puzzle where the
  overlap or the outside region is empty is a weaker version of the task.
- **Neutral outside space**: leave visible blank space around and between
  the circles for the "belongs to neither" items, and label it lightly
  ("neither" or leave it unlabeled with the outside boundary of the page
  implied) so the child knows outside-both is a valid, intentional answer,
  not a mistake.
- **One reasoning line at the bottom (optional)**: a short prompt such as
  "Why does it go in the middle?" for the one or two overlap items, when
  the page is meant to build the reasoning, not just test the placement.
- **No more than 9-12 total items** across both categories combined for
  this age band; more turns the reasoning task into a stamina test.

```html
<style>
  .circle-diagram { position: relative; width: 100%; max-width: 560px;
    height: 340px; margin: 12px auto 20px; }
  .circle-diagram svg { width: 100%; height: 100%; }
  .circle-label-left { position: absolute; top: 8px; left: 6%;
    font-size: 15px; font-weight: 700; color: #2f6f9e; }
  .circle-label-right { position: absolute; top: 8px; right: 6%;
    font-size: 15px; font-weight: 700; color: #b5432f; }
  .item-bank { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px;
    padding: 12px; border: 1.5px dashed var(--homa-control-boundary); border-radius: 8px; }
  .item-chip { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    padding: 6px 10px; font-size: 16px; font-weight: 600; }
  .reasoning-line { border-bottom: 2px solid var(--homa-control-boundary); min-height: 26px;
    margin-top: 14px; }
</style>

<div class="circle-diagram">
  <span class="circle-label-left">odd numbers</span>
  <span class="circle-label-right">perfect squares</span>
  <svg viewBox="0 0 400 260">
    <circle cx="150" cy="140" r="110" fill="none" stroke="#2f6f9e" stroke-width="3" />
    <circle cx="250" cy="140" r="110" fill="none" stroke="#b5432f" stroke-width="3" />
  </svg>
</div>
<div class="item-bank">
  <!-- one chip per item to place: 1, 4, 9, 5, 7, 2, 16, 3 -->
</div>
```

Two circles must actually overlap in the rendered SVG (the two `cx`
values close enough relative to their radii), never drawn side by side
touching at a single point; a diagram with no real overlap area cannot
hold a both-attributes item and defeats the format's whole purpose.
