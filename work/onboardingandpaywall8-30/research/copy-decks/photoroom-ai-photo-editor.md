# Photoroom: AI Photo Editor: onboarding + paywall copy deck

Source: Appllama (app_id 1455009060, category photo/video). Captured 2026-08-31. Verbatim third-party capture: all quoted strings transcribed exactly as rendered on screen, including third-party punctuation.

## Flow overview

- 33 captured screens total: 3 welcome, 9 onboarding, 3 paywall, 18 other-tabs.
- Onboarding funnel is 12 screens (welcome + onboarding sections), but only ~5 are copy steps: welcome, 2 survey questions, photo demo, success. The rest are the demo doing its work (picker, processing).
- Account gate: ABSENT from the onboarding funnel. Sign-in exists only as an optional screen in the Content tab (position 16 of other-tabs), framed as "save and edit your images". No email, no password, no account before the paywall.
- Paywall position: end of onboarding, after the free background-removal demo succeeds and the editor home is shown. Three-tab paywall (Pro / Max / Ultra), each tab a full paywall with its own hero, subhead, and prices.
- Loading/generation moment: a wordless scan-line animation over the user's photo (two screens, zero copy), then a success screen.

## S3 Onboarding Intro (welcome, spl_0z8g6 flow pos 3)

- Eyebrow: "Welcome to Photoroom"
- H: "Create professional images"
- CTA: "Continue"
- Terms: "By continuing, you agree to our Terms and acknowledge that you have read our Privacy policy."
- Note: ~25 visible words, 5 elements (progress bar, eyebrow, headline, full-bleed hero photo of a perfume bottle, CTA + terms). Terms consent is folded into the very first Continue.

## S2 Referral Survey (onboarding pos 2, onb_05ez7)

- H: "How did you hear about Photoroom?"
- Options: "Google search" / "Social media" / "Someone shared a link with me" / "ChatGPT (or AI tools)" / "Shopify" / "App Store" / "Word of mouth"
- CTA: none; tapping an option advances. No skip affordance.
- Note: ~24 words, 8 elements (headline + 7 pills). Bottom half of the screen is empty white space.

## S3 Seller Survey (onboarding pos 3, onb_aeroo)

- H: "Do you sell physical products online?"
- Options: "Yes, it's my main job" / "Yes, occasionally as a side hustle" / "No, I don't sell any products online"
- CTA: none; tap advances. No skip affordance.
- Note: ~24 words, 4 elements. This is the segmentation question the paywall tiers later speak to.

## S4 Photo Upload Prompt (onboarding pos 4, onb_l76in)

- H: "Start from a photo"
- Body: "Magically remove the background from one of your pictures."
- CTA: "Select a photo"
- Secondary CTA: "Use a sample image"
- Note: ~20 words, 5 elements (headline, one-line body, collage of 3 sample photos, primary + secondary CTA). The escape hatch ("Use a sample image") removes the only friction point.

## S5 Sample Image Picker (onboarding pos 5, onb_6j1w0)

- Sheet H: "Choose one of these images"
- Content: 6 tappable sample photos (earrings, car, dress, plush toy, burger, portrait); close X.
- Note: 5 words on the sheet. Pure picker, no persuasion copy.

## S6 Removal Processing (onboarding pos 6, onb_q8m5o)

- Copy: none. A purple scan line sweeps the chosen photo (earrings on wood); the prior "Start from a photo" title sits faded behind.
- Note: 0 new words. The generation moment is silent theater, no progress copy, no fake steps.

## S8 Removal Success (onboarding pos 8, onb_2chv7)

- Eyebrow: "Just like magic"
- H: "Background removed!"
- CTA: "Start creating"
- Note: 8 words, 3 elements plus the cutout hero. The result image IS the body copy.

## S9 Editing Home (onboarding pos 9, onb_6s9hg)

- Top bar: back chevron, photo thumbnail, "Get Pro"
- Filter tabs: "All" / "Listing" / "Editing" / "Social"
- Section H: "Recommended edits"
- Card labels: "Backgrounds" / "Studio Shot" / "Original image" / "Ghost mannequin" / "Resize" / "Virtual Model"
- Section H: "Edit with AI"
- AI input placeholder: "Place on clean surface"
- Section H: "Start from blank canvas >"
- Section H (truncated at fold): "Listing essentials >"
- Tab bar: "Home" / "AI tools" / "Batch" / "Content"
- Note: ~30 words across many elements; every label is 1-3 words, all nouns. The user's own photo populates every card preview.

## P1 Paywall, Pro tab (paywall pos 1, pay_8b6sw)

