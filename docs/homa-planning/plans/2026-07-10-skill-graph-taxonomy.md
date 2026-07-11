# Skill graph taxonomy · subject → domain → topic, built on Marble's corpus

> Status: PLAN (founder direction 2026-07-10 afternoon, chat-derived).
> Locked below: the three-level shape and its names, adopting the Marble
> dataset maximally, the id and provenance scheme (no `marble_id`), the
> license posture, what survives from today's bank, and the
> domain-to-subject rename. Explicitly deferred: the Life Skills subject's
> fate, exact storage split (repo data vs DB) beyond the recommendation
> here, and the full English/PSD import curation, which is implementation
> work, not architecture.

## Founder direction, distilled

1. The Mac Mini vs cloud comparison (2026-07-10) showed the cloud map is
   missing the layer between subject and question: the Mac Mini scores 78
   named skill lines for one child, the cloud scores 16 numbers. The strand
   layer is the biggest gap.
2. Marble's open taxonomy (github.com/withmarbleapp/os-taxonomy) landed on
   the same three-level shape independently and adds a prerequisite graph.
   Founder: adopt it maximally. "We're at the beginning stages of building
   out the architecture, so we might as well use the best architecture
   possible and build on top of what's best."
3. Do not gate on licensing now; attribute when it matters (public use or
   redistribution of a derived taxonomy). Logged in build-log 2026-07-10;
   attribution line staged in `docs/homa-benchmarks/marble/README-HOMA.md`.
4. Ids are Homa's own. No `marble_id` field; Marble keys are lineage
   references, not identifiers (ruling 2026-07-10 evening, see § Ids).
5. Zero-user moment: breaking renames (domain → subject) and id-stable
   migrations are nearly free today and never will be again. Do them in one
   window, not two.

## What exists today (verified 2026-07-10)

- **The cloud bank**: `packages/core/src/map/content.ts`, 224 items across
  16 domains (which this plan renames to subjects), each item
  `<subject>.<slug>` id, statement, typicalMonths anchor, optional
  typicalRangeMonths window, sources + standards citations. Versioned
  (`MAP_BANK_VERSION`), scored by the deterministic scorer
  (`scoring.ts`) with honesty rules (window credit, age-scaled cap,
  beyondScale). `pnpm check:map` guards content + scorer from fixtures.
- **Answers**: `child_answers` / `lead_answers` keyed by `(child, item id)`
  with a chip answer and a provenance enum (checklist, deep_dive,
  report_correction, report_probe, recheck). Item ids appearing in stored
  rows means id stability is a data-migration concern, handled by this
  plan's id scheme (existing ids never change).
- **The Mac Mini reference system** (`homa-macmini/`, read-only): 15
  domains, 78 subdomains, per-subdomain free-text state, verified dates,
  decaying confidence, months-ahead floats, nightly benchmark research,
  weekly rescore + snapshots, ambient observation capture. The living proof
  of what the strand layer plus loops feels like for one family.
- **The vendored Marble corpus**: `docs/homa-benchmarks/marble/` at
  upstream commit 96a7933 (v1). 1,590 micro-topics, 8 subjects, 54
  domains, ages 4-14; 3,221 prerequisite edges (2,025 hard, 1,196 soft,
  each with a one-line reason; 755 cross domains, 161 cross subjects; 100
  root topics; mean 2.16 prerequisites per topic); per-topic evidence[] +
  assessmentPrompt ({{name}} placeholder), type enum (CONCEPTUAL 810,
  PROCEDURAL 512, META 144, LANGUAGE 75, REPRESENTATIONAL 49), computed
  centrality (global max: one-to-one counting, 1.0); 183 parent-facing
  cluster summaries per (subject, domain, age band); 3,261 standards across
  7 curricula keyed `curriculum:code`. `node scripts/validate.mjs` passes
  from the vendored folder.
- **Sibling plan**: `2026-07-10-education-knowledge-architecture.md`
  (knowledge_bank + unified nightly research agent). That plan owns
  fleet-wide research knowledge; this plan owns the child-assessment
  taxonomy. The nightly research agent is the eventual writer that keeps
  BOTH fresh; reconcile with M3-04 before building either (unchanged from
  the sibling plan).

## The three levels and their names

Adopt Marble's vocabulary wherever Marble data flows in 1:1; keep Homa's
vocabulary wherever Homa is ahead (scoring and observation).

