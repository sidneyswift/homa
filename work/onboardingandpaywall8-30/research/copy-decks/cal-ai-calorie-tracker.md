# Cal AI - Calorie Tracker: onboarding + paywall copy deck

Source: Appllama MCP, app_id 6480417616 (Cal AI - Calorie Tracker, health). Captured 2026-08-31. Verbatim third-party capture: third-party punctuation preserved exactly as rendered. Screen refs use `app_id/screen_id`.

## Flow overview

- 48 captured screens total: 7 welcome-screen (incl. 1 video), 38 onboarding (incl. 1 video), 3 paywall.
- Account gate: END of onboarding (positions 31-35 of 38: "Save your progress" sign-in, email entry, verification), placed AFTER the plan is generated and revealed, immediately BEFORE the trial/paywall sequence.
- Paywall: terminal. In-onboarding trial ramp at positions 36-38 (Trial Offer, Trial Reminder Setup, Free Trial Checkout), then a 3-screen dedicated paywall flow (Free Trial Offer, Trial Reminder Paywall, Trial Plan Selection). Loading/generation moment at onboarding positions 27-29.
- 12 screens viewed below; the rest listed by position under Unviewed screens.

## S1 Onboarding Intro (welcome position 3, ref 6480417616/spl_obaee)

- Badge (top right): 🇺🇸 EN
- Hero: phone mockup of live camera scanning a plate (in-mockup UI chip: "Scan Food")
- H: Calorie tracking made easy
- CTA: Get Started
- Secondary: Already have an account? **Sign In**

Layout economy: ~11 visible words outside the mockup; 4 elements (hero mockup, headline, one CTA, sign-in line). No feature list, no bullets.

## S2 Gender Selection (onboarding position 2, ref 6480417616/onb_h0vpy)

- H: Choose your Gender
- Body: This will be used to calibrate your custom plan.
- Options: Male / Female / Other
- CTA: Continue (disabled until selection)
- Chrome: back arrow + thin progress bar

Layout economy: ~18 words, 6 elements. One question per screen, selection auto-arms the CTA.

## S3 Workout Frequency (onboarding position 3, ref 6480417616/onb_r1a2k)

- H: How many workouts do you do per week?
- Body: This will be used to calibrate your custom plan.
- Options:
  - 0-2 · Workouts now and then
  - 3-5 · A few workouts per week
  - 6+ · Dedicated athlete
- CTA: Continue (disabled)

Layout economy: ~33 words, 7 elements. Options pair a number with a flattering identity label ("Dedicated athlete").

## S4 Goal Selection (onboarding position 10, ref 6480417616/onb_dfsic)

- H: What is your goal?
- Body: This helps us generate a plan for your calorie intake.
- Options: Lose weight / Maintain / Gain weight
- CTA: Continue (disabled)

Layout economy: ~21 words, 6 elements. Body line re-states the payoff (the plan), not the question.

## S5 Weight Loss Pace (onboarding position 13, ref 6480417616/onb_tsrxd)

- H: How fast do you want to reach your goal?
- Label: Weight loss speed per week
- Value readout: 0.5 kg
- Slider anchors: Slow / Recommended / Fast (sloth, rabbit, panther icons; "Recommended" highlighted orange)
- Result card: You will reach your goal in **7 months**
- Card body: This is the most balanced pace, motivating and ideal for most users.
- Card line: Daily calorie goal: 1,426 cal
- CTA: Continue

Layout economy: ~45 words, 8 elements. The answer is live-computed feedback (date + calorie goal), not a static option.

## S6 AI Comparison (onboarding position 14, ref 6480417616/onb_xy1q3)

- H: Lose twice as much weight with Cal AI vs on your own
- Chart columns: Without Cal AI (bar: 20%) / With Cal AI (bar: 2X)
- Caption: Cal AI makes it easy and holds you accountable.
- CTA: Continue

Layout economy: ~26 words, 4 elements. A claim screen mid-quiz; bar chart carries the argument, no citation shown.

## S7 Plan Calculation (onboarding position 28, ref 6480417616/onb_54l76)

- Counter: 26%
- H: We're setting everything up for you
- Status line: Customizing health plan...
- List header: Daily recommendation for
- List: · Calories ✓ / · Carbs / · Protein / · Fats / · Health Score

Layout economy: ~19 words, 5 elements. Fake-work loader with a checklist that ticks off; no CTA (auto-advances).

## S8 Plan Ready Summary (onboarding position 29, ref 6480417616/onb_02e7b)

- H: Congratulations your custom plan is ready!
- Label: You should lose:
- Pill: 14.8 kg by September 11
- Card header: Daily recommendation
- Card subline: You can edit this anytime
- Metric tiles: Calories 1095 / Carbs 50g / Protein 154g / Fats 30g (ring gauges, edit-pencil icons)
- CTA: Let's get started!

Layout economy: ~26 words + 4 numeric tiles, 8 elements. The personalized number-and-date pill is the hero.

