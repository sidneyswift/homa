# Mobile code map: apps/mobile (Expo iOS app)

All paths below are relative to `apps/mobile/` unless prefixed. Read date: 2026-07-28, branch `claude/homa-ios-product-planning-470a45` worktree. Every source file under `apps/mobile` was read (28 TS/TSX files, plus app.json, eas.json, package.json, README.md, AGENTS.md/CLAUDE.md, env.d.ts, .env.example, tsconfig.json, eslint.config.js, .claude/settings.json, and the OTA workflow).

## 1. What the app is

A pure-client native companion to the web product. Same Supabase project (`kzplntcdtsvdowntvlza`), same eve agent mounted in the Next.js deployment at `EXPO_PUBLIC_API_URL` (production: `https://thankshoma.com`, baked into eas.json:14,23). No secrets, no tenancy logic; RLS and the eve channel's bearer auth are the boundary (README.md:5-6, AGENTS.md). Expo SDK 56, React 19.2.4, RN 0.85.3, expo-router, React Compiler experiment on (app.json:51), eve 0.19.0 pinned (package.json:22).

Store identity: name "Homa", slug `homa`, scheme `homa`, bundle `com.thankshoma.homa`, version 1.0.0, portrait only, `supportsTablet: false`, light-only UI (`userInterfaceStyle: "light"`, app.json:9), `usesAppleSignIn: true`, `ITSAppUsesNonExemptEncryption: false`. EAS project `916ce7cf-5c57-4036-a9a9-af8651f1624a`, owner `sidneyswift`, runtime policy `fingerprint`, autoIncrement production builds (eas.json:18).

Ship paths (README.md:20-40): JS-only changes OTA on every push to main touching `apps/mobile/**` or `packages/core/**` (`.github/workflows/mobile-ota-update.yml`, iOS-only publish because the web static export fails under expo-router SSR). Native changes need `eas build` + `eas submit`. The OTA workflow's only gate is `pnpm --filter mobile typecheck`; the mobile node tests do NOT run there and are absent from `.github/workflows/ci.yml` (see §10).

## 2. Navigation structure and screens

expo-router file routes, two groups, no other routes exist:

- `src/app/_layout.tsx`: root Stack. Calls `installStreamingFetch()` at module init (line 13, load-bearing invariant per AGENTS.md), holds the splash until fonts load AND the persisted session is read (lines 17-28), wraps everything in `SessionProvider`. No ErrorBoundary anywhere in the app.
- `src/app/(auth)/signin.tsx`: the only signed-out screen. Redirects to `/` when a session exists (line 61).
- `src/app/(tabs)/_layout.tsx`: session guard (`if (!session) return <Redirect href="/signin" />`, line 19), then three tabs: Today (`index`), Chat, Family, with custom brand-geometry SVG tab icons (`src/components/ui/tab-icons.tsx`, no icon-font dependency).

### Today tab (`src/app/(tabs)/index.tsx`)
Mirrors web `/app` page's three states. Renders: Logo, then loading spinner / error text / "finish your setup" block with an "Open onboarding" button (punts to web, line 79) / ready state: greeting ("Hi {memberDisplayName ?? parent_display_name}." else family name, lines 92-94), one Card per child (name, age via `ageLabel(ageInMonths(...))` from @homa/core, interests "Into:", focus "Working on:"), and a "Talk to Homa" button pushing `/chat`. Refetches on focus (lines 27-31). Actions: exactly two buttons.

### Chat tab (`src/app/(tabs)/chat.tsx`)
Header bar with Logo, then: spinner while loading family or preparing storage; "Finish setup first" card with "Open onboarding" (web punt) when `!family?.profile_completed_at || children.length === 0` (line 32); else mounts `ChatSession` keyed by user id with storage key `homa-chat-${userId}` (chat-storage.ts:61) so transcripts never bleed across accounts. See §4 for the full pipeline.

