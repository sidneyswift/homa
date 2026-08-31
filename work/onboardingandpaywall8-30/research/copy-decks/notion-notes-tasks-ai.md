# Notion: Notes, Tasks, AI: onboarding + paywall copy deck

Source: Appllama (app_id 1232780281, category: productivity). Captured 2026-08-31. Verbatim third-party capture: all quoted strings transcribed exactly as rendered on screen images, including third-party punctuation. 12 of 34 screens viewed.

## Flow overview

- 34 screens total: 3 welcome-screen, 10 onboarding, 2 paywall, 19 other-tabs.
- Account gate: at the very START. The third screen (Login Screen) is a full auth wall (Google / Apple / Microsoft / Passkey / SSO / Email) before any onboarding content. Email code verification follows immediately.
- Paywall: at the END of onboarding, after the "Work across devices / Get started" screen, as a dismissible sheet modal (X close, no trial framing). Two tabs: Plus and Plus & AI.
- No quiz-style personalization beyond one use-case question; no generation/loading theater except a brief "Getting ready..." modal while the invite link is prepared.

## S1 Login Screen (spl_2ugqh, welcome-screen position 3)

- H: "Your AI workspace."
- Sub: "Log in to your Notion account"
- Options (auth buttons, icon + label): "Google" / "Apple" / "Microsoft" / "Passkey" / "SSO" / "Email"
- Switch link: "New user? Sign up"
- Terms line: "By continuing, you acknowledge that you understand and agree to the Terms & Conditions and Privacy Policy"
- Footer: "Privacy & terms" · "Need help?" · "© 2026 Notion Labs, Inc."
- Layout economy: ~45 visible words, 6 stacked buttons + 1 link + legal block. Headline is 3 words; the brand promise ("Your AI workspace.") is the only marketing copy on the screen.

## S2 Email Verification (onb_73s5s, onboarding position 2)

- Label: "Email" (field prefilled: "morriss.sun1@gmail.com")
- Helper: "Use an organization email to easily collaborate with teammates"
- Label: "Verification code" (field: "906072")
- Helper: "We sent a code to your inbox"
- CTA: "Continue" (shown disabled with spinner)
- Resend: "Resend in 13s"
- Switch link: "New user? Sign up"
- Terms line: "By continuing, you acknowledge that you understand and agree to the Terms & Conditions and Privacy Policy"
- Layout economy: ~45 words, 2 fields + 1 CTA + countdown + legal block; keyboard up.

## S3 Profile Setup (onb_47yiw, onboarding position 3)

- H: "Create your profile"
- Avatar caption: "Upload photo (optional)"
- Label: "Enter your name" (field: "Morris Sun")
- Checkbox (pre-checked): "I agree to Notion marketing communications"
- Body: "You may unsubscribe from receiving marketing communications at any time. Notion's websites and communications are subject to our Privacy Policy."
- CTA: "Next"
- Layout economy: ~40 words, 1 field + 1 checkbox + consent paragraph + CTA. Marketing opt-in is pre-checked.

## S4 Use Case Selection (onb_5th6r, onboarding position 4)

- H: "How do you want to use Notion?"
- Options (card title + one-line sub):
  - "For work" / "Track projects, company goals, meeting notes"
  - "For personal life" / "Write better, think more clearly, stay organized"
  - "For school" / "Keep notes, research, and tasks in one place"
- CTA: "Next" (disabled until selection)
- Layout economy: ~30 words, 3 cards, progress bar at top. The only segmentation question in the whole flow.

## S5 Team Invite Loading (onb_zn1f7, onboarding position 5)

- H: "Bring your team."
- Sub: "Notion works best with others."
- Loading modal: "Getting ready..." (with spinner)
- Buttons (behind dimmed overlay): "Copy invite link" / "Next" (disabled)
- Layout economy: ~12 words. The loading moment is a small centered modal over the invite screen, 2 words of copy.

## S6 Team Invite (onb_algty, onboarding position 6)

- H: "Bring your team."
- Sub: "Notion works best with others."
- Buttons: "Copy invite link" / "Share to..." / "Next"
- Layout economy: ~13 words, illustration + 3 stacked buttons. Skippable via "Next"; no guilt copy.

## S7 Home Organization Intro (onb_lqgzm, onboarding position 7)

- H: "Keep your thoughts organized"
- Sub: "Use the home tab to organize your pages."
- Mockup copy (in-product preview): "Acme Labs" / "Ryo Lu" / "Jump back in" / "Acme 1.0 press release" / "Search XP 1.5 (Overall PRD)" / "@Jan 2023" / "Favorites" / "Brainstorm session" / "Tasks" / "Grocery shopping list" / "Private"
- CTA: "Next"
- Layout economy: ~12 words of instruction; the rest is a realistic product screenshot doing the persuading.