## S9 Save Progress Sign In (onboarding position 31, ref 6480417616/onb_pn2zd)

- H: Save your progress
- Buttons: Sign in with Apple / Sign in with Google / Continue with email

Layout economy: 12 words, 4 elements. Account gate framed as protecting the plan just generated; no skip affordance visible, no benefit copy.

## S10 Paywall: Free Trial Offer (paywall position 1, ref 6480417616/pay_sgccs)

- H: We want you to try CalAI for free.
- Hero: phone mockup of the camera scan moment
- Payment note: ✓ No Payment Due Now
- CTA: Try Now
- Decline/alt affordance: Already purchased?
- Price line: Just $29.99 per year ($2.49/mo)
- Links: Terms · Privacy · Restore

Layout economy: ~25 visible words, 7 elements. No plan cards, no feature list; a single gift-framed sentence plus price whisper.

## S11 Paywall: Trial Reminder Paywall (paywall position 2, ref 6480417616/pay_kewji)

- H: We'll send you a reminder before your free trial ends
- Graphic: bell with red "1" notification badge
- Payment note: ✓ No Payment Due Now
- CTA: Continue for FREE
- Alt affordance: Already purchased?
- Fine print: Billed annually. Plan auto-renews unless you cancel. Cancel in the App Store.
- Price line: Just $29.99 per year ($2.49/mo)
- Links: Terms · Privacy · Restore
- Chrome: back chevron

Layout economy: ~42 words, 8 elements. Whole screen exists to defuse forgot-to-cancel anxiety before the plan sheet.

## S12 Paywall: Trial Plan Selection (paywall position 3, ref 6480417616/pay_8ixcs)

- H: Start your 3-day FREE trial to continue.
- Timeline step 1: **Today** · Unlock all the app's features like AI calorie scanning and more.
- Timeline step 2: **In 2 Days - Reminder** · We'll send you a reminder that your trial is ending soon if you've allowed us to notify you.
- Timeline step 3: **In 3 Days - Billing Starts** · You'll be charged on May 8, 2026 [line partially cut by plan cards]
- Plan card A: Monthly / $9.99 /mo (unselected)
- Plan card B: badge "3 DAYS FREE" / Yearly / ~~$39.99~~ $29.99 (pre-selected, checkmark)
- Payment note: ✓ No Payment Due Now
- CTA: Start My 3-Day Free Trial
- Alt affordance: Already purchased?
- Fine print: 3 days free, then $29.99 per year. Billed yearly. Plan auto-renews unless you cancel. Cancel in the App Store.
- Links: Terms · Privacy · Restore
- Chrome: back chevron

Layout economy: ~95 visible words, 12 elements. The wordiest screen in the whole flow, and most of the words are calendar/billing honesty rather than selling.

## Unviewed screens

Welcome flow: 1 (untitled video walkthrough), 2 Splash Screen, 4 Onboarding Intro, 5 Onboarding Intro, 6 Onboarding Intro, 7 Onboarding Intro.

Onboarding flow: 1 (untitled video walkthrough), 4 Acquisition Source, 5 App Experience Question, 6 AI Results Explainer, 7 Height And Weight, 8 Birth Date Picker, 9 Nutrition Coach Question, 11 Desired Weight, 12 Habit Insight, 15 Goal Motivation, 16 Diet Selection, 17 Coaching Preference, 18 Potential Result Graph, 19 Profile Thank You, 20 Apple Health Connect, 21 Calorie Goal Add, 22 Calorie Rollover, 23 Social Proof Reviews, 24 Testimonial List, 25 Meal Log Reminder, 26 Referral Code Entry, 27 Plan Generation Start, 30 Plan Benefits, 32 Email Entry, 33 Email Verification, 34 Email Verified Modal, 35 Save Progress Loading, 36 Trial Offer, 37 Trial Reminder Setup, 38 Free Trial Checkout.

## Reading

- Second person, six-to-ten-word sentences, one idea per screen. Question screens carry a single utility justification ("This will be used to calibrate your custom plan.") repeated nearly verbatim across steps; the repetition is the reassurance.
- The quiz's answers talk back: pick a pace and the screen instantly returns "You will reach your goal in 7 months" and a daily calorie number. Personalization is shown as computation, not claimed as a feature list.
- Price is deferred and then over-disclosed. Two whole screens ("try CalAI for free.", the reminder-bell screen) say what you will NOT pay ("✓ No Payment Due Now" appears three times) before the plan sheet; the plan sheet then spends its word budget on a day-by-day billing timeline, the exact charge date, and cancel instructions. Annual price is anchored as "($2.49/mo)".
- What is omitted: no testimonials, ratings, or user counts on any paywall screen (social proof lives mid-quiz at positions 23-24 instead); no visible "X" or "skip" on the paywalls, only a back chevron and "Already purchased?"; no feature-checklist grid; the yearly card is pre-selected so the CTA reads as one decision, not a comparison.
