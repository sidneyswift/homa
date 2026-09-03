# Biography timeline page

Golden anchor: pass `anchorIds: ["biography-timeline-page"]` to
generate_image so the output matches the Homa biography timeline bar
(one solid horizontal timeline arrow running through six identical tall
rounded event boxes, a charcoal year pill at the top of each box, a
square line-art illustration frame with one light color accent below it,
a one-sentence caption beneath, a bold full-name title banner with a
Name line, cream paper with warm brown ink). Write your own prompt with
your own content; the anchor sets the visual bar, not the specifics.

A chronological strip of 5-8 labeled event boxes, each pairing a year or
age with a one-line event and a small illustration, so a child can see a
real person's life, or a real invention's development, unfold in order
from left to right (or top to bottom on a narrow page).

Great for: ages 6-10, biography study of an artist, composer, inventor,
scientist, or other historical figure, and any curriculum that wants the
progression of a technology or invention shown rather than told. Recurred
independently across three Getting to Know biography drops this session
(artists, composers, inventors and scientists), each wanting the same
event-box-and-connecting-line shape with different subject matter.

Hybrid path preferred: generate one continuous strip containing all
event vignettes in chronological order, with no words or dates. HTML owns
the boxes, connecting line, dates, and labels. Never make a separate image
call per event. Html-only works when the events are text-and-caption only.

Design patterns (all binding for biography-timeline-page):

- **Two modes, one shared shell**: the timeline strip, event-box shape,
  and connecting line are identical in both modes; only what fills the
  year label and caption changes.
  - **Life-events mode** (default): the sequence follows the studied
    person's own real biographical milestones (birth, a childhood turning
    point, the achievement they are known for, a later-life event, their
    legacy or death), title banner carries the person's name.
  - **Invention-progression mode**: the sequence follows the invention or
    technology's own timeline instead of a person's life (for example
    "1876: first telephone," "1890s: switchboard exchanges," "Today:
    smartphones"), title banner names the invention or technology being
    traced, not a person. Use this mode whenever the curriculum's own
    material is about how a thing changed over time rather than what one
    person did.
- **5-8 event boxes**: never fewer than 5 (too thin to read as a
  timeline) or more than 8 (crowds a home-printed page). Each box holds
  a bold year-or-age label, one short declarative sentence, and a small
  illustration frame.
- **Connecting line**: a single line or arrow running through every box
  in order, so the eye reads left-to-right (or top-to-bottom) as forward
  time, never a loop or a branch.
- **Strict chronological order**: events appear in the order they
  happened, using only dates or ages the source material actually states.
  Never invent a date to fill a gap; if the source only says "as a young
  man," write that instead of fabricating a year.
- **Title banner**: the person's full name (life-events mode) or the
  invention/technology's name (invention-progression mode), large and
  bold at the top of the page.
- **Consistent box sizing**: every event box is the same size and shape
  regardless of how much text or art it holds, so no single event reads
  as more important than another.
- **Orientation by event count**: a horizontal strip for 5-6 events on a
  landscape or wide page; a vertical stack for 7-8 events or a portrait
  page, so boxes never shrink below a readable size.

```html
<style>
  .bio-timeline { font-family: 'Andika', sans-serif; padding: 24px; }
  .bio-title { font-size: 26px; font-weight: 700; color: var(--homa-ink);
    margin-bottom: 20px; text-align: center; }
  .bio-strip { display: flex; align-items: flex-start; gap: 0;
    position: relative; }
  .bio-strip::before { content: ""; position: absolute; top: 54px;
    left: 4%; right: 4%; height: 3px; background: var(--homa-control-boundary); z-index: 0; }
  .bio-event { flex: 1; display: flex; flex-direction: column;
    align-items: center; padding: 0 8px; position: relative; z-index: 1; }
  .bio-year { background: var(--homa-ink); color: #fff; font-weight: 700;
    font-size: 13px; border-radius: 999px; padding: 4px 12px;
    margin-bottom: 10px; }
  .bio-image { width: 100%; aspect-ratio: 1 / 1; border: 2px solid
    var(--homa-ink); border-radius: 6px; margin-bottom: 8px; }
  .bio-caption { font-size: 13px; color: var(--homa-ink); text-align: center;
    line-height: 1.35; }
</style>

<div class="bio-timeline">
  <div class="bio-title">Alexander Graham Bell</div>
  <div class="bio-strip">
    <div class="bio-event">
      <div class="bio-year">1847</div>
      <div class="bio-image"></div>
      <div class="bio-caption">Born in Edinburgh, Scotland, into a family
        who taught elocution and speech.</div>
    </div>
    <div class="bio-event">
      <div class="bio-year">1870s</div>
      <div class="bio-image"></div>
      <div class="bio-caption">Taught deaf students in Boston and
        invented "visible speech" to show how sounds are made.</div>
    </div>
    <!-- 3-6 more bio-event blocks in strict chronological order -->
  </div>
</div>
```

For invention-progression mode, keep the same markup and swap the title
to the invention's name and each `bio-year` label to the invention's own
milestone years, never a person's age.
