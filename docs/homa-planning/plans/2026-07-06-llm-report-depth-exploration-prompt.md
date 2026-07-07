# Exploration prompt: LLM-generated depth in the progress report

> DONE, DO NOT RE-RUN (2026-07-06 night). The exploration this prompt
> commissioned happened the same evening; D8 was overturned and the rulings
> live in `2026-07-06-llm-report-depth-options.md` (decision record) and
> `2026-07-06-llm-report-narrative-implementation-prompt.md` (the build
> handoff). Kept for the record; the D8=A framing below is historical.

Hand this file to a fresh agent session as its opening instruction. It is a
mission brief for an EXPLORATION, not an implementation. The agent that
receives it must not write production code.

---

## Your mission

You are exploring whether, where, and how an LLM should generate parts of the
child progress report in the Homa onboarding flow (the "lead magnet" report at
`apps/web/app/onboarding/r/[token]/`). Today every sentence is a deterministic
template. The founder looked at a real report on 2026-07-06 and said:

> "The results of the cards seem redundant because of the way we are
> generating them. I believe we could provide more value if an LLM generated a
> deeper report, and certain elements of each card."

What they saw: six subjects in a row scored "On track", and every one of the
six cards opened with the identical sentence "Right where most kids their age
are." followed by "You've seen it: [one answer restated]." The evidence clause
varies; the voice does not. It reads like a form letter, and the per-card
sentence adds little beyond the badge.

Your job: understand the problem space fully, surface every unknown, interview
the founder until the shape of the solution is decided, and deliver an options
document plus a ready-to-hand implementation prompt for the chosen option. Not
code.

## Why this is bigger than a copy tweak (read before anything else)

The templates are not an accident. They are founder decision D8 in
`docs/homa-planning/lead-magnet/index.html`: "Curated sentence banks (template
strings), reviewed once, zero model calls." That decision carries three
load-bearing commitments you will find in the planning docs:

1. A privacy posture: "With D8 = A we can honestly say no AI provider ever
   sees the answers." The report holds children's names, birth months, and
   developmental answers. Sending those to a model provider changes the
   privacy policy's subprocessor story and kills a marketing line aimed at
   the AI-wary homeschool channel.
2. A review posture: every sentence a parent can read was approved by a human
   before launch ("one human pass reviews it all", header of
   `packages/core/src/map/sentences.ts`). Generated text cannot be
   pre-reviewed; review must become a runtime gate.
3. A determinism contract: "Same answers always produce the same map:
   deterministic, unit-tested, zero model calls, versioned with the bank"
   (`docs/homa-planning/lead-magnet/states.html`). The scoring math must stay
   deterministic no matter what; the open question is only who writes prose
   around it.

So the founder's hypothesis re-opens a founder decision. That is allowed (the
founder is the one asking), but it must be re-decided explicitly, on the
record, with the trade-offs in view. Do not quietly assume D8 is dead.

## Read first, in this order

1. `AGENTS.md` (repo laws: voice, no em dashes, tenant isolation, when unsure)
2. `.agents/skills/finding-unknowns/SKILL.md` and its references. This is your
   method for the whole engagement.
3. `/Users/sidneyswift/.agents/skills/grilling/SKILL.md`. This is how you
   interview the founder: one question at a time, each with your recommended
   answer, codebase-answerable questions answered by the codebase instead.
4. `packages/core/src/map/sentences.ts` (the entire template layer:
   `domainLine`, `homaNote`, `tryHeading`; the redundancy lives in the single
   `on_track` and `ahead` templates)
5. `packages/core/src/map/scoring.ts` and `content.ts` (what facts exist per
   domain: position, monthsAhead, strongestObservedStatement,
   frontierStatement, per-item typicalMonths, sources)
6. `apps/web/app/onboarding/r/[token]/report-view.tsx` (prose is derived at
   RENDER time from stored scores; nothing narrative is persisted)
7. `apps/web/lib/map/store.ts` `createReport` (the `lead_reports` row stores
   `scores` json, `bank_version`, `history`; rescores after a deep dive upsert
   the same row; `history` powers "+N mo since [date]" movement chips)
8. `apps/web/app/api/map/score/route.ts` (report must render immediately
   after scoring, decision D5=A; email is fire-and-forget)
