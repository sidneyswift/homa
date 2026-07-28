# Staff product design review: Homa iOS app

Reviewer lens: staff product designer, category-defining consumer iOS apps. Evidence: the seven simulator screenshots (read as images), the 2026-07-28 walkthrough, the mobile code map, the web surface map, the 2026 UX bar (07-research-ux-trends.md), onboarding and paywall research, the Apple-rules decision memo (v1 web-subscription-only), and the design system (`docs/homa-design/readme.md`, `DESIGN.md`). All recommendations use Homa's existing token language. Project laws honored throughout: no em dashes, "Homa" never "HOMA", sentence case, reassure-before-inform, no red or "behind" framing, never compare siblings, no fabricated social proof, no streak or guilt mechanics, clarity beats personality.

## 0. Overall verdict

The app is a brand-correct skeleton. Token discipline is genuinely good: cream `--bg-page` (#FBF7F0), white cards at `--radius-lg`, clay `--clay-500` pills, the real bounced `Logo`, Schibsted headlines, Hanken body. Nothing on screen violates the palette. What is missing is everything that makes a 2026 iOS app feel alive and trustworthy: information on the Today tab, receipts for what the agent does, motion, haptics, settings, a first-run, and any acknowledgment of the subscription relationship. Judged against the mid-tier tells in 07-research-ux-trends.md §3.3, the app currently hits five of seven: opaque custom tab bar, silence during long turns, zero haptics, no presence outside the binary, and (untested but near-certain) Dynamic Type fragility. The good news: the spine (streaming chat with real family memory) already works and is better than most of the category. The design job is to build the body around a working nervous system.

---

## 1. Screen-by-screen critique

### 1.1 · 01-home-today.png (Today tab)

**What works**
- The brand read is instant and correct: cream page, real `Logo` lockup top-left, warm near-black `--text-strong` greeting in Schibsted 700, one white child card with soft warm shadow, one clay pill CTA. No token violations.
- The child card content is the right *data* (name, age, interests, focus). Homa knows the family; the surface proves it in one glance.

**What fails**
- **The tab lies.** It is named Today and contains nothing temporal: no date, no plan, no material, no note from Homa, nothing that changes day to day. Roughly 60% of the viewport is empty cream below the CTA. The design system's calm is "airy," not "vacant"; an empty scroll on the home tab of a daily-use product reads as abandonment, and it fails checklist item D1 (first signed-in paint shows today's state and one suggested action).
- **Hierarchy inversion.** The largest text on screen is "Hi App." (a greeting carrying zero information), while the only actionable content (the child card) is visually inert: card affordance with no chevron, no press state, no destination.
- **Label-colon voice violation.** "Into: dinosaurs" and "Working on: math" are database fields wearing a card. The copy kit's law is "name the child, name the win" in warm sentences: "Maya's into dinosaurs and working on math" is the same data in Homa's voice.
- **The CTA duplicates the tab bar.** "Talk to Homa" mid-screen does what the Chat tab does. A primary button should earn its position by doing something the chrome cannot.
- **Zero motion.** No entrance stagger, no press feedback beyond the default, nothing living.
- The floating gear (Expo dev menu) overlaps content; dev-only, but it also proves no one has audited the safe-area/overlay stack.

**Redesign direction (tokens named)**
Top to bottom, one scroll column, `--space-5` gutters:
1. **Header row:** date eyebrow in `label-caps` (Hanken 0.75rem, tracking 0.06em, `--text-muted`): "Tuesday, July 28". Below it the greeting, Schibsted 600 at `--text-2xl`: "Good morning, Sarah ☀️" (copy-kit form, one emoji max). The `Logo` moves into a compact nav treatment (see §6 on chrome); the home tab does not need the full lockup and a greeting.
2. **"A note from Homa" `Callout`:** the design system's named presence pattern, white card, clay accent, one or two sentences generated from real state: "Maya was flying through subtraction yesterday. A lighter day is still a good day." This is the reassure-before-inform slot, refreshed daily.
3. **Today's plan block:** the backend already has `plans` and `plan_activity_schedule`. Render 2-4 activity rows per child as check-off rows: 28pt circle (1.5px `--border-default`), activity title Hanken 500, subject as a soft tinted chip (sage tint for "on track" contexts, never a colored left border). The check-off IS the signature interaction (§5). If two children, two separately labeled groups, never a shared ranking or any cross-child metric.
4. **Latest making:** one `MaterialCard` (already built) showing the most recent printable with its preview thumbnail. Tapping opens the PDF.
5. **One offer, never a command:** a single ghost-pill row: "Want a fresh worksheet for today?" routed into chat with the message pre-composed. This replaces "Talk to Homa" with a reason to talk.
Empty variant: see §4.6.

