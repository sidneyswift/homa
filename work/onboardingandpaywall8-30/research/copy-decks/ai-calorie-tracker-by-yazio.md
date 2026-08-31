# AI Calorie Tracker by Yazio: onboarding + paywall copy deck

Source: Appllama (app_id 946099227, health), journey-ordered screen walk. Captured 2026-08-31. Verbatim third-party capture: all quoted strings are transcribed exactly as rendered, including third-party punctuation.

## Flow overview

- 84 screens total in the library walk: 3 welcome, 50 onboarding, 1 dedicated paywall, 30 other-tab screens. Position 1 of both welcome and onboarding is a video walkthrough (not transcribed).
- Account gate: **absent**. There is no email/account-creation step anywhere in the journey. The welcome screen offers "I already have an account" for returning users; the only identity input is a first-name text field (Name Entry, onboarding 6). Personalization is device-local until purchase.
- Paywall position: **end**, a single "Subscription Offer" screen after the full ~50-step onboarding quiz (welcome 3 + onboarding 50, then paywall). Post-onboarding monetization continues in-app: a countdown "special offer" card on Diary Home with an Unlock CTA, and a gamified diamonds Shop where tracking streaks earn a "3-Day Pro Pass".
- Viewed for transcription: 12 screens (capped). Everything else is listed under Unviewed screens.

## S1 Onboarding Intro (welcome 3, first interactive screen)

- Logo: "yazio" (lowercase wordmark)
- H: "Hit your goal weight in a few taps a day"
- Visual: flat food illustration (fruit bowl, carrot, timer icon), 4-dot carousel
- CTA (primary, dark pill): "Get Started"
- CTA (secondary, outline pill): "I already have an account"
- Layout economy: ~15 visible words, 6 elements (logo, headline, illustration, dots, 2 buttons). No body copy at all.

## S2 Main Goal Question (onboarding 2)

- H: "What’s your main goal?"
- Options (single-select rounded fields):
  - "Lose weight"
  - "Eat healthier without losing weight"
  - "Gain weight"
  - "Build muscle"
  - "Something else"
- CTA: "Next" (disabled until a choice is made)
- Layout economy: ~17 words, 8 elements (back chevron, progress bar, title, 5 options, CTA). No helper text.

## S3 Sex Selection (onboarding 5)

- H: "What's your sex?"
- Body: "Since the formula for an accurate calorie calculation differs based on sex, we need this information to calculate your daily calorie goal."
- Options (two large cards): "Female" / "Male"
- Helper link (bottom, with info icon): "Which sex should I select?"
- Layout economy: ~32 words, 6 elements. The one question that justifies itself with a why-we-ask paragraph plus an escape-hatch link.

## S4 Mascot Greeting (onboarding 7)

- Speech bubble (from mascot): "Nice to meet you, Morris!"
- Visual: full-screen teal yeti mascot, no button (auto-advance moment)
- Layout economy: 5 words, 2 elements (bubble + mascot). Uses the name typed on the prior screen.

## S5 Use Case Confirmation (onboarding 10)

- H: "I’ll use Yazio to..."
- Body: "track my progress daily so I can follow through on my goals."
- Instruction (teal, bold): "Tap and hold the icon to commit"
- Visual: mascot-face app icon inside a hold-to-commit ring
- Layout economy: ~24 words, 4 elements. First-person commitment device; headline and body form one sentence in the user's voice.

## S6 Restrictive Dieting Info (onboarding 15)

- H: "Restrictive dieting can cause a yo-yo effect."
- Body 1 (beside Columbia University logo): "According to a study from Columbia University, those with a history of yo-yo dieting had increased cardiovascular risks compared to those who maintained a consistent weight."
- Body 2 (beside Asian Association for the Study of Diabetes logo, cut off by the button): "The Asian Association for the Study of Diabetes states that frequent, significant weight changes can increase the risk" [truncated at fold]
- CTA: "Continue"
- Layout economy: ~60 words, 5 elements. The densest copy in the flow, anchored by two institution logos as trust marks.

