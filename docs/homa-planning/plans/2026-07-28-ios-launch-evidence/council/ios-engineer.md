# iOS engineering review: stack, architecture, sequencing

Reviewer lens: principal mobile engineer, consumer subscription apps, Expo/RN and native Swift.
Evidence: full read of `apps/mobile/src` (28 TS/TSX files, ~5,300 lines), reports 00 to 12, `.github/workflows/mobile-ota-update.yml`, `ci.yml`, `eas.json`, `app.json`. Date: 2026-07-28.

One live infrastructure failure is called out plainly in section 3 (the OTA pipeline publishes into a void; every installed binary is orphaned). It is not a user-data bug, but it silently voids the stack's main superpower and must be fixed before any other mobile work ships.

---

## 1. Stack verdict: keep Expo SDK 56 + RN 0.85 + eve/react. Do not move to Swift. Firm.

### The verdict

Expo is not merely acceptable here; it is the correct strategic choice for this specific product, and a Swift/SwiftUI rewrite would be a category error. Keep the current stack, but change how it is used: adopt the native-materials path (native tabs, `expo-glass-effect`, Icon Composer `.icon`) instead of the hand-drawn chrome that is in the tree today, and front-load native modules into the next binary so iteration stays OTA-shaped.

### Reasoning, in order of weight

1. **The one-brain chat architecture is the product, and it is TypeScript.** The app's core is `useEveAgent` against the same eve deployment the web mounts, with the entire never-stuck / never-forked apparatus (stall watchdogs, wake-grace aborts, send-line queueing, lost-turn recovery replaying durable NDJSON streams, optimistic-state reads from eve metadata). I read all 930 lines of `chat-session.tsx` plus `turn-recovery.ts`, `chat-storage.ts`, and `chat-send-policy.ts`: this is subtle, incident-hardened code whose semantics were paid for twice (GH #170 web, PR #230 mobile). A Swift client means re-implementing the eve client protocol (NDJSON streaming, resumable replay from streamIndex, the patched disconnect classifier semantics, the message reducer) in a second language with zero eve SDK support, then re-paying for every one of those incidents a third time. eve ships `eve/react`; it does not ship `eve/swift`. That alone decides it.

2. **OTA is a structural advantage for an AI product that ships daily, and only Expo has it.** The repo's cadence is multiple product-behavior changes per day; tool renderers, chat semantics, and copy all change weekly. With `runtimeVersion: fingerprint` + EAS Update, all of that is same-day deployable to installed phones. Swift means every renderer tweak rides a 1 to 3 day App Review cycle. For a product whose agent grows new tools weekly, that is the difference between the mobile surface tracking the brain and permanently lagging it. (The pipeline is currently broken in practice; section 3. That is an ops failure, not a stack failure, and it is a two-fix repair.)

3. **The team is AI agents, and the monorepo is the leverage.** Coding agents here are strongest in TypeScript, share `@homa/core`, and port logic web-to-mobile in one worktree (`question-card-model` is literally the same suite on both sides). A Swift target forks the toolchain, the type system, the test harness, and the review loop. Every cross-surface law (tenancy, voice, event registry) is currently enforceable by shared code and shared guards; Swift would enforce it by prose.

4. **Liquid Glass parity is reachable from Expo today, natively, not faked.** Report 07 verifies the paths: `expo-glass-effect` wraps real `UIVisualEffectView` glass, `expo-router/unstable-native-tabs` is a true `UITabBarController` with the real glass tab bar and auto-minimize, `@expo/ui` hosts SwiftUI where needed, and SDK 54+ accepts Icon Composer `.icon` files. The current app's hand-styled opaque JS tab bar (`(tabs)/_layout.tsx`) is the mid-tier tell, but that is a usage choice, not a stack ceiling. The rule going forward: wrap the real material or do not do glass; no BlurView fakes.

5. **StoreKit does not force Swift, and v1 does not need StoreKit at all.** Report 10's decision memo (which I endorse from the engineering side) recommends v1 as web-subscription-only, tier-identical, no merchandised paywall. If/when IAP arrives, `react-native-purchases` or raw StoreKit 2 via an Expo config plugin is a solved pattern; the hard part is server-side (the Apple mirror of `families` billing columns, report 03 section 7), which is TypeScript either way.

6. **Camera and push are mature Expo modules** (`expo-image-picker`/`expo-camera`, `expo-notifications`), each a config plugin plus a store build, not a rewrite trigger.

