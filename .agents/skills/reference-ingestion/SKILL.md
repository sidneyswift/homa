---
name: reference-ingestion
description: Analyze reference materials (worksheets, activities, printables) dropped in #homa-inspo by Aless or Carolyng. Extract structured analysis along five dimensions, store as JSON, cross-reference against materials-studio recipes, update taste signals, and reply with a teach-me-explainer breakdown that gives the non-technical user vocabulary for what they like.
---

# Reference Ingestion

## When to use

A reference material (worksheet image, activity PDF, educational printable, screenshot) lands in the **#homa-inspo** Slack channel from Aless or Carolyng. Your job: analyze it, catalog it, detect gaps, update taste, and reply with a structured breakdown that teaches the dropper *why* they like it.

## Workflow

### 1. Identify the reference

- Note who dropped it (Aless or Carolyng) — this matters for taste signals.
- Determine the format: worksheet, coloring page, flash card, activity page, poster, game board, other.
- Assign an id: `ref-<YYYY-MM-DD>-<short-slug>` (e.g. `ref-2026-07-12-dino-counting-mat`).

### 2. Analyze along five dimensions

#### A. Layout

| Attribute | What to capture |
|---|---|
| Structure | grid, freeform, sectioned, linear-top-to-bottom |
| Spacing | dense, airy, mixed |
| Visual hierarchy | what dominates the page (activity area, illustration, title, instructions) |
| White space ratio | approximate percentage |
| Flow direction | top-down, left-right, center-out |

#### B. Skill targeting (map to Homa taxonomy)

Map to the three-level taxonomy: **subject → domain → topic**.

- Subject: e.g. `math`, `ela`, `science`
- Domain: e.g. `counting-cardinality`, `letter-knowledge` (use `TaxonomyDomain.id`)
- Topic: e.g. `math.count-objects-1-10` (use `TaxonomyTopic.id` bank convention `<subject>.<slug>`)
- Topic kind: `conceptual`, `procedural`, `representational`, `language`, `meta`
- If the reference targets something not in the taxonomy, flag it as `unmapped` with a suggested slug.

#### C. Difficulty calibration

| Attribute | What to capture |
|---|---|
| Age band | estimated months range, e.g. `[36, 60]` |
| Complexity | single-skill, multi-skill, layered |
| Prerequisites | list of Homa topic ids the child should have before this |
| Scaffolding level | high (guided), medium (some support), low (independent) |

#### D. Theming

| Attribute | What to capture |
|---|---|
| Theme type | character-driven, neutral, seasonal, interest-led |
| Characters | named characters or archetypes present |
| Visual style | cartoon, realistic, minimalist, hand-drawn, clip-art |
| Color palette | full-color, black-and-white, limited palette |
| Appeal drivers | what makes it visually engaging (cute factor, action, detail density) |

#### E. Print format

| Attribute | What to capture |
|---|---|
| Page size | letter, A4, half-sheet, custom |
| Orientation | portrait, landscape |
| Margins | generous, standard, tight |
| Ink density | light (parent-friendly), medium, heavy |
| Color requirement | prints well in B&W, needs color, color optional |

### 3. Store the analysis

Write to `.cosmo/references/<id>.json`:

```json
{
  "id": "ref-2026-07-12-dino-counting-mat",
  "droppedBy": "aless",
  "droppedAt": "2026-07-12T14:30:00-04:00",
  "sourceChannel": "homa-inspo",
  "sourceMessageTs": "1784229811.234149",
  "format": "worksheet",
  "title": "Dinosaur Counting Mat (1-10)",
  "layout": {
    "structure": "grid",
    "spacing": "airy",
    "visualHierarchy": "illustration-dominant",
    "whiteSpaceRatio": 0.35,
    "flowDirection": "top-down"
  },
  "skillTargeting": {
    "subject": "math",
    "domain": "counting-cardinality",
    "topics": [
      {
        "id": "math.count-objects-1-10",
        "kind": "procedural",
        "mapped": true
      }
    ],
    "unmappedSkills": []
  },
  "difficulty": {
    "ageBandMonths": [36, 60],
    "complexity": "single-skill",
    "prerequisites": ["math.rote-count-1-10"],
    "scaffolding": "medium"
  },
  "theming": {
    "themeType": "interest-led",
    "characters": ["cartoon dinosaurs"],
    "visualStyle": "cartoon",
    "colorPalette": "full-color",
    "appealDrivers": ["cute factor", "kid-favorite subject"]
  },
  "printFormat": {
    "pageSize": "letter",
    "orientation": "portrait",
    "margins": "standard",
    "inkDensity": "medium",
    "colorRequirement": "prints well in B&W"
  },
  "recipeMatch": {
    "matchedRecipes": ["counting-mat"],
    "gaps": []
  },
  "notes": "Clean layout. Good balance of illustration and exercise space."
}
```

