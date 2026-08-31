# Calm: onboarding + paywall copy deck

Source: Appllama (app_id 571800810, journey-ordered screen listing + screen images), captured 2026-08-31. Verbatim third-party capture: all quoted strings transcribed exactly as rendered on screen, including third-party punctuation. Category: meditation/sleep.

## Flow overview

- 22 screens catalogued in total: 3 welcome-screen, 3 onboarding, 4 paywall, 12 other-tabs.
- Onboarding is startlingly short: an animated breath prompt, "Welcome!", ONE goals question, a logo splash, then the paywall. No name, no age, no quiz battery.
- Account gate: ABSENT from the onboarding flow. Sign-up is optional and lives in the Profile tab ("Create an account to save your progress and see your stats" with a "Sign up or Log in" button). You can reach the paywall, and the app, anonymously.
- Paywall position: immediately after the single goals question, framed as the payoff of that question ("Your plan is ready."). Paywall is dismissible (visible X, top left). Premium also has a persistent bottom-nav tab (star icon, "Premium") and contextual paywalls per surface (Sleep Story unlock, Family Plan promo card on Home).
- No loading/generation moment beyond a plain logo splash; the "plan" appears instantly.
- Viewed screens: 11 of 22 (both videos frame-sampled). All 4 paywall screens viewed.

## S1 Welcome video (welcome-screen, position 1, screen spl_q3buf)

Animated full-screen gradient, ~3.4s video. Two text states, nothing else on screen:

- State 1: "take a deep breath"
- State 2 H: "Welcome!"

Layout economy: 5 words total across two states; 1 element per state (a single line of centered or top-left text on a gradient). No button; auto-advances.

## S2 Breathing Prompt (welcome-screen, position 2, screen spl_sy5n4)

- Body (centered, thin white type, sole element): "take a deep breath"

Layout economy: 4 words, 1 element. The app's first act is a behavior, not a pitch.

## S3 Welcome (welcome-screen, position 3, screen spl_79q2b)

- H (top-left, large): "Welcome!"

Layout economy: 1 word, 1 element.

## S4 Onboarding video (onboarding, position 1, screen onb_iz977)

~14s video sampled at 5 frames. Sequence: "Welcome!" gradient → plan-selection paywall sheet (partially expanded, then fully expanded with benefit list, then collapsed to "View More Plans" with only the Individual card) → Home feed. Copy visible across frames matches S6 (paywall) and adds the Home surface:

- Home promo card: "Subscribe to Family Plan" / "Feel better together with 5 other members on a Calm Family Plan"
- Home greeting: "Good Evening"
- Section: "Popular on Calm" / link: "See All"
- Content card: "Wonder" / "Sleep Story • Matthew McConaughey" / lock badge + "103.0K"
- Tab bar: "Home  Sleep  Discover  Profile  Premium"

Layout economy: the video shows the whole funnel is welcome → paywall → home; the paywall sheet collapses to a 1-card, 1-CTA state.

## S5 Onboarding Goals (onboarding, position 2, screen onb_qlxo1)

- H: "What brings you to Calm ?" (the word "Calm" rendered as the script wordmark)
- Body: "We'll personalize recommendations based on your goals."
- Options (pill list, each with a line icon): "Reduce Stress" / "Develop Gratitude" / "Increase Happiness" / "Reduce Anxiety" / "Build Self Esteem" / "Better Sleep" / "Improve Performance"
- CTA (white pill): "Continue"
- Decline affordance: X (circular close icon, top left). No skip text.

Layout economy: ~26 words, 10 elements (headline, subhead, 7 pills, CTA). The only question in the entire onboarding.

## S6 Plan Selection Paywall (paywall, position 1, screen pay_ugkou; expanded/collapsed states confirmed in S4 video)

- Eyebrow: "Your plan is ready."
- H: "Unlock Calm for free"
- Benefit list (icon rows, first highlighted yellow):
  - "Unlimited free access for 7 days"
  - "50,000+ minutes of audio designed to relieve anxiety, stress, and more"
  - "Soothing Sleep Stories narrated by familiar voices"
  - "Exclusive music for sleep and relaxation"
- Sheet toggle: "View Fewer Plans" (collapsed state reads "View More Plans")
- Section label: "7-Day Free Trial"
- Plan card 1: "Individual" / "Yearly" / "$79.99/yr. ($6.67/mo.)" / badge: "Save 61%"
- Plan card 2: "Family" / "Yearly - 6 members" / "$119.99/yr." / badge: "Save up to 90%"
- Section label: "No Free Trial"
- Plan card 3: "Monthly" / "$16.99/mo." / "$203.88/yr."
- CTA (white pill): "Try Free & Subscribe"
- Toggle row: "Remind me 2 days before renewal" (toggle rendered ON)
- Terms line (Individual selected): "Totally free for 7 days, then $6.67/month, billed annually at $79.99/year. Cancel anytime."
- Terms line (Family selected): "Totally free for 7 days, then $10.00/month, billed annually at $119.99/year. Cancel anytime."
- Decline affordance: X (circular close icon, top left). No "continue free" text link.

Layout economy: ~68 visible words with the sheet expanded; collapsed state cuts to ~35 (1 plan card + CTA + toggle + terms). Terms recompute per selected plan.

## S7 Family Plan Paywall (paywall, position 2, screen pay_d11se)

