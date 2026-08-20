# Mobile onboarding v1: implementation plan

Date: 2026-08-18. Spec: the v4 wireframe flow
(https://claude.ai/code/artifact/7781a5f9-0b49-4e19-967e-d69dfa7f6a88),
the research doc (2026-08-18-mobile-onboarding-research.md, §8 settled
direction), and the cadence laws (.agents/skills/onboarding-cadence).
This plan turns the wireframe into shippable waves for the Expo app.

## What v1 is

Door (sign-in IS the welcome) → Homa hello beat → intent → meet the
kids with assembling cards → worksheet build, reveal, print → what's
next → look around with a resume chip. Pausable and durable at every
step.

Explicitly OUT of v1: the plan lane (needs the planner progress chat on
mobile), the paywall (blocked on D4, the IAP + web-Stripe + #238
ruling), voice, and any franchise-character promise in copy.

## What already exists (build on, do not rebuild)

- Auth: `signInWithApple` / `signInWithGoogle`
  (apps/mobile/src/features/auth/) create Supabase users on first
  sign-in already. Email+password UI exists; v1 replaces the password
  path with `signInWithOtp` email codes for new accounts.
- The agent-jobs pipeline (lib/jobs/, HOMA_AGENT_JOBS_ENABLED on in
  prod) and the web first-making job (`start_first_making`, single
  stage materials-studio) are live on web.
- Mobile print/share contracts exist
  (apps/mobile/src/features/materials/material-print.ts,
  material-share.ts).
- The web onboarding skill (apps/web/agent/skills/onboarding/SKILL.md)
  owns sitting-one judgment for chat; the eval fixture family and
  eval:sandbox harness exist for behavioral tests.
- Bootstrap events (features/bootstrap/) give us the funnel-event
  pattern to extend.

## The one architectural decision

The v1 flow is deterministic native UI wherever the answer set is
closed (door, intent, kid fields, next-step doors), and the model
speaks only in the give-backs (Homa's react lines and hello line).
Models judge, code verifies: react lines are generated against the
actual answer with a schema-checked response and a deterministic
fallback line on timeout or refusal, never free-running chat in the
middle of a stepper. The chat-first brain takes over only after
onboarding lands the parent in the app (and later owns the plan lane).

This diverges from web sitting-one (which aims at the progress report
by minute twelve, chat-driven). Mobile v1 aims at the worksheet by
minute five with native screens. That divergence is deliberate,
founder-directed (2026-08-18), and should be recorded in the web
skill's header when mobile ships so the two arcs do not silently
contradict each other.

## Waves

### Wave 0: rails (no visible product change)

1. Onboarding state: a durable per-family `mobile_onboarding_state`
   (step, answers, per-child draft cards), written on every answer,
   readable for resume. Additive migration; run `pnpm check:isolation`
   and `pnpm check:migration-versions`.
2. Family bootstrap for mobile-born accounts: first sign-in with no
   family creates one server-side (reuse the web signup path;
   `familyId` never from the client).
3. Funnel events: `onboarding.step_reached`, `.answer_saved`,
   `.making_started`, `.reveal_shown`, `.print_completed`,
   `.resumed`, `.abandoned`, following the bootstrap-events pattern.
   These are the score for the whole project.

### Wave 1: the door and the beats (steps 1 to 3)

4. Rebuild `(auth)/signin.tsx` as the door: promise headline, brand
   moment, Apple / Google / email-code, quiet existing-account link.
   Kill the web-onboarding eject for new users (keep a legacy link
   only for families mid-web-onboarding; decide copy at build time).
5. Email-code path: `signInWithOtp` + 6-digit verify screen. No
   password on the happy path; password sign-in stays for existing
   accounts only.
6. Hello beat (auto-advance, reduced-motion aware) and intent screen.
7. React+frame beat: server endpoint returning Homa's react line for
   the intent pick (model + schema + fallback). Voice laws apply;
   gate copy through homa-copy-reviewer before ship.

### Wave 2: meet the kids (step 4)

8. Kid intro stepper: name, age, loves (chips + free text), working-on
   plus level, sibling loop. Why-lines under every ask. One question
   per screen, progress visible, back always, everything durable via
   wave 0 state.
9. The assembling child card component (the possession): builds field
   by field, lands in the family record as real children
   (`add_child`-equivalent server write, tenant-scoped).
10. Per-love react line (same endpoint as 7, per-child; never repeats
    across siblings: pass prior lines and let the server enforce
    novelty).

### Wave 3: the making (step 5, the aha)

11. First-making job for mobile: reuse the web single-stage
    materials-studio job; trigger from native, subscribe to stage
    events for the honest building steps. No new tool unless a gap
    proves exact-effect-missing (AGENTS.md decision sequence).
12. Building screen: named true steps from job progress, 20 to 40s,
    reduced-motion fallback, failure state in Homa's voice with retry
    (jobs pipeline already has retry primitives).
13. Reveal + print: full-bleed preview, AirPrint via the existing
    material-print contract, save/email fallback, one warm success
    beat. IP posture: interest powers the theme, no franchise promised
    in copy; fallback image model already wired (PR #450/#452).

### Wave 4: what's next + resume (steps 6 and 8-lite)

14. What's next doors: another worksheet (stub: "worksheets live in
    the studio" until paywall ruling), plan our week (points at
    existing planner surface for v1), just look around (tabs).
15. Resume chip on home reading `mobile_onboarding_state`, reopening
    the exact screen. Returning users with completed onboarding never
    see any of it.
16. Second-create behavior WITHOUT a paywall in v1: allowed and
    measured. The wall ships only after the D4 ruling; the trigger
    point is instrumented from day one so flipping it on is a flag,
    not a rebuild.

### Testing per layer

- Unit: state machine transitions, resume, OTP flow, card assembly.
- Behavioral: react-line endpoint evals (specificity: the Paw Patrol
  line must differ from the dinosaurs line; sibling novelty), using
  eval:sandbox and the Walker fixture family.
- E2E: simulator run of door → kids → making → reveal with the mobile
  simulator skill; screenshot evidence per screen.
- Guards before schema changes: check:isolation,
  check:migration-versions. CI list in .github/workflows/ci.yml.

## Sequencing and estimates

Wave 0 and 1 land together (the door is useless without durable state).
Wave 2 next, Wave 3 is the long pole (job wiring + reveal polish),
Wave 4 is small. Each wave is one PR-sized unit, roughly 3 to 5
sessions of work total. OTA-updatable except any native module changes
(AirPrint and OTP need none; expo-print/AirPrint path already exists).

## Founder decisions (ruled 2026-08-18, in-session)

- D4 RULED: paywall triggers at the second create, and v1 ships with
  NO paywall at all; the trigger is instrumented from day one so the
  wall is a flag flip later. The Apple IAP versus web Stripe pricing
  question is deliberately deferred until funnel data exists. Wave 4's
  wall stays dark; nothing else is blocked.
- D6 RULED: a family with an existing web onboarding session skips
  the native flow entirely; Homa's chat picks up where their web
  sitting left off. No duplicate questions, no native gap-filling in
  v1.
- D7 RULED: react lines are generated live by the model from the
  actual answer, schema-checked, with a pre-written warm fallback on
  timeout or refusal. No curated line bank.

## v1.1, from the first live walk (founder, 2026-08-18)

Shipped same-session: beats arrive whole (no placeholder-then-swap),
"Deal" retired, meta-commentary captions cut, the making screen polls
immediately and always shows a true state, the keep-exploring path is
a visible button, and the working-on step reveals its level question
only after a subject is picked. A dev-only restart lever exists for
iteration.

Next structural item, founder-directed: the making wait should not
park the parent at all. Run the deepen capture (homeschool style,
curriculum, rhythm) DURING the build, Cleo-style, so the wait
disappears into conversation and the reveal interrupts it as a gift.
This replaces the current making screen as the primary path; the
alive progress screen remains for parents who have nothing left to
answer.

## Score

Primary: signed-in → reveal_shown rate, and median minutes to
reveal_shown (target: under 6). Secondary: print_completed rate,
resume rate after abandon, kids-per-family captured. The §4 metric
view pattern from materials-first-delivery applies.
