# Materials studio as a true fat skill (PROPOSAL v2, 2026-07-19)

Status: proposed, awaiting founder review. Nothing here is implemented.
Founder decisions are marked D1 to D4. This version supersedes the same-day
v1 draft, which proposed a bespoke `read_skill_reference` tool; deeper
verification showed that tool would duplicate a substrate Homa already has.

## 1. The corrected ground truth

Verified against the installed eve and this repo on 2026-07-19:

1. **The read path already exists.** eve seeds every fleet-skill package
   into the sandbox at `/workspace/skills/<name>/` (framework reservation
   confirmed in `eve/dist/src/discover/sandbox.js`), and the framework
   `read_file`, `glob`, and `grep` tools are enabled: the 2026-07-09
   ruling (15-agentic-architecture.md §3) sentineled off only `bash` and
   `write_file` (plus `web_fetch`, later re-enabled authored). Homa can
   read a skill's sibling reference files today. Nothing taught it to.
2. **The sandbox is already hardened.** `apps/web/agent/sandbox.ts`
   configures deny-all egress on every network-capable backend; deployed
   runtime resolves to Vercel Sandbox with deny-all, local dev pins
   just-bash. The file's own comment reserves it as the extension point
   for the worksheet factory (M0-03/M2-05).
3. **Fleet style anchors still cannot reach the image model.**
   `generateStudioImage` hard-rejects any reference URL failing
   `isFamilyArtifactUrl` (family Blob prefix only), so Homa-owned
   exemplar images cannot be passed to gpt-image-2. This is the one
   genuine tool-layer gap.
4. **The package guard forbids a real library at current caps.**
   `scripts/fleet-skills-check.mts`: 50 sibling files, 512 KB per file,
   2 MB per package.
5. **The skill is a 1,725-line monolith** with ~24 inline recipes and 2
   reference images, loaded whole on every trigger. It grew that way on
   the assumption that inline was the only place content could live.
   That assumption was false; the architecture below unwinds it.
6. **Computational formats are generated latently.** Cross-number
   puzzles, mazes, and answer keys are produced in prose today. These
   have one right answer; the taste model calls answer keys
   non-negotiable; latent arithmetic on printed pages will eventually
   ship a wrong key to a family.

## 2. Design doctrine (research synthesis, unchanged from v1)

- A fat skill is a fat **package**, not a fat SKILL.md: lean router
  under 500 lines, per-variant reference files loaded one at a time,
  binary assets never loaded into context.
- Judgment lives in prose; one-right-answer work lives in deterministic
  code. Loading a skill never grants an ability, so each missing exact
  effect is a narrow tool.
- Skills are tested bundles: routing fixtures both ways, behavioral
  evals, and integrity checks that referenced files exist.
- Learnings graduate forward-only into the package, deduplicated
  against what is already there. Taste belongs in the system.

## 3. Target architecture

### 3.1 The package

```
apps/web/agent/skills/materials-studio/
├── SKILL.md                      # the router, under 500 lines
├── references/
│   ├── recipes/<format>.md       # ~30 files, one per material format
│   ├── subjects/<pedagogy>.md    # ~11 files: letters, counting, CVC,
│   │                             #   essay writing, math ops, DI,
│   │                             #   play-based, Charlotte Mason,
│   │                             #   Montessori, Singapore, balanced lit
│   ├── style/anchors.md          # the three style poles and when each
│   │                             #   applies (doodle, clean structural
│   │                             #   B&W, watercolor naturalist)
│   └── image-manifest.md         # id, description, intended use of
│                                 #   every bundled style anchor image
└── assets/
    └── refs/<format>--<style>--<slug>.jpg   # Homa-authored exemplars,
                                             #   compressed
```

SKILL.md keeps only: identity, difficulty-from-evidence (binding), the
creation-path decision table, generate_image craft essentials, photo and
child-likeness law, the html contract summary, the packet recipe,
metadata discipline, the draft/check/revise/finalize loop, and a
**format index table**: format, trigger phrases, recipe path, default
creation path, style anchor ids. The router states the read mechanics
explicitly, because they are the part no model guesses:

> Recipes live under `/workspace/skills/materials-studio/references/`.
> Before building a format, read its recipe with `read_file` (for
> example `/workspace/skills/materials-studio/references/recipes/foldable.md`).
> Read one recipe per build; never re-inline what a recipe already says.

Each recipe file is self-contained per the tear-sheet pattern: when to
use, binding design patterns, HTML snippets, leveling rules, which style
anchors to pass to generate_image and the prompt pattern for using them,
and a per-format quality checklist.

### 3.2 Fleet style anchors into gpt-image-2 (the one tool change)

Extend `generate_image` with optional `styleReferenceIds` (manifest ids,
combined cap of 4 across both reference kinds). The tool resolves each
id server-side from the skill package (via the skill-package file handle
or the deployed bundle; implementation detail settled in the PR) and
passes bytes to the provider alongside any family reference bytes.
`isFamilyArtifactUrl` and the family-URL path stay exactly as they are.
Tenant isolation is untouched: anchors are Homa-owned assets identical
for every family, and they never transit as model-visible URLs.

