# Onboarding depth fork · mom-chosen graph walks that find where a kid tops out

> Status: PLAN (founder direction 2026-07-11 small hours, chat-derived).
> Locked below: the four rulings (longer-first posture, the per-subject
> fork, day-one instrumentation, the two-track scoring reconciliation).
> Deferred: card copy itself (gated), exact budget numbers (data
> decides), the anchoring pipeline's cadence, SMS onboarding parity.

## Founder direction, distilled

1. **Err toward a longer, smarter first assessment.** "I'd rather make
   the assessment longer at first, then have some moms take it, and
   complain, then we will shorten it. Instead of making it short, and
   then Homa is dumb." Depth is the default posture; shortening is a
   correction we make from evidence, never a preemptive fear.
2. **The mom decides the depth, per subject, inline.** After a
   subject's core questions finish: "want to dive deeper into
   [subject A], or move on to [subject B]?" Two taps. Depth is offered,
   never imposed (offers-never-commands law). The moms who go deep
   self-select; the ones who would have complained just tap "move on".
3. **Instrument from day one** (founder: "agree do this"): fork
   take-rate and mid-walk drop-off per subject, through the existing
   events registry, so "shorten it" becomes a data decision in two
   weeks instead of a complaint-driven one.
4. **Walk answers do not need the scorer to be worth collecting.**
   They feed the frontier, plans, and the agent immediately, and they
   graduate into the scored set per question when an anchor is
   authored with a citation. Altitude is already captured by the
   anchored ladder (a 3-year-old doing fractions climbs the existing
   rungs to the anchored fractions item); the walk adds the shape of
   her knowledge between and above the rungs.

## What exists today (verified 2026-07-11)

- **The checklist**: 16 subjects, base + climb on "easily"
  (`CORE_LADDER_RUNGS` 6 for math/literacy/phonics/writing/language,
  `MAX_LADDER_RUNGS` 2 elsewhere), client-computed by
  `planQuestions()` from the 224-item anchored bank. Answers POST to
  `/api/map/answer`; `saveAnswer` stamps `source = 'checklist'`.
- **The scorer skips unknown item ids** (`scoring.ts`:
  `if (!found) continue`). Walk answers stored under taxonomy topic
  ids are therefore invisible to months-ahead until a topic is
  promoted into the bank with an authored anchor, at which point
  already-stored answers start counting with no migration. This is
  the graduation mechanic, and it is already true.
- **`saveAnswer` validates against the bank only** (`getMapItem`), so
  taxonomy topic ids are rejected today. The walk needs its own
  server-side write path that validates against the taxonomy instead.
  `child_answers.source` is free text (the conversation provenance
  landed with no constraint change), so a new provenance value needs
  no migration.
- **The deep dive** (post-report, per subject): `nextDeepDiveItem`,
  age-midpoint probing over the anchored bank only, `DEEP_DIVE_CAP` 8
  per sitting, mode chooser (from memory / sit together). Stays as-is
  in this plan's first slice; the walk supersedes its engine later.
- **The graph** (`@homa/taxonomy`, server-only by intent, never in a
  client bundle): 1,590 topics under Homa ids, 3,221 hard/soft edges
  with reasons, 102 domains. Primitives already exported:
  `readyTopics` (frontier), `bottleneck`, `prerequisitesOf`,
  `unlockedBy`, `hubTopics` (centrality-ranked, teaching-window
  filtered), `teachingOrder`. Topics carry `evidence[]` and
  `assessmentPrompt` ({{name}} placeholder); `teachingWindowMonths`
  is explicitly NOT a scoring anchor.
- **`record_observation`** already writes conversational reports into
  `child_answers` with provenance `conversation` and returns a
  centrality-ranked probe: the drip that keeps walking the tree after
  onboarding exists.
- **Events registry** (MJ-08 law: no feature merges without its
  events): `EVENT_SCHEMAS` in `packages/core/src/events.ts`, emitted
  server-side via `emitMapEvent` (the anon policy stays
  waitlist-only). `map.question_answered` and `map.deep_dive_started`
  are precedent shapes.
- **`helpWith` + interests** are collected on the add-a-child card
  (or extras step) and stored on the child.

## The design

### The fork card

After a subject's core questions end inside the checklist (the
existing base + climb, untouched, so the score never depends on her
choice), one card:

- Default copy shape: "Want to go deeper on math, or move on to
  reading?" Two buttons, no third ask. "Move on" is never a loss: the
  report page keeps offering the same dive afterward.
- **helpWith bias**: for subjects she flagged in "where should Homa
  start", the fork leads with the payoff ("Since math is where you
  want Homa to start, a few more minutes here will pin down exactly
  where to begin. Or skip ahead."). Reassure-before-inform; still two
  taps.
- Which subjects get a fork at all, v1: the five core subjects plus
  any `helpWith` subject. Electives and motor domains stay light on
  purpose (same reasoning as `MAX_LADDER_RUNGS`). Data can widen this.
- Free signal: which subjects she chooses to go deep on is behavioral
  interest data, recorded by the fork event itself.

### The graph walk

A server-selected adaptive card sequence per subject. Pure-function
engine, same spirit as `nextDeepDiveItem` but over the DAG:

1. Seed with `hubTopics(subject, ageMonths)`: highest-centrality
   topics whose teaching window contains the child's age, filtered to
   `kind: "assessment"` domains only (content domains like dinosaurs
   are hooks, not milestones).
2. "Easily" climbs: candidates from `unlockedBy(topic)`; confirmed
   topics accumulate into the walk's confirmed set.
3. "Not yet" prunes: the topic's entire `unlockClosure` is
   unreachable and never asked; probing drops to `prerequisitesOf`
   to find her actual footing.
