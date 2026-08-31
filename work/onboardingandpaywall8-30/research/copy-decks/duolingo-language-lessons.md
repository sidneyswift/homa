# Duolingo: Language Lessons: onboarding + paywall copy deck

Source: Appllama (app_id 570060128, journey-ordered screen listing, 58 screens total). Captured 2026-08-31. Verbatim third-party capture: all quoted strings are transcribed exactly as rendered on screen, including third-party punctuation.

## Flow overview

- 58 screens total: 3 welcome-screen, 32 onboarding, 2 paywall, 21 other-tabs.
- Account gate: absent from the captured flow. The welcome screen offers "I ALREADY HAVE AN ACCOUNT" for returning users, but no account-creation or sign-up screen appears anywhere in the captured onboarding; the user reaches lessons and the paywall with no registration wall.
- Paywall position: end of journey, after the full onboarding quiz and the first completed lesson. It is a soft "Subscription / Compare plans" page (with bottom tab bar visible), not a hard interstitial; there is no close-X because it is a navigable tab, and declining is simply leaving the page.
- Loading/generation moment: "COURSE BUILDING…" (position 10 overall) plus a "Lesson Prep Loading" beat later.
- Numbering below is overall journey order: S1-S3 welcome flow, S4-S35 onboarding flow, S36-S37 paywall.

## S3 Welcome Screen

- Wordmark: "duolingo" (below Duo mascot)
- Tagline: "Learn for free. Forever."
- CTA (primary, green): "GET STARTED"
- CTA (secondary, outlined): "I ALREADY HAVE AN ACCOUNT"
- Layout economy: 11 visible words, 4 elements (mascot, wordmark, tagline, 2 buttons). Whole value prop is 4 words.

## S6 Mascot Introduction

- Speech bubble: "Hi there! I'm Duo!"
- CTA: "CONTINUE"
- Layout economy: 5 words, 3 elements (back arrow, mascot + bubble, button). An entire screen spent on character introduction.

## S8 Language Selection

- Speech bubble (Duo, with clipboard): "What language do you speak?"
- Options (each rendered in its own language):
  - "मैं हिन्दी बोलता/बोलती हूँ"
  - "I speak English" (selected, blue highlight)
  - "আমি বাংলা বলি"
  - "నేను తెలుగు మాట్లాడతాను"
  - "நான் தமிழ் பேசுவேன்"
  - "I speak another language"
- CTA: "CONTINUE"
- Layout economy: ~20 words across 6 option rows + bubble + button; progress bar just started. Options self-identify by being written in the answer's own language.

## S10 Course Building (loading moment)

- H (small caps, gray): "COURSE BUILDING…"
- Body: "Get ready to join the 3 million people currently learning Japanese with Duolingo!" ("3 million people" bolded)
- Layout economy: 16 words, 3 elements (mascot reading on books, label, one sentence). Loading dead-time is spent on social proof.

## S12 Discovery Source

- Speech bubble: "How did you hear about Duolingo?"
- Options (visible): "YouTube" / "Google Search" / "News/article/blog" / "TV" / "WhatsApp" / "TikTok" / "App store" (list continues below fold)
- CTA (disabled until selection): "CONTINUE"
- Layout economy: ~15 words, 7+ option rows. Pure attribution survey dressed in the same conversational frame.

## S13 Learning Goal (proficiency self-rating)

- Speech bubble: "How much Japanese do you know?"
- Options (each with a signal-bars icon that fills progressively):
  - "I'm new to Japanese"
  - "I know some common words"
  - "I can have basic conversations"
  - "I can talk about various topics"
  - "I can discuss most topics in detail"
- CTA (disabled): "CONTINUE"
- Layout economy: ~30 words. Every option is a first-person "I" sentence; the bars icon carries the ranking so no numbers or CEFR levels appear.

## S18 Daily Goal Selection

- Speech bubble: "What's your daily learning goal?"
- Options (left value + right label):
  - "5 min / day" · "Casual"
  - "10 min / day" · "Regular"
  - "15 min / day" · "Serious" (selected)
  - "20 min / day" · "Intense"
- CTA: "I'M COMMITTED"
- Layout economy: ~25 words. The CTA is a first-person pledge, not "Continue"; commitment escalation is built into the button itself.

## S19 Notification Prompt (pre-permission)

- Speech bubble: "I'll remind you to practice so it becomes a habit!"
- iOS system dialog (mock/real): "“Duolingo” Would Like to Send You Notifications" / "Notifications may include alerts, sounds, and icon badges. These can be configured in Settings." / "Don't Allow" | "Allow" (blue arrow points at "Allow")
- CTA (primary, green): "REMIND ME TO PRACTICE"
- Layout economy: ~40 words including system dialog. The app CTA restates the benefit in first person; the arrow pre-frames the system prompt.

## S24 Start Point Choice

- Speech bubble: "Where would you like to start?"
- Badge (blue, on first card): "RECOMMENDED"
- Option card 1 (selected, book icon): "Start from scratch" / "Take the easiest lesson of the Japanese course"
- Option card 2 (compass icon): "Find my level" / "Let Duo recommend where you should start learning"
- CTA: "CONTINUE"
- Layout economy: ~30 words, 2 cards. Each card = 3-word title + one-line explainer.

