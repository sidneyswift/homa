# ChatOn AI - Chat Bot Assistant: onboarding + paywall copy deck

Source: Appllama (app_id 1661308505), journey-ordered screen walk, captured 2026-08-31. Verbatim third-party capture; punctuation preserved as rendered.

## Flow overview

- 20 screens total in the library walk: 2 welcome (1 video + 1 still), 5 onboarding (1 video + 4 stills), 1 paywall, 12 other-tabs.
- Entry flow the user actually walks: welcome → 4 onboarding carousel pages → paywall → home. No questions are asked; the whole flow is broadcast, not quiz.
- Account gate: START, and optional. "Sign in with Apple" sits on the welcome screen above "Continue"; Continue proceeds without an account. Settings later carries a "Create Account" CTA, so the gate is fully skippable.
- Paywall position: END of onboarding, immediately after the social-proof page, before first use. Decline affordance is a dim "Cancel" top-left. A persistent "Try Premium for Free" banner re-offers on home.
- No loading/generation moment exists in this flow.

## S1 Onboarding Intro (welcome screen, spl_usdjy)

- Brand mark (top): AIBY
- Logo wordmark: ChatOn
- Sub: AI Assistant in Your Pocket
- Kicker: Powered by
- Pill: 🚀 the fastest AI models
- Award block: #1 / AI Chat Assistant (laurel leaves + star)
- Secondary button:  Sign in with Apple
- CTA: Continue →
- Terms line: By proceeding, you accept our Terms of Use and Privacy Policy

Layout economy: ~30 visible words across 9 elements; one screen carries brand, speed claim, rank claim, optional auth, and consent-by-proceeding.

## S2 Onboarding Intro (carousel page, onb_vp6nb)

- Category chip: 💬 Social Media
- Sample prompt bubble: What trending topics can I tweet about?
- Second chip (cut off at right edge): 💻 W… (carousel of use-case chips)
- H: Get Help / with Any Task ("Get Help" bold white, "with Any Task" gray)
- CTA: Continue →
- Page dots: 5, second active

Layout economy: ~14 words, 6 elements; one example prompt does all the persuading.

## S3 Onboarding Features (onb_b5w8s)

- Card grid (each with green check circle + emoji icon): Write Any Text / Compose Emails / Summarize / Translate / Rephrase / Proofread
- H: Unlock Your / Writing Potential (two-tone as above)
- CTA: Continue →
- Page dots: 5, third active

Layout economy: ~16 words, 6 cards + headline + CTA; capability list is pre-checked checkboxes, nothing to tap.

## S4 Onboarding Tool Variety (onb_rz96t)

- Tool cards: Image Generation / Ask the Web / Doc Master / YouTube Summary
- Wide card: AI Smart Keyboard (keyboard mockup with AI key, suggestion row "The" the to, Send key)
- H: Great Variety / of AI Tools
- CTA: Continue →
- Page dots: 5, fourth active

Layout economy: ~17 words, 5 cards + headline + CTA; names only, zero body copy.

## S5 Onboarding Social Proof (onb_2zwuv)

- Globe hero with floating 5-star badges
- Review card title: Amazing (5 orange stars)
- Review body: I don't write reviews... at all, but this is the BEST app I have ever owned. I pray that this app will run for the rest of my life because I kid you not. IT IS PERFECT !
- Side of a second review card visible at right edge (carousel)
- H: Join 60+ Million / Happy Users
- CTA: Continue →
- Page dots: 5, fifth active

Layout economy: ~52 words, 5 elements; the review is the only long text in the entire flow.

## S6 Subscription Offer (paywall, pay_j1355)

- Decline: Cancel (dim gray, top-left, small)
- Hero: anime illustration (girl + laptop showing ChatOn logo + cat), gradient fade into content
- H: GET PRO ACCESS ("PRO" in green)
- Divider label: BUILT ON
- Model chips (horizontal carousel): Claude 4.6 Opus / GPT-5.2 / Claude 4… (cut off)
- Feature list (icon + two-word rows, first word bold): UNLIMITED MESSAGES / BEST AI MODELS / INFINITE IMAGES / SUMMARIZER
- Plan card 1: YEARLY ACCESS / Just $39.99 per year · badge: BEST OFFER · right side: $0.76 / per week
- Plan card 2 (green outline, selected): 3-DAY FREE TRIAL · right side: then $7.99 / per week
- CTA: Try for Free
- Reassurance badge: ✅ NO PAYMENT NOW
- Footer links: Terms of Use · Privacy Policy · Restore

Layout economy: ~50 visible words across ~12 elements; charge terms ("then $7.99 per week") sit inside the selected plan card directly above the CTA.

## S7 Home Tools Dashboard (post-onboarding, oth_lqdfo)

- Trial re-offer banner: Try Premium for Free / Tap to claim your offer · button: Try
- Credits pill (top-right): ✨ 6
- Section: Tools → Image Lab / Text Lab / AI Keyboard
- Section: Specialized Chatbots → YouTube Summarizer / Study Coach / Email Writer / Supporter / Diet Planner / Astrologer
- Composer placeholder: Type your message...
- Tab bar: Chat / Assistants / History

Layout economy: ~35 words; the paywall decline lands on a home screen whose first row is another trial offer.

## Unviewed screens

1. Welcome Screen, position 1 (video, spl_u5l66)
2. Onboarding, position 1 (video walkthrough of the full flow incl. paywall, onb_93c3i)
3. Image Lab Bottom Sheet (oth_j46vb)
4. Image Generation Chat (oth_so8qv)
5. Text Lab Chat Result (oth_4tfmf)
6. Text Lab Edited Result (oth_291cw)
7. Edit Text Bottom Sheet (oth_g6m89)
8. Assistants Work Tab (oth_2h6vb)
9. Assistants Social Tab (oth_s1njw)
10. Assistants Lifestyle Tab (oth_zl5z1)
11. History List (oth_2gjza)
12. Settings Top (oth_t53xg; carries "Create Account" CTA + subscription sync card)
13. Settings Lower (oth_fu3b5)

## Reading

- Every onboarding headline is one split two-tone phrase: a bold white claim plus a gray qualifier ("Get Help / with Any Task", "Unlock Your / Writing Potential", "Join 60+ Million / Happy Users"). Body copy is nearly absent; capability cards are two-word noun labels with pre-checked green ticks, so the flow reads in seconds and asks the user nothing (zero quiz, zero personalization).
- The CTA never changes: "Continue →" on all five pre-paywall screens, then flips once to "Try for Free" at the money moment. Verbs stay generic; the product names do the selling.
- Price framing is anchor-and-reframe: the $7.99/week trial plan is pre-selected while the yearly plan is reframed to "$0.76 per week" under a "BEST OFFER" badge, making yearly look 10x cheaper on the same unit. Risk reversal stacks three ways in four vertical inches: "3-DAY FREE TRIAL", "Try for Free", "✅ NO PAYMENT NOW". Charge terms live inside the plan card, not fine print.
- Authority is borrowed rather than argued: "#1 AI Chat Assistant" with laurels, "60+ Million Happy Users", an App Store-style review in all-caps enthusiasm, and third-party model brand chips ("Claude 4.6 Opus", "GPT-5.2") under a "BUILT ON" divider. What is omitted: any explanation of how it works, any question about the user, and any visible price before the final screen.
