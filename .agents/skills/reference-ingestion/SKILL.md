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

### 4. Cross-reference against materials-studio recipes

The materials-studio supports these creation paths: **image-direct**, **html**, **hybrid**. It has proven recipes for:

- Coloring pages, posters (image-direct)
- Tracing guides, handwriting practice (html — letter boxes, three-line guides)
- Counting mats, number worksheets (html or image-direct)
- Flash cards (html)
- Themed worksheets with art + exercises (hybrid)

For each reference, ask:
- **Which existing recipe would produce this?** Record in `recipeMatch.matchedRecipes`.
- **What patterns does this reference use that we have NO recipe for?** Record in `recipeMatch.gaps` with a description of what the recipe would need to do.

Gap examples: "maze generator", "cut-and-paste sorting activity", "multi-page booklet", "board game layout".

### 5. Update taste signals

Append to `.cosmo/homa-taste.md` under a section for the dropper:

```markdown
### Aless — 2026-07-12
- Dropped: Dinosaur Counting Mat (ref-2026-07-12-dino-counting-mat)
- Signal: prefers airy grid layouts over dense worksheets
- Signal: gravitates toward interest-led theming (dinosaurs) over neutral
- Signal: values illustration-dominant visual hierarchy
```

Look for patterns across multiple drops from the same person. When you see a pattern emerge (3+ consistent signals), promote it to a **confirmed preference** at the top of their section.

### 6. Reply in Slack thread

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
