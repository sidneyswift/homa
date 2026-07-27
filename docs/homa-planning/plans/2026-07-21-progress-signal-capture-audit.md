# The child-progress signal-capture system: audit and proposal

Date: 2026-07-21. Status: RULED. The founder answered all nine decisions
question by question on 2026-07-21 (see §5, each D-item carries its ruling);
the build proceeds in the ratified sequence in §5.1. One factual question
stays open: the voice Phase-0 discrepancy in D6. Evidence: a 21-agent code + adversarial-hunt audit of this
worktree (8 subsystems mapped, 7 hunted for failure points, 1 cross-cutting
design pass on multi-child fan-out; three further cross-cutting passes and a
completeness critic hit a mid-session spend cap and were completed by hand
using the same evidence) plus direct production Supabase queries run
2026-07-21 (project kzplntcdtsvdowntvlza). This follows the header-date fix
([PR #79](https://github.com/sidneyswift/homa/pull/79), merged 2026-07-21):
that PR fixed the symptom (a stale-looking date) and broadened the
journaling trigger; this document is the answer to "was that a Band-Aid on
a bullet wound," asked the same day.

**Short answer: yes, and the wound is bigger than it looked.** Not only does
almost no conversational signal reach a child's record, but the trajectory
chart on the Progress page cannot gain a new point after onboarding even
when signal does land, because the only code that archives a dated era was
built for onboarding and is unreachable afterward. Both are fixable; neither
is fixed by PR #79.

## 0. Ground truth (verified against production, not estimated)

| Fact | Number | Query |
|---|---|---|
| `child_progress_evidence` rows by source, all time, fleet-wide | checklist 1888, deep_dive 130, check_in 2, conversation 1, report_probe 1 | `select source, count(*) from child_progress_evidence group by 1` |
| Conversational journal evidence rows, ever, fleet-wide | **1** | same query, source='conversation' |
| `child_observations` rows, ever, fleet-wide, by classification | no_match: 7 (activity_only: 0, ambiguous: 0) | `select classification, count(*) from child_observations group by 1` |
| `progress_check_ins` rows, ever, fleet-wide, by state | paused: 2, stopped: 1, active: 0, completed: 0 | `select state, count(*) from progress_check_ins group by 1` |
| `child_reports.history` array length, all reports | 0 entries: 56 reports, 1 entry: 8, 2 entries: 1, 10 entries: 1 | `select jsonb_array_length(history), count(*) from child_reports group by 1` |
| `child_progress_operations` total rows | 1,871, of which ~1,861 are UUID-keyed (onboarding checklist/deep_dive/walk claims), 8 are agent-tool-keyed, 2 are check-in-response-keyed | `child_progress_operations` key-prefix breakdown |

Two corrections to the working assumption from earlier today: the ~1,871
operations are **not** "almost all check-in answers" as first assumed; they
are almost all **onboarding** operations (checklist, deep dive, the walk
fork), which share the same claim ledger as everything else. And the
check-in system, the one path built with guaranteed delivery-binding, has
been **started three times, ever, fleet-wide**, two of which are stuck
`paused` today with no code path that ever resumes them unasked. Between
onboarding and now, across every family Homa has ever had, exactly four
`child_progress_evidence` rows exist that are not onboarding rows: two
check-in answers, one conversational journal match, and one report probe.
Story's family (the one that opened today's header-date conversation)
messaged daily Jul 13-21 and produced zero of those four.

Everything below explains why, and what each of the founder's four
questions (failure points, more signal, weighting signal, and testing
without waiting on users) implies for what to build next.

## 1. The headline finding: even captured signal cannot move the chart

This is the answer to "did we just put a Band-Aid on a bullet wound." Fix
every matcher bug in this document, and the Progress trajectory chart would
**still** flatline after onboarding, for a reason that has nothing to do
with capture:

- Every accepted evidence write ends in `refreshDerivedProgressInTransaction`
  ([`progress-service.ts:1389-1437`](../../../apps/web/lib/child-progress/progress-service.ts)),
  which rescoreds the projection and calls `saveDerivedProgress`
  ([`postgres-repository.ts:1025-1090`](../../../apps/web/lib/child-progress/postgres-repository.ts)).
  That function **overwrites the live `child_reports` row's scores in
  place**, with no append to `history`.
- The only code that ever archives a dated era is `createReport`
  ([`lib/map/store.ts:931-1057`](../../../apps/web/lib/map/store.ts)), and
  it is reachable only from onboarding scoring
  (`/api/map/score/route.ts:59`), SMS onboarding (`sms-onboarding.ts:372`),
  the founder admin console (`admin/actions.ts:182`), and the report
  correction route **in flag-OFF legacy mode only**
  (`correct/route.ts:141-144`). With `HOMA_LIVE_PROGRESS_ENABLED=true` in
  production, corrections take the `child_progress` code path and skip
  `createReport` entirely.
- The trajectory chart plots `child_reports.history` entries plus one live
  point (`trajectory-eras.ts:190-234`; `progress/page.tsx:84-91`). The prod
  numbers above show the mechanism working exactly as designed: 56 of 66
  reports have never archived a single era beyond their onboarding score.

A parent who answers 100 check-in questions over three months would see the
chart's live point slide, but no new dated era would ever appear, and the
"+4 months since June 6" movement chip the report is built to show
(`report-view.tsx:125-130`) would never fire. **This is independent of and
upstream of every journaling problem below**, and it is the one finding in
this document that most clearly reads as a confirmed live production defect
against the product's own stated intent (a chart that shows growth over
time), not a missing feature.

