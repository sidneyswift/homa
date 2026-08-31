# Lose It! - Calorie Counter: onboarding + paywall copy deck

Source: Appllama (app_id 297368629, "Lose It! – Calorie Counter", category health). Captured 2026-08-31. Verbatim third-party capture: all quoted strings transcribed exactly as rendered on screen, including third-party punctuation. Viewed 12 of 94 library screens (screen_ids noted per section); unviewed screens listed by position + name only.

## Flow overview

- 94 screens total in the library: 3 welcome-screen, 62 onboarding, 2 paywall, 27 other-tabs.
- Journey shape: cookie-consent wall (welcome 3) -> Create Account / Sign In chooser (onboarding 2) -> a very long personalization quiz + education loop (onboarding 3-58, organized as a 4-stop roadmap: Weight Goal, Calorie Budget, Calorie Schedule, Nutrition Strategy) -> plan generation moment (59) -> plan summary (61) -> account creation form with consent checkboxes (62, the true account gate, at the END of onboarding) -> free-trial paywall -> discount fallback paywall.
- Account gate position: END of onboarding (position 62 of 62), immediately before the paywall. The plan is built first; the email/password form is the toll booth between "your plan is ready" and the trial offer. (An optional "Sign In" path is offered at the very start for returning users.)
- Paywall position: after everything, 2 screens: "Free Trial Paywall" (7-day trial anatomy, $79.99/yr) then "Discount Offer Paywall" (50% off, $39.99/yr) as the decline/close fallback.

## S1 Privacy Notice (welcome position 3, spl_b37gv)

- Logo: "Lose It!" (scale app icon + wordmark)
- H: "Privacy Notice"
- Body: "This app uses cookies to personalize content, analytics and ads. We also share information about the way you interact with our website, including health information interests, with our advertising and analytics partners who may aggregate this data with other information they have about you. Please click I Consent below to give us permission to do this. If you do not wish to consent please click Do Not Consent. For more information see our"
- Link: "Privacy Policy"
- CTAs (stacked): "I Consent" / "Do Not Consent" / "More Options"
- Layout economy: ~75 words, 6 elements (logo, title, paragraph, link, 3 buttons). Dense legal paragraph on dark navy; decline is a same-size button, not buried.

## S2 Welcome Landing (onboarding position 2, onb_wfbui)

- Logo lockup: "Lose It!" (registered mark), ringed by feature icons (dumbbell, medal, barcode scan, target, fork/knife, ruler, trend chart, confetti); no headline, no tagline
- CTA (primary, orange): "Create Account"
- CTA (secondary, outline): "Sign In"
- Layout economy: 5 words visible. 3 elements (logo ring, 2 buttons). The brand mark IS the pitch; zero body copy.

## S3 Onboarding Roadmap (onboarding position 3, onb_jxaen)

- H: "Welcome!"
- Body: "Let's build a personalized plan that will set you up for success."
- Timeline items (icon + label): "Weight Goal" / "Calorie Budget" / "Calorie Schedule" / "Nutrition Strategy"
- CTA: "Continue"
- Layout economy: ~19 words, 7 elements. Sets a 4-stop contract for the long quiz ahead.

## S4 Primary Goal Question (onboarding position 4, onb_1m2fw)

- H: "What's your primary goal?"
- Options (outlined pills, one per line): "Lose weight" / "Improve my overall health" / "Gain more control over my eating habits" / "Build better habits for the long term" / "Feel more confident in my body"
- CTA: none (tap an option to advance); back chevron top-left
- Layout economy: ~29 words, 6 elements. Question + answers only; no progress bar, no explainer.

## S5 Simple Math Explainer (onboarding position 9, onb_ns9ah)

- Illustration: chalkboard "1 +1 / 2"
- H: "It all comes down to simple math."
- Body: "Weight loss happens when your body burns more energy than you consume. This energy is measured in calories."
- Body: "We'll give you a personalized calorie budget -- track your food, stick to your budget, and you'll lose weight!"
- CTA: "Continue"
- Layout economy: ~44 words, 4 elements. Education beat mid-quiz; product mechanic stated as a plain causal promise.

## S6 Steady Plan Offer (onboarding position 17, onb_28zy4)

