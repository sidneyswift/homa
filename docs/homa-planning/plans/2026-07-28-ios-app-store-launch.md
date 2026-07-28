# iOS: from companion skeleton to the best education app on the market (PROPOSAL, 2026-07-28)

Status: proposed, awaiting founder review. Founder decisions are marked FD-1 to
FD-8; founder-only actions live in their own checklist (§10). Everything else is
agent-executable and filed as GitHub issues (the epic links them; issues are the
tracking layer, this doc is the spec layer).

Evidence: every claim below traces to the 2026-07-28 evidence pack in
`plans/2026-07-28-ios-launch-evidence/` (six codebase readers, six market and
platform researchers, an on-device walkthrough, and a four-seat expert council
plus an ICP session). Screenshots referenced live with the walkthrough notes.

## 1. Ground truth (verified 2026-07-28)

1. **The app today is three screens** (Today, Chat, Family) plus sign-in.
   Chat is genuinely good: streaming works against prod, the agent knows the
   family, and the incident-hardened never-stuck/never-forked stack is ported
   from web. Everything else is skeletal (evidence 00, 01).
2. **Verified on device**: asked to plan the week, Homa tells the parent to
   "open Maya's progress report page", a surface that does not exist in the
   app and is not deep-linked. The planning loop hard dead-ends on the phone
   (walkthrough screens 04, 05). The renderer draws 10 of ~62 tool outputs;
   the rest are silence (evidence 01 §4).
3. **The binary in App Store Connect is a dead end.** Build 5 (1.0.0) was
   built 2026-07-21 from branch `claude/mobile-parity`, whose PR #76 was
   closed unmerged; main cannot reproduce it. It never matched any OTA
   update fingerprint, so it can never be patched. It was delivered to ASC
   but there is no public listing; whether it was ever submitted for review
   is visible only in ASC (evidence 05).
4. **The OTA pipeline publishes into a void.** Since 2026-07-27 updates
   target fingerprint `9c5e8a85...`, for which no binary exists; the only
   fleet that ever received OTA (build 2, TestFlight) stopped matching at
   PR #234. Green workflow runs prove nothing reached a phone (evidence 05 §4).
5. **Review would reject the app today** on at least: 5.1.1(v) account
   deletion absent while in-app sign-in creates accounts; 3.1.1 steering
   (four "Open onboarding" buttons plus the agent's own prose route users to
   a web flow that takes payment); 5.1.2(i) missing third-party-AI consent
   moment (council app-review).