## S8 Blocks Editor Intro (onb_1c00y, onboarding position 8)

- H: "Create notes, tasks and more"
- Sub: "Use Notion blocks to create anything, big or small."
- Mockup copy: "Private" / "Acme 1.0 press release" / "Introducing Acme: A Tool for Charitable Investment Diversification" / "Introduction" / "For many people, charitable giving is an important part of their lives. But often, it can" (truncated by toolbar)
- CTA: "Next"
- Layout economy: ~15 words of instruction over an editor mockup with toolbar + keyboard.

## S9 Share Extension Intro (onb_miaqp, onboarding position 9)

- H: "Share content into Notion"
- Sub: "Share articles, photos, and more directly into your Notion pages."
- CTA: "Next"
- Layout economy: ~15 words, one image card (Vermeer's Milkmaid as sample shared content), 1 CTA.

## S10 Cross Device Setup (onb_1exoq, onboarding position 10)

- H: "Work across devices"
- Sub: "Download Notion on your phone, tablet, or desktop."
- CTA: "Get started"
- Layout economy: ~13 words, ghosted device illustration. CTA shifts from "Next" to "Get started" to close onboarding.

## S11 Plus & Notion AI Paywall (pay_94eyb, paywall position 1)

- Decline affordance: X close icon, top right of sheet modal. No "skip" text.
- Tabs (pill segmented): "Plus" / "Plus & AI" (Plus & AI selected)
- H: "Plus & Notion AI"
- Chip: "1 member limit"
- Benefits (blue check list):
  - "Notion AI" / sub: "Including Agent, Enterprise search, and AI meeting notes"
  - "Unlimited file uploads"
  - "View data with charts"
  - "Site customizations"
  - "and more..."
- Price cards: "$214.99 per year" (selected) / "$21.99 per month"
- CTA: "Subscribe for $214.99 / year"
- Footer links: "Restore subscription" / "Terms of service" / "Privacy policy"
- Layout economy: ~50 visible words. No trial, no urgency, no testimonials, no savings badge on the annual card; the CTA restates the exact charge.

## S12 Plus Plan Paywall (pay_bgoqu, paywall position 2)

- Decline affordance: X close icon, top right.
- Tabs: "Plus" (selected) / "Plus & AI"
- H: "Plus Plan"
- Chip: "1 member limit"
- Benefits (blue check list): "Unlimited file uploads" / "30 day page history" / "Invite up to 100 guests" / "View data with charts" / "Site customizations" / "and more..."
- Price cards: "$119.99 per year" (selected) / "$11.99 per month"
- CTA: "Subscribe for $119.99 / year"
- Footer links: "Restore subscription" / "Terms of service" / "Privacy policy"
- Layout economy: ~45 visible words, same skeleton as S11 with character illustrations peeking from the card edges.

## Unviewed screens

Position-ordered, name as listed (unnamed entries are flow videos):

- Welcome Screen 1: (unnamed video)
- Welcome Screen 2: Splash Screen
- Onboarding 1: (unnamed video)
- Other-tabs 1: Workspace Home
- Other-tabs 2: Welcome Page
- Other-tabs 3: To Do List
- Other-tabs 4: New Page Editor
- Other-tabs 5: Club Meeting Page
- Other-tabs 6: Page Actions
- Other-tabs 7: More Actions Menu
- Other-tabs 8: Workspace Settings
- Other-tabs 9: AI Chats Empty
- Other-tabs 10: AI Source Picker
- Other-tabs 11: AI Task Result
- Other-tabs 12: Meeting Notes Empty
- Other-tabs 13: Date Picker
- Other-tabs 14: Meeting Detail
- Other-tabs 15: Inbox Empty
- Other-tabs 16: Sidebar Navigation
- Other-tabs 17: Notification Settings
- Other-tabs 18: Preferences Settings
- Other-tabs 19: Offline Settings

## Reading

- Second person, imperative, tiny sentences. Every onboarding screen is one 3-6 word headline plus one instruction sentence ("Use the home tab to organize your pages."), then a realistic product mockup carries the rest. Total instructional copy across ten onboarding screens is under 120 words.
- The product screenshot is the copy. Feature intros persuade with in-context sample content (a press release page, a grocery list, "Jump back in") rather than benefit claims; the mockup words outnumber the marketing words on every intro screen.
- Price framing is bare and literal: no trial, no anchor strikethrough, no "save 18%" badge, no social proof, no urgency. Annual is pre-selected and the CTA restates the full charge verbatim ("Subscribe for $214.99 / year"), with restore/terms/privacy as quiet text links and an X to leave.
- What is omitted is the story: no permission asks shown, no notification prompt, no rating ask, no progress-gamification, one segmentation question total. The account gate does all the commitment work up front ("Your AI workspace." is the entire pitch before login), which only a brand with existing demand can afford.
