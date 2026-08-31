# ChatGPT: onboarding + paywall

Source: Appllama MCP, app_id `6448311069`. Revenue $276M/mo (highest in our research set), 20M downloads, 4.83★ (9.4M ratings), #1 in Productivity (US). Category: Productivity / Utilities.

The single highest-revenue app in our whole research set uses almost none of the article's prescribed persuasion sequence. There is no name/gender/usage-frequency/referral-source intake, no multi-select goals or preferences screen, no social-proof screen, no four-angle pain-point interrogation, no fake "personalizing…" loader, and no pre-paywall stats screens: the entire identity → context → desire → investment → trust → permission → pain amplification → personalizing loader → stats sequence from the article is compressed into exactly one single-select question ("What do you want to use ChatGPT for?": School / Work / Personal tasks / Fun & entertainment / Other). Instead, ChatGPT does something the article never considers: it lets you use the real product (type a real prompt, get a real streamed answer) as a guest, before it ever asks you to create an account. Signup is deferred until you try to do something that needs it, not front-loaded as step one. And the paywall is not a wall at all: there's no hard gate blocking free use, no countdown, no fake urgency, no testimonials (consistent with our own claims law: no paying-customer proof exists to show anyway), and no discount framing. It's a plain, static Free-vs-Plus/Go feature comparison table reachable from an "Upgrade" pill inside the chat UI, functioning exactly like Duolingo's settings-accessible upsell rather than a gate you must clear to proceed.

## Onboarding (16 screens, journey order)