Update the manifest at `.cosmo/references/index.json`:

```json
{
  "references": [
    {
      "id": "ref-2026-07-12-dino-counting-mat",
      "title": "Dinosaur Counting Mat (1-10)",
      "droppedBy": "aless",
      "droppedAt": "2026-07-12T14:30:00-04:00",
      "subject": "math",
      "domain": "counting-cardinality",
      "format": "worksheet"
    }
  ]
}
```

If `index.json` already exists, append to the `references` array.

### 4. Generate Homa-style reference image

Never store copyrighted originals in the repo. Instead, transform the
reference into a Homa-style example that captures the structural patterns
in Homa's own design language.

**Process:**

1. If the reference is a PDF, extract only the actual worksheet/material
   pages (skip cover pages, terms of use, alignment charts, ads). Use
   pymupdf (`import fitz`) to render the key pages as PNGs at 2x zoom
   for clean detail.
2. **Pass the extracted page images as visual references** to gpt-image-2
   alongside your prompt. The model can *see* the original layout —
   panel structure, spacing, fold geometry, visual hierarchy — and
   produce a far more accurate Homa-style version than text description
   alone. Use the OpenAI images API with the extracted PNGs as input
   images (base64-encoded).
3. Write a gpt-image-2 prompt that describes **what to keep and what to
   change**. The prompt steers the model away from copying copyrighted
   content while preserving structural patterns:
   - Keep: layout structure, panel geometry, spacing ratios, visual
     hierarchy, element placement, fold lines, section organization
   - Change: subject/topic (use a different one), all text content,
     characters (use Homa's design language), branding (none), color
     palette (Homa's warm playful palette)
   - Example prompt: "Using the reference image as a structural guide,
     create a Homa-style [format] for [different topic]. Keep the same
     panel layout, fold geometry, and spacing. Replace all text with
     [new content]. Use Fredoka font style, warm earthy colors
     (#6b6259, #b3a492, #f5f0e8), hand-drawn doodle aesthetic. No
     branding, no copyrighted characters."
4. Generate via the Vercel AI Gateway:
   - Model: `gpt-image-2` (via `$OPENAI_BASE_URL`)
   - Size: `1536x1024` for landscape formats (foldables), `1024x1536`
     for portrait formats (outlines, worksheets)
   - Source API key: `source ~/.gbrain/env.sh` for `OPENAI_API_KEY` and
     `OPENAI_BASE_URL`
   - Reference images: pass up to 4 extracted page PNGs as base64 input
     images. Pick the most structurally informative pages (the actual
     worksheet/activity pages, not cover or filler).

   ```python
   import fitz, base64, requests, os

   # Extract key pages as base64 PNGs
   doc = fitz.open(pdf_path)
   reference_images = []
   for page_num in key_page_indices:  # e.g. [2, 3] — the actual worksheet pages
       page = doc[page_num]
       pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
       png_bytes = pix.tobytes("png")
       b64 = base64.b64encode(png_bytes).decode()
       reference_images.append({
           "type": "input_image",
           "image_url": f"data:image/png;base64,{b64}"
       })
   doc.close()

   # Generate with visual references
   response = requests.post(
       f"{os.environ['OPENAI_BASE_URL']}/images/generations",
       headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
       json={
           "model": "gpt-image-2",
           "prompt": prompt,  # structural description + what to change
           "size": size,      # "1024x1536" or "1536x1024"
           "image": reference_images,  # extracted page PNGs as visual input
       }
   )
   ```

5. Save the generated image to
   `apps/web/agent/skills/materials-studio/references/homa-<format>-reference.png`
   (e.g. `homa-foldable-reference.png`, `homa-outline-reference.png`).
6. If the reference introduces a **new recipe type** not yet in the
   materials-studio skill, add a recipe section to
   `apps/web/agent/skills/materials-studio/SKILL.md` with:
   - A `Reference image:` pointer to the generated image
   - HTML/CSS recipe code for the format
   - Creation path guidance (image-direct vs html vs hybrid)
   - Design patterns extracted from the reference
   Also update the creation path judgment rules in the same skill.
7. If the reference matches an **existing recipe**, add the generated
   image as an additional reference (rename to avoid collisions, e.g.
   `homa-foldable-reference-2.png`).

**What the prompt should capture vs. what it should change:**

| Capture (structural pattern) | Change (expression) |
|---|---|
| Panel layout, fold geometry | Different subject/topic |
| Two-column instruction/work split | Different field labels |
| Section header style | Different title text |
| Spacing, density, visual hierarchy | Homa's design language |
| Scaffold structure (blank/filled variants) | Original example content |

| Never include | Why |
|---|---|
| Original brand name or logo | Copyright |
| Original characters (e.g. specific sheep mascot) | Copyright |
| Exact text/problems from original | Copyright |
| Terms of use, alignment charts | Not the material |

### 5. Cross-reference against materials-studio recipes

The materials-studio supports these creation paths: **image-direct**, **html**, **hybrid**. It has proven recipes for:

- Coloring pages, posters (image-direct)
- Tracing guides, handwriting practice (html — letter boxes, three-line guides)
- Counting mats, number worksheets (html or image-direct)
- Flash cards (html)
- Themed worksheets with art + exercises (hybrid)
- Foldables / interactive notebook inserts (hybrid or image-direct)
- Structured outlines / essay scaffolds (html)

For each reference, ask:
- **Which existing recipe would produce this?** Record in `recipeMatch.matchedRecipes`.
- **What patterns does this reference use that we have NO recipe for?** Record in `recipeMatch.gaps` with a description of what the recipe would need to do.

Gap examples: "maze generator", "cut-and-paste sorting activity", "multi-page booklet", "board game layout".

### 6. Update taste signals

Append to `.cosmo/homa-taste.md` under a section for the dropper:

```markdown
### Aless — 2026-07-12
- Dropped: Dinosaur Counting Mat (ref-2026-07-12-dino-counting-mat)
- Signal: prefers airy grid layouts over dense worksheets
- Signal: gravitates toward interest-led theming (dinosaurs) over neutral
- Signal: values illustration-dominant visual hierarchy
```

Look for patterns across multiple drops from the same person. When you see a pattern emerge (3+ consistent signals), promote it to a **confirmed preference** at the top of their section.

### 7. Reply in Slack thread

Use the **teach-me-explainer** technique from finding-unknowns: give the non-technical user vocabulary to describe what they are responding to.

Structure your reply:

1. **One-line summary**: what this reference is and what skill it targets.
2. **What makes this work** (2-3 bullets): name the design qualities using approachable vocabulary. Explain *why* these qualities matter for the child.
   - Example: "You might be responding to the _visual hierarchy_ — the way the main activity dominates the page while instructions stay small. That keeps the child focused on doing, not reading."
   - Example: "The _airy spacing_ gives each counting group its own breathing room. Dense pages overwhelm younger kids; this one won't."
3. **How Homa could make this**: which recipe path we would use, or flag if this is a gap.
4. **What we learned**: one sentence on the taste signal ("You and Aless both gravitate toward illustration-heavy layouts — that's a pattern we're tracking").

Keep it warm, concrete, and jargon-light. These are homeschool moms, not designers. The goal is to give them words for their intuition so future feedback gets sharper.

## File locations

| What | Path |
|---|---|
| Individual reference | `.cosmo/references/<id>.json` |
| Reference manifest | `.cosmo/references/index.json` |
| Taste model | `.cosmo/homa-taste.md` |
| Materials-studio skill | `apps/web/agent/skills/materials-studio/SKILL.md` |
| Taxonomy types | `packages/taxonomy/src/types.ts` |

## Notes

- Never modify the app codebase. This is an ops skill — analysis and cataloging only.
- If you cannot determine a dimension (e.g. print format from a low-res screenshot), mark it `"unknown"` and note why.
- When in doubt about taxonomy mapping, check the taxonomy data files in `packages/taxonomy/data/`.
- One reference per JSON file. One analysis per Slack message drop.
