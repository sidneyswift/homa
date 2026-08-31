# MyFitnessPal: Calorie Counter: onboarding + paywall copy deck

Source: Appllama MCP, app_id 341232718 (MyFitnessPal: Calorie Counter, category: health). Captured 2026-08-31. Verbatim third-party capture: third-party punctuation (including em dashes) preserved exactly as rendered. App version on device: 26.22.0.74659.

## Flow overview

- 56 screens total in Appllama's journey: 3 welcome, 21 onboarding, 2 paywall, 30 other-tabs.
- Account gate is split in two: a sign-up method chooser (email / Google / Apple) sits at the START of onboarding (position 2, before any questions), and the actual email + password credentials screen sits at the END of the quiz (positions 18-19), after all personalization questions and before the paywall.
- Paywall position: after account creation. The journey runs quiz → create account → premium feature pitch → drops the user onto the free Today dashboard (with ads and a "Go Premium" pill) → trial paywall → 25% discount downsell.
- Notable: there is no plan-generation/loading moment. The quiz alternates question screens (white) with motivational "education" interstitials (full-bleed blue), and the name captured on the Goals screen is reused in the very next headline.

## S1 Welcome Onboarding (welcome position 3, spl_1lwn7)

- H (eyebrow + wordmark): "Welcome to" / "myfitnesspal™"
- Carousel card overlay: "Protein" · "Last 7 days" · "M T W T F S S"
- Carousel headline: "Ready for some wins? Start tracking, it's easy!"
- CTA: "Sign Up For Free"
- Secondary link: "Log In"
- Footer: "Version 26.22.0.74659"
- Layout economy: ~20 visible words, 6 elements (wordmark, photo card with data overlay, headline, dots, CTA, login link). One benefit claim, zero feature lists.

## S2 Sign Up (onboarding position 2, onb_li3h8)

- Nav title: "Sign Up"
- H: "Welcome! Let's customize MyFitnessPal for your goals."
- CTA: "Continue"
- Divider: "OR"
- Options: "Continue with Google" / "Continue with Apple"
- Data-collection fine print: "We will collect personal information from and about you and use it for various purposes, including to customize your MyFitnessPal experience. Read more about the purposes, our practices, your choices, and your rights in our Privacy Policy."
- Layout economy: ~55 words but ~15 above the fine print; 5 interactive elements. Headline frames sign-up as personalization, not registration.

## S3 Goal Selection (onboarding position 4, onb_wz0fg)

- Nav title: "Goals" + 7-segment progress bar (1 filled, green)
- H: "Hey, Morris. 👋 Let's start with your goals."
- Sub: "Select up to three that are most important to you."
- Options (checkbox cards, list scrolls): "Lose Weight" / "Maintain Weight" (selected) / "Gain Weight" / "Gain Muscle" / "Modify My Diet" / "Plan Meals" / "Manage Stress" (more below fold)
- CTA: "Next" + circular back arrow
- Layout economy: ~35 words, 9+ elements. First name from the previous step is injected into the headline immediately.

## S4 Weight Loss Education (onboarding position 5, onb_fb55m)

- Nav title: "Goals" (full-bleed blue interstitial)
- Eyebrow: "OK, real talk:"
- H: "Losing weight isn't always easy."
- Body: "But we'll motivate you through the ups and downs—so you can hit that goal!"
- Chart axis labels (wavy projection line with confidence band): "Today" / "6 months"
- PS line (italic): "P.S. You've already done the hardest part: getting started 🥳"
- CTA (white pill): "Next"
- Layout economy: ~40 words, 5 elements. Expectation-setting interstitial directly after the user picks a goal; chart is decorative projection, no numbers.

## S5 Medication Question (onboarding position 8, onb_x40rx)

