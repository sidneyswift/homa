# Execution log: 2026-08-31 session (gh#1045, PR #1046)

The spec's §6 iteration record: what changed, what the verification
surface (§3) showed, and what the next best experiment is. Companion
docs updated in the same session: agent-operations.md (the collapsed
close-path table, two new build traps).

## What changed

system-model.md moves 1-5 and 7 (narrated flip, gate reason shape, walk
reads journey state, admin inspect surface, testIDs, check:journey
guard), plus the walk's climax: S10 paywall and S11 decline, D8's one
close path, D9's MakingShow wiring, D15's rechaptered checklist, D16
haptics, the D13 reminder module, the D3 catalog, and the deck's
strings verbatim on every shipped screen. Split into companion lanes:
the sandbox harness (gh#1047), the free-page credit (gh#1048), the
guest head + gallery (gh#1049).

## Screen audit table (spec §3): the shipped walk

Every screen names its persuasion job or its product job. No screen has
neither; no screen fakes a beat that is not real.

| Screen | Persuasion job | Product job |
|---|---|---|
| S1 hello | Identity + promise: Homa introduces herself, one claim, and promises the first worksheet carries the kid's name | none (collects nothing, by design) |
| S2 intent | Goal-before-features: her goal picked before any feature tour | Collects intent (routes the walk and the funnel) |
| S6 kids | Investment: naming the kid, their loves, their working edge is sunk effort that personalizes the payoff | Collects the children rows the worksheet build needs |
| S7 you | Trust: "I've done the reading" on state rules; her name warms every later line | Collects parent name + state (drives rules features) |
| S8 making + checklist | Investment while waiting (the chaptered questionnaire funds the report, the paywall's proof); honest theater (the easel shows work, never a preview) | Builds the real first worksheet; collects checklist answers that score the report |
| S9 reveal | Proof + payoff: the real page, named for the kid, receipts from her own answers | Print/share the real artifact |
| S10 paywall | The ask at the peak, procedural transparency (real prices from the store, no fabricated claims) | Collects the purchase through the one StoreKit engine |
| S11 decline | Trust kept: nothing she earned is taken away; the true state of her free window, read from the gate | Routes to kept pages (Binder) or the doors; completes the walk with a real door |
| S12 doors | Momentum: the more-I-know promise at a peak, by name | Completes the walk; routes to the chosen door |

Absent by ruling: S3 (cut). Pending in gh#1049: S4 (proof gallery),
S5 (relocated account gate). Until they land the walk still begins
post-auth at S1, which keeps every beat above real.

## What §3 showed this session

- **Wall-arm event, made visible**: `onboarding.completed` emits with
  cause at the resolver; check:journey asserts emission-after-write.
  The walk's own UI reaction is S10/S11 branching on the gate's reason
  (deterministic read, not copy).
- **Journey narration parity**: enforced structurally (open derives
  from reason; the admin panel renders the same functions the phone
  calls). The sandbox-driven parity run moves to gh#1047; the organic
  prod spot-check remains open below.
- **Guards**: check:journey (new) green; check:billing 280/280;
  check:events green; check:onboarding 180/180; check:mobile-chat
  111/111; check:mobile-bootstrap 15/15; check:mobile-accessibility
  green; check:child-progress 478/478; check:progress-ui 369/369;
  check:isolation green; migration-versions green; full typecheck +
  lint; eve build + stream duration under VERCEL=1.
- **Fingerprint**: unchanged through the pure-JS commits; changed by
  expo-haptics + expo-notifications (cdf98238 -> aeafade8). Everything
  on this branch OTA-publishes but reaches no phone until a store
  binary ships (ios-release skill owns that).
- **Simulator walkthrough (completed same session, new binary with the
  D13/D16 pods, live against prod on the sandbox +homatest831 family)**:
  the recording is `walk-v2-recording-2026-08-31.mp4` (delivered to
  Sidney; raw 590MB original in the session scratchpad). Verified live,
  in walk order: the wall renders through the extracted purchase engine
  with the documented simulator StoreKit-unreachable state; the D5
  read-only Binder exception admits a walled family's pages while every
  other route walls on the next tap; deck strings verbatim on
  S1/S2/S6/S7/S8/S9/S12; the kids-before-you order; D15's chapter tag
  ("Finn · Math · 1 of 16"), segmented bar, cover stop-affordance, and
  the deterministic receipt beat ("That's Math done. 2 answers so
  far."); D8's one close path scored Finn's report on the way out and
  prod's own resolver re-flipped the record; MakingShow rendered for
  the first time ever with the kid's verbatim chips and real job notes,
  and its exit carried the walk to a reveal holding a REAL personalized
  page (dinosaur multiplication split exactly at the edge the checklist
  answers named); S10 presented at the climax with the real page as
  hero and invented no price claims in the unreachable state; S11 chose
  its armed branch by READING the gate (spec Outcome 2/6 end to end);
  the walk completed into the Binder; force-quit + relaunch resumed on
  the exact saved step.
- **Two wall-mechanics proofs came free**: prod's answer route refused
  the checklist for the walled family (the gh#305 exemption correctly
  scoped to mid-onboarding families), and reopening the record via SQL
  flipped it back to grace, after which saves succeeded.
- **Pre-deploy expectations confirmed, not defects**: the prod event
  relay rejected the new step names (you/paywall/decline, and the
  binder door) until this branch's registry deploys, and prod's old
  step CHECK constraint refused the new resume positions until the
  migration applies (saves are non-blocking by design, so the walk
  never stalled). Both light up at deploy; the migration-apply law
  applies.
- **One copy nit found live**: the checklist save-error line renders
  the API layer's thrown message ("That did not save. Nothing is lost,
  so try again."), not the deck's revised S8 string; the deck fix
  belongs in onboarding-card-api where the message originates. Filed
  into the deck-parity follow-up on gh#1045.

## Next best experiment

The gh#1049 gallery assets (one 9-12 page, one 13+ page via the real
pipeline), then the guest head. After this branch deploys and its
migration applies, re-run the S8-to-S11 arc once on a fresh +homatest
family to watch onboarding.completed land in public.events with cause
"keystone" (the sandbox harness in gh#1047 makes that a command).
