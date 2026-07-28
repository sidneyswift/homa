# Issue and PR overlap map for the iOS launch epic

Read date: 2026-07-28. Source: `gh` against sidneyswift/homa (full `gh issue view` bodies plus comments), open PR list with changed files, and spot checks of the mobile source in this worktree. Relation vocabulary: **absorb** (the epic owns the work), **depend** (the epic is blocked by or builds on it, work stays where it is), **supersede** (the epic replaces the ticket's framing), **reference** (link it, do not own it), **ignore** (closed or irrelevant).

## 1. The mobile core: issues the epic must absorb or depend on

### #263 One planner arc G: mobile native board. OPEN, feature, P1
The unified planner board comes to mobile as a versioned JSON route (caller JWT with RLS, unknown kinds degrade to a generic card) plus a native Today/board screen with native check-off writes. Two founder rulings landed in the comments on 2026-07-27 (#265 Q-B and Q-F): the arc is no longer gated on a post-flip adoption read, full native parity is pulled into the funded arc, and the issue was raised to P1. Hard preconditions stated in the issue: #259's per-toggle check-off write op must land first (today's whole-map POST plus local-over-server merge means a second writing client silently erases check-offs, and check state feeds the scored report), the #196 D1 render-kind contract is ruled at arc B time, and the stable-ID trigger review happens before native writes ship. Also: /app/planner stays out of associated-domains claims until the native screen routes it, and the mobile board needs a stated refresh contract.
**Relation: absorb.** This is the single largest already-specced piece of native work and it is already funded and P1. The iOS epic should either adopt #263 as a child or make #263 the planner workstream inside the epic. Do not write a second native-Today-screen spec.

### #196 Mobile parity plan: rule D1-D6, verify planner-tool silence on device. OPEN, founder-decision, P2
The 2026-07-20 parity proposal (render-by-kind contract, camera, push) sits on branch `claude/reverent-colden-e7b904` with D1-D6 open. The suspected planner-tool silence on device was never device-verified, but the mechanism is now confirmed in code and in #256: mobile renders only 3 tool names (`apps/mobile/src/features/chat/message-view.tsx:120-123`: create_printable, show_material, create_worksheet, plus question cards and memory chips) while authenticating as channel "web" (`apps/mobile/src/lib/turn-recovery.ts:74,86`), so every other tool part renders as silence. #265 Q-F already ruled the sequencing the council recommended (descriptor in B1, generic receipt card with arc C, mobile-web Today view before arc F links, native screen arc G), which answers part of what #196 was waiting on; D1 (the render-kind contract itself) is explicitly deferred to "arc B time" and the rest of D1-D6 (camera, push among them) are still unruled.
**Relation: absorb and largely supersede.** The iOS epic is the natural place to finally rule D1-D6. Fold the still-open decisions into the epic's founder package, then close #196 pointing at the ruling. This is the only issue in the tracker that mentions push notifications or camera at all; if the epic wants either, this is the thread to pull.

### #211 CR-70: web and mobile chat stacks duplicated and drifting. OPEN, chore, P2
The chat stack is copy-pasted between web and mobile and already diverging; the ticket says to extract a shared package and to scope it together with #196 since the render-by-kind contract reshapes the same code. The #284 close comment makes the stakes explicit: adding another surface to two already-drifting ones without settling #211 first is how the drift becomes permanent. The drift is not theoretical: the web session-fork fix (PR #227) had to be hand-ported to mobile (#229 / PR #230), and PR #254 (open) is touching web `chat-send-policy.ts` while mobile has its own `apps/mobile/src/features/chat/chat-send-policy.ts`.
**Relation: absorb, and schedule early.** A world-class launch means the mobile chat surface stops being a lagging fork. The epic should own the shared-package extraction (or explicitly decide to keep porting by hand and say so), sequenced with the D1 render-contract ruling so the contract lands once.

### #256 Planner/calendar defect repair, including the mobile fabricated-panel bug. CLOSED 2026-07-27
Item 4 of this ticket was the live mobile bug: mobile chat authenticates as channel "web", which is not in open_planner's NO_PANEL_CHANNELS (`apps/web/agent/tools/open_planner.ts:53`), so on every mobile turn the model was told the planner is open beside the chat while the mobile renderer dropped planner parts entirely, the same fabricated-UI class as the voice binder incident. Shipped and verified live as PR #269 (78f2499e), but the close comment is explicit that the open_planner wording is the interim honesty fix only; the real per-client capability signal is #258.
**Relation: ignore as a ticket, depend on its successor.** The epic depends on #258's default-closed channel capability signal so the model knows truthfully what the mobile client can render; until then any new mobile surface must be added to the honesty story by hand.

### #229 Mobile chat: port the web session-fork fix. CLOSED
The session-fork bug (stream dies mid-turn, manual send during the recovery window forks the conversation into two live eve sessions) was fixed on web in PR #227 and ported to mobile in PR #230, merged 2026-07-26, including the per-message pending/failed retry affordance mobile was missing.
**Relation: ignore (done).** Worth citing in the epic as evidence for #211: every web chat fix currently costs a second mobile PR.

## 2. Chat and content surfaces the mobile app will inherit

### #179 T7: Chat history: list, reopen, continue past chats. OPEN, feature, P1
Size L, from the 2026-07-07 tester memos, reinforced by Carolyng losing a working plan in scrollback (CG-04/#175). Daily session rotation is by design; T7 is the history-browsing half.
**Relation: depend.** An App Store quality bar app with no way to see yesterday's conversation will read as broken in reviews. The epic should not build history itself but must state whether mobile ships with or without it, and the shared-stack work in #211 decides whether history lands once or twice.

### #180 T8: Per-kid and per-subject chat entry points. OPEN, feature, P2
Size L, explicitly gated on T7 (#179). **Relation: reference.** Attractive as a native-app information architecture (a kid switcher is a very mobile pattern), but it is gated work; the epic should link it as a v-next candidate, not absorb it.

### #181 T9: Day log: calendar, photo capture, portfolio accretion. OPEN, feature, P2, founder-decision
Size XL, gated on a founder scoping session, and already ordered to be scoped together with CG-02 (#174 hours) and the CG-03 lab (#176, now shipped as the calendar) so two calendars never get built. Photo capture here overlaps the camera item in #196's D1-D6 and the magic-import phase (#266).
**Relation: reference.** The epic must not absorb T9 (it has its own gate), but the epic's camera decision (from #196) should be written so T9 and #266 can reuse the same capture path later.

### #175 CG-04: Binder in-progress area. OPEN, feature, P1
Drafts are invisible because the binder route hard-pins status:"final" (`apps/web/app/app/binder/page.tsx:45-48`), and chat-born working plans have no durable object across daily session rotation. Two halves specced; founder call open on placement.
**Relation: depend / reference.** Web-first work. The epic's concern is parity: if mobile ships a binder or materials surface, it must consume whatever in-progress model this ticket produces rather than re-pinning status:"final" a second time. Related open production bugs in the same family: #241 (draft-stranded materials invisible to find_materials) and #197 (finalize gap), which shape what a mobile materials list would show.

### #202 R4: Web photo upload broken. OPEN, bug, P1, production
BUG-P3-1 from the 2026-07-13 season study, listed P0 there and unshipped since; first step is re-verifying it still reproduces, then fixing in-session per the prod-bugs ruling. Photo capture feeds journaling and portfolio accretion, so it quietly starves both.
**Relation: depend, and a launch blocker for any camera story.** Mobile camera (the #196 D item) lands on top of the same upload path; shipping a native camera affordance into a broken upload pipe would be the worst version of this bug. The epic should sequence: fix #202, then camera.

### #203 R6: Streaming progress for long turns. OPEN, feature, P1
Long generation turns still look like silence. **Relation: reference.** Mobile chat inherits the silence and mobile users are less forgiving; the epic should verify whatever R6 ships renders on mobile (it will not, under today's 3-tool allowlist, unless the D1 contract covers progress parts).

## 3. Billing, paywall, onboarding: the App Store policy minefield

### #235 Signup paywall founder steps. OPEN, chore, P1, founder-action
The card-upfront 7-day trial gate: Stripe Payment Links redone for 7 days (done 2026-07-27), webhook secret, HOMA_SIGNUP_PAYWALL_SINCE, the flag flip with a real rebuild, and the Telnyx pitch re-provision still open on the founder. (Per session memory the flag flipped on 2026-07-28 with SINCE grandfathering; the issue checklist has not caught up, so treat the remaining boxes as partially stale and verify.)
**Relation: depend, with a conflict to surface loudly.** The entire monetization stack is Stripe Payment Links on the web. Inside an iOS binary, gating account creation or core features behind an external Stripe checkout is exactly what App Review guideline 3.1.1 rejects, and none of #235/#293-#297 mentions Apple at all. The epic must decide the iOS monetization posture (IAP with StoreKit, the US external-purchase-link entitlement, or a web-signup account-based model where the app never links out to purchase) before submission, and that decision constrains every paywall ticket below. This is the biggest unowned question in the tracker.

### #274 Trial entitlement has no expiry of its own. OPEN, bug, P2
Access is granted on `trial_started_at` plus a not-lapsed mirrored Stripe status (`apps/web/lib/billing/wall.ts`); if the webhook is ever dark, a lapsed family keeps access forever. The proposed fix is Stripe reconciliation on a cron, not a clock, because a missed trialing-to-active event would otherwise lock out a paying family.
**Relation: depend.** The mobile app reads the same entitlement; if the epic adds IAP, this reconciliation design is also where Apple receipt state would have to merge with the Stripe mirror, so the epic should reference #274 in its billing design rather than invent a second entitlement path.

### #238 Families latch onboarding-active forever. OPEN, bug, P1, founder-decision
`completeOnboarding()` shipped with zero callers; 30 live families latched; latched families structurally lose create_printable/generate_image every turn and bypass the $19 wall. Backstop and backfill shipped; the happy-path completion clause is a TODO(founder). Dormant only while HOMA_CHAT_ONBOARDING is off; re-arms the moment it flips.
**Relation: depend.** Mobile users flow through the same onboarding state machine, and the generation gate would silently strip tools from mobile chat too. The epic should require the founder clause ruled (or the backstop accepted as the rule) before mobile pushes new users into chat-first onboarding.

### #190 Credit-lockout ruling package. OPEN, P1, founder-decision
Four unresolved: whether a making limit exists at all, the unit noun and number, what the lockout supersedes, and the interim hole where a family that never reaches onboarding state "done" is un-walled indefinitely (the same latch class as #238).
**Relation: reference.** Whatever lockout ships becomes an in-app paywall moment on iOS, which again lands in IAP territory. The epic should list #190 in its monetization-posture decision inputs.

### #293 / #295 / #297 Paywall tier package. All OPEN
- **#293 (feature, P1, founder-decision):** Homa Max ($199) has no enforced differentiator; `plan_tier` is written at checkout and read by nothing that meters. Interim honest copy shipped plus a guard test in `wall-copy.test.ts`. Founder must pick: build the allowance, reword as forward-looking, or pull Max off the signup gate.
- **#295 (investigation, P2, founder-decision):** the three tiers are not alignable (planning vs state filing vs "the most"), which no copy edit fixes; depends on the #293 ruling.
- **#297 (chore, P1, production):** founder ruled sell-then-build; both paid tiers are live and purchasable now with nothing behind them; needs a named owner, a checkout alert, and a stated timing expectation.
**Relation: reference, with one hard flag.** Selling a $49/$199 tier with unbuilt delivery is survivable on the web; inside an iOS app it is an App Review rejection risk (2.1 performance/completeness, 3.1 payments) and a refund magnet. The epic should state that the iOS paywall (if any) shows only tiers whose delivery exists, or ships no tier picker at all in v1.

## 4. Voice and adjacent

### #284 Realtime voice arc I: in-app voice on mobile. CLOSED as premature
Closed 2026-07-27: nothing to spec until voice Phase 3 lands (#275 gates it), and it sits behind #211 and #196. Facts carried forward: `apps/mobile` has zero audio dependencies, `expo-dev-client` is already a dependency so the custom-build story exists, `react-native-webrtc` needs an out-of-tree config plugin and will not run in Expo Go.
**Relation: ignore for v1.** The epic should explicitly exclude in-app realtime audio and note the re-file condition (Phase 3 shipped plus demand).

### #283 Phase 1: in-app voice v1 is the call button we already ship. OPEN, feature, P1
One tap rings the family's own phone via the existing production-hardened affordance (`call-homa-ps.tsx` + `/api/voice/curriculum/start`); the work order is to point a copy at the general assistant and put it where a signed-in parent will find it, keeping the tap beacon.
**Relation: reference.** This is the cheapest credible "voice" feature a v1 iOS app could carry (it is a server-initiated phone call, no native audio code), but it is owned by the voice arc (#287); the epic should link it as an optional surface placement, not duplicate it.

### #287 Voice arc tracker. OPEN. **Relation: reference only.** Phase boundaries matter to the epic solely because #284's re-file condition hangs off Phase 3.

### #266 Magic import (photo of a flyer becomes approved calendar events). OPEN, feature, P2
Follows #260 per founder ruling; models-judge-code-verifies design with parent approval. **Relation: reference.** A native camera plus this feature is an obvious App Store demo moment for a later release; the epic's camera groundwork (from #196 D) should name it as a consumer.

### #253 Does the calendar get used? OPEN, investigation, P2
Baseline zero real families on the calendar substrate. The original adoption gate on arc G was removed by #265 Q-B, so this no longer blocks #263.
**Relation: reference.** Useful honesty check for App Store screenshots and feature ordering: the planner board the epic will showcase currently has zero organic adoption.

## 5. Open PRs

Only two PRs are open and neither touches `apps/mobile/`:
- **PR #254** (claude/carolyng-lag-diagnosis): web create_printable auto-finalize and web `chat-send-policy.ts`. Mobile has its own copy of chat-send-policy, so this is a live example of #211 drift accruing in real time; whoever merges it should check whether the policy change needs a mobile port.
- **PR #49** (curriculum-studio evals): eval-only, irrelevant to mobile.

There is no open PR carrying mobile work. The first App Store release (PR #72, SIWA + Google sign-in + 1.0.0) merged 2026-07-27. No issue tracks the release-ops leftovers recorded in session memory (ascAppId unsaved so submission is interactive-only, Supabase Apple Client IDs founder entry); that is a tracker gap the epic should fill with a founder-action issue.

## 6. Conflicts between existing tickets and a fresh iOS epic

1. **Two owners for the native planner screen.** #263 is a funded, P1, founder-ruled spec for the native Today/board screen. A fresh epic that specs its own mobile home screen collides head-on. Resolution: the epic adopts #263 (and its preconditions #259 and the #196 D1 ruling) as its planner workstream.
2. **The D1 render contract is promised twice.** #196 owns D1-D6; #265 Q-F ruled the sequencing and says D1 gets ruled "at arc B time" inside the planner arc; #211 wants the same code reshaped into a shared package. Three tickets each hold a piece of one decision. The epic should be the place D1 is actually ruled, then #196 closes and #263/#211 point at the ruling.
3. **Monetization posture is unowned.** #235, #190, #293-#297 all assume Stripe-on-web. No ticket anywhere addresses Apple IAP rules, external purchase links, or what the iOS app shows a lapsed/walled family. The epic must create this decision (founder-decision label) rather than inherit silence.
4. **Sell-then-build tiers vs App Review.** #297's founder-ruled posture is fine on the web and a rejection/refund risk in an iOS binary. The epic needs an explicit carve-out for what tiers the app surfaces.
5. **Camera before upload works.** #196's camera item vs #202's broken web photo upload (P1, production, 15 days old). Sequencing conflict only, but the epic should encode the order.
6. **Associated domains.** #263 records that /app/planner stays out of associated-domains claims until the native screen routes it. A launch epic that turns on universal links wholesale would violate that; the epic's deep-link plan must be route-by-route.
7. **Drift before expansion.** #284's close comment and #211 both warn against adding surface area before the shared chat stack exists. An epic that starts with new screens instead of the stack decision repeats the pattern that produced the fabricated-panel incident.

## 7. What the epic should reference or close

**Adopt as children / absorb:** #263 (native board), #196 (close after ruling D1-D6 inside the epic), #211 (shared chat stack, scheduled early).
**Depend on (blockers or design inputs, work stays put):** #259 (per-toggle check-off op, precondition for native writes), #258 (per-client capability signal, the real fabricated-panel fix), #202 (photo upload fix before camera), #238 (onboarding latch clause before mobile enters chat-first onboarding), #235 and #274 (billing/entitlement substrate), #179 (chat history posture for v1).
**Reference:** #180, #181, #175, #203, #190, #293, #295, #297, #283, #287, #266, #253, #241, #197.
**Ignore (closed, done):** #229 (PR #230), #256 (PR #269, interim honesty fix; successor is #258), #284 (re-file condition noted), #257, #265 (rulings recorded), #176.
**New issues the epic should file:** (a) iOS monetization posture (founder-decision, references #235/#190/#293/#297); (b) App Store release ops leftovers from PR #72 (founder-action: ascAppId, Supabase Apple Client IDs entry); (c) push notifications, if wanted for launch, since after #196 closes nothing will track push at all.
