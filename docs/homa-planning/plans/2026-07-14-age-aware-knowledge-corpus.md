# Age-aware knowledge corpus · classify research by stage and lens

> Status: BUILT 2026-07-14 (KC-1 through KC-4 landed in one pass;
> founder ruling "be uniform, then implement the plan"). Extends
> plans/2026-07-10-homa-tasks-and-nightly-research.md (the two-tier
> research architecture, D-ht-1) without changing its cost doctrine. It
> is the substrate the multi-kid work depends on
> (plans/2026-07-13-morning-brief-multikid-directions.html options 8 and
> 9: research rails for custom tasks, and overnight pre-compute). All
> fleet numbers below are measured against homa-prod on 2026-07-14, not
> estimated.
>
> Build state: SHIPPED to homa-prod 2026-07-14. Additive migration #51
> applied (nullable stage/lens columns, cell index, lens backfilled from
> topic_type: 15 how_to_teach, 12 method, 2 current_study, all stage-null
> under dual-read); it led the deploy per the additive rule. Code merged
> to main (commit 108b25e) and deployed: CI green, Vercel READY and
> aliased to thankshoma.com, eve runtime health + app probes 200.
> Verified green before push: typecheck, pnpm build, eve build, lint,
> check:map, check:taxonomy, check:isolation, check:tasks-ui (+2 new
> tests), check:child-progress, check:progress-ui. Two changes beyond the
> written tickets: the map scorer now emits frontierItemId/frontierDomain
> (KC-1 prerequisite), which bumped CHILD_PROGRESS_PROJECTION_VERSION 2 to
> 3 so stored projections recompute instead of failing a strict parse; and
> custom-task research context is gated by a RESEARCH_SIGNAL keyword match
> (KC-4) so reminders stay plain.
>
> Backfill (KC-5) ARMED, not yet run: RESEARCH_TOPICS_PER_NIGHT=10 set in
> prod and baked into the live deployment. FLEET_RESEARCH_ENABLED was
> already true (9 fleet runs over the prior 3 nights). The nightly
> fleet-research cron (47 6 UTC, about 2:47am ET) is the only trigger,
> prod exposes no manual fire, so the first stage+domain-tagged rows land
> on the next cron. At 10 cells/night the reachable grid (~a couple dozen
> cells now, hundreds as the fleet's ages spread) fills over roughly two
> to three weeks; drop RESEARCH_TOPICS_PER_NIGHT back to 3 after, or the
> nightly spend stays at the backfill rate.

## Why now (measured, not assumed)

The fleet is no longer the early-childhood cohort the corpus was shaped
for. As of 2026-07-14, homa-prod:

- 58 families, 19 children, 13 children with scored reports across 8
  families.
- Child age distribution (19 kids), **average age 8.5 years**:

| Stage | Age | Kids |
|---|---|---|
| under 2 | < 2y | 0 |
| toddler | 2 to 3y | 1 |
| preschool | 3 to 5y | 4 |
| early elementary | 5 to 8y | 5 |
| upper elementary | 8 to 11y | 2 |
| middle | 11 to 14y | 5 |
| high | 14 to 17y | 2 |
| over 17 | >= 17y | 0 |

Seven of nineteen kids are 11 or older. The developmental span in use
runs the full 2 to 15 today.

- All 16 map subjects are reachable (every report scores all 16).
- Corpus today: 29 active rows: 15 `subject`, 9 `method_philosophy`, 3
  `method_format`, 2 `study`. That is roughly **one age-blind row per
  subject** serving children from 2 to 15 at once.
- Styles in use: 4 of 9 (charlotte_mason x4, eclectic x2, traditional
  x2, classical x1). Curriculums in use: ~13 distinct, long-tail, mostly
  one family each.
- The two `study` rows carry an average TTL of 273 days, not the ~14 the
  research guidance intends. The "weekly studies scan" is not rotating,
  because TTL is a model-supplied argument the research session sets
  loosely.

The failure the founder named is live right now: a single `subject/math`
row cannot be correct for a 3-year-old and a 14-year-old at the same
time, and whichever the last run targeted is what every family gets. The
brief composer papers over it with the child's scored positions plus a
top-up search; the per-kid custom tasks (which skip that context) cannot.

## The problem in the schema, precisely

A corpus row is addressed by `(topic_type, topic_key)` and carries no
developmental or purpose axis (migration #50,
`supabase/migrations/20260711031000_knowledge_bank.sql`). The read query
compounds it: every `study` row matches every family with no age gate,
and subject rows match on key alone
(`apps/web/lib/knowledge/gate.ts`, `freshKnowledgeForTopics`):

```
and (
  (topic_type in ('method_philosophy', 'method_format')
    and topic_key = any(styleKeys))
  or (topic_type = 'subject' and topic_key = any(subjectKeys))
  or topic_type = 'study'
)
```

The product already owns a rich developmental index that the corpus
ignores: `teachingWindowMonths` per taxonomy topic, annual
`ageBandStartMonths` clusters, `SCORED_MIN_MONTHS`/`SCORED_MAX_MONTHS`
(24 to 204) in `packages/core/src/map/bands.ts`. The fix is to make the
corpus speak that language, not to invent an age model.

## The reframe

Do not schedule "bigger age-batched runs" as a mechanism. That treats
age as a scheduling trick. Add **stage** and **lens** as first-class
classification facets, and both scheduling and matching become age-aware
for free, while the same research investment serves every consumer (the
morning brief, per-kid custom research, chat context injection, the
materials studio). Age-batching then falls out as one query pattern used
during backfill, not as the design.

## Decisions needed (founder rulings before build)

- **D-kc-1 · stage bands.** Proposed five, each populated by the current
  fleet and aligned to where content shifts: early years (2 to 5),
  early elementary (5 to 8), upper elementary (8 to 11), middle (11 to
  14), high (14 to 17). Alternative: split early years into toddler and
  preschool later, when that end fills in. One ruling sets the boundary
  constants.
- **D-kc-2 · lens set.** Proposed six: `develops_when`, `how_to_teach`,
  `current_study`, `method`, `curriculum`, `red_flags`. These are a
  superset of today's five `topic_type` values, which conflate the first
  three under `subject`/`study`.
- **D-kc-3 · topic_key granularity. RESOLVED (2026-07-14, founder
  ruling): domain-level keys for every subject.** Fleet data proved math
  needs domain keys (same-stage-different-domain scatter: addition vs
  multiplication at 5-8, multiplication vs ratios at 11-14, five math
  domains live across 13 kids). Literacy did not show scatter in the
  sample, but N=13 with one to three kids per stage is too thin to
  conclude its domains are stage-sequential (reading-comprehension alone
  spans ages 5 to 15 in the bank), and most subjects are structurally
  parallel like math (phonics oral vs print, writing hand vs
  composition, science inquiry vs content strands, the motor and
  executive-function lines). Two reasons make the uniform rule right
  rather than a slippery slope: (1) matching by domain is free for every
  subject once the scorer emits `frontierDomain`, because
  `BANK_ITEM_DOMAINS` is already total (check:taxonomy); (2) **keying is
  not coverage.** Domain keys make the corpus addressable at domain
  grain; the demand queue still researches only the `(domain, stage)`
  cells a real child's frontier lands in, so thin or unreached domains
  never get a run. Uniform keys also avoid a re-keying migration when
  scatter later appears in a subject that looked coarse at low N. Key
  every subject at the taxonomy domain, crossed with stage.
  **Prerequisite:** the scorer emits only `frontierStatement` text today;
  add `frontierItemId` / `frontierDomain` to `SubjectScore`
  (deterministic, `scoring.ts:182-192` already holds the item) so
  matching keys by domain without reverse text-matching. **Uniform
  (founder ruling 2026-07-14, "be uniform"):** every lens keys by domain,
  including the `develops_when` reference lens; no subject-broad
  carve-out. `current_study` stays a per-stage rolling scan (a new study
  is not a single map domain) but is stage-tagged like everything else.
- **D-kc-4 · TTL by lens, set in code.** Stop trusting the model's
  `freshnessTtlDays`; set the default TTL from the lens (see the cadence
  table). The 273-day study rows prove the model does not honor the
  intent.
- **D-kc-5 · backfill posture.** Raise `RESEARCH_TOPICS_PER_NIGHT`
  (already 1 to 10) during a two-to-four week backfill, then idle back
  to maintenance. Confirm the temporary spend.

## Architecture

### 1. Classification: the cell

The unit of research becomes a **cell**: `(lens, topic_key, stage)`.
Additive columns on `knowledge_bank`, all nullable so existing rows and
the current read path keep working during dual-read:

| Facet | Source | Notes |
|---|---|---|
| `topic_type` (have) | unchanged | kept for dual-read; `lens` supersedes it |
| `topic_key` (have) | taxonomy DOMAIN slug for subjects (D-kc-3), style slug, curriculum slug | domain for every subject and every lens (uniform, D-kc-3) |
| `stage` (new) | enum from `packages/core` bands | null = stage-agnostic (pure philosophy, some methods) |
| `lens` (new) | enum, D-kc-2 | the purpose the row was researched for |
| `source_tier`, `confidence` (have) | unchanged | evidence gate, already enforced |
| `freshness_ttl_days` (have) | set by lens in code (D-kc-4) | drives rotation |

`stage` and `lens` are orthogonal to `topic_key`. That orthogonality is
what "usable at scale for different purposes" means: the brief queries
`develops_when + how_to_teach` at the kid's stage, chat context queries
`method` for the family's style, materials queries `how_to_teach`. One
library, faceted reads, no duplicated research.

The stage enum lives in `packages/core` next to `bands.ts` so the map,
the demand query, and the read query share one definition and cannot
drift.

### 2. Research types, purposes, and cadence

Cadence follows how fast each lens changes in the world (volatility),
which `freshness_ttl_days` already models per row:

| Lens | Question it answers | Volatility | TTL |
|---|---|---|---|
| `develops_when` | What a child at this stage typically does in this topic | near-static | 365 |
| `how_to_teach` | Current best guidance for teaching it at this stage | moves with research | 90 |
| `current_study` | Notable new research worth a parent's attention, per stage | fast | 14 |
| `method` | What a philosophy looks like in practice, by stage where it matters | slow | 180 |
| `curriculum` | What a product is, current edition, who it fits | seasonal | 120 |
| `red_flags` | When something merits a professional look (research-only, never texted) | rare, stable | 365 |

### 3. Scheduling: demand-weighted cells, not exhaustive batches

Keep the engine (`agent/schedules/fleet-research.ts`, nightly, env-gated,
one session per cell), widen its unit. Three changes to the demand queue
(`apps/web/lib/knowledge/demand.ts`):

1. **Group by domain and stage.** Join `children` on `birth_month` to
   derive each scored child's stage, and group by the child's frontier
   domain (D-kc-3) plus stage: `count(distinct child_id) group by
   frontierDomain, stage`. Demand is now per `(domain, stage)` cell,
   which is exactly the frontier a research row should target: the two
   5-to-8 kids on different math domains create demand for two different
   cells, not one blurred `math` cell. The queue still emits only a
   domain key plus a coarse stage band, never a child identifier, so
   D-ht-1's privacy-by-construction holds.
2. **Fan a demanded cell across the lenses it earns.** A hot subject
   stage cell queues `develops_when` once (long TTL) and `how_to_teach`
   on rotation; methods and curriculums queue their own lenses.
3. **Order by demand x staleness x tier gap.** Favor cells that are
   missing or past TTL and wanted by the most kids, extending today's
   `order by demand desc`.

Backfill is the one place age-batching is right: to populate the grid
cold, sweep stage by stage at a raised nightly count, then drop to
demand-weighted maintenance where only aged-out or newly reachable cells
run.

### 4. Matching: stage-scoped reads

`freshKnowledgeForTopics` takes the family's kids' stages and returns the
cells each consumer needs; the `or topic_type = 'study'` firehose becomes
a stage filter. Per-kid custom research tasks inherit the same context
load, which is what removes their 8x cost and privacy drift (the
multi-kid doc's option 8).

### 5. Capacity (measured inputs; 73 taxonomy domains, five stages)

With uniform domain keys across every lens (D-kc-3), the subject lenses
key by `(domain, stage)`. Steady-state nightly need is the sum of
`active_cells / TTL` per lens:

| Lens | Cells | Basis | TTL | Rows/night |
|---|---|---|---|---|
| develops_when | ~140 | 73 domains, each reachable in ~1 to 2 stages | 365 | 0.38 |
| how_to_teach | ~140 | 73 domains, each reachable in ~1 to 2 stages | 90 | 1.56 |
| current_study | 5 | one per stage | 14 | 0.36 |
| method | ~6 | 4 styles, a couple stage splits | 180 | 0.03 |
| curriculum | ~13 | reachable products | 120 | 0.11 |
| **Total** | **~304** | | | **≈ 2.5 / night** |

Keying is not coverage: the ~140 cells per subject lens are the
addressable ceiling, not a to-do list. The demand queue researches only
the cells a child's frontier actually lands in, so a thin or unreached
`(domain, stage)` never gets a run. At the current fleet only a couple
dozen cells are reachable at all.

Maintaining the corpus costs ~2 to 3 rows per night, at or under today's
default of 3. The cold **backfill** of the ~304 addressable cells is the
real spend, and only the reachable subset needs filling at all: ~51
nights at 6/night, ~30 at 10/night. `develops_when` is near-static
reference built once (365-day TTL); front-load `how_to_teach` for the
hottest frontier cells (preschool, early elementary, and middle hold the
most kids) and the felt quality arrives in about a week.

The scaling property, now concrete: the grid is bounded by the taxonomy,
not the fleet. Domains cap at 73, stages at ~5 to 7, styles at 9,
curriculums demand-gated. At 10x or 100x families the grid asymptotes
near 300 cells total and steady-state stays ~2 to 3 rows/night forever.
This is O(cells), not O(families): the same property D-ht-1 was written
to protect, deepened by two axes (stage and domain) at near-zero
marginal cost, because demand-weighting gates coverage.

## Tickets

### KC-1 · Stage + lens classification (schema + core enum)
- Additive migration: `stage text null`, `lens text null` on
  `knowledge_bank` with checks; indexes on `(lens, topic_key, stage,
  status)`. Additive-only, so it may lead the deploy.
- Stage enum + boundaries in `packages/core` beside `bands.ts`
  (`stageForAgeMonths`), shared by map, demand, and reads.
- Scorer emits the frontier's domain (D-kc-3 prerequisite): add
  `frontierItemId` and `frontierDomain` to `SubjectScore`
  (`packages/core/src/map/scoring.ts`), sourced from `domainForBankItem`
  on the frontier item the scorer already resolves. Needed before ANY
  subject can match by domain (D-kc-3 keys all subjects by domain);
  `BANK_ITEM_DOMAINS` is total per check:taxonomy, so every frontier
  resolves cleanly. Additive to the scores JSON, no rescoring required
  (new reports carry it, old reads fall back to subject).
- Backfill the 29 existing rows: infer stage from content where possible,
  else null; map `topic_type` to `lens`. Keep `topic_type` for dual-read.
- Acceptance: `pnpm check:isolation` green before the migration; existing
  brief reads unchanged while `lens` is null.

### KC-2 · Gate + save tool speak facets
- `lib/knowledge/gate.ts` and `agent/tools/save_knowledge.ts` accept
  `stage` and `lens`; TTL defaults from lens (D-kc-4), overridable only
  downward.
- `agent/instructions/research-mode.ts` teaches the session to research
  exactly one cell and tag it, with the stage-appropriate source rules.
- Acceptance: a research fixture saves a stage-tagged row; a study row
  lands with TTL 14, not 273.

### KC-3 · Demand queue by cell
- `lib/knowledge/demand.ts`: join children for stage, group by
  `(frontierDomain, stage)`, fan across lenses, order by demand x
  staleness. Emit domain key + stage band only (no child identifiers);
  extend `scripts/isolation-check.mjs` coverage.
- Acceptance: query review proves no child-identifying strings leave the
  queue; the two 5-to-8 kids on different math domains produce two
  distinct demanded cells, not one blurred `math` cell.

### KC-4 · Stage-scoped matching + custom-task context
- `freshKnowledgeForTopics` filters by the family's kids' stages; the
  `study` branch gates by stage.
- Feed the brief context loader into custom research tasks
  (`lib/tasks/dispatch-input.ts` `customMessage`), closing the
  multi-kid doc's option 8.
- Acceptance: a synthetic 8-year-old family never receives a
  preschool-stage study row; a custom research task cites a
  stage-matched corpus row instead of researching from scratch.

### KC-5 · Backfill sweep + maintenance idle
- Ops runbook: raise `RESEARCH_TOPICS_PER_NIGHT` for the backfill window,
  monitor `model_usage`, drop to 3 when the grid is warm.
- Acceptance: after the window, active cells cover every reachable
  `(domain, stage)` for the top lenses; nightly count returns to
  maintenance.

### KC-6 · Manual control, duplicate-work prevention, condensed lab

Founder direction 2026-07-14: an operator or repo-aware agent must be
able to trigger due or explicit research cells immediately, run several
sequential rounds inside an hour, inspect how rows organize, and prove
that later runs do not follow the same article/finding path.

- One shared runner (`lib/knowledge/research-run.ts`) owns scheduled,
  manual, and lab starts. A partial unique index on
  `homa_task_runs.research_cell_key` while status is `running` is the
  cross-process lock. The key is topic-wide, not cell-wide, because
  prior-source dedup also spans every lens and stage for a topic: a cron
  and manual trigger may race on different Dimensions Math cells, but
  only one can spend against that topic. `research_trigger` records
  scheduled, manual, or lab provenance.
- Before a session starts, `loadPriorResearch(topicKey)` loads prior
  active, superseded, and flagged rows across every lens and stage. The
  prompt names prior findings and canonical article URLs as exhausted.
  Same website with a different specific page is explicitly allowed.
- The gate independently canonicalizes URLs (removing fragments,
  `www`, trailing slashes, and tracking parameters) and rejects any
  previously used specific page for that topic. It also rejects a
  near-repeat citation claim using deterministic token overlap. This
  makes the no-repeat rule enforceable even when the model ignores the
  dossier.
- Internal route `POST /eve/v1/research/run`, authenticated with
  `CRON_SECRET`, accepts `{ count: N }` for due queue cells or explicit
  `{ cells: [{ lens, topicKey, stage }] }` for focused re-research.
- `pnpm research:run` is the operator command. `pnpm research:lab`
  runs sequential rounds, polls durable run rows, writes Markdown and
  JSON reports under `.tmp-research-lab`, audits source hosts,
  canonical-page overlap, near-claim overlap and gate flags, and can
  revert its rows by run id with `--revert`. Cleanup is transactional and
  newest-first so a predecessor restored by round B is subsequently
  flagged when round A is cleaned. A timed-out lab marks still-running
  runs failed; the save gate refuses their late output.
- Acceptance: two sequential explicit runs of one topic use different
  canonical pages and materially different claims, or the second run
  honestly saves nothing; two simultaneous triggers of one cell produce
  one running session; an unauthorized trigger is 401; a lab report
  shows organization, sources, overlaps and cleanup receipts.

## Sequencing

1. **KC-1** (schema + enum; nothing parent-visible, zero risk while
   `lens` is null).
2. **KC-2 to KC-3** (writes start producing faceted rows; corpus fills
   in the new shape behind the same env gate).
3. **KC-4** (readers switch to stage-scoped once enough cells exist;
   this is the parent-visible flip).
4. **KC-5** (backfill, then idle).
5. **KC-6** (manual trigger and condensed validation; no new research
   semantics, all paths reuse the KC-1 through KC-4 runner and gate).

## Cost posture

Fleet: bounded by cells, not families (measured ceiling ~250 to 300
cells; steady-state ~2 rows/night at any fleet size). Backfill is a
one-time ~3 to 5 week trickle at a raised knob. Every call already lands
in `model_usage` under `fleet_research` per the plan-included ruling in
08-billing. No new per-family research is introduced; the custom-task
context load (KC-4) reduces per-family spend.

## What this deliberately does not do

- No per-family open web research (D-ht-1 stands); stage is a coarse
  band in the queue, never a child identifier.
- No new delivery or scheduling system; it widens the unit of the
  existing nightly job and the existing read query.
- No taxonomy change; it indexes the corpus against the taxonomy that
  already exists.
- No forced domain-level coverage: rows are KEYED by domain uniformly
  (D-kc-3), but the demand queue only researches the `(domain, stage)`
  cells a real child's frontier lands in, so the corpus fills exactly
  where kids are and stays empty everywhere else.

## Open questions

- Exact stage boundaries and whether early years splits now or later
  (D-kc-1).
- ~~Domain vs subject granularity (D-kc-3)~~ RESOLVED 2026-07-14
  (founder ruling): domain-level keys for every subject, coverage gated
  by demand. See D-kc-3.
- Whether `red_flags` research should exist at all pre-PMF, given it is
  never parent-visible and carries the most care.
- Whether methods need stage splits (montessori-for-3s vs
  montessori-for-9s) or stay stage-agnostic; the four styles in use are
  too thin to tell yet.
- Whether the deterministic near-claim threshold is too strict or too
  loose on real research prose. The condensed lab measures gate flags
  and claim overlap before the threshold is tuned.
- How quickly explicit repeated research exhausts credible new sources
  for a narrow curriculum topic. The correct terminal result is
  "no new delta," not a forced row; the condensed lab makes that visible.
