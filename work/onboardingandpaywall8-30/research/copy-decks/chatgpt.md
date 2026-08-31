# ChatGPT: onboarding + paywall copy deck

Source: Appllama MCP, app id 6448311069 (ChatGPT, category: AI tools). Captured 2026-08-31. Verbatim third-party capture; third-party punctuation (including em dashes) preserved exactly as rendered.

## Flow overview

- 20 journey screens total in the Appllama walk (2 welcome, 16 onboarding, 2 paywall), plus 17 other-tab screens outside the journey. 12 screens viewed.
- Account gate position: MID. The app lets you chat as a full guest first (guest home, real answers), then gates via a "Log in" pill and a bottom auth sheet. Account creation is email + password + verification code + name/age, roughly screens 6-11 of 20.
- Paywall position: ABSENT from forced onboarding. No paywall screen interrupts the flow; the paywall is pull-only, reached from an "Upgrade" pill on the post-signup chat home. Two paywall variants exist (Plus $19.99, Go $8.00) as tabs of one screen.
- No loading/generation moment exists anywhere in the flow.

## S2 Onboarding Welcome (welcome screen)

- H: Welcome to ChatGPT
- Body: ChatGPT is a free AI assistant that can help you with a wide variety of tasks.
- Item 1 (flag icon): Responses can be inaccurate / ChatGPT may provide inaccurate information about people, places, or facts.
- Item 2 (lock icon): Don't share sensitive info / Chats may be reviewed and used for training. Learn more about your choices
- Item 3 (gear icon): Control your chat history / Decide whether new chats on this device will appear in your history and be used to improve our systems.
- CTA: Continue
- Terms line: By continuing, you agree to our Terms and have read our Privacy Policy.
- Layout economy: ~66 words, 7 elements (headline, subhead, 3 icon+title+body items, CTA, terms). The only text-dense screen in the flow, and all of it is safety/disclosure, not selling.

## S4 Guest Chat Home (first interactive screen, pre-account)

- Header pill: Log in
- Suggestion card 1: Design a programming game / teach basics in a fun way
- Suggestion card 2: Create a workout plan / for resistance training
- Composer placeholder: Ask ChatGPT
- Layout economy: ~16 words, 5 elements (login pill, overflow button, 2 suggestion cards, composer with +/mic/send). Screen is mostly empty canvas; the keyboard is already up.

## S5 Assistant Answer (guest content screen)