A second, related defect: `saveDerivedProgress` stamps `generated_at =
projectedAt` on every routine write, and the report's staleness banner
(`staleness.ts:29-53`) computes from `generatedAt`. An actively-messaging
family (exactly Story's) therefore never sees the "Re-check what's new"
offer that would let the parent trigger a fresh `createReport` herself,
because every quiet background write keeps resetting the "how stale is
this" clock without ever producing a new era.

**Fix direction:** append the prior scores into `child_reports.history`
inside `saveDerivedProgress` whenever any subject's months value changed
(reuse `createReport`'s snapshot shape and cap), and compute staleness from
the newest history entry rather than `generated_at`. This is additive,
touches one function, and is the single highest-leverage fix in this whole
audit: it turns every other fix in this document from "might one day move
a number" into "visibly grows the chart the parent is looking at."

There is also a live-and-unused archiving mechanism sitting right next to
this: `check-in-service.ts:377-393` already inserts a full scored baseline
into `child_progress_snapshots` at the start of every check-in, and nothing
in the codebase ever reads that table (`postgres-repository.ts:1616-1651`
is its only non-migration reference). It is a write-only table holding
exactly the dated snapshots the chart needs.

## 2. Why almost no conversational signal reaches a child's record

Ranked by how much prod signal each layer is independently responsible for
losing. All of these were verified by running the real matcher and
classifier code against realistic parent phrasing, not by reading it.

### 2.1 There is no deterministic trigger; capture is a single latent
tool-call decision per turn (critical)

The only two callers of `recordJournalProgressEvidence` in the repo are the
model-facing tool
([`manage_child_progress.ts:60`](../../../apps/web/agent/tools/manage_child_progress.ts))
and the lesson-audio worker (`lib/lessons/worker.ts:313`). Nothing else ever
inspects a persisted parent message. When the model does not call the tool,
the report is gone with no trace, no retry, and no alert. This is not a
theoretical risk: it is the entire explanation for the one-row-ever number
in section 0. **PR #79 broadened the trigger wording and shipped with no
way to measure whether the broadening worked**, because no eval touches
this layer (section 5).

**Fix direction:** a deterministic backstop, not another wording tweak. A
post-turn (or nightly) sweep that runs `classifyJournalEvidence` /
`matchJournalEvidence` over the day's persisted parent messages for
children not already covered by a tool call that turn, and writes at least
the observation row server-side. The matcher, the idempotency scheme
(message id), and the observation ledger already exist; only the
model-independent trigger is missing.

### 2.2 The lexical matcher cannot recognize real parent phrasing (critical)

`journal-matcher.ts` scores a match only via six hand-written alias rules
covering five bank items (of 225), or ≥85% token overlap with a bank
item's exact statement text (`JOURNAL_MATCH_HIGH_CONFIDENCE_SCORE = 0.85`,
line 9). Agents ran the real matcher against realistic sentences,
**including the two example sentences instructions.md itself uses to teach
the trigger**:

| Parent said | Result |
|---|---|
| "She finished the counting page" (instructions.md's own trigger example) | `no_match` |
| "Maya read a whole early reader alone" (instructions.md's own trigger example) | `no_match` |
| "Maya can count to 100 now" (an explicit capability report, the founder's strongest signal tier) | `ambiguous` at 0.50, no candidates shown to the model |
| "Maya counted five objects and told me how many" (verbatim skill, word form) | `no_match` at 0.22 (needs digit "5", not the word "five") |
| "Maya read Green Eggs and Ham all by herself" | `no_match` (the capitalized book title is treated as a second person and truncates the clause) |

**Fix direction:** this is a recall problem, not a threshold-tuning problem.
Quick, mechanical wins: add number-word aliases, restrict the
"other-actor" capitalization heuristic to adult role-words and known
family names (not any capitalized word), expand alias coverage to the
highest-frequency reportable milestones. Medium-term: let the model propose
the matched item (it already knows what skill was demonstrated) with the
deterministic layer verifying quote provenance, exactly the pattern the
lesson-listen pipeline already uses successfully for clause verification
(section 3).

### 2.3 Attribution requires the clause to literally start with the
child's stored name (critical, and cheaper to fix than 2.2)

Independent of the 0.85 threshold, `childActorPattern`
(`journal-matcher.ts:250-253`) anchors on the child's exact name at clause
start. Every one of the following, run against the real code, produces zero
child-attributed predicates: "Today Maya read..." (leading adverb), "She
read a whole book by herself" (pronoun; worse, `OTHER_ACTOR_PATTERN` at
lines 188-189 treats capitalized "She" as a *different person* and
excludes the clause), "big win: Maya..." (colon isn't a clause separator).
The model has already resolved which child the message is about (it
supplied `childId` to call the tool); the server then re-derives
attribution from scratch on the raw text and discards the model's own
answer. **This single fix (accept clause-initial pronouns as the
tool-call's child when no other name is present) was independently flagged
by every one of the seven hunt agents as the highest-leverage, lowest-risk
change available**, because it requires no new alias content and no schema
change, only relaxing an overzealous regex.

### 2.4 A single "we did X" clause in a message discards the whole
message (critical, and directly undermines PR #79)

`matchJournalEvidence` classifies the **entire inbound message** in one
pass; if any activity phrase like "we did/read/practiced" appears anywhere,
the message short-circuits to `activity_only` before any child-attributed
clause is even scored. Verified: "We did reading practice today and Maya
read a whole book by herself" classifies `activity_only` with zero matches,
even though "Maya read a whole book by herself" alone is a 0.97 alias
match. **PR #79 broadened the trigger specifically to catch day recaps
("we practiced letter sounds")**, which are exactly the sentences most
likely to also contain the phrase that now suppresses them. The fix ships
with the bug still live.

**Fix direction:** classify per clause, not per message: run
child-attributed predicate extraction first, and only fall back to
`activity_only` when no clause produces a scoreable candidate.

### 2.5 Taxonomy check-offs never move a score, by design, with no
graduation path (high)

The projection filters every non-bank item ID out of the scorer's input
(`projection.ts:569-573`); the onboarding walk records answers with
`itemId = taxonomy topicId`
([`walk.ts:22-26`](../../../packages/taxonomy/src/walk.ts) says this is
deliberate). Hard-prerequisite closure ("checking a skill implies its
prerequisites") is computed only inside the walk's in-memory question
selection and is never written to the ledger. **This directly answers the
founder's "I know from the taxonomy that I can check mark this part of the
child's progress" scenario: that mechanism does not exist as data
anywhere today.** The walk module's own comment promises a "graduation"
path ("per topic when an anchor is authored with a citation") that has no
implementation and no owner.

### 2.6 One family activity never fans out into per-child signals (high)

Ran the exact scenario the founder described. "We all went on a scavenger
hunt for the 50 states" (kids 3, 6, 9): the tool takes exactly one
`childId` per call; no instruction anywhere tells the model to call it once
per participating child; and even a perfect three-call fan-out would
classify `unclear -> no_match` at the matcher, because `GENERAL_ACTIVITY_
PATTERN` requires "we" *immediately* before the verb ("we all did" fails
the adjacency check). The age-relevant taxonomy content is also thin: the
geography-maps assessment domain has **zero** assessable topics generated,
so even a perfectly captured signal has nowhere age-differentiated to land
for the 3- versus 9-year-old today. Full design in section 4.

### 2.7 The "ask later, guarantee it lands" loop is designed but never
built (high)

The `journal_followup` check-in purpose exists in the database check
constraint and in TypeScript types, but is **excluded from the model-facing
purpose enum** and has **zero call sites anywhere in the repo**. The
observation ledger (`child_observations`) is a dead end: it surfaces only
to the morning research brief (read by almost no families, see section 5)
and to the founder admin console; brief delivery auto-marks the anchored
observation "used" **regardless of whether the parent ever replies**; and
there is no `resolve_observation` action, so even a parent's direct answer
to a clarifying question re-enters the same failing lexical funnel as a
brand-new, unattributed message. Full design in section 4.

### 2.8 Materials, planner check-offs, hours, and lesson-builder worksheets
are completely disconnected from progress (high)

Verified by grep: **zero** imports of `lib/child-progress` anywhere under
`agent/tools` materials/planner/hours files, `lib/materials`, or
`lib/subject-lessons`, and conversely nothing in `lib/child-progress` reads
materials, `child_plans`, or `hours_log`. Concretely:

- A worksheet created for a named child with a named skill
  (`create_printable.ts`) emits only an analytics event.
- A parent checking off a planner activity, the single most explicit daily
  completion gesture in the product, writes only into `child_plans.progress`
  JSON. Worse: `plan-edits.ts:122-127` **deletes** a checked activity's
  completion when Homa edits that week, with no record of the fact that it
  was ever done.
- `log_hours` writes only to `hours_log`; no consumer of that table touches
  progress.
- `subject_lessons` rows already carry `target_item_id`, a real scorable
  taxonomy item, joined to the child, but the lifecycle ends at
  `build_status: 'ready'`; there is no "taught" or "completed" state, and
  the parent's "keep" action only finalizes the material file.

This is the founder's "worksheet created is a weak signal, I don't know if
it's finished" scenario made concrete: today it is not even a weak signal,
it is no signal, because the door (`record_journal_evidence`'s schema) has
no parameter that could accept a material, plan-activity, or hours
reference. Full design in section 4.

### 2.9 Channels have radically unequal access, and photos never become
progress signals on any channel (high)

- **Voice is 100% excluded.** The production phone assistant is a separate
  Telnyx product, not eve, with exactly four tools (`send_email`,
  `remember`, `log_hours`, `send_signup_link`) and no progress tool at all.
  A spoken day recap lands in `call_transcripts` and, one background pass
  later, in `family_memories` only. No voice-bridge code or plan doc exists
  in this tree despite a memory note claiming one shipped 2026-07-20; that
  needs reconciling (open question, section 6).
- **Email drops attachments entirely** and its channel-mode instructions
  were never updated by PR #79: an evening recap by email is still routed
  to `remember` + `log_hours`, never `record_journal_evidence`, contradicting
  the shared instructions every other channel got today.
- **Photos never score, on any channel.** The image captioner is
  deliberately forbidden from guessing names (so a caption can never
  satisfy the name-anchored matcher), and nothing instructs the model to
  call the journal tool after receiving work it explicitly asked to see
  (`ask_for_photo`'s trail dead-ends). The founder's "she finished the
  worksheet" completed-work photo, the second-strongest signal in the
  vision's ladder, has an ask-side rail and no record-side landing anywhere.
- **Mobile has zero camera/attachment code** despite full text parity, so
  the device most likely to be in a parent's hand when a worksheet is
  finished cannot originate a photo signal at all.

### 2.10 A cluster of mechanical bugs each quietly drop or corrupt a
signal that otherwise would have landed (medium, listed once, high combined
weight)

- A same-turn retry with a narrowed `subjectId`, or a second call for a
  different subject on the same child, is refused as
  `idempotency_mismatch`, because the turn-level idempotency key omits
  `childId`/`subjectId` while the payload hash includes them. This silently
  drops the second half of a two-topic message ("she did her math page and
  we also worked on letter sounds").
- An open two-adult conflict on any one matched item in a message silently
  drops **every** matched item in that message, including unrelated ones,
  with no observation fallback.
- Unrecognized negation ("didn't", "doesn't", "struggled", "with a little
  help") defaults to the "easily" answer tier, so a report of struggle or
  partial help can score as full mastery once matching does succeed. Since
  evidence resolution is pure latest-wins-by-timestamp with no source
  weighting, a shaky matched guess can silently overwrite a careful,
  deliberate check-in answer from weeks earlier.
- Three bank items (`math.skip-counting`, `literacy.reads-short-book`,
  `literacy.chapter-books`) are excluded from the journal matcher entirely,
  because the exclusion list was built for check-in question selection and
  reused for scoring by accident; a verbatim chapter-book report can never
  credit that milestone and instead under-credits a lower rung by up to 24
  months.
- Two live SMS check-ins on one phone (e.g. one per sibling) silently drop
  the trust marker that binds an answer to its question; the parent's reply
  is discarded and the guidance's own recovery is to restart the check-in,
  an interrogation loop instead of the guaranteed landing the founder wants.

None of these are individually catastrophic, but they compound: every one
of them is a place where a signal that *did* survive attribution and
matching is still lost or corrupted before it reaches the child's record.

## 3. What already works, and is the right pattern to copy

The lesson-listen pipeline (fleet-wide since 2026-07-21, never yet
dogfooded end to end, zero rows in production as of this audit) is
architecturally the best-designed capture surface in the codebase, and is
the closest existing thing to the founder's own description of how capture
should work:

1. A model synthesis pass proposes clause/excerpt pairs from the transcript
   (judgment, latent).
2. A **deterministic** verification gate checks the excerpt appears
   verbatim in the transcript and that the clause doesn't stray from it
   (`pairs.ts:63-92`, exact, code, not a model call).
3. Every verified pair is **unconditionally** fed to
   `recordJournalProgressEvidence`, with no model "decision" to make about
   whether to call the tool at all.
4. Every outcome (evidence, conflict, observation, rejected) is stored back
   onto the review with its excerpt, so the parent can see "what this
   lesson wrote to progress."

This is exactly the shape a worksheet-completion, planner-check-off, or
day-recap bridge should take: a judgment pass proposes a claim, a
deterministic gate verifies it against something checkable, and the write
happens without depending on the model remembering to ask. Its one
remaining weakness is that it still terminates in the same matcher from
section 2.2-2.4, so fixing the matcher lifts every one of these surfaces
at once, not just conversational journaling.

## 4. Design proposals

### 4.1 Signal weighting

Today, `resolveEffectiveProgressEvidence` is pure latest-active-per-item by
timestamp (`effective-evidence.ts:200-212`); source kind only changes a
display sentence. There is no confidence field anywhere in the schema.
Proposed ladder, strongest to weakest, matching the founder's own framing:

1. **Explicit capability report / check-in answer**, a deliberate,
   attributed statement of ability. Scores fully, can supersede anything.
2. **Lesson-listen verified clause**, model-proposed, deterministically
   verified against a transcript. Scores fully once the matcher is fixed.
3. **Worksheet/lesson completion confirmed by parent** ("she finished it,
   got them all right"), scores, capped below "easily" (should read as
   `getting_there` at minimum until an explicit independence cue appears).
4. **Day-recap / activity mention** ("we did a scavenger hunt"), writes as
   a weighted observation with candidate item tags, never a score.
5. **Worksheet created / planner activity assigned**, the weakest signal:
   "working on this," never scores, but should at minimum seed the
   `ask_next` follow-up target and the observation ledger's subject hints.

Two schema-level prerequisites, before any weak-tier signal is allowed to
write anything: (a) add a strength/confidence dimension to evidence rows so
resolution can prefer a stronger, older signal over a weaker, newer one
(today it cannot); (b) until that lands, keep every new weak-tier bridge
writing to the **observation** ledger only, never the evidence ledger, so
nothing new can silently outrank a careful check-in answer the way a lucky
journal match can today.

### 4.2 Multi-child fan-out

Full trace and design already complete (see the cross-cutting analysis);
summary:

- **Where the decision lives:** deciding who participated and what an
  activity plausibly evidences at each age is judgment, it belongs in the
  fleet-skill/instruction layer, per this repo's own thin-harness/fat-skill
  placement rule, not in a new god tool.
- **Transport:** repeated single-child calls already work and are already
  safe (the DB's unique constraint is per `(child_id, family_id,
  idempotency_key)`); no multi-child batch action is needed.
- **What's actually missing:** an optional, server-validated claim payload
  per call (proposed item + proposed strength), with the server enforcing
  item existence, age-plausibility against the bank's typical-age data, and
  a strength cap (never "easily" from an activity inference), plus one
  instruction sentence telling the model to fan out on a collective phrase
  ("we all," "the kids") and name every child it wrote to in its reply, so
  a parent can correct a mis-attribution.
- **Guardrail:** age-plausibility validation is exact data (the bank's
  typical-age field) and belongs in deterministic code, not a model guess,
  per this repo's tool-authoring rules.

### 4.3 The guaranteed follow-up loop

Do not build a new ad hoc mechanism. The check-in system already has
exactly the guarantee the founder is asking for: server-picked questions,
delivery-binding that requires the sent text to contain the exact
statement, a bound reply loop, and idempotent, transactional evidence
writes. The `journal_followup` purpose was designed for this and never
finished. Proposed shape:

1. Expose `journal_followup` in the model-facing (and dispatch-facing)
   purpose enum.
2. Feed the child's open, candidate-bearing observations into
   `selectNextProgressItem` as a seeding hint (today it only sees the age
   plan and existing answers).
3. When a low-confidence signal is written (a weak-tier item per 4.1, or an
   ambiguous journal match), the service opens or queues a
   `journal_followup` check-in on the top candidate item instead of relying
   on the model to remember to ask conversationally.
4. The morning brief and the evening journal prompt (today content-blind
   and opt-in at roughly 2% of families) become **carriers** for the bound
   question rather than free-text prompts whose answers depend on the
   fragile latent path.
5. Auto-marking an observation "used" on delivery, regardless of reply,
   should stop; "used" should mean the follow-up question was answered.

This reuses the one reliably-landing mechanism in the whole system instead
of inventing a second one, and it is a genuinely small build: the delivery
rails, the reply-binding, and the evidence-write transaction already exist
end to end for check-ins.

### 4.4 Testing and evaluation, without waiting on real families

Coverage today is dense **below** the tool-call boundary and essentially
zero **above** it, which is exactly backwards from where prod is failing.
Every branch inside `ChildProgressService` is unit- and Postgres-E2E-tested
(idempotency, conflicts, observation writes, score recalculation); the
decision to ever reach that code, and whether a realistic parent sentence
actually matches once there, has no automated coverage at all. No `eval:*`
step exists anywhere in CI.

Priority order, each copying an existing harness pattern already in this
repo so none of this is new infrastructure:

1. **Journaling-trigger behavioral eval** (new, highest leverage). A
   fixture corpus of realistic day-recap and capability messages, plus
   adversarial negatives (logistics, venting, other-actor mentions), run
   through `generateText` with the production `instructions.md` and the
   real tool schema, asserting `record_journal_evidence` is or is not
   called with the correct `childId`. Copy the fixture-plus-judge,
   free-`--check-fixtures`-in-CI pattern from
   `scripts/prompt-suggestions-eval.mts`, the richest existing harness in
   the repo. This is the one test that would have caught PR #79 shipping
   with the "we did X" short-circuit bug still live.
2. **Matcher recall/precision corpus** (new, cheap, deterministic, CI-safe).
   30-50 real parent phrasings per commonly-reported bank item, including
   every failing example in section 2, pinned against `matchJournalEvidence`
   with a minimum recall floor, added to the existing `check:child-progress`
   unit-test glob (no new infrastructure, no model calls, runs in seconds).
3. **Multi-child fan-out eval**: one family-activity fixture with children
   at three ages must produce one tool call per named child.
4. **Agent-to-Postgres capture journey E2E**: extend the one existing
   real-agent harness (`scripts/conversation-continuity-agent-e2e.mts`,
   today asserts reply *text* only) to send a capability message and poll
   `child_progress_operations`/`child_observations` for a resulting row.
5. **The "month in an hour" family simulator** the founder asked for:
   the disposable-Postgres E2E harness
   (`scripts/child-progress-postgres-test.mts`) already spins up a real,
   throwaway Postgres cluster in CI and drives the real service classes
   directly with explicit, scripted `observedAt` timestamps, it already
   supports multi-week, multi-adult sequences. It can host a scripted month
   of the **deterministic** layers (evidence writes, scoring, check-in
   state) for 2-3 mock families (single kid; three kids aged 3/6/9;
   SMS-heavy) today, with no new infrastructure. It cannot by itself
   simulate the *model* deciding anything; pairing it with the trigger eval
   above (item 1) is what turns "a month of usage" into an automated
   suite: the trigger eval proves the model calls the tool on realistic
   input, the Postgres harness proves what happens once it does, and
   together they cover the gap end to end without a live family ever being
   involved.

None of the existing three model evals (`eval:progress-check-in`,
`eval:continuity`, `eval:prompt-suggestions --check-fixtures`) run in CI
today; wiring even the free/deterministic ones in is a same-day fix and
would have caught several of today's PR #79 side effects before merge.

## 5. Founder decisions, RULED 2026-07-21

Answered question by question in the 2026-07-21 session; the founder's
framing for the whole set: "We're building a world-class product here",
granular and real-time, no corner-cutting.

- **D1. RULED: build it, granular.** Routine derived scoring appends dated
  points to `child_reports.history` at per-change granularity (a point per
  real score change, not batched per day), tracked in real time, with a
  copy-review pass so the busier chart stays quick to read. Staleness
  computes from the newest history entry.
- **D2. RULED: Homa offers it once.** The evening check-in stays off by
  default (the 2026-07-12 opt-in ruling stands), but Homa proactively
  offers the toggle once at a natural conversational moment (after a first
  recap or first worksheet). The prompt itself becomes targeted: it is
  composed from the child's stalest subjects and open observations, never
  blind.
- **D3. RULED: model proposes, code verifies.** The lexical matcher stops
  being the only path to a score. A bounded model call proposes the matched
  skill; deterministic code validates existence, age-plausibility, child
  attribution, and strength cap (the lesson-listen pattern). Gated behind
  the D9 eval suite before it ships. The mechanical fixes (pronoun
  attribution, book-title truncation, activity short-circuit, number words,
  negation gaps) ship regardless as plain bug fixes.
- **D3b (asked as its own question). RULED: per-turn backstop sweep +
  telemetry.** Right after each turn, server code re-captures any parent
  message the model failed to journal, through the same capture path, with
  message-ID idempotency preventing double-writes; plus a telemetry event
  making the model's miss rate measurable.
- **D4. RULED: strength schema first.** Evidence gains a strength/confidence
  dimension via an additive expand-contract migration, with strength-aware
  resolution replacing pure newest-wins, BEFORE the capture bridges open.
  Polarity default flips conservative: unrecognized phrasing records
  getting_there, never easily. Ladder as §4.1.
- **D5. RULED: finish the journal_followup rail, capped.** Weak signals
  queue a bound one-question follow-up riding the existing check-in
  delivery-binding; server-enforced cap of one question per family per day
  and one pending per child; "used" comes to mean answered, not mentioned.
  Prerequisite: auto-expire stale paused check-ins so the one-open-per-child
  index stops blocking.
- **D6. OPEN (factual, not a ruling).** Voice: the memory note claiming a
  shipped 2026-07-20 Phase-0 honesty fix and async-bridge plan does not
  match this worktree (no plan doc, no bridge code, the provisioning
  script's honesty line predates that date). Founder to confirm whether it
  shipped from an unmerged branch or was applied directly to the hosted
  Telnyx assistant outside git, before voice-bridge work starts.
- **D7. RULED (via the fan-out question, amended same day): fan-out ships
  as designed, AND taxonomy authoring joins this build.** Per-child calls
  on collective recaps, deterministic age-plausibility gates from the
  bank's typical-age data, observation-tier entry, and the name-every-child
  corrective reply. The founder initially left taxonomy authoring as a
  separate effort, then amended later the same day: geography and
  social-studies assessable-topic authoring plus the walk-topic graduation
  path are IN scope, run as a parallel content track alongside the code
  work so age-differentiated landing spots exist when fan-out ships.
  Prerequisite bug fix: fold childId/subjectId into the operation
  idempotency key so same-child same-turn calls stop refusing.
- **D8. RULED (inside the bridges question): all five bridges.** Planner
  skill-linkage + check-off signals, worksheet created/completed tiers,
  plan-edit completion preservation, child-scoped hours as observations
  (with the dishonest dedupe fixed), and the completed-work photo
  follow-through (instruction + eval; vision-model grading deliberately
  out of scope for now).
- **D9. RULED: full suite, evals first.** Build the journaling-trigger eval
  and matcher recall corpus FIRST to baseline the broken system, then land
  every fix with before/after numbers. Deterministic checks run per-PR;
  model evals run nightly on a schedule; the month-in-an-hour family
  simulator ships alongside the bridges on the disposable-Postgres harness.

### 5.0 What shipped 2026-07-21, same session

The matcher was not improved, it was replaced. D3's "model proposes,
code verifies" is now the architecture and a binding law in `AGENTS.md`.

| Shipped | PR |
|---|---|
| Lesson trust gate recalibrated (100% honest-pair rejection) | #84 |
| Voice Phase 0 honesty, recovered from an uncommitted worktree | #88 |
| Lesson `observedAt` survives the Postgres text form | #90 |
| Synthesis output headroom | #91 |
| Recall corpus in CI + conservative polarity default (D4) | #92 |
| Claim extraction: model judges, code verifies | #97 |
| The measurement: recall 29% to 86%, precision held at 100% | #99 |

Measured on the same 26 real parent phrasings, extraction plus the
deterministic gate against the real model:

```
recall    12/14 (86%)   lexical matcher: 4/14 (29%)
precision  6/6 (100%)   lexical matcher: 6/6 (100%)
```

Both remaining misses are the gate being conservative (low confidence
rides as an observation), not the model being wrong.

Rollout: `HOMA_CLAIM_EXTRACTION_ENABLED` set on Vercel production
2026-07-21. Note for anyone repeating this: `vercel redeploy` clones a
deployment's env snapshot and will NOT pick up a variable added after
that deployment was created. A fresh git-triggered deployment is
required, which is what this PR provides. Rollback is the flag off; the
legacy matcher stays in place and writes less, never more, so it can
lose new signal but cannot corrupt an existing record.

Still open from this document: the chart-history append (D1), the
backstop sweep (D3b), the strength schema (D4), the follow-up rail (D5),
the artifact bridges (D8), and the taxonomy authoring track (D7).

### 5.1 Ratified build sequence

1. **Baseline** (D9): trigger eval + matcher corpus wired into CI, run once
   against the current system so every later change carries numbers.
2. **Mechanical fixes** (D3 tier 1) + the D7 idempotency-key fix + the D1
   chart-history append + stale-check-in expiry (D5 prerequisite). All
   small, all additive, all immediately visible.
3. **Strength schema** (D4), expand-contract.
4. **Model-proposes matcher** (D3 tier 2), shipped only once the baseline
   evals exist to measure it.
5. **Backstop sweep** (D3b), depends on the matcher.
6. **Follow-up rail** (D5) + evening-prompt offer and targeting (D2).
7. **Bridges** (D8) + fan-out (D7), feeding the capped follow-up queue.
8. **Family simulator** (D9) grows alongside 5-7.

Parallel content track, starting alongside step 2 (D7 amendment,
2026-07-21): author geography and social-studies assessable taxonomy
topics (teaching windows spanning roughly 36-140 months, complementing
the bank anchors) and implement the walk-topic graduation path, so
fan-out signals have age-differentiated landing spots by the time step 7
ships. Content review bar applies (founder-gated, like material anchors).

## 6. Open questions carried over, not yet resolved

- Whether `HOMA_LIVE_PROGRESS_ENABLED`, `MORNING_BRIEF_ENABLED`,
  `JOURNAL_PROMPT_ENABLED`, and `HOMA_SUBJECT_LESSONS_ENABLED` are on in
  production were each independently flagged as unverified by multiple
  agents; the check-in and check_in-evidence counts in section 0 make the
  practical answer moot for `JOURNAL_PROMPT_ENABLED` (usage is near-zero
  regardless of the flag), but the others are worth a direct confirmation
  before scoping D3's build order.
- Whether the agent's per-turn map snapshot reads the live `child_progress_
  live` projection or the frozen `child_reports` row was not fully traced;
  if the latter, Homa may be conversing from a stale number even after the
  projection itself has correctly drifted with age.
- The voice Phase-0 discrepancy in D6.
- `subject_lessons.target_item_id` is nullable; what fraction of built
  lessons in production actually carry a non-null taxonomy item was not
  measured, and determines how much of the subject-lesson rail in 2.8 is
  scorable versus statement-only today.

## Appendix: audit method

21 agents across four phases (Map: 8 subsystem readers; Hunt: 7 adversarial
failure-point hunts, one per subsystem, each independently re-running the
real matcher/classifier code against realistic phrasing rather than reading
it; Cross: multi-child fan-out design, completed; Cross: signal-weighting,
follow-up-loop, and simulation-harness designs, plus a completeness critic,
interrupted by a mid-session usage cap and completed by hand in this
document from the same source evidence, with the load-bearing claims
(chart-history counts, evidence-source counts, check-in state counts)
independently re-verified against production Supabase after the interrupt).
Subsystems covered: conversational journal capture, scoring and taxonomy,
check-ins, lesson-listen, materials/planner/hours, per-turn agent context
and follow-up machinery, per-channel coverage (web, SMS, email, voice,
mobile, photos), and existing test/eval coverage.