| Level | Name | Today | Notes |
|---|---|---|---|
| 1 | **subject** | called `domain` in code/DB | math, literacy, ... the 16. Rename to subject everywhere (code, jsonb scores, `child_plans.domain_id`, events, copy). Parent-facing copy already says "subject". |
| 2 | **domain** | missing (the gap) | Marble's level-2: Counting & Cardinality, Grammar & Punctuation, Self-Regulation & Resilience. 3-12 per subject. The Mac Mini's "subdomains". |
| 3 | **topic** | called `item` | The checkable unit. Existing 224 items become topics untouched; imported Marble micro-topics join them. |
| edges | **prerequisite** | none | `topicId depends on prerequisiteId`, `hard`/`soft`, one-line `reason`. |

Kept Homa concepts, unchanged: typicalMonths / typicalRangeMonths anchors
(only anchored topics are scorable), the chip answers, MapPosition
(ahead / on_track / growing / not_mapped), the honesty caps, exposureBased
(moves to the subject level), answer provenance, MAP_BANK_VERSION.

Adopted Marble concepts, new: `evidence[]` (2-3 observable mastery
criteria), `assessmentPrompt` (a runnable scenario with the child's name),
`type` (the five-value enum), `centrality` (recomputed over the merged
graph, not copied), clusters (parent summary per subject × domain × age
band), and a standards registry keyed `curriculum:code`.

Per the repo's exhaustive-switch rule: any new enum (topic type, edge
strength) ships with `never`-checked switches at every consumer.

## Ids and provenance (founder ruling: no marble_id)

- **Topic id**: Homa's existing bank convention, `<subject>.<slug>`
  (`math.comparing-groups`). Human-readable, stable, already what
  child_answers rows reference, so the 224 existing ids never migrate.
- **Domain is data, not id.** The id deliberately does NOT encode the
  level-2 domain, because domain assignment is the most likely thing to be
  re-curated; moving a topic between domains must never break an id or an
  answer row.
- **Lineage via namespaced refs**: each topic carries
  `refs: string[]` in the shape `<corpus>:<key>`, e.g.
  `marble:mt__h7hvT4tEb`, `ccss-math:K.CC.6`, `uk-nc-2013:Maths/Y1/NPV/4`,
  `elof:P-MATH-3`. Marble is one cited corpus among several, not a
  schema-level parent. Re-sync tooling finds Marble-derived topics by the
  `marble:` prefix; nothing else ever reads it.
- **Slugs on import** are generated from Marble topic names
  (kebab-case, deduped within subject), then frozen. A slug is an id, not
  a display name; display names can change freely.

## Scoring stays on the ladder; planning moves to the graph

Two progression models, deliberately both:

- **Score on the ladder.** The months-ahead read stays a pure function of
  anchored topics + chips + age (the deterministic scorer, unchanged in
  spirit). Only topics with a typicalMonths anchor are scorable; imported
  Marble topics arrive UNANCHORED (their age ranges are teaching windows,
  not norms) and join the scored set only when an anchor is authored with
  a citation. This keeps the honesty rules intact: the scorer never reads
  the graph.
- **Plan on the graph.** "What next" for plans, materials, and the agent
  becomes prerequisite closure over confirmed topics instead of the next
  age rung, and every recommendation can quote its edge reason (the
  receipts culture, extended to pedagogy). Scoring per DOMAIN (level 2)
  aggregates its topics' signals; the subject read aggregates domains, so
  the report can finally say "math: counting strong, patterns untested"
  instead of one number.
- **Centrality** is recomputed over the merged graph once Homa's
  extensions land, then used to rank which unknowns to probe first (the
  Mac Mini hand-judges "leverage"; the graph computes it).

## Subject mapping for the import

| Marble subject (domains) | Homa subject |
|---|---|
| Mathematics (12 domains) | math |
| English · Phonics & Word Reading | phonics |
| English · Handwriting & Transcription | writing |
| English · Writing Composition, Grammar & Punctuation, Spelling & Word Study | writing (composition/conventions domains) |
| English · Reading Comprehension, Vocabulary | literacy |
| English · Speaking & Listening, English Thinking | language |
| Science (19 domains; several interest-led) | science |
| History (4 domains) | social_studies (as domains) |
| Personal & Social Development (6 domains) | social_emotional; Self-Regulation & Resilience splits partially into executive_function at curation |
| Learning to Learn | executive_function |
| Computing / AI | computer_science |
| Life Skills (Money & Finance, Entrepreneurship) | **parked as its own imported subject; founder decision pending** (very homeschool-shaped, no current Homa home) |