4. The walk ends when the per-sitting budget is reached (start at 8,
   `DEEP_DIVE_CAP` precedent; data decides), or when no informative
   card remains: the frontier (`readyTopics` over the confirmed set,
   scoped to the subject) is bounded above and below.
5. Output per subject: confirmed topics, the frontier ("tops out"
   line per level-2 domain), and the pruned ceiling. All of it lands
   in `child_answers`; the frontier read feeds plans and the agent
   immediately.

### The seam (server)

- New route, `/api/map/walk`: GET serves the next card for
  (child, subject) from the walk engine; POST saves an answer.
  Rate-limited like `/api/map/answer`; tenancy law applies (family
  from session, child re-scoped in the store; model-supplied ids
  never trusted).
- New store write path validating topic ids against the taxonomy
  (server-side import, keeping `@homa/taxonomy` out of client
  bundles and out of eve tool bundles; the JSON-loader lesson from
  record_observation, deploy failure 2026-07-10, applies).
- Provenance: `source = 'onboarding_walk'` (report-side entries
  reuse the value or add `report_walk`; implementation picks one and
  documents it). No migration needed.
- The scorer is untouched. Zero changes to `scoring.ts`, honesty
  rules intact by construction.

### The cards (content pipeline)

Every walk card is Homa-authored, parent-observable, in Homa voice.
Marble's `assessmentPrompt` + `evidence[]` are the raw material, and
every card passes the content laws and copy gates
(homa-copy-reviewer, then homa-copy-editor) before it ships, same as
the 224 bank items did. Curation starts with math (deepest Marble
coverage, 503 topics) plus the top `helpWith` subjects from real
extras data. Cards ship in batches; the walk engine simply skips
topics that have no authored card yet, so curation never blocks the
feature.

### Graduation into the scored set (later, ongoing)

Per topic, never bulk: author a `typicalMonths` anchor with a
citation, promote the topic into the bank (versioned content change,
`MAP_BANK_VERSION` bump, `pnpm check:map`), and every stored walk
answer for it starts counting retroactively (same table, same id
convention, scorer picks it up). Candidate order: highest centrality
first, then `helpWith` frequency. The nightly research agent
(sibling plan) is the eventual proposer; promotion stays a reviewed
change.

## Instrumentation (day one, founder-approved)

Three new registry entries, emitted server-side via `emitMapEvent`,
no PII in props (MJ-08):

- `map.depth_fork_decided` { family_id, child_id, subject,
  choice: "deeper" | "move_on" }. Take-rate per subject = share
  choosing deeper.
- `map.walk_answered` { family_id, child_id, subject, domain,
  answer }. The per-card heartbeat; domain is the level-2 skill line.
- `map.walk_ended` { family_id, child_id, subject,
  questions_answered, outcome: "frontier_found" | "budget_reached" |
  "stopped_early" }. Mid-walk drop-off per subject = stopped_early
  share; silent abandonment = deeper choices with no walk_ended row.

Registry parity (`pnpm check:events`) ships in the same PR as the
emitters, per the law. Review cadence: two weeks of real families,
founder reads take-rate, drop-off, and depth distribution, then
lengthens or shortens by data. That review is the fulfillment of
ruling #1, replacing the complaint loop.

## Sequencing

1. **DONE 2026-07-11 (small hours)**: Events + walk engine. The three
   registry entries; `packages/taxonomy/src/walk.ts` (knowledge fold,
   climb/prune card selection, outcome, per-domain summary) plus the
   authored-card layer `cards.ts` (empty, gated); 13 walk-engine laws
   in `pnpm check:taxonomy`, run against the real corpus.
2. **DONE 2026-07-11 (small hours)**: Server seam. `/api/map/walk`
   (serve + answer + end, one route) and the `/api/map/walk-fork`
   beacon; `lib/map/walk-store.ts` validates topics against the
   taxonomy and writes `child_answers` with source `onboarding_walk`.
   Dark by construction: with zero authored cards the walk serves
   nothing, and no UI calls it yet. This made apps/web the first
   full-package `@homa/taxonomy` importer under Next: the package
   joined `transpilePackages` and its relative imports dropped their
   `.js` suffixes to match @homa/core's convention (Turbopack took
   the suffixed paths literally and failed with module-not-found).
3. Fork card in the onboarding flow: new phase in `flow-types.ts`,
   wiring in `map-flow.tsx` at subject boundaries, fork + walk UI
   (walk cards reuse the checklist card rhythm and chips).
4. Card curation batch 1 (math + top helpWith subjects), through
   both copy gates.
5. Report-side entry: the report's existing "go deeper" gesture
   serves the same walk; the anchored deep dive stays for score
   sharpening (two tabs of the same gesture, or walk-first with the
   anchored climb folded in; implementation decides after seeing it).
6. Per-domain readings on the report ("counting strong, fractions
   frontier at equivalence, patterns untested"): gated copy surface,
   own ticket, after real walk data exists.
7. Anchoring pipeline (graduation): own ticket, reconcile with the
   nightly research agent plan.

## What this deliberately does not decide yet

- Exact budgets (8 per walk to start) and which subjects fork
  beyond core + helpWith: the day-one events exist to decide these.
- Card copy: gated, per batch, never merged unreviewed.
- Whether the walk's confirmed topics render on the report ladder
  as unanchored receipts: report copy is gated, decided at step 6.
- SMS onboarding parity: the walk engine is channel-agnostic by
  construction (the drip already walks conversationally); a texted
  fork is its own ticket.
- Life Skills subject fate: unchanged, still parked (taxonomy plan).