- Logo: "Photoroom"
- Hero H: "Sharp. Seamless. Built to help you sell."
- Tier tabs: "Pro" / "Max" / "Ultra" (Pro selected)
- H: "Start your 7-day free trial"
- Sub: "AI tools for e-commerce brands ready to sell."
- Badge: "Save 71%"
- Plan 1 (preselected): "Yearly" · "7-days free trial, then" · "$89.99 / year" · right-aligned "$1.72 / week"
- Plan 2: "Weekly" · "$5.99 / week"
- CTA: "Start free trial"
- Terms: "Renews automatically after trial. Cancel anytime."
- Decline: X close circle, top right. Footer link: "Need help or already purchased?"
- Note: ~52 visible words total, 11 elements. Hero images are the user's own earrings photo restyled three ways.

## P2 Paywall, Max tab (paywall pos 2, pay_3cmuo)

- Hero H: "Powerful. Scalable. Built for growing brands."
- Tier tabs: "Pro" / "Max" / "Ultra" (Max selected)
- H: "Start your 7-day free trial"
- Sub: "High-volume AI workflows for larger brands."
- Badge: "Save 40%"
- Plan 1 (preselected): "Yearly" · "7-days free trial, then" · "$249.99 / year" · "$20.83 / month"
- Plan 2: "Monthly" · "$34.99 / month"
- CTA: "Start free trial"
- Terms: "Renews automatically after trial. Cancel anytime."
- Decline: X close. Footer link: "Need help or already purchased?"
- Note: same skeleton as Pro, ~52 words; only hero, sub, prices, and unit framing (week vs month) change.

## P3 Paywall, Ultra tab (paywall pos 3, pay_4zo9z)

- Hero H: "Built for high-volume businesses"
- Tier tabs: "Pro" / "Max" / "Ultra" (Ultra selected)
- H: "Upgrade to Ultra"
- Sub: "Automated AI editing for large catalogs."
- Badge: "Save 17%"
- Plan 1 (preselected): "Yearly" · "$990.00 / year" · "$82.50 / month"
- Plan 2: "Monthly" · "$99.00 / month"
- CTA: "Continue"
- Terms: "Cancel anytime."
- Decline: X close. Footer link: "Need help or already purchased?"
- Note: ~40 words. No free trial at the top tier: headline flips to "Upgrade", CTA to "Continue", and the terms line drops the renewal sentence.

## A1 Sign In (other-tabs pos 16, oth_m0cfb, Content tab)

- H: "Sign in to Photoroom"
- Body: "Sign in to save and edit your images."
- Buttons: "Continue with Google" / "Continue with Apple" / "Continue with Facebook" / "Continue with Email"
- Terms: "By continuing, you agree to our Terms and acknowledge that you have read our Privacy policy."
- Note: ~40 words, 7 elements. OAuth-first, email last, no password field anywhere. Sits behind the Content tab, never in the funnel.

## Unviewed screens

- Welcome 1: splash video (unnamed)
- Welcome 2: Splash Screen
- Onboarding 1: onboarding flow video (unnamed)
- Onboarding 7: Cutout Processing
- Other-tabs 1: Home
- Other-tabs 2: Listing Home
- Other-tabs 3: Social Home
- Other-tabs 4: Image Picker
- Other-tabs 5: Background Scan
- Other-tabs 6: Edit Suggestions
- Other-tabs 7: Listing Templates
- Other-tabs 8: Studio Shot Colors
- Other-tabs 9: Image Editor
- Other-tabs 10: AI Shadows
- Other-tabs 11: Background Sheet
- Other-tabs 12: AI Backgrounds
- Other-tabs 13: Ghost Mannequin
- Other-tabs 14: AI Tools Hub
- Other-tabs 15: Batch Empty State
- Other-tabs 17: Export Settings
- Other-tabs 18: Performance Settings

## Reading

- The demo is the salesman and the copy stays out of its way. Between the two survey questions and the paywall, Photoroom spends 33 total words ("Start from a photo" through "Start creating"); the background removal happens on the user's own photo, and the paywall hero then shows that same photo restyled. By the time price appears, the product has already worked for you personally.
- Segmented paywalls, one skeleton. The seller-survey answer feeds three parallel paywalls that keep identical structure and swap only hero fragment, one-line subhead, and prices ("Built to help you sell." / "Built for growing brands." / "Built for high-volume businesses"). Voice is clipped two-to-four-word fragments, always about the buyer's business, never about Photoroom's technology.
- Price framing: yearly is preselected and translated down to the smallest believable unit ($1.72 / week against a $5.99 / week alternative; $20.83 / month against $34.99), with a Save % badge doing the math's advertising. The trial phrase appears twice (headline and plan row), and the renewal disclosure sits in one plain sentence under the CTA: "Renews automatically after trial. Cancel anytime."
- What is omitted: feature checklists, testimonials, ratings, user counts, comparison tables, and any account creation before payment. The only bullet-like list in the funnel is the survey options. Account sign-in is deferred to a utility moment ("save and edit your images") long after the paywall.
