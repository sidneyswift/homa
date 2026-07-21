---
name: curriculum-ingestion
description: Use when a complete curriculum, curriculum guide, scope-and-sequence document, or methodology handbook is dropped in #homa-inspo. Breaks it into four layers (philosophy, scope & sequence, weekly structure, activity types), maps everything to Homa's taxonomy and knowledge_bank, flags gaps, and surfaces product decisions for Sid. For a single worksheet or printable, use reference-ingestion instead.
---

# Curriculum Ingestion

## When to use

A full curriculum, curriculum guide, scope-and-sequence document, or methodology handbook is dropped in **#homa-inspo**. This is bigger than a single reference: it represents a teaching philosophy and a structured plan. Your job: decompose it into four layers, map it to Homa's systems, flag every gap, and surface decisions Sid needs to make.

**Shared laws:** the non-negotiable laws in `reference-ingestion` (capture files immediately before analysis, dates from the Slack `ts` never the machine clock, append-only taxonomy, fresh branch and PR only, no binaries under `apps/web/agent/skills/`, copyrighted originals and images derived from them never enter the product, no em dash anywhere) apply to this skill identically.

## The four layers

### Layer 1: Philosophy & Method

Map to `knowledge_bank` entries with `topic_type` values:
- `method_philosophy`: the curriculum's educational philosophy (e.g. Charlotte Mason, classical, Montessori, eclectic)
- `method_format`: how it delivers instruction (workbook-based, literature-based, unit-study, hands-on)

Capture:
- Core principles (3-5 bullet points)
- Learning theory assumptions (developmental stages, mastery vs spiral, child-led vs structured)
- Assessment approach (portfolio, testing, observation, none)
- Parent role (facilitator, teacher, observer)
- Whether Homa's `knowledge_bank` already has entries for this method (search by `topic_key`)

### Layer 2: Scope & Sequence

Map every subject and topic to Homa's taxonomy: **subject → domain → topic**.

Produce a mapping table:

| Curriculum subject | Curriculum topic | Homa subject | Homa domain | Homa topic id | Status |
|---|---|---|---|---|---|
| Math | Counting to 20 | math | counting-cardinality | math.counting-objects-to-20 | ✅ mapped |
| Math | Telling time | math | (none) | (none) | ⚠️ unmapped |
| Art | Color mixing | (none) | (none) | (none) | ❌ no subject |

