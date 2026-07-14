# Agentic capability planes · verified freedom over scripted safety

> Status: DIRECTION + PHASE 1 SHIPPED (founder direction 2026-07-13
> evening chat: "think one level of abstraction above where we are...
> give homa the most agentic capabilities", then "IMPLEMENT!").
> Phase 1 (the explore_child_map read plane) is built and guarded; the
> later phases are staged here so each can ship alone, launch-safe.

## The organizing principle

Every constraint in today's agent architecture is one of two things, and
they are currently conflated:

- **Invariants**, kept forever and enforced mechanically: tenant
  isolation (familyId never from the model), measurements only from the
  deterministic scorer, every claim traceable to evidence, reversibility
  (undo tokens, additive ledgers), attention budgets (a few emails a
  day, one heads-up), no sibling comparisons, growth framing.
- **Competence scaffolding**, built for weaker models: the server picks
  every check-in question, sentence banks write every report line,
  context is a few hand-bounded projections, one question per turn.

Scaffolding expires as models improve; invariants never do. The design
move, plane by plane, is to convert scaffolding into capability while
hardening the invariants. The test for every step: does the next model
upgrade make Homa better with zero code change? Scripts fail that test;
query surfaces, candidate sets, and post-hoc verifiers pass it.

The 2026-07-13 "-9 months" incident is the motivating parable: push-based
context means humans curate what the model may know, and humans forget.
Pull-based knowledge over one shared read model cannot drift that way.

## The five planes

1. **Knowledge (pull, not push).** One queryable world model of the
   child: scores, evidence, the anchored bank ladder, and the taxonomy
   teaching graph. Injected context stays the orientation summary; depth
   is a read-only tool call away. Phase 1, shipped, see below.
2. **Action (candidate sets, not scripts).** Mutating workflows keep
   their state machines and receipts, but the server hands the model a
   verified candidate set to choose from, with the choice and its reason
   logged. First target: check-ins offer 3-5 legitimate next probes
   (selectNextProgressItem generalized to selectNextProgressCandidates)
   instead of one. The deterministic pick stays as fallback and audit
   baseline. The record_observation walk-back is NOT reverted: free
   writes stay retired; choice happens inside a server-computed frontier.
3. **Verification (verified freedom).** Generalize the report narrative
   gate (banned words, invented numbers, sibling mentions) into a claims
   check for outbound chat/SMS/email that carries figures: any number or
   evaluative claim must match ledger facts. Then prose constraints can
   loosen without losing the zero-invented-numbers guarantee.
4. **Autonomy (objectives and budgets).** The tasks runner grows from
   fixed scripts (morning brief, evening check-in) to standing
   objectives per family with hard budgets (tokens, messages/day, one
   proactive touch/day), everything landing in the existing flight
   recorder. Enumerated task types were scaffolding; budgets plus
   receipts are the invariant.
5. **Evolution (the loop that compounds).** The knowledge_bank pattern
   (sibling plan 2026-07-10-education-knowledge-architecture) extended:
   the agent proposes changes to its own scaffolding (anchors, skills,
   gates) with eval receipts; promotion stays a reviewed, versioned
   content change gated by CI.

## Phase 1, shipped 2026-07-13 (this change)

**explore_child_map**, the read plane's beachhead: a read-only agent
tool that joins one child's own evidence with both content graphs.

- Queries: `subject_map` (the anchored ladder with the child's answer on
  every rung, the frontier marker, the same chart figure the parent
  sees, and per-domain skill-line summaries), `topic` (description,
  evidence criteria, personalized try-at-home prompt, prerequisites with
  edge reasons and the child's standing on each, unlocks), `ready_next`
  (readiness frontier over hard prerequisites from the family's own
  confirmed evidence, assessment domains only, teaching window ranks but
  never gates, centrality-ranked, receipts on every entry), `bottleneck`
  (deepest unconfirmed hard prerequisite plus the unconfirmed chain),
  `teaching_order` (topological sort of chosen topics), `search_topics`
  (id discovery across graph topics and bank items).
- Split: pure query engine in `apps/web/lib/map/explore-child-map.ts`
  (no I/O, deterministic, every list and string bounded, results ≤ 8k
  chars); thin tool in `apps/web/agent/tools/explore_child_map.ts` with
  the manage_child_progress schema pattern (flat published schema,
  strict discriminated execution schema) and both access modes (caller
  RLS with the inner-join belt; pinned server reads with the explicit
  family predicate). The model-supplied childId is re-verified in-family
  on both paths. No writes anywhere: evidence stays with
  manage_child_progress, so exploring can never change a score.
- Honesty seams kept: positions and chart figures come from scoreMap +
  the shared chart value law (trajectory-format), never recomputed;
  teaching windows are typical teaching ages and the instructions gate
  the framing (never deadlines, never verdicts); exposure subjects stay
  number-free; content-cluster domains are searchable but excluded from
  readiness.
- Enabler, load-bearing: `@homa/taxonomy` corpus loading moved from
  createRequire to static JSON imports (assemble.ts, standards.ts), the
  loader shape the 2026-07-10 incident proved necessary before any agent
  tool could touch the graph. Verified: the corpus is now literally in
  the compiled eve bundle, and next build, eve build, check:taxonomy,
  and the walk tests all pass.
- Guards: `apps/web/lib/map/explore-child-map.test.ts` (16 tests:
  evidence joins, receipts from real edges, window ranking with the
  young-child case, bounds, fail-closed unknown ids) wired into
  `pnpm check:map`, which CI already runs.

## Phase order from here

2. Candidate-set probes for check-ins (small diff to check-in-selection,
   contract change to the prompt payload, instructions update).
3. Claims gate for outbound figures (extend the narrative gate; start
   log-only, then enforce).
4. Objectives with budgets on the tasks runner, one script at a time.
5. Evolution loop per the knowledge_bank plan, after M3-04 reconciling.

Each phase lands with its own guard in CI before the next starts.

## Non-goals, stated

- No model-authored scores, ever: the scorer stays the only writer of
  positions and figures.
- No revert of the record_observation retirement.
- No client-side taxonomy: the corpus stays server-only.
- No new proactive channels; autonomy grows inside existing budgets.
