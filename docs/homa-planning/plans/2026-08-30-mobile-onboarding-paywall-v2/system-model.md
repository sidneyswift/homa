# System model: the journey, seen whole

Companion to [spec.md](spec.md). The spec says what must become true; this
doc says what the system IS, so that whoever executes (human or agent)
holds one mental object instead of seven screen files, a resolver, and a
gate route. Written 2026-08-31 from code verified the same day. Line
numbers drift; re-verify before leaning on one.

## One system, two machines

Native onboarding plus paywall is two state machines sharing one Postgres
substrate:

- The **product machine**: what the family has told Homa and what Homa has
  made. Answers, children, worksheets, reports. Rich, well-stored, honest.
- The **economic machine**: what the family may access. Free window open,
  wall armed, subscribed. Three states, one economically decisive
  transition (the flip to walled), and today it has no voice of its own:
  its one transition fires as a side effect of the product machine
  (`resolveOnboardingCompletion()`, reached through `createReport()` or a
  web `/onboarding` render), silently.

Every operability pain the 2026-08-30/31 sessions hit is a shadow of that
one missing reification:

| Pain (measured, not hypothetical) | Shadow of |
|---|---|
| The walk promises free access after the wall is already armed (spec 1.3) | screens cannot read a state that is not readable |
| Five-file trace to re-derive the trigger | the transition is smeared across the product machine's call graph |
| "See it" bypasses finalize while the checklist's own close fires it | closing a UI is doing double duty as an economic trigger, unnamed |
| 40 minutes of prod taps to verify one arming | the only way to set economic state is to perform the product journey |
| "Why is this family walled" unanswerable from data | the flip emits nothing and discards its own cause |

## The machine already half-exists

Do not build a new machine. Finish this one. The verified inventory:

| Piece a real state machine needs | Where it lives today | Status |
|---|---|---|
| Sole write path | `writeOnboardingRecord()`, `apps/web/lib/onboarding/store.ts:76`, a single UPDATE choke point | exists |
| Pure decision function | `onboardingCompletionReached()`, `apps/web/lib/onboarding/state.ts:239`, injectable clock, no I/O | exists |
| Decision plus write | `resolveOnboardingCompletion()`, `store.ts:173`, exactly two callers (`app/onboarding/page.tsx:93`, `lib/map/store.ts:1407`) | exists |
| The one read every surface asks | `familyOnboardingActive()`, `state.ts:135` | exists |
| Transition log | nowhere: the flip at `store.ts:213-214` writes `state: "done"` and emits nothing; keystone vs backstop cause is discarded inside a boolean, while `map.report_generated` is emitted three frames up the same stack | missing |
| Client-readable state | `GET /api/billing/gate` returns `open`, `lapsed`, `planTier`, `billingProvider`, `billingPeriod` (`route.ts:92-99`), but `open` itself has no reason shape: grace, entitlement, and exemption are indistinguishable, and the inputs behind it go to server console or nowhere | missing the part that matters |
| Inspect surface | nothing reads `families.context.onboarding` except the onboarding library itself; admin derives its "onboarding" label from `hasReport`, and `/dev/paywall` is a visual bench that exposes no family state | missing |
| Addressable UI | `testID` count in shipped `apps/mobile` code: zero | missing |
| Reachable non-prod state | `apps/mobile/.env` pins `https://thankshoma.com` and prod Supabase; there is no sandbox target | missing |

The exists column is the foundation. The missing column is this plan's
operability work, and none of it changes what the machine decides, only
whether anyone can hear, read, drive, or test it.

## The tower

Six layers. Each depends only downward. A question enters at the layer
where it lives; if answering it forces a descent to raw rows or a source
read, the layer above has failed, and the fix belongs in that layer, not
in the reader's stamina.

| | Layer | Role | A question that enters here | Today |
|---|---|---|---|---|
| L6 | Guards | CI asserts the map matches the territory | "is spec §1 still true?" | house pattern exists (`check:tool-deadlines`), not applied here |
| L5 | Operations | sandbox, one-command state setup, name-addressable UI | "make this family walled" | missing (zero testIDs, prod-only) |
| L4 | Introspection | one read: state, why, and what would change it | "why is this family walled?" | missing entirely |
| L3 | Projections | walk screens, `BillingGate`, funnel events: all read L2, none redefines it | "what should this screen say?" | broken: walk assumes, gate flattens to one boolean |
| L2 | Journey | the economic machine: record, sole write path, pure predicate, narrated transitions | "did the free window end, and why?" | half-built: decides correctly, silently |
| L1 | Facts | Postgres rows: answers, children, reports, purchases, events (RLS, tenancy) | "what did the family tell us?" | solid |

## Principles, each bound to a scar

