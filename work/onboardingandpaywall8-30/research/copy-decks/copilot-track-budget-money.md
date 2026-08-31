# Copilot: Track & Budget Money: onboarding + paywall copy deck

Source: Appllama (app_id 1447330651), journey-ordered screen listing + screen images. Captured 2026-08-31. Verbatim third-party capture: all punctuation, casing, and symbols preserved as rendered.

## Flow overview

- 13 screens total: 2 welcome (1 video + 1 static), 10 onboarding, 1 paywall.
- Account gate: at the very START. The welcome screen's only forward paths are "Sign up with Apple" / "Sign up with your email" (a "Demo Mode" escape hatch sits top-right). Account creation + email verification are onboarding positions 2-3; everything else comes after the gate.
- Paywall: single screen, at the END of onboarding (position 13 of 13), after security setup, bank linking, notifications, and the transaction-types explainer.
- 11 of 13 screens viewed (all static images). The 2 unviewed are videos (welcome motion loop, onboarding overview reel).

## S1 Welcome / Authentication Welcome (welcome-screen, pos 2)

- Top-right link: "Demo Mode ▶"
- H: "Let's Do Money Better"
- CTA 1 (white, Apple logo): "Sign up with Apple"
- CTA 2 (blue): "Sign up with your email"
- Footer link: "Already have an account?  Log in →"
- Layout economy: ~14 visible words, 4 text elements over a full-bleed isometric night-city illustration (buildings wear real brand logos: Wells Fargo, Citi, Charles Schwab, Capital One, Acorns, Fidelity, State Farm). The headline is the only sentence on screen.

## S2 Create Account Form (onboarding, pos 2)

- H (centered title): "Create your account"
- Field label: "FIRST NAME" · placeholder: "Name"
- Field label: "EMAIL ADDRESS" · placeholder: "email@gmail.com"
- Back arrow, no visible CTA (keyboard-driven advance)
- Layout economy: ~8 words, 2 fields. First name + email only; no password field on this screen.

## S3 Email Verification (onboarding, pos 3)

- H: "Verify your email"
- Illustration: 📫 mailbox emoji + loading spinner
- Body: "We sent a verification email to morriss.sun1@gmail.com."
- Body: "Please open the link in the email to finish creating your account."
- Layout economy: ~22 words, 3 elements. Passive wait screen; the spinner implies the app is polling for the click.

## S4 Privacy & Security (onboarding, pos 4)

- H: "Privacy & Security"
- Sub: "Let's add extra layers of security to your account and device access."
- Card 1 title: "Tap to turn on Face ID"
- Card 1 body: "Use biometrics to open Copilot on this device"
- Card 1 control: toggle (off)
- Card 2 title: "Tap to set up two-factor authentication"
- Card 2 body: "Use your password and a code to sign in"
- CTA (full-width blue): "Next"
- Layout economy: ~38 words, 2 option cards + 1 CTA. Both options optional; Next is always live.

## S5 Authenticator Setup (onboarding, pos 5, bottom sheet)

- Sheet label: "SETUP AUTHENTICATOR"
- Key pill: "HSXCMGCFH4WJZ3TISWNCQVILYK4FTK5F"
- Button: "Copy setup key"
- Steps: "1 Open your authenticator app" / "2 Tap + or Add" / "3 Select Enter a setup key" / "4 Paste the key above"
- Link row: "I don't have an Authenticator app ›"
- Link row: "Scan QR code instead ›"
- CTA (blue): "Continue"
- Layout economy: ~35 words, numbered 4-step list; every step is 3-5 words.

## S6 Link bank accounts: dashboard state (onboarding, pos 6)

- H: "Link bank accounts"
- Sub: "Securely give Copilot read-only access to automatically keep track of your accounts. We don't sell your financial data."
- Chart card: "$0.00" "• in assets" / "$0.00" "• in debt" · range tabs: "1W 1M 3M YTD 1Y"
- Banner: "Not ready to link yet?  Try demo mode →"
- Section: "CREDIT CARDS" · dashed tile: "Link a new account"
- Section: "DEPOSITORY" · dashed tile: "Link a new account"
- CTA (footer, disabled/dimmed): "Continue"
- Layout economy: ~40 words. The privacy reassurance ("read-only", "We don't sell your financial data.") is the subhead itself, not a footnote; the empty $0.00 dashboard previews the payoff.

## S7 Link bank accounts: account list continued (onboarding, pos 7)

- H + sub: same as S6
- Section: "REAL ESTATE" · dashed tile: "Link a new account"
- Section: "OTHERS" · green card: "Cash" / "Manual account" · dashed tile: "Link a new account"
- Button: "Copilot's Privacy & Security"
- Button: "Learn more"
- CTA (footer, disabled/dimmed): "Continue"
- Layout economy: ~30 words. Continue stays disabled until something is linked or demo mode is chosen; two full-width trust links before the CTA.