- Nav title: "Goals"
- H: "Are you taking GLP-1 medications like Ozempic, Mounjaro, Wegovy, Zepbound, etc.?"
- Privacy note: "We're here to support you! Information used in accordance with our Privacy Policy."
- Options (radio): "Yes" / "I have a prescription but have not yet started taking it" / "I'm in the process of getting a prescription" / "No" / "I prefer not to say"
- CTA: "Next"
- Layout economy: ~50 words, 7 elements. Sensitive question softened by an inline privacy sentence and an explicit "I prefer not to say" opt-out.

## S6 Activity Level (onboarding position 14, onb_25az0)

- Nav title: "Goals"
- H: "What is your baseline activity level?"
- Sub: "Not including workouts - we count that separately."
- Options (radio cards with descriptors):
  - "Not Very Active" — "Spend most of the day sitting (e.g. bankteller, desk job)"
  - "Lightly Active" — "Spend a good part of the day on your feet (e.g. teacher, salesperson)"
  - "Active" — "Spend a good part of the day doing some physical activity (e.g. food server, postal carrier)"
  - "Very Active" — "Spend most of the day doing heavy physical activity (e.g. bike messenger, carpenter)"
- CTA: "Next"
- Layout economy: ~65 words, 6 elements. Each abstract level is anchored to concrete example jobs.

## S7 Body Metrics (onboarding position 16, onb_ypeik)

- Nav title: "You"
- H: "Just a few more questions"
- Field labels: "How tall are you?" (inputs "5" / "6", unit pill "ft/in") · "How much do you weigh?" (input "90", unit pill "kg")
- Helper under weight: "It's ok to estimate, you can update this later."
- Field label: "What is your goal weight?" (input "70", unit pill "kg")
- Helper under goal weight: "Don't worry, this doesn't affect your daily calorie goal and you can always change it later."
- CTA: "Next"
- Layout economy: ~50 words, 8 elements. Both anxiety points (accuracy, commitment) get a reassurance sentence directly under the field.

## S8 Create Account Empty (onboarding position 18, onb_wvn0d)

- Nav title: "Create Account" (6 of 7 progress segments filled)
- H: "Almost done! Create your account."
- Field labels: "Email Address" / "Password" · helper: "10 characters minimum"
- Consent checkbox: "I agree to MyFitnessPal's Terms & Conditions and Privacy Policy"
- Fine print: "Your Sign in with email address will be used to forward critical account and security updates to your personal email. Please ensure this connection remains activated in order to receive these messages."
- CTA: "Next"
- Layout economy: ~55 words, 7 elements. Gate arrives after all quiz investment; "Almost done!" reframes it as the last step rather than a wall.

## S9 Feature Tools Pitch (onboarding position 20, onb_koouj)

- Dark premium-styled interstitial, close X top-left
- H: "Stay on it with tools that turn habits into results" ("habits into results" in gold)
- Feature rows (icon + title + sub):
  - "Scan a barcode" / "to log lightning fast"
  - "Use your voice" / "to log just by saying it"
  - "Take a photo" / "to log your entire meal"
- CTA (gold pill): "Next"
- Layout economy: ~30 words, 5 elements. Pre-paywall warm-up in the paywall's dark/gold visual language; benefits phrased as verb-first logging methods.

## S10 Today Dashboard (onboarding position 21, onb_qg9r3)

- Header: "Today" ▾ · pill: "Go Premium" · streak counter: "0 ⚡"
- Week strip: "S M T W T F S"
- Calories card: "Calories" / "0 cal / 1,730" / "1,730 left"
- Macros card: "Carbs 0 g / 216" · "Fat 0 g / 58" · "Protein 0 g / 86"
- Third-party ad banner: "Fly to Florence. Train to Lucca. Flight + train in one booking."
- Ad caption: "Get ad-free tracking in Premium—upgrade now"
- Section: "Diary" / "View all" · rows: "Breakfast" ("Log") / "Lunch" ("Log")
- Tab bar: "Today" / "Plan" / "Progress" / "More" + floating plus FAB
- Layout economy: ~45 words, 10+ elements. Free-tier landing shows a live ad and two upgrade prompts, making the ad itself part of the premium pitch.

