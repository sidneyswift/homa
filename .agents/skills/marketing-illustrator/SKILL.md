---
name: marketing-illustrator
description: Generate the bundle's still images (blog hero 16:9, optional inline figures, Pinterest pin 2:3 with text overlay) via higgsfield-generate image models, constrained to Homa's Quiet authority profile and warmth. Invoked by marketing-demand-engine after copy gates pass. NOT for video or thumbnails (marketing-video-producer) and NOT for product UI screenshots (never fabricated, per claims rules).
---

# Marketing illustrator

Consistent, warm, artifact-first stills so the blog and boards read as one
brand. The design system is the constraint: `docs/homa-design/readme.md` is the
human guide and `packages/design/src/contract` is the machine contract. This
skill applies the `marketing-rich` profile to generated images. Never copy
hex values into a prompt when a semantic role names the same decision.

## Palette and mood (name roles, never raw values)

Use the contract roles: mineral canvas or paper for quiet space, visual coral
for a small Homa or roof-thread signature, midnight action only for a truthful
functional emphasis, and semantic constructive, information, highlight, or
error colors only when the image explains that state. The role definitions
live in `packages/design/src/contract/colors.ts`. Mood words that match the
brand: warm, hand-drawn, storybook, kitchen-table, morning light, gentle.
Never use corporate blue gradients, glossy stock-photo sheen, classroom clip
art, or dashboard decoration.

## Procedure

1. Read the gated article (hero illustrates its one idea) and the gated
   `pin/pin.md` (the overlay copy comes from there, already gated; never
   freehand overlay text).
2. Hero: follow the `higgsfield-generate` skill; default `gpt_image_2`,
   `--aspect_ratio 16:9`, save to `images/hero.png`. Prompt pattern:

```bash
higgsfield generate create gpt_image_2 --prompt "warm storybook illustration of <the article's one idea as a scene>, mineral canvas or paper, a restrained visual-coral Homa signature, natural morning light, hand-drawn texture, no text" --aspect_ratio 16:9 --wait
```

3. Inline figures (optional, max 1 per major section, only when a figure earns
   its place): same pattern, simpler scenes.
4. Pin: `--aspect_ratio 2:3` (1000x1500 target), and pins DO carry text: the
   pin title from `pin/pin.md` as a large legible overlay (GPT Image 2 handles
   text; verify legibility at grid size, regenerate if muddy). Save to
   `pin/pin.png`.
5. Log at the bottom of `pin/pin.md`: model, prompts, job URLs for every image.

## Hard image rules

- No real children's faces, no member family likenesses, no photos of real
  families at all in generated assets.
- No fabricated product screenshots or fake UI (claims rule; the real product
  gets real screenshots when it is ready, with founder approval).
- No text baked into hero/figures (text belongs to the page); the pin is the
  one exception and its text comes from gated copy.
- Use the same semantic roles every time; the feed reading as one brand is the
  job. The generated scene must preserve a real learning artifact or family
  detail, leave a safe zone for one useful next move, and keep any Homa mark
  subordinate to the work.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish. No family data. Voice and claims per
`marketing/voice/house-style.md`; the design system per `docs/homa-design/`.
