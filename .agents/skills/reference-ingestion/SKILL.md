---
name: reference-ingestion
description: Use when a reference material (worksheet image, activity PDF, printable, screenshot, photo of a physical page, or a bare product link) lands in #homa-inspo, or when draining the ingestion backlog. Captures the drop durably, analyzes it along five dimensions, stores JSON, logs taste, hands off or performs product graduation in the post-Jul-20 fat-skill shape (recipe files, anchors, append-only taxonomy), and replies with a teach-me explainer. For a full curriculum with a philosophy and a sequence, use curriculum-ingestion instead.
---

# Reference Ingestion

## When to use, and routing

Something lands in the **#homa-inspo** Slack channel (`C0BHQDC033M`). Route it first:

| Drop looks like | Route |
|---|---|
| Single worksheet, activity page, printable, screenshot of one printable | This skill |
| Multi-page published curriculum, scope-and-sequence, methodology guide | `curriculum-ingestion` |
| Photo of a physical workbook page or material | This skill, with `printFormat` marked `unknown` |
| Bare TPT/Etsy/product link, no file | This skill: capture the link target NOW (step 0), then route by what it is |
| Bulk scrape batch (atlas-style, no Slack message per file) | This skill, with `analysisQuality: "heuristic"`; never log taste from bulk |
| Text-only feedback or discussion | Not ingestion. Log to `.cosmo/feedback-log.md` if actionable |

Droppers are any founder (Sid, Aless, Carolyng). Taste signals come from founder drops only, never from bulk sources.

## Non-negotiable laws (each one has a scar behind it)