Status values:
- **✅ mapped**: direct match to existing Homa topic
- **⚠️ unmapped**: subject/domain exists but no matching topic (suggest a topic slug)
- **❌ no subject**: Homa has no subject for this area (needs Sid's decision)
- **🔄 partial**: covers part of a Homa topic or combines multiple topics

For every `⚠️` or `❌`, include a suggested addition:
```
Gap: "telling time" → suggested topic: math.tell-time-hour
  domain: measurement (exists)
  kind: procedural
  teachingWindowMonths: [60, 84]
```

### Layer 3: Weekly/Daily Structure

Extract the curriculum's pacing patterns for the curriculum-writer:

- **Cadence**: daily, 3x/week, weekly, block schedule
- **Session length**: typical time per subject per day
- **Weekly template**: what a typical week looks like (e.g. "M/W/F: math + reading, T/Th: science + art")
- **Progression model**: linear (week 1 before week 2), spiral (revisit), mastery (stay until solid)
- **Review/assessment rhythm**: weekly quiz, monthly review, portfolio checkpoint
- **Total duration**: how many weeks the full curriculum spans

Format as a template the curriculum-writer could use:

```
Weekly template: "<curriculum-name>"
Cadence: 4 days/week (M-Th), Friday flex
Per day:
  - Math: 30 min (workbook + manipulatives)
  - Reading: 20 min (shared reading + phonics drill)
  - Science/Social Studies: alternating weeks, 30 min
  - Art/Music: 15 min (integrated into other subjects)
Progression: spiral with 3-week review cycles
Assessment: weekly narration, monthly portfolio page
```

### Layer 4: Activity Types

List every distinct activity type the curriculum uses and cross-reference against materials-studio recipes.

| Activity type | Description | Materials-studio recipe | Status |
|---|---|---|---|
| Tracing worksheet | Letter/number tracing with guides | html (tracing guide) | ✅ have recipe |
| Cut-and-sort | Cut pictures, sort into categories | (none) | ❌ no recipe |
| Narration page | Blank page with prompt for child to draw/dictate | (none) | ❌ no recipe |
| Counting mat | Count objects in groups | html or image-direct | ✅ have recipe |

List the actual shipped recipes at analysis time, never from memory (the library grows; 33 recipe files ship today):

```
ls apps/web/agent/skills/materials-studio/references/recipes/
```

Match activity types against those filename slugs. The three creation paths are guidance for what a missing recipe would need, not a recipe list:
- **image-direct**: coloring pages, posters, art-heavy pages, simple worksheets (titles + moderate item counts)
- **html**: tracing guides, handwriting practice, text-dense pages, math layouts, flash cards, tables
- **hybrid**: themed worksheets (precise exercises + illustration)

Name every gap as a lowercase multi-word hyphen slug matching `^[a-z0-9]+(-[a-z0-9]+)+$` (the funnel in `apps/web/lib/materials/cosmo-funnel.ts` silently drops anything else). Note: curriculum analyses record themselves under the synthetic gap `curriculum-sample`, which the materials funnel excludes by design; that is expected, not an error.

For every `❌ no recipe`, describe what the recipe would need:
```
Missing recipe: "cut-and-sort"
  Description: Page with images to cut out and category boxes to paste into
  Creation path: hybrid (image-direct for cut-out images, html for category grid)
  Complexity: medium (needs dotted cut lines, category labels)
```

## Storage format

Write to `.cosmo/curriculums/<id>.json`:

```json
{
  "id": "cur-2026-07-12-charlotte-mason-k",
  "name": "Charlotte Mason Kindergarten Guide",
  "droppedBy": "carolyng",
  "droppedAt": "2026-07-12T15:00:00-04:00",
  "sourceChannel": "homa-inspo",
  "sourceMessageTs": "1784229900.000100",

  "layer1_philosophy": {
    "methodology": "Charlotte Mason",
    "principles": [
      "Living books over textbooks",
      "Short lessons (15-20 min per subject)",
      "Nature study as core science",
      "Narration as primary assessment",
      "Habit training alongside academics"
    ],
    "learningTheory": "developmental-stages",
    "assessmentApproach": "narration-and-portfolio",
    "parentRole": "facilitator",
    "knowledgeBankMatches": [
      {
        "topicKey": "charlotte-mason",
        "topicType": "method_philosophy",
        "status": "exists"
      }
    ],
    "knowledgeBankGaps": [
      {
        "suggestedKey": "charlotte-mason-k-format",
        "topicType": "method_format",
        "title": "Charlotte Mason Kindergarten Format",
        "summary": "Short-lesson rotation with narration, nature journals, and living books for ages 4-6"
      }
    ]
  },

  "layer2_scope": {
    "mappings": [
      {
        "curriculumSubject": "Mathematics",
        "curriculumTopic": "Counting to 20",
        "homaSubject": "math",
        "homaDomain": "counting-cardinality",
        "homaTopicId": "math.counting-objects-to-20",
        "status": "mapped"
      },
      {
        "curriculumSubject": "Nature Study",
        "curriculumTopic": "Seasonal nature walks",
        "homaSubject": "science",
        "homaDomain": null,
        "homaTopicId": null,
        "status": "unmapped",
        "suggested": {
          "topicSlug": "science.nature-observation",
          "domain": "organisms-life-processes",
          "kind": "conceptual",
          "teachingWindowMonths": [48, 84]
        }
      }
    ],
    "stats": {
      "totalCurriculumTopics": 24,
      "mapped": 18,
      "unmapped": 4,
      "noSubject": 1,
      "partial": 1
    }
  },

  "layer3_structure": {
    "cadence": "4 days/week",
    "sessionLengthMinutes": {
      "math": 15,
      "reading": 20,
      "nature": 30,
      "art": 15
    },
    "weeklyTemplate": "M-Th: math (15m) + reading (20m) + rotating subject (30m). Friday: nature walk or free exploration.",
    "progressionModel": "spiral",
    "reviewRhythm": "weekly narration, seasonal portfolio review",
    "totalWeeks": 36
  },

  "layer4_activities": {
    "activityTypes": [
      {
        "type": "tracing-worksheet",
        "description": "Letter and number tracing with three-line guides",
        "recipe": "html",
        "status": "have_recipe"
      },
      {
        "type": "narration-page",
        "description": "Blank page with illustration prompt and lined dictation area",
        "recipe": null,
        "status": "no_recipe",
        "suggestedRecipe": {
          "name": "narration-page",
          "creationPath": "html",
          "description": "Top half blank for drawing, bottom half with wide-ruled lines for parent-transcribed narration. Title prompt at top.",
          "complexity": "low"
        }
      }
    ],
    "stats": {
      "totalActivityTypes": 8,
      "haveRecipe": 5,
      "noRecipe": 3
    }
  },

  "decisionsNeeded": [
    {
      "category": "taxonomy",
      "item": "Add nature-observation topic to science/organisms-life-processes domain",
      "impact": "Enables nature study curriculum support",
      "urgency": "medium"
    },
    {
      "category": "recipe",
      "item": "Build narration-page recipe (html path)",
      "impact": "Charlotte Mason families need this for every subject",
      "urgency": "high"
    },
    {
      "category": "method",
      "item": "Add charlotte-mason-k-format to knowledge_bank",
      "impact": "Curriculum-writer can generate CM-style weekly plans",
      "urgency": "medium"
    }
  ],

  "notes": "Strong overlap with existing taxonomy in math and ELA. Main gaps are nature study and art appreciation, CM-specific subjects."
}
```

The manifest at `.cosmo/curriculums/index.json` (generated, see below):

```json
{
  "curriculums": [
    {
      "id": "cur-2026-07-12-charlotte-mason-k",
      "name": "Charlotte Mason Kindergarten Guide",
      "droppedBy": "carolyng",
      "droppedAt": "2026-07-12T15:00:00-04:00",
      "methodology": "Charlotte Mason",
      "mappedPct": 75,
      "gapCount": 6,
      "decisionsCount": 3
    }
  ]
}
```

The index shown above is the generated shape, not a file you edit: after writing the cur JSON, run `python3 .cosmo/scripts/verify-ingestion.py --regen-index` and it is rebuilt from the individual JSONs. Never hand-edit `index.json`.

## Post-analysis actions

### Reply in #homa-inspo thread

Brief acknowledgment to the dropper: what you received and that you're analyzing it. Keep it short; the real output goes to #homa-dev.

### Post summary to #homa-dev (C0BF3QUABDH, `SLACK_DEV_CHANNEL_ID` in the root `.env.example`; automation keys on the ID, not the name)

Structure:

**1. What Homa would learn** (one paragraph)

> "This Charlotte Mason kindergarten guide would teach Homa how CM families structure their days: 15-minute math blocks, daily nature journals, narration instead of testing. It maps cleanly to 18 of our 24 taxonomy topics in math and ELA. The main gaps are nature study (we have no nature-observation topic) and art appreciation (no subject at all). Three activity types (narration pages, nature journal templates, and copywork sheets) would need new materials-studio recipes."

**2. Decisions needed from Sid**

Format as a checklist he can approve/reject inline:

```
Taxonomy:
- [ ] Add `science.nature-observation` topic (organisms-life-processes domain)
- [ ] Add `art` subject with `art-appreciation` domain

Recipes:
- [ ] narration-page (html): blank drawing + lined dictation
- [ ] nature-journal (hybrid): observation sketch + notes grid
- [ ] copywork-sheet (html): model sentence + tracing lines

Knowledge bank:
- [ ] Add charlotte-mason-k-format (method_format)
```

**3. Full analysis link**

Point to the JSON: "Full analysis at `.cosmo/curriculums/cur-2026-07-12-charlotte-mason-k.json`"

### Write to knowledge bank

Layer 1 (philosophy/method) findings get written to the knowledge bank through the existing gate at `apps/web/lib/knowledge/gate.ts`. Format each entry as:
- `topic_type`: `method_philosophy` or `method_format`
- `topic_key`: kebab-case slug (e.g., `charlotte-mason`, `montessori-three-period`)
- `lens`: `method`
- `title`: ≤120 chars
- `summary`: ≤500 chars
- `content`: ≤8000 chars (the full methodology description)
- `citations`: array with URL + title of the source curriculum
- `confidence`: `high`
- `source_tier`: 2
- `contributed_by`: `founder`

The gate handles validation, sanitization, and citation resolution. No new write path needed.

### Enrich taxonomy (exact sequence, append-only)

Layer 2 unmapped topics follow the same binding sequence as reference-ingestion step 8:

1. **Append** entries to the `topics` array in `packages/taxonomy/data/topics.json` and bump its `topicCount` field by the same amount; never re-serialize, re-sort, or dedupe (topic names are legal duplicates across age bands). Structure: `{ id: "mt_<10-char-random>", type: "CONCEPTUAL" or "PROCEDURAL" (the other MarbleTopicType values are valid when genuinely applicable), subject, domain, name, description, ageRangeStart, ageRangeEnd, centrality: 0.01, evidence: [3 items], assessmentPrompt, standards: [] }`.
2. `subject` and `domain` are both Marble display names, and the pair composed as `<Subject> > <Domain>` (e.g. `Mathematics > Counting & Cardinality`) must exactly match an existing `MARBLE_DOMAIN_MAP` key in `packages/taxonomy/src/mapping.ts`. A genuinely new pair needs a `mapping.ts` edit in the same change.
3. `pnpm taxonomy:slugs`, then `pnpm taxonomy:progress`, then update `packages/taxonomy/data/manifest.json`: the counts AND the `bytes` + `sha256` entry in `manifest.files` for every touched data file (`shasum -a 256 packages/taxonomy/data/topics.json`). A stale checksum guarantees a red `check:taxonomy`.
4. `pnpm check:taxonomy` must exit 0 before pushing. There is no `pnpm --filter @homa/taxonomy validate` command; it never existed.
5. Confirm the `topics.json` diff is insertions only: no existing topic objects deleted or modified, and the topic count (`topicCount` and array length) strictly grew.

### Add activity formats and recipes

Layer 4 activity types that have `status: "no_recipe"`:
- Author a self-contained recipe file at `apps/web/agent/skills/materials-studio/references/recipes/<slug>.md` (plain markdown, `# Title`, no frontmatter, when-to-use, `Great for:` line, creation path, binding `Design patterns` section, worked HTML for html and hybrid paths), plus exactly one row in the Format library index table in that skill's `SKILL.md`. Never write recipe sections into `SKILL.md` itself; PR #57 relocated all recipes to files.
- If the gap name differs from the shipped recipe filename, add the `GAP_ALIASES` entry in `apps/web/lib/materials/cosmo-funnel.ts` in the same change.
- Add entries to `apps/web/agent/activity-formats.md`, keeping the exact slug line format the coverage matcher parses: ``- **Slug:** `[<slug>]` ``.
- Package budget: the file-count cap was removed by founder ruling `fleet-skill-file-cap-removed` (2026-07-20); the 512KB per-file and 2MB per-package byte caps in `check:fleet-skills` remain binding.

Run `pnpm check:fleet-skills` and `pnpm check:materials` before pushing.

### Update curriculum writer methodology

If the curriculum introduces a methodology the curriculum writer doesn't know about:
- Add a methodology note to `apps/web/agent/curriculum-writer.md` explaining how that method structures weeks, sessions, and assessment
- Examples: Charlotte Mason short-lesson rotation with narration, Montessori three-period lesson structure, classical trivium staging

## Distinguishing from reference-ingestion

| Signal | Use this skill (curriculum-ingestion) | Use reference-ingestion |
|---|---|---|
| Dropped item is a multi-page document or full curriculum | ✅ | |
| Dropped item is a single worksheet or activity page | | ✅ |
| Contains scope & sequence or weekly plans | ✅ | |
| Contains a stated educational philosophy | ✅ | |
| It's a screenshot of one printable | | ✅ |
| Photo of a physical workbook page | | ✅ (printFormat unknown) |
| Bare product link, no file | | ✅ (capture-or-fail first, then route) |
| Bulk scrape batch with no per-file Slack message | | ✅ (analysisQuality heuristic, no taste) |

When in doubt: if it has a philosophy and a sequence, it's a curriculum. If it's a single page meant to be printed and used, it's a reference. A multi-book curriculum wave (e.g. a full grade level dropped as 10 PDFs) is one curriculum analysis per book or coherent set, not 10 reference analyses.

## File locations

| What | Path |
|---|---|
| Individual analysis | `.cosmo/curriculums/<id>.json` |
| Curriculum manifest | `.cosmo/curriculums/index.json` |
| Taste model | `.cosmo/homa-taste.md` |
| Knowledge bank schema | `supabase/migrations/20260711031000_knowledge_bank.sql` |
| Taxonomy types | `packages/taxonomy/src/types.ts` |
| Curriculum writer | `apps/web/agent/curriculum-writer.md` |
| Materials-studio skill | `apps/web/agent/skills/materials-studio/SKILL.md` |
| Activity format registry | `apps/web/agent/activity-formats.md` |
| Knowledge bank gate | `apps/web/lib/knowledge/gate.ts` |

## Post-ingestion verification

In order:

1. Write or update the cur JSON, then regenerate the manifest: `python3 .cosmo/scripts/verify-ingestion.py --regen-index` (never hand-edit `index.json`; the indexed check below fails otherwise).
2. Run the gate (curriculum mode checks: identity fields, the four layers nonempty, index membership, decisions recorded, and that Layer-4 suggested recipe names are multi-word slugs):

```
python3 .cosmo/scripts/verify-ingestion.py <cur-id>
```

3. Send the #homa-dev summary and the thread acknowledgment.
4. React to the **original Slack drop message** with 🚢 (`:ship:`) emoji **only on exit 0**. If any step failed or was skipped, do NOT react with 🚢; fix the issue first.

The 🚢 emoji is a **verified ingestion marker**. Its presence on a message means "this drop was fully processed through the correct ingestion skill." Its absence means it wasn't.

## Notes

- This skill modifies product files directly: materials-studio SKILL.md, activity-formats.md, taxonomy data, knowledge bank, and curriculum-writer methodology notes. Every curriculum ingested makes Homa smarter across lesson planning, material generation, and knowledge delivery.
- One curriculum per JSON file. One analysis per curriculum drop.
