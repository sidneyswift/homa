# Apple App Store rules binding Homa's iOS launch (state of play, July 28, 2026)

Scope: Homa is a parent-facing AI homeschool assistant (the parent is the user, not the child), $19/mo subscription currently sold via Stripe on the web. The iOS app (Expo, `apps/mobile/`) has a first release in flight (SIWA + Google sign-in, 1.0.0). This report covers the eight rule areas requested, with 2025-2026 dated sources, and ends with a decision memo on the v1 monetization posture.

Confidence note: everything in sections 1 and 2 is litigation-adjacent and can change. The single most important fact is that as of today Apple collects ZERO commission on external purchase link sales in the US storefront, and that state persists until the district court sets a "reasonable commission" on remand, which proceedings Apple is trying to pause pending Supreme Court review.

---

## 1. When IAP is mandatory (3.1.1) vs external purchase links in the US

### The rule text as it stands (July 2026)

Guideline 3.1.1 still opens with the classic mandate: "If you want to unlock features or functionality within your app ... you must use in-app purchase." But 3.1.1(a) now carries the US carve-out created by the Epic injunction: entitlements "are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps." Elsewhere the guidelines state the anti-steering prohibition applies "In all other storefronts, except for the United States storefront, where this prohibition does not apply." (Source: Apple App Review Guidelines, live text fetched July 28, 2026, developer.apple.com/app-store/review/guidelines/)

### Litigation timeline that produced this state

- 2021: district court (Judge Yvonne Gonzalez Rogers) enjoins Apple's anti-steering rules under California UCL. Ninth Circuit affirms; SCOTUS denies cert January 2024.
- January 2024 compliance attempt: Apple allows external links but charges 12 to 27 percent commission on link-out purchases with heavy design restrictions ("scare screens", static link rules).
- April 30, 2025: contempt order. The court finds Apple "willfully violated" the injunction, bars Apple from collecting ANY commission on external purchases in the US App Store, bars link style/placement restrictions and scare screens (only a neutral notice allowed). (fkks.com technology law analysis; TechXplore May 2025)
- May 1, 2025: Apple updates guidelines 3.1.1, 3.1.1(a), 3.1.3, 3.1.3(a) for the US storefront: links, buttons, and calls to action allowed, no entitlement required, no commission. (AppleInsider May 2, 2025; iClarified; Michael Tsai blog May 2, 2025)
- December 11, 2025: Ninth Circuit affirms the contempt finding but vacates the permanent zero-commission ban as punitive, remanding for the district court to set a "reasonable commission" based on Apple's genuinely necessary coordination costs plus some IP compensation, explicitly EXCLUDING security and privacy expenses from the calculation. The zero-fee state remains in force until the district court approves a fee. (MacRumors December 11, 2025; Fenwick client alert; Shinder Cantor Lerner analysis)
- April 29, 2026: Ninth Circuit reverses the stay Apple had won, so the zero-fee regime stays in place while the remand proceeds; case returns to Judge Gonzalez Rogers to determine "what commission Apple can collect on purchases made through external links, if any." (MacRumors April 29, 2026; TechCrunch April 29, 2026)
- Late June 2026: Supreme Court grants certiorari on two questions: whether contempt can rest on an injunction's "spirit" rather than a clear textual violation, and a question about the scope of injunctive relief post Trump v. CASA. (IPWatchdog June 30, 2026; gHacks July 2, 2026)
- July 2026 (now): Apple moved to stay the district court remand pending the SCOTUS ruling (motion filed around July 6-7; Epic opposed July 13). The fee-setting proceeding is effectively in limbo; zero fee continues meanwhile. (9to5Mac July 1, 7, and 13, 2026; MacObserver)

### Practical state for a US-only launch today