## S32 Lesson Complete

- Top wordmark: "duolingo"
- H (large green, centered): "Way to go!"
- CTA: "CONTINUE"
- Layout economy: 4 words, 3 elements (headline, jumping Duo, button). Celebration carries the screen; zero stats copy here.

## S36 Subscription Plans (paywall, screen 1)

- Page title (on blue gradient hero with iridescent Duo): "Subscription"
- Subtitle (small caps): "COMPARE PLANS"
- Ribbon (gradient, on first card): "RECOMMENDED"
- Card 1 title: "Individual"
- Card 1 subtitle: "Speak with confidence"
- Card 1 checklist: "Unlimited energy" / "Unlimited Video Call" / "No ads"
- Card 1 CTA (outlined): "TRY FOR $0.00"
- Card 2 title: "Family"
- Card 2 subtitle: "Learn with friends for less"
- Card 2 checklist: "All Individual benefits" / "For you and 5 others" / "Only $2 more per month"
- Bottom tab bar visible (home, chest, trophy, hearts, super, more).
- Layout economy: ~37 visible words for two full plan cards. No sticker price anywhere above the fold; the only dollar figures are "$0.00" and "$2 more".

## S37 Subscription Plans (paywall, screen 2, scrolled)

- Page title (sticky): "Subscription"
- (Top of scroll: previous card's CTA "TRY FOR $0.00")
- Card title: "Lite (with ads)"
- Card subtitle: "Save big with 2x energy"
- Card checklist: "50 energy every day" / "Faster energy recharge"
- Card CTA: "TRY FOR $0.00"
- Section label (small caps, gray): "GIFT SUBSCRIPTION"
- Gift card title: "Individual"
- Gift card subtitle: "Gift distraction-free learning"
- Gift card checklist: "Add a personalized note" / "Lasts all year long" / "No auto-renewal"
- Gift card CTA: "GIFT SUPER"
- Layout economy: ~35 words for a downgrade tier plus a gift tier. Still no monthly price, no terms line, no "cancel anytime" copy on either paywall screen.

## Unviewed screens

Position-ordered (overall journey number, flow, name):

1. S1 Welcome Screen flow: untitled welcome video
2. S2 Welcome Screen flow: Splash Screen
3. S4 Onboarding: untitled onboarding video
4. S5 Onboarding: Welcome
5. S7 Onboarding: Practice Setup Intro
6. S9 Onboarding: Course Language List
7. S11 Onboarding: Course Language Selected
8. S14 Onboarding: Onboarding Confirmation
9. S15 Onboarding: Motivation Selection
10. S16 Onboarding: Motivation Selected
11. S17 Onboarding: Multiple Motivation Selected
12. S20 Onboarding: iOS Notification Permission
13. S21 Onboarding: Home Widget Prompt
14. S22 Onboarding: Add Widget Preview
15. S23 Onboarding: Benefits Overview
16. S25 Onboarding: Lesson Prep Loading
17. S26 Onboarding: First Lesson Intro
18. S27 Onboarding: Image Quiz
19. S28 Onboarding: Correct Image Result
20. S29 Onboarding: Translate Sentence
21. S30 Onboarding: Tap Word Tutorial
22. S31 Onboarding: Sentence Success
23. S33 Onboarding: Image Quiz Selected
24. S34 Onboarding: Translate Sentence Answer
25. S35 Onboarding: Audio Tap Exercise
26. Other tabs (21 screens, post-onboarding): Course Lesson Path (x3), Streak Overview, Streak Friends, Quests, League Standings, Social Feed, Streak Feed, Activity Feed, Lesson Share Feed, Practice Hub, User Profile, Subscription Account Plan, Profile Achievements, Shop Overview, Shop Boosters, Shop Gem Bundles, Energy Shop, Settings, Account Settings

## Reading

- Everything is Duo talking in first and second person. Every onboarding question is a speech bubble from the mascot ("What language do you speak?", "I'll remind you to practice so it becomes a habit!"), and every answer is written in the user's first person ("I speak English", "I'm new to Japanese"), so even the CTA becomes a pledge: "I'M COMMITTED" instead of Continue. Sentences are 4-10 words; there is no paragraph anywhere in the flow.
- Price is nearly invisible. The paywall leads with "TRY FOR $0.00" on every plan and the only other number is relative ("Only $2 more per month"). No monthly sticker price, no billing terms, no cancel/renewal line, no urgency timer on either captured paywall screen; the compare-plans page reads like a feature menu, not a checkout.
- Dead time is monetized as belief-building: the course-building loader carries the flow's one piece of social proof ("join the 3 million people currently learning Japanese"), and the free-forever promise ("Learn for free. Forever.") is planted on screen one so the late, soft paywall never contradicts the opening promise.
- What is omitted is the story: no account creation anywhere in the captured flow, no testimonials, no ratings badges, no feature tour. Thirty-plus screens are spent on questions the user answers about themselves, so the product feels personalized before the first lesson starts.