### 1.2 · 02-chat-empty.png (chat empty state)

**What works**
- The three suggestion chips are real intents, and the third ("We had a rough morning, help me reset") is the emotional job of the product in nine words. Keep it forever.
- Placeholder copy "Tell Homa about your day..." is correct voice.
- This is already the strongest empty state in the app: the assistant mid-gesture, per the 2026 convention (research §2.5).

**What fails**
- **Dead vertical field.** The greeting block floats at 40% height with nothing above it; the header repeats the full `Logo` (third brand impression in two taps). Brand overexposure where child context would serve better.
- **Chips are centered stacked pills**, which reads as a menu, not as conversational suggestions. They are also generic; the system knows Maya exists.
- **Composer:** "Send" as a text-label pill in a washed clay tint reads disabled even when enabled. 2026 convention is a 36-44pt circular icon button (arrow-up) that fills `--clay-500` when the field has content. No dictation affordance, no attachment affordance (web has both; even if v1 omits them, the composer layout should reserve the slot so the family resemblance holds later).

**Redesign direction**
- Header: small character mark + "Homa" wordmark at reduced scale, or the child-context pill (matches web's kid switcher) once per-child focus ships.
- Greeting block top-third: "Hi Sarah, I'm Homa." Schibsted 600, subline Hanken `--text-body`.
- Chips: left-aligned, wrap layout, personalized: "What should Maya work on this week?", "Make a worksheet for today", "We had a rough morning, help me reset". Chip = existing `Chip` component: pill, white fill, `--border-default`, press scale 0.98 with `selectionChanged` haptic.
- Composer: `--radius-md` field, circular send icon-button, 44pt hit target, sits on the glass chrome layer (§6).

### 1.3 · 03-chat-reply-text.png (streaming reply)

**What works**
- The reply itself is excellent product: specific, family-aware, offer-shaped ending. Typography is legible (Hanken, generous leading). White assistant card on cream is the right figure-ground.

**What fails**
- **Wall-of-text bubble.** One 1,200-word card, full width, four paragraphs, no internal hierarchy. The agent's own structure (math / phonics / writing / offer) is begging for typographic rhythm the renderer flattens.
- **The offer is prose.** "If you want, I can turn any of these into an actual printable: a dinosaur-themed math page, that sh/ch/th word strip..." Those are three tappable actions rendered as a paragraph. Every agent offer that enumerates options should end the message with suggestion chips (the web prompt-suggestion rail's mobile twin). This is the single cheapest conversion lever in the transcript.
- **Streaming feedback is a web idiom:** a thin orange progress bar at the top of the screen. Native expectation is in-thread: a small assistant bubble with a three-dot breathing indicator, then token streaming into place (checklist B3).
- **No message affordances:** no copy, no thumbs (checklist B7), no retry surface on the message itself.
- **"Start a new chat"** is a bare centered text row under the composer: a destructive action (kills the only thread) styled as a caption. It needs to move into a header overflow menu with a confirm, in Homa's voice ("Your conversation is safe in Homa's memory; this just starts a fresh page").

**Redesign direction**
- Bubble max width 88%, `--radius-lg` with the corner nearest the sender at `--radius-sm` (subtle tail), paragraph spacing `--space-3`, headings within messages rendered as Hanken 600 (the tiny markdown renderer already parses headings; style them).
- Offer chips: when the assistant message ends in an enumerated offer, render up to three `Chip`s beneath the bubble. (Deterministic v1: the agent can emit them via the existing suggestion machinery; do not regex-mine prose.)
- Long-press on a bubble: native context menu (copy, helpful / not helpful).

### 1.4 · 04/05-chat-planner-*.png (the dead end)

These two screens are the most important in the pack, and the failure is not visual. The brand-perfect bubbles are politely narrating a wall: Homa tells a phone user to go find "Maya's progress report page," a surface that does not exist on the phone, then says "I can't build that plan for her from here." In one exchange the product breaks its own promise ("Homa's got the rest") and violates checklist E4's spirit: the UI implies a path that is not there.

**Design ruling this demands**
1. **Channel honesty is a design surface.** Until native planner/progress surfaces exist, the agent's mobile instructions must offer only what mobile can deliver (a worksheet now, a plan built and confirmed in chat, or nothing plus the truth). The second screen's fallback offer ("or I just make a math worksheet for Wednesday?") is exactly right; it should have been the lead.
2. **A handoff needs a handoff card.** When a web surface is genuinely required, render a dedicated card, not prose: white card, sky `--info` tinted icon slot, title "This one lives on the web for now", body one sentence, and a button that deep-links with session context, not a cold browser punt. Never let the model describe buttons on pages the user cannot see.
3. Long term the answer is the render-by-kind port (§3): `open_planner` renders a native week-strip card, `edit_plan` renders a receipt chip, and this conversation ends in a scheduled Wednesday instead of an apology.

### 1.5 · 06-family.png (Family tab)

**What works**
- Card stack order is right: family, then child, correct tokens throughout.

**What fails**
- **A permanently expanded raw form is furniture.** "Add a child," an occasional task, occupies more screen than the family itself, forever. Forms are moments, not residents.
- **Birth year / month / day as three free-text fields** is the least native moment in the app. iOS has had a wheel date picker since 2007; parents know their child's birthday by feel on that wheel.
- **Ghost text uses a real child's name** ("Maya" as the Name placeholder) which reads as pre-filled data, a genuine confusion risk when the family already has a Maya.
- **"Into (optional, comma-separated)"** is developer grammar. Parents do not think in CSV. The design system has `Chip` for exactly this.
- Child cards are dead ends: no edit, no profile, no photo, no chevron. The gear overlaps the family card. Sign-out lives here (see 1.6).

**Redesign direction**
- Child rows become navigable: 44pt min height, avatar circle (photo or initial on a soft tint), name Schibsted 600, age in `--text-muted`, chevron. Destination: a child sheet (`--radius-xl` modal) with editable interests as chips, working-on, birthday, photo.
- "Add a child" collapses to one secondary pill button that opens a modal sheet: Name field, native `DateTimePicker` (spinner style), interest chips with a free-text add, "Working on" field. Save button pinned above the keyboard.
- Family card gains its own edit affordance and, later, the co-parent invite entry point.

### 1.6 · 07-family-signout.png (account rump)

"Signed in as sswift+homatest@..." plus a Sign out pill at the bottom of a content tab is where accounts go to hide. There is no settings screen, no account deletion (guideline 5.1.1(v) blocker: the app creates accounts via SIWA/Google), no legal links, no support contact, no notification preferences, no subscription state, no version string. This is not a redesign item; it is a missing surface, specified in §4.4.

---

## 2. Missing surface: first-run and onboarding

Per the Apple-rules memo, v1 is web-subscription-only and the app's v1 job is existing subscribers. That splits first-run into two designs: the v1 subscriber re-entry (ship now) and the native intake for new users (spec now, ship when the entitlement question is settled). Both below.

### 2.1 v1: the subscriber's first run

1. **Splash:** the animated launch moment already prototyped in `ui_kits/mobile-app/splash.html`: the character mark's squash-and-bounce landing, the one sanctioned bounce in the whole system. 900ms, once, respects Reduce Motion (static mark).
2. **Sign-in screen (polish, not rebuild):** full-bleed cream. Top half: `Logo` lockup, headline Schibsted 700 "Homeschooling, made calm.", one warm lifestyle photo in a blob mask (`--blob-2`, one playful device for this surface). Bottom half: SIWA button first (Apple's black style, pill), Google second (white pill, `--border-default`), "Sign in with email" as a text link. "New to Homa?" row routes to web with honest copy: "Homa families start on the web today. We'll be right here after."
3. **First signed-in paint = D1:** never a generic dashboard. The Today screen (§1.1) opens with the family already present: "Good morning, Sarah ☀️", Maya's card, a note from Homa that references actual recent activity from the shared brain ("That sh/ch/th word strip is in your binder whenever you want it"). Cross-channel memory is Homa's single most differentiating first impression; spend it in the first five seconds.
4. **Permission prime:** not at launch. After the first felt win (first check-off or first material opened), per §4.7.

### 2.2 v1.5: native intake for new families (design ready)

The hybrid blueprint from 08-research-onboarding §10, in Homa components:

1. **Promise + soft wall:** headline "You've got this. Homa's got the rest." (accent word in clay, same Schibsted weight per the type law), SIWA one tap.
2. **Three native intake screens,** chips not chat, `ProgressBar` (sage fill) across the top for endowed progress:
   - "Who are we learning with?" child name + native birthday wheel, "Add another" repeats (never a comparison, each child a fresh card).
   - "What's on your mind most?" single-select chips: reading, math, staying on track, doing enough, something else. This is the sensitive question: put the why-we-ask microcopy directly beneath in `--text-subtle`: "This helps Homa know where to start. It never gets shared."
   - "What are they into?" interest chips per child, tap-to-toggle, playful but fast.
   These screens have zero model latency and seed the agent, killing the coldest kickoff turn.
3. **The chat interview takes over** for the open, emotional beats: full ChatSession with the checklist takeover card ported, quick-reply chips per turn.
4. **The artifact moment:** the morphing promise card (web's FirstMakingCard): a white card that narrates stages ("Sketching Maya's dinosaur math page...") then crossfades into the real `MaterialCard` preview. This is the wow the category cannot match; every earlier screen exists to reach it faster.
5. **Notification prime immediately after** (§4.7), then the entitlement gate in whatever form the PM lands (StoreKit trial or neutral web state). The paywall-anatomy research (single screen, benefit-led CTA, transparent renewal terms near the button, zero testimonials until real customers exist) is ready when that decision is.

---

## 3. Missing surface: chat tool-result cards (the never-silent contract)

Mobile renders 10 tool outputs; the fleet has ~62 tools and web renders 23. Everything else is silence, and the model believes it rendered something (#256). This is a trust failure wearing an engineering hat, and design should set the contract:

**Rule: no tool call may render as nothing.** Three tiers:

1. **Rich cards (port these six first):**
   - `create_printable` / `show_material`: existing `MaterialCard`, upgraded: kind eyebrow in `label-caps`, title Schibsted 600, page count in JetBrains Mono, preview image at `--radius-md`, actions row = "Open the printable" primary pill sm + native share icon-button (share sheet, not Linking-only).
   - `ask_user_questions`: exists, keep.
   - `manage_child_progress`: receipt chip + the question/conflict card variants from web when interactive.
   - `open_planner` / `edit_plan` / `schedule_plan_activity`: a week-strip card: seven mini columns Mon-Sun, activity dots in clay, the touched day highlighted with a soft sage tint, caption "Math · Wednesday morning". Ends the planner dead end of §1.4.
   - `score_child_report`: the report-reveal card (this is onboarding-critical).
   - `start_first_making`: the morphing promise card (§2.2.4).
2. **Receipt chips for every mutating tool** (`log_hours`, `add_family_event`, `remember`, `mark_material_final`, etc.): a small inline pill, sage check glyph, Hanken 500: "Logged 1h 30m for Maya", "Noted". These are checklist E2's receipts: the agent shows what it did.
3. **Generic fallback for everything unmapped:** a quiet stone-tinted chip: "Homa used {plain-word label}" with the existing `workedForSteps` vocabulary. Ugly-proof, silence-proof, and it makes future tool additions safe by default.

Structural rules to copy from web or transcripts corrupt: `ENDS_THE_TURN` suppression for `ask_for_details` / `start_checklist`, docked-card suppression, one-active-card rule, hidden-directive suppression.

---

## 4. Missing surfaces: the rest of the v1 body

### 4.1 Settings
Reached from a gear/avatar in the Today header (and the Family tab keeps a link). Grouped white cards at `--radius-lg` on cream, iOS grouped-list rhythm, Hanken 500 labels, chevrons:
- **Account:** email row · "Your Homa plan" row (§4.2) · Sign out · Delete account (the 5.1.1(v) requirement: full deletion, confirm sheet in Homa's voice: reassure first, "This removes your family's information from Homa", then the destructive confirm in `--danger` warm coral-red, its one legitimate use).
- **Family:** shortcuts to child sheets, family details.
- **Notifications:** master toggle + "Morning note" time picker (once push ships).
- **Support:** contact, privacy policy, terms, version + build string set in JetBrains Mono `--text-2xs`.

### 4.2 Subscription-info state (Option A, non-merchandised)
One card, deliberately boring, exactly as the decision memo prescribes:
- Active: title "Your Homa plan" Schibsted 600 · `Badge` in sage tint "Active" · body Hanken: "Your subscription is managed on the web at thankshoma.com."
- Trial: same card, body "Your free week runs through Friday, August 1." No countdown urgency theatrics.
- Expired: reassure before inform, never a wall: "Your family's information is safe. Your plan is paused." + one plain text link "Manage your plan on the web" (US storefront allowance; keep it a link, not a merchandised button, no pricing anywhere in the app).

### 4.3 Today screen
Specified in §1.1. It is listed again here because it is genuinely a missing surface, not a weak one: nothing on the current tab changes when the day does.

### 4.4 Empty states (every one in Homa's voice, one action each)
- Today, no plan: `EmptyState` with the character mark, "Nothing planned yet, and that's fine. Want me to sketch a light day for Maya?" → one pill: "Sketch today".
- Family, no children: "Tell me who we're learning with." → "Add a child".
- Binder (when ported): "Maya's finished pages will collect here. Make the first one?" → routes to chat with the message pre-composed.
- Error states keep the existing law: your work is safe first, then the fix, plus an actual Retry button (Today currently has retry-by-tab-switching, which is not a control).

### 4.5 Loading and streaming states
- **Skeletons, never spinners past one second:** `Skeleton` shimmer in warm stone-100/stone-200 (never gray) shaped like the card it becomes: Today loads as a greeting bar + two card blocks.
- **Typing indicator:** three 6pt dots in a small assistant bubble, 1.2s breathing loop; under Reduce Motion, a static "Homa is thinking" line in `--text-muted`.
- **Tool status:** extend the busy-label vocabulary to all tools (plain-word labels exist in web's `workedForSteps`); show the current label under the typing bubble: "making the worksheet...". After the turn, the collapsible "Worked for 12s" fold-out, tap to expand steps.
- **Material generation is theater time:** the morphing promise card narrates stages instead of leaving dead air (already the web pattern; port it, do not reinvent it).

### 4.6 Permission priming
- **One permission per session, always after a value moment, never at launch.**
- Notifications: a pre-prompt sheet (`--radius-xl`, character mark, one playful `Doodle` max) seconds after the first artifact or first check-off: title "Want to know when Maya's next page is ready?", body one sentence, buttons "Yes, tell me" (clay pill, fires the system prompt) and "Maybe later" (ghost, costs nothing, re-askable). Child-named promise, per the 2-3x priming evidence.
- Camera/photos: only at the moment a photo feature is first touched, framed by the task ("Add a photo of Maya's work").
- No ATT prompt in v1 (no tracking), which keeps the permission budget clean.

---

## 5. Motion and haptics spec (Reanimated 4.3.1 is already in the tree)

Homa's motion law: gentle and quick, no bounce in UI (splash excepted), `--ease-out` = cubic-bezier(0.22, 0.8, 0.28, 1), hovers/presses ~120ms, entrances 200-320ms. Every animation ships with a Reduce Motion branch (fade-only). Build these seven, in order of felt value:

| Moment | Motion | Haptic |
|---|---|---|
| **Check-off (the signature)** | Circle fills sage with a 350ms pop (scale 1 → 1.15 → 1 spring), gold star floats up and fades over 800ms (`--gold`, ink rules N/A at this size), title quiets to strike-through. Undoable inline, never a modal, never confetti. | `impactLight` on touch-down, `notificationSuccess` on fill |
| Send message | User bubble enters with 250ms translateY(8) + fade; composer icon-button does a 120ms press scale 0.98 | `impactLight` |
| Streaming | Container height animates via layout transitions (no scroll thrash, checklist B5); no per-token jitter | none |
| Artifact ready | Promise card crossfade + scale 0.97 → 1 over 320ms into `MaterialCard` | `notificationSuccess` |
| Chip select | 120ms fill tint | `selectionChanged` |
| Tab change | None (native tab bar handles it) | `selectionChanged` |
| Error banner | 200ms fade-in, no shake (shake is scold-shaped; Homa reassures) | `notificationWarning`, once |

Explicitly banned: streak flames, day-counter celebrations, inactivity nudges, any red pulse, sibling leaderboards. The check-off and the artifact reveal are the only two celebration moments v1 needs; a celebration is a receipt, never a verdict.

## 6. Liquid Glass: where iOS 26 wins and where the brand overrides

**Adopt (chrome layer, native components only):**
- **Tab bar:** migrate from the hand-styled opaque JS `Tabs` (the #1 mid-tier tell, confirmed at `apps/mobile/src/app/(tabs)/_layout.tsx`) to `expo-router` NativeTabs: real `UITabBarController` glass, auto-minimize on scroll, free Reduce Transparency handling. Cost: the custom brand-geometry SVG tab icons give way to SF Symbols (house, message bubble, two-person). Pay it. Brand lives in the content layer; chrome that fights the OS reads as old, and warm cream scrolling behind warm-tinted glass will look like Homa anyway.
- **Headers:** scroll-edge effect on Today and Chat via native stack options; content slides under translucent chrome.
- **App icon:** author the layered `.icon` in Icon Composer from `assets/brand/homa-app-tile-2048.png` layers (cream ground, clay house mark) so dark/tinted/clear renditions are real, not flattened PNG.
- **Composer bar:** the one custom chrome piece worth a `GlassView` (`expo-glass-effect`, `glassEffectStyle: 'regular'`, warm tint), with the plain-View fallback below iOS 26. Never stack it on other glass.

**Override (content layer, brand wins):**
- Cards, bubbles, sheets, and every content surface stay opaque white on cream. Glass never touches content (the canonical mistake per the gallery analysis, and Homa's legibility-for-tired-parents value makes the NN/g readability critique binding here).
- Color, type, radius, shadow: all Homa tokens, no systemGray anything, shadows stay warm brown, focus stays clay.
- Dark mode: the app is pinned light today. Acceptable for launch month, but iOS 26 users in dark mode see a stark light rectangle at 9pm, and the DS already has the "quiet evening" navy theme (`tokens/dark.css`). Schedule the dark canvas as fast-follow, designed, not inverted.
- Accessibility floor before ship: Dynamic Type through the accessibility sizes on Today and Chat, VoiceOver labels on the composer and check-off, WCAG AA over the glass composer, 44pt targets everywhere (the current "Start a new chat" text row fails this today).

## 7. Ranked recommendations (leverage order)

1. **Never-silent chat.** Generic fallback receipts for all unmapped tools + the six rich cards (material, planner week-strip, progress, report reveal, first making, questions) + channel-aware agent copy with a designed handoff card. Chat is 70%+ of use and the current silence class is the trust ceiling on everything else.
2. **A Today that shows today.** Date + greeting, note from Homa, plan rows with the sage check-off signature interaction, latest making, one offer. The data all exists server-side; this is the cheapest transformation of "brand-correct skeleton" into "daily companion," and it creates the value moments the notification prime needs.
3. **The accountability chrome: settings + account deletion + neutral plan state.** One grouped-list screen unblocks App Review (5.1.1(v)), gives the subscription a legible home under the web-only model, and gives sign-out a dignified address.
4. **First-run warmth for subscribers now, native intake spec for new families next.** Splash bounce, SSO-first sign-in polish, and a first paint that proves cross-channel memory in five seconds; the chips-then-chat intake with the artifact moment and post-artifact notification prime is fully specified and waits only on the entitlement decision.
5. **Platform citizenship pass.** NativeTabs glass chrome, layered app icon, scroll-edge headers, the seven-moment motion/haptic system, Dynamic Type and VoiceOver floor. This is the difference between "ported" and "native," and in mid-2026 the Liquid Glass lane is still open enough for a small team to stand out.