- User bubble: Can you help me design a game concept that teaches basic programming skills? Start by asking me which programming language I'd like to focus on.
- Answer: Absolutely. To shape the game mechanics, progression, puzzles, and coding challenges appropriately:
- Answer H: Which programming language would you like the game to focus on?
- Answer lead-in: Some common choices:
- Bullets: Python — beginner-friendly, great for teaching programming fundamentals. / JavaScript — useful for web development and interactive concepts. / Scratch — ideal for younger learners and visual programming. / Java — good for object-oriented programming fundamentals. / C# — useful if you'd like the game to resemble game-development workflows. / C++ — suitable for lower-level concepts and performance-oriented programming.
- Below fold: Also, if relevant, tell me: … 3. Preferred game genre (adventure, puzzle, RPG, [cut off]
- Header pill: Log in
- Composer placeholder: Ask ChatGPT
- Layout economy: ~120 words, but every word is product output, not UI chrome; the app's own copy on this screen is 4 words ("Log in", "Ask ChatGPT").

## S6 Auth Options Sheet (account gate, step 1)

- Options: Continue with Apple / Continue with Google / Sign up / Log in
- Layout economy: ~10 words, 6 elements (close button, logo dot, 4 buttons). Zero headline, zero pitch: the sheet is pure mechanics.

## S7 Log In Sign Up (account gate, step 2)

- H: Log in or sign up
- Body: You'll get smarter responses and can upload files, images and more.
- Field: Email
- CTA: Continue
- Divider: OR
- Options: Continue with Google / Continue with Apple / Continue with phone
- Layout economy: ~28 words, 8 elements. The single benefit sentence is the only sell in the entire gate.

## S8 Create Account Password (account gate, step 3)

- H: Create your account
- Body: Set your password for OpenAI to continue
- Fields: Email (prefilled) / Password (eye visibility toggle)
- CTA: Continue (disabled until valid)
- Footer links: Terms of Use • Privacy Policy
- Layout economy: ~18 words, 8 elements. Instructional, not persuasive.

## S11 Age Confirmation (account gate, step 5)

- H: How old are you?
- Fields: Full name / Age
- Consent line: By tapping "Continue", you agree to our Terms and have read our Privacy Policy.
- CTA: Continue
- Layout economy: ~24 words, 6 elements. Terms consent repeated here, above the CTA rather than below it.

## S13 Notifications Prompt (permission pre-prompt)

- H: Let ChatGPT tell you when tasks are done
- Body: Get notified when ChatGPT finishes an image, completes a task, and more.
- System alert: "ChatGPT" Would Like to Send You Notifications
- System options: Don't Allow / Allow
- Layout economy: ~30 words, 4 elements (icon, headline, body, system card). Benefit framed as task completion, not marketing.

## S14 Use Case Survey (only question screen)

- H: What do you want to use ChatGPT for?
- Body: We'll use this information to suggest ideas you might find useful.
- Options: School / Work / Personal tasks / Fun & entertainment / Other
- CTA: Continue
- Layout economy: ~26 words, 8 elements. This is the entire personalization quiz: one question, five options, honest data-use rationale.

## S15 Chat Home (post-onboarding destination)

- Header pill: ✦ Upgrade
- Starter actions: Start chatting / Create an image / Write or edit
- Composer placeholder: Ask ChatGPT
- Layout economy: ~10 words, 6 elements. The upgrade entry point is a 1-word pill; nothing else monetizes.

## S19 ChatGPT Plus Upgrade (paywall, Plus tab)

- H: Get ChatGPT Plus
- Sub: Do more with advanced intelligence
- Plan picker tabs: Go / Plus
- Table header: Features / Free / Plus
- Rows (Free vs Plus, check/dash): Core model (✓/✓) / Advanced models (—/✓) / More messages and uploads (—/✓) / Advanced image creation with Thinking (—/✓) / Expanded memory (—/✓) / Codex and deep research (—/✓) / Early access to new features [cut off at fold] (—/✓)
- CTA: Upgrade for $19.99
- Secondary link: Purchase on web ↗
- Terms line: Auto-renews monthly. Cancel anytime.
- Layout economy: ~47 visible words, 13 elements. No trial, no anchor pricing, no urgency, no social proof; price appears only inside the CTA itself.

## S20 ChatGPT Go Upgrade (paywall, Go tab)

- H: Get ChatGPT Go
- Sub: Keep chatting with expanded access
- Plan picker tabs: Go / Plus
- Table header: Features / Free / Go
- Rows (Free vs Go): Core model (✓/✓) / More messages (—/✓) / More uploads (—/✓) / More image creation (—/✓) / Longer memory (—/✓)
- CTA: Upgrade for $8.00
- Secondary link: Purchase on web ↗
- Terms lines: Auto-renews monthly. Cancel anytime. / This plan may include ads. Learn more
- Layout economy: ~44 visible words, 13 elements. Same skeleton as Plus; the ads disclaimer is the only added line.

## Unviewed screens

- S1 Welcome flow video (Welcome Screen, position 1, unnamed video)
- S3 Onboarding flow video (Onboarding, position 1, unnamed video)
- S9 Create Account Valid (Onboarding, position 7)
- S10 Email Verification (Onboarding, position 8)
- S12 Onboarding Intro (Onboarding, position 10)
- S16 Welcome Examples Chat (Onboarding, position 14)
- S17 Task Plan Answer (Onboarding, position 15)
- S18 Scrolled Task Answer (Onboarding, position 16)
- Other tabs (outside journey): Chat Thread Scrolled, Chat Response, Attach Source Menu, Message Actions Menu, Navigation Drawer, Projects Empty State, New Project Modal, Images Home, Codex Setup, Library Empty State, Apps Home, App Detail Overview, App Detail Info, Apps Explore, GPT Profile Modal, Settings Account, Settings App

## Reading

- The product IS the onboarding. You get a real, full-quality answer before any account exists; the gate's whole pitch is one sentence ("You'll get smarter responses and can upload files, images and more."). Copy budget goes to disclosures, not persuasion: the wordiest screen in the flow is the safety/limitations welcome screen.
- Second person, short declaratives, benefit-verbs first ("Do more", "Keep chatting", "Get notified when…"). No exclamation points anywhere, no emoji, no superlatives; even the paywall sub-heads are five words.
- Price is stated once, inside the CTA ("Upgrade for $19.99" / "Upgrade for $8.00"), with a flat two-column feature table doing the differentiation. No trial, no discount anchor, no "most popular" badge, no testimonials, no countdown; compliance copy ("Auto-renews monthly. Cancel anytime.", "This plan may include ads.") sits directly under the button.
- What's omitted is the strategy: no forced paywall in onboarding at all, one single-question survey with an honest data-use reason, and every gate/paywall screen carries a visible close (X) or decline path, so nothing in the flow ever blocks the free product.