| # | Screen | What it does |
| - | --- | --- |
| 1 | Onboarding Intro (video) | Animated splash/logo loader intercut with live suggestion-card and input-bar motion; no CTA copy, just brand motion before the app appears. |
| 2 | Guest Chat Home | Drops the user straight into the real chat home as a guest: two prompt-suggestion cards, live composer with mic/attachment/send, full iOS keyboard. Only a small pill "Log in" sits top-left; login is optional, not required to start typing. |
| 3 | Assistant Answer | Shows a guest actually receiving a real streamed markdown answer to a typed question, proving the product works before any account exists. |
| 4 | Auth Options Sheet | A bottom sheet interrupts (likely triggered by a message-count or feature limit) offering Continue with Apple, Continue with Google, Sign up, or Log in: the first ask for identity, and it's optional-feeling (close X still present). |
| 5 | Log In / Sign Up | Full email-first auth screen: email field, "OR" divider, outlined Apple/Google buttons, phone-login option. Standard account creation, no persuasion copy. |
| 6 | Create Account Password | Email + password fields with eye-toggle visibility; Continue CTA disabled until valid. Pure form mechanics. |
| 7 | Create Account Valid | Same form once password rules are satisfied; Continue CTA now enabled, password-rule helper text visible. |
| 8 | Email Verification | 6-digit code entry screen tied to iOS number keypad, resend-email link, legal footnote links. |
| 9 | Age Confirmation | Name + age input fields with legal consent text, a minimal demographic ask, bundled with account creation rather than as a standalone "get to know you" step. |
| 10 | Onboarding Intro (hero) | A second, more marketing-style hero screen ("Welcome to ChatGPT"-style large headline) with a bottom auth panel repeating Apple/Google/Sign up/Log in, a fallback entry point for users who reach this screen without having authenticated yet. |
| 11 | Notifications Prompt | Value-first framing ("Let ChatGPT tell you when tasks are done") immediately followed by the native iOS system permission dialog (Allow/Don't Allow): one explanatory line, then the real OS prompt, no dedicated illustration screen. |
| 12 | Use Case Survey | The ONLY preference-gathering screen in the whole flow: single-select "What do you want to use ChatGPT for?" (School / Work / Personal tasks / Fun & entertainment / Other), explicitly framed as feeding suggestions, not personalization theater. |
| 13 | Chat Home (post-onboarding) | The real authenticated home screen: hamburger menu, "Upgrade" pill already visible in the header, new-chat icon, starter action list, composer with voice button. |
| 14 | Welcome Examples Chat | A chat thread showing example prompts and assistant responses with message action icons, effectively an in-context tutorial rather than a slide-based feature tour. |
| 15 | Task Plan Answer | A real multi-step answer (markdown bullet list) to a task-planning-style prompt, again demonstrating capability live rather than describing it. |
| 16 | Scrolled Task Answer | The same answer thread scrolled further, showing message actions and voice-mode entry point; onboarding closes still inside a live, working product. |

## Paywall (2 screens)

| # | Screen | Notes |
| - | --- | --- |
| pay1 | ChatGPT Plus Upgrade | Segmented picker (Go / Plus) at top, feature-comparison table (Free column vs Plus column: Core model, Advanced models, More messages/uploads, Advanced image creation, Expanded memory, Codex/deep research…), black pill "Upgrade for $19.99", "Purchase on web" link, small "Auto-renews monthly. Cancel anytime." caption. No headline pain copy, no urgency, no testimonials. |
| pay2 | ChatGPT Go Upgrade | Same template, Go tab selected: shorter feature list (More messages, More uploads, More image creation, Longer memory), "Upgrade for $8.00", identical auto-renew caption plus an ads disclaimer ("This plan may include ads. Learn more"). |

Pricing framing is unusual for this research set: rather than one plan at one price, ChatGPT runs a tiered ladder (Go $8/mo, Plus $19.99/mo or $200/yr, Pro 5x $100/mo, Pro 20x $200/mo) plus an entirely separate à la carte credit-pack system (100 credits/$4, 500/$20, 1000/$40) sold outside the plan tiers for metered overage. This paywall isn't gating anything: it's a pure upsell surfaced from an always-visible "Upgrade" pill in the chat header (see screen 13), reachable at will, never blocking a free user from chatting. Functionally identical in role to Duolingo's settings-accessible plan screen: an ambient monetization surface, not a checkpoint.

## Verdict for our spec

- Persuasion-sequence onboarding is not a precondition for revenue at scale: the single highest-revenue app in the set (by a wide margin) uses one preference screen total, no pain-point interrogation, no fake personalization loader, and no pre-paywall stats; the article's entire nine-step emotional-priming sequence is absent.
- ChatGPT substitutes "let them use the real product as a guest" for "make them feel understood via survey questions." Homa's working-edge-and-progress substance is a stronger trust builder than any amount of goal-multiselect theater, and this is evidence a fast path to a genuine first interaction can out-convert an emotional-priming funnel, at least for a category where the product's core loop is instantly demonstrable.
- The paywall being an ambient, always-reachable upsell rather than a gate is a category signal, not a universal law: ChatGPT can afford this because its free tier is genuinely useful and its top-line revenue comes overwhelmingly from raw scale (20M downloads) rather than forced conversion. Homa's business model (subscription-gated homeschool tooling) is structurally closer to Duolingo than to ChatGPT, so this cuts toward "heavy persuasion sequencing is not mandatory," not toward "remove the gate."
- Where ChatGPT is NOT restrained is account-creation friction: it runs a long, traditional multi-screen signup (email, password, verification code, age); its restraint is specifically in emotional persuasion copy and preference-gathering, not in overall screen count. Our spec should distinguish "fewer persuasion beats" from "fewer screens", because they are not the same axis.
- Tiered pricing plus a separate credit-pack economy suggests revenue at this scale comes from usage-based upsell moments (hitting a message/image limit) rather than from onboarding-sequence conversion pressure, a different lever than anything in the article, and likely a lower-priority pattern for Homa's flat-subscription model but worth flagging for later work on usage-triggered upgrade prompts.

## Files

Downloaded to `/Users/sidneyswift/Documents/Projects/Sidney/homa/work/onboardingandpaywall8-30/research/ai-productivity-chatgpt/img/`:
- `welcome1_SplashLoader.mp4`, `welcome2_OnboardingWelcome.webp`
- `01_OnboardingIntroVideo.mp4` through `16_ScrolledTaskAnswer.webp`
- `pay1_ChatGPTPlusUpgrade.webp`, `pay2_ChatGPTGoUpgrade.webp`