9. `apps/web/agent/agent.ts` + `apps/web/agent/instructions.md` (an eve agent
   already exists in this app: gateway-routed `anthropic/claude-sonnet-5`,
   with the binding Homa voice rules. Reusable raw material for any option.)
10. `docs/homa-benchmarks/00-synthesis.md` (the evidence base behind
    typicalMonths and sources)
11. `docs/homa-planning/lead-magnet/index.html` (D1 to D8 decisions) and
    `journey.html` (personas, including the red-team drill: generate the
    report for the hardest honest case, a genuinely struggling child, and
    read it aloud; if you wince, it does not ship)
12. `scripts/` for `pnpm check:map` (the rendered-copy checker: banned words,
    no em dashes, no negative numbers; today a build-time guarantee, under
    any LLM option it becomes a runtime gate)
13. `docs/homa-planning/build-log.md`, the 2026-07-06 entries, for how the
    report UI got to its current shape today.

## Verified facts you can build on (spot-check them yourself)

- Redundancy mechanism: `domainLine()` has exactly one opener per position.
  Six on-track subjects means six identical openers. "Growing" rotates three
  openers deterministically by domain-id hash. Exposure subjects (coding,
  second language) have their own fixed lines.
- Everything the report knows per subject already exists as structured data:
  position, months ahead, the strongest observed answer, the frontier (next)
  skill, every question with the child's answer and its typicalMonths, cited
  sources, child age, interests and help-with tags from the extras step, and
  score history across rescores. An LLM would not need new data collection to
  say something non-redundant; the raw material is already richer than the
  one sentence we render.
- There is no per-report prose storage today. Adding generated text means a
  schema decision (new column on `lead_reports` vs new table, versioned by
  bank version AND prompt version, regenerated or invalidated on rescore).
- The sample report at `/onboarding/sample` scores a hardcoded answer set
  (Maya, pinned to 4y 2m) through the real scorer and `ReportView` at request
  time, no database row and no stored prose. It is the public "the sample IS
  the ad" artifact, so any LLM option must decide how the sample gets its
  depth without a per-request model call.

## How to run the exploration

Follow the finding-unknowns workflow. Suggested passes, in order:

1. Blindspot pass over the report pipeline (you are new to this code; verify
   the facts above and find what this brief missed).
2. Options brainstorm (reference file in the skill) to develop the solution
   directions below into honest options with kill criteria.
