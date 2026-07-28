# Research report 09: Mobile subscription paywall best practices, 2026

Scope: web research for the Homa iOS App Store launch plan. Covers hard vs soft paywall data, trial design, paywall anatomy, price presentation at the ~$19/mo point, Apple win-back and cancellation mechanics, education/family category benchmarks, and paywall A/B infrastructure for React Native/Expo. Homa context throughout: web charges $19/mo via Stripe with a 7-day card-upfront trial; zero paying customers today, so no testimonial, rating, or count claims are legally usable on any paywall (Homa paywall claims law, plus FTC endorsement rules and Apple guideline 2.3.1 on accurate metadata).

Primary sources: RevenueCat State of Subscription Apps 2026 (115,000+ apps, $16B+ revenue, 1B+ transactions), Adapty 2026 paywall and education benchmarks, Superwall product data, Apple developer documentation, and legal analyses of the 2025 FTC and Epic v. Apple developments. A Reddit/X sweep via the last30days script failed on a local SSL error, so all findings are web sourced.

---

## 1. Hard vs soft paywall: what the 2026 data actually says

The two big datasets appear to conflict. They do not; they measure different denominators.

**RevenueCat SOSA 2026 (per-install economics):**
- Hard paywalls convert downloads to paid at a 10.7% median (Day 35) vs 2.1% for freemium, roughly 5x. Top decile of hard-paywall apps reaches 38.7%.
- Revenue per install: hard paywall apps generate about 8x higher RPI by day 60 ($3.09 vs $0.38).
- Long-run retention is nearly identical between models (27% hard vs 28% freemium at 1 year), so the hard gate does not poison the cohort.
- Cost: hard-gated apps see refund rates roughly 70% higher than freemium.

**Adapty 2026 (per-paywall-view economics):**
- Soft paywalls outconvert hard ones by about 50% on paywall-view-to-payment (4.85% vs 3.34%), because a soft paywall is shown to warmer users.
- But hard paywalls still deliver about 21% higher LTV (median $41.90 vs, at the 90th percentile, $89.90 vs $70.00 on soft).
- Paywalls triggered after a measurable value moment see trial start rates about 2.1x higher than immediate hard gates (RocketShip HQ summarizing Adapty 2026).

**Read for a PM:** hard-gating during onboarding wins on per-user economics and is the dominant 2026 pattern for high-intent, high-price consumer apps. Homa's web product is already effectively hard-gated (card-upfront signup paywall), and RevenueCat's data says that model carries to mobile. The refund-rate penalty and Apple's easy-refund culture are the tax. The strongest hybrid in the data: onboard first, land one concrete value moment (for Homa, the first-making artifact moment already built into chat-first onboarding), then present a hard gate. Adapty: onboarding paywalls convert 1.35% (with trial) vs 0.89% for in-app paywalls, and 90% of trial starts happen on Day 0, so the gate must be in the first session.

