# Nature observation journal

A recurring nature-notebook entry that records the child's OWN outdoor
discovery, never Homa-supplied reference art. Distinct from
`nature-identification-poster` (a Homa-illustrated wall reference showing
many species at once): this is a personal weekly log page, mostly blank,
that the child fills in with their own drawing and words after time
outside.

Great for: ages 4-10, Charlotte Mason nature study, outdoor observation
journals, seasonal nature walks, wildlife and specimen logging, garden
and tree observation over a school year.

Always html path. Box and line geometry need to stay precise so the
child's drawing space is genuinely spacious, but the content itself
(the drawing) is added by hand after printing, so no image generation is
needed for the page body.

Design patterns (all binding for nature-observation-journal, pick ONE
variant per page based on the week's topic):

- **Header row** (every variant): a paw-print or leaf icon, "Week ___"
  and a date blank, plus a short title naming the week's topic ("Rabbits
  & Hares," "A Night Walk").
- **Variant A, choice profile**: a short checklist of 2-4 candidate
  species or subjects down the left side (empty circle + name, for the
  child to circle which one they observed or chose), with 4-5 note lines
  beside each. Below, one large bordered illustration box
  (`border: 2px solid var(--homa-ink);`) for the child's drawing.
- **Variant B, five-senses log**: four short prompt rows down the left
  ("I see...", "I hear...", "I smell...", "I feel..."), each with 1-2
  lines beside a large illustration box on the right, plus a small
  circular frame near the bottom captioned "Attach a leaf, feather, or
  specimen here."
- **Variant C, compare two**: the page split into two equal halves, each
  half with its own small illustration box, a label above it, and 3-4
  note lines below it, for comparing two related animals, plants, or
  objects side by side.
- **Variant D, open discovery**: a single large illustration box filling
  most of the page, with a short prompt line above ("What I observed
  today...") and 4-5 dictation lines below it. Use this for anything that
  does not fit the other three shapes (a night walk, an underground-home
  sketch, a "what I heard" page).
- **Never multiple choice with one right answer**: every field is open
  observation, not a quiz. Notes and drawings record what the child
  actually saw, not a lookup answer.
- **Ink-light**: line art and thin borders only; the page should still
  read cleanly if printed in grayscale.

```html
<style>
  .nj-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .nj-header { display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px; font-size: 14px; color: var(--homa-control-boundary); }
  .nj-title { font-size: 20px; font-weight: 600; color: var(--homa-ink);
    margin-bottom: 12px; }
  .nj-illustration { border: 2px solid var(--homa-ink); border-radius: 4px;
    min-height: 260px; }
  .nj-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .nj-line { border-bottom: 1px solid var(--homa-control-boundary); min-height: 26px; }
  .nj-specimen-circle { border: 2px dashed var(--homa-control-boundary); border-radius: 50%;
    width: 120px; height: 120px; display: flex; align-items: center;
    justify-content: center; text-align: center; font-size: 11px;
    color: var(--homa-control-boundary); padding: 8px; }
</style>
```
