# Current state audit: native onboarding + paywall

Verified against code on `main` (`fc9801a1`), 2026-08-30. This is the raw
research doc; `delta.md` in this folder compares it to the reference
article, and `../../docs/homa-planning/plans/2026-08-30-mobile-onboarding-paywall-v2/spec.md`
is where conclusions get turned into a plan.

## 0. Order of operations, top to bottom

1. **App opens** → `_layout.tsx` waits on fonts + session, no ATT prompt,
   no analytics-variant assignment.
2. **Auth** ([`apps/mobile/src/app/(auth)/`](../../apps/mobile/src/app/(auth)/)):
   `email.tsx` / `signin.tsx`: three doors (Apple / Google / email code),
   no password. **The account already exists by the time onboarding
   starts**: `hello.tsx` reads `family.parent_display_name` on its first
   render.
3. **Onboarding walk** (if native world, see below): the 7 screens
   detailed in section 1.
4. **`(tabs)` shell** wrapped in `BillingGate`: the paywall, gated by
   entitlement, see section 2.

Point 2 is the single biggest structural difference from the reference
article's recommended order (its rule 11: "account last, only after
purchase"). Homa creates the account, and lets the parent name her own
kids and get a first worksheet made, entirely before any purchase
decision.

## 1. Onboarding walk screens, in exact order

Source: [`apps/mobile/src/app/(onboarding)/`](../../apps/mobile/src/app/(onboarding)/),
state machine in
[`onboarding-state.ts`](../../apps/mobile/src/features/onboarding/onboarding-state.ts).

| # | Screen | What it asks | Type |
| - | ------ | ------------- | ---- |
| 1 | `hello` | Nothing: greets by name (from account), explains the product in one paragraph, "Let's go" | Statement, one CTA |
| 2 | `intent` | "What should we do first?": worksheets / plan / hours / all | Single-select |
| 3 | `you` | Parent's preferred name + homeschool state (skippable) | Two free-text/select fields |
| 4 | `kids` | Per kid, in sub-steps: name → age (chip grid) → "what do they love" (multi-select + free text) → "what are they working on" (multi-select + free text), repeatable for siblings | Multi-step form, repeats per kid |
| 5 | `making` | **Not passive.** Live progress screen while the first worksheet builds (kicked off as soon as the kid card completed, back on `kids`), AND, layered on top, a real per-child progress questionnaire (`ChecklistTakeover`, 4-point scale: Easily / Getting there / Not yet / Not sure), asking real map-skill questions about that same kid, shown only if the child has unanswered checklist items | Live build + real questionnaire, concurrent |
| 6 | `reveal` | Shows the finished worksheet for that kid, offers print | Result screen |
| 7 | `next` | Three doors: another worksheet / plan the week / just look around | Single-select, ends the walk |

Total: **7 screens, all functional data-collection or product moments**,
with `making` doing double duty as both the build-wait and a real
questionnaire, not just a passive wait. Zero screens are pure marketing,
pure trust-building, or pure permission requests.

## 2. What does NOT exist in the native app today

Confirmed absent by dependency and code search, not "unused," genuinely
not installed/built:

- **No App Tracking Transparency (ATT) prompt.** No `expo-tracking-transparency`
  dependency.
- **No push notification permission ask anywhere in onboarding or after.**
  No `expo-notifications` dependency.
