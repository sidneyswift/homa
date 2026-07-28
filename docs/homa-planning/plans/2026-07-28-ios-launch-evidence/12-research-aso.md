# ASO research for Homa's iOS launch (July 2026 rules) plus draft store copy

Research date: 2026-07-28. Scope: web research on current App Store metadata rules, 2026 ranking factors, screenshot and video practice for subscription apps, the homeschool and education keyword landscape, category choice, and concrete drafted ASO copy for Homa. Product facts grounded in repo: app name "Homa", bundle `com.thankshoma.homa`, version 1.0.0 (`apps/mobile/app.json`), price $19/mo with a 7-day card-upfront trial (signup paywall live 2026-07-28), first release already in flight (PR #72, per project memory).

A note on evidence quality: metadata limits and Apple guideline text are hard facts from Apple and major ASO vendors. Conversion-lift percentages and "since July 2025 CPPs rank organically" claims come from ASO industry blogs (AppFollow, MobileAction, Phiture, AppTweak, ASOMobile); treat exact percentages as directional. Exact keyword volume and difficulty numbers for homeschool terms were NOT obtainable from public pages in this session; the section below gives structure, the competitive set, and how to pull real numbers for free before submission.

## 1. Metadata fields and limits (confirmed current for 2026)

| Field | Limit | Indexed for search | Notes |
|---|---|---|---|
| App name (title) | 30 chars | Yes, strongest weight | Guideline 2.3.7 bans keyword stuffing, trademarked terms, and pricing info in the name |
| Subtitle | 30 chars | Yes, second strongest | Shown under the title in search results |
| Keyword field | 100 chars (technically 100 bytes) | Yes, medium weight | Comma-separated, no spaces after commas, single words not phrases, singular form covers plural, never repeat words already in title/subtitle or the category name |
| Promotional text | 170 chars | No | Editable without a new build; use for offers and freshness |
| Description | 4,000 chars | No on iOS | Pure conversion copy; Apple does not index it for search |
| What's New | 4,000 chars | No | Release notes |
| In-app event name | 30 chars | Yes | See section 4 |
| In-app event short description | 50 chars | Yes | Long description is 120 chars |

Total indexed text budget per locale: 160 characters (30 + 30 + 100). Search queries are matched by combining words ACROSS title, subtitle, and keyword field, so "homeschool" in the title plus "planner" anywhere else ranks the app for "homeschool planner" without ever writing the phrase. Repetition adds nothing; each word counts once.

Cross-localization multiplier: the US storefront also indexes the metadata of several secondary locales (English UK, Spanish Mexico, Arabic, Chinese simplified and traditional, French, Korean, Portuguese Brazil, Russian, Vietnamese). Filling English keywords into es-MX and en-GB fields is a legitimate, still-working 2026 technique that can take the indexable footprint from 160 chars toward 1,440 on the US storefront. Recommended as a post-launch iteration, not a launch blocker.

Sources: AppLaunchFlow character-limit reference, ASOMobile text optimization, AppFollow title playbook, MobileAction cross-localization guide, aso.dev cross-localization guide.

## 2. What ranks in 2026

The 2026 consensus across AppTweak, AppFollow, Phiture, AppRadar, and ASOMobile:

1. Keyword metadata (title, subtitle, keyword field) still opens the door. Title carries the most weight.
2. Downloads velocity and conversion rate on the search term decide position. Apple watches whether people who search a term actually install your app.
3. Retention and engagement now carry weight comparable to metadata. Apps with strong D7 retention are reported ranking above higher-download competitors. For Homa this means the store listing must attract the RIGHT parents, not the most parents; a mismatched install that churns hurts ranking.
4. Ratings: average, volume, and recency. Review velocity matters; suspicious velocity is penalized. With zero paying customers at launch, the plan should include the native `SKStoreReviewController` prompt placed after a genuine win moment (a finished week, a first printable), never before value.
5. Screenshot caption text: multiple vendors report Apple OCR-indexes screenshot caption text as of mid-2025. Even if the ranking weight is small, it is free: put real keywords in captions.
6. Metadata freshness is reported as a minor positive signal; ship metadata updates with feature releases.
7. New in 2026: Apple is testing AI-generated category tags derived from the whole metadata set (title, subtitle, keywords, description, screenshots). These currently affect browse placement, not search. Practical consequence: the description is no longer purely a conversion surface; write it so a machine summarizing it lands on "homeschool planning and materials for parents."
8. Localization is repeatedly named a top factor fleet-wide, but for a US homeschool product at launch, US English plus the cross-localization trick is the right scope.

Sources: AppTweak ranking factors, AppFollow ASO ranking factors 2026, Phiture ASO trends 2026, ASOMobile listing 2026, AppRadar academy.

## 3. Custom product pages (CPPs)

- Up to 70 CPPs per app (Apple raised the cap from 35; vendors date the raise between Oct 2025 and early 2026).
- Since July 2025 CPPs can be assigned keywords and appear in ORGANIC search, not just as Apple Ads landing pages. Only about 31% of apps use any CPPs, so this is an open lane.
- Each CPP gets its own screenshots, promo text, and preview video, and its own analytics.
- Homa launch plan (small, high leverage): three CPPs.
  1. "homeschool planner" intent: screenshots lead with the weekly plan and calendar.
  2. "homeschool printables / worksheets" intent: screenshots lead with materials studio output, a real worksheet in a parent's hand.
  3. "homeschool record keeping / hours tracker" intent: screenshots lead with hours log and progress view.
- The default product page then stays the broad "assistant that does all of it" story.

Sources: MobileAction "Custom product pages meet organic search", AppFollow ranking factors, DualMedia CPP 2026, Phiture trends.

## 4. In-app events

- Metadata: event name 30 chars, short description 50 chars, long description 120 chars, plus event card art. Name and short description are search-indexed, which makes events a small recurring keyword surface and a freshness signal.
- Events appear on the product page, in search results, and can be featured editorially. Up to 10 approved events, 5 live at once.
- Homa fit: homeschool life is seasonal and event-shaped. Obvious calendar: "Back to homeschool week" (Aug), "Plan your spring semester" (Jan), "Portfolio and records week" (May), "Not-back-to-school" (Sep, a real homeschool community tradition). Each event is also an excuse for a push of fresh metadata and editorial consideration.
- Education apps get editorial consideration more often than saturated categories; a well-made seasonal event is Homa's cheapest shot at a feature.

Sources: Apple WWDC21 in-app events, MobileAction in-app events guide 2026, AppRadar IAE guide, AppDrift optimization guide.

## 5. Screenshots and preview video for a subscription app

Specs (2026): supply only the 6.9-inch iPhone size, 1320x2868 portrait (1290x2796 accepted); Apple auto-scales down. 1 to 10 screenshots per locale. Homa's app is portrait-only and phone-only (`apps/mobile/app.json`: `supportsTablet: false`), which keeps the asset matrix small.

What converts, per Adapty, AppTweak, App Guardians, ASOMobile, and the AppLaunchpad:

- The first 3 screenshots do almost all the work; most visitors never scroll past them in search results. Vendors report a 20 to 35% conversion lift from optimizing the first three alone. Treat them as the elevator pitch: value promise, then core usage, then differentiation.
- Captions: short, benefit-led, verb-first, one idea per image ("Your week, planned in a chat" beats "Weekly planner feature"). Captions are now OCR-indexed, so include real keywords naturally.
- Portrait screenshots so 3 show at once in search results; the first image should be self-explanatory with no context.
- Subscription-app specifics: never show the paywall in screenshots; show outcomes. Apple rejects metadata where trial framing overshadows the billed price (see section 8), but screenshots simply should not discuss price at all (guideline 2.3.7 says no pricing in metadata assets).
- The common "Trust" third slot (ratings, awards, press) is UNAVAILABLE to Homa: no paying customers means no testimonials, ratings, or counts (project law, homa-paywall-claims-laws). Substitute a concrete artifact: a photo-real printable, the Friday letter, a filled week. Real output is Homa's social proof.

Recommended 6-screenshot storyboard for the default page:
1. The week, planned: chat + week grid. Caption: "Plan the whole week in one chat"
2. A real printable: worksheet render. Caption: "Worksheets made for your child, ready to print"
3. Progress and hours: progress view. Caption: "Hours and progress, recorded as you go"
4. Celebration: Friday letter / wins surface. Caption: "Every win gets noticed"
5. The assistant: a warm conversation. Caption: "Ask for anything, in plain words"
6. Everything together: calendar/planner. Caption: "One place for your homeschool"

Preview video: verdict, skip at launch. Evidence is genuinely mixed: autoplay in iOS search drove large lifts in some studies (up to +47%), but category data shows video HURTS conversion 3 to 7% in utility-shaped categories (Finance, Productivity) where users want screenshots and reviews, and helps mostly in games, social, and visual media. Homa is a calm utility for busy parents; a static first-3 that reads in two seconds is the safer bet. Revisit with a Product Page Optimization (PPO) A/B test after launch; PPO tests are free, run on live traffic, and are the correct way to answer this per-app rather than by industry average.

Sources: Adapty screenshot guide, AppTweak screenshot optimization, ScreenshotWhale specs, AppDrift sizes, SplitMetrics preview video guide, AppFollow video strategies 2026, AppScreenshotStudio 2026 conversion guide.

## 6. Homeschool and education keyword landscape

Hard numbers require an ASO tool login or an Apple Ads account (its keyword planner popularity score, 5 to 100 scale, is free with any Apple Ads account, no spend needed; scale is exponential and half of all keywords score under 25). Public pages in this session did not expose exact volumes for homeschool terms. What the public record does establish:

Structure of the niche:
- Head terms: "homeschool" (broad, mixed intent), "homeschool planner" (the clearest high-intent head term for Homa), "homeschool apps".
- Mid-tail with strong intent: "homeschool tracker", "homeschool schedule", "homeschool record keeping", "homeschool portfolio", "homeschool curriculum" (huge homeschool-world term, but intent is often content-shopping rather than tool-shopping), "attendance tracker", "lesson planner".
- Style and philosophy tail: "unschooling", "charlotte mason", "unit study", "classical conversations", "montessori". These are cheap to index (one keyword-field word each) and signal insider fluency.
- "AI tutor": high volume, high difficulty, and mostly WRONG intent for Homa: searchers want a kid-facing tutor, Homa is a parent-facing assistant. Do not spend title space on it; the single word "tutor" in the keyword field combines with "ai" in the title to cover the phrase at zero extra cost.

Competitive set on the store (all Education category, none owning "AI homeschool assistant"):
- Homeschool Panda: management + community, subscription.
- Homeschool Planet: full-featured planner with a lesson-plan marketplace.
- Homeschool Tracker: 20-year record-keeping brand.
- Homeschool Moment: the closest AI story (AI writes portfolio entries from photos), free tier then $12/mo or $99/yr. Watch this one; it is the only competitor marketing AI, and it undercuts Homa on price.
- Syllabird (high-school transcripts), Applecore (attendance/hours, iOS only), My School Year (7-time reader-award planner), HomeTrail (free), Strew (UK, philosophy-flexible).

Implications:
- The niche is real but shallow: incumbents are small, mostly non-AI, and split by sub-need (planning vs records vs community). Homa's "one assistant that does all of it" is a genuinely open position.
- "homeschool planner" is the best title keyword bet: clear tool intent, incumbents rank on it, none pair it with AI.
- Parents' stated pain points (per the 2026 comparison content): documentation with minimal effort, portfolio building, budget, philosophy fit. Homa's copy should speak to the first two directly. Do NOT chase the third-party sites' "state compliance" framing in store copy; that is a claims-law violation for Homa (no state-filing or legal-compliance implications).

Action before submission (30 minutes, free): pull Apple Ads popularity scores for the ~20 terms above from the Apple Ads keyword planner and rank the keyword field by popularity x relevance / difficulty. The draft field in section 9 is built on intent logic and should be sanity-checked against those numbers.

Sources: AppsFlyer and MobileAction keyword research guides, SplitMetrics Apple Ads popularity index, AppFollow popularity score docs, Homeschool Moment 2026 comparison, Homeschooling4Him 15 best apps, LearnSpark lesson-planning apps 2026.

## 7. Category choice

Recommendation: primary Education, secondary Productivity.

- Education is where every homeschool competitor sits, where parents browse for this shape of tool, and where Apple's AI category tags will land Homa anyway given the metadata. Education apps also get editorial consideration disproportionately often relative to their competition level.
- Homa is a parent tool, not a kids app: do NOT enroll in the Kids category, which triggers stricter rules (ads, data, parental gates) that do not apply to a parent-facing assistant. Education primary does not force Kids enrollment.
- Productivity as secondary captures the "family organizer / planner" browse audience and is credible for a planning tool. Note the category-level evidence that preview videos underperform for Productivity-shaped expectations, reinforcing the no-video launch call.
- Lifestyle is a junk-drawer category (horoscopes to smart homes); it would strip Homa of education editorial eligibility and signal nothing. Rejected.
- Category ranking math favors this: a top-50 slot in a focused category beats a top-200 slot in a broad one, and Education's homeschool shelf is winnable given the incumbent set in section 6.

Sources: ASO World category guide, This Is Glance category impact pieces, AppTweak category download trends, businesstats category share.

## 8. Compliance guardrails for the listing (subscription app, $19/mo, 7-day trial)

- Guideline 3.1.2: the description (or the purchase flow) must state the subscription name, length, and price, and App Store Connect metadata must carry working privacy policy AND terms-of-use (EULA) links. Missing EULA link in the description or the EULA field is a top rejection cause for subscription apps.
- The billed amount must be at least as conspicuous as the trial. "Free for 7 days" may never be visually or verbally louder than "$19/month". The description draft below follows this.
- Guideline 2.3.7: no pricing in the app NAME, subtitle, screenshots, or previews; no trademarked competitor terms in keywords.
- Homa claims laws (project law, stricter than Apple): no testimonials, ratings, star imagery, or user counts anywhere; no state-filing or legal-compliance claims; charge terms near any purchase button in-app (ROSCA/CA ARL).

Sources: Apple App Review Guidelines, RevenueCat community 3.1.2 threads, wenhaofree 3.1.2 rejection guide, shopapper 2.3.7/5.2.1 guide.

## 9. Draft ASO copy for Homa

All counts verified by script. Voice: warm, plain, sentence case, reassure before inform, offers never commands, no em dashes, no overclaiming.

### Title options (30 max)

| Option | Chars | Rationale |
|---|---|---|
| A. `Homa: AI homeschool planner` | 27 | RECOMMENDED. "homeschool planner" is the highest-intent head term; "AI" is the differentiator no incumbent owns; combines to rank for "ai planner", "homeschool ai" free. |
| B. `Homa: AI homeschool assistant` | 29 | Truest to the product category. "assistant" has weaker search demand than "planner"; better positioning, worse ranking. |
| C. `Homa: homeschool made simple` | 28 | Pure conversion/brand play; gives up the AI token and a second keyword. Only if the founder wants warmth over rank. |

### Subtitle options (30 max)

| Option | Chars | Rationale |
|---|---|---|
| A. `Weekly plans and printables` | 27 | RECOMMENDED with title A. Adds three indexed tokens (weekly, plans, printables) that combine into "homeschool printables", "weekly planner". |
| B. `Plan, print, track, celebrate` | 29 | The product in four verbs; strong conversion read, decent tokens. |
| C. `Your week, planned and printed` | 30 | Warmest read; weakest keyword yield. |

### Keyword field (100 max), built for title A + subtitle A

`curriculum,tutor,worksheets,tracker,preschool,kindergarten,portfolio,records,hours,unit,study,mom` (97 chars)

No word repeats title or subtitle. Notable combinations Apple will index across fields: homeschool curriculum, homeschool tracker, homeschool worksheets, homeschool portfolio, homeschool records, homeschool hours, homeschool mom, ai tutor, unit study, preschool curriculum, kindergarten worksheets, weekly tracker. Swap "mom" for "grade" or "diary" if Apple Ads popularity data disagrees. If title B (assistant) is chosen instead, add `planner,` at the front and drop `unit,study` (puts it at 98).

### Promotional text (170 max)

`You are doing more than you think. Homa plans the week, makes the printables, keeps the hours, and notices the wins. Try it free for 7 days.` (140 chars)

Alternate: `Homeschooling is a lot to carry. Homa plans the week, makes the printables, keeps the hours, and notices the wins. Your first 7 days are free.` (142 chars)

### Full description (not indexed; written for conversion and for Apple's AI category tagging)

```
Homeschooling asks a lot of you. Homa is an assistant that carries the busy work, so more of your time goes to your kids.

Tell Homa about your family once. From then on it plans your week, makes your materials, keeps your records, and remembers what each child is working on.

PLAN THE WEEK IN A CHAT
Say what you want to cover and Homa lays out the week. Move things around, swap a subject, or ask for a lighter day. The plan bends around your real life, not the other way around.

PRINTABLES MADE FOR YOUR CHILD
Worksheets, copywork, and practice pages made to fit each child's level and interests. Ask for dinosaurs in the math practice and you will get dinosaurs in the math practice. Print and go.

RECORDS WITHOUT THE SPREADSHEET
Homa logs hours, subjects, and progress notes as you go. When you need a clean record of what you did, it is already there.

WINS GET NOTICED
Homa pays attention to what your kids finish and celebrates it with you, from first steps to big milestones. Progress you can see, without pressure and without comparison.

ONE ASSISTANT, NOT TEN APPS
Planner, materials, records, and encouragement in one place. Ask for anything in plain words. If Homa cannot do something, it says so.

PRICE AND TRIAL
Homa is $19 per month. New families get a 7 day free trial, and you can cancel anytime during the trial and pay nothing. Payment is charged to your Apple Account when the trial ends. The subscription renews monthly until you cancel, at least 24 hours before the period ends, in your App Store settings.

Privacy policy: https://thankshoma.com/privacy
Terms of use: https://thankshoma.com/terms

Questions? We read everything: hello@thankshoma.com
```

Notes on the description: the two URLs and support address are placeholders to confirm before submission; a working terms-of-use link in the description or the EULA field is a 3.1.2 requirement. The price paragraph deliberately leads with $19 before the trial, per 3.1.2 conspicuousness rules. No testimonials, counts, ratings, or compliance claims anywhere, per project law. Description headers use caps as a store-formatting convention; all sentences remain sentence case per Homa voice. If caps headers feel off-brand, plain sentence-case headers work too; the caps are only a scannability convention in store listings.

## 10. Open questions and next actions

1. Pull Apple Ads popularity scores for the section 6 term list (free, 30 min) and re-rank the keyword field. Owner: whoever holds the Apple Ads login (founder-action shaped).
2. Founder pick: title A vs B (rank vs positioning).
3. Confirm live privacy and terms URLs on thankshoma.com and the support address before submission.
4. Build the 6-screenshot set at 1320x2868 from real product output (materials-studio artifacts are the social proof).
5. After launch: PPO A/B test screenshot order, then test a preview video against no-video; create the 3 CPPs in section 3; schedule the first in-app event for back-to-homeschool season (August, weeks after launch).
6. Wire the native review prompt after a first genuine win moment; review velocity is a 2026 ranking factor and Homa starts at zero.

## 11. Sources

- AppLaunchFlow, App Store metadata character limits 2026: https://www.applaunchflow.com/blog/app-store-metadata-character-limits-2026
- ASOMobile, text optimization: https://asomobile.net/en/blog/lesson-3-text-optimization-for-the-app-store/
- AppFollow, ASO title playbook 2026: https://appfollow.io/blog/app-store-optimization-title
- AppTweak, App Store ranking factors: https://www.apptweak.com/en/aso-blog/app-store-ranking-factors
- AppFollow, ASO ranking factors 2026: https://appfollow.io/blog/aso-ranking-factors
- Phiture, ASO trends 2026: https://phiture.com/asostack/aso-trends-in-2026/
- ASOMobile, App Store listing 2026: https://asomobile.net/en/blog/app-store-listing-2026-what-actually-affects-rankings/
- MobileAction, custom product pages meet organic search: https://www.mobileaction.co/blog/custom-product-pages-meet-organic-search/
- DualMedia, CPPs changing ASO in 2026: https://www.dualmedia.fr/en/custom-product-pages-aso/
- MobileAction, in-app events guide 2026: https://www.mobileaction.co/guide/in-app-events-promotional-content-guide/
- AppRadar, Apple in-app events: https://appradar.com/blog/apple-in-app-events-iae
- Apple, WWDC21 in-app events: https://developer.apple.com/videos/play/wwdc2021/10171/
- Adapty, App Store screenshots best practices: https://adapty.io/blog/app-store-screenshots-optimization/
- AppTweak, screenshot optimization: https://www.apptweak.com/en/aso-blog/how-to-optimize-your-app-screenshots
- App Guardians, 10 screenshot best practices: https://appguardians.com/blog/10-tips-to-create-screenshots-that-boost-your-conversion/
- ScreenshotWhale, screenshot requirements: https://screenshotwhale.com/blog/app-store-screenshot-requirements
- AppDrift, screenshot sizes 2026: https://appdrift.co/blog/how-to-create-perfect-app-store-screenshot-sizes
- SplitMetrics, app preview videos for iOS: https://splitmetrics.com/blog/create-app-preview-video-app-store-ios/
- AppFollow, ASO video strategies 2026: https://appfollow.io/blog/aso-video-strategies
- SplitMetrics, Apple search popularity index: https://splitmetrics.com/blog/apple-search-popularity-index/
- AppFollow, keyword popularity score: https://support.appfollow.io/hc/en-us/articles/360020832897-Keyword-Popularity-Score
- AppsFlyer, ASO keyword research: https://www.appsflyer.com/blog/tips-strategy/aso-keyword-research-optimization/
- MobileAction, ASO keyword research 2026: https://www.mobileaction.co/blog/aso-keyword-research/
- ASO World, iOS keyword field optimization: https://asoworld.com/blog/how-can-you-optimize-the-ios-keyword-field-to-maximize-app-store-traffic/
- AppLaunchFlow, keyword field guide 2026: https://www.applaunchflow.com/blog/app-store-keyword-field-guide-2026
- MobileAction, cross-localization: https://www.mobileaction.co/blog/app-store-cross-localization/
- aso.dev, cross-localization guide: https://aso.dev/metadata/cross-localization/
- Apple, App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- RevenueCat community, 3.1.2 rejection thread: https://community.revenuecat.com/general-questions-7/rejected-due-to-guideline-3-1-2-business-payments-subscriptions-4775
- shopapper, metadata rejection 5.2.1 and 2.3.7: https://shopapper.com/fix-app-store-metadata-rejection-guideline-5-2-1-2-3-7/
- MobileAction, how to name an app 2026: https://www.mobileaction.co/blog/how-to-name-an-app/
- Homeschool Moment, activity tracking apps 2026 comparison: https://homeschoolmoment.com/blog/best-homeschool-activity-tracking-apps-2026
- Homeschooling 4 Him, 15 best homeschool apps 2026: https://homeschooling4him.com/homeschool-apps/
- LearnSpark, homeschool lesson planning apps 2026: https://learnspark.io/blog/homeschool-lesson-planning-apps
- ASO World, category choice: https://asoworld.com/blog/app-store-categories-how-to-choose-the-right-app-category-to-boost-organic-traffic/
- This Is Glance, category impact: https://thisisglance.com/blog/the-hidden-impact-of-app-categories-on-your-store-performance
- AppTweak, category download trends: https://www.apptweak.com/en/reports/app-downloads-by-category