- A US storefront app may include buttons, links, and calls to action to an external web checkout. No entitlement, no commission, no Apple reporting obligation, dynamic links with user tokens allowed, only a neutral "you are leaving the app" system disclosure. (RevenueCat app-to-web purchase guidelines, published December 9, 2025, updated February 20, 2026: 0% external, 15-30% still applies to IAP; Stora implementation guide May 16, 2026)
- The StoreKit External Purchase Link Entitlement still exists and is still required in non-US storefronts that have their own regimes (EU DMA, etc.). Not needed for US.
- Big apps adopted web checkout immediately and publicly: Spotify (external subscription links approved early May 2025), Amazon Kindle ("Get Book" button to mobile web), Patreon (checkout choice that skips Apple's fee), Fortnite's return, and a long tail of subscription apps. Web checkout links are now a normal, mainstream pattern in US apps. (TechXplore May 2025; GSMArena May 2025; RevenueCat growth post)

### The catch that matters for Homa: 3.1.1 is still enforced against link-only paywalls

The injunction protects steering (the link). It did not repeal the IAP mandate itself, and App Review has kept rejecting non-reader apps whose only purchase path is an external checkout:

- September 2025, Apple developer forum thread 799798: an app with a hard paywall after onboarding that sold "Lifetime Access and Monthly Access" via a Stripe external link was rejected under 3.1.1, with App Review stating paid digital content "must be available for purchase in the app using only in-app purchase."
- 2026 practitioner reporting (PTKD Journal on 3.1.1 rejections; Neon Commerce 2026 fee guide; Twinr guide) describes enforcement as strict and uneven: some non-reader apps pass review external-link-only, "likely due to the speed with which Apple had to implement the new guidance," and may be rejected at the next update; the common written advice for the first half of 2026 is to budget for about two rejection rounds when shipping an external-link paywall app.
- The pattern that reliably passes: offer IAP AND an external link side by side (Patreon's model), or be a login-only companion app that sells nothing and gates nothing visibly in-app (see section 2).

Read together: in the US you may steer freely, and pay Apple nothing on web sales, but if the app itself presents a purchase flow, App Review still expects IAP to exist as an option. This asymmetry is the core input to the decision memo.

---

## 2. Multiplatform services, 3.1.3(b): web subscribers signing in on iOS with no IAP at all

Current text: "Apps that operate across multiple platforms may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site, including consumable items in multi-platform games, provided those items are also available as in-app purchases within the app." (Apple guidelines, fetched July 28, 2026)

The load-bearing clause is "provided those items are also available as in-app purchases within the app." App Review applies it literally:

- May 2026, Apple developer forum thread 825551: a free iOS companion app for a cross-platform productivity service (web + iOS + Android, subscriptions sold on web) asked whether it could be "tier-aware" (web subscribers see extra features) without IAP. App Review rejected tier-aware under 3.1.1/3.1.3(b), reasoning that without IAP in the app, the 3.1.3(b) exemption does not apply because of the "also available as in-app purchases" requirement. The developer shipped "tier-identical" iOS (every iOS user sees the same features regardless of web tier) and passed.
- The compliant no-IAP shape practitioners describe: the app is a companion to a service available on other platforms, the user signs in to an existing account, and NO commerce is presented inside the iOS app (no paywall screens, no locked-feature upsells keyed to payment). (PTKD Journal 3.1.1 analysis, 2025-2026)

So the direct answer: yes, users who subscribed on the web can sign in on iOS without the app offering IAP, and this is a long-standing accepted pattern, BUT the app must not gate or merchandise paid tiers in-app without IAP. For Homa this is workable because Homa has a single $19/mo plan, not tiers: an app that simply requires an active account and shows the full product to signed-in subscribers, with trial-expired users pushed to the web (which the US storefront now legally allows via an explicit link), is the practical shape. The residual risk is a reviewer treating a trial-expiry wall with a web link as a "purchase flow" under 3.1.1, per the September 2025 rejection above.

Note: the reader-app rules, 3.1.3(a) with the External Link Account Entitlement, do not fit Homa (reader apps are magazines, newspapers, books, audio, music, video). Do not plan on them.

---

## 3. Sign in with Apple, guideline 4.8 (current form)

4.8 no longer names Sign in with Apple as the required option. Current text: apps using a third-party or social login service (Facebook, Google, X, LinkedIn, Amazon, WeChat) to set up or authenticate the user's primary account "must also offer as an equivalent option another login service" that (a) limits data collection to name and email, (b) lets users keep their email private, and (c) does not collect app interactions for advertising without consent. Sign in with Apple satisfies this and is the de facto standard answer, but any compliant service qualifies (this loosening dates to the EU DMA changes and now applies globally).

Exemptions (none apply to Homa): own-account-system-only apps, alt-marketplace apps, education/enterprise/business apps requiring an existing org account, government eID, and clients for a specific third-party service.

Homa status: the in-flight 1.0.0 build already ships SIWA plus Google (memory: PR #72, build fb45d812), so 4.8 is satisfied. Two operational obligations follow: the Supabase Apple Client IDs entry (a founder step, per the same memory) must be done or SIWA fails live, and account deletion must revoke SIWA tokens (section 4).

---

## 4. Account deletion, guideline 5.1.1(v)

Current text: "If your app supports account creation, you must also offer account deletion within the app." In force since June 30, 2022 (Apple Developer news, "Account deletion requirement starts June 30"). Apple's support page requirements, as summarized by compliance vendors (Transcend, Ketch, TermsFeed, 2022-2025):

- Deletion must be initiable from within the app and easy to find.
- Deactivation or disabling is explicitly insufficient; the account record and associated personal data must be deletable (legal retention carve-outs allowed, but tell the user).
- Redirecting to a website where the user must email support is exactly the pattern the rule targets; if the flow does hop to the web it must be a direct path to deletion, not a support maze.
- Apps offering Sign in with Apple must call the Sign in with Apple REST API to revoke user tokens on deletion.
- Highly regulated industries may confirm identity via extra steps before deleting.

Homa gap to check before submission: the web product needs a real account-deletion path the app can invoke or embed, plus SIWA token revocation, plus a defined answer for what happens to family data (children's progress records) on deletion. App Review does test this flow.

---

## 5. AI and generative content rules, and the age rating overhaul

### Guideline 4.7 and the November 2025 AI data rule

4.7 currently governs "Mini apps, mini games, streaming games, chatbots, plug-ins, and game emulators." Its chatbot requirements apply to AI chat surfaces: follow the 5.1 privacy rules including sensitive data from kids (4.7.1), provide a method for filtering objectionable material, a content-report mechanism with timely responses, and abusive-user blocking (4.7.1), and 4.7.5 requires a way to identify software exceeding the app's age rating with an age-restriction mechanism. Whether 4.7 formally binds a first-party AI assistant (as opposed to third-party chatbot platforms) is arguable, but App Review commonly expects the filtering/reporting/blocking triad from AI chat apps, and Homa should ship a report-content affordance in chat to be safe.

The concrete new rule is the November 13, 2025 guidelines update to 5.1.2(i): apps "must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." First time third-party AI is a named regulated category; violation risk is removal. Coverage is broad: LLMs, traditional ML, any external reasoning service. (Apple Developer news "Updated App Review Guidelines now available," November 13, 2025; TechCrunch November 13, 2025; TechRepublic; dev.to analysis.)

Homa implication: Homa routes model calls through the Vercel AI Gateway to third-party models, and family data (child names, progress) flows into prompts. Homa needs an explicit, affirmative consent moment (onboarding is the natural place) disclosing that conversation content and family info are processed by third-party AI providers, plus matching privacy-policy and nutrition-label entries. A buried privacy-policy sentence does not satisfy "explicit permission."

### Age rating overhaul (announced July 24, 2025, deadline passed January 31, 2026)

- New tiers: 4+, 9+, 13+, 16+, 18+ (12+ and 17+ retired). (MacRumors July 25, 2025; TechCrunch July 25, 2025; Apple Developer news "Updated age ratings in App Store Connect")
- Every app had to complete the expanded questionnaire by January 31, 2026; apps that have not are blocked from submitting updates. A brand-new app like Homa's simply answers the new questionnaire at first submission.
- Apple's stated rule for AI: "you must consider how all app features, including AI assistants and chatbot functionality, impact the frequency of sensitive content appearing within your app," and account for what the model CAN surface, not just the default experience. (Apple Developer news; ppc.land; PTKD Journal 2026 explainer)
- There is no automatic minimum rating for chatbot apps; the answers drive the band. General-purpose frontier chat apps (ChatGPT) sit at 13+ with terms requiring 13+ and parental permission under 18. An app whose AI has meaningful guardrails and a narrow domain can plausibly answer to a lower band, but "unrestricted web access" and "user-generated/AI content without filtering" style answers push ratings up.

Homa implication: the honest questionnaire answer for an open-ended AI chat assistant is most likely 13+. That is fine for a parent-facing product and carries no extra obligations. Do NOT chase 4+; a mis-rated app is a 2.3.6 violation and, post-overhaul, mis-rating draws both App Review and regulator attention. Position the listing copy as parent-facing to keep expectations aligned.

---

## 6. Privacy nutrition labels and privacy manifests

- Nutrition labels (App Privacy section in App Store Connect) are mandatory for all new submissions since December 8, 2020, and must accurately declare data collected, linked to identity, and used for tracking. For Homa: identifiers, contact info (email, phone for SMS), user content (chat, family/child data), usage data, purchase history if any, all linked to identity; "tracking" should be No (no cross-app ad tracking), which also avoids the ATT prompt.
- Privacy manifests (PrivacyInfo.xcprivacy): since May 1, 2024, apps and newly added commonly-used third-party SDKs must ship privacy manifests, declare approved "required reason" API usage (UserDefaults, file timestamps, boot time, disk space, keyboards), and listed SDKs must be signed. Enforcement expanded February 12, 2025: any new app including a privacy-impacting SDK, or an update adding one, requires the SDK's manifest. (Apple Developer news "Privacy updates for App Store submissions" and "Reminder: Privacy requirement for app submissions starts May 1"; Apple documentation "Adding a privacy manifest to your app or third-party SDK")
- Expo/React Native specifics: Expo SDK 50+ aggregates privacy manifests from config plugins; Homa must audit its pod graph (analytics, Sentry-type SDKs, Google Sign-In) for manifest presence, and declare required-reason APIs that React Native itself touches (UserDefaults is the classic one). Build failures or ITMS emails at upload are the symptom when this is wrong.
- The November 2025 5.1.2(i) change (section 5) also flows into the label: sharing personal data with third-party AI providers is "data shared with third parties" and must be reflected in both the label and the in-app consent.

---

## 7. Education category, kids rules, and parental gates for a parent-facing app

- Kids Category (guideline 1.3) is opt-in. Homa should NOT opt in: the parent is the user. Kids Category apps face the parental-gate requirement (no external links, purchases, or distractions outside a gated area), bans on third-party analytics/advertising and PII transmission, and stricter data rules (5.1.4). None of that binds a parent-facing app that does not target children and is not rated for young children.
- Parental gates are only required for Kids Category apps and apps primarily targeting kids. A 13+ rated, parent-marketed homeschool assistant does not need one. What Homa must still honor: 5.1.4 caution around handling data ABOUT children (Homa stores child names, ages, progress), which is a privacy-label and consent question, not a gate question; and COPPA does not attach merely because parents input data about their kids, but marketing copy must not invite child use.
- Education category (the store category, not a guideline) carries no special review rules beyond accuracy of categorization; 4.8's education exemption is about institutional sign-in apps and does not apply. Choosing the Education category vs Productivity/Lifestyle is a positioning choice, not a compliance one.
- New in 2026, worth tracking: the Texas App Store Accountability Act (SB 2420, effective January 1, 2026, litigation ongoing: a federal judge paused it December 23, 2025, then the Fifth Circuit stayed that injunction, letting it take effect). Apple published "New requirements for apps available in Texas": Texas users confirm 18+ at Apple Account creation, under-18 accounts join Family Sharing with parental consent for downloads and IAP, and Apple exposes the Declared Age Range API so apps can receive age-category and consent signals. Developer obligation: have a system in place to USE the age signal if received. For a parent-facing 13+ app the practical burden is near zero (read the API, do nothing special for adults), but ignoring the API entirely in a family-oriented app is a small avoidable risk. Utah and other states have copycat laws pending. (Apple Developer news; MoFo client alert November 11, 2025; Venable December 2025; MacRumors December 23, 2025)

---

## 8. App Review demo account requirements (2.1)

Guideline 2.1(a): include demo account credentials in the review notes (and keep the backend on) for any app with a login. If a demo account is impossible for legal/security reasons, a full-featured built-in demo mode is acceptable only with prior Apple approval. 2.1(b): any configured IAPs must be visible, functional, and reviewable, or explained in the notes.

Homa specifics:

- Provide a real, working demo family account on a sandbox tenant. Per project hygiene rules, use a +homatest alias signup so it auto-sandboxes (memory: prod test family hygiene). Seed it with children, progress, and materials so the reviewer sees the real product, not an empty state.
- The demo account must have an ACTIVE subscription state (grandfathered or comped), or the reviewer hits the trial/paywall and evaluates the app as broken or as a purchase flow. With the signup paywall now on (card-upfront 7-day gate flipped 2026-07-28), an unseeded reviewer account would hit a wall immediately; comp the reviewer account server-side.
- SIWA must actually work at review time (Supabase Apple Client IDs founder step), because reviewers do test SIWA.
- If Homa ships with no IAP, state plainly in the review notes: "Homa is a companion app to a web service; accounts and subscriptions are managed on the web; the demo account has full access." Naming the multiplatform posture up front reduces 3.1.1 misfires.

---

## Decision memo: IAP vs external link vs web-subscription-only for Homa v1

Deadline context: July 13, 2026 conference launch has passed; the app release is in flight now, and the goal is fastest approval with lowest fee loss for a $19/mo product whose entire billing stack is already Stripe.

### Option A: web-subscription-only (no purchase surface in the app at all)

The app is free, sign-in only. New users can create an account (needed anyway for review) but subscribing happens on the web; in-app, expired users see a neutral "manage your subscription on the web" state. Under the US storefront rules this may even include a tappable link to the Stripe checkout page (legal post May 1, 2025; zero Apple commission today).

- Requires: nothing new in billing. Account deletion flow (section 4), SIWA revocation, demo account with active sub, privacy labels/manifests, AI-consent moment, age questionnaire.
- Fee loss: zero, forever.
- Approval risk: low-to-moderate. The tier-identical companion pattern is the documented safe harbor (forum thread 825551, May 2026). Risk concentrates on how the trial-expired wall is worded: a hard paywall screen with pricing and a checkout link has drawn 3.1.1 rejections as recently as September 2025 (thread 799798). Keep the expired state informational ("Your Homa plan is managed on the web") rather than a merchandised paywall, and expect possibly one rejection round with a review-notes appeal citing 3.1.1(a)'s US link allowance.

### Option B: external-link checkout as the in-app purchase path

The app actively sells: pricing screen, "Subscribe on the web" button to Stripe checkout, no IAP.

- Fee loss: zero today; a court-set "reasonable commission" (single digits is the informed expectation given the Ninth Circuit excluded security/privacy costs) may arrive after the remand resolves, and the SCOTUS case (decision expected by roughly June 2027) could reshape everything.
- Approval risk: the highest of the three right now. This is exactly the shape rejected in September 2025 and described by practitioners in 2026 as "budget for two rejection rounds." Big incumbents (Spotify, Kindle, Patreon) got through with reader-app status or IAP alongside. A brand-new app doing link-only selling is betting on reviewer roulette in a policy zone Apple is actively litigating.

### Option C: ship IAP (StoreKit subscription), optionally plus external link

- Fee loss: 15% under the Small Business Program (under $1M/yr, which Homa is), so $2.85 of every $19, dropping nothing further since SBP already matches the year-two rate. Real engineering cost: StoreKit products, receipt validation, entitlement sync into Supabase alongside Stripe, restore purchases, price parity decisions, ongoing dual-billing reconciliation (the admin Stripe-reconciliation surface just shipped and would need an Apple leg).
- Approval risk: lowest on the payments axis; 3.1.1 fully satisfied; can add the external link beside IAP later with zero policy risk (Patreon model).

### Recommendation

Ship v1 as Option A: web-subscription-only, tier-identical, no merchandised paywall in the app, with the expired-subscription state phrased as account information and (at most) a plain link to the web account page. Rationale:

1. Lowest engineering cost and zero fee loss, and it keeps Stripe as the single billing brain (the multi-tenant entitlement model stays untouched).
2. It is the documented safe harbor under 3.1.3(b) as enforced in May 2026, whereas link-only selling (Option B) is the documented rejection magnet.
3. The fee landscape is unstable (remand paused, SCOTUS pending). Building IAP now to avoid a fee that is currently zero on web sales is premature; building link-first selling now optimizes into a rule that may change under a court-set commission within a year.
4. Homa acquires customers on the web today anyway (signup paywall, card-upfront trial). The app's v1 job is retention and daily use by existing subscribers, not net-new conversion.

Trigger points to revisit: if App Store becomes a real acquisition channel (organic installs from search), add the external purchase link on the US storefront while the fee is zero (Option B posture, but as an addition to an approved app, which reviews far more gently than a v1); if the district court sets a commission above roughly 10% or SCOTUS restores Apple's 27% regime, price the IAP-vs-link tradeoff then, with SBP 15% as the ceiling that IAP guarantees.

### Pre-submission checklist derived from this report

1. Account deletion in-app, full deletion not deactivation, SIWA token revocation via the Sign in with Apple REST API.
2. SIWA live (Supabase Apple Client IDs founder step done) alongside Google sign-in; 4.8 satisfied.
3. Demo account: +homatest sandbox family, seeded, subscription comped, credentials in review notes, note explaining the web-managed subscription model.
4. Age rating questionnaire answered honestly for an AI assistant: expect 13+; do not chase 4+.
5. Explicit consent moment for sharing personal data with third-party AI (5.1.2(i), November 13, 2025 rule), mirrored in the privacy nutrition label.
6. Privacy manifest audit of the Expo pod graph; required-reason API declarations; listed SDKs signed (February 12, 2025 enforcement).
7. Chat surface has report-content and block affordances (4.7.1 triad) and the objectionable-content filter documented for review.
8. Read the Declared Age Range API signal (Texas SB 2420, in effect January 1, 2026 after the Fifth Circuit stay) even if the response for adults is a no-op.
9. No paywall screens, no pricing, no purchase CTAs in v1 outside the neutral web-account link; keep tier-identical presentation for all signed-in users.

---

## Sources

Litigation and payments:
- IPWatchdog, "High Court Grants Cert in Apple's Challenge to Ninth Circuit Contempt Ruling" (June 30, 2026): https://ipwatchdog.com/2026/06/30/high-court-grants-cert-in-apples-challenge-to-ninth-circuit-contempt-ruling-in-app-store-dispute/
- MacRumors, "Epic Games Wins Reversal of Stay in App Store Fee Legal Battle" (April 29, 2026): https://www.macrumors.com/2026/04/29/epic-games-wins-reversal-app-store-fee-battle/
- MacRumors, "Apple Wins Ability to Charge Fees on External Payment Links as Appeals Court Modifies Epic Injunction" (December 11, 2025): https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/
- TechCrunch, "Apple loses bid to pause App Store fee changes as case heads to Supreme Court" (April 29, 2026): https://techcrunch.com/2026/04/29/apple-epic-games-app-store-fees-pause-changes-supreme-court/
- 9to5Mac, "Apple to ask court to halt Epic Games proceedings pending Supreme Court ruling" (July 1, 2026): https://9to5mac.com/2026/07/01/apple-to-ask-court-to-halt-epic-games-proceedings-pending-supreme-court-ruling/
- 9to5Mac, "Apple asks judge to pause Epic Games case during Supreme Court review" (July 7, 2026): https://9to5mac.com/2026/07/07/apple-asks-judge-to-pause-epic-games-case-during-supreme-court-review/
- 9to5Mac, "Epic fights Apple's request to pause App Store commission proceedings" (July 13, 2026): https://9to5mac.com/2026/07/13/epic-games-fights-apples-request-to-pause-app-store-commission-proceedings/
- 9to5Mac, "Apple seeks Supreme Court review of contempt finding" (May 21, 2026): https://9to5mac.com/2026/05/21/apple-seeks-supreme-court-review-of-contempt-finding-and-injunction-scope-in-epic-games-case/
- Fenwick, "Ninth Circuit Largely Upholds Ruling in Epic v. Apple" (December 2025): https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple
- Shinder Cantor Lerner, "Ninth Circuit Upholds Apple Contempt Finding But Narrows Scope of Remedial Relief": https://scl-llp.com/ninth-circuit-upholds-apple-contempt-finding-but-narrows-scope-of-remedial-relief/
- Cravath, "Epic Games' Ninth Circuit Win Affirming Civil Contempt Finding": https://www.cravath.com/news-insights/epic-games-ninth-circuit-win-affirming-civil-contempt-finding.html
- Apple stay application to SCOTUS (May 4, 2026): https://www.supremecourt.gov/DocketPDF/25/25A1213/407958/20260504154515930_2026-05-04%20Apple-Epic%20SCT%20Application%20to%20Stay%20Mandate.pdf
- Frankfurt Kurnit (fkks), "Apple violated U.S. court order, ending Apple's 27% commission" (May 2025): https://technologylaw.fkks.com/post/102ka4o/apple-violated-u-s-court-order-ending-apples-27-commission-on-external-purcha
- AppleInsider, "Apple's App Store Guidelines updated to reflect court order" (May 2, 2025): https://appleinsider.com/articles/25/05/02/apples-app-store-guidelines-updated-to-reflect-court-order-over-external-purchases
- iClarified, "Apple Updates App Store Rules to Allow External Purchase Links in US": https://www.iclarified.com/97192/apple-updates-app-store-rules-to-allow-external-purchase-links-in-us
- Michael Tsai, "App Review Guidelines Updated for Epic Anti-Steering" (May 2, 2025): https://mjtsai.com/blog/2025/05/02/app-review-guidelines-updated-for-epic-anti-steering/
- TechXplore, "These are the apps that can now avoid Apple's in-app payment system" (May 2025): https://techxplore.com/news/2025-05-tech-apps-apple-app-payment.html
- GSMArena, "Spotify adds external subscription links to the iOS app" (May 2025): https://m.gsmarena.com/spotify_adds_external_subscription_links_to_the_ios_app_following_us_court_decision-news-67632.php
- RevenueCat, "App-to-web: navigating external purchases in iOS and Android apps" (December 9, 2025, updated February 20, 2026): https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines
- RevenueCat, "Apple must allow External Payment Links" (2025): https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy
- Stora, "How to Add External Purchase Links to Your iOS App in 2026" (May 16, 2026): https://stora.sh/blog/2026-05-16-apple-app-store-external-purchase-links-implementation-guide
- Neon Commerce, "Apple Alternative Payment Fees: What Developers Pay (2026)": https://www.neonpay.com/blog/apple-app-store-alternative-payment-fees-what-developers-pay-in-2026
- PTKD Journal, "Why did Apple reject my app under 3.1.1 for an in-app purchase link?": https://ptkd.com/journal/apple-rejection-3-1-1-in-app-purchase-links
- Apple developer forum thread 799798, Stripe paywall rejection (September 2025): https://developer.apple.com/forums/thread/799798
- Apple developer forum thread 825551, 3.1.3(b) tier-aware rejection (May 2026): https://developer.apple.com/forums/thread/825551

Guidelines, privacy, age rating:
- Apple App Review Guidelines (live, fetched July 28, 2026): https://developer.apple.com/app-store/review/guidelines/
- Apple Developer news, "Updated App Review Guidelines now available" (November 13, 2025): https://developer.apple.com/news/?id=ey6d8onl
- TechCrunch, "Apple's new App Review Guidelines clamp down on apps sharing personal data with third-party AI" (November 13, 2025): https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai
- TechRepublic, "Apple Updates App Review Guidelines": https://www.techrepublic.com/article/news-apple-app-review-guidelines-ai-data-sharing/
- MacRumors, "Apple Overhauls App Store Age Ratings" (July 25, 2025): https://www.macrumors.com/2025/07/25/apple-overhauls-app-store-age-ratings/
- TechCrunch, "Apple broadens App Store's age rating system" (July 25, 2025): https://techcrunch.com/2025/07/25/apple-broadens-app-stores-age-rating-system
- Apple Developer news, "Updated age ratings in App Store Connect": https://developer.apple.com/news/?id=ks775ehf
- PTKD Journal, "App Store age ratings in 2026: the 2025 overhaul explained": https://ptkd.com/journal/app-store-age-ratings-2025-update
- ppc.land, "Apple updates App Store age ratings system": https://ppc.land/apple-updates-app-store-age-ratings-system-with-granular-controls/
- Apple Developer news, "Account deletion requirement starts June 30" (2022): https://developer.apple.com/news/?id=12m75xbj
- Transcend, "Navigating Apple's In-App Account Deletion Requirement": https://transcend.io/blog/apple-requirement-app-account-deletion
- Ketch, "Apple delete account requirement": https://www.ketch.com/blog/posts/apple-delete-account-requirement
- Apple Developer news, "Privacy updates for App Store submissions" (privacy manifests): https://developer.apple.com/news/?id=3d8a9yyh
- Apple Developer news, "Reminder: Privacy requirement for app submissions starts May 1" (2024): https://developer.apple.com/news/?id=pvszzano
- Apple documentation, "Adding a privacy manifest to your app or third-party SDK": https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk
- Apple Small Business Program (15% commission under $1M): https://developer.apple.com/app-store/small-business-program/

Texas and age assurance:
- Apple Developer news, "New requirements for apps available in Texas": https://developer.apple.com/news/?id=btkirlj8
- Morrison Foerster, "Texas App Store Law Takes Effect After Fifth Circuit Stays Preliminary Injunction" (November 11, 2025): https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law
- Venable, "New App Developer Compliance Requirements to Take Effect in 2026" (December 2025): https://www.venable.com/insights/publications/2025/12/new-app-developer-compliance-requirements
- MacRumors, "Texas App Store Age Verification Law Blocked by Federal Judge" (December 23, 2025): https://www.macrumors.com/2025/12/23/texas-app-store-law-blocked/
- Pillsbury, "The App Store Accountability Act: Overview and Initial Considerations": https://www.pillsburylaw.com/en/news-and-insights/app-store-accountability-act-texas.html