### Where native Swift does earn a place (later, as islands, not a migration)

App Intents, interactive widgets, and Live Activities (the report 07 "platform depth" separator) require native targets. The right shape is Expo config plugins plus small Swift extension targets inside the CNG project, added one at a time after launch. A Live Activity for a running materials job is the first candidate. None of this argues for moving the app shell.

### Stack risks to manage (not verdict-changing)

- **eve 0.19.0 is pinned with a workspace patch** and gives tools no abort signal; the eve-upgrade-check law applies to mobile equally. Mobile must never bump eve independently of web.
- **`experiments.reactCompiler: true`** on a store binary is a calculated bet; keep it, but Sentry (section 2.6) must land first so a compiler-induced crash is visible.
- **Native tabs are alpha**; adopt behind a branch with device verification, and keep the JS `<Tabs>` fallback trivially restorable.
- **RN's fetch replacement** (`installStreamingFetch` swapping in `expo/fetch` globally, plus the Hermes DOMException shim) is a load-bearing global mutation. It is documented in `apps/mobile/CLAUDE.md`; keep it guarded by a startup assertion test when the shared package lands.

---

## 2. Architecture rulings

### 2.1 Renderable contract: rule for render-by-kind. This is the load-bearing decision (D1), and it should be ruled inside this epic.

