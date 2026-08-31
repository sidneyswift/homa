# YNAB: onboarding + paywall copy deck

Source: Appllama (mcp.appllama.io), app_id 1010865877 (YNAB, finance). Captured 2026-08-31. Verbatim third-party capture; third-party punctuation (including em dashes and ellipses) preserved exactly as rendered.

## Flow overview

- 33 captured screens total: 4 welcome-section screens (position 1 is a video), 28 onboarding screens (position 1 is a video), 1 paywall screen.
- Account gate: END of onboarding, position 28 of 28, the very last screen before the paywall. Everything before it (name, ~20 quiz questions, category build, plan reveal) is gate-free.
- Paywall: single screen, immediately after account creation. Trial-forward ("Start Your Free Month"), with an explicit auto-renew consent checkbox gating the CTA.
- 12 screens viewed; the rest are listed by position under Unviewed screens.

## S3 Onboarding Pain Points (welcome, pos 3, spl_s1kj9)

Full-screen collage of thought bubbles on cream, with line-art house / grocery cart / car illustrations. No heading, no CTA on this frame.

- Bubbles: "I should be saving more."
- "Am I going to be OK?"
- "Why does every bill seem to hit at once?"
- "I could eat rice and beans…"
- "When did groceries get so expensive?!"
- "What if I lose my job?"
- "My car's been making a weird noise lately…"
- "I make good money, but where does it all go?"
- "When do I get paid again?"

Layout economy: ~50 words across 9 bubbles, zero chrome; the anxieties ARE the screen.

## S4 Onboarding Welcome CTA (welcome, pos 4, spl_a63gr)

Same collage blurred out; one bubble stays in focus, CTA stack appears.

- Focus bubble: "If you've ever worried about money, you're not alone."
- CTA (primary, pill): "YNAB can help!"
- CTA (secondary, pill): "I already have a YNAB account"

Layout economy: ~16 focused words + 2 buttons; the blur does the transition work.

## S6 Welcome Start (onboarding, pos 6, onb_b2duj)

Cream screen, tree logo, two-stanza center copy.

- H: "We'll help you get good at money."
- H2: "So you never have to worry about money again."
- CTA (primary): "Get Started"
- CTA (secondary): "I already have a YNAB account"
- Footer links: "Privacy Policy" and "Terms of Service"

Layout economy: ~19 words of copy, 2 buttons, 2 legal links. Promise stated twice (skill, then outcome).

## S7 Name Entry (onboarding, pos 7, onb_436bw)

Progress bar (near zero), back arrow, green hero card with "I ❤ YNAB." mug illustration, text field over keyboard.

- H: "Let's get started."
- Body: "First things first, people call us "why-nab". What should we call you?"
- Field label: "Name" (filled example: "Morris")
- CTA (floating pill above keyboard): "→ Next"

Layout economy: ~18 words, 1 field, 1 button. Teaches the brand's pronunciation inside the first question.

## S8 Referral Source (onboarding, pos 8, onb_s986q)

Progress bar, back arrow, question heading, scrolling option rows.

- H: "Hi Morris! How did you hear about us?"
- Options: "News article" / "Never Worry About Money Again by Jesse Mecham" / "Friend, family, or colleague" / "ChatGPT or other AI tool" / "YNAB Coach" / "Online search" / "App store" / "Influencer" / "Podcast" (list continues below fold)
- No visible CTA; rows advance on tap.

Layout economy: 8-word question, 9+ plain rows, no emoji. Name echo personalizes immediately.

## S9 Motivation Question (onboarding, pos 9, onb_n2pje)

Progress bar, back arrow, emoji option rows.

- H: "What brings you to YNAB today?"
- Options: "💸 Get out of debt" / "🧹 Simplify my finances" / "😮‍💨 Create more breathing room" / "🕹 Feel more in control" / "❤️ Manage money with my partner" / "💪 Make the most of my money" / "🔮 Other"

Layout economy: 6-word question, 7 rows, one emoji each; every option is a feeling or verb phrase, not a feature.

## S10 Social Proof (onboarding, pos 10, onb_a223r)

Progress bar, back arrow, circular photo of a real customer holding a giant novelty key ("CONGRATS! LANDMARK CREDIT UNION" / "Just got the keys!" printed on the prop).

- H: "87% of YNAB users report an increase of net worth over time."
- Quote: ""For the first time in my life, I feel like I am in control of my money.""
- Attribution: "—Chelsea, YNAB user"
- CTA: "→ Next"

Layout economy: ~32 words; one stat + one first-person quote + real photo, nothing else.

## S15 Debt Question (onboarding, pos 15, onb_cf6lc)

Progress bar (~40%), back arrow, emoji option rows, disabled CTA until selection.

- H: "Do you currently have any debt?"
- Options: "💳 Credit card" / "🚗 Auto loans" / "🎓 Student loans" / "💰 Personal loans" / "🏥 Medical debt" / "⏳ Buy now, pay later"
- Decline affordance (text link): "I don't currently have debt"
- CTA (disabled state): "→ Next"

Layout economy: 6-word question, 6 rows + opt-out link; the escape hatch is a link, not a row.

## S25 Categories Built (onboarding, pos 25, onb_vgn3l) — generation moment

