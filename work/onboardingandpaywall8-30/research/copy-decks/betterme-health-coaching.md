# BetterMe: Health Coaching: onboarding + paywall copy deck

Source: Appllama (app_id 1264546236, "BetterMe: Health Coaching", fitness). Captured 2026-08-31. Verbatim third-party capture; third-party punctuation preserved exactly as rendered. 12 of 30 journey screens viewed; screen ids noted per section.

## Flow overview

- 30 journey screens total: 3 welcome (incl. 1 video), 26 onboarding (incl. 1 video montage), 1 paywall.
- Account gate: at the START. The welcome screen is an email login with "CONTINUE AS GUEST" and "CREATE ACCOUNT" options; Create Account sits at onboarding position 2, before any quiz question. The gate is soft (guest path visible).
- Paywall: single screen at the very END of the journey (position 30), after the 26-step quiz. Trial-explainer format, one SKU, no plan picker.
- No dedicated loading/plan-generation image screen in the capture set (the onboarding video montage shows a circular loader and line progress graph, implying a generation moment between quiz and paywall).

## S1 Splash Screen (welcome pos 2, spl_cmcck)

- Visual: dark rounded-square "Me" logo mark centered on cream. No other copy.
- Layout economy: 1 word ("Me"), 1 element. Pure brand beat.

## S2 Email Login (welcome pos 3, spl_zbddm)

- H: "BetterMe"
- Sub: "holistic wellness companion"
- Body: "Log in with your email to access your personalized plan"
- Fields: "Email" · "Password"
- Link: "Forgot Password?"
- CTA (disabled until filled): "LOG IN"
- Divider: "or"
- Secondary CTA: "CONTINUE AS GUEST"
- Tertiary CTA (outlined): "CREATE ACCOUNT"
- Consent checkbox: "I confirm that I have read and agreed to the Terms of Use and Privacy Policy" (Terms of Use, Privacy Policy underlined links)
- Layout economy: ~35 words, 10 elements. The only screen with two competing CTAs; guest path is visually equal to login.

## S3 Create Account (onboarding pos 2, onb_a79f0)

- Nav title: "Create Account"
- Field labels: "Email" (prefilled example) · "Password"
- Placeholder: "Enter your password"
- CTA (disabled until filled): "CONTINUE"
- Footer: "Already a member? Log In"
- Layout economy: ~13 words, 6 elements. Two fields only; no name, no social SSO shown.

## S4 Personalization Consent (onboarding pos 3, onb_a8af1)

- H: "Let's personalize your plan"
- Body: "To activate your BetterMe plan we require some of your health and other sensitive information (such as BMI, ethnicity). This is essential to personalize your experience and cannot be excluded from our services. You may withdraw your consent in the profile."
- Visual: 5-image collage (3D avatars working out, broccoli + avocado)
- CTA (dark pill): "I AGREE"
- Decline (light pill): "NOT RIGHT NOW"
- Link: "Privacy Policy"
- Layout economy: ~55 words, 9 elements. Densest body copy in the flow; legal consent dressed as a warm "let's" moment with an explicit decline button.

## S5 Sex Selection (onboarding pos 4, onb_8wur2)

- Nav: "About You" + 5-segment progress bar
- H: "What is your sex?"
- Helper: "Your sex impacts key body metrics. We use this data to provide content tailored to you."
- Options: "Male" (selected, check badge) · "Female"
- CTA: "NEXT"
- Layout economy: ~25 words, 6 elements. Question + one-line "why we ask" rationale; options pinned to bottom near thumb.

## S6 Main Goal Selection (onboarding pos 5, onb_12on3)

- Nav: "About You"
- H: "What's your main goal?"
- Options (title + subtitle):
  - "Lose Weight" — "Burn off extra body fat" (selected)
  - "Build Muscle" — "Get strong and develop muscle mass"
  - "Keep Fit" — "Maintain healthy and active lifestyle"
- CTA: "NEXT"
- Layout economy: ~22 words, 6 elements. Every option gets a 4-6 word benefit subtitle; no helper text.

## S7 Target Area Selection (onboarding pos 9, onb_ov1qt)

- Nav: "About You"
- H: "Which area needs the most attention?"
- Options (multi-select beside 3D body map with red highlight overlays): "Arms" · "Chest" · "ABS" (selected) · "Legs" (selected)
- CTA: "NEXT"
- Layout economy: ~11 words, 7 elements. Single-word options; the 3D body illustration mirrors selections in red and carries the meaning.

## S8 Dream Body Shape (onboarding pos 10, onb_66exb)

- Nav: "About You"
- H: "What's your dream body shape?"
- Options (each card carries a 3D body render): "Cut" (selected) · "Bulk" · "Extra Bulk"
- CTA: "NEXT"
- Layout economy: ~10 words, 5 elements. Aspiration question answered by image comparison, not prose.

## S9 Motivation Statement (onboarding pos 21, onb_frul7)