Today mobile renders 3 of ~62 tool names as cards, 6 more as chips, and everything else as literal silence (`message-view.tsx` returns null; `partIsRenderable` excludes them). The consequences are already on the incident ledger: the fabricated-panel bug (#256, model told the planner is open while mobile renders nothing) and the simulator walkthrough's hard dead end (the agent routing a parent to a progress page that does not exist on the phone). Three hand-synced name lists (`TOOL_STATUS_LABELS`, `memoryChipFor`, the render dispatch) with a "keep in sync" comment and no guard test is drift by construction.

**Ruling: adopt a server-owned renderable descriptor, rendered by kind, with a mandatory generic fallback.**

- Every tool result that should be visible carries `renderable: { kind, version, props }` where `kind` is a small closed vocabulary (`material`, `receipt`, `question`, `progress_update`, `planner_link`, `image`, `job_status`, roughly ten kinds), not a tool name. The server (tool layer) owns the mapping; clients own one renderer per kind.
- **Unknown kind or missing renderable never renders silence.** The client renders a generic receipt card ("Homa did: <label>") from `kind: receipt` fields. Silence is the failure mode that produced #256; it is banned by contract.
- Pair it with **#258's per-client capability signal**: the client declares the kinds (and versions) it renders on session start; the channel exposes that to the model so the agent never claims a surface the phone cannot draw. Until #258 lands, the interim honesty edits (PR #269 class) continue by hand, which is exactly why #258 should ride this epic.
- This matches the 2026 industry convergence on static/declarative generative UI (report 07 section 2.1): the agent selects and fills typed components; the client keeps brand, accessibility, and safety.
- Migration is incremental: keep the current by-name matrix as the legacy path, introduce kinds tool-by-tool starting with the ones causing dead ends (planner, progress, generate_image, log_hours and the receipt chips web already renders), and delete the name matrix when the kind coverage supersedes it.

By-name is rejected because it makes every new tool a three-client change (web, mobile, future surfaces) and makes silence the default for anything missed. By-kind makes the default a visible receipt and makes new tools a server-only change in the common case.

### 2.2 Shared package: extract `packages/chat-core` now. The duplication is already charging interest.

Evidence of active drift: the session-fork fix needed two PRs (#227 web, #230 mobile); open PR #254 is editing web `chat-send-policy.ts` while mobile holds its own copy; `busyLabel`/chip lists have no parity guard. Issue #211 is correctly scoped and should be scheduled early in this epic, not after new surfaces.

What moves (all already pure, all already node-tested, extraction is mechanical):

- `chat-send-policy` (4-case pure function, identical intent on both sides)
- `turn-recovery` (core logic; inject the supabase client and host)
- `chat-storage` shapes and the rotation/fold/trim/stamp functions (AsyncStorage vs localStorage stays behind a tiny injected KV interface)
- `message-utils` / the renderable-kind dispatch tables from 2.1 (the contract lands ONCE, in the shared package)
- `question-card-model`, `transcript-days`
- the send-state reader (`userMessageSendState`)

What stays per-platform: the view components, the composer, scroll behavior, keyboard handling. Do not attempt a shared component library; share the brain, not the pixels.

Until extraction lands, add one cheap guard now: a node test that imports web's and mobile's tool-name tables and diffs them, so drift fails CI instead of shipping silence.

Also fix while in here: `turn-recovery.ts` queries `channel = "web"` (line 74). It works because the eve channel labels app sessions "web", and it will silently kill recovery the day mobile gets its own channel label (which #258 will want). The channel label must become a shared constant exported next to the recovery code, and the #258 design must treat "rename the channel" and "update recovery lookup" as one change.

### 2.3 Deep links and universal links: route-by-route, with an auth handoff

Today the scheme `homa` exists solely for the OAuth callback; there are no content routes, no `associatedDomains`, and the four web punts open a cold, signed-out browser. Since 2026-07-28 that browser lands on a payment-bearing trial gate, which is both a UX cliff and the app's single biggest 3.1.1 exposure.

Rulings:

1. **Universal links route-by-route, never wholesale.** #263 already records the law: `/app/planner` stays out of associated-domain claims until the native screen routes it. Start with exactly two: `/join` (invite consumption; one server call plus a signed-in confirm screen) and the tokenized report URL `/onboarding/r/[token]` (open in-app in a viewer or hand to Safari deliberately). Add routes only when a native surface exists for them.
2. **In-app scheme routes for notifications:** `homa://chat`, `homa://today`, plus a generic `homa://web?path=` escape hatch. Push (2.5) depends on this.
3. **Auth handoff for web punts.** When the app must send a signed-in user to the web (subscription management, onboarding completion), it must not send them signed out. Options in order of preference: (a) a short-lived, single-use handoff token endpoint (`POST /api/auth/handoff` under the caller's JWT returning a one-time URL that establishes the web session, standard pattern, small server diff), or (b) Supabase session transfer via PKCE re-auth in `ASWebAuthenticationSession`. Cold-browser punts are banned once this exists.
4. **Steering copy is part of the deep-link story.** The eve channel currently instructs the model to point walled families to thankshoma.com/onboarding inside chat, and `openWebOnboarding()` buttons do the same. For the iOS channel both must become the neutral "your Homa plan is managed on the web" posture from report 10, wired per-channel (the `defineDynamic` per-channel mechanism already exists for exactly this shape).

### 2.4 Offline and cache: small, deliberate, no sync engine

The current posture (AsyncStorage render cache for chat, direct RLS reads for family data, storage writes fail soft) is right-sized for v1. Three concrete fixes:

1. **Kill the error-blind screens (defect, fix in the first workstream).** `family.tsx` and `chat.tsx` destructure `useFamilyData()` without `error`, so a network failure renders "Start with the web onboarding" / "Finish setup first" to a fully onboarded family. That is the exact amnesia-adjacent misread the CG feedback punished. Every screen must branch loading / error / empty / ready distinctly, with a retry button (Today's error copy promises tab-switch retry and offers no button today).
2. **Stale-while-revalidate for family data.** Persist the last good `useFamilyData` payload per user in AsyncStorage; render it instantly on focus, refresh in background. Removes the spinner-on-every-tab-focus and makes airplane-mode launches show the family instead of an error.
3. **A single offline banner** driven by NetInfo-style reachability, plus queue-and-hold semantics the chat already has. No optimistic writes beyond what exists; the planner check-off write op (#259) is the first place real offline-write policy will matter, and that belongs to the #263 arc.

Also: the splash holds on fonts + session read with no timeout; add a 5 second cap that proceeds with system fonts rather than stranding the splash on a hung AsyncStorage read.

### 2.5 Push notifications: a channel-doctrine transport, not a new brain

Push is a delivery transport for server-originated messages, exactly like SMS and email under the channel doctrine. Architecture:

- **Token registry:** `device_push_tokens` table (user_id, family_id resolved server-side from the authenticated membership, Expo push token, platform, app version, created/last_seen, revoked_at). Registration endpoint under the caller's JWT; `familyId` never from the client (tenancy law). Tokens revoked on sign-out and on Apple feedback of invalidation.
- **Send path:** server-side only, from the existing schedule/follow-up infrastructure (the same place `send_followup_email` and SMS sends live), via Expo push service for v1 (APNs key upload once). A `send_push` leaf tool only if the agent ever needs to initiate; scheduled sends do not need a model in the loop.
- **Policy is product law, encoded:** account owner auto-subscribed only where the SMS twin already is; invited adults opt in; quiet hours; the anti-guilt ratio law (response >= 20 percent, unsubs < 1 percent monthly, else sends stop); banned mechanics stay banned (no streaks, no inactivity nudges, no per-demonstration push). Morning brief, offer fulfillment receipts, agent-job completion, and the Friday letter are the four launch candidates, each individually toggleable in a notification-preferences screen (which the settings workstream owns).
- **Client:** `expo-notifications` config plugin (native build required), permission prompt deferred until a moment of earned value (after the first delivered artifact, never at first launch), taps deep-link via 2.3's scheme routes.

### 2.6 Crash and error reporting: nothing exists today; this is not optional for a store app

- **Sentry via `@sentry/react-native`** (Expo config plugin): native crash handling, JS errors, and OTA awareness (tag every event with `Updates.updateId` and the runtime fingerprint, so crashes map to the exact OTA bundle, not just the binary).
- **Privacy posture is part of the setup, not an afterthought:** `sendDefaultPii: false`, no chat content, child names, or family data in breadcrumbs or extras; scrub URLs of tokens; this must be reflected in the privacy nutrition label and the 5.1.2(i) disclosure work (report 10).
- **Root ErrorBoundary** in `_layout.tsx` with a reassure-voiced recovery screen ("Something went sideways on our end. Your family's info is safe." plus a reload button) reporting to Sentry. Today a render throw is a white screen.
- **Alerting:** Sentry issue alerts to the founder-visible channel; release health (crash-free sessions) checked before every OTA promote once a phased-rollout habit exists.

### 2.7 CI: mobile is currently untested in every pipeline that ships it

Facts: `check:mobile-chat` exists in the root package.json and runs nowhere in CI; `ci.yml` contains zero mobile mentions; the OTA workflow gates on typecheck only, so a red mobile test suite ships to production phones on the next merge. Fixes, all small:

1. Add to `ci.yml`: `pnpm --filter mobile typecheck`, `pnpm --filter mobile lint`, `pnpm check:mobile-chat` (path-filtered to `apps/mobile/**` and `packages/core/**` if runtime matters).
2. The OTA workflow runs `check:mobile-chat` before publishing. Non-negotiable: this workflow IS mobile's deploy pipeline.
3. Add `npx expo-doctor` as a nonblocking-then-blocking check on mobile changes.
4. When `packages/chat-core` lands, its tests join the default CI lane (they will run on web changes too, which is the point).

### 2.8 OTA fingerprint-drift guard: the void must be structurally impossible

The design (fingerprint runtime policy) is correct; the failure was silent no-op publishes for three weeks. Guard, in the OTA workflow before publish:

1. Compute `npx expo fingerprint` on the checkout.
2. Query EAS for the latest FINISHED production build's fingerprint.
3. On mismatch: fail the job loudly and auto-open/refresh a P1 issue titled "Mobile OTA orphaned: main's fingerprint has no store binary", with both hashes in the body. Never publish a no-op silently.
4. Pin `eas-cli` to an exact version in the workflow (currently `@latest` in a release pipeline).
5. Add the inverse check to the build path: after any `eas build`, verify the built fingerprint matches main's current fingerprint, so a branch-built binary (the build 5 mistake) can never become the store candidate again.

---

## 3. Sequencing: what must be native-build vs OTA, and the release train

### 3.0 Live infrastructure failure, plainly labeled

**The OTA pipeline currently publishes to a fingerprint (`9c5e8a85...`) for which no binary exists, and the submitted 1.0.0 binary (build 5, fingerprint `d2d9ae0d...`) has never matched any published update and never will.** Build 5 was also built from a branch that was closed unmerged, so mainline cannot reproduce the app a reviewer would see. Every installed binary is orphaned. User-facing symptom if build 5 were released: an app frozen at its July 21 JS forever, permanently diverging from the brain it talks to. Disposition: build 5 must never be released; it is a dead end by construction. The founder should remove it from any pending review in App Store Connect; the next submission is a fresh binary from main. This finding is escalated in this review (it needs a founder action in ASC plus the automatable fixes in 2.8 and W0 below).

### 3.1 The native-build vs OTA law for this app

**Principle: front-load native capability into the binary, iterate features by OTA.** A native module costs a store build whether or not the feature ships; a feature behind a flag costs nothing until enabled. Therefore the next binary should carry every native module the next two months of roadmap needs, dark.

Requires a new store binary (native):
- expo-notifications (push), expo-image-picker / expo-camera (capture), @sentry/react-native, expo-glass-effect, native tabs adoption, the `.icon` asset, `associatedDomains` entries, expo-sharing / print if adopted, any StoreKit/IAP future, eve or Expo SDK bumps, React/RN upgrades, splash/icon changes.

Ships OTA (JS only, same fingerprint):
- All tool renderers and the render-by-kind contract, chat behavior, error-state fixes, the settings screen, account-deletion UI (server does the work), Today-tab content, copy, suggestion chips, deep-link route handling for already-declared schemes/domains, notification preference UI, flag flips of dark native modules.

Gray zone: `app.json` config changes map to fingerprint changes; treat every `app.json` diff as binary-triggering unless `expo fingerprint` proves otherwise.

### 3.2 Build and submit cadence

- **Now:** Build 6 from main HEAD only after W0 and the Build-6 payload (below) merge. Submit with complete metadata, the comped +homatest demo family, and review notes stating the web-managed subscription posture. `ascAppId` gets committed into `eas.json` at this submit so every later submit is non-interactive.
- **Until public launch:** a weekly binary train (build whenever the native payload changes, at most weekly), TestFlight to the founder and co-founders on every build. OTA continuously between trains, now gated by tests plus the drift guard.
- **After launch:** binaries on a two to four week cadence or when native payload demands; OTA for everything else; phased release (7-day) on every store version; crash-free rate checked before accelerating.
- **Never again:** store builds from unmerged branches. The guard in 2.8 item 5 enforces it.

### 3.3 Build 6 payload (the decision that makes OTA a superpower again)

Native modules included dark: Sentry (live immediately), expo-notifications, expo-image-picker, expo-glass-effect + native tabs (behind a JS flag until verified on device), `.icon` asset, `associatedDomains` for `/join` only. Product scope: 3-tab main app plus W1/W2 JS work. This accepts the "3-tab v1" answer to report 05 section 3's open question: rebuild from main, do not resurrect the 5-tab branch binary; the planner tab arrives via #263 on the train.

---

## 4. Workstreams, dependency-ordered, with acceptance criteria

Sizing: S = a day or two of agent work, M = several days and one or two PRs, L = a week plus, multi-PR arc.

**W0. Release hygiene and pipeline truth (S). No dependencies. Do first.**
- Drift guard + eas-cli pin in the OTA workflow (2.8); OTA workflow runs `check:mobile-chat`; mobile typecheck/lint/tests in `ci.yml`; founder-action issue filed for: kill build 5 in ASC, supply `ascAppId`, confirm Supabase Apple Client IDs.
- Accept: a push to main with a fingerprint mismatch fails the OTA job and opens/updates an issue; CI is red when a mobile test is red; `eas submit --non-interactive` works after the founder step.

**W1. Observability and error truth (S). Depends: W0 merged (so the OTA that ships it is real once Build 6 exists).**
- Sentry with privacy scrubbing + OTA tagging; root ErrorBoundary; fix `family.tsx`/`chat.tsx` error destructuring so network failure renders an error state with retry, never "finish setup"; splash timeout.
- Accept: a thrown render error on device produces a branded recovery screen and a Sentry event tagged with updateId; airplane mode on a set-up account shows an error + retry on all three tabs, never an onboarding punt.

**W2. Compliance pack (M). Depends: none technically; blocks submission.**
- In-app account deletion (server endpoint doing real deletion + SIWA token revocation via Apple REST API; app entry point in a new Settings screen), AI third-party-processing consent moment + privacy label parity (5.1.2(i)), report-content affordance in chat (4.7.1), neutral expired-account state (no pricing, no checkout link in v1), privacy manifest audit of the pod graph, Declared Age Range API read as a no-op.
- Accept: a fresh Apple-created account can delete itself entirely from inside the app; review-notes checklist from report 10 section "Pre-submission checklist" is green; grep of app copy shows zero prices and zero purchase CTAs.

**W3. Shared chat-core extraction, #211 (M). Depends: W0 (CI exists to protect it).**
- `packages/chat-core` with send-policy, storage logic, recovery, message-utils/dispatch tables, question-card-model, transcript-days; web and mobile consume it; interim tool-table parity test lands first and dies when the extraction completes; channel-label constant shared with recovery.
- Accept: PR #254-class changes touch exactly one file to affect both clients; `pnpm check:mobile-chat` and the web twin suites both run against the package; no logic file under `apps/mobile/src/features/chat` remains that has a diverged web twin.

**W4. Renderable contract, render-by-kind + capability signal (L). Depends: W3 (the contract lands once, in the package); coordinates with #258 and #263 arc B.**
- Server-side `renderable {kind, version, props}` on tool results; client kind-renderers (material, receipt, question first); mandatory generic receipt fallback so unknown output is never silent; per-client declared-kinds signal to the model; the dead-end tools from the walkthrough (planner, progress) either render a kind or the agent stops claiming them on this channel.
- Accept: on device, `log_hours`, `edit_plan`, and `generate_image` produce visible cards/chips; a synthetic unknown-kind tool result renders a generic receipt; the #256 repro (ask to open the planner) yields an honest answer with a visible next step, not a claim of an open panel.

**W5. Deep links, universal links, auth handoff (M). Depends: W2 (Settings exists), Build 6 (associatedDomains).**
- `homa://` content routes; `/join` universal link + consumption; `POST /api/auth/handoff` one-time-URL flow so every web punt opens signed in; iOS-channel neutral wording for walled accounts in agent instructions and app copy.
- Accept: tapping a `/join` invite on an iPhone with the app installed lands in-app and consumes the token; "manage your plan on the web" opens the browser already signed in; no code path opens `/onboarding` cold.

**W6. Push notifications (M). Depends: Build 6 (module dark), W5 (tap routing), policy sign-off from the founder package (D4).**
- Token registry + registration endpoint (tenancy law), Expo push send path from existing schedule infra, four launch notification types individually toggleable, deferred permission prompt, quiet hours, anti-guilt ratio instrumentation.
- Accept: morning brief arrives as a push that deep-links to chat; sign-out revokes the token (verified server-side); preference toggles round-trip; no notification type exists outside the approved list.

**W7. Camera capture to chat (M). Depends: Build 6 (module dark), #202 fixed first (broken upload pipe), W4 (photo tool results render).**
- Composer attachment affordance (photo library + camera) posting through the same upload path as web; renders as an attachment marker in transcript.
- Accept: a photo of finished work sent from the app appears in the transcript, reaches the agent, and survives the #202 regression test; camera denied-permission state is reassure-voiced.

**W8. Today tab becomes the home surface + native planner board (L). Depends: W4 (kinds), #263 arc (its own P1 spec owns the board), #259 (check-off op) before any native write.**
- Today shows today: plan items, latest material, one suggested action, children by name (report 07 D1 checklist item); the board itself is #263's versioned JSON route work, adopted here, not respecified.
- Accept: #263's own acceptance criteria; plus first signed-in paint shows family-specific today-state with one tappable action, and the walkthrough's "60 percent empty screen" finding is dead.

**W9. Platform citizenship pass (M). Depends: Build 6 (glass modules), can interleave from W4 onward.**
- Native tabs (device-verified, flag-guarded), glass chrome with opaque content, `.icon`, haptics for send/complete/error via sensory feedback, dark mode decision (currently pinned light while `dark.css` exists in the design system: either ship designed dark or declare light-only deliberately in `app.json` and the listing), Dynamic Type + Reduce Transparency/Motion audit.
- Accept: report 07 checklist A1 to A9 pass on a physical iOS 26 device; C2 haptics distinct per meaning; no regression under Reduce Transparency.

**W10. Release train operation (continuous). Depends: W0.**
- Weekly TestFlight binaries while native payload changes; OTA between; phased public release when W2 + W4 + W5 are green and the founder rules go.
- Accept: every installed TestFlight/store binary's fingerprint has matching OTA publishes (queryable, guarded); time from merge-to-phones for JS changes is under one hour.

Deliberately out of v1: StoreKit/IAP (report 10 Option A; revisit triggers recorded there), in-app realtime voice (#284's re-file condition), Android (OTA already iOS-only; make it an explicit D6 ruling), App Intents/widgets/Live Activities (post-launch islands), chat history browsing (#179 owns it; state in the launch notes that mobile ships single-thread).

---

## 5. Top risks if this plan is ignored

1. Releasing build 5: an unpatchable binary from a deleted branch, permanently OTA-orphaned.
2. Shipping new surfaces before W3/W4: every new tool becomes new silence, and the fabricated-panel class recurs on every future capability.
3. Submitting without W2: 5.1.1(v) account deletion is a guaranteed rejection with sign-in-creates-account live; the walled-family steering copy inside chat is a 3.1.1 magnet.
4. Leaving the OTA gate typecheck-only: the first red-test merge after launch ships broken JS to every customer phone within minutes, with no crash reporting to see it (until W1).