- H: "Select a weight loss plan"
- Badge (on card): "Recommended for You"
- Card title: "Steady"
- Card body: "Lose weight each week with this comfortable yet effective plan."
- Card bullets (icon + text): "Eat 2,103 calories per day" / "Lose ½ kg per week" / "About 40-42 weeks to reach goal"
- CTA (in card): "Select"
- Layout economy: ~34 words, 7 elements. Carousel card (siblings peek at the edges: Accelerated, Vigorous, Relaxed); numbers are personalized from the user's own answers.

## S7 Calorie Budget Result (onboarding position 21, onb_mb9zh)

- Icon: flame
- H: "Your budget is 2,103 calories"
- Body: "If you consistently stick to an average of 2,103 calories, you'll lose weight at the rate you've chosen."
- CTA: "Continue"
- Layout economy: ~24 words, 4 elements. A payoff screen: the quiz's first tangible deliverable, restated as a conditional promise.

## S8 Plan Generation Rating (onboarding position 59, onb_tjrhf)

- H: "Generating Your Custom Plan..."
- Social proof (laurels): "4.8 Stars" / "In the app store"
- Layout economy: 9 words, 3 elements (headline, animated star pair, laurel badge). The loading moment doubles as the only social-proof beat inside onboarding.

## S9 Custom Plan Preview (onboarding position 61, onb_2x726)

- H: "You'll Reach 70 kgs on" (followed by animated loading dots; the date fills in)
- Chart: descending weight curve, start tag "90 kgs"
- Summary timeline (icon + title + line):
  - "Goal: Lose 20 kgs" / "Weigh 70 kgs"
  - "Budget: 2,103 calories" / "Lose ½ kg per week"
  - "Calorie Schedule" / "Eat more on Fri, Sat, Sun"
  - "Balanced Strategy" / "90g protein, 278g carbs, 70g fat"
  - "Intermittent Fasting" / "14h - Mon, Tue, Wed, Thu,"
- CTA: "Save my program"
- Layout economy: ~40 words, 8 elements. Every roadmap stop is receipted with the user's own numbers; the CTA verb is "Save", which motivates the account form that follows.

## S10 Terms Consent / Create Account (onboarding position 62, onb_wo5s1) - ACCOUNT GATE

- H (nav title): "Create Account"
- Fields: "Email Address" / "Password"
- Checkbox 1: "Using the Lose It! App. To use the Lose It! app, your consent is required to collect & process your personal health & wellness data. You can request a copy of your data or withdraw consent at any time by contacting us. By checking this box, you agree to the Terms of Service & Privacy Policy." (links: "Terms of Service", "Privacy Policy")
- Checkbox 2: "Marketing Preferences. To stay informed about personalized deals, you agree to Lose It! collecting & processing your data, including your personal health & wellness data, for marketing purposes."
- Trust note (shield icon): "My health & my data. Privacy and protection is more important than ever. We prioritize data security & privacy so you can focus on achieving your health goals with confidence."
- CTA (primary): "Create Account"
- CTA (secondary):  "Sign up with Apple" (Apple mark)
- Layout economy: ~120 words, 8 elements. The wordiest screen in the flow by far; consent is unbundled (app use vs marketing) with the health-data disclosure spelled out inline.

## S11 Free Trial Paywall (paywall position 1, pay_2r0dz) - PRIMARY PAYWALL

- Close: X (top right)
- Eyebrow: "LET'S GET STARTED"
- H: "How Your Free Trial Works"
- Rating row: five stars, "4.8 stars" "(680k reviews)"
- Trial timeline (white card, icon rail):
  - "Program Created" / "Design a personalized plan to achieve your goals."
  - "Today: Build Momentum" / "Access over 40 Premium tools to kickstart your success"
  - "Day 5: Start Seeing Progress" / "We'll remind you with an email that your trial is ending soon."
  - "Day 7: Trial Ends" / "Your subscription starts. Cancel beforehand to avoid payment"
- Section header: "Trusted by Millions" (logo strip below the fold)
- Checkmark line: "No Payment Due Now"
- Terms line: "7 days free, then $79.99 per year ($6.66/mo)"
- CTA (primary, orange): "Start Free Trial"
- Decline/alt affordance: "Or Subscribe via App Store" (text link); X to close
- Layout economy: ~86 visible words, ~12 elements. Almost all copy is spent explaining the trial mechanics (including how to cancel), not the features; price appears once, directly above the button, in both yearly and per-month form.

