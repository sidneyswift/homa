# Peloton: Fitness & Workouts: onboarding + paywall copy deck

Source: Appllama (app_id 792750948, screens spl_myn5r, spl_hscsq, spl_9z2gn, onb_8ki1d, onb_8iova, onb_7td2d, onb_ak91d, onb_ragdw, pay_f5lz8, pay_8vz7p). Captured 2026-08-31. Verbatim third-party capture; third-party punctuation preserved exactly.

## Flow overview

- 10 screens total in journey order: 3 welcome (1 video + splash + sign-up welcome), 5 onboarding (1 video + 4 stills), 2 paywall stills.
- Account gate position: START. The very first interactive screen is the sign-up welcome; the entire onboarding section IS account creation (email, password, username, age). There is no preference quiz, no goal questions, no plan-generation moment.
- Paywall position: END, immediately after account creation. Two captures of one paywall (Monthly toggle vs Annual toggle). No loading/generation screen exists.
- 8 of 10 screens viewed (both videos skipped; listed under Unviewed screens).

## S1 Splash Loading (welcome, position 2)

- Visual: white Peloton "P" logomark centered on a black canvas. No text at all.
- Layout economy: 0 words, 1 element.

## S2 Sign Up Welcome (welcome, position 3)

- Brand: PELOTON (letterspaced wordmark over hero photo of a man in headphones checking his phone)
- Product UI vignette (glassmorphic card): Weekly goal / 1/3 days (with progress bar)
- H: Track progress, crush your goals
- Pager: 3 dots (first active; headline/vignette carousel)
- Body: No Peloton equipment needed.
- Options: [Apple logo button] / [Google logo button]
- CTA: Sign up with email
- Terms: By signing up, you accept Peloton's Terms of Service and Membership Terms, and acknowledge the Privacy Policy.
- Decline/alt: Already have an account? Sign in
- Layout economy: ~40 visible words, ~9 elements. One benefit headline, one objection-killer line ("No Peloton equipment needed."), three sign-up paths, legal, sign-in link. No price mention anywhere.

## S3 Create a new account (onboarding, position 2)

- Nav: Back
- H: Create a new account
- Field: Email
- Opt-in checkbox (pre-checked): Email me updates on my workout progress, milestones achieved, new Peloton features, products, and more.
- CTA (disabled until valid): Sign up
- Divider: or
- Options: Sign up with Apple / Sign up with Google
- Terms: By signing up, you accept Peloton's Terms of Service and Membership Terms, and acknowledge the Privacy Policy.
- Decline/alt: Already have an account? Sign in
- Layout economy: ~55 words, ~9 elements; the marketing opt-in sentence is the longest string on the screen and arrives pre-checked.

## S4 Set a password (onboarding, position 3)

- Nav: Back
- H: Set a password
- Field: Password (with show/hide eye toggle)
- Hint: Must be at least 8 characters
- CTA (disabled, pinned bottom): Next
- Layout economy: ~11 words, 4 elements. One job per screen.

## S5 Choose a username (onboarding, position 4)

- H: Choose a username
- Body: This is how others will see you in class. You can always change it later.
- Field label: Username (entered value shown: "morriss", with clear-field X)
- Hint: 3-15 characters. Cannot include special characters
- State captured: loading spinner modal over a dimmed pill CTA (availability check); iOS keyboard with Passwords toolbar up.
- Layout economy: ~30 words, ~5 elements. Reassurance built in ("You can always change it later.").

## S6 Confirm your age (onboarding, position 5)

- H: Confirm your age
- Body: You must provide your age to create a Peloton account. This information is not made public and is only used as described in our Privacy Policy.
- Help link: Why does Peloton need this? (with info icon)
- Field: Birthdate* (entered value shown: 11/01/2000)
- Validation label (red): *Required
- CTA: Next
- Control: iOS wheel date picker (November 1 2000 selected)
- Layout economy: ~45 words, ~6 elements; two full sentences of privacy reassurance plus an optional "why" link on a compliance step.

## S7 Membership Paywall, Monthly toggle (paywall, position 1)

- H: Unlock thousands of workouts (over hero photo of a woman doing a dumbbell workout)
- Billing toggle: Monthly (selected) / Annual · Save up to 17%
- Plan card 1 (selected, white outline): Peloton App One / Strength, yoga, gym, outdoor running, and more workouts / $15.99/mo
- Badge on card 2 (purple): Full app access
- Plan card 2: Peloton App+ / Exercise bike, treadmill, and rower workouts / Includes everything in App One / $28.99/mo
- Equipment help text: Own Peloton equipment? Go to your Bike, Tread, or Row to sign up for a membership.
- CTA (sticky bottom tray, white pill): Start 1 month free trial
- Secondary link: Compare all features >
- No close/skip affordance visible in the capture. No per-plan feature checklists; each tier is one sentence of workout types plus a price.
- Layout economy: ~63 visible words, ~10 elements.

## S8 Membership Paywall, Annual toggle (paywall, position 2)

- H: Unlock thousands of workouts
- Billing toggle: Monthly / Annual (selected) · Save up to 17%
- Plan card 1 (selected): Peloton App One / Strength, yoga, gym, outdoor running, and more workouts / $159/year · That's $13.25/mo
- Badge on card 2: Full app access
- Plan card 2: Peloton App+ / Exercise bike, treadmill, and rower workouts / Includes everything in App One / $289/year · That's $24.08/mo
- CTA: Start 1 month free trial
- Secondary link: Compare all features >
- The equipment help line from the Monthly view is not present in this capture.
- Layout economy: ~55 visible words, ~9 elements; annual prices carry an italic per-month translation ("That's $13.25/mo").

## Unviewed screens

1. Welcome, position 1: untitled welcome video (splash → glassmorphic sign-up card → OAuth pills, per element metadata)
2. Onboarding, position 1: untitled onboarding video (social login → email/password → date picker → comparison table, per element metadata)

## Reading

- The gate IS the onboarding. Peloton spends its five onboarding screens entirely on account mechanics (email, password, username, birthdate) and asks zero preference or goal questions; personalization is implied by the product vignettes ("Weekly goal · 1/3 days"), never collected pre-paywall. One job per screen, headlines of 3-5 words, disabled CTAs until input is valid.
- Objections are answered in single declarative lines placed exactly where they arise: "No Peloton equipment needed." under the welcome headline, "This is how others will see you in class. You can always change it later." under the username field, a two-sentence privacy note plus "Why does Peloton need this?" on the age step.
- Price framing is menu-style, not pressure-style: two tiers described only by workout types (one sentence each), a toggle whose savings claim is modest and precise ("Save up to 17%"), annual prices translated to per-month equivalents ("That's $13.25/mo"), and a trial-length CTA ("Start 1 month free trial") with no urgency copy, no testimonials, no feature checklist, and no visible decline link; the soft exit is "Compare all features".
- Voice is second-person imperative and clipped ("Track progress, crush your goals"); the only long sentences in the whole flow are legal/compliance strings and the pre-checked marketing opt-in. Hardware owners are deliberately routed away on the paywall itself ("Own Peloton equipment? Go to your Bike, Tread, or Row to sign up for a membership.").
