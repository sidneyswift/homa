# Splitwise: onboarding + paywall copy deck

Source: Appllama (app_id 458023433, category: finance). Captured 2026-08-31. Verbatim third-party capture; third-party punctuation preserved exactly as rendered, including em dashes, curly quotes, and bullets.

## Flow overview

- 31 screens captured total: 3 welcome, 12 onboarding, 1 paywall, 15 other tabs.
- Account gate position: START. Sign up (email + password, then name + phone) is the first interactive step after the logo screen; nothing is usable before an account exists.
- Paywall position: END / contextual. One subscription sheet, reached after onboarding via Pro touchpoints (purple "Charts" pill, Pro badges, account-tab promo card), never forced during the signup flow. Free product is fully usable without it.
- No loading/generation moment exists; the tutorial is a 3-card carousel that doubles as the notifications-permission backdrop.

## S1 Splash Screen (spl_o3k5d, welcome position 2)

- Visual: full-bleed low-poly teal/charcoal background, white house-outline "S" logo mark centered.
- Copy: none. Zero words.
- Layout economy: 0 words, 1 element (logo). Pure brand beat.

## S2 Welcome Auth (spl_0ct8l, welcome position 3)

- Logo wordmark: "Splitwise"
- CTA (primary, green): "Sign up"
- CTA (secondary, charcoal): "Log in"
- Footer links: "Terms | Privacy Policy | Contact us"
- Layout economy: 8 visible words, 4 elements (logo, 2 buttons, link row). No tagline, no value pitch, no social-proof strip.

## S3 Email Password Sign Up (onb_qvu4u, onboarding position 2)

- H: "Sign up"
- Field label: "Email address"
- Field label: "Password" (with show/hide eye icon)
- Helper: "Minimum 8 characters"
- CTA: "Next"
- Layout economy: ~9 words, 5 elements. Two fields per screen, no social logins shown on this step, no marketing copy.

## S4 Profile Phone Sign Up (onb_6ue3u, onboarding position 3)

- H: "Sign up"
- Field label: "Full name"
- Field label: "Phone number" (country-code picker showing "+91")
- Currency line: "I use USD ($) as my currency. Change »"
- CTA: "Done"
- Terms line: "By signing up, you accept the Splitwise Terms of Service and Privacy Policy."
- Layout economy: ~30 words, 7 elements. Terms acceptance is passive (by-signing-up), placed under the button.

## S5 Onboarding Welcome Alert (onb_3pcy4, onboarding position 4)

- H (behind overlay): "Welcome to Splitwise, Morriss!"
- Body: "Splitwise keeps track of balances between friends."
- iOS system alert title: "“Splitwise” Would Like to Send You Notifications"
- Alert body: "Notifications may include alerts, sounds, and icon badges. These can be configured in Settings."
- Alert buttons: "Don’t Allow" / "Allow"
- Page dots: 3 (carousel card 1)
- Layout economy: ~35 words, but only ~12 are Splitwise's own; the OS permission is fired on the first tutorial card, using the warm welcome as backdrop.

## S6 Balance Tracking Onboarding (onb_lf3nb, onboarding position 5)

- H: "Welcome to Splitwise, Morriss!" (first-name personalization from the signup form)
- Body: "Splitwise keeps track of balances between friends."
- Demo card header: "Overall, you are owed $64.64"
- Demo rows: "Beach trip" · "you are owed $100.00" · "David owes you $100.00"
- Demo rows: "House stuff" · "you owe $35.36" · "You owe Brooklyn S. $105.36" · "Earl E. owes you $70.00"
- Page dots: 3 (card 1 of carousel)
- Layout economy: ~35 words, 1 headline + 1 sentence + 1 illustrative UI card. The "copy" is mostly a fake product screenshot doing the explaining.

## S7 Add Expenses Onboarding (onb_m67wf, onboarding position 6)

- H: "Add expenses"
- Body: "You can split expenses with groups or with individuals."
- Demo card: "Groceries" · "$" · "94.50"
- Page dots: 3 (card 2)
- Layout economy: ~14 words, 3 elements (headline, one sentence, one mock input card).

## S8 Settle Up Onboarding (onb_rduik, onboarding position 7)

- H: "Settle up"
- Body: "Pay your friends back any time"
- CTA (text link, bottom): "Done"
- Page dots: 3 (card 3)
- Layout economy: 9 words, 3 elements. Carousel exit is a quiet text "Done", not a button.

## S9 Setup Choice (onb_n3sxn, onboarding position 8)