- Nav: "Motivation" + progress bar
- H: "Do you relate to the statement below?"
- Quote card: "I'm afraid I won't have time to do the other things I love because I'll be so busy exercising and planning meals."
- Options (dual tiles): "Yes" (selected, check) · "No" (x)
- CTA: "NEXT"
- Layout economy: ~32 words, 6 elements. Objection-mining screen: the app voices the user's fear in first person and asks for a binary yes/no.

## S10 Current Weight Input (onboarding pos 24, onb_jcgl1)

- Nav: "Almost There" + progress bar (near full)
- H: "What is your current weight?"
- Value: "90" "kg"
- Alert card (warning icon): "Your current BMI is 31.9 which is obese"
- Card body: "Focus on your nutrition and activity to be more toned and healthier. We will use this index to personalize your workouts and nutrition plan"
- Link: "Sources of recommendations"
- CTA (full-width bar): "NEXT"
- Picker: dual wheel, "lb" / "kg" unit toggle
- Layout economy: ~45 words, 8 elements. Live BMI verdict updates with the wheel; blunt clinical label ("which is obese") followed immediately by a coaching sentence.

## S11 Goal Weight Input (onboarding pos 25, onb_ns61b)

- Nav: "Almost There"
- H: "What is your goal weight?"
- Value: "70" "kg"
- Feedback card (green, muscle-arm icon): "Challenging choice"
- Card body: "You will lose 22.2% of your weight"
- Card list: "Drop extra pounds for a healthier you:" / "- Decreased joints pain" / "- More energy"
- Link: "Sources of recommendations"
- CTA: "NEXT"
- Picker: dual wheel, "lb" / "kg"
- Layout economy: ~30 words, 8 elements. Computes and celebrates the delta ("22.2% of your weight") the moment it is set; benefit bullets pre-sell the outcome the paywall will monetize.

## S12 Free Trial Paywall (paywall pos 1, pay_1fcrl)

- H: "How does trial work?"
- Timeline step 1: "Today" — "Unlock premium access to content for free. You don’t have to pay anything."
- Timeline step 2: "Day 5" — "Get a notification to remind you when the trial ends."
- Timeline step 3: "Day 7" — "Subscription starts. You can cancel easily before this date."
- Pricing line (below dashed divider): "Subscription starts at $14.99 per month ($3.69/week). Cancel anytime"
- Toggle row: "Unlock trial and reminder" (toggle shown off)
- Link (underlined): "Do you have a promo code?"
- CTA (dark pill): "SUBSCRIBE NOW"
- Link: "Restore purchases"
- Fine print: "Subscriptions renew automatically at the end of each period unless you cancel at least 24 hours before the end of the current period. If you are unsure how to cancel, visit our Subscription Terms."
- Fine print (continues, cut at capture edge): "By continuing you accept our"
- No visible close/X or skip affordance in the capture; the only exits are Restore and the promo link.
- Layout economy: ~105 visible words, 12 elements. One SKU, no plan picker, no testimonials, no countdown; price appears once, after the timeline.

## Unviewed screens

Position-ordered, name only (flow section in parens):

1. (welcome pos 1) untitled video walkthrough
2. (onboarding pos 1) untitled video montage
3. (onboarding pos 6) Interest Selection
4. (onboarding pos 7) Special Programs
5. (onboarding pos 8) Activity Interests
6. (onboarding pos 11) Daily Routine
7. (onboarding pos 12) Energy Levels
8. (onboarding pos 13) Activity Level
9. (onboarding pos 14) Push-Up Ability
10. (onboarding pos 15) Sedentary Lifestyle
11. (onboarding pos 16) Daily Walking
12. (onboarding pos 17) Sleep Duration
13. (onboarding pos 18) Diet Type
14. (onboarding pos 19) Food Exclusions
15. (onboarding pos 20) Bad Habits
16. (onboarding pos 22) Motivation Statement (second variant)
17. (onboarding pos 23) Height Input
18. (onboarding pos 26) Birthday Input

## Reading

- Voice is second-person clinical-warm and rationale-forward: nearly every data ask ships a one-line "why we need this" ("Your sex impacts key body metrics. We use this data to provide content tailored to you."), and sensitive-data consent gets a full dedicated screen with an explicit "NOT RIGHT NOW" decline. Trust copy is doing conversion work.
- Headlines are pure 4-6 word questions, one per screen; the words move into the feedback cards instead. The app issues verdicts on the user's body mid-quiz ("Your current BMI is 31.9 which is obese", "Challenging choice / You will lose 22.2% of your weight") and immediately softens each with a coaching sentence and benefit bullets — a diagnose-then-reassure rhythm that pre-sells the plan before any price appears.
- Price is framed trial-first: the paywall headline is about the trial mechanics, the 3-step Today/Day 5/Day 7 timeline (with a promised Day-5 reminder notification) absorbs most of the screen, and the price appears exactly once, monthly-anchored with a weekly equivalent in parentheses ("$14.99 per month ($3.69/week)"). "Cancel" reassurance appears three separate times on one screen.
- Omitted entirely: testimonials, star ratings, user counts, plan-comparison pickers, discount countdowns, and any skip/close affordance on the paywall. The persuasion budget is spent in the quiz, not on the paywall.