Interest-led science domains (Dinosaurs & Paleontology, Ocean Life,
Rainforests, Polar Regions, Volcanoes & Earthquakes) import as CONTENT
clusters usable by the materials studio, not as assessment domains: kid
obsessions are hooks, not milestones. Homa-only subjects with no Marble
counterpart, authored by Homa in the same shape with anchors from
`docs/homa-benchmarks/` and the Mac Mini benchmark files: gross_motor,
fine_motor, self_care, music, art, spanish, plus the 2-4 age band across
every subject (Marble's floor is age 4; Homa's funnel starts at 2).

## Storage (recommendation, revisit at implementation)

The taxonomy is versioned, deterministic, CI-guarded content, like the
bank today: keep it as data files in `packages/core` (generated by the
import script, never hand-ordered), loaded by the same pure functions,
validated by an extended `check:map` (referential integrity, DAG
acyclicity, slug uniqueness, anchored-topics-have-citations; port the
ideas in Marble's validate.mjs). The DB holds per-child state only
(answers, reports, plans), exactly as now. A DB copy of the taxonomy
becomes worth it only when a runtime writer exists (the nightly research
agent proposing new topics/anchors), and that writer's shape is the
sibling plan's `knowledge_bank` pattern: proposals land there first,
promotion into the bank stays a versioned, reviewed content change.

## What this deliberately does not decide yet

- Life Skills: own subject, folded into another, or dropped. Founder call.
- The full curation pass on English/PSD domain splits (import lands them
  per the table; curation refines).
- When `record_observation` (the agent-to-map write path, gap #2 of the
  Mac Mini comparison) gets built. This plan makes its target shape
  possible (evidence + prompts per topic); the tool itself is its own
  ticket.
- Whether an open-sourced Homa taxonomy is ever a moat play the way
  os-taxonomy clearly is for Marble. Founder call, later, alongside the
  attribution moment.
- Exact enum membership for topic types beyond Marble's five.

## Sequencing

1. **DONE 2026-07-10**: corpus vendored (data lives at
   `packages/taxonomy/data/`, license + provenance paperwork at
   `docs/homa-benchmarks/marble/`); rulings logged in build-log.
2. **DONE 2026-07-10 (evening build)**: `@homa/taxonomy` assembles the
   Homa graph at runtime from the vendored data + the frozen slug map
   (`data/homa-slug-map.json`, generated append-only by
   `pnpm taxonomy:slugs`): 1,590 topics under Homa ids, 3,221 edges, 102
   domains (55 Marble-derived + 47 authored, six subjects fully authored),
   183 clusters, standards registry, centrality recomputed over the Homa
   graph. Non-destructive: the shipped 224-item bank and scorer untouched.
3. **DONE 2026-07-10 (evening build)**: the rename window. domain →
   subject across packages/core, apps/web, events registry + emitters,
   route segment `plan/[subjectId]`, guards; DB migration
   `20260711003000_subject_rename` renamed `child_plans.domain_id` →
   `subject_id` and rewrote scores/history/plan jsonb in place (7 reports,
   7 plans; verified). The 224 bank items each carry a level-2 domain via
   `packages/core/src/map/item-domains.ts`.
4. **DONE 2026-07-10 (evening build)**: `pnpm check:taxonomy` guards the
   graph (mapping completeness, id law incl. bank-collision, DAG
   acyclicity, registry law, refs resolve) and runs in CI beside the other
   guards.
5. **PARTIAL**: the live loop shipped ahead of schedule: the
   `record_observation` agent tool writes conversational reports into
   child_answers with provenance `conversation`, rescores with the same
   deterministic scorer, regenerates the report narrative off-turn, and
   returns the fresh reading plus receipts (level-2 skill line, next
   unanswered ladder rung, and a personalized try-at-home probe from the
   graph's hub topics). STILL OPEN from this step: plan jsonb enrichment
   (prerequisite-closure "what next" with edge reasons inside
   `child_plans.plan`) and report domain-level receipts, deferred because
   plan schemas and report copy are gated surfaces.
6. Author the missing coverage in Marble shape WITH anchors: the 2-4 band
   topics inside the authored domains (registry exists; topics do not yet;
   the anchored bank items cover assessment there for now). Target
   resolution per the Mac Mini's 78 strands; expect the merged corpus to
   land near 2,000 topics.
7. Wire centrality into probe/plan prioritization beyond the
   record_observation probe (it already ranks that tool's try-at-home
   suggestion).
8. The remaining Mac Mini loops in their own tickets: per-topic freshness
   decay (verified dates on answers exist; the decay policy does not),
   snapshot cadence for trajectory, proactive micro-questions
   (journal_prompt is still dark in prod).