## S7 Positive Effects Preview (onboarding 41)

- H: "You’ll see positive effects on your health and well-being in no time. You can look forward to:"
- Benefit list (emoji bullets):
  - 🍭 "Reduced risk of diabetes"
  - ❤️ "Lower blood pressure"
  - 🌱 "Improved cholesterol levels"
- CTA: "Got It"
- Layout economy: ~29 words, 6 elements. Headline carries the promise; bullets are 3-4 word noun phrases.

## S8 Social Proof Reviews (onboarding 45)

- H: "Be part of something great!"
- Body: "Millions of people are using YAZIO to achieve their goals. Now, it's your turn. Start writing your success story today!"
- Review card 1 (5 stars): "The best calorie counting app on the market! Straightforward and easy to use!" — "Adam, 24"
- Review card 2 (partially off-screen, 5 stars): "“Yazio he[...] inner cou[...] app’s hel[...]" — "Chris, 53" [truncated at screen edge]
- Visual: collage of real customer before/after style photos
- CTA: "Got It"
- Layout economy: ~50 visible words, 6 elements. Note the brand rendered "YAZIO" all-caps in body copy here, "Yazio" elsewhere.

## S9 Awesome Transition (onboarding 47)

- H: "Awesome!"
- Body: "Taking the time to carefully track your food and, most importantly, staying consistent is the key to success. You’ve got this!"
- CTA: "Let's Go"
- Layout economy: ~25 words, 4 elements. Pure encouragement beat, no data collected.

## S10 Subscription Offer (paywall 1, the primary and only journey paywall)

