# Monarch: Budget & Track Money: onboarding + paywall copy deck

Source: Appllama (app_id 1459319842, category finance). Screens: spl_yj1ql, spl_4ikab, spl_ra2vq, onb_h8usv, onb_qp5uc, onb_232y4, onb_nrad7, onb_mzwne, onb_rs08o, onb_n2pf9, pay_ttjr1. Captured 2026-08-31. Verbatim third-party capture (punctuation preserved exactly as rendered).

## Flow overview

- 11 screens total in the Appllama journey: 3 welcome (incl. 1 video), 7 onboarding (incl. 1 video), 1 paywall.
- Account gate: at the very START. The first interactive screen is the sign-up screen (Apple / Google / email), and onboarding Step 1 of 6 is "Create your account". Everything, including the goal question, happens post-gate.
- The account flow is a numbered 6-step counter ("Step 1 of 6" ... "Step 6 of 6"): email, verify code, password, goals, then a 2-part profile form.
- Paywall: single screen at the END of onboarding (position 11), free-trial timeline pattern, "Try for $0.00" CTA, with a "Continue in-app" decline affordance below it.
- No loading/generation moment appears in the captured journey.

## S2 Splash Screen (welcome, position 2)

- Visual only: orange butterfly mark centered on an off-white background. No copy.
- Layout economy: 0 words, 1 element.

## S3 Sign Up (welcome, position 3)

- Brand lockup: "Monarch" (with butterfly mark)
- Top-right link: "Sign in"
- H: "Trusted by over 1,000,000 members"
- Badge row 1 (5 gold stars, laurels): "4.9 stars / 100,000+ reviews"
- Badge row 2 (laurels): "WSJ | Best Overall Budgeting App"
- Badge row 3 (laurels): "Forbes | Best Mint Replacement"
- Badge row 4 (laurels): "CNBC | Best App for Ease of Use"
- Subhead: "Sign up to start your free trial"
- Body: "Try Monarch free, cancel anytime"
- Options: "Continue with Apple" / "Continue with Google" / divider "OR"
- CTA (orange): "Sign up with email"
- Link: "Already have an account? Sign in"
- Terms line: "By creating an account, you agree to our Terms of Use and Privacy Policy."
- Layout economy: ~55 words, ~12 elements; over half the screen is third-party proof (stars + 3 press laurels) before any ask.

## S5 Email Signup (onboarding, position 2)

- Progress: "Step 1 of 6" (back arrow)
- H: "Create your account"
- Body: "We'll send you a verification code right away to validate your email."
- Field: "Email *" with placeholder "example@domain.com"
- CTA (disabled salmon until filled): "Send verification code"
- Link: "Already a member? Sign in"
- Layout economy: ~25 words, 6 elements; one field per screen.

## S6 Email Verification (onboarding, position 3)

- Back arrow (no step counter shown)
- H: "Verify your email"
- Body: "We sent a 6-digit code to morriss.sun1@gmail.com. Please enter the code below."
- Input: six OTP boxes
- Link: "Don't see a code? Resend to email"
- CTA (orange): "Verify email"
- Layout economy: ~25 words, 5 elements.

## S7 Password Creation (onboarding, position 4)

- Progress: "Step 3 of 6" (back arrow)
- H: "Finish signing up"
- Body: "You're nearly there! Create a password to complete your account information."
- Field: "Password" (visibility eye icon)
- Helper: "Your password must be at least 8 characters long, and include 1 symbol and 1 number."
- Checklist (green checks): "Minimum 8 characters" / "At least one number" / "At least one symbol"
- CTA (orange): "Create password"
- Layout economy: ~45 words, 8 elements; requirements stated twice (prose + live checklist).

## S8 Goal Selection (onboarding, position 5)

