---
name: homa-make-coloring-pages
description: Generate printable coloring pages for the child. Use when asked to create a coloring page, coloring sheet, or line art for printing. Also use for coloring-style worksheets or activity sheets with outlines to color in.
---

# Coloring Page Generation

> **Read `content/learners/<child>/what-works.md` FIRST.** It's the personalization model — the child's interests/hooks (Paw Patrol, frogs), how he learns (hands-on, character-carried, immersive; few worksheets), and what's landed. Let it shape this output: pick the hook, the modality, and the framing the child actually engages with — not the obvious default. A generic suggestion that ignores it is the exact friction the parent flagged (transcript 2026-06-28).

> **FILE OUTPUT TO THE BINDER.** The finished PDF MUST be saved under `content/curriculum/<subject>/worksheets/<artifact-name>/` (subject = the matching subject; e.g. `content/curriculum/art-creative/worksheets/`), NOT to root `output/`. The binder is the parent's frontend — root `output/` gets lost in Slack (her #1 pain, transcript 2026-06-28). Pick the subject folder from `content/curriculum/` (art-creative, literacy, math, phonics, science, spanish, social-studies, writing-fine-motor, self-care-independence). Still deliver to Slack + print as asked.

Generate clean black-and-white line art coloring pages.

## Two Modes

### 1. Photo → Coloring Page (PREFERRED when a photo is provided)

When the parent gives you a photo to turn into a coloring page, use **Nano Banana Pro Edit**. This converts the actual photo into line art, preserving real faces, poses, and details — not a generic cartoon.

**Steps:**

1. Download the photo from Slack
2. Upload to fal storage via Python client:
   ```python
   import fal_client, os
   os.environ['FAL_KEY'] = os.environ.get('FAL_API_KEY', '')
   image_url = fal_client.upload_file('/path/to/photo.jpg')
   ```
3. Call Nano Banana Pro Edit:
   ```bash
   curl -s -X POST "https://fal.run/fal-ai/nano-banana-pro/edit" \
     -H "Authorization: Key $FAL_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "image_urls": ["<uploaded_fal_url>"],
       "prompt": "Convert this photograph into a black and white line art coloring page, bold clean black outlines on pure white background, preserve the exact facial features, expressions, hair, and clothing of all people, realistic portrait line drawing style, no shading, no gray tones, no color fill, printable coloring book page. Do not include any text, words, letters, titles, or captions.",
       "output_format": "jpeg",
       "num_images": 1
     }'
   ```

**Key:** `image_urls` is an array (not `image_url`). The model edits the actual image rather than generating from a text description.

**Why this matters:** NB2 text-to-image generates generic people that don't look like the actual photo subjects. Pro Edit preserves the real likeness. the parent specifically requested this workflow (2026-05-05).

### 2. Subject → Coloring Page (when no photo is provided)

For imagined scenes (animals, vehicles, characters), use **Nano Banana 2** text-to-image.

**Base prompt template:**

```
Simple black and white coloring page for a young child, bold thick black outlines on pure white background, no shading, no gray tones, no color, no fill, large simple shapes, [SUBJECT DESCRIPTION], clean line art, printable coloring book style. Do not include any text, words, letters, titles, or captions in the image.
```

**What works well:**
- Animals (turtle, flamingo, cat, butterfly)
- Vehicles (rocket, car, train)
- Simple scenes (park, beach, garden)
- Art-style mashups (Mondrian + animals = grid sections to color)
- the child's interests: Paw Patrol characters, space/rockets, magnets

**API call:**

```python
payload = {
    "prompt": prompt,
    "aspect_ratio": "1:1",      # square works best for coloring pages
    "output_format": "jpeg",
    "resolution": "1K",
    "num_images": 1,
}
# POST to https://fal.run/fal-ai/nano-banana-2
```

**Settings:**
- **Aspect ratio:** `1:1` for single-subject pages, `3:4` portrait if it needs more vertical space
- **Model:** Nano Banana 2 for text-to-image — never Flux
- Square format prints well centered on letter paper

## Quality Checklist

Before delivering, verify:
- Pure black lines on white — no gray shading crept in
- Lines are thick enough for a 3-year-old to color inside
- No text artifacts in the image
- Simple enough — not too many tiny details
- Subject is recognizable and appealing to a toddler

## Delivery

- Upload the image directly to Slack (JPEG is fine — no PDF needed for single pages)
- Offer to print immediately
- For multi-page sets, combine into a single PDF

## Prompt Tips

- "Bold thick black outlines" is the key phrase — without it NB2 adds shading
- "Pure white background" prevents gray/textured backgrounds
- "Large simple shapes" keeps it toddler-appropriate
- Adding "no shading, no gray tones, no color, no fill" as explicit negatives helps
- If results come back with gray fills, add "completely empty inside the outlines, ready to be colored in"
- For Mondrian-style: "geometric grid divided into large rectangular sections with bold black lines, [animal] outline in center"

## Past Successes

- Mondrian butterfly grid — worked great, the parent loved it
- Turtle coloring page
- Gymnastics cat
- Magnet animals
- Astronaut + moon (space theme)