3. Mock before wiring: build one disposable self-contained HTML artifact that
   shows a real-ish report in two or three depths (current templates vs
   LLM-deepened card vs LLM synthesis section), with fake generated text
   clearly labeled as fake, so the founder reacts to a thing instead of an
   abstraction. Follow the artifact conventions in the skill (reply
   assembler at the end; taps compose the founder's answers).
4. Grilling session with the founder, one question at a time, recommended
   answer attached to each. Fold rulings into the doc as they land.
5. Write the deliverables (below).

## Grilling agenda (seed list; extend it as you learn)

Every question here is one the codebase cannot answer. Bring a recommendation
to each.

1. D8 re-decision: are we overturning "zero model calls" for the lead-magnet
   report, and what happens to the "no AI provider ever sees the answers"
   line and the privacy policy subprocessor list? (This is the gate for
   everything else. If the answer is "keep the claim", only options that keep
   child data away from model providers survive.)
2. Which elements exactly? "A deeper report, and certain elements of each
   card" is ambiguous. Candidates: the one-line card sentence, the top "note
   from Homa", a new cross-subject synthesis section, the per-card drawer
   explainer, the growing-subject activity, the four-week plan, the report
   email. Which are in scope, which stay template?
3. Latency budget: the report currently renders the instant scoring finishes
   (D5=A). Is a 3 to 10 second "Homa is writing Maya's report" moment
   acceptable, is streaming-in acceptable, or must first paint stay instant
   with depth arriving async?
4. Failure posture: when the model call fails or the output fails validation,
   do we degrade to today's templates silently, retry, or hold the report?
   (Recommend: degrade silently; templates are the fallback skeleton.)
5. Cost ceiling: compute real numbers (tokens per report, price per report,
   reports per day now and at conference spike) and ask what per-report spend
   is acceptable for a free lead magnet.
6. Runtime safety gate: what must the validator reject? Seed list: banned
   words (behind, delay, deficit, diagnosis language), em dashes, sibling
   comparisons, medical or diagnostic claims, ages or claims not present in
   the input facts, length caps. Does `pnpm check:map` logic become that
   runtime gate? Who reviews the red-team fixture outputs before launch?
7. Grounding contract: is the model allowed to add developmental
   interpretation ("rhyming and letter names are the same pre-reading
   story"), or only to re-voice facts we hand it? The first is the value; it
   is also the hallucination surface.
8. Regeneration: deep-dive rescores upsert the report. Regenerate prose every
   time (cost), or only when scores change position (staleness rules)?
9. Provider and model: reuse the eve gateway and `anthropic/claude-sonnet-5`,
   or a cheaper model for this? Does the gateway's data-retention posture
   satisfy whatever was decided in question 1?
10. Does generated depth go into the report email too, or screen only?
    (Email is the durable copy a parent forwards; hallucination in email is
    unrecallable.)
11. The sample report: pre-generate its depth once, review by hand, commit as
    fixture? (Recommend yes; it doubles as the golden red-team artifact.)
12. Does any of this change the conference-week scope (Deliverable 0 window,
    live by July 13), or is it explicitly post-conference?

## Solution directions to develop (expand, cost, and kill honestly)

Do not treat these as the full space; they are seeds.

- A. Richer templates, no LLM: per-domain on-track and ahead sentence
  variants keyed to the evidence item and frontier skill, so no two cards
  open identically. Keeps D8, the privacy line, and zero latency and cost.
  Ceiling: it is still a form letter, just a better one.
- B. LLM re-voices each card at scoring time: one model call per report
  writes the per-card sentences from the structured facts, stored on the
  report row, validated by the runtime gate, template fallback on any
  failure. Depth per card, moderate cost, D8 overturned.
- C. Templates keep the cards, LLM writes one synthesis: cards stay
  deterministic; the model writes a single "the whole picture" narrative
  (cross-subject connections, interests woven in, what to watch this month)
  as a new report section. Smallest hallucination surface per word of value,
  one call per report, clear visual separation between reviewed copy and
  generated copy.
- D. Progressive depth: report ships instantly with templates; a "Homa is
  reading the full picture" section streams in seconds later (or generates on
  drawer open). Keeps D5 instant paint, adds engineering surface (async
  generation, polling or streaming, partial states).
- E. Depth lives in the product, not the lead magnet: the free report stays
  fully deterministic (privacy line intact for the AI-wary channel), and the
  LLM depth becomes a signed-in Homa conversation about the report
  ("ask Homa what this means"), reusing the existing eve agent wholesale.
  Turns the depth into a conversion lever instead of a free-report cost.

Options B through D can combine with E. Your recommendation should name one
primary option, what it costs per report, what it risks, and what it defers.

## Hard constraints on every option (non-negotiable, from repo law)

- Voice laws: sentence case, reassure before inform, offers never commands,
  no em dashes anywhere, never "behind", never compare siblings, no medical
  or developmental diagnoses (see `apps/web/agent/instructions.md` and
  `docs/homa-design/SKILL.md`).
- The scoring math, positions, badges, chart, and benchmark ages stay
  deterministic and cited. A model never assigns a position or an age.
- Tenant isolation laws hold for any new query or storage
  (`pnpm check:isolation` stays green; `familyId` from auth context only).
- The struggling-kid red-team drill applies to every option: generate the
  hardest honest case and read it aloud before recommending.
- Never read from or write to `homa-macmini/`, `homa-research/`,
  `homa-template/`.

## Deliverables

1. `docs/homa-planning/plans/2026-07-XX-llm-report-depth-options.md`: problem
   statement, verified mechanism, unknowns by quadrant, the founder Q&A with
   rulings inline, the options with real cost and latency numbers, kill
   criteria, and one recommendation.
2. The disposable HTML mock used in the grilling session (fake data labeled
   fake).
3. A build-log entry in `docs/homa-planning/build-log.md` recording the D8
   re-decision and any other rulings the founder makes, so the decision trail
   stays auditable.
4. A ready-to-hand implementation prompt for the chosen option, folded from
   everything learned (constraints, decisions, work order, stop points), per
   the finding-unknowns workflow step 4.

## Definition of done

You are done when the founder has ruled on grilling questions 1 through 3 at
minimum, every option in your doc has a real per-report cost number and a
named failure mode, the mock has been reacted to, and the implementation
prompt could be handed to a build agent without that agent needing to ask the
founder anything.
