---
name: marketing-illustrator
description: Generate the bundle's still images (blog hero 16:9, optional inline figures, Pinterest pin 2:3 with text overlay) via higgsfield-generate image models, constrained to Homa's design system palette and warmth. Invoked by marketing-demand-engine after copy gates pass. NOT for video or thumbnails (marketing-video-producer) and NOT for product UI screenshots (never fabricated, per claims rules).
---

# Marketing illustrator

Consistent, warm, on-palette stills so the blog and boards read as one brand.
The design system is the constraint: `docs/homa-design/` owns the look, this
skill applies it to generated images.

## Palette and mood (bake into every prompt)

Homa's tokens (from `docs/homa-design/tokens/`, hand-copied hexes): warm cream
stone `#FBF7F0` / `#F3ECE1`, clay coral `#E7602F` / `#F1793F`, sage green
`#3D9A50` / `#7CC689`, sunshine gold `#FFD43B`, sky aqua `#4FB4D6`, deep navy
`#23304F`. Mood words that match the brand: warm, hand-drawn, storybook,
kitchen-table, morning light, gentle. Never: corporate blue gradients, glossy
stock-photo sheen, classroom clip art, dashboards.

## Procedure

1. Read the gated article (hero illustrates its one idea) and the gated
   `pin/pin.md` (the overlay copy comes from there, already gated; never
   freehand overlay text).
2. Hero: follow the `higgsfield-generate` skill; default `gpt_image_2`,
   `--aspect_ratio 16:9`, save to `images/hero.png`. Prompt pattern:

```bash
higgsfield generate create gpt_image_2 --prompt "warm storybook illustration of <the article's one idea as a scene>, cream background #FBF7F0, clay coral and sage green accents, soft morning light, hand-drawn texture, no text" --aspect_ratio 16:9 --wait
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
- Same palette every time; the feed reading as one brand is the job.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish. No family data. Voice and claims per
`marketing/voice/house-style.md`; the design system per `docs/homa-design/`.
