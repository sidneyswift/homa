# Flo Cycle & Period Tracker: onboarding + paywall copy deck

Source: Appllama (app_id 1038369065, category health). Captured 2026-08-31. Verbatim third-party capture: all quoted strings transcribed exactly as rendered on screen, including third-party punctuation. Screen ids in parentheses are Appllama screen_ids.

## Flow overview

- 72 screens captured total; the pre-app journey is 46 screens: 5 welcome-section screens, 39 onboarding screens, 2 paywall screens. The remaining 26 are post-onboarding app tabs (Today home, Insights, Symptom Checker, Cycle Summary, etc.), outside this deck's scope.
- Account gate: ABSENT. There is no account-creation or email step anywhere in the flow. The only auth affordance is a small "Log in" text link (top right of the Goal Selection screen) for returning users. New users go quiz to paywall with zero registration.
- Paywall position: end of flow, S45-S46 of 46, after 39 onboarding screens and after the personalized prediction payoff ("your next period will start around June 25"). Primary paywall is a full-page plan chooser; second paywall is a bottom-sheet variant with a free-trial toggle and a monthly plan revealed.
- Journey numbering below: S1-S5 welcome, S6-S44 onboarding, S45-S46 paywall.

## S3 Onboarding Intro (spl_gtvsb)

- H: "Hello, I'm Flo"
- No body, no visible CTA on this frame (auto-advance / tap-through); Flo logo at top, scattered flower illustrations.
- Layout economy: 3 words, ~3 elements. The entire screen is a greeting.

## S4 Social Proof Screen (spl_f2lft)

- H: "#1 female" (oversized numeral) "OB-GYN-recommended app for period and cycle tracking"
- Body (caption): "Based on a survey of 225 US OB-GYNs who recommend apps for period and cycle tracking, DRG, 2021"
- No CTA visible (tap-through); same floral canvas as S3.
- Layout economy: ~27 words, 3 elements (headline block, substantiation caption, logo). The claim carries its own citation.

## S5 Privacy Consent (spl_i9gr9)

- H: "Privacy first"
- Consent option 1: "I agree to processing of my personal health data for providing me Flo app functions." / "See more in Privacy Policy." (Privacy Policy is a pink link)
- Consent option 2: "I agree to the Privacy Policy and Terms of Use." (both pink links)
- Consent option 3 (truncated at fold): "I agree to allow Flo to track my app activity. I understand that AppsFlyer,"
- Shortcut link: "Accept all"
- CTA: "Next" (disabled/faded until consents given)
- Layout economy: ~50 words, 6 elements. Legal unbundled into separate opt-ins, softened by a shield illustration and the two-word headline.

## S7 Mascot Name Entry (onb_98tj0)

- Eyebrow: "Let's get to know each other!"
- H: "What would you like Flo to call you?"
- Input: free-text field (shown filled: "Morris")
- CTA: "Continue"
- Decline affordance: "Skip" (top right)
- Ghosted transition text of the following screen visible behind: "Nice to meet you, Morris!"
- Layout economy: ~14 words, 4 elements. First ask is the user's name, not their data.

## S9 Birth Year Picker (onb_ywrxy)

- H: "Log your year of birth to make the predictions better"
- Control: wheel picker (1997...2003, "2000" selected)
- CTA: "Next"
- Layout economy: 11 words, 3 elements. Every ask is justified by prediction quality.

## S11 Doctor Testimonial (onb_5b728)

- Quote: "“I always recommend Flo to my patients. The predictions are very reliable, and this helps them plan their lives better.”" (first sentence highlighted in pink)
- Attribution card: "Dr. Renita White" / "Georgia, US" / "Obstetrician and gynecologist," / "Flo medical board member" (last line in pink)
- CTA: "Next"
- Layout economy: ~30 words, 4 elements (quote bubble, photo, credential card, CTA). Full-height photo of the named doctor does the trust work.

## S13 Goal Selection (onb_ppjgv)