- **No native App Store rating prompt.** No `expo-store-review` dependency.
- **No gender question.**
- **No usage-frequency calibration question.**
- **No referral-source / attribution question** ("how did you hear about
  us"). Attribution presently relies on whatever the App Store / ad
  network reports at install, not a self-reported answer.
- **No standalone social-proof / reviews screen.**
- **No "personalizing…" fake-progress moment.** The one progress screen
  that exists (`making`) is real, not simulated: it is polling an actual
  worksheet-generation job (see `first-making-latency` memory: floor
  ~85s).
- **No pain-point / problem-amplification screens** (statement + frequency
  scale, repeated across several angles).
- **No stats/social-proof screens tied to pain points, immediately before
  the paywall.**
- **No Mixpanel or comparable event-analytics SDK.** All funnel events go
  through Homa's own `emitFamilyEvent()` into Postgres
  ([`lib/events.ts`](../../apps/mobile/src/lib/events.ts)), which the team
  already queries for funnel numbers (see the `onboarding-funnel-audit`
  and `morning-brief-conversion` memories elsewhere in the codebase's
  history); the capability to measure a redesigned funnel exists, the
  events an article-style flow would need mostly do not.

## 3. The paywall itself

Source: [`apps/mobile/src/components/billing-gate.tsx`](../../apps/mobile/src/components/billing-gate.tsx),
[`apps/web/app/api/billing/gate/route.ts`](../../apps/web/app/api/billing/gate/route.ts).

- Not a dedicated onboarding screen. It is a **global gate component**
  wrapping the entire post-onboarding app shell (`(tabs)/_layout.tsx`).
  Any signed-in, onboarded, non-entitled family sees it the instant they
  try to use a tab; there is no "paywall step" in the walk's own screen
  list above.
- It arms based on `familyOnboardingActive()`
  ([`apps/web/lib/onboarding/state.ts`](../../apps/web/lib/onboarding/state.ts)),
  which is gated by a durable **record** on `families.context.onboarding`,
  not directly by `profile_completed_at`. **Correction from an earlier
  draft of this audit:** the record, while it says `state: "active"`,
  overrides `profile_completed_at` entirely, so the `you` screen stamping
  `profile_completed_at` early (screen 3) does NOT by itself end the free
  window. The mobile bootstrap route
  ([`/api/mobile/onboarding`](../../apps/web/app/api/mobile/onboarding/route.ts#L84))
  explicitly re-writes an active record on every app open for exactly this
  reason (comment: "without this record that stamp would flip the family
  to onboarding-done mid-walk").
  The record only flips to `state: "done"` at one single, deliberate choke
  point, shared by every channel (chat, web, SMS, mobile): inside
  `createReport()`
  ([`apps/web/lib/map/store.ts:1407`](../../apps/web/lib/map/store.ts#L1407)),
  which calls `resolveOnboardingCompletion()` →
  `onboardingCompletionReached()`
  ([`apps/web/lib/onboarding/state.ts:239`](../../apps/web/lib/onboarding/state.ts#L239)),
  a founder-ruled predicate (`onboarding-completion-milestones`,
  2026-07-31) requiring all three: `profile_completed_at` set, at least
  one child, and at least one **scored report**.
  For the native walk specifically, the chain is:
  `ChecklistTakeover` inside `making.tsx` → she answers ≥1 question
  (`exit.answered > 0`) → `finalizeReport(childId)`
  ([`onboarding-card-api.ts:107`](../../apps/mobile/src/features/chat/onboarding-card-api.ts#L107))
  → `POST /api/map/score` → `createReport()` → all three completion facts
  are now true (state was set on `you`, a child exists from `kids`, a
  report is now scored) → `completeOnboarding()` writes `state: "done"` →
  `familyOnboardingActive()` flips false → the next time she opens any
  `(tabs)` route, `BillingGate` walls her.
  This means the free window can end **mid-`making`**, the instant she
  answers her first questionnaire question, visibly before `reveal` and
  `next` render, matching the comment at
  [`next.tsx:34`](../../apps/mobile/src/app/(onboarding)/next.tsx#L34).
  It is a deliberate design (a real founder ruling), not an accidental
  race, but the walk's later screens (`reveal`, `next`) still don't know
  it happened, which is the actual gap.
- **The trigger is also conditional, not fixed-position.** If she skips
  the checklist during `making`, or the child has nothing left to ask
  (`checklistAvailable === "no"`), no report gets scored during
  onboarding at all, and the free window survives past `next` into the
  tabs, until whenever a report first gets scored some other way. So two
  families can experience the wall at genuinely different points in the
  product: one mid-`making`, another days later. This is the opposite of
  the article's model, where the paywall is always screen 16, always in
  the same state.
- Content on the paywall itself: headline ("Start with Homa" / "Continue
  with Homa" if lapsed), one line of value copy (references the child's
  actual first worksheet if one exists, `firstPageLine()`), a plan picker
  (currently one plan, so hidden), price, a subscribe button, restore
  purchases, and a way to sign out / delete account. No stats, no social
  proof, no pain-point recap, no urgency framing.
- StoreKit 2 purchase flow (fetch products, purchase, confirm receipt
  server-side, recover interrupted purchases on foreground, restore) is
  fully built and working. Only a monthly plan is currently merchandised
  on iOS.
- `second_create_tapped` is recorded on the `mobile_onboarding.completed`
  event but is not read by any gate logic anywhere in the repo (verified
  by grep across `apps/web` and `apps/mobile`); a "wall arms at second
  create" design exists only as an unbuilt idea in an old plan doc, not in
  code.

## 4. Known, already-documented friction

- The walk's copy (through `next.tsx` and `reveal.tsx`) still occasionally
  talks like the family is "free" for longer than the actual entitlement
  window (section 3), a mismatch two recent commits patched around with
  wording rather than fixing at the root
  ([`9871be4b`](https://github.com/sidneyswift/homa/commit/9871be4b),
  [`41464b46`](https://github.com/sidneyswift/homa/commit/41464b46)).
- The founder has separately directed (2026-08-18 plan, "v1.1" section,
  now superseded as a source of truth but the direction itself may still
  be live) that the `making` wait screen should eventually carry a live
  capture conversation instead of a passive progress bar. Whether that
  survives into this spec is an open question, not a given.