### Family tab (`src/app/(tabs)/family.tsx`)
Renders: family card (name, parent display name, `us_state`), then EITHER a "finish onboarding on the web" card (setup incomplete) OR the child cards (name, age, interests) plus `AddChildForm`, then "Signed in as {email}" and a Sign out button (line 163-167, `supabase.auth.signOut()`). Full capability list:
- Read family, children, member display name (`src/features/family/use-family-data.ts` wrapping `src/lib/family.ts`, direct supabase-js RLS reads of `families`, `family_members`, `children`).
- Add a child (`src/features/family/add-child-form.tsx` → `addChild` in `src/lib/family.ts:81`, direct RLS insert into `children` with client-passed `family_id`, birth date validated by `isValidBirthDate`, stored in the historical `birth_month` column).
- Sign out.
That is everything. No child edit or delete, no family edit, no state change, no member invites, no subscription/billing view, no notification preferences, no account deletion. Note: `useFamilyData` exposes `error` but family.tsx does not destructure it (line 20), so a failed read renders the `family == null` branch, the misleading "Start with the web onboarding; everything here fills in from there" (lines 139-148). chat.tsx has the same blindness (line 29): a network failure shows "Finish setup first" to a fully onboarded family.

## 3. Auth flow

- **Session**: `src/lib/supabase.ts`: supabase-js with AsyncStorage persistence, `autoRefreshToken`, PKCE flow (line 27, needed because the OAuth code exchange survives the browser hop). Auto-refresh runs only while foregrounded (AppState listener, lines 34-40). `src/features/auth/session-provider.tsx` loads the persisted session once, subscribes to `onAuthStateChange`, exposes `{ session, initializing }`.
- **Apple** (`src/features/auth/apple-sign-in.ts`): native sheet via expo-apple-authentication, identity token straight to `supabase.auth.signInWithIdToken({ provider: "apple" })`, no nonce (documented Supabase Expo pattern). Depends on the bundle ID being listed under the Apple provider's Client IDs in Supabase (a founder step flagged in memory as possibly unfinished). Exists for App Review 4.8. iOS-only render (signin.tsx:129), placed first for prominence.
- **Google** (`src/features/auth/google-sign-in.ts`): browser OAuth: `signInWithOAuth` with `skipBrowserRedirect`, `openAuthSessionAsync` (ASWebAuthenticationSession), redirect fixed literal `homa://auth/callback` (line 38, deliberately not `Linking.createURL` to survive dev-client Metro hosts on Supabase's exact-match allowlist), then `exchangeCodeForSession`. Native Google account-picker sheet is NOT present (README.md:68).
- **Email + password** (signin.tsx:79-97): `signInWithPassword` only. No sign-up, no password reset, no magic link, no forgot-password affordance at all.
- **Result plumbing**: `sign-in-result.ts` distinguishes `signed-in` / `dismissed` (silent) / `failed` (one generic reassurance line; copy carries a `TODO(founder)` at signin.tsx:44).
- **Brand-new user with no family**: Apple or Google sign-in on a fresh identity CREATES a Supabase user (signInWithIdToken/exchangeCodeForSession both mint accounts). The session guard then admits them to the tabs, where all three tabs show the "finish setup on the web" punt. There is no in-app family creation, no in-app onboarding, and no session handoff to the web: `openWebOnboarding` opens the system browser signed out, so the parent re-authenticates on the web, onboards there (behind the now-live card-upfront signup paywall), then returns to the app and pulls to refocus. Two App Review exposures follow directly: (a) the app supports account creation but offers no account deletion (guideline 5.1.1(v)); (b) the in-app "Open onboarding" button routes users to a web page whose flow includes payment (guideline 3.1.1 steering risk).

## 4. Chat pipeline

`src/features/chat/chat-session.tsx` (930 lines, the app's core) is the mobile twin of web `chat-client.tsx`:

- **Transport**: `useEveAgent` from `eve/react` with `host: env.apiUrl`, per-request bearer resolved fresh from `supabase.auth.getSession()` (lines 226-233), `maxReconnectAttempts: 8`. Streaming works only because `src/lib/streaming-fetch.ts` installs `expo/fetch` as global fetch (RN's fetch cannot read NDJSON response streams) and shims `DOMException` for Hermes (eve's disconnect classifier does `instanceof DOMException`).
- **Persistence** (`src/lib/chat-storage.ts`): AsyncStorage per user. Saved shape: archived messages (cap 200), live event log (cap 2000, trimmed at turn boundaries), session cursor, message arrival times, lastActivityAt. Fresh-morning rotation: first visit after 4am local folds the previous session's events into the archive and starts a fresh model session (`shouldStartFreshSession`, line 104). Day separators via `src/lib/transcript-days.ts` ("Today"/"Yesterday"/weekday/"Earlier" for legacy).
- **Never stuck**: while busy, an empty composer shows Stop, a typed one shows Stop AND Send where Send queues (the Claude-composer shape, founder ruling 2026-07-10); wake-from-background aborts a stream silent past 20s after a 5s grace (lines 91-98, 392-417); a 180s foreground watchdog aborts streams that die without backgrounding.
- **Never forked (GH #170 port)**: `isSendLineOccupied({busy, recovering})` (`chat-send-policy.ts`) queues sends while lost-turn recovery is undecided. `src/lib/turn-recovery.ts` re-learns the session id from `conversation_messages` (exact-content + timestamp match under RLS; note it queries `channel = "web"`, the eve channel labels app sessions "web" too, turn-recovery.ts:74), replays the durable stream from index 0, and folds the recovered conversation into the archive. Recovery deadline 240s; during it a "Reconnecting" bubble shows instead of the error banner.
- **Send affordances**: suggestion chips on empty sessions (3 hardcoded, chat-session.tsx:85-89), queued-bubble UI with per-item remove and "Send now" (stops the turn to flush), retry link on "Not sent" bubbles (optimistic-state read from eve metadata, `message-utils.ts:96`), "Start a new chat" row that archives and rotates.
- **Analytics**: `chat.turn_completed` emitted per turn with status, latency (`src/lib/turn-clock.ts`), model_tier "mid", tool_calls count, via `src/lib/events.ts` (typed @homa/core `emitEvent` under the caller's own token; silent no-op signed out). A learning-review POST to `/api/learning/review` fires after clean turns (chat-session.tsx:210-224).
- **Markdown**: `markdown-text.tsx` is a deliberate tiny renderer: paragraphs, `#`-`####` headings, bullet/numbered lists, bold, italic, inline code. No links, no images, no tables, no blockquotes; a URL in assistant text is inert plain text on mobile.

### Tool-output rendering matrix (message-view.tsx:101-143 + message-utils.ts)

Renders (the complete list, 10 tool names):
1. `ask_user_questions` → interactive stepped QuestionCard (question-card.tsx, question-card-model.ts): single/multi select, Skip, "Type something else", answers composed into ONE user message; only the newest unanswered card is tappable; answered cards render settled.
2. `create_printable`, 3. `show_material`, 4. `create_worksheet` (legacy v1 name) → MaterialCard when `output.material?.previewUrl` (or legacy `worksheet`) exists: kind headline, title, page count, preview image, "Open the printable PDF" button via `Linking.openURL` into the system viewer (material-card.tsx:49-53). Refusals and legacy payloads without previewUrl render nothing.
5. `remember` → "Noted" chip; 6. `forget` → "Forgot" chip; 7. `update_child_profile` → "Profile updated" chip; 8. `save_skill` → "Skill saved/updated" chip; 9. `forget_skill` → "Skill removed" chip; 10. `mark_material_final` → "Final kept" chip (message-utils.ts:22-73).

Falls through SILENTLY (MessagePartView returns null at message-view.tsx:144; `partIsRenderable` also excludes them so a tool-only assistant message renders nothing at all): every other tool in the fleet's ~62-tool roster (apps/web/agent/tools/). Notably, tools the WEB transcript does render but mobile drops: `edit_plan` (planner chip), `log_hours`, `schedule_plan_activity`, `add_family_event`, `update_family_event`, `remove_family_event` (all chips at apps/web/app/app/message-parts.tsx:127-198), `generate_image` (web renders the image, message-parts.tsx:987), plus web-only surfaces with no mobile twin at all: `open_planner` canvas, `start_checklist` takeover, `ask_for_details`, progress cards (`manage_child_progress`, `explore_child_map`, `score_child_report`), photo tools (`ask_for_photo`, `keep_photo`, `search_photos`, `find_attachments`), tasks (`create_task`/`update_task`/`delete_task`/`list_tasks`), agent-job tools (`start_agent_job` etc.), `recall`, `web_fetch`, `find_curriculum_profile`, `prepare_research_brief`, and the SMS/signup tools. This is the "planner tools render as silence in mobile chat" suspicion from the parity plan, confirmed in code, and the substrate of the live fabricated-panel bug (#256): the model believes it showed a panel, mobile shows nothing.

Busy labels exist for 12 tools (message-utils.ts:131-144: get_children, create_printable, show_material, generate_image, find_materials, mark_material_final, remember, forget, update_child_profile, save_skill, forget_skill, load_skill); everything else shows "working on it". So `generate_image`, `find_materials`, `get_children`, `load_skill` get a status line while running but their OUTPUTS render nothing.

Composer is text-only: no attachments, no camera, no photo library, no dictation (web has chat-attachments.tsx and dictation.tsx; message-view.tsx:149 notes "Mobile carries no attachment markers").

## 5. Design token usage vs docs/homa-design

`src/theme/tokens.ts` is a hand-copy of docs/homa-design/tokens via web globals.css (header comment, lines 1-9; same sync rule as web; packages/design M1-17 will replace both). Spot-checked values match web (`stone-900 #221E1A`, `clay-500 #E7602F`, page `#FBF7F0`). Semantic aliases mirror globals.css; components consistently consume `colors`/`space`/`radius`/`fontSize`/`shadows`/`pressScale`, and I found no hardcoded off-palette colors outside the deliberate exceptions (Google glyph brand colors, white `#FFFFFF` for card/onBrand, warm shadow `#332A21`). Fonts: Schibsted Grotesk display, Hanken Grotesk body, Fredoka wordmark via @expo-google-fonts (`src/theme/fonts.ts`); EB Garamond, Caveat, JetBrains Mono not yet ported. Logo is a real port of the brand component (bounced wordmark letters with per-letter offsets/rotation, `src/components/brand/logo.tsx`), honoring the brand-casing ruling. Gaps: docs/homa-design has `dark.css` but the app is pinned light (`userInterfaceStyle: "light"`); `radius.xl`, `colors.gold/goldSoft/success/info`, `shadows.md`, and `Logo tone="dark"` are defined but unused. `pnpm check:design-tokens` runs in CI but whether it covers the mobile copy was not verified here.

## 6. Error / empty / loading states

- Splash holds until fonts + session read (root layout); no timeout, a hung AsyncStorage read would strand the splash.
- Sign-in: inline reassurance-voiced errors; provider dismissal is deliberately silent; reasons go to console.error only.
- Today: spinner; error text ("Your family's info is safe; it just didn't load this time. Switching tabs and back will retry.", index.tsx:50-52; there is no retry button, refetch really is focus-driven); empty state = web punt.
- Chat: spinner; setup-incomplete card; per-message "Sending"/"Not sent + Retry"; generic error banner ("Your conversation is safe...") with lost-turn recovery in front of it; "Reconnecting" busy bubble; suggestion chips as the empty state.
- Family: spinner; NO error surface (see §2); add-child inline error.
- Storage writes fail soft everywhere (saveChat catch, emitFamilyEvent no-op, learning-review catch).
- No global ErrorBoundary, no offline/airplane-mode banner, no toast system.

## 7. Tests

Four node test files, all under `src/features/chat/`, all pure-logic or source-regex (no component/render harness, no RN test runner, no E2E):
- `question-card-model.test.ts`: same suite as web's question-card.test.ts (parse, latest-request, compose, signature).
- `chat-send-policy.test.ts`: 4 cases for `isSendLineOccupied`.
- `chat-session-fork.test.ts`: source-matching structural checks that the GH #170 fix is wired (imports, queue flush count, dependency lists) since the screen cannot mount under node.
- `message-utils.test.ts`: `userMessageSendState` cases.

They run via root `package.json` script `check:mobile-chat` (tsx --test, root package.json:40). That script is NOT in `.github/workflows/ci.yml` (grep confirms zero mobile mentions) and NOT in the OTA workflow (which only typechecks). Mobile tests are therefore local-only right now. tsconfig excludes `*.test.ts` from `tsc --noEmit` deliberately (question-card-model.test.ts:20-25 explains: avoiding @types/node in a client app).

## 8. Dead code

- `clearSavedChat` (chat-storage.ts:91) has zero callers.
- `PreparedChat.rotated` (chat-storage.ts:46) is set but never read by any consumer.
- `save_skill`/`forget_skill` chips and busy labels (message-utils.ts:48-64, 141-142) reference tools that are dormant per the filesystem-first ruling (no runtime tool exists), so these branches can no longer fire on new transcripts; harmless for legacy history.
- `create_worksheet` handling is intentional legacy (documented).
- Unused token surface listed in §5; `Logo tone="dark"` never passed.
- `src/app/(tabs)/chat.tsx` imports `Card`/`Button` legitimately; no orphaned imports found. eslint (eslint-config-expo flat) and strict TS are on.

## 9. Code quality concerns

- The two error-blind screens (family.tsx, chat.tsx destructure without `error`) turn transient network failures into "you have no family / finish setup" messaging, the exact web-amnesia-adjacent misread CG feedback punished before.
- `busyLabel`'s tool list and `TOOL_STATUS_LABELS`, `memoryChipFor`, and the render dispatch are three hand-synced copies of web logic with an explicit "keep in sync" comment but no guard test comparing them to web's list; drift is silent by construction (the fabricated-panel class).
- chat-session.tsx is a 930-line component carrying transport, recovery, queueing, persistence, and layout; the pure parts are extracted and tested, but the effect web (refs mirroring state: queuedRef, archivedRef, sendRef, messagesRef) is intricate and only regex-tested.
- `queueLearningReview` and `apiPath` duplicate bearer-fetch plumbing inline rather than a shared authorized-fetch helper.
- Today greeting expression (index.tsx:92-94) relies on `??`-then-ternary precedence; correct but fragile to edit.
- Recovery queries `conversation_messages` with `channel = "web"` (turn-recovery.ts:87); if the server ever labels mobile sessions differently, recovery silently dies (fail-soft null).
- No rate limiting or debounce on Send; `onSubmitEditing` plus the button can double-send only as a queue (acceptable), but suggestion chips can fire mid-recovery into the queue invisibly below the fold.
- OTA gate is typecheck-only: a red mobile test suite ships to production phones on the next merge to main.

## 10. Missing for a paying-customer flow (the launch gap list)

1. **Onboarding**: none native. Every empty state punts to the web browser, signed out, with no token handoff and no return deep link. A brand-new App Store install cannot become a set-up family without leaving the app and re-authenticating twice.
2. **Paywall / subscription**: zero billing surface. No IAP (no react-native-purchases/StoreKit anywhere in package.json), no entitlement or trial-state check, no wall when the web-side signup paywall or report lock would gate the same family, no "manage subscription" link. The app never knows whether the family is paying. Apple will also expect digital-service subscriptions started in-app to use IAP; today the app simply routes to a web flow containing pricing, which is a 3.1.1 review risk in the other direction.
3. **Push notifications**: no expo-notifications, no token registration, no permission prompt, no config plugin (README.md:69 confirms). Morning briefs, offer fulfillment, agent-job completions, and Friday letters have no native delivery channel.
4. **Camera / photos**: no expo-camera or image picker; chat is text-only while the web supports attachments and the photo tools exist server-side. The mobile parity plan's camera item is unbuilt.
5. **Deep links**: scheme `homa` is registered but the only consumed link is the OAuth callback captured inside `openAuthSessionAsync`. No route handling for `homa://...` app content, no iOS Universal Links (`associatedDomains` absent from app.json), so emailed report links, drip links, and web punts can never return into the app.
6. **Account deletion**: absent, while Apple/Google sign-in creates accounts. Guideline 5.1.1(v) blocker for review.
7. **Settings**: no settings screen at all. Sign out hides in the Family tab; no profile edit, no child edit/remove, no notification prefs, no legal/privacy/ToS links, no support contact, no app version display.
8. Also absent: password reset, dark mode, iPad support, landscape, localization (all copy hardcoded en-US, transcript-days.ts:40 hardcodes "en-US"), analytics for screen views beyond chat turns, in-app review prompt, crash reporting (no Sentry or equivalent anywhere).

## 11. src/lib/web-links.ts behavior

The entire file is one helper: `openWebOnboarding()` opens `${EXPO_PUBLIC_API_URL}/onboarding` (production: `https://thankshoma.com/onboarding`) via `Linking.openURL` in the system browser. It is invoked from four places: signin.tsx:228 ("New to Homa? ... Open onboarding"), index.tsx:79 (no-family Today state), chat.tsx:96 (setup-incomplete chat state), family.tsx:94 and the family-null fallback copy. Flows that punt to web today: account creation, all of onboarding, family profile completion, and by omission everything in §10 (billing, reports, planner, settings). No auth token, family id, or return URL is carried; the browser session is cold. Since 2026-07-28 that destination sits behind the card-upfront signup paywall, so the app's most prominent new-user button now lands on a payment-bearing web flow.