### 3.3 Deterministic practice content (exact work stays exact)

New narrow tool `compute_practice_content`: typed variants for the
computational formats (cross-number grid with constraints satisfied,
maze decision-graph with one guaranteed solution path and explicit dead
ends, word-search letter grid with placed answers, arithmetic problem
set with its answer key, color-by-answer mappings). Input: variant,
difficulty parameters. Output: typed JSON the skill renders into HTML.
Pure computation in the app runtime, vitest-covered, no model, no
provider, no family data. One tool, one genuinely shared effect:
computed-correct practice content. Recipes for these formats MUST call
it; the answer key is never composed latently.

### 3.4 The golden-exemplar law (copyright posture, D2)

The shipped image library contains **Homa-authored exemplars only**:
pages produced by the studio on the /admin/studio bench, founder
approved, then graduated into `assets/refs/`. External inspiration (TPT
pages, publisher PDFs, the Atlas scrape) stays in `.cosmo` as
coding-side taste material and is never bundled into the product or
passed to the image model on behalf of a family. The flywheel:

```
external inspo (Slack drops, scrapes)
      → .cosmo sidecars + taste model            (coding side, Cosmo)
      → recipe cards + bench briefs               (this repo)
      → /admin/studio bench runs                  (materials_studio_runs)
      → founder approves the best render
      → graduates into assets/refs/ + manifest    (PR)
      → prod Homa passes it to gpt-image-2 as a style anchor
```

### 3.5 What stays deliberately off

`bash` and `write_file` sentinels stay. Nothing in this plan needs a
model-facing shell: reading references uses the already-enabled
read-only tools, and computed content lives in a typed tool where it is
unit-testable. Skill-shipped `scripts/` executed in the sandbox remain
the reserved extension point in `sandbox.ts` (M0-03/M2-05) for a future
workload that genuinely needs them, for example lesson-planner draft
artifacts, and that return trip is its own decision with M2-14 as
defense in depth. No bespoke file-read tools, now or later; a second
file-shaped tool PR is the tripwire that this plan's premise broke.

## 4. Phases

### Phase A: prove the substrate, then restructure

1. **Substrate probe.** PARTLY DONE, 2026-07-19. Verified at the build
   layer that the whole package materializes into the seeded workspace
   resources, references and nested subdirectories included: after
   `VERCEL=1 pnpm --filter web exec eve build`,
   `.eve/compile/workspace-resources/__root__/skills/materials-studio/`
   contains `SKILL.md`, both `references/*.png`, and the two new
   `references/recipes/*.md` added in the slice below. The runtime seeder
   `materializeWorkspaceDirectory` (eve `runtime/workspace/seed-files.js`)
   walks that root recursively into `/workspace/**`, and `read_file`,
   `glob`, `grep` are enabled framework tools (only `bash` and
   `write_file` are sentineled off). So Homa can
   `read_file /workspace/skills/materials-studio/references/recipes/<f>.md`.
   STILL TODO before the bulk relocation: a deployed-shape bench run that
   confirms `read_file` actually fires and shapes output, and measures
   Vercel Sandbox cold-boot first-read latency (the correctness question
   is settled; the latency and live-behavior questions are not).
2. Split the monolith into router + `references/`, preserving every
   binding rule verbatim: relocation, not rewording, so the diff is
   reviewable. RECIPE RELOCATION DONE, 2026-07-19. All 26 format recipes
   now live in `references/recipes/*.md` (24 extracted byte-verbatim by
   script from the contiguous block; `foldable` and `structured-outline`
   hand-migrated earlier because they carry reference images). The whole
   block was replaced by one resident "Format library" index: a short
   read-on-demand instruction plus a `format | reach for it when | recipe
   file` table. Router is down from 1,725 to 568 lines. Verified:
   `check:fleet-skills` passes (29 files, 721 KB, under the 50-file / 2 MB
   caps, so NO dependency on D1); no em dashes; `eve build` materializes
   all 26 recipes into the seeded workspace resources; HTML and scaffold
   detail preserved (spot-checked). Each recipe has exactly one home.

   SUBJECT SPLIT DONE, 2026-07-19. The "Subject decision rules" block was
   separated along its two real axes and the cross-cutting law kept
   resident. Five content-subject files landed in `references/subjects/`
   (letters, counting, cvc-phonics, essay-writing, math-operations) and
   six pedagogy-approach files in `references/approaches/`
   (direct-instruction, play-based, charlotte-mason, montessori,
   singapore-math, balanced-literacy), extracted byte-verbatim by script.
   The router keeps a trimmed intro, a two-part routing table (page
   subject -> subjects/ file; family approach -> approaches/ file; a page
   can need both), and the resident "Math practice laws" (answer key,
   open response not bubbles, Challenge block, photo offer) that must
   apply to every math page whether or not a file loads. Verified: all 11
   distinctive blocks moved to the right file and left the router; the
   math law is still resident; `check:fleet-skills` passes (40 files,
   722 KB); no em dashes; `eve build` materializes all 11 files. Router is
   now 482 lines, down from the original 1,725.

   D1 remains needed only for Phase B's image assets; the entire
   references restructure (recipes + subjects + approaches) shipped under
   the existing 50-file / 2 MB caps.
