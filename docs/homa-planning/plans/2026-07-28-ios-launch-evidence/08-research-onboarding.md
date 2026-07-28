# Mobile onboarding best practices for subscription consumer apps, 2026

Web research report for the Homa iOS App Store launch plan. Focus: subscription consumer apps aimed at parents (education, family, health). Compiled 2026-07-28. All external claims are cited; vendor-sourced numbers are flagged as such. Homa-side grounding points to files in the worktree at `/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-chat-onboarding-testing-10c9c1`.

## 1. The 2026 baseline: onboarding IS the conversion funnel

The single most consistent finding across 2026 sources is that onboarding and the paywall are one funnel, and the onboarding sets the ceiling before the paywall is ever seen.

- RevenueCat State of Subscription Apps 2026 (115,000+ apps, $16B+ revenue, 1B+ transactions): about one third of all conversions happen on Day 0 and more than 60% within the first week. Users need an aha moment "within the first 60 minutes." ([RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/))
- 55.4% of 3-day-trial cancellations happen on Day 0, and 84% happen between Day 0 and Day 1 (up 4 points from 2025: users cancel faster every year). Onboarding is the primary retention mechanism, not a tour. (same source)
- Airbridge: 25% of users churn in the first 3 minutes; 77% churn within 3 days; D30 retention for typical apps is stuck at 5-6%. "Onboarding is the first conversion layer." ([Airbridge](https://www.airbridge.io/en/blog/subscription-app-onboarding))
- RevenueCat 2025: the largest single cancellation reason is "insufficient usage" at 37%+ of churn, i.e. the app never became a habit, which is decided in the first sessions. ([RevenueCat State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025))

Implication for Homa: the iOS first-run is not a wrapper problem, it is the revenue mechanism. Whatever ships must produce a felt win inside the first session, ideally inside the first five minutes (see §4).

## 2. Value before signup

- Requiring signup before any experience increases abandonment by 56% (aggregated 2026 best-practice claim; treat the exact number as directional). Deferred registration, value-first experiences, gamified progress, and personalization inside the first 30 seconds are the named top patterns for 2026. ([Lowcode.agency 2026 guide](https://www.lowcode.agency/blog/mobile-onboarding-best-practices), [Appcues](https://www.appcues.com/blog/in-app-onboarding))
- The canonical experiment: Duolingo let users complete a full lesson before asking for an account and grew DAU about 20%. Their refinement: "soft walls" (skippable signup asks) followed by a later hard wall drove an additional 8.2% DAU increase, and neither wall performed as well in isolation. Soft walls prime the hard wall; the endowed progress effect makes the signup ask convert after investment, not before. ([Lenny's Newsletter on Duolingo growth](https://www.lennysnewsletter.com/p/the-secret-to-duolingos-growth), [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/))
- Apple compliance pushes the same direction: guideline 5.1.1(v) prohibits requiring registration before access to "content and features not associated specifically to the user," and a common 2026 rejection pattern is AI assistant apps collecting onboarding fields (name, DOB, city) that never visibly appear in the product. Every field collected must be used by a shipping feature. ([Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [isitdev compliance checklist 2025](https://isitdev.com/app-store-review-guidelines-compliance-2025/))

Nuance for Homa: full anonymous use is not required for compliance (Homa's core is account-based and family-scoped, which 5.1.1(v) allows), but the pattern lesson holds: let the parent experience the interview and see the artifact taking shape before or immediately at the account ask, and never collect a quiz answer that the product does not visibly use. Homa's interview answers ARE visibly used (they drive the printable), which is the strong version of compliance.

## 3. The quiz/personalization pattern (Noom, Fabulous, Duolingo)

This is the dominant consumer-subscription onboarding pattern of 2020-2026 and it is still winning in 2026.

- Noom (teardown by RevenueCat): the flow spans up to 113 screens over 10-15 minutes. A 10-question behavioral-profile quiz, sensitive questions framed with why-we-ask explanations, reassurance placed "right after the hardest moment," repeated expectation-setting ("typically lose 0.5-1 kg per week"), social proof counters ("3,627,436 people"), and a projected timeline that visibly improves as the user answers. Email gate sits right before the results graph; pricing appears only after roughly one third of the flow. Core takeaway verbatim: "Build commitment before introducing price." ([RevenueCat Noom teardown](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel/), [Web2App World Noom breakdown](https://web2appworld.com/breakdowns/noom/))
- Duolingo asks a few motivation and goal questions up front purely to personalize and to set a goal, which raises motivation and retention. ([Appcues Duolingo teardown](https://goodux.appcues.com/blog/duolingo-user-onboarding))
- Calm/Headspace/Flo: one or two intent questions ("What brings you here?") create self-selected motivation; Flo inserts an explicit micro-commitment ("I'm ready") right before the paywall. The pattern across all of them: emotional anchor, micro-commitment, proof of value, then bigger asks. ([appagent flow types](https://appagent.com/blog/new-user-flow-types/), [Headspace teardown](https://tearthemdown.medium.com/product-teardown-headspace-user-onboarding-personalisation-b6effd0df1d7), [dev.to onboarding first-screen trends](https://dev.to/paywallpro/onboarding-first-screen-trends-emotional-hooks-are-back-because-they-never-left-74d))
- Personalized onboarding lifts hard numbers: apps tailoring onboarding to user goals see trial starts up 8.5% and paying conversions up 17% (vendor-aggregated). ([Plotline examples](https://www.plotline.so/blog/mobile-app-onboarding-examples), [VWO guide](https://vwo.com/blog/mobile-app-onboarding-guide/))
- Length: longer converts better more often than shorter. Superwall: onboardings with three or more slides convert better, attributed to buy-in. Adapty: results vary by category (one entertainment app gained +40% conversions from a long flow); their recommendation is start at 3-5 screens and test. The mechanism everyone converges on is sunk-cost/endowed-progress plus perceived personalization: "each quiz question makes the result feel more tailored, so by the paywall users believe they're getting a plan built specifically for them." ([Superwall](https://x.com/Superwall/status/1782487035892072686), [Adapty onboarding practices](https://adapty.io/blog/how-to-fix-your-onboarding-flow/), [dev.to 15 subscription patterns](https://dev.to/paywallpro/subscription-onboarding-15-patterns-you-must-know-4n4f))
- The quiz has partially migrated to the web (web2app): typical 2026 funnel is ad, landing page, 15-50 question quiz, personalized results, web paywall, checkout, then app download. Palta reports Flo generates 50% of revenue through web onboarding and 80% of new subscribers across the Palta portfolio arrive via web, not direct app download. Post-2025 US anti-steering changes give these flows clearer legal standing (Apple still takes 27% on link-outs within 7 days under its entitlement). ([RevenueCat web-to-app 2026 guide](https://www.revenuecat.com/blog/growth/web-to-app-funnels), [Web2Wave compliance guide](https://www.web2wave.com/post/are-web2app-funnels-allowed-a-complete-guide-to-apple-app-store-and-google-play-compliance), [Airbridge web-to-app](https://www.airbridge.io/en/blog/web-to-app-funnels-explained))

Implication for Homa: Homa's chat interview is functionally a quiz funnel with a better payoff (a real printable instead of a projected graph). What the quiz pattern has that raw chat lacks: visible progress, endowed-progress mechanics, controlled pacing, why-we-ask reassurance at sensitive moments (a parent describing a struggling child is Homa's "weight question"), and a deterministic slot where the paywall goes. Those are structural features worth wrapping around the chat, not reasons to replace it.

## 4. Time-to-first-wow benchmarks

- The "5-minute aha rule": elite products deliver the aha moment in under 5 minutes; 5-20 minutes is typical; 20-60 minutes loses a meaningful fraction of signups. Products hitting aha under 5 minutes show ~40% higher 30-day retention than those requiring 15+ minutes. ([ProductQuant](https://productquant.dev/blog/5-minute-aha-rule-optimize-ttv/))
- Consumer apps typically target 30-50% of signups hitting the activation event on Day 1. ([Product School](https://productschool.com/blog/analytics/user-activation), [Amplitude](https://amplitude.com/blog/time-to-value-drives-user-retention))
- RevenueCat 2026 frames it as "aha within the first 60 minutes" for subscription apps, with Day 0 carrying a third of all conversions. ([RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/))
- Mobile-onboarding-specific: best-in-class flows run under 60 seconds of overhead across 3-7 steps before the user is doing the real thing. ([DesignStudio UIUX](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/), [UXCam examples](https://uxcam.com/blog/10-apps-with-great-user-onboarding/))

Homa-specific risk: the web chat onboarding's kickoff turn was measured at 17.8-23.8s and optimized to 6.3-12.1s (2026-07-23 latency investigation, commit 473d99fe; see `apps/web/lib/onboarding/` and the onboarding skill at `apps/web/agent/skills/onboarding/`). A 6-12 second silence per turn is tolerable on web with streaming, but on iOS it competes against a 5-minute total budget and native-feel expectations. The artifact (printable) is a genuinely strong wow, but every second of dead air before the first agent message is the most expensive second in the funnel. Native structured screens have zero model latency; chat turns do not. This is the strongest single argument for a hybrid.

## 5. Permission priming (notifications)

- iOS average push opt-in is 56.36% across 600+ apps (Pushwoosh 2025 benchmark); overall average 67.5%, so iOS trails Android meaningfully. ([Pushwoosh](https://www.pushwoosh.com/blog/ios-push-notifications/), [Plotline](https://www.plotline.so/blog/how-to-improve-push-notification-opt-in-rates))
- Pre-permission priming (a custom in-app "soft ask" explaining the value before the one-shot system prompt) improves opt-in 2-3x. ([PushEngage](https://www.pushengage.com/ios-push-notification-permission/), [OneSignal](https://documentation.onesignal.com/docs/en/prompt-for-push-permissions))
- Timing consensus for 2025-2026: never ask during generic onboarding; ask immediately after a value moment (finished first session, saved an item, completed the plan), phrased as a specific promise tied to what just happened. The native prompt is effectively one-shot; a declined prompt is rarely recovered. ([Appbot 2026](https://appbot.co/blog/app-push-notifications-2026-best-practices/), [Userpilot](https://userpilot.com/blog/push-notification-best-practices/), [Batch docs](https://doc.batch.com/guides-and-best-practices/orchestration/how-to-improve-the-push-opt-in-rate))

Implication for Homa: the correct slot is seconds after the printable appears: "Want us to tell you when tomorrow's plan for Finn is ready?" That is a concrete, child-named promise at peak goodwill. Homa also has a morning-brief product whose whole channel economics depend on this opt-in, so the priming screen deserves design investment, not a system-prompt-only ask. Do NOT stack the ATT tracking prompt near it; sequence permissions one per session where possible.

## 6. Signup friction: SSO vs email

- Social login raises signup conversion 20-35% on average per a 2025 industry study, with vendor claims ranging 20-130% (flagged: much of this data comes from auth vendors). ([Corbado benchmarks](https://www.corbado.com/blog/social-login-conversion-rate), [Auth0](https://auth0.com/blog/how-to-use-social-login-to-drive-your-apps-growth/), [CXL](https://cxl.com/blog/social-login/))
- Password friction is a first-order abandonment cause: 87% of Americans have abandoned a signup or purchase because of login difficulties; 55% have abandoned an account or created a new one to avoid a password reset (Frontegg 2025 study). ([Frontegg](https://frontegg.com/guides/user-authentication-preferences), [SmallBizTrends coverage](https://smallbiztrends.com/frontegg-login-study-password-reset-abandonment/))
- One-tap Sign in with Apple is the lowest-friction iOS path since the user is already authenticated on device; Apple mandates SIWA whenever other third-party logins are offered (guideline 4.8). ([X-Apps login model guide](https://www.x-apps.dev/app-login-model-how-to-choose/), [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/))
- AI assistant apps (see §8) have converged on exactly this: 2-3 SSO buttons, passwordless email OTP as fallback, zero-field forms.

Homa status: the mobile app already ships SIWA + Google (App Store release build fb45d812, PR #72; auth screens at `apps/mobile/src/app/(auth)/signin.tsx`). The launch-critical work is not adding SSO, it is sequencing it (post-value soft wall rather than cold first screen) and making sure the Supabase Apple Client ID founder step is done.

## 7. Onboarding-to-paywall sequencing

- Hard paywall vs freemium (RevenueCat 2026): hard paywalls convert 10.7% download-to-paid at D35 vs 2.1% for freemium (~5x), generate 8x revenue per install at day 60 ($3.09 vs $0.38), and 12-month retention is statistically identical (27% vs 28%). Hard-paywall conversion did decline from 12.1% in 2025, suggesting mild broad reluctance. ([RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/), [RevenueCat hard paywall vs freemium](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium/), [neoads analysis](https://neoads.substack.com/p/hard-paywalls-convert-less-but-earn))
- But "hard paywalls only work if onboarding earns the ask": the recommended placement is after the goal/personalization steps and before delivering the full core experience, i.e. the user must understand the promised value but not have consumed it. 82% of trial starts happen on Day 0. ([Airbridge onboarding-before-paywall](https://www.airbridge.io/en/blog/5-steps-app-onboarding-before-the-paywall), [RocketShip HQ on Adapty fitness benchmarks](https://www.rocketshiphq.com/paywall-optimization-fitness-apps/))
- Trial length: trials of 17-32 days convert at 42.5% median vs 25.5% for trials under 4 days (~70% better), yet the share of apps using 4-day-or-shorter trials rose to 46.5% in 2026 (cashflow over conversion). ([RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/))
- Annual plans: 35% of annual cancellations happen in month 1, and ~72% of annual subscribers cancel within 12 months (2026, versus 56% in 2025). The renewal battle starts week 1. (same source)
- Education category benchmarks (RevenueCat 2026 education cut): D35 download-to-paid median 2.6% (third-highest category); D30 download-to-trial 6.5%; only 78.5% of trial starts on Day 0 (lowest of any category, parents deliberate); 50.3% of education apps use 5-9 day trials; median pricing $4.99/week, $9.99/month, $44.99/year (the highest annual median of any category, education carries premium willingness-to-pay); North America leads at 2.8%. ([RevenueCat 2026 education](https://www.revenuecat.com/state-of-subscription-apps-2026-education/))
- AI-flavored apps: 41% higher revenue per user but 36% faster churn than non-AI apps; novelty converts, only habit retains. ([RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/))

Implications for Homa:
- Homa's $19/month sits 2x above the education median ($9.99) and its web product already runs a card-upfront 7-day gate (flipped on 2026-07-28). The data says premium pricing is viable in this category IF the onboarding earns it; the median education app converts 2.6% of downloads by D35, and top-quartile high-priced education apps exceed 6.1% download-to-paid.
- The Day 0 rule plus the education-category deliberation lag (78.5% Day 0 trial starts, lowest of all) argues for: paywall in the first session after the artifact moment, plus a strong Day 1-3 push/email lane for the deliberators, plus treating week 1 of any trial as the actual conversion campaign (55.4% of short-trial cancels are Day 0).
- On iOS the trial must run through StoreKit. The web signup paywall's SINCE grandfathering and Stripe rail do not transfer; plan for RevenueCat-style cross-platform entitlement reconciliation as its own workstream (out of scope here, flagged for the PM).

## 8. What best-in-class AI assistant apps do for first-run (as of 2026)

Pattern, synthesized from app documentation, reviews, and flow libraries (ChatGPT, Claude, Perplexity, Gemini):

- Near-zero onboarding. First screen is 2-3 SSO buttons (Apple, Google, email OTP). No password creation. ([Page Flows ChatGPT iOS flow](https://pageflows.com/post/ios/onboarding/chat-gpt/), [datastudios Perplexity review](https://www.datastudios.org/post/perplexity-mobile-app-vs-desktop-interface-features-integrations-and-usability))
- No quiz. Personalization is progressive and in-product: ChatGPT collects "what should we call you" and traits post-signup and leans on memory plus custom instructions; Claude and Perplexity personalize through settings and usage, not an intake flow. The assistant apps deliberately moved personalization AFTER first value.
- Empty state does the onboarding: suggestion chips and starter prompts replace tutorial screens. The first wow is one good answer, achievable in under 30 seconds.
- Voice is a first-run differentiator by 2026: Perplexity shipped native voice assistants (Android January 2025, iOS April 2025); Claude's voice mode (May 2025) went free on all tiers in early 2026. ([datastudios](https://www.datastudios.org/post/perplexity-mobile-app-vs-desktop-interface-features-integrations-and-usability), [TechRadar on Claude voice](https://www.techradar.com/computing/artificial-intelligence/claude-ai-adds-a-genuinely-useful-voice-mode-to-its-mobile-app-that-can-look-inside-your-inbox-and-calendar))
- The 2026 onboarding-tools market has meanwhile productized "conversational intake" (AI interviews replacing form intake), with vendors claiming 2-4x activation gains in B2B contexts (vendor-sourced, directional only). ([Perspective AI](https://getperspective.ai/blog/ai-native-onboarding-software-what-to-look-for-in-2026))
- Conversational-UI research consensus: quick-reply buttons reduce cognitive load and drop-off for structured intake; free text is preferred where nuance matters; the winning design is hybrid (chips for structured questions, free text for the open moments). ([Onething Design](https://www.onething.design/post/best-practices-for-conversational-ui-design), [GetStream chat UX](https://getstream.io/blog/chat-ux/))

Critical caveat for Homa: ChatGPT/Claude/Perplexity are the WRONG comps for onboarding depth. They are horizontal freemium utilities with universal brand awareness whose first wow needs zero context. Homa is a vertical, premium-priced, trust-dependent subscription for parents whose first wow REQUIRES context (children, ages, subjects, worries). The consumer-subscription quiz pattern (§3) is the right comp for the intake and paywall; the AI-assistant pattern is the right comp for auth (SSO, passwordless), latency expectations, empty-state chips, and progressive personalization after Day 0.

## 9. Parent/family/health vertical notes

- Huckleberry (5M+ families) and Kinedu (1,800+ activities) both lead with per-child personalization ("your personalized plan in 3 simple steps") and freemium-with-premium-gate models; the personalized plan IS the paywall pitch in this vertical. ([Kinedu App Store listing](https://apps.apple.com/us/app/kinedu-baby-development/id741277284), [Huckleberry App Store listing](https://apps.apple.com/us/app/huckleberry-baby-child/id1169136078))
- Flo (women's health, Palta) is the vertical's conversion benchmark and gets 50% of revenue from web onboarding quizzes (§3).
- Trust language matters more than in other verticals: expert backing ("backed by pediatric experts"), privacy posture, and reassure-before-inform tone are table stakes in parent-facing onboarding. This aligns exactly with Homa's existing copy laws (reassure-before-inform, offers never commands, never compare siblings).
- Data sensitivity: a parent describing a child's struggles is high-sensitivity disclosure. Noom's technique applies directly: explain why you ask before the hard question, reassure immediately after the answer. Apple 5.1.1 data-minimization review will also look at child data collected during onboarding, so every child field must visibly drive the artifact or plan.

## 10. Assessment: replicate Homa's chat-first onboarding on mobile, or wrap it in a native structured flow?

What Homa web has today (merged 2026-07-24, PR #139, live): an agent-led chat interview (`apps/web/app/onboarding/onboarding-shell.tsx`, `apps/web/app/app/onboarding-chat.ts`, skill at `apps/web/agent/skills/onboarding/`) that produces a first printable mid-onboarding via a single-stage materials-studio job with a morphing promise card (the "first making," shipped 2026-07-23). Kickoff latency 6.3-12.1s post-optimization.

Verdict: the artifact-mid-onboarding moment is genuinely ahead of the market; the raw chat transport around it is not. The state of the art in 2026 is a hybrid, and Homa should ship a native structured shell that wraps the chat interview rather than a naked chat screen. Reasoning:

1. The artifact IS the wow and beats the category. Quiz funnels climax in a projected graph or "personalized plan reserved" screen (Noom). Homa climaxes in a real, printable, child-specific deliverable. No parenting comp found does this. Keep it, center it, and put the paywall right after it (§7 sequencing) and the notification prime right at it (§5).
2. Raw chat fails the benchmarks that structured flows pass. 5-minute aha budget (§4) vs 6-12s dead air per turn; no progress bar means no endowed-progress mechanics (§3); free-text-first raises cognitive load and drop-off for intake questions (§8 research); a nondeterministic flow gives no reliable slot for permission priming, the soft signup wall, or the paywall; and App Store review rewards predictable flows with visibly-used data (§2).
3. The hybrid blueprint the evidence supports:
   - Screen 1: value promise + SSO soft wall (SIWA one tap; skippable to a taste of the interview if feasible, hard wall before artifact generation since the artifact requires a family record).
   - Screens 2-5: native quick-tap intake for the closed-set facts (how many children, ages, subjects, biggest worry) as chips/cards with a progress indicator. These answers seed the agent so the chat opens already knowing the family shape (kills the coldest, slowest kickoff turn; the web flow's structured cards in `apps/web/app/app/onboarding-cards.tsx` are the seed of this).
   - Then the chat interview takes over for the open, emotional questions where free text wins, with quick-reply chips offered per turn, streaming, and the morphing promise card while the printable generates. Latency during generation is theater time, not dead air.
   - Artifact reveal, then notification priming sheet tied to the artifact by name, then paywall (7-day trial through StoreKit) while emotional investment peaks. Web evidence: the 48-word-to-first-price paywall rework and claims laws carry over.
   - Defer everything else (ATT, review prompt, deeper profile) past Day 0.
4. This preserves the strategic asset. The interview and skill logic stay in the shared agent; mobile adds a structured native jacket, not a second onboarding brain. The one-question-at-a-time SMS ruling does not bind here (choice card is web only ruling, 2026-07-21, allows multi-question surfaces; a native intake screen is the mobile analog).

Open questions for the PM:
- Whether a pre-auth "taste" (one interview exchange before the SSO wall) is worth the anonymous-session plumbing, given Duolingo's +20% DAU evidence vs Homa's family-scoped tenancy laws.
- Cross-platform entitlements (Stripe web vs StoreKit iOS) and whether iOS launches with the same card-upfront gate or a StoreKit trial.
- Whether to build a web2app quiz funnel (§3) as the paid-acquisition front door, given Flo/Palta's 50-80% web share; that is an acquisition decision upstream of the app's own first-run.

## Sources

- https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/
- https://www.revenuecat.com/state-of-subscription-apps-2026-education/
- https://www.revenuecat.com/state-of-subscription-apps-2025
- https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel/
- https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium/
- https://www.revenuecat.com/blog/growth/web-to-app-funnels
- https://www.airbridge.io/en/blog/subscription-app-onboarding
- https://www.airbridge.io/en/blog/5-steps-app-onboarding-before-the-paywall
- https://www.lennysnewsletter.com/p/the-secret-to-duolingos-growth
- https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/
- https://goodux.appcues.com/blog/duolingo-user-onboarding
- https://www.lowcode.agency/blog/mobile-onboarding-best-practices
- https://www.appcues.com/blog/in-app-onboarding
- https://vwo.com/blog/mobile-app-onboarding-guide/
- https://www.plotline.so/blog/mobile-app-onboarding-examples
- https://www.plotline.so/blog/how-to-improve-push-notification-opt-in-rates
- https://productquant.dev/blog/5-minute-aha-rule-optimize-ttv/
- https://productschool.com/blog/analytics/user-activation
- https://amplitude.com/blog/time-to-value-drives-user-retention
- https://www.pushwoosh.com/blog/ios-push-notifications/
- https://www.pushengage.com/ios-push-notification-permission/
- https://documentation.onesignal.com/docs/en/prompt-for-push-permissions
- https://appbot.co/blog/app-push-notifications-2026-best-practices/
- https://userpilot.com/blog/push-notification-best-practices/
- https://www.corbado.com/blog/social-login-conversion-rate
- https://frontegg.com/guides/user-authentication-preferences
- https://auth0.com/blog/how-to-use-social-login-to-drive-your-apps-growth/
- https://www.x-apps.dev/app-login-model-how-to-choose/
- https://developer.apple.com/app-store/review/guidelines/
- https://isitdev.com/app-store-review-guidelines-compliance-2025/
- https://x.com/Superwall/status/1782487035892072686
- https://adapty.io/blog/how-to-fix-your-onboarding-flow/
- https://adapty.io/blog/high-performing-paywall-2026/
- https://dev.to/paywallpro/subscription-onboarding-15-patterns-you-must-know-4n4f
- https://dev.to/paywallpro/onboarding-first-screen-trends-emotional-hooks-are-back-because-they-never-left-74d
- https://web2appworld.com/breakdowns/noom/
- https://www.web2wave.com/post/are-web2app-funnels-allowed-a-complete-guide-to-apple-app-store-and-google-play-compliance
- https://www.airbridge.io/en/blog/web-to-app-funnels-explained
- https://www.rocketshiphq.com/paywall-optimization-fitness-apps/
- https://neoads.substack.com/p/hard-paywalls-convert-less-but-earn
- https://tearthemdown.medium.com/product-teardown-headspace-user-onboarding-personalisation-b6effd0df1d7
- https://appagent.com/blog/new-user-flow-types/
- https://uxcam.com/blog/10-apps-with-great-user-onboarding/
- https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/
- https://pageflows.com/post/ios/onboarding/chat-gpt/
- https://www.datastudios.org/post/perplexity-mobile-app-vs-desktop-interface-features-integrations-and-usability
- https://www.techradar.com/computing/artificial-intelligence/claude-ai-adds-a-genuinely-useful-voice-mode-to-its-mobile-app-that-can-look-inside-your-inbox-and-calendar
- https://getperspective.ai/blog/ai-native-onboarding-software-what-to-look-for-in-2026
- https://www.onething.design/post/best-practices-for-conversational-ui-design
- https://getstream.io/blog/chat-ux/
- https://apps.apple.com/us/app/kinedu-baby-development/id741277284
- https://apps.apple.com/us/app/huckleberry-baby-child/id1169136078
