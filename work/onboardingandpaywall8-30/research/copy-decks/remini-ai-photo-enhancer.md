# Remini - AI Photo Enhancer: onboarding + paywall copy deck

Source: Appllama MCP, app_id 1470373330 (Remini - AI Photo Enhancer, photo/video). Captured 2026-08-31. Verbatim third-party capture: third-party punctuation, emoji, and casing preserved exactly as rendered, including dashes.

## Flow overview

- 42 screens total in the journey listing: 2 welcome, 9 onboarding, 4 paywall, 27 other-tabs (feature flows).
- Account gate: absent. No sign-in, sign-up, email, or account-creation screen anywhere in the captured flow. The only gates are a cookie/tracking consent screen and a biometric-data consent screen (both onboarding), plus an OS photo-permission primer.
- Paywall position: end of onboarding, immediately after the "You're all set!" completion screen (journey positions 12-15 of 15 pre-app screens). Primary paywall is a hard-priced trial offer; an "Other plans" sheet (Pro/Lite tabs) and a separate choose-your-own-price paywall variant follow.
- Loading/generation moment inside onboarding: none as a standalone viewed screen; the "Setup Complete" screen plays the role of the fake-work payoff ("AI model is ready"). Onboarding position 1 is a video montage (unviewed, see below).
- Viewed for this deck: 12 screens (welcome image, both consent screens, photo-access primer, 2 question screens, social-proof screen, setup-complete screen, all 4 paywall screens).

## S1 Onboarding Intro (welcome screen, spl_pdm61)

- H: Welcome to Remini! 👋
- Terms line: By continuing, you accept our Terms of Service and acknowledge receipt of our Privacy Policy (Terms of Service and Privacy Policy underlined links)
- CTA: Get Started (white pill, trailing chevron)
- Visual: hand holding a blurry pink-tinted portrait photo on black, hand-drawn marks.
- Layout economy: ~23 visible words, 4 elements (hero image, headline, terms line, CTA). No skip, no page dots.

## S2 Privacy Consent (onb_o0s5h)

- Eyebrow: Welcome to Remini! 👋
- H: Customize your experience 🫶
- Body (para 1): We use technologies that are essential for the app to function properly or to produce aggregated statistics. With your consent, we and our third-party partners use technologies to improve your in-app experience, and to provide you with personalized services and targeted advertising. To give your consent, tap Accept All and Continue.
- Body (para 2): Alternatively, you can customize your privacy settings by tapping Customize Preferences, or accessing Privacy Settings at any time. If you prefer that we only use essential technologies and those required for aggregated statistics, tap Refuse.
- CTA (primary): Accept All and Continue (white pill)
- CTA (secondary): Refuse (white pill, equal weight)
- CTA (tertiary): Customize Preferences (outlined pill)
- Layout economy: ~105 words, 6 elements. The one screen in the flow that is all body text; three stacked full-width buttons with a genuinely equal-weight Refuse.

## S3 Privacy Notice (onb_xw9c1)

- Eyebrow: Welcome to Remini! 👋
- H: We value your privacy. 🔒
- Body (para 1): To provide our services, we process information about the faces in your photos and videos. To deliver AI-powered features, your photos and related face data may be processed by trusted third-party AI service providers acting on our behalf and under strict data protection obligations.
- Body (para 2): By tapping “Continue”, you consent to the collection and use of your face data, which may be considered biometric data, and to its processing by such third-party AI service providers.
- Body (para 3): If you don’t want to provide us with this data, it’s not possible to enjoy the app’s functionalities. To learn more about how we process your data, please see our Privacy Policy. (Privacy Policy underlined link)
- Body (para 4, scrolls under the CTA, partially visible): If you upload images that include minors, you, as the holder of parental responsibility, also […]
- CTA: Continue (white pill, trailing chevron)
- Decline affordance: none. Copy states refusal means you cannot use the app.
- Layout economy: ~130 words, 3 elements beyond text (eyebrow, headline, CTA). Longest screen in the flow; single Continue button.

## S4 Photo Access Intro (onb_qm8h0)