## S12 Discount Offer Paywall (paywall position 2, pay_96hhc)

- Close: X (top right, circled)
- H (orange): "Become a healthier, happier you."
- Offer: "50% OFF"
- Price line: "$6.66 $3.33 /month" ($6.66 struck through)
- Section line: "Unlock Full Access to Lose It! Premium"
- Plan card: "12 Months" / "$79.99 $39.99" ($79.99 struck through) / "$3.33 /month"
- CTA (primary, orange): "Subscribe & Unlock Lose It!"
- Alt affordance: "Or Subscribe via App Store" (outlined text button); X to close
- Layout economy: ~32 words, 8 elements. Pure price-drop screen: no features, no timeline, no trial; strikethrough anchoring shown twice (per-month and per-year).

## Unviewed screens

Welcome screen section:
- W1 (untitled welcome video)
- W2 Splash Screen

Onboarding section (positions with names; viewed screens marked above are omitted):
- O1 (untitled onboarding montage video)
- O5 Obstacle Question
- O6 Current Weight Picker
- O7 Color Budget Setup
- O8 Calorie Guide Prompt
- O10 Calorie Budget Steps
- O11 Birthday Picker
- O12 Height Picker
- O13 Gender Selector
- O14 Step One Complete
- O15 Medication Question
- O16 Balance Calculation
- O18 Accelerated Plan Card
- O19 Vigorous Plan Card
- O20 Relaxed Plan Card
- O22 Alcohol Question
- O23 Exercise Plan Question
- O24 Goal Tips Intro
- O25 Budget Result Gauge
- O26 Calorie Schedule Intro
- O27 High Days Selector
- O28 Flex Schedule Summary
- O29 Schedule Applied
- O30 Nutrition Intro
- O31 Eating Habits Question
- O32 Post Meal Feeling
- O33 Journal Offer
- O34 Health Priority Question
- O35 Strategy Confidence
- O36 Activity Question
- O37 Saturated Fat Question
- O38 Strategy Loading
- O39 Strategy Recommendation
- O40 Balanced Strategy Detail
- O41 Strategy Applied
- O42 Fasting Intro
- O43 Fasting Methods Prompt
- O44 Fasting Style Selector
- O45 Dinner Time Question
- O46 Fast Duration Picker
- O47 Fasting Days Selector
- O48 Fasting Notifications
- O49 Notification Permission
- O50 Fasting Schedule Set
- O51 Goal Date Projection
- O52 Challenges Question
- O53 Ability Confidence
- O54 Setback Handling
- O55 Stress Management
- O56 Difficult Situations
- O57 Fear Question
- O58 Projection Ready
- O60 Plan Ready Intro

## Reading

- Teacher voice, second person, short declaratives. The app explains its own mechanic like a lesson ("It all comes down to simple math.", "Weight loss happens when your body burns more energy than you consume.") and then converts the lesson into a conditional promise ("track your food, stick to your budget, and you'll lose weight!"). Question screens are bare: one question, 4-5 first-person answer pills, nothing else.
- The 62-screen quiz pays the user back in installments. Roughly every 4-6 questions there is a receipt screen with the user's own numbers ("Your budget is 2,103 calories", plan cards, the final "You'll Reach 70 kgs on" chart), so the length reads as plan-building rather than form-filling; the roadmap screen sets that contract up front.
- Price is framed as trial anatomy, not feature list. The primary paywall spends its ~86 words narrating Day 0/5/7 of the trial, promises a reminder email, and tells you how to cancel; "No Payment Due Now" sits directly above the CTA and the single terms line gives both $79.99/yr and $6.66/mo. The decline path is a mere X plus an "Or Subscribe via App Store" link, and closing it earns a 50%-off screen that is nothing but strikethrough anchoring ($79.99 -> $39.99, $6.66 -> $3.33).
- What is omitted: no testimonials, no named users, no "most popular" badges, no feature comparison table anywhere in the flow; social proof is a single aggregate claim (4.8 stars, 680k reviews, "Trusted by Millions") used twice. Account creation is also unusually honest for the category: two separate consent checkboxes (app health data vs marketing) with the data-sharing disclosure written out in full on the gate itself.