3. Raise the package caps (D1) and extend `check:fleet-skills`: every
   recipe linked from the format index, every manifest id resolves to
   an existing asset, every asset appears in the manifest, and no
   recipe exceeds a per-file line budget.
4. Routing regression: existing positive and adversarial-negative
   fixtures still pass, plus second-hop fixtures proving Homa reads the
   right recipe file for representative briefs (a resolver eval on the
   read, not just the trigger).

### Phase B: style anchors + generate_image extension

1. `styleReferenceIds` per 3.2, with tests: resolution, combined-cap
   enforcement, family-scope regression on the URL path, subject-lesson
   restriction still holding.
2. Seed the first golden set on the bench for the 8 strongest formats
   (foldable, structured outline, cut-and-paste word work, maze
   practice, number practice page, nature poster, labeled diagram, mini
   book): run briefs, founder-approve winners, compress (longest side
   ~1024 px, 60 to 150 KB each), land in `assets/refs/` with manifest
   entries.
3. Update those 8 recipes to name their anchors and the reference
   prompt pattern ("keep the panel structure and line weight from the
   reference; replace the subject with ...").

### Phase C: recover the visual corpus, recalibrate the path table

1. Recover the 2,843 stranded page renders from Cosmo's machine, or
   re-pull the source PDFs (D4). They land in `.cosmo` only (per D2),
   grounding future recipe and anchor work.
2. Extend `scripts/materials-calibration.mts` with reference
   conditions: same brief run image-direct bare, image-direct plus
   anchor, html, hybrid, scored by the vision reviewer against the
   PRINT render, not the screen render (closes the 07-19 false-pass
   class at the calibration layer too).
3. Re-run calibration; update the path table only from the report.
   Expected direction, to be confirmed: image-direct plus anchor
   becomes the default for art-led formats, html keeps text-dense and
   geometry-exact formats, hybrid keeps the middle.

### Phase D: computational correctness + recipe gaps + flywheel hygiene

1. `compute_practice_content` per 3.3, then recipes for the flagged
   gaps with demand signal: angle-maze, fraction-link, hex-grid and
   decimal-path puzzles, monthly planning calendar, sensory-bin cards,
   read-aloud companion, letter-hunt cards, experiment cards, art
   lesson, i-have-who-has. Computational ones route through the tool;
   each lands with a bench brief and, once approved, a golden anchor.
2. `.cosmo` hygiene (coding side): re-sync `references/index.json`
   (146 indexed vs 180 sidecars, 3 orphan rows), normalize subject
   casing, adopt a controlled `format` vocabulary (~80 free-text values
   today).
3. Wire graduation into `reference-ingestion`: durable patterns file
   against the specific recipe file, update-not-duplicate as the dedup
   rule.

Out of scope, tracked separately: the upload-for-review loop (completed
pages graded into a learner profile) and the lesson-planner skill (the
missing layer 2, Sid 2026-07-18); lesson-planner is also the first real
candidate for workspace write access, which is where the `write_file`
sentinel decision returns.

## 5. Founder decisions needed

- **D1, package caps.** Needed for Phase B only, NOT for the Phase A
  restructure (verified: a references-only split stays under the current
  50-file / 2 MB caps). Raise `MAX_SIBLING_FILES` 50 → 150 and
  `MAX_PACKAGE_BYTES` 2 MB → 16 MB (per-file 512 KB stays) before the
  image library lands; amends the filesystem-first plan §8.1 numbers.
  Recommendation: yes; the caps predate any skill bundling assets, and
  compressed exemplars near 100 KB keep even a 100-image library around
  10 MB.
- **D2, golden-exemplar law.** Shipped anchors are Homa-authored and
  founder-approved only; external inspo never ships in the product or
  reaches family-facing generation. Recommendation: yes.
- **D3, budgets to watch, not change yet.** Keep
  `MAX_IMAGES_PER_FAMILY_PER_DAY` at 30 and watch `model_usage` for a
  week after Phase C (anchored image-direct raises image calls per
  material). Also watch Vercel Sandbox spend once recipes are read per
  build; the Phase A probe supplies the latency and cost baseline.
- **D4, corpus recovery.** The stranded renders need Cosmo's machine or
  a re-pull of the source PDFs; founder-side action either way.

## 6. What 100x means, concretely

Today: one 1,725-line document Homa swallows whole, 24 recipes held
simultaneously, 2 reference images nothing taught it to open, an image
model used blind, and answer keys composed from prose.

After: a router read in two seconds; thirty self-contained recipe cards
opened one at a time through a substrate that already exists; a
founder-approved, Homa-owned visual library the image model sees on
every art-led page; answer keys and puzzles that are computed, never
imagined; a calibration harness scoring the print render; and a weekly
flywheel where an inspo drop becomes a recipe card and a golden anchor.
No new file tools, no new distribution system, one tool extension and
one new computation tool. The skill stops being a document and becomes
a studio with a style guide, a reference wall, and a quality gate.