- H: Get the most out of Remini! 🚀
- Body: To continue, Remini needs access to your photos. You can change this later in the Settings app. (Settings in italics)
- CTA: Continue (white pill, trailing chevron)
- Visual: taped polaroid collage of portraits with coral rounded shapes.
- Layout economy: ~24 words, 3 elements. Pre-permission primer before the OS photo dialog.

## S5 Gender Selection (onb_4mbwp)

- Eyebrow: Welcome to Remini!
- H: What’s your gender?
- Options: 👩 Female / 👨 Male / ⭐ Other (rounded cards, trailing chevrons; tap advances, no separate continue)
- Footer: We only use this information to suggest the best presets for you.
- Layout economy: ~19 words, 5 elements. One question per screen; the reassurance line does the "why we ask" work.

## S6 Use Case Selection (onb_jtrzn)

- Eyebrow: Welcome to Remini!
- H: What brings you here?
- Options (thumbnail rows, category eyebrow + label, trailing chevrons):
  - TEXTUAL EDITS / Choose your outfit 👗👕
  - AI FILTER / AI Muscle Filter
  - AI PHOTO / Mugshots 📷
  - ENHANCE / Fix Blurry Photos
  - ENHANCE / Enhance Your Photos
  - AI EDITS / Custom AI Edits
  - Photobooth photos 💞 (no eyebrow, thumbnail still loading)
- Layout economy: ~30 words, 8 elements. Intent question doubles as a feature-catalog tour; every row is a photo thumbnail plus 2-4 word label.

## S7 Social Proof Stats (onb_l4fhb)

- Laurel badge: 30,675
- Caption (small caps): IMAGES GENERATED TODAY
- H: Millions of people are generating images right now. (“Millions of people” and “generating” in lilac gradient, rest white)
- Sub: Ready to join them? 😍
- CTA: Continue (white pill)
- Visual: full-bleed mosaic grid of generated portraits behind the count.
- Layout economy: ~17 words, 5 elements. A live-count claim plus a one-line headline; no feature copy at all.

## S8 Setup Complete (onb_wz4wz)

- H: You're all set! ✨
- Checklist: Preferences saved ✓ / AI model is ready ✓ / Filters are ready ✓
- Visual: before/after split portrait (dashed divider), dark scrim below.
- Layout economy: ~11 words, 4 elements. No CTA visible; the completion checklist manufactures a sense of work done immediately before the paywall.

## S9 Subscription Offer (primary paywall, pay_4vjt8)

- Top bar: ✕ (dimmed circle, top-left) / Restore Purchases (underlined, top-center)
- H: Choose your Plan
- Sub: Unlock the full power of Remini–the ultimate AI Photo Enhancer.
- Plan card 1 (selected, white outline): Weekly / badge: 1 week free trial / then $9.99 /week
- Plan card 2: Yearly $79.99/year / badge: $0.99 first month / then $1.54 /week
- CTA: Try For Free (white pill)
- Link: Other plans (underlined)
- Visual: same before/after split portrait carried over from Setup Complete.
- Layout economy: ~36 visible words, 7 elements. No feature list, no testimonial, no terms paragraph; price framing is entirely "free trial then $X /week".

## S10 Pro Plans Sheet ("Other plans" bottom sheet, Pro tab, pay_ilayx)

- Sheet title: Other Plans (✕ top-left, grabber handle; Restore Purchases still visible on dimmed screen behind)
- Tabs: PRO (selected) | LITE
- Body: Unlock all our features, both on Mobile and on Desktop.
- Plan card 1: badge: 85% OFF (green) / Yearly | $79.99 / only $1.54/week
- Plan card 2 (selected, black outline): Weekly | $9.99 / $9.99/week
- Layout economy: ~26 words, 6 elements. One sentence of tier definition; everything else is price math.

## S11 Lite Plans Sheet ("Other plans" bottom sheet, Lite tab, pay_m3fe6)

- Sheet title: Other Plans
- Tabs: PRO | LITE (selected)
- Body: You won't be able to enhance videos and won't have access on desktop.
- Plan card 1: badge: 87% OFF (green) / Yearly | $34.99 / only $0.67/week
- Plan card 2 (selected, black outline): Weekly | $4.99 / $4.99/week
- Layout economy: ~24 words, 6 elements. The downgrade tier is described purely by what you lose, not what you get.