## S8 Link your accounts modal (onboarding, pos 8, decline interstitial)

- Modal title: "Link your accounts"
- Body: "Copilot works best when it can automatically track your credit cards and depository accounts."
- Button (white/secondary): "Connect more accounts"
- Button (blue/primary): "Continue without them"
- Layout economy: ~24 words, 2 buttons. Notably the PRIMARY blue button is the skip path ("Continue without them"); the retry is styled secondary.

## S9 Notification preferences (onboarding, pos 9)

- H: "Notification preferences"
- Sub: "With Copilot, you're always in control. Choose which notifications you'd like to receive."
- Sample push card: "◤ COPILOT" · "now" / bold "Was this you?" / "Did you recently spend $1,287 at Macy's? Tap here to review this transaction."
- Carousel card title: "Large purchase alerts" · 🤔
- Card body: "We'll send a notification when a big transaction appears in your account to make sure it was really you."
- Control: "OFF" toggle "ON"
- CTA (full-width blue): "Next"
- Layout economy: ~60 words. Each alert type is a carousel card with a realistic fake push notification demoing the value before the toggle.

## S10 Types of transactions (onboarding, pos 10)

- H: "Types of transactions"
- Sub: "Not all transactions mean the same thing. We use three different types to classify them."
- Pill button: "Learn More"
- Section header: "Regular transactions"
- Example row: "Joe's Supermarket" · badge "🥑 FOOD" · "$56.24"
- Badge line: "✳ Powered by Copilot Intelligence"
- Example row: "Dig Inn - 52nd Street" · badge "🍜 EATING OUT" · "$9.99"
- Info panel: "Money spent is considered a regular transaction."
- Info panel: "These transactions are automatically classified and organized into categories so it's easy to track your spending."
- CTA (full-width blue): "Next"
- Layout economy: ~55 words. Teaches the product's core object (the transaction) with two live-looking rows; the AI branding ("Copilot Intelligence") appears here, not on the paywall.

## S11 Claim your free trial (paywall, pos 13)

- H: "Claim your free trial"
- Laurel badge: "EDITORS CHOICE"
- Timeline item 1: "Today" / "Copilot will analyze your connected accounts to find your subscriptions, categorize your spending, calculate your investments' performance, and track your net worth."
- Timeline item 2 (bell icon): "7 days before" / "You'll receive a reminder that your free trial is about to end."
- Timeline item 3 (star icon): "In a month" / "Your Copilot subscription will begin, cancel anytime before."
- Price badge (dark pill on plan card corner): "Only $7.92 a month"
- Plan card (outlined, checked): "1 month free trial" / "Then $95 per year of service"
- CTA (blue): "Start your 1 month free trial"
- Terms line: "Cancel anytime, for any reason. After the free trial, this subscription automatically renews at the price selected above."
- Text link row: "Restore" · "All Plans" · "Enter Referral" · "Skip"
- Review preview (scroll edge): "Simply the best" · ★★★★★ / "This is by far the best budgeting/financial app I…" (cut off at fold)
- Layout economy: ~115 visible words, 1 plan pre-selected, 1 CTA, 4 low-emphasis text links including an explicit "Skip". The trial timeline (Today / 7 days before / In a month) is the body of the page.

## Unviewed screens

1. Welcome, position 1: untitled motion loop (video) - animated 3D city welcome
2. Onboarding, position 1: untitled overview reel (video) - montage of onboarding steps (inputs, bottom sheets, toggles, notification preview, feature timeline)

## Reading

- Trust copy is placed where the fear is, not in a footer: the bank-link subhead itself says "read-only" and "We don't sell your financial data.", and the decline interstitial makes "Continue without them" the PRIMARY button - the app spends visual authority proving it won't trap you, which is exactly the posture a money app needs before Plaid.
- Second person, short declaratives, one idea per screen. Headlines are 2-4 word noun phrases ("Verify your email", "Types of transactions"); the only slogan in the whole flow is the five-word welcome line "Let's Do Money Better".
- Price is framed three ways at once on one card: monthly-equivalent badge ("Only $7.92 a month"), trial-first card copy ("1 month free trial / Then $95 per year of service"), and a trial timeline that tells you the exact day you'll be reminded ("7 days before") - reassurance-as-schedule instead of feature bullets. The paywall has essentially NO feature list; the "Today" timeline entry carries the entire value pitch in one sentence.
- What's omitted: no persona quiz, no goal questions, no progress bar, no fake computing/"personalizing" step, no social-proof counts. Onboarding is task-setup (security, bank links, alerts) rather than data harvesting, and the single review card is real App Store furniture (Editors Choice laurel, ★★★★★ review) rather than invented stats.