- Progress: "Step 4 of 6" (back arrow)
- H: "What brings you to Monarch?"
- Body: "Select your financial priorities below and we'll help you achieve them in Monarch."
- Options (multi-select pills; selected ones fill red-orange): "View all of my finances in one place" / "Manage my financial plan or budget" / "Track my income and spending" / "Pay down my debt" / "Save for a large purchase" / "Manage my money with a partner" / "Track my investments" / "Something else"
- CTA (orange): "Continue"
- Layout economy: ~55 words, 11 elements; the only preference question in the flow, options phrased in first person ("my").

## S9 Profile Form Empty (onboarding, position 6)

- Back arrow (step counter not visible in this state)
- H: "Tell us about yourself"
- Body: "Share a few more details about your personal situation so we can tailor your experience."
- Field: "Full Name *" with placeholder "Tell us your name..."
- Field: "Country of residence" with value "United States" (dropdown)
- Q: "Do you manage your finances with a partner?*" Options: "Yes" / "No"
- Q: "Do you work with a financial professional?*" Options: "Yes" / "No"
- CTA (disabled salmon): "Continue"
- Layout economy: ~45 words, 9 elements; four inputs on one screen, the densest form in the flow.

## S10 Profile Form Filled (onboarding, position 7)

- Progress: "Step 6 of 6" (back arrow)
- Same copy as S9 with sample values: "Morris Sun", "United States", "No" selected on both questions; CTA "Continue" now active orange.
- Layout economy: identical strings to S9; the step counter reveals this form is counted as two steps (5 and 6).

## S11 Subscription Offer (paywall, position 1, final screen)

- Badge (laurels, 5 gold stars): "4.9 stars, 100,000+ reviews"
- H: "How your free trial works"
- Timeline item 1 (unlock icon, orange): "Today" / "Start your free trial and see all your finances in one place."
- Timeline item 2 (bell icon, gray): "In 6 days" / "We'll send you a reminder email that your trial is ending soon. Cancel any time."
- Timeline item 3 (medal icon, gray): "In 7 days" / "Your subscription starts June 30 unless you've canceled during the trial."
- Plan card 1 (selected, highlighted): ribbons "SAVE 44%" + "MOST POPULAR"; "Annual plan"; "$179.88 $99.99 billed annually" ($179.88 struck through); right-aligned "$8.33/mo"
- Plan card 2: "Monthly plan"; "$14.99 billed monthly"; right-aligned "$14.99/mo"
- Links row: "Restore purchase" (left) / "Terms" "Privacy" (right)
- CTA (orange, pinned bottom): "Try for $0.00"
- Decline affordance: "Continue in-app >"
- Layout economy: ~80 words, ~14 elements; a single scroll-free screen, no feature list at all; the timeline is the body copy.

## Unviewed screens

1. Welcome Screen flow, position 1: untitled welcome video (splash logo, social login, primary button, divider, text links)
2. Onboarding flow, position 1: untitled onboarding video (social login, OTP input, password checklist, multi-select, toggles, radio plan selector, loading spinner, App Store sheet)

## Reading

- The paywall sells the mechanics of the trial, not the product. Its headline is "How your free trial works" and the body is a 3-step timeline (Today / In 6 days / In 7 days) that names the exact subscription start date and promises a reminder email; there is no feature list, no benefit bullets. Trust in the process substitutes for persuasion.
- Proof is front-loaded and quantified. Both the sign-up screen and the paywall lead with "4.9 stars" / "100,000+ reviews", and the sign-up screen stacks three named press awards (WSJ, Forbes, CNBC) plus "Trusted by over 1,000,000 members" before asking for anything.
- Voice is plain second-person utility copy, one short sentence of body per screen ("We'll send you a verification code right away to validate your email."), with the user's own goals phrased in first person on the pills ("Pay down my debt"). No exclamation except one gentle "You're nearly there!". Price is anchored three ways at once: strikethrough $179.88, "SAVE 44%", and a per-month reframe ($8.33/mo), while the CTA reframes the charge as "Try for $0.00".
- Omitted: any pre-gate value demo (the account gate is screen one), any testimonial quotes, any urgency/countdown, and any hard decline. The exit is a soft "Continue in-app >" under the CTA.