Sources: [RevenueCat SOSA 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/), [State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps), [neoads: 2.1% vs 10.7%](https://neoads.substack.com/p/hard-paywalls-convert-less-but-earn), [Airbridge hard vs soft](https://www.airbridge.io/en/blog/hard-vs-soft-paywalls), [Adapty: high-performing paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/), [RocketShip HQ Adapty benchmark summary](https://www.rocketshiphq.com/adapty-subscription-app-benchmark-2025-summary/), [tasu.ai analysis](https://tasu.ai/library/hard-paywall-vs-free-trial-conversion).

## 2. Trial design: 7-day card-style vs freemium, and trial length

**Opt-out (card/commitment upfront) vs opt-in trials:**
- Opt-out trials (payment method on file, auto-converts) convert at roughly 50-60%; opt-in trials (no payment commitment) average about 25%. Softletter found the same 50% vs 25% split.
- Opt-in attracts 3-4x more signups; net pipeline often comparable. Opt-out filters for intent, which matters more when support and compute costs per trial are high (true for an AI product like Homa).
- On iOS, every App Store free trial on an auto-renewable subscription is structurally opt-out: Apple has the payment method and auto-converts. So the App Store version of Homa's "7-day card-upfront trial" is simply a 7-day introductory free trial offer; there is no card-entry step to design.

**Trial length (RevenueCat SOSA 2026, trial-to-paid medians):**
- 4 days or fewer: 25.5%
- 5-9 days (the 7-day bucket): 37.4%
- 17-32 days: 42.5%
- Despite longer trials converting better, the market is moving shorter: 46.5% of apps now run sub-4-day trials (up from 42.1%), largely to compress payback for paid UA. Adapty adds a monetization-per-cohort counterpoint: the single highest one-year-LTV configuration in their data is a weekly plan with a 3-day trial (about 1.5x the average LTV of all other configurations), and 7-day-or-shorter trials outperform 14-30 day options on LTV in their dataset.
- Trial cancellation timing: 55.4% of 3-day-trial cancellations happen on Day 0 and 84% by Day 1. The trial is won or lost in the first session; Day-4-style mid-trial reminder and value emails (which Homa already ships on web, PR #273) remain the right play.
- Education-specific: education apps mostly choose mid-length trials already (about 50% run 5-9 days), education trial-to-paid median is 31% (RevenueCat) or 25.6% global average (Adapty), and trials raise LTV in Education (+50.4% trial LTV premium over direct buyers, Adapty). Trials are the right mechanism for this category; Adapty flags Education as a category where trials help rather than hurt.

**Read for a PM:** keep the 7-day trial on iOS. It matches Homa's web offer (avoids cross-platform price/term confusion), sits in the 37.4%-median bucket, matches category norm, and Education is a category where trials demonstrably add LTV. Freemium would cut download-to-paid by roughly 5x per RevenueCat. A 3-day trial is the aggressive alternative only if paid UA payback ever becomes the binding constraint.

Sources: [Growth Spree B2B/consumer trial benchmarks by card requirement](https://www.growthspreeofficial.com/blogs/b2b-saas-trial-to-paid-conversion-rate-benchmarks-2026-by-trial-type-acv-length-credit-card), [Adapty trial conversion rates](https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/), [RevenueCat SOSA 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/), [Business of Apps trial benchmarks](https://www.businessofapps.com/data/app-subscription-trial-benchmarks/), [Adapty high-performing paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/).

## 3. Paywall screen anatomy that converts (2026 consensus)

Converging recommendations across Adapty, Apphud, Qonversion, funnelfox, and SwiftUI template benchmarks:

1. **Single screen, no scrolling.** Top-performing paywalls fit headline, benefits, plans, and CTA in one viewport (Adapty 2026 pattern analysis).
2. **Headline restates the user's motivation,** not the product ("Your homeschool, handled" beats "Go Premium"). Consistency from ad to onboarding to paywall measurably lifts conversion (Apphud).
3. **3-5 benefit bullets or a Free vs Pro comparison table** with checkmarks, capped at 4-6 rows. Comparison tables now appear across top Fitness, Education, Productivity, and AI paywalls (Adapty).
4. **Plan block:** annual pre-selected and visually distinct (border/glow), monthly-equivalent framing on the annual ("$8.33/mo, billed annually"), a "Best value / Save X%" badge. See section 4 caveats on badge claims.
5. **Benefit-led CTA:** "Start my 7-day free trial" or "Start my plan" outperforms "Subscribe" or "Continue" (Apphud, funnelfox).
6. **Trust zone near the CTA:** transparent renewal terms ("7 days free, then $19.99/mo. Cancel anytime in Settings"), restore-purchases link, privacy/terms links (Apple-required anyway). Standard slots for ratings and testimonials exist here, but Homa must leave them empty until real customers exist (see section 7).
7. **Personalized loaders** ("Building Finn's plan...") between onboarding and paywall are a top-app pattern (Adapty); Homa's chat-first onboarding with the first-making artifact is a stronger version of the same idea.
8. **Decline path:** a light close affordance (delayed or low-contrast X). Post-close welcome offers shown only to non-converters within 24h is a documented 2026 pattern (Adapty), and 9 in 10 subscriptions still sell at full price, so discounting is a targeted tool, not a default.

What A/B tests actually win (Adapty 2026 experiments data): pricing and structure beat cosmetics. Highest LTV win rates: localization tests 62.3%, trial structure 59.6%, plan duration 58.7%. Visual/copy-only tests win just 34.6% of the time. Apps running 14.7+ experiments per year earn up to 40x more revenue than non-experimenters (correlational, but directionally strong).

Sources: [Adapty high-performing paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/), [Apphud paywall design guide](https://apphud.com/blog/design-high-converting-subscription-app-paywalls), [Qonversion paywall anatomy](https://qonversion.io/blog/how-to-design-paywall-that-converts), [funnelfox paywall screens](https://blog.funnelfox.com/effective-paywall-screen-designs-mobile-apps/), [Adapty paywall library](https://adapty.io/paywall-library/), [The Swift Kit paywall templates](https://theswiftk.it.com/blog/swiftui-paywall-design-best-practices), [appstemple pricing screen patterns](https://www.appstemple.com/guides/pricing-screen-conversion/).

## 4. Price presentation at the ~$19/mo point

**Where $19/mo sits:** global median monthly subscription price is $12.99; education median annual is $44.99 on RevenueCat's data (highest annual median of any category) and $38.42 on Adapty's. $19/mo, roughly $228/yr if not discounted annually, is firmly "high-priced." That is good news: RevenueCat 2026 shows high-priced apps convert downloads to paid at a 2.8% median (top quartile above 6.1%) vs 1.4% for low-priced, and high-priced apps earn about 3x the LTV of low-priced competitors (Adapty). Price is a quality signal in this category; do not discount the monthly to chase the $12.99 median.

**Plan mix and anchoring:**
- Education buyers skew annual: 59-66% of education subscriptions sell as yearly plans (RevenueCat education page). Homa currently sells monthly-only on web; the iOS launch is the natural moment to add an annual SKU.
- Classic anchoring structure for a $19/mo product: show monthly first or alongside to set the anchor, present annual as the deal, pre-select annual, express it as a monthly equivalent. Example: $19.99/mo vs $119.99/yr shown as "$10/mo, billed annually ($119.99), save 50%." People anchor on the first number seen (RevenueCat pricing-psychology, Voucherify, Simon-Kucher).
- Decoy tier: a deliberately unattractive higher tier lifts mid-tier selection (documented language-app case where adding a pricier "Plus" tier raised standard-annual conversion). For launch, two plans (monthly + annual) is the standard and sufficient; add a decoy/premium tier only as a later experiment.
- Weekly plans: 55.6% of subscription revenue across Adapty's dataset now comes from weekly plans, and in Education specifically weekly generated 52% of 2025 revenue share. But weekly retention is terrible (5.5% of weekly-trial education subscribers still active at Day 380 vs 19.9% for annual), weekly pricing reads as impulse-app behavior, and it would fragment against Homa's $19/mo web price. Skip weekly at launch; treat it strictly as a later experiment if UA economics demand it.
- Annual churn warning: 72% of annual subscribers across the industry cancel within year 1 and 35% of annual cancellations happen in month 1 (RevenueCat 2026). Annual is a cash-flow and commitment win, not a retention guarantee; the product still has to re-earn the renewal.
- Per-unit reframing ("less than $0.70/day for your whole homeschool") is a legitimate persuasion device, but the billed amount must stay the most conspicuous number (Apple 3.1.2, ROSCA, CA ARL; see sections 5 and 7).
- Cross-platform parity: keep the iOS monthly at $19.99 (Apple price tier) vs $19 web. Do not price iOS higher to offset commission; users compare, and Homa's web funnel is the reference price.

Sources: [RevenueCat pricing psychology](https://www.revenuecat.com/blog/growth/subscription-pricing-psychology-how-to-influence-purchasing-decisions/), [Apphud pricing psychology tactics](https://apphud.com/blog/subscription-pricing-psychology), [Voucherify price anchoring](https://www.voucherify.io/glossary/price-anchoring), [Simon-Kucher decoy pricing](https://www.simon-kucher.com/en/insights/positioning-decoy-pricing-shape-how-customers-perceive-value), [RevenueCat SOSA 2026 education](https://www.revenuecat.com/state-of-subscription-apps-2026-education/), [Adapty education benchmarks](https://adapty.io/blog/education-app-subscription-benchmarks/).

## 5. Apple mechanics: paywall rules, cancellation, win-back offers

**Paywall content Apple requires (App Review Guideline 3.1.2, top rejection source):**
- The paywall (in the binary) must show: subscription title, length/renewal period, price (and per-unit price where applicable), plus functional links to privacy policy and Terms of Use (EULA). The EULA link must also appear in App Store Connect metadata (App Description or EULA field).
- The billed amount must be "clear and conspicuous": reviewers judge font, size, color, and placement. The most common trial-related rejection is making "7 days free" visually louder than "$19.99/month." Design rule: the price gets at least equal visual weight to the free-trial promise.
- Auto-renewal disclosure ("renews automatically unless cancelled") near the purchase button is the safe pattern.

**Cancellation:** Apple owns it. Users cancel in Settings > Apple Account > Subscriptions; apps cannot process or obstruct cancellation and gain nothing by hiding it. Best practice (and a trust play consistent with Homa's voice laws): link directly to the manage-subscriptions sheet in-app. Apple provides exit-survey and retention-messaging hooks; billing grace period and billing-retry should be enabled in App Store Connect (Google Play comparison: 31% of Play cancellations are involuntary billing failures vs 14% on the App Store, so this matters more on Android later).

**Win-back offers (WWDC 2024 feature, mature by 2026):**
- Free or discounted offers for churned subscribers. Eligibility is enforced by Apple; developers configure minimum paid duration, time since lapsed, and an optional cooldown in App Store Connect.
- Up to 350 offers can be created per subscription but only 5 live per storefront per subscription; priority ordering decides which shows.
- Surfaces: the App Store itself (product page, editorial), in-app via StoreKit messages or custom paywalls, the user's Subscriptions settings, and unique URLs. With streamlined purchasing, lapsed users can redeem directly in the App Store without reopening the app.
- Requirements: iOS 18+, StoreKit 2. RevenueCat tracks win-back events and lets you filter charts by offer type.
- For launch: configure one conservative win-back offer (for example, 50% off first month back, eligible 30+ days after lapse) so the App Store surfaces work from day one; it costs nothing until someone churns.

Sources: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [RevenueCat App Store rejection guide](https://www.revenuecat.com/blog/growth/the-ultimate-guide-to-app-store-rejections), [RevenueCat guide to Apple win-back offers](https://www.revenuecat.com/blog/growth/guide-to-apple-win-back-offers), [Apple: set up win-back/promotional offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-promotional-offers-for-auto-renewable-subscriptions/), [Adapty Apple subscription offers guide](https://adapty.io/blog/apple-subscription-offers-guide/), [AppsOps promotional offers mechanics](https://appsops.store/blog/ios-subscription-promotional-offers).

## 6. Education/family category benchmarks (the numbers to plan against)

RevenueCat SOSA 2026, Education category:
- Download-to-trial (D30): 6.5% median, above the all-category average.
- Trial-to-paid: 31% median.
- Download-to-paid (D35): 2.2% median, third best of all categories behind Health & Fitness (2.9%) and Business (2.6%).
- Annual plan share: 59-66% of subscriptions sold yearly; median annual price $44.99, the highest of any category.
- Slow deciders: only 28.5% of education conversions happen on Day 0 (lowest same-day share of major categories), and 78.5% of education trials start on D0 vs 89.9% in Business. Education buyers evaluate longer.
- Realized LTV per payer: $15.26 first month, $22.82 at one year (mid-tier; note Homa at $19/mo with real retention would be far above this median).

Adapty education benchmarks:
- Install-to-trial 10.9%, trial-to-paid 25.6% (global averages for the category).
- 12-month LTV $45.10, third across categories; trial users show a +50.4% LTV premium over direct buyers.
- 23.5% of education trial starts happen 31+ days after install, the highest late-start share of any category: keep the paywall and trial reachable well after first launch, not only in onboarding.
- Retention at Day 380 by plan: annual 19.9%, monthly 14.2%, weekly 5.5%.
- Concentration warning: the top 10% of education apps capture 96% of category subscription revenue.

Benchmark caution: one widely cited Adapty-derived figure puts average trial-to-paid at 53% across categories (RocketShip HQ summary). The spread vs 25.6% is a denominator artifact (which trials are counted, billing-reached vs started). Use RevenueCat's funnel (6.5% download-to-trial, 31% trial-to-paid, 2.2% download-to-paid) as the planning baseline; treat anything at or above those medians in the first 60 days as on-track and top-quartile numbers (download-to-paid above roughly 4-6%) as the stretch goal.

Sources: [RevenueCat SOSA 2026 Education](https://www.revenuecat.com/state-of-subscription-apps-2026-education/), [Adapty education benchmarks](https://adapty.io/blog/education-app-subscription-benchmarks/), [Business of Apps trial benchmarks](https://www.businessofapps.com/data/app-subscription-trial-benchmarks/).

## 7. Legal and claims constraints specific to Homa

- **No testimonials, ratings, counts, or "most popular" badges** until real paying customers exist. This is already Homa law (paywall claims laws, 2026-07) and matches FTC endorsement rules; Apple 2.3.1 (accurate metadata) applies the same to App Store screenshots and description. Substitutes that are legal today: concrete product proof (real generated worksheets/plans as screenshots), a transparent founder note, precise deliverable lists, and the trial terms themselves as the trust device.
- **"Save 40%" style badges** are fine only if the math is real against an actually offered monthly price.
- **FTC click-to-cancel:** the Negative Option Rule was vacated by the Eighth Circuit on July 8, 2025 on procedural grounds, days before its July 14 effective date. Do not treat this as deregulation: ROSCA still requires clear disclosure of terms, informed consent, and simple cancellation for the Stripe/web side, California's ARL requires charge terms in visual proximity to the consent button (already implemented on Homa's web paywall), and the FTC has moved to revive the rule. State AGs remain active. The safe posture: build as if click-to-cancel were law; on iOS Apple enforces easy cancellation anyway.
- **Cross-platform disclosure:** if the iOS app links to web checkout (section 9), the web page must carry the same clear-and-conspicuous renewal terms; ROSCA governs that page, not Apple.

Sources: [DLA Piper on the vacated rule](https://www.dlapiper.com/en/insights/publications/2025/07/ftcs-click-to-cancel-rule-voided), [Sidley analysis](https://www.sidley.com/en/insights/newsupdates/2025/07/us-ftc-click-to-cancel-rule-struck-down), [Crowell on FTC revival efforts](https://www.crowell.com/en/insights/client-alerts/clicking-all-the-right-boxes-ftc-moves-to-revive-click-to-cancel-rule-following-eighth-circuit-vacatur), [WilmerHale on continuing state/federal exposure](https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule-but-federal-and-state-regulators-likely-to-remain-active).

## 8. Paywall A/B infrastructure for React Native/Expo

Homa mobile is Expo. Three vendor options plus homegrown:

**RevenueCat (Purchases + Paywalls + Experiments):**
- Pros: the default subscription backend for indie/seed apps; largest docs/community; `react-native-purchases` + `react-native-purchases-ui` give native-rendered paywalls (SwiftUI/Jetpack Compose under the hood); Experiments does offering-level A/B with revenue-based readouts; free until $2.5k MTR, then 1% of tracked revenue; first-class Expo docs (dev build required, not Expo Go); Stripe integration can unify web and iOS entitlements in one customer record, which matters for Homa's existing Stripe base.
- Cons/known issues: Experiments enroll new customers only (existing users stay on the default offering); community reports of Paywalls v2 experiments misbehaving in React Native and an Android black-screen crash with Expo SDK 53/RN 0.79; paywall templates are more constrained than Superwall's editor.

**Superwall:**
- Pros: paywall-first; the most powerful no-code editor and event-driven placement rules (show any paywall on any event without app releases); subscription infrastructure now free at any scale with billing only on revenue through Superwall-rendered paywalls; Scale tier $199/mo adds Demand Score ML price optimization; processes $1.5B+/yr across 10,000+ apps.
- Cons: paywalls render in a WKWebView (slower first paint, less native feel, offline weakness vs native rendering); the original React Native SDK was deprecated June 2025 and the supported path is their Expo SDK requiring Expo SDK 53+ (Homa must confirm its Expo version); pairing Superwall paywalls on top of RevenueCat purchases is a common but two-vendor setup.

**Adapty:**
- Pros: native-rendered paywall builder with full React Native and Expo support; strong A/B tooling; the 2026 benchmark reports quoted throughout this doc are theirs; free to $5k MTR (cheapest in the $2.5k-5k band); claims 15-30% typical conversion lift after adopting builder + A/B.
- Cons: would replace RevenueCat as the subscription backend to get full value; smaller ecosystem than RevenueCat.

**Homegrown:**
- Full control, no revenue share, paywall as a normal React Native screen driven by your own remote config. But you rebuild: remote paywall config, audience targeting, exposure logging, stats engine, StoreKit 2/Play Billing handling, receipt validation, and cross-platform entitlement sync with Stripe. Adapty's experiments data (structure tests win, 14.7+ experiments/yr correlates with 40x revenue) implies the real cost of homegrown is iteration speed, not the first paywall. Only sensible with an existing feature-flag and analytics stack and dedicated engineers; not a fit for Homa's team size before launch.

**Recommendation shape for Homa:** RevenueCat as the purchases/entitlement layer (its Stripe integration unifies the existing web subscribers with iOS IAP entitlements, and Homa already lives in that indie tooling ecosystem), start with RevenueCat Paywalls + Experiments for launch, and treat Superwall-on-top as a later upgrade only if paywall iteration velocity becomes the bottleneck. Test structure first (trial length, annual price point, plan order), not colors: that is where the measured win rates are.

Sources: [RevenueCat Expo docs](https://www.revenuecat.com/docs/getting-started/installation/expo), [RevenueCat Experiments](https://www.revenuecat.com/feature/experiments), [RevenueCat Paywalls](https://www.revenuecat.com/feature/paywalls), [RN paywall v2 experiments issue](https://community.revenuecat.com/sdks-51/paywall-experiments-with-paywall-v2-not-working-in-rn-6278), [Superwall pricing](https://superwall.com/pricing), [Superwall Expo SDK](https://superwall.com/blog/increase-revenue-with-superwalls-expo-sdk/), [The Swift Kit RevenueCat vs Superwall](https://theswiftk.it.com/blog/revenuecat-vs-superwall-ios-paywalls), [buildmvpfast three-way comparison](https://www.buildmvpfast.com/blog/revenuecat-vs-superwall-vs-adapty-in-app-subscription-indie-2026), [PkgPulse comparison](https://www.pkgpulse.com/guides/revenuecat-vs-adapty-vs-superwall-mobile-in-app-2026), [Adapty vs Superwall](https://adapty.io/compare/superwall/).

## 9. Stripe vs IAP on iOS (US external purchase links, state of play mid-2026)

Directly relevant because Homa already bills $19/mo via Stripe on web:

- Since the April 30, 2025 Epic v. Apple contempt ruling, US-storefront iOS apps may include an external link to web checkout (Stripe et al) with, currently, zero Apple commission. This is US-only.
- December 2025: the Ninth Circuit ruled Apple may collect a "reasonable commission" on such external-link purchases; the district court is determining the rate during 2026, with the injunction framework effective until November 1, 2027. Zero-commission linking is a window, not a permanent state.
- Conversion reality: Adapty measures in-app paywall purchases converting better than web checkout handoffs (1.60% vs 1.10% for in-app placements). The friction of leaving the app is real; most consumer apps use IAP as the primary in-app path even where linking is legal.
- Practical pattern for Homa: IAP (via RevenueCat) as the in-app purchase path, Stripe stays the web path, RevenueCat unifies entitlements across both. Existing web subscribers simply sign in on iOS (Apple permits account-based access to previously purchased content). An external-link "Subscribe on the web" affordance is a legitimate US-only experiment for margin, at a measured conversion cost.

Sources: [RevenueCat: Stripe after Epic v. Apple](https://www.revenuecat.com/blog/engineering/can-you-use-stripe-for-in-app-purchases), [RevenueCat anti-steering analysis](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy), [MacRumors on the Dec 2025 appeals ruling](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/), [Adapty on Stripe for IAP](https://adapty.io/blog/can-you-use-stripe-for-in-app-purchases/), [Cleverbridge app2web analysis](https://grow.cleverbridge.com/blog/apple-vs-epic-a-legal-turning-point).

## 10. Summary recommendations for the Homa iOS paywall

1. Hard gate after the onboarding value moment (first-making artifact), not before it. Keep freemium off the table: 5x download-to-paid difference, identical 1-year retention.
2. Keep the 7-day free trial on iOS (37.4% median trial-to-paid bucket; category norm; trials add +50% LTV in Education). Mid-trial value messaging mirrors the web Day-4 reminder.
3. Ship two SKUs at launch: $19.99/mo and an annual at roughly $99-$120 pre-selected with monthly-equivalent framing. Education sells 59-66% annual; Homa has no annual today, so this is the single biggest pricing gap.
4. Single-screen paywall: motivation headline, 4-6 benefit rows or Free-vs-Homa table, plan block with annual highlighted, "Start my 7-day free trial" CTA, price equally conspicuous with the trial promise (Apple 3.1.2), terms/privacy/restore links.
5. No testimonials, ratings, counts, or popularity badges anywhere (no customers yet; Homa law plus FTC/Apple rules). Product-proof screenshots and plain terms are the trust layer.
6. RevenueCat for purchases + entitlement unification with Stripe web subscribers; RevenueCat Paywalls + Experiments for A/B at launch; structure tests (trial length, annual price, plan order) before cosmetic tests.
7. Configure one Apple win-back offer at launch (iOS 18+, StoreKit 2, up to 5 live per storefront); link the manage-subscription sheet in-app rather than hiding cancellation.
8. Plan against the education funnel medians: 6.5% download-to-trial, 31% trial-to-paid, 2.2% download-to-paid at D35; education users decide slowly (only 28.5% of conversions on Day 0, 23.5% of trials start 31+ days post-install), so keep the paywall reachable from settings/locked surfaces indefinitely.