## S12 Choose Price Paywall (pay_wi9hr)

- Top bar: ✕ (top-left) / Restore Purchases (underlined, top-center)
- Tier carousel card (Pro, coral): Pro / Unlock all our features, both on Mobile and on Desktop. / pill: Weekly ⌄ (before/after split portrait inside card; a purple Lite card peeks in from the right edge, its copy cut off: "Lit[e] / Unlo[ck]… enha[nce]… addit[ional]… and r[…]")
- Panel H: Choose your favourite plan 🫶
- Panel body: We'd love for everyone to experience the magic of Remini, no matter their budget. So for your first week of generating AI photos, you're free to pick the price. ("you're free to pick the price." in bold)
- Subhead: Choose your price for the first 7 days 🎁
- Price options (segmented cards): MOST POPULAR badge / $0.00 (selected, black outline) — $0.99 — $9.99
- CTA: Try For Free (black pill)
- Terms line: Renews at $9.99/week. Cancel anytime. ("$9.99/week." in bold)
- Layout economy: ~75 words, 10 elements. The wordiest paywall in the set; the extra words buy a generosity narrative ("no matter their budget") around what is still a $9.99/week trial, with the renewal terms directly under the button.

## Unviewed screens

Position-ordered, name as listed (unnamed screens shown by flow):

1. Welcome Screen video, position 1 (spl_4k358, video montage)
2. Onboarding video, position 1 (onb_3hzyu, video: photo grid, progress list, split preview)
3. AI Muscle Preview (onboarding position 7; full-bleed feature preview with top Skip pill and bottom white CTA)
4. Home Enhance
5. Home Style Feed (position 2)
6. Home Style Feed (position 3)
7. Home Style Feed (position 4)
8. Home Style Feed (position 5)
9. Preset Detail Modal
10. Upload Selfies Intro
11. Photo Source Sheet
12. Selfie Upload Slots
13. Selfie Upload Ready
14. AI Photos Generating
15. Generated Photo Viewer
16. AI Photo Packs
17. Enhance Photo Preview
18. Upload Progress Modal
19. Enhance Result (position 16)
20. Enhance Result (position 17)
21. Enhance Result (position 18)
22. AI Filters Picker
23. AI Filter Selfie Prompt
24. AI Filter Result (position 21)
25. AI Filter Result (position 22)
26. All Edits Catalog
27. Manage Profiles Sheet
28. AI Profile Gender
29. Settings Overview
30. Settings List

## Reading

- Second person, exclamation-forward, emoji as punctuation. Nearly every headline is a short exclamatory sentence to "you" capped with one emoji (Welcome to Remini! 👋, You're all set! ✨, Get the most out of Remini! 🚀), and a persistent "Welcome to Remini!" eyebrow stitches the whole flow into one greeting. Questions are 3-4 words (What's your gender?, What brings you here?). The only long sentences in the flow are legal ones.
- The word budget is spent on consent, not persuasion. The two heaviest screens (~105 and ~130 words) are cookie and biometric consent; the persuasion screens run 11-36 words. There is no feature-benefit list anywhere: the use-case question, the social-proof mosaic, and the recurring before/after portrait carry the value story visually.
- Price is framed as trial-then-rate, always reduced to per-week. Every plan resolves to $X/week ($79.99/year becomes "then $1.54 /week", "only $0.67/week"), the CTA is always Try For Free rather than a price, discount badges (85% OFF, 87% OFF) anchor against the weekly rate, and the choose-your-price variant dresses the same $9.99/week renewal in a pay-what-you-want gift frame with "MOST POPULAR" on $0.00. The renewal terms line sits directly under the button only on that variant.
- What's omitted: any account creation (no email, no sign-in, no name), testimonials or star ratings, feature comparison tables, and money-back language. The Lite tier is described only by subtraction ("You won't be able to…"), which quietly sells Pro. Decline affordances exist but are muted: a dimmed ✕ on paywalls, an equal-weight Refuse only where EU consent law demands it, and no skip on the question screens.
