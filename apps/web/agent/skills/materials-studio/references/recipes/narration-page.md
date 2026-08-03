# Narration page

A Charlotte Mason staple: a title/prompt header, a large open box for the
child's own illustration, and wide-ruled lines below where a parent
transcribes the child's spoken words. No answer key, no grading; the page
exists to capture what the child noticed or remembers in their own voice.

Great for: ages 4-8, Charlotte Mason narration and journaling, personal
reflection prompts (family stories, feelings, "what I want to be"),
science and nature discovery logs, one-page keepsake/portfolio entries.
The same skeleton covers a story narration, an open journal prompt, a
family-history memory page, and a weekly discovery-log entry: only the
header prompt and icon change.

Always html path. Box proportions and line spacing need to stay exact so
the illustration area and the writing area both feel generous, never
cramped.

Design patterns (all binding for narration-page):

- **Header row**: small theme icon or week tag on the left, page title on
  the right (`font-size: 20px; font-weight: 600;`). The title names the
  week's story, topic, or prompt, never a generic label like "Page 1."
- **Prompt line**: one or two sentences directly under the header, written
  TO the child in second person and phrased warmly and concretely (never
  "describe the narrative arc"; instead "What happened in the story? Or
  what was your favorite part?").
- **Illustration box**: a bordered rectangle (`border: 2px solid var(--homa-ink);`)
  taking roughly 55-60% of the page height, left blank for the child's own
  drawing. Never pre-fill it with generated art; the box is for the
  child's hand, not Homa's.
- **Dictation lines**: 6-8 wide-ruled lines below the box
  (`border-bottom: 1px solid var(--homa-control-boundary); min-height: 32px;`), for a parent to
  write down the child's spoken words. Leave them genuinely blank, no
  sentence starters unless the prompt specifically calls for one.
- **No correct answer**: this is a record of the child's own thinking, not
  a comprehension check. Never add a word bank, rubric, or scoring key.
- **Variant, calendar header**: for a science or nature discovery log,
  add a slim tracking row above the title with day-of-week circles to
  color in and a date blank, so the page doubles as a simple calendar
  entry before the open response.
- **Variant, shaped frame**: for a milestone or "my future" style prompt,
  swap the rectangular illustration box for a themed outline (heart, open
  book, cloud) sized to the same footprint; the writing lines stay
  unchanged below it.
- **Variant, split comparison**: for "compare two things" prompts, divide
  the illustration box into two equal halves side by side, each with its
  own short label and 2-3 lines directly beneath, before the shared
  dictation lines.

```html
<style>
  .narr-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .narr-header { display: flex; align-items: center; gap: 10px;
    margin-bottom: 6px; }
  .narr-icon { width: 28px; height: 28px; }
  .narr-title { font-size: 20px; font-weight: 600; color: var(--homa-ink); }
  .narr-prompt { font-size: 15px; color: var(--homa-ink); margin-bottom: 14px;
    line-height: 1.5; }
  .narr-illustration { border: 2px solid var(--homa-ink); border-radius: 4px;
    min-height: 340px; margin-bottom: 16px; }
  .narr-line { border-bottom: 1px solid var(--homa-control-boundary); min-height: 32px; }
</style>
```
