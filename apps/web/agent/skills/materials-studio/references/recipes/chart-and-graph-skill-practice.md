# Chart and graph skill practice

Golden anchor: pass `anchorIds: ["chart-and-graph-skill-practice"]` to
generate_image so the output matches the Homa chart-skill practice page
bar (a small boxed worked example with a 3-bar mini graph and two
modeling sentences, one large practice bar graph with solid dark axes,
light grid lines, and 5 equal-width tan bars labeled beneath, 3
dotted-line questions filling the sheet to the bottom, cream paper with
brown ink and no decoration inside the display). Write your own prompt
with your own content; the anchor sets the visual bar, not the
specifics.

Teaches ONE concrete data-reading skill per page: read a calendar, read a
timeline, read a labeled diagram, or read a bar graph. A small worked
example models how to read the display, then the child answers 2-4
practice questions about a second, independent version of the same
display.

Great for: ages 6-10, cross-subject data literacy (math data &
statistics, science process diagrams, social studies chart-reading
lessons). This is a genuinely evergreen skill that recurs across every
subject a curriculum touches, not one subject's format: confirmed
recurring 5 times in one social studies textbook alone (Read a Calendar,
Read a Time Line, Read a Diagram, Read a Bar Graph), and the same
worked-example-then-practice shape applies just as well to a science
unit's process diagram or a math unit's bar graph.

Always html path. Grid, axis, and tick-mark precision are the point; no
illustration budget needed except for the diagram variant, which uses a
plain labeled line diagram rather than an illustrated scene (an
illustrated scene with things to find or count belongs to
spot-and-count-illustrated-scene or labeled-anatomy-diagram instead).

Design patterns (all binding for chart-and-graph-skill-practice):

- **One skill per page**: pick exactly one display type (calendar,
  timeline, bar graph, or generic diagram) and stay in it for the whole
  page. Never mix two display types on one page; that teaches neither
  skill cleanly.
- **Worked example first**: a small, already-filled-in version of the
  chosen display, paired with 1-2 sentences that model the reading move
  in the child's own vocabulary ("Look at the bar for Tuesday. It reaches
  4. That means the class read 4 books on Tuesday.").
- **Practice display second**: a second, larger version of the same
  display type with different data, sized generously for a home printer.
- **2-4 practice questions**: ordered easiest to hardest, each answerable
  directly from the practice display, with a short blank line or a
  circle-the-answer choice. Never require outside knowledge the display
  does not show.
- **Calendar variant**: a full month grid, day-of-week headers across the
  top, a handful of short event labels written into specific date cells
  (`border: 1px solid var(--homa-control-boundary); min-height: 48px;` per cell). Questions
  ask things like "What day of the week is the party on?" or "How many
  days until the field trip?"
- **Timeline variant**: a single horizontal line with evenly spaced tick
  marks, each tick labeled with a year or event directly above or below
  it. Questions ask what happened first or last, or how much time passed
  between two labeled points.
- **Bar graph variant**: a gridded bar chart with a labeled value axis
  (`border-left: 2px solid var(--homa-ink); border-bottom: 2px solid var(--homa-ink);`)
  and bars at a consistent width, each bar labeled below with its
  category. Questions ask the value of one named bar, or which of two
  named bars is larger and by how much.
- **Generic diagram variant**: a plain labeled diagram (arrows connecting
  a small number of already-labeled steps or parts, e.g. a simple weather
  or water-cycle diagram). Questions ask the child to trace or name a
  step, not to fill in a blank label; a fill-in-the-blank labeling task
  belongs to labeled-anatomy-diagram instead.
- **No decoration**: clean, ink-light B&W. Grid lines and axis lines in
  `var(--homa-control-boundary)`, labels and text in `var(--homa-ink)`. The display is the content;
  nothing else competes with it visually.
- **Rules box**: a brief instruction line at the top naming the specific
  skill this page teaches ("Reading a bar graph" or "Reading a calendar"),
  so the page is self-identifying inside a bound unit.

```html
<style>
  .cgs-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .cgs-title { font-size: 20px; font-weight: 700; color: var(--homa-ink);
    margin-bottom: 6px; }
  .cgs-worked { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    padding: 14px; margin-bottom: 20px; font-size: 14px; }
  .cgs-worked-label { font-weight: 700; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--homa-control-boundary);
    margin-bottom: 8px; }
  .cgs-bar-chart { display: flex; align-items: flex-end; gap: 16px;
    height: 160px; border-left: 2px solid var(--homa-ink);
    border-bottom: 2px solid var(--homa-ink); padding: 8px; margin-bottom: 16px; }
  .cgs-bar { width: 40px; background: var(--homa-control-boundary); border: 1.5px solid
    var(--homa-ink); border-bottom: none; }
  .cgs-bar-label { font-size: 12px; text-align: center; margin-top: 4px; }
  .cgs-questions { margin-top: 16px; }
  .cgs-question { margin-bottom: 12px; font-size: 14px; }
  .cgs-blank { border-bottom: 1.5px solid var(--homa-control-boundary); min-width: 160px;
    display: inline-block; margin-left: 6px; }
</style>

<div class="cgs-page">
  <div class="cgs-title">Reading a Bar Graph</div>
  <div class="cgs-worked">
    <div class="cgs-worked-label">Worked example</div>
    Look at the bar for Tuesday. It reaches 4. That means the class read
    4 books on Tuesday.
  </div>
  <div class="cgs-bar-chart">
    <!-- one .cgs-bar per category, height set inline per value -->
  </div>
  <div class="cgs-questions">
    <div class="cgs-question">1. How many books were read on Thursday?
      <span class="cgs-blank"></span></div>
    <div class="cgs-question">2. Which day had the fewest books read?
      <span class="cgs-blank"></span></div>
    <div class="cgs-question">3. How many more books were read on
      Wednesday than Monday?<span class="cgs-blank"></span></div>
  </div>
</div>
```