White screen, large tree logo, no controls (auto-advancing interstitial).

- H: "Your categories are being built…"
- Body: "Hey, Morris, don't tell anyone we said this, but you're already our favorite new YNABer."

Layout economy: ~21 words, zero buttons; the loading moment is spent on a joke, not a spinner.

## S26 Category List Start (onboarding, pos 26, onb_j2t0b) — plan reveal

Header "Morris's Plan" with overflow menu, blue hero card with rocket illustration, then the generated category table.

- H: "Your Category List"
- Body: "Your plan is in progress! Add the finishing touches during your **free trial**." ("free trial" bolded — first monetization mention in the flow)
- Table header: "Bills" / "Available to spend"
- Rows: "🏠 Rent" / "⚡ Utilities" / "📄 Insurance" / "🚗 Auto loans" / "📺 TV streaming" / "🗓 Other subscriptions" (next section "Needs" with "Available to spend" visible below fold)
- CTA: "→ Next"

Layout economy: ~14 words of copy over a personalized artifact; amounts are blank pills, creating an open loop the trial closes.

## S28 Create Account (onboarding, pos 28, onb_l93fm) — account gate

Title bar "Create Account", back arrow, green hero card with YNAB flag illustration.

- H: "Now it's your turn"
- Body: "Create an account. Hold for applause."
- SSO buttons: "Continue with Apple" / "Continue with Google"
- Divider: "or"
- Sub-label: "Sign up with your email address."
- Fields: "Email" / "Password" (with show-password eye)
- Consent checkbox: "I agree to the YNAB Privacy Policy and Terms of Service."
- CTA (disabled until consent): "Create Account"

Layout economy: ~30 words, 2 SSO + 2 fields + 1 checkbox; gate arrives after all 27 prior screens of invested effort.

## P1 Subscription Offer (paywall, pos 1, pay_q9m5b)

Blue-green gradient hero, overflow menu top-right (no visible X), plan cards, laurel badge, bottom consent sheet. Scrollable (a "91%" stat card is cut off behind the consent sheet).

- H: "Start Your Free Month Today"
- Sub: "The average YNABer saves $600 in their first month."
- Plan card 1 (selected): "Yearly" / badge "SAVE 39%" / "$109.00/year" / "That's just 30 cents per day!"
- Plan card 2: "Monthly" / "$14.99/month"
- Social proof intro: "We don't like to brag… so we let others do it for us."
- Laurel badge: " Featured by Apple" / ""Apps We Love""
- Partially visible below fold: "91%" stat card
- Consent checkbox (required, unchecked by default): "I understand that my free trial will last until **July 8, 2026**, and will auto-renew at **$109.00/year** until cancelled."
- CTA: "Start Your Free Month"
- Decline affordance: none visible on-frame; only the overflow "…" menu top-right.

Layout economy: ~72 visible words, 2 plan cards, 1 badge, 1 checkbox, 1 CTA. Trial terms (exact end date + renewal price, bolded) sit in a user-checked consent box directly above the button.

## Unviewed screens

Position-ordered, name as listed (nulls are unnamed videos):

- Welcome 1: (unnamed video — loader, speech bubbles, pill CTA)
- Welcome 2: Splash Screen
- Onboarding 1: (unnamed video — progress bar, cards, inputs montage)
- Onboarding 2: Budget Demo Intro
- Onboarding 3: Assign Money Demo
- Onboarding 4: Basics Covered Demo
- Onboarding 5: Fully Funded Demo
- Onboarding 11: Plan Builder Intro
- Onboarding 12: Household Selection
- Onboarding 13: Encouragement Quote
- Onboarding 14: Home Type Question
- Onboarding 16: Debt Selection
- Onboarding 17: Debt Coaching Quote
- Onboarding 18: Transport Question
- Onboarding 19: Regular Spending
- Onboarding 20: Subscription Selection
- Onboarding 21: Future Bills Intro
- Onboarding 22: Infrequent Expenses
- Onboarding 23: Goal Priorities
- Onboarding 24: Final Plan Options
- Onboarding 27: Category List Scroll

## Reading

- Voice is first-person-plural coach with deadpan jokes ("people call us "why-nab"", "Hold for applause.", "don't tell anyone we said this"). Warmth is spent at friction points: the name field, the loading wait, and the account gate each carry the funniest line in their neighborhood.
- The flow opens with the user's inner monologue (9 verbatim money anxieties) before YNAB says a word about itself; the promise, when it comes, is emotional and doubled: "get good at money" then "never have to worry about money again". Questions are 6–8 words; options are feelings and life facts, never features.
- Price framing is trial-first and radically transparent: the headline sells the free month, the sub sells an outcome stat ("saves $600 in their first month"), yearly is anchored with "SAVE 39%" and reframed as "just 30 cents per day", and the user must actively check a sentence containing the exact trial end date and renewal price before the CTA works. Nothing is buried in fine print — the terms line IS the interaction.
- What's omitted: no feature checklist or plan-comparison matrix on the paywall, no countdown timers, no fake discounts, no visible X-to-dismiss (only an overflow menu), and no account ask until screen 28 — identity is earned only after the personalized plan artifact already exists and its amounts are left blank for the trial to fill.