1. **Never commit any binary under `apps/web/agent/skills/`.** The skill package is markdown only. The 2026-07-18 ingest committed 27.5MB of PNGs there, broke the `check:fleet-skills` size caps, and every one of those PNGs was later deleted (PR #57). Images the product uses ship only through the anchor pipeline below.
2. **Never send a copyrighted original, or an image derived from one, into the product.** External inspo files stay out of git entirely (see step 0). Product anchor images are Homa-authored pages produced on the `/admin/studio` bench and founder approved (founder ruling `golden-exemplar-anchors`, 2026-07-20, ratifying plan section 3.4). Generating exploratory images for your own analysis is fine: keep them as local scratch, do not commit them.
3. **Taxonomy edits are append-only.** Never re-serialize, re-sort, or dedupe `topics.json`. Topic names are legal duplicates across age bands (spiral curriculum). A 2026-07-18 dedupe-by-name pass silently deleted 33 topics and left 131 dangling edges; PR #58 restored them. Follow the exact sequence in step 8.
4. **Ship on a fresh branch, PR only, never direct to main** (founder ruling `main-branch-protection`, 2026-07-20; the branch is also protected on GitHub). Start every session with `bash .cosmo/scripts/session-start.sh`: it syncs to `origin/main`, creates the fresh branch, warns about stranded commits, and blocks on clock skew. Cosmo has pushed direct to main and left it red twice; it has also stranded commits on already-merged branches.
5. **Dates come from the Slack message `ts`, never the machine clock.** The ingest machine's clock has run about 4 days slow and produced wrongly dated ref ids.
6. **No em dash anywhere**, in this skill's outputs, in ref JSONs, in any graduated prose. `check:fleet-skills` fails on them and a whole cleanup commit (ec25671) exists because of them.

## Workflow

### 0. Capture immediately, before any analysis

Links expire in hours and files leave Slack. Capture first, think later.

- Auth: resolve the bot token per the committed root `.env.example` (1Password: `op run --env-file=.env.example -- <cmd>`). Never a machine-local env file.
- Pull the message: `conversations.history` on `C0BHQDC033M` (paginate; more than 100 messages needs cursors; check thread replies too).
- Download every `files[].url_private` with the bearer token into `.cosmo/inspo-files/` (PDFs) or `.cosmo/inspo-images/` (images). Stream large files; drops over 100MB are normal. These directories are gitignored working copies (founder ruling `inspo-originals-offrepo`, 2026-07-20): never commit an original.
- Upload each downloaded original to Blob for durability and record the returned URL in the ref JSON as `blobUrl`. Use only `bash .cosmo/scripts/blob-upload.sh <ref-id> <file> [content-type]`: it pins Homa's production store id and refuses a token from any other project's store, so uploads cannot land in the wrong Blob. Token source: `vercel env pull` inside `apps/web` (you already have the Vercel CLI), or the `.env.example` 1Password fallback. If no token resolves, keep the local copy, set `"blobUrl": null`, and note it; do not skip the download.
- For a bare link: fetch the target page and any free sample file now. If the fetch fails, record the failure in the ref JSON (`"captureFailed": "<reason>"`) so the loss is visible instead of silent. Fourteen TPT links from July are permanently lost because capture waited.
- Write the stub ref JSON at `.cosmo/references/<id>.json` right away with at least `id`, `sourceChannel`, `sourceMessageTs`, `droppedBy`, `droppedAt` (from Slack `ts`), and the local file paths.

### 1. Identify the reference

- Assign the id: `ref-<YYYY-MM-DD>-<short-slug>`, date from the Slack `ts`.
- Note who dropped it and the format: worksheet, coloring page, flash card, activity page, poster, game board, photo, other.

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

Map to the three-level taxonomy: **subject, then domain, then topic**.

- Subject: e.g. `math`, `ela`, `science`
- Domain: e.g. `counting-cardinality`, `letter-knowledge` (Homa slug ids, `TaxonomyDomain.id`)
- Topic: e.g. `math.count-objects-1-10` (bank convention `<subject>.<slug>`)
- Topic kind: `conceptual`, `procedural`, `representational`, `language`, `meta`
- If the reference targets something not in the taxonomy, flag it in `unmappedSkills` with a suggested slug.

**Vocabulary boundary:** the analysis JSON uses Homa slug ids (`math`, `counting-cardinality`). The taxonomy data file `topics.json` uses Marble display names for both subject and domain (`Mathematics`, `Counting & Cardinality`), and the pair must compose to an existing `MARBLE_DOMAIN_MAP` key in `packages/taxonomy/src/mapping.ts`, which is the combined string `<Subject> > <Domain>` (e.g. `Mathematics > Counting & Cardinality`). The two vocabularies never mix. Example pair: analysis says `subject: "math", domain: "counting-cardinality"`; a topics.json entry says `"subject": "Mathematics", "domain": "Counting & Cardinality"`.

#### C. Difficulty calibration

| Attribute | What to capture |
|---|---|
| Age band | estimated months range, e.g. `[36, 60]` |
| Complexity | single-skill, multi-skill, layered |
| Prerequisites | Homa topic ids the child should have before this |
| Scaffolding level | high (guided), medium (some support), low (independent) |

#### D. Theming

| Attribute | What to capture |
|---|---|
| Theme type | character-driven, neutral, seasonal, interest-led |
| Characters | named characters or archetypes present |
| Visual style | cartoon, realistic, minimalist, hand-drawn, clip-art |
| Color palette | full-color, black-and-white, limited palette |
| Appeal drivers | what makes it visually engaging |

#### E. Print format

| Attribute | What to capture |
|---|---|
| Page size | letter, A4, half-sheet, custom |
| Orientation | portrait, landscape |
| Margins | generous, standard, tight |
| Ink density | light (parent-friendly), medium, heavy |
| Color requirement | prints well in B&W, needs color, color optional |

For a photo drop, mark `printFormat` fields `"unknown"` where the photo cannot show them.

### 3. Store the analysis

Write the full ref JSON at `.cosmo/references/<id>.json`. Keep the existing five-dimension schema (see any recent `ref-*.json` for the shape) and include:

- `recipeMatch` (step 4 output)
- `analysisQuality`: `"full"` for a real per-item analysis, `"heuristic"` for template-filled bulk entries
- `stages`: the single source of truth for this drop's pipeline position:

```json
"stages": {
  "captured": "2026-07-20T18:04:00Z",
  "analyzed": true,
  "tasteLogged": true,
  "graduation": { "kind": "recipe", "targets": ["references/recipes/<slug>.md"], "commit": null },
  "taxonomy": { "proposedTopics": [], "commit": null },
  "shippedPr": null,
  "slackReplyTs": null,
  "shipReaction": false
}
```

`graduation.kind` is one of `recipe` (new format file needed), `pattern` (edit an existing recipe file), `subject` (teaching insight for a subjects or approaches file), `none`, or `pending`.

Then regenerate the manifest instead of hand-editing it:

```
python3 .cosmo/scripts/verify-ingestion.py --regen-index
```

`index.json` is a generated view of the ref JSONs. Never append to it by hand; hand edits are how 37 refs went missing from it. `.cosmo/inspo-catalog.md` is a historical narrative log, not a status system; do not treat its entries as pipeline state.

### 4. Cross-reference against materials-studio recipes

List the actual shipped recipes at analysis time:

```
ls apps/web/agent/skills/materials-studio/references/recipes/
```

Never match against a remembered list; the library grows and any hardcoded list in prose goes stale (33 recipe files ship today).

- **Which existing recipe would produce this?** Record filename slugs in `recipeMatch.matchedRecipes`.
- **What patterns have no recipe?** Record in `recipeMatch.gaps` as an array of `{"name": "<slug>", "notes": "<free prose>"}` objects. **The key is `name`, not `slug`** (a ref that used `slug` instead of `name` shipped once and its gaps silently vanished from coverage tracking; the field name in the object is not a stylistic choice, it is the exact key `apps/web/lib/materials/cosmo-funnel.ts`'s `extractGapSlugs` reads). **The `name` value must be a lowercase multi-word hyphen slug** matching `^[a-z0-9]+(-[a-z0-9]+)+$` (e.g. `cut-and-sort-mat`, not "cut and paste sorting activity"). Anything else, wrong key or wrong shape, is silently dropped by the coverage tracker. Free-prose description goes in `notes`.
- If a gap later graduates under a different recipe name, a `GAP_ALIASES` entry in `apps/web/lib/materials/cosmo-funnel.ts` must be added in the same change that ships the recipe.

### 5. Update taste signals

Append to `.cosmo/homa-taste.md` under the dropper's section, founder drops only:

```markdown
### Aless, 2026-07-12
- Dropped: Dinosaur Counting Mat (ref-2026-07-12-dino-counting-mat)
- Signal: prefers airy grid layouts over dense worksheets
- Signal: gravitates toward interest-led theming (dinosaurs) over neutral
```

When 3+ consistent signals from the same person emerge, promote to a confirmed preference at the top of their section. Bulk-scrape refs never generate taste entries; their analysis is heuristic, not a founder's choice.

### 6. Graduate to the product (the fat-skill shapes)

This is where Homa actually gets smarter. Every write below follows the post-PR-#57 structure. If you cannot run the required guards in your environment, stop here: set `graduation.kind` accordingly, fill `graduation.targets` with the intended paths, leave `commit: null`, and say so in your Slack reply. An honest handoff beats a broken push.

**Budget first:** the file-count cap was removed by founder ruling `fleet-skill-file-cap-removed` (2026-07-20), but the byte caps remain binding: 512KB per file, 2MB per package (`check:fleet-skills`). Recipe files are small markdown; if a batch would approach the package byte cap, stop and escalate.

#### 6a. New format: a recipe file, never a SKILL.md section

Create `apps/web/agent/skills/materials-studio/references/recipes/<gap-slug>.md`:

- Plain markdown, `# Title` first line, **no frontmatter**
- If a golden anchor exists for the format, a first paragraph: `Golden anchor: pass anchorIds: ["<id>"] to generate_image ... the anchor sets the visual bar, not the specifics`
- When-to-use prose, a `Great for:` line
- Creation path: `html`, `hybrid`, or `image-direct`, with the reasoning
- A binding section `Design patterns (all binding for <slug>):` with bullet rules
- For html and hybrid paths, a worked HTML snippet in a fenced code block

Then add exactly one row to the Format library index table in `apps/web/agent/skills/materials-studio/SKILL.md` (format | reach for it when | recipe file). Recipes as inline SKILL.md sections are dead; PR #57 relocated them all to files and the router just indexes them.

#### 6b. Existing format, new pattern

Edit that recipe file's design-patterns list. Update, do not duplicate. Never create `<slug>-2` variants.

#### 6c. Teaching or pedagogy insight

Write it into `apps/web/agent/skills/materials-studio/references/subjects/<name>.md` or `references/approaches/<name>.md` (create the file plus its routing-table row in SKILL.md when new). Only a rule binding for every page of a whole subject belongs in the router itself, and that is rare.

#### 6d. Activity format registry

Add the entry to `apps/web/agent/activity-formats.md` with the exact slug line format the coverage matcher parses:

```markdown
- **Slug:** `[<slug>]`
```

plus name, what it is, best for, subjects, ages, creation path, example activity, following existing entries.

#### 6e. Anchors are founder-gated; you propose, never ship

The golden anchor pipeline is: Homa-authored JPEG at `apps/web/lib/materials/anchor-sources/<id>.jpg` (compressed, roughly 1024px longest side, 60-150KB), then `pnpm build:material-anchors` regenerates `anchor-bytes.generated.ts` (never hand-edit it), a registry entry in `apps/web/lib/materials/anchors.ts`, a Golden anchors table row in materials-studio SKILL.md, and the `anchorIds` paragraph in the matching recipe file. `anchors.test.ts` enforces registry/bytes parity and that the library never shrinks.

Your ceiling: when a reference deserves a visual exemplar, write a **bench brief** into the ref JSON (`graduation.benchBrief`: what to build, which recipe, what the anchor must demonstrate). The founder produces and approves the page on `/admin/studio`; a coding session performs the five writes. Two of those writes (the SKILL.md anchor-table row and the recipe file's `anchorIds` paragraph) have no automated guard and must be hand-checked. Anchors also lead and share the 4-slot `generate_image` reference budget; family reference images get whatever slots anchors leave.

### 7. Guards for graduation writes

Run before pushing, from the repo root:

- `pnpm check:fleet-skills` (package hygiene, size caps, em-dash ban)
- `pnpm check:materials` (cosmo-funnel coverage and alias resolution)
- `pnpm check:taxonomy` when taxonomy was touched (step 8)

A red guard means fix or hand off, never push anyway.

### 8. Enrich taxonomy (exact sequence, append-only)

If the reference targets concepts missing from the taxonomy:

1. **Append** new topic objects to the `topics` array in `packages/taxonomy/data/topics.json`, and bump the file's `topicCount` field by the same amount (the file shape is `{version, topicCount, topics: [...]}`). Topic shape: `{ id: "mt_<10-char-random>", type, subject, domain, name, description, ageRangeStart, ageRangeEnd, centrality: 0.01, evidence: [3 items], assessmentPrompt, standards: [] }`. `type` is usually `"CONCEPTUAL"` or `"PROCEDURAL"`; `"REPRESENTATIONAL"`, `"LANGUAGE"`, and `"META"` are valid when the concept genuinely is one. Append at the end; do not touch existing entries.
2. `subject` and `domain` are both Marble display names, and the pair composed as `<Subject> > <Domain>` (e.g. `Mathematics > Counting & Cardinality`) must exactly match an existing `MARBLE_DOMAIN_MAP` key in `packages/taxonomy/src/mapping.ts`. A genuinely new pair requires a `mapping.ts` edit in the same change.
3. `pnpm taxonomy:slugs` (regenerates `data/homa-slug-map.json`)
4. `pnpm taxonomy:progress` (regenerates `src/progress.generated.ts`)
5. Update `packages/taxonomy/data/manifest.json`: the counts AND the `bytes` + `sha256` entry in `manifest.files` for every data file the change touched (at minimum `topics.json`; `shasum -a 256 <file>` gives the hash). A stale checksum guarantees a red `check:taxonomy`.
6. `pnpm check:taxonomy` must exit 0.
7. Sanity diff: `git diff --stat` on `topics.json` must show insertions only. The topic count (`topicCount` and the array length) must strictly grow. Never trust your own summary of what changed; the 07-18 incident claimed "+8 topics" and netted -29.

There is no `pnpm --filter @homa/taxonomy validate` command. It never existed; the real gate is `pnpm check:taxonomy`.

### 9. Reply in the Slack thread

Use the teach-me-explainer technique: give the non-technical dropper vocabulary for what they are responding to.

1. **One-line summary**: what this reference is and what skill it targets.
2. **What makes this work** (2-3 bullets): name the design qualities in approachable words and why they matter for the child.
3. **How Homa could make this**: which recipe path, or name the gap honestly.
4. **What we learned**: one sentence on the taste signal.

Keep it warm, concrete, and jargon-light. These are homeschool moms, not designers.

### 10. Verify, then react

Run the gate:

```
python3 .cosmo/scripts/verify-ingestion.py <ref-id>
```

React to the original Slack drop with :ship: **only on exit 0**, and only after the thread reply was actually sent (the one thing the script cannot see). The :ship: reaction is the verified-ingestion marker; its absence means the drop is not done. If the verifier is blocked because your checkout is stale, sync to `origin/main` first; a verdict from a stale tree is worthless.

## File locations

| What | Path |
|---|---|
| Ref JSON (canonical per-drop truth) | `.cosmo/references/<id>.json` |
| Manifest (generated, never hand-edited) | `.cosmo/references/index.json` |
| Open gap backlog (machine-readable) | `.cosmo/open-gaps.json` |
| Taste model | `.cosmo/homa-taste.md` |
| Downloaded originals | `.cosmo/inspo-files/`, `.cosmo/inspo-images/` |
| Recipes | `apps/web/agent/skills/materials-studio/references/recipes/<slug>.md` |
| Subject and approach docs | `.../references/subjects/`, `.../references/approaches/` |
| Skill router (index tables only) | `apps/web/agent/skills/materials-studio/SKILL.md` |
| Anchor images | `apps/web/lib/materials/anchor-sources/<id>.jpg` |
| Anchor registry | `apps/web/lib/materials/anchors.ts` |
| Anchor bytes (generated) | `apps/web/lib/materials/anchor-bytes.generated.ts` |
| Anchor build script | `scripts/build-material-anchors.mts` |
| Gap aliases and funnel | `apps/web/lib/materials/cosmo-funnel.ts` |
| Activity format registry | `apps/web/agent/activity-formats.md` |
| Taxonomy topics | `packages/taxonomy/data/topics.json` |
| Taxonomy domain map | `packages/taxonomy/src/mapping.ts` |
| Verifier | `.cosmo/scripts/verify-ingestion.py` |

## Notes

- One reference per JSON file, one analysis per drop. Every drop should leave the product measurably smarter: at minimum a taste entry, ideally a recipe, format entry, or taxonomy addition.
- If you cannot determine a dimension, mark it `"unknown"` and say why.
- Never copy this skill's prose into anything under `apps/web/agent/skills/`; product skill text has its own voice rules and guards.
