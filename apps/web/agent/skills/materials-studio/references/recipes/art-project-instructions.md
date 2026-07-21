# Art project instructions

A step-by-step hands-on art or craft page: a short materials list, then
3-6 numbered steps for making one concrete thing (a drawing, a painting,
a clay piece, a print, a woven mat, a folded-paper form, a mobile, a
mask, a puppet, an assemblage), with an optional small inspiration
thumbnail and an optional closing reflection question. The same shell
works regardless of medium; only the words and the optional image
change.

Great for: ages 5-10, formal skills-based art curricula built around the
Elements of Art and Principles of Design (line, shape, color, value,
form, texture, space; balance, emphasis, pattern, rhythm, unity,
variety), any curriculum with a recurring "make something" activity that
needs the same materials-list-plus-numbered-steps shell no matter what
the medium is that week. Also works as a bare technique-reference card
(how to mix a tint, how to make a sponge print) with no project framing
at all. The same shell also covers a published science textbook's
recurring hands-on "Investigate" activity (gather a few household
materials, follow numbered steps, observe a result), using the
skill-tip callout variant below instead of the reflection prompt. Also
covers a toddler-age parent-led activity book's own recurring shape
(ages 1-3, gather a few household or pantry items, a parent does any
setup, the child does the hands-on part), using the toddler stat-and-icon
variant below instead of the reflection prompt. And it covers a family
science-experiment book's recurring numbered-experiment page (ages 4-12,
household materials, numbered steps, observe what happens), using the
experiment fact-box variant below.

Hybrid path by default: generate_image for a small inspiration thumbnail
showing the finished example, the technique in progress, or the art
element being practiced; HTML for the materials list, numbered steps,
and reflection box. Drop the thumbnail and use html-only for the bare
technique-reference variant below.

Design patterns (all binding for art-project-instructions):

- **Title + focus tag**: the project's plain-language title, plus a
  small uppercase tag naming what it practices, for example
  "Practicing: Pattern" or "Technique: Watercolor." Keep the tag to the
  curriculum's own vocabulary (an element, a principle, or a technique
  name) rather than inventing new terms.
- **Inspiration thumbnail (optional, hybrid only)**: a small bordered
  box (`border: 2px solid #221e1a; border-radius: 6px;`) near the title
  holding a generated example of the finished piece or the technique in
  progress. Skip entirely for the bare technique-reference variant.
