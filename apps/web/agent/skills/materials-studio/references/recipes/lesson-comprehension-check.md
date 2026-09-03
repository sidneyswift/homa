# Lesson comprehension check

Golden anchor: pass `anchorIds: ["lesson-comprehension-check"]` to
generate_image so the output matches the Homa lesson-closer box bar (one
thick-outlined rounded box filling the bottom two thirds of the page,
bold "What Did You Learn?" banner over a thin rule, two numbered recall
questions each with a single solid answer line, a small uppercase Think
and Share label, a large ruled answer box reaching the bottom,
corner-only motifs). Write your own prompt with your own content; the
anchor sets the visual bar, not the specifics.

The fixed basal-textbook lesson closer: a boxed "What Did You Learn?"
(or "What Did We Learn?") that ends a taught lesson with 2 literal recall
questions plus 1 open "Think and Share" or "Write and Share" question
tied to the unit's actual target skill.

Great for: ages 6-11, any subject that ends a taught lesson or a read
passage with a quick recall-plus-application close. Confirmed as a fixed,
recurring feature box in a published elementary social studies textbook
(28 occurrences in one book), but the three-question recall-then-open
shape is genuinely subject-agnostic: it closes a science reading, a
history lesson, or a read-aloud just as cleanly.

Always html path. A short, precise box; no illustration budget needed.

Design patterns (all binding for lesson-comprehension-check):

- **Fixed three-question structure**: exactly 2 literal recall questions
  and exactly 1 open question. Never add a fourth question or drop to
  two; the fixed shape is what makes it recognizable as "the end of the
  lesson" across a bound unit.
- **Recall questions first**: phrased directly from the lesson's own
  content, answerable by remembering or re-reading what was just taught
  ("What did the pioneers use to cross the river?"). One short blank line
  each (`border-bottom: 1.5px solid var(--homa-control-boundary); min-width: 200px;`).
- **Open question last**: labeled "Think and Share" or "Write and Share"
  in the curriculum's own words, phrased to require the child's own
  reasoning, opinion, or connection tied to the lesson's actual target
  skill, never another fact lookup. Give it a larger box (3-4 blank
  lines or `min-height: 70px;`) for a dictated or written answer.
- **Boxed header banner**: "What Did You Learn?" (or the curriculum's own
  wording) in bold at the top of the box, visually distinct from the rest
  of the page (`background: var(--homa-canvas); border: 1.5px solid var(--homa-control-boundary);
  border-radius: 6px; padding: 16px;`).
- **Bottom-of-lesson placement**: sits at the end of a lesson or passage,
  either the bottom third of a longer page or its own short page.
- **No scoring, no red-pen framing**: no point values, no percent-correct
  language, nothing that grades. The box closes a lesson, it does not
  test it.
- **Reusable shell, changing content**: the box's structure never
  changes; only the two recall questions and the one open question change
  to match the lesson just taught.

```html
<style>
  .lcc-box { font-family: 'Andika', sans-serif; background: var(--homa-canvas);
    border: 1.5px solid var(--homa-control-boundary); border-radius: 6px; padding: 18px; }
  .lcc-header { font-size: 17px; font-weight: 700; color: var(--homa-ink);
    margin-bottom: 12px; }
  .lcc-question { font-size: 14px; margin-bottom: 12px; }
  .lcc-blank { border-bottom: 1.5px solid var(--homa-control-boundary); min-width: 200px;
    display: inline-block; margin-left: 6px; }
  .lcc-open-label { font-weight: 700; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.03em; color: var(--homa-control-boundary);
    margin-bottom: 6px; }
  .lcc-open-box { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    min-height: 70px; padding: 10px; }
</style>

<div class="lcc-box">
  <div class="lcc-header">What Did You Learn?</div>
  <div class="lcc-question">1. What did the pioneers use to cross the
    river?<span class="lcc-blank"></span></div>
  <div class="lcc-question">2. Why did the town build a bridge there?
    <span class="lcc-blank"></span></div>
  <div class="lcc-open-label">Think and Share</div>
  <div class="lcc-question">How would your family cross a river if there
    were no bridge nearby?</div>
  <div class="lcc-open-box"></div>
</div>
```