- Hero: full-bleed family-in-bed photo
- H: "Feel better together with the Calm Family Plan"
- Subhead: "Full access to Calm Premium for 6 members for just $119.99/year (a 90% discount!)"
- Comparison grid columns: "Individual" / "Family" (Family in yellow, all checks under Family)
- Comparison rows:
  - "Access to 50K+ minutes of expert programs for 6 members"
  - "Personalized app experience for each plan member"
  - "Add or remove plan members at any time"
  - "Save up to 90% compared to Individual Plans"
- CTA (white pill): "Subscribe to Family Plan"
- Toggle row: "Remind me 2 days before renewal" (rendered OFF)
- Terms line: "$10.00/month, billed annually at $119.99/year. Cancel anytime."
- Decline affordance: X (circular close icon, top left).

Layout economy: ~70 words, ~10 elements. Price appears in the subhead itself, restated as a monthly figure in the terms.

## S8 Sleep Story Paywall (paywall, position 3, screen pay_wdgit)

- Hero: "WONDER" Sleep Story art (Matthew McConaughey)
- H: "Fall asleep faster with this Sleep Story and more."
- Checkmark bullets:
  - "A suite of sleep solutions" / body: "Hundreds of Sleep Stories, meditations, soundscapes, and music designed to lull you to sleep."
  - "Fall asleep with your faves" / body (cut off by pricing sheet): "Written by world-class mindfulness experts and"
- Badge (yellow, on Yearly card): "7-Day Free Trial"
- Plan card 1: "Yearly" / "$79.99/yr. ($6.67/mo.)"
- Plan card 2: "Monthly" / "$16.99/mo."
- CTA (white pill): "Try For $0"
- Toggle row: "Remind me 2 days before renewal" (rendered OFF)
- Terms line: "Totally free for 7 days, then $6.67/month, billed annually at $79.99/year. Cancel anytime."
- Decline affordance: X (circular close icon, top left).

Layout economy: ~60 visible words. Contextual: the locked content you tapped is the hero, and the headline names the job ("Fall asleep faster").

## S9 Premium Trial Paywall (paywall, position 4, screen pay_uk678)

- Hero: tilted collage of content-tile photography
- H: "Find your calm today with Calm Premium."
- Checkmark bullets:
  - "A suite of life-changing tools" / body: "Reduce your anxiety, manage your stress, and sleep better with over 50,000 minutes of content and tools."
  - "Learn from the best" / body: "Taught by world-class mindfulness experts and narrated by soothing and familiar voices."
  - "Backed by research" / body (cut off by CTA panel): "In a randomized controlled study, those who"
- Panel eyebrow (yellow): "Start your 7-day free trial today"
- CTA (white pill): "Try For $0"
- Toggle row: "Remind me 2 days before renewal" (rendered OFF)
- Terms line: "Then $6.67/month, billed annually at $79.99/year. Cancel anytime."
- Tab bar visible beneath: "Home  Sleep  Discover  Profile  Premium" (Premium star tab active)

Layout economy: ~70 visible words. No plan cards at all: one price, one CTA; this is the Premium-tab resident paywall.

## S10 Profile Login, the account gate (other-tabs, position 12, screen oth_b5beg)

- Page title: "Profile"
- Stats icon row: clock / calendar "21" / head-with-heart / glasses (no labels visible)
- Card body: "Create an account to save your progress and see your stats"
- CTA (white pill, person icon): "Sign up or Log in"
- Secondary CTA (light pill, lock icon): "Unlock Calm Premium"
- Tab bar: "Home  Sleep  Discover  Profile  Premium"

Layout economy: ~18 words, ~6 elements. The account ask is benefit-framed (save progress, see stats) and entirely skippable.

## Unviewed screens

Position-ordered, other-tabs section (names as catalogued):

1. Home Hero (partially seen in S4 video frame)
2. Home Dailies
3. Home Recommendations
4. Meditation Category
5. Meditation Grid
6. Sleep Category
7. Music Category
8. Discover Home
9. Discover Feed
10. Discover Collections
11. Scenes Settings

## Reading

- The onboarding is a behavior, then one question. Calm's first screen makes you do the product ("take a deep breath", 4 words, no button) before any pitch, and the entire personalization apparatus is a single goals question whose payoff line ("Your plan is ready.") is the paywall's eyebrow. The "plan" is a framing device, not a generated artifact: there is no loading moment.
- Second person, short declaratives, benefit verbs first. Headlines lead with the felt outcome ("Fall asleep faster...", "Feel better together...", "Find your calm today..."); feature nouns come after checkmarks. Sentences rarely exceed one clause; the longest strings on any screen are the legally load-bearing terms lines.
- Price is framed as free-first, then decomposed. Every trial CTA hides the price ("Try Free & Subscribe", "Try For $0"), the yearly sticker is always paired with a per-month decomposition ("$79.99/yr. ($6.67/mo.)"), monthly is shamed by an annualized total ("$16.99/mo." over "$203.88/yr."), and the terms line restates the yearly plan as a monthly figure. The self-serve "Remind me 2 days before renewal" toggle is a trust device sitting directly under the CTA.
- What is omitted: no testimonials, no star ratings, no user counts on the paywalls (social proof appears only as content popularity, "103.0K" listens, and celebrity narrators), no urgency timers, no discount codes, and no account creation anywhere in the funnel. The only decline affordance is a quiet X; there is never a "continue with limited version" text link.
