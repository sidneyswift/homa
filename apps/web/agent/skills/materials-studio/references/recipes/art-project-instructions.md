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
at all.

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
- **Same shell regardless of medium**: whether the medium is drawing,
  painting, collage, clay, printmaking, weaving, paper folding, or
  assemblage from found objects, reuse the identical materials-list and
  numbered-steps template. Only the words and the optional inspiration
  image change from project to project.

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
</style>
```
