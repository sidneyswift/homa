# Strong Workout Tracker Gym Log: onboarding + paywall copy deck

Source: Appllama (app_id 464254577, category fitness). Screens pulled journey-ordered via list_app_screens; 8 of 37 screens viewed as images. Captured 2026-08-31. Verbatim third-party capture: third-party punctuation preserved exactly as rendered.

## Flow overview

- 37 screens total: 5 onboarding (1 intro video + 4 image screens), 1 paywall screen, 31 other-tab screens.
- Account gate: at the very START. Screen 2 (Welcome) offers Sign in with Apple / Sign Up / Log In / Google / Facebook; screen 3 is the sign-up form. No guest path visible on the welcome screen.
- No personalization quiz, no loading/generation moment. Onboarding is: welcome, sign up, land on the working Start Workout screen, one tutorial modal.
- Paywall position: NOT in the forced onboarding path. The single paywall (Subscription Offer) lives in the fifth bottom-nav tab, "Store" (the tab bar is visible and active on the paywall itself). It is pull-based, reached from the Store tab and from in-product "PRO" unlock badges (see S24, S33).

## S2 Welcome

- H: Welcome to Strong
- Sub: Your workout journey starts here.
- CTA 1 (black, Apple mark): Sign in with Apple
- CTA 2 (blue): Sign Up
- Inline links (footer row): Log In · Google · Facebook
- Layout economy: ~16 words on screen. 6 elements (photo backdrop, H, sub, 2 buttons, 1 link row). Full-bleed dark gym photo; no feature claims at all.

## S3 Sign Up

- Back affordance (top left): Back
- Field labels: Username / Password / Email Address
- CTA (blue): Sign Up
- Terms line: By signing up you agree to our Privacy Policy
- Layout economy: ~15 words. 5 elements (back link, 3 labeled fields, button, one legal line). No password rules, no marketing copy, no name field.

## S4 Start Workout (first landed screen)

- H (large title): Start Workout
- Info banner (sparkle icon): Strong 6.4: Calendar and Activity widgets. / [More] [X]
- Section label: Quick Start
- CTA (blue): Start an Empty Workout
- Section label: Templates / + Template
- Sub-section: My Templates (0)
- Empty-state card: Tap to Add New Template
- Sub-section: Example Templates (0)
- Tab bar: Profile / History / Start Workout / Exercises / Store
- Layout economy: ~30 words. Roughly 9 elements. The first post-signup screen is the working product, not a tour.

## S5 Workout Tutorial (modal over S4)

- H: Getting started with Strong
- Body: This is the Start Workout screen.
- Body: From here, you can begin a workout from scratch or from templates you prepare in advance.
- Body: Let’s walk you through your first workout in Strong.
- CTA (gray): Let’s do this!
- Layout economy: ~37 words. 1 modal, 1 button. The only tutorial copy in the whole onboarding.

## S6 Subscription Offer (paywall, Store tab)

- Kicker (small, gray): Train smarter with Strong PRO.
- H (bold, large): Unlock the most intuitive and powerful workout tracker, designed to push you towards your fitness goals.
- Plan card 1 (gray, unselected): $4.99 / MONTH — Get full access to Strong PRO for 1 month
- Plan card 2 (blue, selected): $29.99 / YEAR — Get full access to Strong PRO for 12 months
- Plan card 3 (gray, unselected): $99.99 / ONCE — Lifetime access to all Strong Pro Features
- Fine print, para 1: Strong PRO is available as a monthly or yearly subscription. Strong will automatically charge your iTunes Account at the end of your subscription or free trial period unless auto-renew is turned off at least 24 hours before the end of your current period. Subscriptions renew at the original price. Strong PRO Forever is a one time in-app purchase.
- Fine print, para 2: You can turn off auto-renew at any time and still receive full functionality until the end of your current period, but we can’t refund unused portions of the subscription. In-app purchases and subscriptions cannot be shared using Family Sharing.
- Decline affordance: none needed; it is a bottom-nav tab (Profile / History / Start Workout / Exercises / Store all visible), so the user just taps another tab.
- Layout economy: ~150 visible words, of which ~100 are legal fine print. 6 elements above the fine print (kicker, headline, 3 price cards, tab bar). No purchase button visible in this capture; the price cards are the selectors. No testimonials, no ratings, no feature checklist, no countdown, no "most popular" badge.