- **Materials list**: a short bulleted list before the steps, plain
  household language ("paper plate," "yarn or string," "found objects
  like buttons or bottle caps"), never brand names or specialty-store
  items unless the technique truly requires them.
- **Numbered steps**: 3-6 numbered steps in a vertical list
  (`.api-step` circles, `border: 2px solid #221e1a; border-radius:
  50%;`), one clear physical action per step, in plain declarative
  sentences a young reader or a parent reading aloud can follow. Where
  the source curriculum names its own phases (for example "Plan,"
  "Create," "Reflect"), use those phase words as small step-group
  labels instead of inventing new ones.
- **Reflection prompt (optional)**: one short open-ended question at
  the bottom (`border: 1.5px solid #6b6259; border-radius: 6px;
  min-height: 60px;`) with a blank box for a dictated or written answer.
  Reuse the family's own comprehension-skill vocabulary for the question
  when their curriculum ties a reading or thinking skill to that unit
  (for example a "note details" or "compare and contrast" style prompt)
  rather than always defaulting to a generic art question.
- **Technique-reference variant**: for a bare "how to do this technique"
  card that is not tied to one project or artist, drop the title's
  project framing and the reflection box entirely; keep only the
  materials list and the numbered steps, html-only, no thumbnail.
- **Skill-tip callout (optional)**: for a hands-on science investigation
  or experiment that follows this same materials-list-plus-numbered-steps
  shell (a published science textbook's "Investigate" activity, for
  example), add one small bordered tip box (`border: 1.5px solid
  #b3a492; border-radius: 6px; padding: 10px 14px; background:
  #f0ede8;`) near the last step, naming and defining the one inquiry
  skill the activity practices, for example "Science Skill: To draw a
  conclusion, use what you have observed to form an idea." Pull the
  skill name from the curriculum's own process-skills vocabulary
  (Observe, Compare, Classify, Sequence, Infer, Predict, Measure,
  Communicate, Draw Conclusions, Make Models, Gather Information, Plan)
  when the family's program names one, rather than inventing new terms.
  Skip this box entirely for art projects, where it does not apply.
- **Same shell regardless of medium**: whether the medium is drawing,
  painting, collage, clay, printmaking, weaving, paper folding, or
  assemblage from found objects, reuse the identical materials-list and
  numbered-steps template. Only the words and the optional inspiration
  image change from project to project.
- **Toddler stat-and-icon variant (optional)**: sourced directly from a
  2021 Callisto Publishing toddler science activity book, confirmed
  consistent across every one of its 6 chapters, not assumed. Add a
  short skill-icon strip above the title (3-6 small icon-plus-label
  chips naming what the activity practices, for example "fine motor
  skills," "cause and effect," "observation"; pull labels from the
  family's own curriculum vocabulary when it has one, otherwise use
  plain skill names a parent would recognize). Below the title, add a
  three-line stat block before the materials list: a messiness rating
  (1 low ink/mess to 5 highest, described in words for the parent, for
  example "Messiness: 2"), a prep time, and a separate activity time
  (the two are genuinely different: prep is what the parent does before
  the child starts, activity is the child's own hands-on time). When any
  setup must happen before the child is involved (drawing an outline,
  mixing a base color, freezing an ingredient), give it its own small
  "PREP" sub-list above the child-facing "STEPS" list rather than mixing
  parent-only steps into the numbered child steps. Use this variant for
  toddler or early-years (ages 1-4) activity content specifically; the
  plain variant above stays the default for ages 5+.
- **Experiment fact-box variant (optional)**: sourced directly from a
  2007/2010 Hinkler "365 Science Experiments" family experiment book,
  confirmed consistent across all six of its sections (astronomy, biology,
  chemistry, geology/geography, physics, weather), not assumed. For a home
  science experiment page (ages 4-12), add three things to the same
  materials-plus-steps shell: (1) a one-sentence purpose line directly
  under the title stating what the child will see or find out, in plain
  active words ("See how clay absorbs water," "Make your own gravity"),
  never a mechanism lecture; (2) one small "Did you know?" fact box
  (`border: 1.5px solid #6b6259; border-radius: 6px; padding: 10px 14px;`)
  holding a single concrete, child-facing fact connected to the experiment,
  with a real number or comparison when one exists ("the Sun is about 100
  times wider than Earth"); this box is different from the skill-tip
  callout, which names an inquiry skill, and a page may carry either or
  both; (3) a short safety-and-setting line above the materials list naming
  the supervision level and setting in plain words ("Do this outside, with
  a grown-up for the hot water step"), pulled from what the steps actually
  require, never boilerplate. Where the experiment has no fixed outcome,
  end the final step on an observation question ("Which one lands first?"
  "What do you notice after a week?") instead of announcing the result,
  so the child observes before being told.

```html
<style>
  .api-page { font-family: 'Andika', sans-serif; padding: 24px; }
  .api-tag { display: inline-block; font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em; color: #6b6259;
    margin-bottom: 6px; }
  .api-title { font-size: 26px; font-weight: 700; color: #221e1a;
    margin-bottom: 12px; }
  .api-thumb { border: 2px solid #221e1a; border-radius: 6px;
    width: 140px; height: 140px; float: right; margin: 0 0 12px 16px; }
  .api-materials { border: 1.5px solid #b3a492; border-radius: 6px;
    padding: 12px 16px; margin-bottom: 16px; background: #f0ede8; }
  .api-step { display: flex; gap: 12px; align-items: flex-start;
    margin-bottom: 12px; }
  .api-step-num { flex-shrink: 0; width: 28px; height: 28px;
    border: 2px solid #221e1a; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; font-weight: 700; }
  .api-reflection { border: 1.5px solid #6b6259; border-radius: 6px;
    padding: 14px; min-height: 60px; margin-top: 16px; font-size: 14px; }
  .api-skill-strip { display: flex; gap: 8px; margin-bottom: 10px; }
  .api-skill-chip { border: 1.5px solid #6b6259; border-radius: 6px;
    padding: 6px 8px; font-size: 11px; font-weight: 600; text-align: center;
    color: #6b6259; }
  .api-stat-block { font-size: 13px; color: #6b6259; margin-bottom: 10px;
    line-height: 1.6; }
  .api-prep { border: 1.5px dashed #b3a492; border-radius: 6px;
    padding: 10px 14px; margin-bottom: 14px; background: #f6f4f0; }
</style>
```
