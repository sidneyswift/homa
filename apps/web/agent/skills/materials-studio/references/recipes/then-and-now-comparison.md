# Then and now comparison

A two-panel page that compares something from the past against the same
thing today: a "Then" (or "Long Ago" / "First") panel and a "Now" (or
"Today") panel, each with a small illustration and a one- or two-sentence
caption, plus a short reflection question at the bottom asking the child
to name what changed. Recurs across published elementary social studies
and science curricula whenever the lesson compares communities, tools,
toys, chores, transportation, or national symbols across time, and works
just as well for a science curriculum's "how this animal or tool has
changed" pages.

Great for: ages 5-9, social studies units on communities and how they
change, history-adjacent "long ago and today" comparisons, science units
comparing an early version of a tool or invention to its modern form,
any curriculum with a recurring "then and now," "long ago and today," or
"first and now" feature box.

Hybrid path preferred: generate both time periods as one split
illustration in a single generate_image call (or reuse family photos when
the family supplies them). HTML owns the panel frames, labels, captions,
and reflection box. Never make a separate image call per panel. Html-only
works when the comparison is text-and-caption only with no illustration.

Design patterns (all binding for then-and-now-comparison):

- **Two-panel layout**: side by side on a wide page, stacked on a
  narrow one. Equal-size bordered panels (`border: 2px solid var(--homa-ink);
  border-radius: 6px;`), never one panel visually larger than the
  other, so neither time period reads as more important.
- **Panel labels**: a short label above each panel in the curriculum's
  own words ("Then" / "Now", "Long Ago" / "Today", "First" / "Now"),
  bold, uppercase, small (`font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em;`).
- **One illustration per panel**: a simple, clean illustration (or a
  family-supplied photo) showing the object, place, or activity at that
  time period. Keep the same subject in both panels (the same kind of
  toy, the same community, the same tool) so the comparison is visible
  at a glance, not two unrelated pictures.
- **One caption per panel**: one or two short declarative sentences
  below each illustration, plain language a young reader can follow.
- **Divider**: a vertical rule between side-by-side panels
  (`border-left: 2px dashed var(--homa-control-boundary);`), or a horizontal rule between
  stacked panels, never a jarring color break.
- **Reflection question**: one short open-ended prompt at the bottom
  (`border: 1.5px solid var(--homa-control-boundary); border-radius: 6px; min-height: 60px;
  padding: 12px;`) asking the child to name what changed or why,
  reusing the curriculum's own comparison-skill vocabulary ("alike and
  different," "compare") when it names one, with a blank space for a
  dictated or written answer.
- **Name/date header** at top of page.

```html
<style>
  .tnc-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .tnc-title { font-size: 24px; font-weight: 700; color: var(--homa-ink);
    margin-bottom: 16px; }
  .tnc-panels { display: flex; gap: 0; border: 2px solid var(--homa-ink);
    border-radius: 6px; overflow: hidden; }
  .tnc-panel { flex: 1; padding: 16px; }
  .tnc-panel + .tnc-panel { border-left: 2px dashed var(--homa-control-boundary); }
  .tnc-label { font-size: 13px; font-weight: 700; text-transform:
    uppercase; letter-spacing: 0.04em; color: var(--homa-control-boundary);
    margin-bottom: 8px; text-align: center; }
  .tnc-image { width: 100%; aspect-ratio: 1 / 1; border: 1.5px solid
    var(--homa-control-boundary); border-radius: 6px; margin-bottom: 10px; }
  .tnc-caption { font-size: 15px; color: var(--homa-ink); text-align: center; }
  .tnc-reflection { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    padding: 14px; min-height: 60px; margin-top: 18px; font-size: 14px; }
</style>
```