1. **One write path per economic transition.** Already true at L2
   (`writeOnboardingRecord`); keep it true as the walk changes. Scar: the
   checklist has four close/score-shaped call sites with four different
   behaviors (deterministic finalize, nothing, a model-mediated
   directive, and a quiet finalize-on-mount in the report card), and
   nothing names the divergence. The one home of that inventory is the
   table in [agent-operations.md](agent-operations.md); the 2026-08-31
   review of these very docs caught two of them being conflated, which is
   the failure mode this principle exists to end.
2. **Transitions narrate themselves.** The flip emits an event into
   `public.events` (the pipe funnel tooling already reads,
   `apps/web/lib/admin/funnel-data.ts`) carrying its cause: keystone or
   backstop. Scar: tonight the cause of the single most important state
   change in the funnel was unrecoverable from data.
3. **Projections read, never assume.** `reveal`, `next`, and every gate
   client consume journey state the server owns. Scar: the honesty defect
   in spec 1.3 was patched twice with copy and will regenerate until the
   screens can read the state they narrate.
4. **Every operator question has a deterministic read.** Screenshots are
   for judging aesthetics; state questions get typed answers (L4). This is
   `models-judge-code-verifies` applied to operations. Scar: the only way
   to observe the wall tonight was relaunching the app and looking.
5. **The UI is name-addressable.** Stable, screen-scoped `testID`s
   (`intent.option.worksheets`, `checklist.close`). Scar: dozens of
   screenshot round trips pixel-hunting a close button that has a name in
   source and none at runtime.
6. **Any state costs one command.** A sandbox harness in the
   `eval:sandbox` lineage (`apps/web/lib/eval-isolation.ts` is the
   precedent: disposable Postgres, seeded fixture family). Scar: one wall
   verification cost a real production family and roughly 40 minutes.
7. **The map asserts itself.** A `check:journey` guard (house template:
   `check:tool-deadlines`, script plus colocated test, one `package.json`
   line, one named step in ci.yml's `checks:` job) asserts the spec's
   load-bearing claims: sole write path stays sole, no phantom gate inputs
   (`second_create_tapped`), no dead walk components (`MakingShow`),
   testID coverage holds. Scar: a commit message claimed `MakingShow`
   shipped on the no-questions path; the code never branched to it, and
   only a hand audit caught it. Rule 8 of the context-file laws: never
   hand-maintain what a command can list.
8. **Sessions accrete.** Operational discoveries land in the repo
   ([agent-operations.md](agent-operations.md)), and per-agent memory
   points at the repo file instead of duplicating it. Scar: this session
   re-derived the xcodebuild bypass and the Dynamic Type reset that a
   prior session had already paid for, because they lived only in one
   agent's memory.

## The smallest moves that finish the machine

In dependency order. Each is independently shippable; none changes what
the machine decides.

1. **Narrate the flip.** At the `reached` branch of
   `resolveOnboardingCompletion` (`store.ts:213`), emit one event with the
   cause. A few lines; unblocks everything downstream. Design note: the
   backstop's clock anchors to the record's `updatedAt`, which the mobile
   bootstrap refreshes on every open of an unfinished walk, so "backstop"
   means 14 days since the last record write, not since onboarding began;
   the event should carry the anchor timestamp so the cause is
   interpretable.
2. **Let clients read the journey.** Add shape to the gate response
   and/or the mobile bootstrap response (spec §8 holds the where-question)
   so a client can be honest instead of guessing.
3. **Make the walk read it.** `reveal` and `next` consume the state from
   move 2. This closes spec 1.3 at the root instead of with copy.
4. **Inspect surface.** One place (admin family page section or dev
   route) that renders: record state, gate inputs, and the transition
   trail from move 1. This is the "why is this family walled" answer.
5. **testIDs.** Walk and checklist, screen-scoped names.
6. **Sandbox harness.** Disposable family, one command to arm or disarm.
   Largest item; spec §8 holds the scope question.
7. **`check:journey` guard.** Locks moves 1-5 and spec §1 against rot
   (and move 6's harness once it ships; spec §8 holds whether the sandbox
   splits into a companion plan).

## What this is not

- **Not a scoring rewrite.** `createReport()` and the map engine stay out
  of scope (spec §5), except for the one emission at the flip.
- **Not a rule change.** The completion rule (profile complete, a child, a
  scored report, or the 14-day backstop; founder ruling
  `onboarding-completion-milestones`, 2026-07-31) is untouched. These
  moves make the rule audible, readable, and testable, not different. If
  the v2 design later changes when the wall arms (spec 1.3's open
  choice), it changes it in this one machine, which is the point.
- **Not a second source of truth.** The record stays the only state; the
  event trail narrates and never arbitrates. If trail and record ever
  disagree, the record wins and the guard screams.
- **Not new doctrine.** This is `models-judge-code-verifies` plus the
  context-file rules (one home per rule; rich references over
  transcription; never hand-maintain what a command can list) applied to
  the operating experience of the system itself.
