# iOS app design, July 2026: Liquid Glass, UX trends, and the world-class bar

Research report for the Homa iOS App Store launch planning fleet. Web research conducted 2026-07-28. All claims cited. Where a claim could not be verified across sources, that is stated explicitly.

---

## 1. Apple's current design language: iOS 26 Liquid Glass

### 1.1 What it is

Liquid Glass is Apple's largest visual redesign since iOS 7 (2013), announced at WWDC June 2025 and shipped with iOS 26 in September 2025. It is a dynamic material system, not a theme: UI chrome (tab bars, toolbars, navigation bars, modals, Control Center) renders as translucent glass that refracts and reflects the content behind it, adapts its tint to content and light, and responds to motion. Navigation elements float above content instead of sitting flat on it. The language is unified across iOS, iPadOS, macOS, tvOS, watchOS, and visionOS. Sources: [Kodeco intro](https://www.kodeco.com/49905345-an-introduction-to-liquid-glass-for-ios-26), [QicApp explainer](https://medium.com/@qicapp/liquid-glass-in-ios-26-apples-stunning-new-design-language-explained-1e6ef19e1bc7), [Donny Wals on custom UI](https://www.donnywals.com/designing-custom-ui-with-liquid-glass-on-ios-26/).

Key material facts a design team needs:

