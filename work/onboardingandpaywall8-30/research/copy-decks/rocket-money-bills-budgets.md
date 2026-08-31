# Rocket Money - Bills & Budgets: onboarding + paywall copy deck

Source: Appllama (app_id 1130616675, journey-ordered capture, 21 screens) + Mobbin (paywall screens, Rocket Money iOS: 50401be4-6845-434a-989c-153bf925170f, db7e5d7d-bf6c-4e34-8f42-d5a8ba2105f5, 1137fa1a-5548-440a-8f06-0a52032a713a). Date: 2026-08-31. Verbatim third-party capture.

## Flow overview

- 21 screens in the Appllama journey capture: 3 welcome-screen + 18 onboarding. No paywall section exists in the Appllama capture; the paywall (pay-what-you-think-is-fair trial screen) was captured from Mobbin and sits AFTER account creation and bank linking, at the end of setup.
- Account gate position: MID-flow. Name entry (onboarding position 7) and email entry (position 8) come after three profiling questions and a testimonial, and before notifications, referral source, and bank linking.
- Paywall position: END. Trial offer with self-selected price, then an explicit "Agree & Continue" debit-authorization confirmation screen.
- Sequence: brand splash → welcome/social proof → "How can we help?" → testimonial → financial goals → savings goal → name → email + terms → household profile → notification permission pitch → referral source → bank linking intro → institution picker → Plaid consent → (post-setup) paywall.

## S1 Welcome Sign Up (welcome-screen, position 3)

- Logo: Rocket Money
- App mockup copy (within phone preview): "Current spend this month" / "$2,942" / "$143 below avg. spend" / "BUDGET" / "Payday in 3 days" / "Checking $5,848" / "Card Balance $1,684" / "Net Cash $4,102" / "Savings $433" / "Investments $12,874"
- Metric badge 1: "$2.5 billion" / "Saved by 10 million people"
- Metric badge 2: "186K+" / "5 star ratings" (five stars rendered)
- CTA: "Create account"
- Secondary: "Have an account? Log in"
- Legal/proof link: "See how we calculated $2.5B"
- Layout economy: ~25 words outside the mockup; 1 CTA + 1 login link + 1 proof link; social proof carries the screen, no headline at all.

## S2 Onboarding Welcome (onboarding, position 2)

- H: "You've started your journey to financial zen!"
- CTA: "Continue"
- Layout economy: 8 words + logo + one button on a white canvas; pure momentum screen.

## S3 Help Goal Selection (onboarding, position 3)

- H: "How can we help?"
- Body: "Choose as many options as you'd like"
- Options: "Track my spending" / "Cancel my subscriptions" / "Track my net worth" / "Create a budget" / "Lower my bills" / "Monitor my credit score"
- CTA: "Continue"
- Layout economy: ~30 words, 6 multi-select icon cards + 1 CTA; every option is a first-person verb phrase.

## S4 Testimonial Intro (onboarding, position 4)

- Quote: ""Within a couple of hours, I saved a bunch of money. The ads are no joke."" ("saved a bunch of money." emphasized in red)
- Attribution: "- Colton Wright, Rocket Money Member"
- CTA: "Continue"
- Layout economy: ~22 words; floating brand app icons (LinkedIn, Instacart, etc.) as visual filler; single quote + one button.

## S5 Financial Goals (onboarding, position 5)

- H: "What are your top financial goals?"
- Options: "Pay off my debt" / "Reduce my spending" / "Stay on top of my finances" / "Grow my savings" / "Something else"
- CTA: "Continue"
- Layout economy: ~28 words, 5 multi-select icon cards + 1 CTA; no body copy.

## S6 Savings Goal (onboarding, position 6)

- H: "Are you saving for something specific?"
- Body: "Choose your top savings goal"
- Options: "A house" / "An emergency fund" / "A car" / "To pay off debt" / "Something else"
- CTA: "Continue"
- Layout economy: ~25 words, 5 single-select cards + 1 CTA.

## S7 Name Entry (onboarding, position 7 — account gate begins)

- H: "What's your name?"
- Body: "Please enter your full, legal name below to get started with Rocket Money"
- Fields: "First Name*" / "Last Name*"
- CTA: "Continue" (disabled/gray until filled)
- Layout economy: ~20 words, 2 fields + 1 disabled CTA; "full, legal name" signals financial-product seriousness.

## S8 Email Entry (onboarding, position 8 — account gate)

- H: "What's your email?"
- Body: "Enter your email address below. This will be your login to Rocket Money."
- Field: "Email Address*"
- Checkbox 1: "Enable Passcode" / "Skip logging in with your password"
- Checkbox 2: "I agree to the:" / "Rocket Money Terms of Service" / "Rocket Account Terms of Use" / "Privacy Policy" (all underlined links)
- CTA: "Continue" (disabled/gray until filled)
- Layout economy: ~40 words, 1 field + 2 checkboxes + 3 legal links + 1 disabled CTA; no password field on this screen.

## S9 Update Preferences (onboarding, position 10 — notification permission pitch)