## S11 Free Trial Paywall (paywall position 1, pay_cwrhk)

- Close affordance: X icon, top-left
- H: "Guess less. Progress more. Start for free." ("Start for free." in gold)
- Section label: "Choose your plan"
- Plan card 1 (pre-selected, gold border): badge "Save 67%" · "Annual Plan" · "$79.99 billed annually" · "$6.67 / mo"
- Plan card 2: "Monthly Plan" · "$19.99 / mo"
- Reassurance line above CTA: "Try it free for 7 days. Trust the process. See the results for yourself."
- CTA (gold gradient pill): "Try it free"
- Secondary link: "Learn more"
- Terms line: "Billing starts at the end of your 7-day free trial unless you cancel. Plans renew automatically. Cancel via the App Store."
- Layout economy: ~63 visible words total, 9 elements. No feature list, no testimonials, no ratings; the sell is three 2-3 word sentences plus price cards.

## S12 Premium Discount Offer (paywall position 2, pay_a5lwo)

- Coupon ticket graphic: "25% off Premium"
- Urgency pill: "ENDS SOON"
- H: "No more restarts. This time, it's real." ("it's real" italicized)
- Body: "To help you hit your goals, here's 25% off a year of Premium."
- Plan card (selected): "12 months" · "~~$79.99~~ $59.99/year" · "$5/mo"
- CTA (gold pill): "Upgrade to Premium"
- Decline affordance: "No thanks" (plain text button)
- Terms line: "Billed annually. 25% off annual rate for one year. Plan auto-renews at the end of the promotional period at $79.99 unless you cancel. Plans renew automatically. Cancel via the App Store."
- Layout economy: ~70 words, 8 elements. Downsell drops the trial framing entirely and switches to loss-language about past failed attempts; note the terms disclose the post-promo renewal price.

## Unviewed screens

Welcome flow:
- W1 (video montage, unnamed)
- W2 Splash Loading

Onboarding flow:
- O1 (video montage, unnamed)
- O3 Name Entry
- O6 Barrier Selection
- O7 Lifestyle Education
- O9 Habit Selection
- O10 Habit Education
- O11 Meal Planning Frequency
- O12 Kitchen Rules Education
- O13 Meal Plan Opt In
- O15 Profile Details
- O17 Weekly Goal
- O19 Create Account Filled

Other-tabs (30 screens, outside the onboarding/paywall journey; first four by position):
- T1 Meal Log Reminder Modal
- T2 Breakfast Food Search
- T3 Food Search Suggestions
- T4 Recent Food Picker
- T5-T30 further Diary / Food Logging / app-tab screens (not enumerated)

## Reading

- Second person, coach-in-your-corner voice with deliberate colloquial register: "OK, real talk:", "Ready for some wins?", "Trust the process.", "Hey, Morris. 👋". Sentences on high-stakes screens are 2-4 words each; the paywall headline is three sentences totaling seven words. Long sentences are reserved for legal/privacy fine print only.
- Every anxiety gets an inline antidote at the exact moment it appears: "It's ok to estimate, you can update this later." under the weight field, "Don't worry, this doesn't affect your daily calorie goal" under goal weight, a privacy sentence and "I prefer not to say" on the GLP-1 question, "Not including workouts - we count that separately." under activity level.
- Price is framed monthly-first on the annual plan ("$6.67 / mo" vs "$19.99 / mo", "Save 67%"), and the trial does the selling: the CTA is "Try it free", not a price. The downsell paywall shifts from feature-selling to identity/failure language ("No more restarts. This time, it's real.") with strikethrough pricing and an ENDS SOON urgency pill, while still disclosing the $79.99 renewal in the terms.
- What is omitted is striking: no testimonials, star ratings, user counts, feature-comparison tables, or benefit checklists on either paywall; the only feature pitch (scan/voice/photo) lives on a separate pre-paywall interstitial. Education interstitials sell emotional commitment mid-quiz so the paywall itself can stay under ~65 words.