## S15 Workout Summary (post-workout celebration, other-tabs 9)

- H (under gold stars): Great Job!
- Sub: That’s your 1st workout!
- Card: Afternoon Workout / Thursday, Jul 23 / 42s · 30 lb · 6 PRs
- Card table: Exercise / Best Set; 1 × Arnold Press (D... / 2 lb × 10; 1 × Around the World / 2 lb × 5
- Badge (bottom): 6 Personal Records
- Layout economy: ~30 words. Star confetti + 1 card + 1 badge. Celebration is a receipt of the session, no upsell on this screen.

## S24 Exercise Charts (Pro feature gate, other-tabs 18)

- Sheet title: Arnold Press (Dumbbell) / Edit
- Tabs: About / History / Charts / Records
- Chart card 1: Arnold Press (Dumbbell) / Best Set (Est. 1RM)
- Chart card 2: Arnold Press (Dumbbell) / Best Set (Max Weight)
- Chart card 3: Arnold Press (Dumbbell) / Total Volume
- Gate badge (crown icon, repeated over each blurred-data chart): Unlock Charts with PRO
- Layout economy: gate copy is 4 words, repeated per chart. The locked charts still render axes and a teaser line, so the user sees exactly what they would get.

## S33 Profile Dashboard (Pro upsell card, other-tabs 27)

- Banner (yellow): Please verify your email address. / [Details]
- Profile row: morrissun / 1 workout
- Section: Dashboard / + Widget
- Upsell card (crown icon): Charts, Analytics and Insights
- Upsell body: Track your progression in 1RM, exercise volume or your best sets. Charts are key to quantifying your gains
- Upsell CTA (gray): Discover PRO Features
- Layout economy: ~35 words. One card, one CTA. "Discover", not "Buy": the CTA routes to the Store paywall rather than asking for money here.

## Unviewed screens

Onboarding: S1 (untitled intro video, position 1).
Other tabs, in position order: S7 Start Workout Home, S8 Workout Templates, S9 Empty Active Workout, S10 Exercise Picker, S11 Active Workout, S12 Rest Timer Overlay, S13 Active Workout Sets, S14 Save Template Prompt, S16 Template Exercise Picker, S17 New Workout Template, S18 Template Preview, S19 Active Workout Log, S20 Workout Set Entry, S21 Exercise Library, S22 Exercise About, S23 Exercise History, S25 Exercise Records, S26 Create Exercise Form, S27 Exercise Category Menu, S28 Exercise Created Toast, S29 Cardio Exercise Records, S30 Workout History, S31 Workout Calendar, S32 Workout Detail, S34 Measurements, S35 Settings General, S36 Settings Units & Data, S37 Settings Support.

## Reading

- Near-zero-persuasion onboarding: the entire pre-product copy load is ~68 words (welcome 16, sign-up 15, tutorial 37). No quiz, no benefit carousel, no social proof; the app itself is the pitch. The one tutorial modal speaks in first-person-plural coach voice ("Let’s walk you through your first workout in Strong. / Let’s do this!").
- The account gate is total and immediate (screen 2 of the app, five auth options), which is the opposite of the current soft-gate fashion; Strong spends its trust budget on brand recognition, not on deferred signup.
- Price is framed as duration-for-access, not value-per-day: each card is literally "Get full access to Strong PRO for N months" with the raw sticker ($4.99 MONTH / $29.99 YEAR / $99.99 ONCE). No anchoring math, no "save 50%", no trial CTA, no urgency. Two-thirds of the paywall's word count is Apple-compliance fine print.
- Monetization pressure lives in-product instead: locked charts render with real teaser data behind a 4-word crown badge ("Unlock Charts with PRO"), and the profile upsell card sells the outcome ("Charts are key to quantifying your gains") with a low-commitment verb ("Discover PRO Features"). The paywall is a destination you choose (a Store tab), never an interruption.