- Two variants: `regular` (adaptive, legible, the default for most chrome) and `clear` (more transparent, for media-rich backgrounds). Both take a tint color and an interactive state. This variant pair is mirrored exactly in the RN/Expo APIs (section 4).
- Adjacent glass elements are meant to be grouped in a `GlassEffectContainer` so they merge and split fluidly rather than stacking blur on blur. Glass on glass is the canonical mistake ([byteiota migration guidance](https://byteiota.com/liquid-glass-ios27-mandatory/)).
- Glass belongs to the navigation/chrome layer, never to the content layer. Apple's own showcase apps keep content opaque and let it scroll behind translucent chrome ([Liquid Glass gallery analysis](https://apple.gadgethacks.com/news/apple-liquid-glass-developer-gallery-explained-adoption-gaps-and-wins/)).
- App icons moved to a layered `.icon` format authored in Apple's macOS-only Icon Composer app: JSON-described layers with refractive effects, plus system-generated dark/tinted/clear renditions. Static PNG icons look flat next to them ([Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)).
- Rebuilding with Xcode 26 gives system controls (tab bars, toolbars, sheets, alerts) the glass treatment automatically; custom-drawn chrome does not update itself and is where apps look broken or dated.

### 1.2 The adoption timeline and what is actually mandatory

Verified timeline (multiple sources agree):

| Date | Event |
|---|---|
| Sept 2025 | iOS 26 ships with Liquid Glass. Apps built with Xcode 26 get it on system controls automatically. `UIDesignRequiresCompatibility = YES` in Info.plist opts an app out (Apple describes the flag as a temporary compatibility measure) |
| Nov 2025 | Apple launches the Liquid Glass developer gallery plus HIG updates, APIs, and an in-person Cupertino event to push adoption |
| June 8, 2026 (WWDC 2026) | iOS 27 beta ships. Building with the iOS 27 SDK, `UIDesignRequiresCompatibility` is ignored. iOS 27 also adds a user-facing opacity slider for Liquid Glass after a year of readability complaints |
| ~April 2027 | App Store begins requiring builds with the iOS 27 SDK (Apple's usual annual SDK floor). At that point the opt-out provides zero protection and every updated app renders Liquid Glass whether designed for it or not |

Sources: [Donny Wals on the opt-out](https://www.donnywals.com/opting-your-app-out-of-the-liquid-glass-redesign-with-xcode-26/), [byteiota "act before April 2027"](https://byteiota.com/ios-27-makes-liquid-glass-mandatory-act-before-april-2027/), [byteiota migration article, June 3, 2026](https://byteiota.com/liquid-glass-ios27-mandatory/), [Mehmet Baykar on the Info.plist key](https://mehmetbaykar.com/posts/opt-out-of-liquid-glass-with-one-infoplist-key/), [DevelopersIO iOS 27 migration prep](https://dev.classmethod.jp/en/articles/ios27-xcode27-migration-preparation-guide/).

Caution on one circulating claim: a Medium article asserts "Apple requires all iOS apps to fully support Liquid Glass by September 2026" ([expertappdevs](https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b)). No primary source confirms a September 2026 requirement. The verified forcing function is the April 2027 SDK floor. Treat September 2026 (iOS 27 GM) as the date the default flips for anyone building on the newest SDK, not as an App Review deadline.

App Review specifically: there is no evidence App Review rejects apps that have not adopted Liquid Glass in July 2026. The pressure is (a) the SDK floor above, (b) editorial/featuring visibility, and (c) user perception, because after ten months of iOS 26 an opaque custom tab bar reads as "old app." The 2026 Apple Design Awards made the signal explicit: Moonlitt won the Interaction category for "best-in-class Liquid Glass integration" and Tide Guide won Visuals and Graphics partly on its Liquid Glass work ([Apple newsroom, June 2, 2026](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)).

### 1.3 Actual adoption state: an open lane

Adoption across the App Store is thin. Apple's own gallery showcases only about a dozen apps out of millions (CNN, Crumbl, OmniFocus 4, Slack, Tide Guide, American Airlines, Sky Guide, Lucid Motors), Apple itself lagged on its own apps into late 2025, and observers expect the transition to take years ([gallery analysis](https://apple.gadgethacks.com/news/apple-liquid-glass-developer-gallery-explained-adoption-gaps-and-wins/), [Rahul Roy on the gallery](https://rethinkwithroy.medium.com/apples-liquid-glass-gallery-is-a-showcase-of-12-apps-in-a-store-of-millions-7be2b1e7d830), [AppleInsider](https://appleinsider.com/articles/25/09/16/be-patient-even-apple-is-behind-on-its-own-liquid-glass-redesign)). PM implication: in mid-2026 a small team that adopts properly still stands out, and the cost of not adopting compounds until April 2027 makes it involuntary.

What the showcased apps share (the concrete "done right" pattern set):

1. Bottom-anchored navigation with content scrolling behind translucent chrome (scroll edge effects).
2. Native system controls instead of custom-drawn replacements.
3. Content-first layouts: imagery and information dominate, chrome recedes.
4. Glass reserved for the floating chrome layer; content stays opaque and legible.
5. Coherence across platforms where the app spans them.

### 1.4 The readability backlash, and what users now expect

Liquid Glass triggered a sustained usability controversy that a parent-facing app must design around:

- Nielsen Norman Group published "Liquid Glass Is Cracked, and Usability Suffers in iOS 26" (Oct 2025): controls over noisy backgrounds, jittery animated buttons, shrunken crowded tab bars, a "restless" interface that pulls focus from content ([NN/g coverage summary](https://anderegg.ca/2025/10/12/nielsen-norman-group-on-ios-26-usability), [vowe.net](https://vowe.net/2025/10/20/liquid-glass-is-cracked/)).
- Tens of thousands of complaint threads; common user fixes are Reduce Transparency, Increase Contrast, and Reduce Motion ([OS X Daily tips](https://osxdaily.com/2025/09/17/tips-improve-liquid-glass-ios-26-look-legibility-iphone-ipad/), [Apple developer forums thread](https://developer.apple.com/forums/thread/811219)).
- Apple responded incrementally: iOS 26.x added a Clear vs Tinted system toggle ([BGR on iOS 26.2](https://www.bgr.com/2070522/ios-26-2-fixed-liquid-glass-new-settings-options/), [Notebookcheck on the 26.1 toggle](https://www.notebookcheck.net/iOS-26-1-beta-lets-you-adjust-the-Liquid-Glass-transparency-with-a-new-toggle.1143296.0.html)), and iOS 27 ships a full opacity slider ([TweakTown, June 2026](https://www.tweaktown.com/news/112090/apple-is-adding-a-liquid-glass-slider-in-ios-27-after-a-year-of-user-complaints-about-readability/index.html)).

Testable consequence: a 2026 iOS app must look intentional under every combination of Reduce Transparency, Increase Contrast, Reduce Motion, Clear vs Tinted system glass, light and dark mode. A meaningful share of the parent audience runs with transparency reduced. Native glass components degrade gracefully automatically; hand-rolled blur views do not.

---

## 2. 2026 mobile UX trends that matter for a parent-facing education/assistant app

### 2.1 AI-native product shape

The consensus across 2026 trend literature: winning apps feel designed for AI rather than retrofitted with a chatbot tab. Conversational and natural-language interaction are primary patterns; agentic UX (the system takes initiative) shifts the design center from buttons and menus to trust, control, and transparency ([UXPin 2026 trends](https://www.uxpin.com/studio/blog/ui-ux-design-trends/), [groovyweb AI app trends](https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026), [TechMagic](https://www.techmagic.co/blog/mobile-app-design-trends)). Gartner forecasts 30% of new apps using AI-driven adaptive interfaces by 2026 and chatbots handling 70%+ of initial interactions by 2028 ([eleken generative UI guide](https://www.eleken.co/blog-posts/generative-ui), [fuselab chatbot guide](https://fuselabcreative.com/chatbot-interface-design-guide/)).

Generative UI has settled into three named patterns ([CopilotKit developer guide](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026), [eleken](https://www.eleken.co/blog-posts/generative-ui)):

1. **Static**: the client owns a catalog of typed components; the agent only selects one and fills it with data.
2. **Declarative**: the agent returns a structured UI spec; the client renders it within its own design constraints.
3. **Open-ended**: the agent returns a free-form surface; consistency and safety are traded for flexibility.

Consumer-grade apps overwhelmingly use static or declarative, which keeps brand, accessibility, and safety in the client. This maps directly onto Homa's existing render-by-kind contract direction in the mobile parity plan: the industry has converged on the same architecture.

### 2.2 Conversational/streaming UX conventions (the 2026 baseline)

These are now conventions users notice by their absence, compiled from [thefrontkit AI chat UI best practices (Feb 15, 2026)](https://thefrontkit.com/blogs/ai-chat-ui-best-practices), [parallelhq chatbot UX patterns](https://www.parallelhq.com/blog/chatbot-ux-design), [thefrontkit streaming UI](https://thefrontkit.com/blogs/what-is-streaming-ui-in-ai-applications), [groovyweb 12 UI mistakes](https://www.groovyweb.co/blog/ui-mistakes-ai-apps-2026):

- **Token streaming is the baseline**, with a visible stop button during generation and retry/regenerate without retyping. Edit-and-resubmit of a previous prompt (conversation forking) is increasingly expected.
- **Never a static spinner beyond ~1 second.** Typing indicator for conversational text; skeleton placeholder when the response will render as a structured card, table, or form.
- **Working status over silence.** Long tool calls show what the system is doing. Silence during a long turn reads as a hang (Homa has already paid for this twice: the silent-long-turn diagnosis in #170 and the mobile fabricated-panel bug #256).
- **Streaming rendering hygiene:** buffer incomplete markdown, defer code/table blocks until closed, and grow the container without layout thrash or scroll jumps.
- **Trust furniture:** provenance/citations where claims are checkable, inline thumbs feedback (category on downvote), AI-generated labeling, and context transparency (what the assistant is using to answer).
- **Accessibility:** live-region announcements of responses for VoiceOver, focus kept in the input during streaming, WCAG AA contrast.
- **Session management:** auto-saved history, searchable, with auto-titled conversations.

### 2.3 Motion and haptics

2026 motion language is fluid, spring-based, and morphing, in the grammar Dynamic Island established (tap for glance, long-press for expansion, swipe to dismiss). The maturation is compound gestures with distinct haptic feedback per action, so the thumb knows what it triggered before the eye confirms it, and motion paired with subtle audio cues at completion moments ([Muzli 2026 patterns](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/), [Loma motion UI trends](https://lomatechnology.com/blog/motion-ui-trends-2026/2911), [designstudiouiux](https://www.designstudiouiux.com/blog/mobile-app-ui-ux-design-trends/)).

The ADA 2026 winners show the bar: (Not Boring) Camera's haptic scroll wheels, PowerWash Simulator's distinct haptic per hose nozzle. Haptics carry meaning, they are not generic buzzes ([Apple newsroom](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/), [9to5Mac](https://9to5mac.com/2026/06/02/apple-reveals-apple-design-awards-app-and-game-winners-for-2026/)). All motion must respect Reduce Motion.

### 2.4 Personalization and adaptive surfaces

Home surfaces that reorganize around actual usage (Spotify's shelves, Google Maps' commute vs explore modes) are the reference pattern ([Muzli](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)). Onboarding personalization: collect a small amount of clean signal early, route flows with it, pre-populate everything inferable ([Formbricks onboarding practices](https://formbricks.com/blog/user-onboarding-best-practices), [Appcues examples](https://www.appcues.com/blog/best-user-onboarding-examples)). For Homa the family context is the personalization asset: a world-class version shows the children by name, current plan state, and today's relevant action on first paint, never a generic dashboard.

### 2.5 Empty states and onboarding

Empty states are guided starting points, not blank panes: explain why the screen is empty in plain language, show sample content or a preview of the working state, and offer exactly one clear first action ([Mobbin glossary](https://mobbin.com/glossary/empty-state), [eleken empty state UX](https://www.eleken.co/blog-posts/empty-state-ux), [UserOnboard patterns](https://www.useronboard.com/onboarding-ux-patterns/empty-states/)). Progressive onboarding teaches in context at first use instead of front-loaded slide tours ([designstudiouiux onboarding](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/), [userpilot](https://userpilot.com/blog/app-onboarding-design/)). For an assistant app, the strongest empty state is the assistant already mid-gesture: a composed first message, a suggested first making, evidence of the family it already knows.

### 2.6 Trust conventions for family-facing AI (2026 specific)

The family AI assistant category got crowded in 2026 (Norton Family Assistant launched June 4, 2026 on an explicit trust platform; OpenAI is pushing ChatGPT as a family assistant), and it set user expectations: family data siloed per family, not used to train models, accessible only to authorized members, with visible controls ([Norton announcement](https://newsroom.gendigital.com/2026-06-04-Norton-Introduces-Family-Assistant,-the-Secure-AI-Agent-Built-to-Help-Families-Manage-the-Chaos-of-Modern-Parenting-in-the-Digital-Age), [eWeek on OpenAI](https://www.eweek.com/news/openai-chatgpt-family-ai-2026/)). Regulatory themes for AI plus children's data in 2026: transparency and disclosure, age assurance, parental consent, data minimization ([TrustArc 2026 guide](https://trustarc.com/resource/ai-childrens-data-2026/)). Design translation: say what the assistant did and why, make privacy posture legible in-product, and monitor for signals rather than cataloging everything (the trust-building framing in the parental-app literature: [HolaNolis](https://holanolis.com/en/blog/complete-guide-ai-parental-controls/)). Homa's existing tenancy laws are the engineering half; the launch needs the visible half.

### 2.7 Other 2026 table stakes

- **Dark mode as a designed canvas**, not an inverted light theme; dark-first color systems (Arc, Linear precedent) ([Muzli](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)).
- **Thumb-zone layout**: primary actions in the bottom third, bottom sheets for secondary content.
- **Passkeys/passwordless** as the expected auth shape (Homa already ships Sign in with Apple and Google on mobile).
- **Accessibility as a category-table-stake**: the ADA 2026 Inclusivity winner (Guitar Wiz) was cited specifically for Dynamic Type, Increased Contrast, and Differentiate Without Color support.

---

## 3. What top-tier consumer apps do that mid-tier apps do not

Two axes separate them: **platform depth** and **craft density**.

### 3.1 Platform depth (system surface presence)

The 2026 native-feature roster: Live Activities, interactive widgets, App Intents, Apple Intelligence hooks, passkeys, Dynamic Island, Spotlight indexing, CoreHaptics, privacy manifest, SwiftUI/Swift 6, Control Center controls, universal links. The framing from the trade literature: ship these and the app feels Apple, miss them and it feels ported ([Forasoft native features 2026](https://www.forasoft.com/blog/article/9-tips-to-make-ios-app-cooler-86)). Claimed retention effects (vendor-published, treat as directional): Live Activities lifting 30-day retention 18-32% at high-frequency apps, interactive widgets adding 12-18% re-entry frequency (same source).

App Intents is the leverage point: one intent definition now powers Siri, Spotlight, interactive widgets, Control Center controls, Live Activity buttons, and Shortcuts, and WWDC 2026 added streaming responses for long-running actions and multi-turn follow-ups ([Apple WWDC26 session 345](https://developer.apple.com/videos/play/wwdc2026/345/), [Blake Crosley on the iOS 26 widget surface](https://blakecrosley.com/blog/ios-26-widget-and-control-surface), [GoodRequest App Intents guide](https://www.goodrequest.com/blog/app-intents-how-to-make-your-app-more-accessible-through-siri-spotlight-and-widgets)). For an agent product like Homa, App Intents is the native analog of its tool layer: "ask Homa for today's plan" from the lock screen is a natural fit, though it requires native Swift targets in the Expo project (config plugins / native modules), which is real scope.

### 3.2 Craft density

From the ADA 2026 evidence and gallery analysis, the differentiators are: a cohesive theme carried through every screen (Tide Guide's aquatic theme), animation with narrative purpose rather than decoration, haptics tuned per interaction, distinctive identity rather than template UI, accessibility depth, and the small native behaviors (auto-minimizing tab bars, scroll edge effects, SF Symbol animations) that only show up when a team sweats defaults ([Apple newsroom ADA 2026](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/), [MacStories](https://www.macstories.net/news/2026-apple-design-awards-winners-announced/)).

### 3.3 Mid-tier tells (anti-checklist)

- Opaque custom tab bar and header chrome on iOS 26 (instantly reads pre-2025).
- Static spinners during AI work; silence during long turns.
- Zero haptics, or one generic buzz everywhere.
- Generic empty states ("No items yet").
- No presence outside the app binary: no widgets, no intents, no Spotlight, no Live Activities.
- Breaks under Reduce Transparency / Increase Contrast / large Dynamic Type.
- Cross-platform chrome that ignores platform conventions (Android-style patterns on iOS).

---

## 4. Can React Native / Expo achieve the Liquid Glass look? (state as of mid-2026)

**Yes, to a genuinely native standard for chrome and materials, with known tradeoffs.** The ecosystem converged on wrapping the real UIKit/SwiftUI materials rather than faking them with blur views.

### 4.1 The four integration paths

1. **`expo-glass-effect`** (Expo's first-party package): `GlassView` and `GlassContainer` components wrapping `UIVisualEffectView` glass. Props mirror the native API: `glassEffectStyle: 'clear' | 'regular' | 'none'` (with animate/duration config), `tintColor`, `isInteractive`, `colorScheme`. iOS 26+ only; falls back to a plain `View` on Android, web, and older iOS. Ships with the Expo SDK (install via `npx expo install expo-glass-effect`) and works in Expo Go. Runtime guards: `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()` (some iOS 26 betas lacked the API and crashed without the check). Known gotcha: setting `opacity: 0` on a GlassView or ancestor kills the glass effect entirely; use the built-in animate props or toggle `glassEffectStyle` to `'none'` instead ([Expo GlassEffect docs](https://docs.expo.dev/versions/latest/sdk/glass-effect/), [npm](https://www.npmjs.com/package/expo-glass-effect)).
2. **Expo Router native tabs** (`expo-router/unstable-native-tabs`, SDK 54+, improved in SDK 55 with SF Symbol `Icon` props and `disableTransparentOnScrollEdge`): a true `UITabBarController`, which is the only way to get the real Liquid Glass tab bar with GPU rendering, auto-minimize on scroll, SF Symbols, and automatic dark mode/accessibility behavior. Limitations: still alpha and API-unstable, no custom tab bar components, cannot mix with JS `<Tabs>` in one router, and it is buggy on Android where it offers no advantage ([Expo native tabs docs](https://docs.expo.dev/router/advanced/native-tabs/), [amillionmonkeys field report](https://www.amillionmonkeys.co.uk/blog/expo-liquid-glass-tab-bar-ios), [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55)).
3. **`@expo/ui` SwiftUI integration**: hosts real SwiftUI views for native glass modifiers and advanced transitions where the wrapped-UIKit path is not enough ([Expo blog: Liquid Glass app with Expo UI and SwiftUI](https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui)).
4. **`@callstack/liquid-glass`** (third-party alternative): `LiquidGlassView` / `LiquidGlassContainerView`, RN 0.80+, Xcode 26+, works in bare RN and Expo dev builds but not Expo Go; `interactive` cannot change after mount; automatic text color adaptation stops on views taller than 65pt; plain `View` fallback below iOS 26, with an `isLiquidGlassSupported` constant. ~1.6k stars, actively maintained ([GitHub](https://github.com/callstack/liquid-glass), [npm](https://www.npmjs.com/package/@callstack/liquid-glass)).

Plus the icon: **Expo SDK 54+ accepts Icon Composer `.icon` files** for the layered Liquid Glass app icon ([Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)).

### 4.2 Tradeoffs to plan around

- Everything glass is iOS-only: components no-op to plain views on Android/web, so the design system needs deliberate per-platform branches. The practitioner consensus is that platform-specific code is the correct price for native feel ([amillionmonkeys](https://www.amillionmonkeys.co.uk/blog/expo-liquid-glass-tab-bar-ios)).
- Native tabs are alpha; expect churn across SDK upgrades.
- Faking glass with `BlurView` hacks misses refraction, adaptive contrast, and the system accessibility fallbacks, and reads fake next to iOS 26 system chrome. Wrap the real material or do not do glass.
- Verify on physical devices: simulator rendering of glass is unreliable ([byteiota](https://byteiota.com/liquid-glass-ios27-mandatory/)).
- Respect for Reduce Transparency comes free with the native components; any custom translucency must handle it manually.
- iOS-26-adoption share of the installed base is high in mid-2026 but not total; below iOS 26 the app must still look designed, since every glass surface becomes an opaque view there.

### 4.3 Homa-specific grounding (repo facts)

- `apps/mobile/package.json`: Expo `~56.0.15`, React Native `0.85.3`, expo-router `~56.2.14`, Reanimated `4.3.1`, RN 19.2. Every path in 4.1 is available to Homa today with zero SDK upgrade work.
- `apps/mobile/src/app/(tabs)/_layout.tsx` lines 22-35: the app uses the JS `Tabs` component with a hand-styled opaque tab bar (`backgroundColor: colors.card`, custom border). This is precisely the mid-tier tell in 3.3; migrating to `NativeTabs` (or at minimum a glass treatment) is the single highest-visibility Liquid Glass move.
- No `expo-glass-effect` dependency and no `.icon` asset exist in the mobile app yet.

---

## 5. Checklist: testable qualities of a world-class 2026 iOS app

Each item is written to be verifiable on a device or in review. Grouped; ordered roughly by user-visible impact for Homa.

### A. Liquid Glass and visual platform citizenship

- [ ] A1. Tab bar is the system Liquid Glass tab bar (or true glass material), with content scrolling behind it and auto-minimize on scroll.
- [ ] A2. Navigation/toolbars use glass chrome with scroll edge effects; content layer stays opaque and legible.
- [ ] A3. No glass-on-glass stacking; adjacent glass elements merge via a container, not overlap.
- [ ] A4. App icon is a layered Icon Composer `.icon` with correct dark/tinted/clear renditions.
- [ ] A5. Builds clean against the iOS 27 SDK with `UIDesignRequiresCompatibility` absent (the flag is dead by April 2027 anyway).
- [ ] A6. Looks intentional under Reduce Transparency, Increase Contrast, Reduce Motion, Clear and Tinted system glass, light and dark.
- [ ] A7. Dark mode is designed, not inverted; brand colors validated on the dark canvas.
- [ ] A8. SF Symbols used for system-adjacent iconography so weight/rendering modes match the OS.
- [ ] A9. Verified on physical devices across at least iOS 26 and the iOS 27 beta, plus one pre-26 device for fallback rendering.

### B. Conversational/AI UX

- [ ] B1. Responses stream token-by-token; no full-response waits.
- [ ] B2. Stop button visible during generation; retry/regenerate without retyping.
- [ ] B3. No static spinner ever exceeds 1 second; typing indicator for prose, skeletons for structured cards.
- [ ] B4. Long tool operations show live working status in plain language; a turn is never silent for more than a few seconds.
- [ ] B5. Streaming never causes layout thrash, scroll jumps, or broken partial markdown.
- [ ] B6. Structured agent output renders as typed native cards (static/declarative generative UI), never raw text dumps and never invisible (the #256 fabricated-panel class is a launch blocker).
- [ ] B7. Inline lightweight feedback (thumbs) on assistant messages.
- [ ] B8. The assistant's claims about actions match reality (tool-result honesty surfaced in UI).
- [ ] B9. Conversation history persists, is searchable, and is continuous with other channels (web/SMS/voice), because cross-surface amnesia is a known trust killer (CG feedback).

### C. Motion and haptics

- [ ] C1. Spring-based, interruptible transitions; nothing linear-eases or blocks input.
- [ ] C2. Distinct haptics for distinct meanings (send, complete, error, check-off), via CoreHaptics/sensory feedback, not one generic buzz.
- [ ] C3. Key celebration moments pair motion with optional sound; all of it respects Reduce Motion and silent mode.
- [ ] C4. Gestures follow the platform grammar (swipe back everywhere, pull-to-refresh, long-press for context) with haptic confirmation.
- [ ] C5. 60fps minimum on the oldest supported device; glass surfaces GPU-rendered, no blur jank.

### D. Personalization, onboarding, empty states

- [ ] D1. First signed-in paint reflects the actual family: children by name, today's state, one suggested action.
- [ ] D2. Zero generic empty states: every empty surface explains itself and offers exactly one obvious next action, ideally pre-populated by the assistant.
- [ ] D3. Onboarding teaches progressively in context; nothing asked that the system can infer; signal collected is visibly used within the same session.
- [ ] D4. Time-to-first-value on mobile measured in seconds and tracked (the web onboarding latency work sets the precedent).
- [ ] D5. Auth is passkey-grade: SIWA and Google, no password field in the primary path.

### E. Trust (family-AI specific)

- [ ] E1. Privacy posture legible in-product: family data stays in the family, not used for training; stated where a parent will actually see it.
- [ ] E2. The assistant shows what it did and why (receipts for actions, provenance for claims about a child).
- [ ] E3. Parent controls findable in one hop from settings.
- [ ] E4. No fabricated capabilities or artifacts, ever (voice-bridge scar); UI never implies an artifact exists before it does.

### F. Platform depth (the top-tier separator)

- [ ] F1. At least one interactive widget (today's plan / streak) at launch.
- [ ] F2. Live Activity for long-running agent jobs (a making in progress is a natural fit).
- [ ] F3. App Intents exposing 2-3 core actions to Siri/Spotlight/Shortcuts/Control Center.
- [ ] F4. Push notifications with actionable categories; universal links into every shareable surface.
- [ ] F5. Spotlight indexing of family artifacts (plans, printables).
- [ ] F6. Privacy manifest accurate; App Privacy labels match reality.

### G. Accessibility (award-tier, not compliance-tier)

- [ ] G1. Full Dynamic Type support including largest accessibility sizes without clipped layouts.
- [ ] G2. VoiceOver: labeled controls, logical order, streamed responses announced politely.
- [ ] G3. WCAG AA contrast in both modes, including text over any glass surface.
- [ ] G4. Differentiate Without Color respected (no color-only state).
- [ ] G5. Hit targets 44pt minimum, primary actions in the thumb zone.

---

## 6. Notes on source quality

- Apple primary sources: newsroom (ADA 2026), WWDC26 session catalog, developer forums.
- Verified secondary: Expo official docs/changelogs/blog, Callstack GitHub, Donny Wals, byteiota (two articles, minor internal date inconsistencies; timeline cross-checked against Apple's standard April SDK-floor cadence), NN/g via multiple corroborating writeups.
- Trend-mill content (Muzli, TechMagic, UXPin, groovyweb, thefrontkit, fuselab, eleken, CopilotKit) used only for convergent patterns cited by 3+ independent pieces; single-source numbers (retention lift percentages, "93% of designers") flagged as directional.
- Unverified claim explicitly rejected: "full Liquid Glass support required by September 2026" (one Medium post; contradicted by the verified April 2027 SDK floor).

## 7. Source URL index

- https://www.kodeco.com/49905345-an-introduction-to-liquid-glass-for-ios-26
- https://www.donnywals.com/designing-custom-ui-with-liquid-glass-on-ios-26/
- https://www.donnywals.com/opting-your-app-out-of-the-liquid-glass-redesign-with-xcode-26/
- https://byteiota.com/ios-27-makes-liquid-glass-mandatory-act-before-april-2027/
- https://byteiota.com/liquid-glass-ios27-mandatory/
- https://mehmetbaykar.com/posts/opt-out-of-liquid-glass-with-one-infoplist-key/
- https://dev.classmethod.jp/en/articles/ios27-xcode27-migration-preparation-guide/
- https://apple.gadgethacks.com/news/apple-liquid-glass-developer-gallery-explained-adoption-gaps-and-wins/
- https://rethinkwithroy.medium.com/apples-liquid-glass-gallery-is-a-showcase-of-12-apps-in-a-store-of-millions-7be2b1e7d830
- https://appleinsider.com/articles/25/09/16/be-patient-even-apple-is-behind-on-its-own-liquid-glass-redesign
- https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/
- https://www.macstories.net/news/2026-apple-design-awards-winners-announced/
- https://9to5mac.com/2026/06/02/apple-reveals-apple-design-awards-app-and-game-winners-for-2026/
- https://anderegg.ca/2025/10/12/nielsen-norman-group-on-ios-26-usability
- https://vowe.net/2025/10/20/liquid-glass-is-cracked/
- https://developer.apple.com/forums/thread/811219
- https://osxdaily.com/2025/09/17/tips-improve-liquid-glass-ios-26-look-legibility-iphone-ipad/
- https://www.bgr.com/2070522/ios-26-2-fixed-liquid-glass-new-settings-options/
- https://www.notebookcheck.net/iOS-26-1-beta-lets-you-adjust-the-Liquid-Glass-transparency-with-a-new-toggle.1143296.0.html
- https://www.tweaktown.com/news/112090/apple-is-adding-a-liquid-glass-slider-in-ios-27-after-a-year-of-user-complaints-about-readability/index.html
- https://docs.expo.dev/versions/latest/sdk/glass-effect/
- https://docs.expo.dev/router/advanced/native-tabs/
- https://expo.dev/changelog/sdk-54
- https://expo.dev/changelog/sdk-55
- https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui
- https://www.amillionmonkeys.co.uk/blog/expo-liquid-glass-tab-bar-ios
- https://github.com/callstack/liquid-glass
- https://www.npmjs.com/package/expo-glass-effect
- https://www.npmjs.com/package/@callstack/liquid-glass
- https://thefrontkit.com/blogs/ai-chat-ui-best-practices
- https://thefrontkit.com/blogs/what-is-streaming-ui-in-ai-applications
- https://www.parallelhq.com/blog/chatbot-ux-design
- https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026
- https://www.groovyweb.co/blog/ui-mistakes-ai-apps-2026
- https://fuselabcreative.com/chatbot-interface-design-guide/
- https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026
- https://www.eleken.co/blog-posts/generative-ui
- https://www.eleken.co/blog-posts/empty-state-ux
- https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/
- https://lomatechnology.com/blog/motion-ui-trends-2026/2911
- https://www.uxpin.com/studio/blog/ui-ux-design-trends/
- https://www.techmagic.co/blog/mobile-app-design-trends
- https://www.designstudiouiux.com/blog/mobile-app-ui-ux-design-trends/
- https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/
- https://formbricks.com/blog/user-onboarding-best-practices
- https://www.appcues.com/blog/best-user-onboarding-examples
- https://userpilot.com/blog/app-onboarding-design/
- https://mobbin.com/glossary/empty-state
- https://www.useronboard.com/onboarding-ux-patterns/empty-states/
- https://www.forasoft.com/blog/article/9-tips-to-make-ios-app-cooler-86
- https://developer.apple.com/videos/play/wwdc2026/345/
- https://blakecrosley.com/blog/ios-26-widget-and-control-surface
- https://www.goodrequest.com/blog/app-intents-how-to-make-your-app-more-accessible-through-siri-spotlight-and-widgets
- https://newsroom.gendigital.com/2026-06-04-Norton-Introduces-Family-Assistant,-the-Secure-AI-Agent-Built-to-Help-Families-Manage-the-Chaos-of-Modern-Parenting-in-the-Digital-Age
- https://www.eweek.com/news/openai-chatgpt-family-ai-2026/
- https://trustarc.com/resource/ai-childrens-data-2026/
- https://holanolis.com/en/blog/complete-guide-ai-parental-controls/
- https://medium.com/@expertappdevs/liquid-glass-2026-apples-new-design-language-6a709e49ca8b (claim rejected, listed for provenance)
