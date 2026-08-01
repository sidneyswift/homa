# Comic narrative math page

A page formatted as a short comic strip: 2-4 sequential panels where one or
two simple illustrated characters trade short speech-bubble dialogue that
walks through a concept conversationally, ending in a visually separated
"stop and try it" box holding a question tied directly to what the
characters just discussed. The story panels ARE the lesson, not a caption
under one; the child learns the idea by reading the exchange, then answers
a question that reuses the same scenario.

Great for: ages 4-8, any curriculum or family request that wants a concept
taught through character and story rather than direct instruction, making
an abstract idea concrete through a relatable everyday scene (two kids
comparing snack sizes, counting stairs on the walk to school, splitting a
shape while building a fort), and re-engaging a child who finds a bare
instruction line easy to skim past. Works across subjects, not just math:
the same shape teaches a science observation or a social-emotional beat
through the same two-characters-talking-it-through structure.

Hybrid path: generate the complete 2-4 panel visual sequence in one image,
with consistent characters, empty speech-bubble areas, and no text. HTML
owns the panel frame, speech bubbles, dialogue, and closing question box.
Never make a separate image call per panel. Precise bubble placement and
tail direction need HTML control; the characters and setting need
illustration quality a CSS shape cannot deliver.

Design patterns (all binding for comic-narrative-math-page):

- **Original characters only, never a franchise's**: describe the
  character(s) visually in the generate_image prompt (species or kind,
  outfit, colors, one or two props) exactly as the "Working with
  generate_image" section of this skill directs; never name or draw a
  copyrighted character or mascot, including any specific published
  curriculum's own characters. Optionally cast the actual child as one
  character using their `photoUrl` per "Drawing the child from their
  photo" above, which reads as a stronger personalization than an
  invented character when a photo is available.
- **Keep characters visually consistent panel to panel**: describe the
  colors, outfit, and props once for the complete strip so the same call
  renders the same character across every panel.
- **2-4 panels**, bordered (`border: 2px solid #221e1a; border-radius:
  8px;`), read left-to-right then top-to-bottom (a 2x2 grid) or as a
  single top-to-bottom column on a narrow layout. Never more than 4: this
  is a short beat, not a full story.
- **One idea per panel**: each panel advances the scene by one small step
  (notice something, ask a question, try an idea, reach the insight).
  Never cram two ideas into one panel's dialogue.
- **Speech bubbles carry the content**: rounded shape with a small
  triangular tail pointing at the speaker, short plain sentences (one to
  two per bubble), and the math or science idea itself is discussed IN
  the dialogue, never stated afterward as a separate caption.
- **Closing "stop and try it" box**: visually distinct from the panels
  (different background tint, `border: 3px solid #2f6f4f;`) directly
  below the strip, holding one question that reuses the same characters
  or scenario the child just read about. Never a generic worksheet
  question unconnected to the story.
- **Optional response space** under the closing box when the page is
  meant to be written on directly: a blank line, a small box, or (for a
  counting/drawing answer) an empty illustration-sized area.
- **No answer key text anywhere on the page itself.**

```html
<style>
  .comic-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    margin-bottom: 20px; }
  .comic-panel { border: 2px solid #221e1a; border-radius: 8px;
    overflow: hidden; position: relative; background: #fff; }
  .comic-panel img { width: 100%; display: block; }
  .speech-bubble { position: absolute; background: #fff;
    border: 2px solid #221e1a; border-radius: 16px; padding: 8px 12px;
    font-size: 14px; font-weight: 600; max-width: 70%; }
  .speech-bubble::after { content: ""; position: absolute; width: 0;
    height: 0; border: 10px solid transparent; }
  .speech-bubble.tail-left::after { left: 16px; bottom: -18px;
    border-top-color: #221e1a; }
  .try-it-box { border: 3px solid #2f6f4f; border-radius: 10px;
    background: #eaf5ee; padding: 16px 18px; margin-top: 8px; }
  .try-it-label { font-size: 13px; font-weight: 700; color: #2f6f4f;
    text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .try-it-question { font-size: 17px; font-weight: 600; color: #221e1a; }
</style>
```
