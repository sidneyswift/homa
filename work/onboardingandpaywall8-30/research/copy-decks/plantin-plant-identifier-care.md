# PlantIn: Plant Identifier & Care: onboarding + paywall copy deck

Source: Appllama MCP, app_id 1527399597 (PlantIn: Plant Identifier・Care), captured 2026-08-31. Verbatim third-party capture; third-party punctuation preserved exactly as rendered.

## Flow overview

- Onboarding journey: 19 screens (3 welcome-screen, 13 onboarding, 3 paywall). The library holds 51 screens total for this app; the other 32 are post-onboarding tabs.
- Account gate: MID-flow, onboarding positions 6-7 (after four swipeable benefit slides, before the guided first identification). Full sign-up wall with social options plus a required email/username/password form.
- Paywall: END of onboarding, immediately after the guided identification demo pays off. One primary trial paywall (annual vs lifetime carousel) plus a seasonal one-time "Season pass" offer.
- Loading moment: yes, a 3-step "Plant identification" progress screen between camera and result.

## S1 Onboarding Welcome (welcome-screen, position 3)

- H: Welcome to PlantIn!
- Sub: Become a Plant Hero
- Hero callout chips (over peace lily photo): 65–80°F / Part sun / Peace Lily / Spathiphyllum
- CTA: Continue
- Terms line: By continuing you accept our Privacy Policy, Terms & Conditions and Billing Policy
- Layout economy: ~28 visible words, 7 elements (photo, 3 callout chips, headline, sub, CTA, legal footer). Product demo happens inside the hero art, not in prose.

## S2 Onboarding Care Benefit (onboarding, position 2)

- H: Your plant care just got easier
- Floating reminder cards (over fiddle-leaf fig photo): Water / Need today · Prune / In 12 days · Fertilize / In 23 days
- CTA: Next
- Decline affordance: back chevron only; 4 pagination dots
- Layout economy: ~16 words, 6 elements. Headline is the only sentence; the reminder cards do the explaining.

## S3 Onboarding Diagnosis (onboarding, position 3)

- H: Spot plant issues in seconds
- Alert badge: Overwatering / Disease detected
- Treatment card: Treatment / 1. Check plant for root rot / 2. Transfer to a pot with drainage / 3. 3. Remove dead leaves
  (numbering typo "3. 3." is rendered in the app)
- CTA: Next
- Layout economy: ~25 words, 5 elements. A fake diagnosis result stands in for a feature description.

## S4 Onboarding Success Metric (onboarding, position 4)

- H: 220,000+ plants cured
- Visual: grid of circular plant photos, no other copy
- CTA: Next
- Layout economy: 4 words total. The sparsest screen in the flow; one number is the whole argument.

## S5 Onboarding Social Proof (onboarding, position 5)

- H: Trusted by millions of plant lovers
- Laurel badges: 40M+ / Global users · 4.8★ / Loved worldwide
- Featured review card: ★★★★★ / PlantIn helped me rescue my ficus when I thought it was lost. Clear steps, easy to use, and very accurate. Highly recommend to all plant lovers / Mirana Marci / Plant mom
- Background review cards (partially visible, cropped): "…ts are now getting the right… plant saved tho… the app." / "Linda Jon… Plant par…" / "…nge my take care" / "watering an…"
- CTA: Next
- Layout economy: ~50 words, 8 elements. Densest onboarding slide; stacked reviews plus two metric laurels.

## S6 Welcome and Sign In (onboarding, position 6, account gate)

- H: Welcome to PlantIn
- Body: Create an account to get started
- Options: Continue with Apple / Continue with Facebook / Continue with Google / Continue with email address
- Footer: Already have an account? Log In
- Decline affordance: X close, top right
- Layout economy: ~24 words, 8 elements. Illustration hero, zero benefit copy; the gate assumes the prior slides sold it.

## S7 Create Account (onboarding, position 7, account gate form)

- H: Create account
- Sub: Fill in your details to get started
- Fields: Username * (Create a username) / Full name (Enter your full name) / Email address * (Enter your email address) / Password * (Create a password)
- Consent checkbox: By creating an account I agree with the service Privacy Policy, Terms & Conditions and Billing Policy
- CTA: Create account (disabled until valid)
- Footer: Already have an account? Log In
- Decline affordance: back chevron + X close
- Layout economy: ~45 words, 12 elements. Four fields incl. username, a heavy ask this early; consent is a checkbox, not passive fine print.