6. **Monetization posture is unowned.** Every pricing doc and ticket
   (#235, #293, #295, #297) assumes Stripe web checkout; nothing addresses
   Apple rules (evidence 04 §5, 06 §6).
7. **Assets in hand**: EAS pipeline works end to end, SIWA + Google + email
   sign-in shipped, demo family for review exists and is sandboxed
   ("App Review Family"), privacy and terms URLs are live, design tokens are
   brand-true, and the closed PR #76 branch holds a five-tab parity
   implementation worth mining (evidence 05, 01).

## 2. Strategy: two releases, one storefront

The founder goal is an app a stranger can find, install, sign up in, pay in,
and live in. Apple's July 2026 rules make one release doing all of that the
slowest possible path (evidence 10). So: two releases, each independently
valuable, the second one the marketing launch.

- **R1 "Companion" (v1.0)**: zero commerce in the binary. Rebuilt from main,
  compliance pack, never-silent chat, a Today screen that shows today,
  settings with account deletion. Tier-identical for all signed-in users,
  neutral "your plan is managed on the web" state for lapsed accounts. This
  is the documented 3.1.3(b) safe harbor and the fastest route to a live
  listing, a review track record, and TestFlight reality for everything that
  follows.
- **R2 "Storefront" (v1.1)**: native signup + native chat-first onboarding
  reaching the first-printable artifact moment in minutes, then a StoreKit 2
  subscription with the 7-day intro trial at the gate point. This release
  turns marketing on. External purchase links (US, currently 0% commission)
  are deliberately NOT the v1 selling path: link-selling is the documented
  rejection magnet; revisit once the app has organic install volume
  (council growth: trigger at roughly 500 organic installs/mo).
- **After R2**: retention loops (push, camera), the native planner board
  (#263), chat history, and the ASO flywheel.

**Stack ruling (council engineering, firm): keep Expo SDK 56 + RN 0.85 +
eve/react.** A Swift rewrite would re-implement the eve streaming client and
the incident-hardened chat stack in a language eve does not support, and would
forfeit OTA updates, the decisive advantage for an AI product whose brain
changes daily and whose builders are TypeScript-fluent agents. Liquid Glass
chrome, push, camera, and StoreKit are all reachable from Expo. The eve/react
dependency is the one genuine coupling risk; the eve-version-bump runbook
already governs it.

Why this can be the best education app on the market: every incumbent
(evidence 11) is either content-first (Khan Kids, Duolingo ABC), logistics
(Homeschool Planet), or chat-plus-dashboards (Homeschool Fox). None has a
one-brain agent that knows the family across phone, web, SMS, and voice, and
none can make a personalized printable from one sentence. The phone's job is
to make that brain feel present in the kitchen: in the moment, never silent,
never guilt-driven (the anti-guilt laws are a moat competitors gamified
themselves out of).

## 3. The arcs

Each arc is a GitHub issue owning its task list and acceptance criteria; the
epic issue links them in dependency order. Sizes: S/M/L. "OTA" means ships
over the air once a matching binary exists; "build" means store build.

### ARC A: Release truth (S, blocks everything)
The pipeline must stop lying before anything ships through it.
- OTA fingerprint-drift guard: compare `npx expo fingerprint` against the
  latest FINISHED production build via EAS API; fail the workflow loudly on
  mismatch. Pin eas-cli.
- Mobile tests (`check:mobile-chat`) into `ci.yml` AND the OTA workflow
  (today a red mobile suite ships to phones on typecheck alone).
- Crash reporting (sentry-expo) and a root ErrorBoundary: we cannot run a
  storefront blind.
- Build 6 from main HEAD with the R1+R2 native module set compiled in but
  dark (sentry, notifications, camera, StoreKit), so later arcs ship OTA
  instead of costing new binaries. TestFlight it; verify one OTA lands on it.
- Founder reads ASC state of build 5 and abandons it (FD-8, §10).

### ARC B: Compliance pack (M, R1 gate)
Everything App Review will mechanically reject, plus the honesty work that
makes the agent reviewable.
- Settings screen: account (email, sign out), legal links (privacy, terms),
  support contact, version; the neutral "Your Homa plan" info state.
- In-app account deletion: full deletion incl. SIWA token revocation via the
  Sign in with Apple REST API, honest consequence copy, confirmation.
- First-run consent moment for third-party AI processing (5.1.2(i)), with
  matching privacy nutrition labels and an Expo pod privacy-manifest audit.
- De-steer the binary: the four "Open onboarding" web punts become neutral
  account-info states; no pricing, no subscribe language anywhere in R1.
- Give mobile its own channel identity (successor to the #256 interim fix,
  with #258's capability signal): an iOS channel instructions module that
  forbids naming prices, forbids claiming panels opened, and teaches Homa
  what the phone can and cannot show, so chat prose stops being a rejection
  and dead-end surface. This also fixes the device-verified dead end in §1.2.
- Report/block affordance on chat content (4.7.1 triad) documented for review.
- Email sign-UP and password reset (sign-in exists; a reviewer creating a
  fresh account must not dead-end).

### ARC C: Chat that never goes silent (L, the structural fix)
- Extract `packages/chat-core` from the duplicated web/mobile stacks
  (absorbs #211): transport, recovery, send policy, message-part parsing in
  one tested package; web and mobile become thin renderers over it.
- Rule and implement the render-by-kind contract (rules #196 D1): tools with
  parent-visible output return a server-owned `renderable {kind, version,
  props}`; clients dispatch on kind; unknown kinds MUST render a generic
  receipt card (title, one line, optional open-on-web); silence becomes
  structurally impossible. Home: `packages/core` (FD-3).
- Port the web receipt chips (edit_plan, log_hours, schedule_plan_activity,
  family events, generate_image and friends) and the six rich cards that
  matter on phone: material, planner week strip, progress, report reveal,
  first-making, question cards. Honor ENDS_THE_TURN semantics.
- Markdown parity floor: links must be tappable (they are inert text today).

### ARC D: A Today that shows today (L, the retention surface)
- Today v2: date + greeting, "a note from Homa", today's plan rows with
  check-off (writes only through the per-toggle op, #259 precondition),
  latest making with print/share, one offer slot. All reads existing RLS
  data; ships OTA.
- Native planner board: absorb #263 as this arc's second phase (its own
  acceptance criteria stand: versioned board JSON route, generic-card
  degradation, refresh contract, associated-domains stays route-by-route).
- Chat history v1 posture: R1 ships day-separated scrollback (exists); the
  list-reopen-continue experience follows #179's design rather than forking it.
- Deep links: `homa://` route handling + universal links for exactly the
  routes the app can render natively (report links keep opening web until a
  native report exists).

### ARC E: Native onboarding and the first wow (L, R2 gate)
- Native account creation (Apple, Google, email) into native chat-first
  onboarding: same eve onboarding channel as web, chips-then-chat intake,
  the artifact moment (first personalized printable) on device in minutes.
- Blockers honored: #238's onboarding completion clause must be ruled or the
  backstop accepted before mobile pushes new users through it; #202's photo
  upload fix lands before any capture affordance.
- Permission priming: notifications asked AFTER the first artifact, framed
  as delivery receipts ("Homa will tell you when it's ready"), never before
  value exists.
- Entitlement visibility: `GET /api/billing/gate` returning
  `{open, lapsed, planTier}` so the client knows which state to draw without
  scraping redirects.

### ARC F: Paying in the app (L, R2 gate, FD-1/FD-2 first)
- StoreKit 2 subscription, regular tier only ($19 lane; exact IAP sticker is
  FD-2). 7-day intro trial so the "your 7 free days" vocabulary stays true.
  No Plus/Max in the binary while they are sell-then-build (#297): an iOS
  paywall may only surface tiers whose delivery exists (carve-out, FD-5).
- Server pieces (evidence 03 §7 is the spec): additive `apple_*` columns on
  families; `POST /api/billing/apple/confirm` verifying the signed
  transaction server-side and reusing `startFamilyTrial`; App Store Server
  Notifications webhook mirroring status; `accountAccessDecision` goes
  two-provider (walled only when every provider that ever recorded a
  subscription reads lapsed); portal split ("Manage in the App Store" vs
  Stripe portal); admin freshness panel gets an Apple leg and a
  both-providers-active anomaly count.
- Reconciliation cron designed provider-generic with #274, never a clock.
- Paywall screen obeys the claims laws: no social proof, charge terms in
  visual proximity to the button, Apple's sheet carries part of the
  disclosure. Restore purchases. appAccountToken = Supabase user id,
  verified server-side; `familyId` never from the client.

### ARC G: Retention loops, phone-native (M, post-R2)
- Push as a channel under the channel doctrine: expo-notifications, APNs
  config, token table keyed to the authenticated family mapping, consent UX.
  Policy within the anti-guilt bans (no streaks, no inactivity nudges): v1
  pushes are delivery receipts (material finished), the morning brief for
  warm families, and the Friday letter, all instrumented against the ratio
  law (response ≥20%, unsubs <1%/mo or sends stop).
- Camera capture of finished work wired to the existing photo tools
  (capture-to-chat first), strictly after #202. Share-sheet ingest later.
- Native share/print polish for printables (the README-named gap).

### ARC H: Store presence and the marketing handoff (M, parallel to B+)
- Listing package (draft in evidence 12 §9, refined by growth council):
  title "Homa: AI homeschool planner", subtitle "Weekly plans and
  printables", keyword field as drafted, Education primary / Productivity
  secondary. Two description variants: R1 (no price copy) and R2 (IAP price
  + trial disclosure).
- Screenshot narrative (6.9" and 6.5" sets): 1) sentence-to-printable, 2) a
  Today that shows a real week, 3) the report/progress reveal; captions in
  Homa voice; no preview video for v1 (motion budget goes into the app).
- Review notes verbatim (council app-review §3), demo account seeded and
  `billing_exempt`, age rating answered honestly (expect 13+, never chase
  4+, no Kids Category).
- Launch kit: App Store badge on thankshoma.com, QR on the /world page,
  email to the waitlist, and the install link in the post-trial email flow.
  Score the channel on visitors-to-paid, same as web.

## 4. Dependency spine

```
ARC A (release truth)
  └─ ARC B (compliance) ──────────────┐
       └─ R1 SUBMIT ◄─ ARC H (listing R1 variant)
  └─ ARC C (chat-core + render-kind) ─┤
       └─ ARC D (Today, planner #263) ┤
  FD-1/FD-2 ─ ARC F (server billing) ─┤
  #238/#202 ─ ARC E (onboarding) ─────┤
       └─ R2 SUBMIT ◄─ ARC F (client IAP) + ARC H (R2 variant)
            └─ ARC G (push, camera) and marketing ON
```

R1 needs A+B plus the C fallback card (never-silent floor) and the Today v1
row list from D; the rest of C and D ship OTA behind the listing. R2 needs
E+F complete.

## 5. Mobile user journeys

- **J-M1 The stranger (R2)**: App Store search "homeschool planner" → listing
  → install → Apple sign-in → AI consent → chips intake (kids, state, vibe) →
  chat interview → first printable rendered as a card in under 5 minutes →
  notification prime on the receipt → paywall at the gate point with 7-day
  trial → day 1-7 lived in Today/Chat → trial converts (Apple sheet).
- **J-M2 The web subscriber (R1)**: installs from the email/QR → signs in →
  everything already knows her family (the five-second wow is recognition,
  not setup) → Today becomes her morning glance; chat her pocket Homa.
- **J-M3 The daily five minutes**: open → Today shows the day's three things
  → check one off (sage tick, haptic) → "make tomorrow lighter" in chat →
  reshuffle receipt card → done before the kettle boils.
- **J-M4 The rough Tuesday**: "we had a rough morning, help me reset" chip →
  reassure-first reply → one-tap lighter plan → no guilt mechanics anywhere.
- **J-M5 The co-op printer**: yesterday's worksheet → material card → system
  share sheet → AirPrint at co-op; later, camera captures the finished page
  and progress quietly accrues.
- **J-M6 Lapse and return (R2)**: subscription lapses → app stays calm and
  informational, never locks her records (record-export law), win-back is
  Apple's sheet or the web, whichever she owns.

User stories per arc live in the arc issues; each is written as
"[parent] can ..." with the journey it serves.

## 6. Measurement

Mobile emits one event today (`chat.turn_completed`). Before R1 ships, add
(typed registry, MJ-08 law): `app.installed_first_open`, `app.signed_in`,
`app.consent_ai`, `onboarding.native_started/completed`,
`chat.tool_render_fallback` (counts silence structurally),
`today.checkoff`, `material.opened/shared`, `push.registered/opened`,
`billing.gate_viewed`, `iap.trial_started/converted/lapsed` (R2), each with
channel=ios. Funnel: installs (ASC) → first_open → signed_in → onboarded →
first artifact → trial → paid, scored visitors-to-paid like web. ASC
attribution is coarse; treat App Store as one channel line.

## 7. Risks and roadblocks (named)

1. **ASC state is invisible to agents** until an ASC API key is provisioned
   (or the founder relays it). Mitigation: FD-8 + founder checklist; key
   provisioning unlocks agent-driven submission end to end.
2. **App Review human loop**: each submission is days, rejections cost a
   cycle. Mitigation: R1 posture is the safe harbor; review notes verbatim;
   compliance pack first; expect and budget one rejection round anyway.
3. **eve/react on Hermes** is the deepest coupling (streaming fetch shim,
   DOMException, channel labeling). Mitigation: chat-core extraction with
   contract tests; eve-upgrade-check remains law.
4. **Two-provider billing is the highest-blast-radius code** in the plan
   (double-subscribe, refund asymmetry, dark-webhook). Mitigation: evidence
   03 §7 design, pure-function access decision with table-driven tests,
   reconciliation cron, admin anomaly count, tenancy isolation guard.
5. **Sell-then-build tiers must never reach the binary** (#297): refund
   magnet + 2.1 risk. The FD-5 carve-out is load-bearing.
6. **Channel-honesty regressions**: every new tool can reintroduce silence.
   The generic-card floor plus a CI check that every renderable kind has a
   client mapping or falls back makes silence structural, not disciplinary.
7. **Apple platform drift** (Liquid Glass expectations, age-rating and AI
   rules moved twice in 12 months). Mitigation: ios-release skill records
   the posture; re-verify guidelines at each submit.

## 8. What exists to reuse (do not rebuild)

- PR #76's closed branch: five-tab shell, planner/progress/binder/lessons/
  settings screens; mine for components, rebuild on the render contract.
- Web message-parts renderers and their tests: the porting spec for ARC C.
- The chat resilience stack (already ported); the design tokens (in sync);
  the demo family; the OTA pipeline; privacy/terms pages; the paywall bench
  and copy-gate skills for ARC F/H copy.

## 9. Founder decisions (FD package, one issue)

- **FD-1 Monetization staging**: approve R1 companion (zero commerce) then
  R2 StoreKit IAP. Alternatives considered: IAP-first (slower to a live
  listing), external-link selling (rejection magnet at 2026 enforcement).
- **FD-2 IAP sticker and SKUs**: $19.99/mo IAP vs $19 web parity; whether an
  annual SKU exists on iOS given the `paywall-naming-and-price` ruling
  withheld annual pending the Homeschool Fox read; Apple's cut treated as
  channel CAC or passed through.
- **FD-3 Render contract (rules #196 D1)**: adopt renderable
  {kind, version, props} at the tool layer, home `packages/core`, generic
  receipt fallback mandatory. Closes #196 when ruled with FD-4.
- **FD-4 Parity plan D2-D6 (from #196)**: surfaces earning native screens in
  v1 (this plan says Today + planner board + settings; binder/lessons stay
  web); camera timing (post-#202, ARC G); push approved as a channel with
  the receipts-first policy; hand-copied tokens acceptable through R2
  (packages/design not a blocker); Android stays explicitly deferred.
- **FD-5 Tier carve-out**: the iOS binary surfaces only tiers whose delivery
  exists (regular today). Plus/Max join after #293/#297 resolve.
- **FD-6 PWA vs app**: O1 KR3 (add-to-home-screen ≥60%) predates the native
  app; rule how the app changes that KR and where each is offered.
- **FD-7 Age rating**: accept an honest 13+ rating for the AI chat surface;
  parent-facing positioning stays out of Kids Category.
- **FD-8 Build 5**: read its ASC state, abandon it, approve build 6 from
  main as the new release candidate.

## 10. Founder-action checklist (its own issue, blocks R1 submit)

1. App Store Connect: report build 5 state; attach/abandon accordingly.
2. Save `ascAppId` into `eas.json` submit profile (one interactive submit or
   read it off ASC App Information), or provision an ASC API key as an EAS
   secret so agents can run metadata + submission end to end.
3. Verify Supabase Apple provider Client IDs contains `com.thankshoma.homa`
   (SIWA fails in the store binary otherwise: certain rejection).
4. App Privacy questionnaire + age rating questionnaire in ASC (answers
   drafted in council app-review; enter and confirm).
5. Screenshots + listing copy upload (assets produced by ARC H).
6. Demo account: set `billing_exempt` on App Review Family and keep it.
7. R2 gate: create the IAP product(s) in ASC per FD-2 and accept the Paid
   Apps agreement if not already.

## 11. What this plan does not claim

No effort estimates are commitments; sizes are relative. The competitive
"leapfrog" claims are positioning judgments, not measured facts. Nothing here
supersedes the planner-arc rulings (#265) or the anti-guilt laws; where this
plan and the one-planner arc touch (#263, #259), the planner arc's acceptance
criteria stand. The ICP session and council reviews are advisory evidence,
not user research with real families; the first hundred real installs will
outrank all of it.