- Icon: party-popper illustration
- H: "Let's get started"
- Body: "What would you like to do first?"
- CTA 1 (green): "✈️ Add a group trip"
- CTA 2 (green): "🏠 Add your household"
- Decline affordance (text link): "Skip setup for now"
- Layout economy: ~17 words, 5 elements. Two concrete first jobs plus an explicit skip; no wall of use cases.

## S10 Friends Empty State (onb_d8emb, onboarding position 9)

- Nav link (top right): "Add friends"
- H: "Welcome to Splitwise, Morriss!"
- Empty-state body: "You have not added any friends yet."
- CTA (green): "Add friends on Splitwise"
- FAB: "Add expense"
- Tab bar: "Friends" · "Groups" · "Activity" · "Account"
- Layout economy: ~20 words, 7 elements incl. mascot art. Home screen doubles as the invite prompt.

## S11 Group Detail Empty (onb_4sdwb, onboarding position 12)

- Group title (user-entered): "Swiss Trip"
- Date pill: "Jul 15 – Aug 2"
- Pill row: "Settle up" · "💎 Charts" (purple gem = Pro-gated) · "Balances" · "Totals"
- Empty-state body: "You’re the only one here!"
- CTA (green): "Add members"
- CTA (outlined): "Share a link"
- FAB: "Add expense"
- Tab bar: "Friends" · "Groups" · "Activity" · "Account"
- Layout economy: ~20 words, 9 elements. First Pro tease appears here as a gem icon on one pill, no copy about it.

## S12 Subscription Offer paywall (pay_rlazv, paywall position 1)

- Close affordance: X icon, top right (immediately visible)
- Sheet header (dimmed page behind, partially cut): "Upgrade to"
- Section divider: "7-day free trial"
- Plan card 1 (pre-selected, orange-gradient border, purple check): "Individual + Trip Pass" / "12 mo • $59.99" / "$4.99" "per month"
- Plan card 2: "Duo + Trip Pass" / "12 mo • $89.99" / "$7.49" "per month"
- Section divider: "No free trial"
- Plan card 3: "Monthly" / "No Trip Pass, no free trial" / "$7.99" "per month"
- CTA (orange→green gradient): "Start your free trial"
- Fine print: "Free trial only available to eligible first time subscribers. Cancel 24 hours before trial ends to avoid being charged. Trial ends upon cancelation. Recurring billing after free trial, cancel anytime."
- Legal links: "Terms of Service • Privacy Policy"
- Layout economy: ~80 visible words, 3 plan cards + 1 CTA + fine print. Zero feature bullets, zero testimonials, zero benefit copy: the entire sheet is plan math plus trial terms.

## Unviewed screens

Position-ordered, name as listed (nulls are unnamed video captures):

- Welcome Screen 1: (unnamed animated splash video)
- Onboarding 1: (unnamed onboarding flow video)
- Onboarding 10: Create Group Trip Form
- Onboarding 11: Trip Date Picker
- Other tabs 1: Groups List
- Other tabs 2: Create Group Form
- Other tabs 3: Group Overview Empty
- Other tabs 4: Add Group Members
- Other tabs 5: Group Settings Top
- Other tabs 6: Group Settings Bottom
- Other tabs 7: Solo Group Modal
- Other tabs 8: Add Expense Empty
- Other tabs 9: Add Expense Amount
- Other tabs 10: Group Expense List
- Other tabs 11: Expense Details
- Other tabs 12: Friends Empty State
- Other tabs 13: Activity Feed
- Other tabs 14: Account Overview
- Other tabs 15: Account Settings List

## Reading

- Utility-app minimalism: the whole product pitch is one sentence ("Splitwise keeps track of balances between friends.") repeated across the welcome carousel, and each tutorial card is a 2-4 word verb headline ("Add expenses", "Settle up") plus one sentence. Demonstration is delegated to fake in-product cards with real-looking names and dollar amounts instead of benefit prose.
- Second person, personalized, zero hype: the app greets you by first name ("Welcome to Splitwise, Morriss!") on three separate screens, addresses you as "you" throughout ("You have not added any friends yet.", "You’re the only one here!"), and never uses a superlative, stat, or testimonial anywhere in the flow.
- Price framing is plan-arithmetic-first: the paywall leads with the trial ("7-day free trial" divider), sells nothing (no feature list at all: it assumes you already know why you opened it), anchors the annual-billed plan as a small monthly number ("$4.99 per month" big, "12 mo • $59.99" small), and honestly labels the escape hatch tier with a divider that reads "No free trial" and the line "No Trip Pass, no free trial".
- What is omitted is the story: no value-prop screen before signup (account gate is screen 3), no quiz, no progress bar, no discount timer, no "most popular" badge, and the paywall X is visible immediately. Friction is spent only on the two-step account form; everything after is skippable ("Skip setup for now", text-link "Done").
