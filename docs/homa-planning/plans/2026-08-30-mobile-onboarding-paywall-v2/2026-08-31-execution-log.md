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
- **Simulator walkthrough**: recorded below as it happens.

## Next best experiment

Drive the full walk on the simulator against the new binary: resume
check (force-quit mid-walk), the S10 presentation in the simulator's
no-StoreKit state (the documented "can't reach the App Store" screen),
S11's free-window branch, and the D12 surface-by-surface motion
judgment from a real recording. Then the gh#1049 gallery assets.