- H: "What can we help you do?"
- Sub: "Choose as many as you'd like."
- Options (icon cards, 2-col grid): "Get pregnant" / "I'm already pregnant" / "Track my period" (shown selected) / "Charge my well-being" / "Manage my weight" / "Enhance my sex life" / (2 more below fold)
- CTA: "Next"
- Auth affordance: "Log in" (top right; the flow's only account touchpoint)
- Layout economy: ~30 words, ~10 elements. Options are verb-first jobs-to-be-done, 2-4 words each.

## S15 Usage Reasons Survey (onb_jywav)

- Progress bar (top) + decline affordance: "Skip"
- H: "What are your main reasons for using Flo?"
- Sub: "Choose all that apply."
- Selected option (expands when picked): "Knowing when my period is coming" / expansion: "Flo helps you predict your next period, so you're never caught off guard."
- Options: "Seeing how pregnancy chances shift during my cycle" / "Understanding my cycle after coming off birth control" / (more below fold)
- CTA: "Next"
- Layout economy: ~50 words, 6 elements. Selecting an answer rewards you with a benefit sentence, so the survey doubles as a feature pitch.

## S34 Cycle Analysis Loading (onb_ocm7r)

- H: "Analyzing your cycle..."
- Body (italic): "90% of members said Flo accurately predicts the start of their period.*" / "*2,000 members surveyed (2021)"
- Footer: "✦ Powered by Flo Intelligence" ("Flo Intelligence" in pink/purple gradient)
- Layout economy: ~22 words, 4 elements. The wait state is spent on an accuracy stat with its own footnote.

## S35 Next Period Prediction (onb_n0tyz)

- H: "Morris, your next period will start around June 25" (name-personalized; date in pink)
- Sub: "Want to make sure you're always prepared? Allow reminders on the next screen."
- Notification preview card: "Your period might start today 📅" / "Log your symptoms for expert tips on how to feel better 👉"
- CTA: "Next"
- Layout economy: ~45 words, 4 elements. The payoff screen: personalized prediction first, then it pre-sells the push-permission prompt with a mock notification.

## S45 Subscription Offer (pay_rl89v) — primary paywall

- Top bar: close "✕" (top left) / "Restore" (top right)
- H: "Choose your plan"
- ★★★★★ (five gold stars)
- Review quote: "“A ladies best friend. Awesome and quite accurate! 👍🏼👍🏼👍🏼”" / attribution: "333honesty"
- Trial row (radio, unselected): "Not sure yet? Start a free trial"
- Ribbon: "MOST POPULAR"
- Plan card (selected): "Yearly Plan" / "12 mo · $59.99" / "$5 / mo"
- Plan card: "Flo Family plan" / "1-6 MEMBERS" / "12 mo · $79.99" / "$6.67 / mo"
- CTA: "Continue"
- Link: "View all plans and trials"
- Store line: "Subscribe in the App Store"
- Terms/decline line: "Cancel your plan anytime or choose limited access without full Flo benefits." ("choose limited access without full Flo benefits" is an underlined pink link, i.e. the free-tier decline path)
- Layout economy: ~62 visible words, ~12 elements. No feature list at all; the sell is one user review plus per-month price framing ($5 / mo, with $59.99 in small print).

## S46 Trial Paywall Sheet (pay_wsz5c) — paywall variant (bottom sheet over dimmed S45)

- Backdrop (dimmed, same header): "Choose your plan" / ★★★★★ / review quote: "“Really accurate!! This app is amazing it's so easy to use and really really awesome! I love this app so much. I've tried other apps but this one is by far the best!!💕💕”" (attribution cut off by sheet)
- Trial toggle (off): "Not sure yet? Enable free trial."
- Ribbon: "MOST POPULAR"
- Plan card: "Yearly Plan" / "12 mo · $59.99" / "$5 / mo"
- Plan card: "Flo Family plan" / "1-6 MEMBERS" / "12 mo · $79.99" / "$6.67 / mo"
- Plan row: "Monthly" / "$14.99 / mo"
- CTA: "Continue"
- Decline affordance: "Go back"
- Layout economy: ~35 words on the sheet itself, ~8 elements. Monthly at $14.99 appears only here, anchoring yearly $5 / mo as 3x cheaper; the trial is an explicit opt-in toggle, not the default.

## Unviewed screens

Position-ordered, name only (S numbers continue the journey numbering above):

- S1 Welcome video (unnamed, video capture)
- S2 Splash Screen
- S6 Onboarding overview (unnamed, video capture)
- S8 Welcome Greeting
- S10 Provider Referral
- S12 Acquisition Source
- S14 Mascot Intro Tip
- S16 Mascot Assurance
- S17 Period Feelings Survey
- S18 Cycle Data Proof
- S19 Period Knowledge Survey
- S20 Education Fact
- S21 Pass It On Intro
- S22 Ratings Social Proof
- S23 Feature Path Preview
- S24 Period Regularity Survey
- S25 Period Import Prompt
- S26 Period Calendar Picker
- S27 Logging Confirmation
- S28 Follicular Phase Result
- S29 Cycle Education Proof
- S30 Birth Control Survey
- S31 Safety Education Intro
- S32 Health Conditions Survey
- S33 Community Expert Intro
- S36 Feature Path Transition
- S37 Mood Check-In
- S38 Readiness Calendar Tip
- S39 Discharge Knowledge
- S40 Discharge Education
- S41 Health Check-In Intro
- S42 Cycle Concern Survey
- S43 Hormone Symptom Survey
- S44 Symptom Risk Summary
- (26 further other-tabs screens: main app surfaces, outside onboarding scope)

## Reading

- Second person to the user, first person for the product-as-character: the app introduces itself ("Hello, I'm Flo"), asks your name before anything else, then uses it ("Morris, your next period will start around June 25"). Questions are conversational ("What can we help you do?", "What would you like Flo to call you?") and nearly every screen is under 15 words of app-authored copy; the long passages are all quoted third parties (a named OB-GYN, App Store reviewers) or legal consent text.
- Every claim ships with its receipt: "#1 female OB-GYN-recommended" carries "Based on a survey of 225 US OB-GYNs... DRG, 2021"; the loading stat carries "*2,000 members surveyed (2021)"; the doctor is named with state, specialty, and "Flo medical board member". Substantiation is part of the copy pattern, not a footnote afterthought.
- Price is framed per month with the real charge demoted: "$5 / mo" is the big number, "12 mo · $59.99" the small one, and the $14.99 monthly anchor is only revealed on the second paywall to make yearly look 3x cheaper. The free trial is never the default: it is an unselected radio / off toggle labeled "Not sure yet?", positioning trial as the hesitater's option and direct purchase as the norm.
- What is omitted: any account creation (no email, no password, anywhere), any feature checklist on the paywall (sold entirely on one review and the just-delivered prediction), and any hard gate language; the decline path is spelled out in the terms line itself ("choose limited access without full Flo benefits") rather than hidden.