- H: "Never miss an update about..."
- Section label 1: "Upcoming bills & subscription renewals" — example card: "Your Doordash subscription renews in 5 days"
- Section label 2: "Unusual transactions" — example card: "Unusually large transaction detected"
- Section label 3: "Price increases" — example card: "Your Spotify price increased by $4.99 per month"
- CTA: "Continue"
- Decline: "Not Now"
- Layout economy: ~35 words; sells notifications with three concrete fake alerts (named merchants, real dollar amounts) before the OS prompt; explicit decline link.

## S10 Account Link Intro (onboarding, position 14)

- H: "Let's Link All Your Financial Accounts"
- Body: "Get the full view of your financial picture by linking accounts."
- Visual: orbit of institution logos (Bank of America, American Express, Robinhood, Chase) around the Rocket logo; pagination dots (1 of 4)
- CTA: "Continue"
- Layout economy: ~18 words + logo orbit + 1 CTA; trust borrowed from bank brands rather than copy.

## S11 Plaid Permission (onboarding, position 16)

- H: "Rocket Money uses Plaid to connect your account"
- Card item 1: "Connect in seconds" / "Thousands of apps trust Plaid to quickly connect to financial institutions"
- Card item 2: "Keep your data safe" / "Plaid uses best-in-class encryption to help protect your data"
- Terms: "By continuing, you agree to Plaid's Privacy Policy and to receiving updates on plaid.com"
- CTA: "Continue"
- Layout economy: ~50 words; bottom-sheet modal, 2 reassurance bullets + fine print + 1 CTA.

## S12 Premium Trial Paywall (post-setup; Mobbin capture)

- H: "Try money-saving features for free"
- Body: "Invest in financial peace. We trust you to pick a post-trial price that feels fair."
- Subhead: "Pay What You Think is Fair"
- Badge: "Most people pick $10"
- Price options: "$9/mo ($0.30/day)" / "$10/mo ($0.33/day)" (selected) / "$11/mo ($0.36/day)"
- Link: "Choose custom amount"
- Section H: "Rocket Money pays for itself"
- Section body: "Save up to $768 per year* and take advantage of our other benefits below:"
- Benefit card: "Save more money" / "419K members saved money in past 30 days" / "Find and cancel subscriptions you don't use" / "Build unlimited budgets customized to your needs" / "Automate your savings to reach financial goals"
- Trial pill (pinned above CTA): "7 day free trial, cancel anytime"
- CTA: "Start Free Trial"
- Layout economy: ~95 visible words across the scroll (~70 above the fold); 3 price chips + 1 custom link + 1 CTA; the price is the user's own choice, anchored by a social-proof badge.

## S13 Trial Confirmation / Charge Authorization (post-paywall; Mobbin capture)

- H: "Fantastic!"
- Body: "You're well on your way to a brighter financial future with these premium services."
- Feature list: "Cancellation Concierge" / "Net Worth Tracking" / "Unlimited Budgets & Categories" / "Transaction Tags" / "Full Credit Report & Monitoring" / "Financial Goals" / "Realtime Account Sync"
- Terms: "I agree to the Rocket Money Terms of Service and Privacy Policy. I authorize Rocket Money to electronically debit my account for $10.00 per month + applicable tax after the trial period ends on October 08, 2025. I understand I may cancel my subscription at any time in app or by emailing support@rocketmoney.com."
- Links: "Terms of Service" / "Privacy Policy"
- CTA: "Agree & Continue"
- Layout economy: ~90 words, half of them the authorization paragraph; a dedicated consent screen with exact monthly amount, trial end date, and cancel channels spelled out before the trial starts.

## Unviewed screens

1. Welcome position 1 — (unnamed welcome video)
2. Welcome position 2 — Splash Screen
3. Onboarding position 1 — (unnamed onboarding video)
4. Onboarding position 9 — Household Profile
5. Onboarding position 11 — Splash Screen
6. Onboarding position 12 — Referral Source
7. Onboarding position 13 — Referral Detail
8. Onboarding position 15 — Institution Picker
9. Onboarding position 17 — reCAPTCHA Check
10. Onboarding position 18 — Apple Login Connect

## Reading

- First person everywhere the user chooses, second person everywhere the app promises. Every option is "my": "Track my spending", "Pay off my debt", "Lower my bills". Headlines are short questions ("What's your name?", "How can we help?") — the flow reads as a conversation, and no question screen carries more than one sentence of body copy.
- Price is framed as the user's own decision. The paywall's core move is "We trust you to pick a post-trial price that feels fair" with three near-identical chips ($9/$10/$11) anchored by "Most people pick $10" and softened to cents per day ($0.33/day). The anchor does the selling; the copy never argues for a number.
- Compliance is a feature, not fine print. A whole screen ("Fantastic!") restates the exact debit amount, tax, trial end date, and two cancel channels behind an explicit "Agree & Continue" — the charge terms sit directly above the button, not buried under it.
- What's omitted: no plan-tier comparison, no "Most popular" plan badges, no feature lock icons, and no price anywhere in the first 20+ screens. Value proof is aggregate and third-party instead: "$2.5 billion Saved by 10 million people", "186K+ 5 star ratings", a named member quote, and "419K members saved money in past 30 days" — plus a proof link ("See how we calculated $2.5B") that invites scrutiny rather than dodging it.
