# Native onboarding + paywall v2 spec

Status: **READY TO EXECUTE (2026-08-31).** The design is fully ruled:
all 16 decisions in [walk-v2-proposal.md](walk-v2-proposal.md) are
closed, [copy-deck.md](copy-deck.md) is the twice-gated, corpus-checked
string source of truth, and the D1 skeleton analysis lives in
[sequence-options.md](sequence-options.md). Executors: read this file,
then system-model.md, then walk-v2-proposal.md, then copy-deck.md, then
agent-operations.md before running anything.

This is the only current spec for native (iOS app) onboarding and paywall.
It supersedes, for that surface, the older planning docs listed under
[Superseded prior plans](#superseded-prior-plans) below: do not carry
forward their rulings, founder decisions, or "D-numbers" unless this doc
restates them. Where this doc is silent, ask, don't inherit.

Two companion documents live in this folder:

- [`system-model.md`](system-model.md): the system seen whole, the tower
  of abstractions execution must preserve, and the smallest moves that
  finish the half-built state machine at its core. Read it before
  touching mechanism.
- [`agent-operations.md`](agent-operations.md): how to actually build,
  drive, and verify this surface in the simulator today, including every
  trap the 2026-08-30/31 sessions paid for. Read it before running the
  app.

All research, discovery, references (articles, screenshots, competitor
flows), and working notes live in
[`work/onboardingandpaywall8-30/`](../../../../work/onboardingandpaywall8-30/)
at the repo root, not in this directory. That folder is the messy working
area; this file is the clean output. List the folder for current contents
rather than trusting any inventory written here (context-file rule: never
hand-maintain what a command can list). Its stable entry points:
[`current-state-audit.md`](../../../../work/onboardingandpaywall8-30/current-state-audit.md)
(the detailed version of section 1),
[`patterns.md`](../../../../work/onboardingandpaywall8-30/patterns.md)
(the cross-app persuasion synthesis), and
[`delta.md`](../../../../work/onboardingandpaywall8-30/delta.md) (gap
analysis against the reference articles).

---

## 1. Current reality (verified 2026-08-30/31, code is the source of truth)

This section is a snapshot of what the native app actually does today. It
exists so the plan below is built on fact, not on the stale intentions in
the superseded docs. Re-verify anything here that looks load-bearing
before relying on it; code moves. (Outcome 9 exists to make this section
assert itself instead of rotting.)

### 1.1 Onboarding walk

- Screens, in order: `hello → intent → kids → you → making → reveal → next`.
  Code: [`apps/mobile/src/app/(onboarding)/`](../../../../apps/mobile/src/app/(onboarding)/),
  state machine in
  [`onboarding-state.ts`](../../../../apps/mobile/src/features/onboarding/onboarding-state.ts).
  `making` is not a passive wait: it embeds a real per-child progress
  questionnaire (`ChecklistTakeover`) that runs concurrently with the
  worksheet build. See 1.2 for why that screen specifically is where the
  paywall usually arms.
- Fully pausable: every answer writes to `mobile_onboarding_state`
  (Postgres, RLS-scoped) as it's given. Re-entry resumes on the exact
  step left off, via a bootstrap call (`POST /api/mobile/onboarding`).
- A family that started on web skips the native walk entirely and picks
  up in chat instead (`bootstrapOnboarding()` returns `world: "web"`).
  Native and web onboarding never both run for one family.
- `next.tsx` ends the walk with three doors (another worksheet / plan the
  week / just look around) and fires a `mobile_onboarding.completed`
  event carrying `second_create_tapped` (see 1.3; this is presently only
  an analytics field, not a gate input).
- Known current defect, patched around but not fixed at the root: the
  walk's copy assumes she's still "free" all the way to the doors screen,
  but the paywall (1.2) can already be armed by the time she gets there.
  Recent patches ([`9871be4b`](https://github.com/sidneyswift/homa/commit/9871be4b),
  [`41464b46`](https://github.com/sidneyswift/homa/commit/41464b46))
  softened the wording; they did not change when the wall actually arms.

### 1.2 Paywall / billing gate

- `BillingGate` ([`apps/mobile/src/components/billing-gate.tsx`](../../../../apps/mobile/src/components/billing-gate.tsx))
  wraps the entire `(tabs)` shell: Today, Chat, Family, everything
  post-onboarding. Live since `#555` (2026-08-01), same mechanism as the
  web wall.
- It calls `GET /api/billing/gate`
  ([route.ts](../../../../apps/web/app/api/billing/gate/route.ts)), which
  answers `open: gate.checkout === null || onboardingActive`.
- `onboardingActive` comes from `familyOnboardingActive()`
  ([apps/web/lib/onboarding/state.ts](../../../../apps/web/lib/onboarding/state.ts)),
  gated by a durable record on `families.context.onboarding` that the
  mobile bootstrap deliberately keeps `"active"` through the whole walk
  (so an early `profile_completed_at` stamp, e.g. from the `you` screen,
  does not end the free window by itself). The record only flips to
  `"done"` through `resolveOnboardingCompletion()`, which has exactly two
  callers: `createReport()` (`lib/map/store.ts:1407`, the path every
  scoring channel shares) and the web `/onboarding` page render
  (`app/onboarding/page.tsx:93`, where the 14-day backstop can fire with
  no report ever scored). The resolver requires profile-complete + a
  child + a **scored report**, or the backstop
  (`onboarding-completion-milestones`, founder ruling 2026-07-31). For
  native, that resolves concretely to: **the moment a checklist session
  in `making` with at least one answer closes**, which fires
  `finalizeReport()` → a report gets scored → all three facts are true →
  the record flips. This is deliberate design, not an accident, and it
  can fire mid-`making`, well before `reveal` or `next` render, matching
  the comment at `next.tsx:34`.
- Net effect: the free window is not "the whole onboarding walk," is not
  "until she taps a second create," and isn't even a fixed screen. It
  ends when she closes an answered checklist, *if* she engages it at all.
  Skip it, and the free window can survive past `next` into the tabs,
  until a report gets scored some other way, possibly days later. Either
  way, screens after the trigger (`reveal`, `next`) don't know it
  happened, so she can keep walking on a stale "you're still free"
  assumption, then hit a hard wall the instant she taps into a real tab.
- **Live-verified end to end, 2026-08-31**, on a real production family
  from the simulator: reopening the checklist from chat, answering to
  "Questions complete," and closing it sent the `checklist_complete`
  directive; eve rendered the report-reveal card, whose mount effect
  fired `finalizeReport()` (`onboarding-cards.tsx:486`, `if
  (!card.alreadyScored)`) → `POST /api/map/score` → `createReport()` →
  the record flipped, and the next app launch landed on the real
  `BillingGate` subscribe screen. Note the asymmetry: the `making`-screen
  close fires finalize deterministically; the chat close is
  model-mediated (eve decides to render the card) and only scores when
  the card mounts. The full call-site inventory and the exact driving
  sequence are in [`agent-operations.md`](agent-operations.md).
- Two mechanism facts confirmed in that same pass. First, **the flip is
  silent**: `resolveOnboardingCompletion()` (`store.ts:213-214`) writes
  `state: "done"` and emits nothing; whether the keystone or the 14-day
  backstop caused it is discarded inside a boolean return, while
  `map.report_generated` is emitted three frames up the same stack.
  Second, **clients only notice on mount or app-foreground**
  (`use-billing-gate.ts:65-80`; no polling, no push, plus an independent
  duplicate hook mount in `settings.tsx:59`), which is why the wall
  presents as "appears on next launch."
- StoreKit 2 purchase flow (product fetch, purchase, receipt
  confirmation, App Store recovery on foreground, restore purchases) is
  real and working, in the same file. Only a monthly plan is currently
  merchandised on iOS.
- The `second_create_tapped` field on the completion event is **not read
  by any gate check anywhere in the repo** (verified by grep across
  `apps/web` and `apps/mobile`). A "wall triggers at second create"
  design was proposed in the 2026-08-18 plan (its D4) and never built;
  only the event field exists.

### 1.3 What this means for a v2 design

Whatever this spec lands on for "when does the wall arm," it needs to
either (a) make the walk's own copy/state aware of the real trigger
(questionnaire scoring, today), or (b) change the real trigger to match
whatever story the walk tells her, or (c) some combination. It cannot
just be a copy patch again, because the underlying mismatch will keep
resurfacing as the walk changes. That choice is one of the open decisions
below, not resolved yet.

### 1.4 Operability of the current system (verified 2026-08-31)

The mechanism in 1.2 is real, and it is mute, blind, and unaddressable
for whoever has to operate it. Full analysis and the layer-by-layer map:
[`system-model.md`](system-model.md). The verified facts:

- The decisive transition emits nothing, and its cause (keystone vs
  backstop) is not recoverable from data (see 1.2).
- `GET /api/billing/gate` gives `open` no reason shape: the response
  carries `lapsed`, `planTier`, `billingProvider`, and `billingPeriod`,
  but onboarding grace, real entitlement, and the mobile exemption are
  indistinguishable inside the one `open` boolean, and the inputs behind
  it go to the server console or nowhere (`route.ts:92-99`).
- Nothing reads `families.context.onboarding` except the onboarding
  library itself: no admin page, no dev route, no inspect surface. Admin
  derives its "onboarding" stage label from `hasReport`, not the record,
  and `/dev/paywall` is a visual bench that 404s in prod and exposes no
  family state, by its own docstring.
- `apps/mobile` ships exactly zero `testID`s; driving the UI means
  guessing pixels against screenshots.
- The mobile env pins production (`EXPO_PUBLIC_API_URL=https://thankshoma.com`,
  prod Supabase). There is no sandbox target, so verifying the wall means
  creating real rows in prod.

Cost, measured once: a single verification of "does the wall arm" took
roughly 40 minutes of live taps, a five-file trace to re-derive the
trigger, and a real production family. Outcome items 5-9 exist to make
that cost structural history.

---

## Founder decisions (ruled so far)

- **RULED 2026-08-30, persuasion-sequence-yes:** Homa's native onboarding
  will include a real persuasion sequence for the parent. This corrects
  an earlier research misstep, recorded honestly in
  [`work/onboardingandpaywall8-30/patterns.md`](../../../../work/onboardingandpaywall8-30/patterns.md):
  comparing Homa against child-facing managed apps (GoHenry, Greenlight,
  Spotify Kids, Kit) treated them as Homa's category match and concluded
  a persuasion sequence might not be warranted. That's a real category
  error: those apps' end user is the child; the parent is only the
  account administrator, never the one being sold to. **Homa's end user
  and buyer is the parent.** The correct comparator category is
  adult-facing subscription apps (Duolingo, MyFitnessPal, Flo, ChatGPT),
  where the research shows persuasion sequencing genuinely converges
  (goal-before-features, real proof over fabricated proof,
  default-selected annual pricing, trial-framed CTAs, a win-back offer on
  dismiss), none of which resembles the reference article's specific
  17-screen assembly, which no app studied actually runs in full. Design
  the sequence from the validated techniques, not from either extreme.
- The kids-app research isn't discarded: it's the closest model found for
  one genuinely novel sub-problem no adult-subscription app has to
  solve, collecting a THIRD PARTY's (the child's) identity inside a flow
  whose actual subject is the parent. Duolingo ABC's short "who's
  learning → age → avatar" pattern is the closest partial analog.

## 2. Outcome

Native onboarding takes a parent from account creation to her first real,
personalized worksheet through a **deliberate persuasion sequence**, not a
bare data-collection form, and the paywall she eventually hits is a
**predictable, named moment the walk itself is honest about**, not a
silent trap sprung mid-flow by a report-scoring side effect three layers
away from the screen she's looking at.

**Equally true when this ships: the system is legible and drivable by the
agents and engineers who build on it.** [`system-model.md`](system-model.md)
is the architecture of this half. The economic state machine that today
flips silently inside `createReport()` becomes a narrated, readable,
addressable thing, and every layer above it (screens, gate clients,
tooling, docs) reads it instead of assuming it. This is not bolted-on
tooling preference: 1.4 is the measured cost of its absence, and the
honesty defect in 1.3 is what a mute state machine does to its own UI.
It also follows doctrine Homa already holds elsewhere:
`models-judge-code-verifies` (a deterministic read beats a judged
screenshot everywhere except judging aesthetics) and the context-file
rules (one home per rule; never hand-maintain what a command can list).

Concretely, true when this ships:

1. Every screen in the walk does real persuasion work (identity, desire,
   investment, proof, trust, drawn from the techniques
   `work/onboardingandpaywall8-30/patterns.md` actually validated across
   22+ real apps) or real product work (collecting what the worksheet
   needs), never neither. No screen is filler, and no screen fakes a beat
   that isn't real (no invented "personalizing…" checklist, no population
   stat standing in for Homa's own proof).
2. The wall's arming condition is a single, name-able event the walk's
   own code can react to. Today it's an emergent side effect
   (`resolveOnboardingCompletion()` inside `createReport()`, see 1.2)
   that `reveal` and `next` have no way to check. After this ships,
   either the walk checks the real event before it promises continued
   free access, or the trigger itself changes to match a fixed point the
   walk controls. Not another copy patch over the same blind spot.
3. The assets already working today survive: the real personalized
   worksheet as proof (not a mockup), personalization that actually
   changes the product (`kids` screen answers reach the worksheet), and
   full resumability (pause anywhere, resume exact position).
   **Correction, 2026-08-30**: this bullet previously also credited
   `making`'s Reanimated motion (`making-show.tsx`'s easel/spring-chip
   animation) as a working asset to preserve. A code self-audit found
   that component is fully built but **never rendered anywhere in the
   app** (`grep -rn "MakingShow" apps/mobile/src` matches only its own
   definition). The commit that added it said it would cover the
   no-questions path, but `making.tsx` never actually branches to it;
   every real family gets the plain `InkDots` wait instead. See
   `work/onboardingandpaywall8-30/motion-self-audit.md` finding #1. This
   is a real gap to close (wire it in or delete it), not an asset to
   protect. Don't let "making already has real motion" survive into
   execution unchecked.
4. Motion across the redesigned walk reaches the bar `making` already
   sets today, judged against named reference apps/moments (see 8; this
   needs Sidney's input to close), not the word "delightful."
5. **The transition narrates itself.** When the onboarding record flips
   to `"done"`, an event lands in `public.events` (the same pipe the
   funnel tooling already reads, and the same pipe `map.report_generated`
   already uses) carrying its cause, keystone or backstop. Today the flip
   is silent and the cause is discarded inside a boolean
   (`store.ts:213-214`, verified 2026-08-31). "Why is this family walled"
   becomes a data read, not archaeology.
6. **Projections read the journey; none redefines it.** The walk's late
   screens and the gate's clients consume journey state the server owns,
   and the gate response gives `open` a reason shape a client can be
   honest with (today grace, entitlement, and exemption are one
   indistinguishable boolean, `route.ts:92-99`). Look-alike paths either
   share the one write path or are named, tested divergences: today the
   checklist has four close/score-shaped call sites with four different
   behaviors and zero names (the inventory table lives in
   [`agent-operations.md`](agent-operations.md)).
7. **The UI is name-addressable.** Every interactive element in the walk
   and checklist carries a stable, screen-scoped `testID`
   (`intent.option.worksheets`, `checklist.close`). Today the count in
   shipped mobile code is zero, and the 2026-08-31 driver burned dozens
   of screenshot round trips guessing pixels at a close button that has a
   name in source and none at runtime.
8. **Any state costs one command.** A sandboxed harness in the
   `eval:sandbox` lineage (`apps/web/lib/eval-isolation.ts` is the
   precedent) can arm or disarm the wall for a disposable family. The
   organic prod journey (recorded in `agent-operations.md`) stays for
   final validation; it stops being the only path.
9. **The map asserts itself.** A `check:journey` guard in the house
   pattern (template: `check:tool-deadlines`; script plus colocated test,
   one `package.json` line, one named step in ci.yml's `checks:` job)
   asserts this spec's load-bearing mechanism claims so §1 cannot rot
   silently: the record's write path stays sole, no gate input is phantom
   (`second_create_tapped`), no walk component is dead (`MakingShow`),
   testID coverage holds.

## 3. Verification surface

- **Screen audit table**: every screen in the shipped walk, one line
  each, naming its persuasion job or its product job (or both). A screen
  with neither is a defect, not a style choice.
- **Wall-arm event, made visible**: a single logged/traceable point in
  code where the free window ends, with the walk's own UI observably
  reacting to it (no screen after that point still promising free
  access). Testable by walking the flow with the checklist answered vs.
  skipped and confirming the walk's copy matches the family's real
  entitlement state in both cases.
- **Journey narration parity**: for one family driven through the flow,
  the gate's answer, the stored record, and the transition event agree,
  and the event names its cause. Checked in the sandbox, spot-checked
  once against prod.
- **Inspect read**: one surface (admin family page section or dev route;
  §8 holds the where-question) answers "state and why" for a family, and
  its answer matches the underlying rows.
- **Sandbox demo**: arm and disarm the wall for a disposable family by
  command, with zero production rows created.
- **Funnel events**: each new/changed screen emits through the existing
  `emitFamilyEvent` pipeline (same infra `reportOnboardingStep` already
  uses), so signed-in → reveal_shown rate, wall-hit position, and
  completion can be computed the way admin funnel tooling already does
  elsewhere in the product. No new analytics stack.
- **Device-recorded walkthrough**: a real screen recording (iOS Simulator
  or device, `xcrun simctl io recordVideo` or the Simulator tool) of the
  full shipped walk, reviewed against Sidney's named AAA reference
  apps/moments (open until Sidney names them, see 8). Not a written
  description and not a tool-generated score (per
  `work/onboardingandpaywall8-30/motion-tooling-research.md`, no such
  scorer exists for Reanimated).
- **Existing guards stay green**: `pnpm check:child-progress`,
  `pnpm check:progress-ui`, and any mobile onboarding tests, plus a
  manual resume check (force-quit mid-walk, relaunch, confirm exact
  resume position). Resumability is a hard-won property of the current
  implementation and must not regress silently. `check:journey` (Outcome
  9) joins this roster once it exists.

## 4. Constraints

- **No fabricated proof, no manufactured urgency or decoy pricing.**
  Already law (`homa-paywall-claims-laws`), reinforced by this research:
  Facetune's weekly-vs-87%-off-annual anchor and MyFitnessPal's
  discount-badged win-back offer are patterns to study, not copy
  verbatim.
- **Resumability is non-negotiable.** Every answer persists the instant
  it's given; re-entry lands on the exact screen left off. This is the
  current implementation's load-bearing law (`onboarding-state.ts`'s own
  docs) and must survive redesign.
- **Tenancy unchanged.** `familyId` never comes from client input; every
  new write re-scopes under the caller's RLS session, same as today.
- **Reification is not redefinition.** The completion rule itself
  (profile complete + a child + a scored report, or the 14-day backstop;
  founder ruling `onboarding-completion-milestones`) does not change
  under Outcome items 5-9. Those items make the rule audible, readable,
  and testable, not different. If the v2 design changes when the wall
  arms (the 1.3 choice), that is a separate, explicit decision recorded
  in §8, and it lands inside the one machine.
- **Web/native split (D6) unchanged.** A family that started on web
  still never sees the native walk.
- **App Store review compliance** for any paywall copy change (trial
  terms, charge disclosure, restore-purchases visibility). StoreKit
  review requirements don't relax because the copy around them changed.
- **Brand voice and children's-data laws unchanged**: no em dash,
  sentence case, "she decides, Homa suggests," never a verdict on a
  child. Directly relevant if a personalized-stat moment (article 2's
  tip 6, still an open question) gets designed: it must be specific to
  this kid, never a population comparison.
- **Accessibility**: any new motion ships with Reduce Motion support from
  the start, not as a follow-up (the standard both newly-installed motion
  skills, `expo-animation` and `mobile-touch`, treat as non-negotiable,
  and consistent with Homa's existing accessibility work). `testID`s
  (Outcome 7) are additive and must not replace or degrade
  `accessibilityLabel`s; the two serve different readers.
- **Children's data handling**: if the account-timing open question (8)
  resolves toward collecting the child's name/age/interests before a
  full account exists, that is a legal-exposure question, not only a
  design one. Flag for whoever owns that call before implementing; don't
  decide it inside this spec.

## 5. Boundaries

In scope: `apps/mobile/src/app/(onboarding)/`,
`apps/mobile/src/features/onboarding/`,
`apps/mobile/src/features/billing/`,
`apps/mobile/src/components/billing-gate.tsx`,
`apps/mobile/src/features/chat/checklist-takeover.tsx` and
`apps/mobile/src/features/chat/onboarding-cards.tsx` (strictly for
Outcome 7 testIDs and naming the close-path divergences, not a chat
redesign), `apps/web/lib/onboarding/` (the
`familyOnboardingActive`/record mechanism), `apps/web/lib/billing/wall.ts`,
`apps/web/app/api/billing/gate/route.ts`,
`apps/web/app/api/mobile/onboarding/route.ts`, `scripts/` plus one named
step in `.github/workflows/ci.yml` (the `check:journey` guard),
`apps/web/lib/map/events.ts` strictly as the emission pipe for the
transition event, the inspect surface's eventual home (the admin family
page via `apps/web/lib/admin/family-detail-data.ts`, or a dev route; §8
decides which, and either way it is read-only rendering of existing
state), and their tests.

Explicitly out of scope: web's own onboarding flow (D6 keeps it
separate), the StoreKit purchase mechanics themselves (working today, not
broken), and the map/scoring engine itself (`createReport()`,
`resolveOnboardingCompletion()`) beyond the one emission at the flip.
Don't relicense a rewrite of report scoring to fix an onboarding UX
problem.

## 6. Iteration policy

After each change, record what changed, what the verification surface
(§3) showed, and the next best experiment to try. Operational discoveries
(build tricks, simulator traps, state-setup shortcuts) accrete into
[`agent-operations.md`](agent-operations.md) in the same session they are
paid for, so no session re-derives what a prior one learned.

## 7. Blocked-stop condition

Stop and report the attempted paths, evidence gathered, the blocker, and
the exact input needed, if any of: the verification surface can't be run;
the account-timing question (8) turns out to need a data-model change
neither this doc nor a quick check can safely resolve; or Sidney hasn't
yet named AAA reference apps/moments and a motion decision is blocking on
it. None of these are guesses to paper over.

---

## 8. Open questions

Running list. **Update 2026-08-31**: most items below closed via the
ruled decisions in walk-v2-proposal.md (the persuasion sequence, the
wall-arm surfacing, the making-wait rebuild, the motion references, and
the personalized-stat question are all settled there; the account-timing
question stays parked as a future experiment per the D1/S5 rulings).
Still genuinely open: the four mechanism placement questions below
(journey-state read surface, transition-log home, inspect-surface home,
sandbox scope), which the executor resolves during build per
system-model.md.

- [ ] Which specific validated techniques (from `patterns.md`'s
      convergent list) compose the persuasion sequence, and in what
      order, for Homa's specific screens? **Proposal drafted
      2026-08-31, awaiting Sidney**: [`walk-v2-proposal.md`](walk-v2-proposal.md)
      lays out the full 10-beat walk (copy, data, visuals, motion) and
      its 12-decision approval checklist. Approving that doc, with
      whatever tweaks, closes this question.
- [ ] How does the wall's real arm condition get surfaced to the walk:
      new copy/state that reacts to the real trigger, or a changed
      trigger that matches a fixed point the walk controls? (see 1.3,
      Outcome 2)
- [ ] Where do clients read journey state: new fields on
      `GET /api/billing/gate`, a field on the mobile onboarding bootstrap
      response, or both? (Outcome 6)
- [ ] Transition log home: `public.events`, which the funnel tooling
      already reads and `system-model.md` leans toward, or a dedicated
      table? (Outcome 5)
- [ ] Does the inspect surface live on the existing admin family page
      (`family-detail-data.ts` already assembles that view) or a
      dev-only route? (Outcome 6, §3)
- [ ] Is the sandbox harness (Outcome 8) in scope for v2 execution, or
      split into a companion plan? It is the largest infra item on the
      list, and Outcome items 5-7 and 9 do not depend on it.
- [ ] Can the child's identity (`kids` screen) be collected before a full
      account exists, enabling a true "account-last" moment
      (Walkify-style: show the reward, then ask to log in), or does
      Homa's data model require the account first? **Partially
      de-risked, 2026-08-30**: BabySparks (a real, shipped,
      top-of-category parent-of-a-dependent app; see
      `work/onboardingandpaywall8-30/research/greenlight-or-equivalent/screens.md`,
      chosen as the closest real substitute once Greenlight/GoHenry were
      confirmed absent from Appllama's catalog entirely) captures the
      child's full name, photo, gender, and due date **two full screens
      before any account field appears**, and the account gate that
      eventually shows is a single email field, no password visible at
      that point, the lightest account gate found anywhere in this
      research. That's real evidence the pattern ships and converts at
      scale, not just a design preference. Still open: whether Homa's
      *own* data model (a real `children` row insert, tied to `familyId`)
      can support a temporary/unclaimed profile the same way. That's a
      technical call for whoever owns the schema, not settled by
      precedent alone.
- [ ] Does the `making`-wait screen get rebuilt into a live capture
      conversation (the founder-directed next step noted in the
      superseded 2026-08-18 plan), or is that out of scope for this spec?
- [ ] What 2-3 apps or specific moments does Sidney consider AAA-feel, to
      anchor the motion verification surface in something nameable?
- [ ] Is a single, kid-specific personalized-stat moment (article 2's tip
      6) worth designing, distinct from the generic population-stats
      screens `delta.md` was skeptical of?
- [ ] What references is Sidney still bringing, and what do they imply
      about the target look/flow?

## 9. References

See [`work/onboardingandpaywall8-30/`](../../../../work/onboardingandpaywall8-30/)
at the repo root, plus the two companion docs in this folder
([`system-model.md`](system-model.md),
[`agent-operations.md`](agent-operations.md)).

---

## Superseded prior plans

For provenance only; do not treat these as binding for native
onboarding/paywall going forward:

- `docs/homa-planning/plans/2026-08-18-mobile-onboarding-research.md`
- `docs/homa-planning/plans/2026-08-18-mobile-onboarding-v1-plan.md`
  (its D4 "wall stays dark until ruled" describes a wall that was never
  built; see 1.2 for what actually gates the app today)
- `docs/homa-planning/plans/2026-07-28-trial-paywall-redesign.md`
- `docs/homa-planning/plans/2026-07-25-overnight-icp-paywall-simulation.md`
- `docs/homa-planning/plans/2026-08-01-unified-cross-platform-billing.md`