- Decline affordance: circular ✕, top right
- Visual: celebrating mascot surrounded by food icons
- H: "We’ll help you lose weight to hit 70.0 kg by September 29!" (personalized with the user's goal weight and a computed date)
- Badge (on annual card): "Most popular"
- Plan card 1 (highlighted, mint fill): "12 months" · "$95.96" (struck through) "$47.90" · "$3.99/month"
- Plan card 2: "3 months • $23.99" · "$8.00/month"
- Additional plan cards are cut off below the fold
- Terms line: "Cancel anytime"
- CTA (dark pill): "Continue"
- Layout economy: ~27 visible words, 8 elements. No trial language, no feature list, no testimonial, no legal auto-renew paragraph on the visible screen; the entire pitch is the personalized outcome headline plus two price cards.

## S11 Shop: rewards banner (other-tabs 22, in-app "Premium Paywall" surface)

- Nav title: "Shop" · diamond balance "0"
- Banner H: "Unlock brand-new rewards!"
- Banner body: "Trade your diamonds for useful items that make it easier to stay on track."
- Section: "New items" · card: "Pro Pass" · 💎 "1,000"
- Section: "Daily Diamonds" · card: "Morning Boost Chest" · "Track food between 6:00 AM and noon to unlock." · "Locked"
- CTA (blue pill): "Keep Collecting Diamonds"
- Layout economy: ~45 words, 7 elements. Monetization gamified as an earned currency rather than a cash ask.

## S12 Shop: chests and boosters (other-tabs 23, scrolled Shop)

- Card: "Morning Boost Chest" · "Track food between 6:00 AM and noon to unlock." · "Locked"
- Card: "Evening Energy Chest" · "Track food between 6:00 PM and midnight to unlock." · "Locked"
- Card: "Saturday Flavor Chest" · "Track food on Saturday to unlock." · "Locked"
- Section: "Boosters" · card: "3-Day Pro Pass" · "Get full Pro access for 3 days, starting right now." · 💎 "1,000"
- CTA: "Keep Collecting Diamonds"
- Layout economy: ~50 words, 5 elements. Habit loops (time-of-day tracking) are the price of Pro trial access.

## Unviewed screens

Welcome: 1 (untitled video walkthrough), 2 Splash Screen.

Onboarding: 1 (untitled video walkthrough), 3 Main Goal Question Alert, 4 Referral Source Question, 6 Name Entry, 8 Motivation Question, 9 Self Improvement Question, 11 Progress Encouragement, 12 Almost There Transition, 13 Welcome Splash, 14 Weight Loss Experience, 16 Sustainable Weight Loss Intro, 17 Past Challenges Question, 18 Support Promise, 19 Weight Impact Question, 20 Journey Change Question, 21 Support Network Question, 22 Encouragement Story, 23 Calorie Tracking History, 24 Calorie Tracking Balance, 25 Fasting History Question, 26 Staying On Track Plan, 27 Journey Feeling Question, 28 Support Reassurance, 29 Future Self Question, 30 Achievement Visualization, 31 Birthday Date Picker, 32 Height Input, 33 Activity Level Question, 34 Activity Tracking Setup, 35 Health Access Permission, 36 Health Access Permission, 37 Current Weight Input, 38 Current Weight Input, 39 Nutrition Feedback Intro, 40 Goal Weight Input, 42 Special Event Question, 43 Event Date Picker, 44 Goal Setting Encouragement, 46 Daily Time Commitment, 48 Tracking Challenge Length, 49 Streak Habit Education, 50 Diet Type Question.

Other tabs: 1 Diary Home (carries a "Special Offer Countdown Card" + dark "Unlock" CTA), 2 Nutrition Tracker, 3 Measurements, 4 Daily Task Notes, 5 Snap Tracking Intro (unlock CTA), 6 Barcode Scanner, 7 Add Food Search Empty, 8 Food Search Results, 9 Dietary Intake Tracker, 10 Nutrition Facts Form, 11 Food Detail, 12 Recipe Discover, 13 Recipe Category Home, 14 Recipe Recommendations, 15 Favorites Empty State, 16 Favorite Ingredients, 17 Recipe Filter, 18 Advanced Recipe Filter, 19 Ingredient Explorer, 20 Food Diary Empty, 21 Notes Calendar, 24 Fasting Overview, 25 Intermittent Fasting, 26 Fasting History Empty, 27 Profile Overview, 28 Profile Badges, 29 Profile Friends, 30 Settings.

## Reading

- **Two voices, deliberately split.** Questions are terse second person in a chunky display face ("What’s your main goal?", 3-6 words); the user answers in first person via commitment devices ("I’ll use Yazio to... track my progress daily", "Tap and hold the icon to commit"); and a named mascot speaks in bubbles ("Nice to meet you, Morris!"). Long sentences appear only on the two science screens, where institution logos (Columbia University, Asian Association for the Study of Diabetes) carry the credibility instead of adjectives.
- **The 50-step quiz is mostly therapy, not data.** Only ~10 screens collect calculator inputs (sex, birthday, height, weights, activity); the rest are motivational-interviewing beats (past challenges, support network, how the journey feels, future self) punctuated every few steps by an encouragement interstitial ("Awesome!", "You’ve got this!"). Effort invested becomes the sunk cost the paywall spends.
- **Price is framed as a personalized outcome, in ~27 words.** The paywall headline restates the user's own numbers ("We’ll help you lose weight to hit 70.0 kg by September 29!"), anchors per-month ($3.99/month against $8.00/month), shows a ~50% strikethrough on the annual plan, and the only terms line is "Cancel anytime". No free-trial language, no feature checklist, no weekly price decoy on the visible screen.
- **What is omitted: any account gate.** No email, password, or sign-in is ever demanded (first name only), there is no visible auto-renewal fine print, and the decline path is a plain ✕. After the single hard paywall, the sell goes soft: a countdown offer card on the home diary and a diamonds economy where consistent logging "buys" a 3-Day Pro Pass, letting the product re-pitch Pro through earned use instead of repeated modals.