## S8 Identification Setup (onboarding, position 8)

- H: We've set up a plant for you!
- Body: Try identifying our plant to see how easy it is.
- CTA: Let's try
- Secondary action: Identify my plants
- Decline affordance: X close
- Layout economy: ~23 words, 5 elements. Removes cold-start risk: the app supplies the demo plant (bird of paradise photo) so the aha moment cannot fail.

## S9 Identification Progress (onboarding, position 10, loading moment)

- Title: Plant identification
- Step list: ✓ Analyzing image / ✓ Identifying characteristics / ⟳ Preparing results
- Decline affordance: X close
- Layout economy: 9 words, 5 elements. Staged checkmarks make the model feel like labor; no marketing copy at all.

## S10 Subscription Offer (paywall, position 1, primary paywall)

- Top controls: Restore (pill, top left) / X close (top right)
- Hero art callouts: Before PlantIn / After PlantIn (slider illustration, wilted vs thriving)
- H: Try for Free
- Plan carousel: Annual / 3-day free trial / $29.99 / year (selected, radio) · Lifetime (peeking from right edge) $199.99 (strikethrough) $49.99
- Toggle: Remind me before the trial ends (off by default)
- CTA: Try for Free
- Footer links: Privacy Policy / Terms of Use / Subscription Terms
- Layout economy: ~34 visible words, 10 elements. No feature list, no bullets; the before/after art plus the price cards carry everything.

## S11 Subscription Offer (paywall, position 2, same paywall, Lifetime card in view)

- Plan card: Lifetime / $199.99 (strikethrough) / $49.99 / -75% (red discount pill)
- All other copy identical to S10: Restore, Before PlantIn / After PlantIn, Try for Free (H), Remind me before the trial ends, Try for Free (CTA), Privacy Policy / Terms of Use / Subscription Terms
- Layout economy: ~36 words. The -75% badge only appears once the user swipes to Lifetime.

## S12 Season Pass Offer (paywall, position 3, secondary one-time offer)

- Title: Season pass
- H: Meet new summer care ☀️
- Body: Long days and stronger sun change the way plants grow. Let's adjust the care to keep them happy and healthy all summer long.
- Section label: New features you'll get:
- Feature list (two columns, icon + word): Water / Mist / Fertilize / Repot / Prune / New color theme
- CTA: Start journey for $19.99
- Terms line: One-time purchase
- Decline affordance: X close (top left)
- Layout economy: ~50 words, 12 elements. The only paywall with body prose; price lives inside the CTA and "One-time purchase" is the entire terms block.

## Unviewed screens

Position-ordered, by flow:

- Welcome Screen 1: (unnamed, video walkthrough)
- Welcome Screen 2: Splash Screen
- Onboarding 1: (unnamed, video walkthrough)
- Onboarding 9: Plant Scanner Camera
- Onboarding 11: Plant Result Care
- Onboarding 12: Plant Result Problems
- Onboarding 13: Dark Plant Scanner
- (32 further other-tabs screens exist beyond the onboarding journey: Plant Scanner Camera onward; not part of this deck)

## Reading

- Show, don't ask: PlantIn's onboarding contains zero questions and zero quiz. Every pre-gate screen is a mocked product moment (reminder cards, a fake diagnosis with a treatment list, a review stack) with a 4-6 word headline under it. Slides average under 25 visible words; one is literally 4 ("220,000+ plants cured").
- Second person, present tense, short declaratives: "Your plant care just got easier", "Spot plant issues in seconds". The only exclamation points are the two welcome moments ("Welcome to PlantIn!", "We've set up a plant for you!"). No feature jargon anywhere; the fanciest noun in the flow is "Spathiphyllum", and it's inside the demo art.
- The aha moment is rigged and placed BEFORE the paywall: the app hands you its own bird-of-paradise photo ("We've set up a plant for you! Try identifying our plant to see how easy it is.") so the identification demo cannot fail, then the paywall lands right after the staged win.
- Price framing: the headline and CTA are both "Try for Free"; $29.99/year appears only inside the plan card, anchored by a $199.99-struck lifetime price and a -75% badge. Trust props do half the selling ("Remind me before the trial ends" toggle, upfront Restore pill, an X that is visible from the first second). Omitted entirely: feature-by-feature paywall bullets, weekly-price decomposition, urgency timers, and any "cancel anytime" line; the reminder toggle stands in for it.
