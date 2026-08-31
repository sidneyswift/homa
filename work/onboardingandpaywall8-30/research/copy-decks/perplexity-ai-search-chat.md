# Perplexity - AI Search & Chat: onboarding + paywall copy deck

Source: Appllama (app_id 1668000334), journey-ordered screen walk. Captured 2026-08-31. Verbatim third-party capture: third-party punctuation preserved exactly as rendered, including em dashes. 12 of 27 screens viewed; 2 journey videos (welcome pos 1, onboarding pos 1) could not be frame-transcribed.

## Flow overview

- 27 screens total in the library walk: Welcome Screen (3) → Onboarding (4) → Paywall (2) → other tabs (18).
- Onboarding proper is 7 screens (3 welcome + 4 onboarding), and two of those are videos of the same surfaces.
- Account gate position: START, but soft. The very first surface is a usable guest home with the composer live ("Ask anything…"); the Create Account sheet appears immediately after and carries a dismiss X. Sign-in is passwordless (email magic link with an "Enter code manually" fallback) plus Apple/Google/SSO.
- Paywall position: post-onboarding section in the walk (positions 8-9 of the journey), not wedged inside the question flow. In-product upsells recur later as a promo toast ("Perplexity Computer is now available"), locked rows in the Options sheet, and "max" badges in the Models sheet.
- No quiz, no personalization questions, no notification prompt captured, no loading/generation ceremony screen: the closest thing is an inline "2 steps completed >" progress line inside the answer itself.

## S1 Home Chat (guest welcome, spl_du1aj)

- H (wordmark, center screen): "perplexity"
- Composer placeholder: "Ask anything…"
- Composer controls: "+" (add) · "Model" (pill) · mic icon · teal voice-wave button
- Top: segmented toggle (Perplexity mark / Computer icon), no labels
- Layout economy: 3 visible words on the whole screen ("perplexity", "Ask anything…", "Model"); ~7 elements. The product IS the first screen.

## S2 Create Account (spl_arwgc)

- Logo mark + wordmark: "perplexity"
- Sub: "Create an account for free"
- CTA 1 (black, Apple mark): "Continue with Apple"
- CTA 2 (gray, Google mark): "Continue with Google"
- CTA 3 (gray, envelope): "Sign in with email"
- Text link: "Single sign-on (SSO)"
- Footer links: "Privacy policy" · "Terms of service"
- Decline affordance: circular X, top right
- Layout economy: ~18 words, 8 elements. No value pitch, no bullets, no social proof; the only persuasion is the word "free".

## S3 Email Sign In (onb_g3ur6)

- H: "Sign in with email"
- Field placeholder: "Email"
- CTA (disabled until entry): "Continue"
- Decline affordance: circular X, top left
- Layout economy: 5 words, 4 elements. One field, one button.

## S4 Check Email (onb_twzwy)

- Icon: envelope badge
- H: "Check your email"
- Body: "A temporary login link has been sent to morriss.sun1@gmail.com"
- Text link (teal): "Enter code manually"
- Back affordance: circular back chevron, top left
- Layout economy: ~16 words, 5 elements. No password ever shown in the flow.

## S5 Home, signed in (onb_q6zcc)

- H (wordmark): "perplexity"
- Promo toast H: "Perplexity Computer is now available"
- Promo toast body: "Upgrade to Pro to automate your most complex tasks"
- Toast dismiss: X
- Composer placeholder: "Ask anything…"
- Composer controls: "+" · "Model" · Computer icon · mic icon · teal voice button
- Layout economy: ~17 words, ~10 elements. The only copy added after signup is an upsell toast; the home stays otherwise identical to the guest home.

## S6 Pro Subscription Offer (paywall, pay_8k11y)

- Top controls: circular X (left) · "Restore" pill (right)
- H: "Get the most accurate answers"
- Model logo strip (scrolling, with marks): "Claude Sonnet 4.6" · "Kimi K2.6" · "Claude Opus 4.7" (continues offscreen)
- Tier toggle: "Pro" (selected) / "Max"
- Compare table header: "Features" · "Free" · "Pro"
- Rows (Free column: check on first row only, then em-dash placeholders; Pro column: all checks):
  - "Basic search"
  - "Access to top AI models"
  - "Access to Computer"
  - "Access to deep research"
  - "Premium app connectors"
  - "More usage and memory"
- Price card 1 (selected, check badge): "Yearly" + badge "-17%" · "$200 /yr" · "$17/mo"
- Price card 2: "Monthly" · "$20 /mo" · "$240/yr"
- CTA (teal, full width): "Get Pro"
- Layout economy: ~57 visible words, ~15 elements. No trial language, no urgency, no testimonial, no terms paragraph; both billing directions are stated on each card ($/yr with $/mo equivalent, and vice versa).

## S7 Max Subscription Offer (paywall, pay_65taz)

- Top controls: circular X · "Restore"
- H: "Get the most accurate answers"
- Model logo strip (scrolled further): "…K2.6" · "Claude Opus 4.7" · "Sonar" · "GPT-5.5" (continues)
- Tier toggle: "Pro" / "Max" (selected)
- Compare table header: "Features" · "Free" · "Max"
- Rows:
  - "Basic search"
  - "Everything in Pro"
  - "Monthly Computer credits"
  - "Early access to new features"
  - "Access to Claude Opus 4.7"
  - "Highest deep research limits"
- Price card (single, selected): "Monthly" · "$200 /mo" · "$2,400/yr"
- CTA: "Get Max"
- Layout economy: ~48 visible words, ~13 elements. $200/mo is shown flat with its $2,400/yr total spelled out; no discount framing on Max.

## S8 Home Search (guest-style home, oth_drnqr)

- H (wordmark): "perplexity"
- Composer placeholder: "Ask anything…"
- Controls: "+" · "Model" · Computer icon · mic · teal voice button
- Layout economy: 3 words, ~8 elements.

## S9 Answer Results (oth_t1yt6)

- Query chip (user message, right-aligned): "tools to build ai agents"
- Progress line: "2 steps completed >" with "perplexity" logo lockup at right
- Answer opening: "Here are the main tools to build AI agents right now: LangGraph, OpenAI Agents SDK, Google ADK, CrewAI, AutoGen, n8n, Dify, Flowise, and PydanticAI. For code-first development, LangGraph, OpenAI Agents SDK, and Google ADK are the strongest starting points; for low-code workflows, n8n, Dify, and Flowise are easier to prototype with." + source chip "datacamp +3"
- Section H: "Best code-first frameworks"
- Bullets (each ends in a source chip): "LangGraph: Good for stateful, long-running agents and multi-step orchestration; it is designed around graphs and agent workflows." (langchain) · "OpenAI Agents SDK: Lightweight and production-oriented, with small primitives like agents, handoffs, guardrails, and sessions." (openai) · "Google ADK: A code-first Python toolkit for building, evaluating, and deploying sophisticated agents with flexibility and control." (github) · "CrewAI: Useful when you want role-based multi-agent setups without building every piece from scratch." (datacamp) · "AutoGen: Still a common choice for multi-agent conversation patterns and experimentation."
- Composer placeholder: "Ask a follow up…" with stop button (mid-generation) and new-thread pencil
- Layout economy: dense editorial answer (100+ words), but chrome stays at ~6 elements; inline source chips carry provenance instead of copy.

## S10 Follow-up Thread (oth_p8bd9)

- Answer bullets (continued): "Choose Google ADK if you want a modern, modular, Python-first toolkit." (github) · "Choose n8n or Dify if you want to ship faster with less code." (datacamp)
- Section H: "Simple rule"
- Body: "If you are building a serious production agent in code, start with LangGraph or OpenAI Agents SDK; if you are exploring ideas quickly, start with n8n or Dify." + chip "openai +2"
- Closing question: "Would you like a recommendation based on your stack, such as Python, JavaScript, or no-code?"
- Meta row: share, regenerate, copy icons · favicon cluster + "20 sources" · overflow "…"
- Follow-up prompts (tappable, arrow-prefixed): "I am using Python and want to build a complex multi-agent system" · "I prefer a no-code approach to integrate agents with my existing apps" · "I am a JavaScript developer looking for the best agent frameworks"
- Composer placeholder: "Ask a follow up…"
- Layout economy: the answer proposes the next three turns itself; suggested follow-ups are written in first person as the user.

## S11 Options Bottom Sheet (oth_292w5)

- Sheet H: "Options" + close X
- Action tiles: "Image" · "Camera" · "File" · "Connectors"
- Meter line: "1 upload remaining today"
- Mode row (selected, check): "Search"
- Locked row: "Deep research" / sub "In-depth reports and analysis" + lock icon
- Locked row: "Model council" + badge "Max" / sub "Multiple AI models at once" + lock icon
- Layout economy: ~20 words, ~9 elements. The free limit ("1 upload remaining today") and the lock icons do the upsell without a single selling sentence.

## S12 Models Bottom Sheet (oth_0v7ef)

- Sheet H: "Models" + close X
- Selected card: "Best" / sub "Best for everyday searches" + check
- Model rows (with vendor marks): "Sonar 2" · "GPT-5.4" · "GPT-5.5" + badge "max" · "Gemini 3.1 Pro" · "Claude Sonnet 4.6" · "Claude Opus 4.8" + badge "max" · "Kimi K2.6" · "Nemotron 3 Ultra"
- Layout economy: ~22 words, 10 rows. Premium gating is a two-letter-case "max" chip on specific rows, nothing more.

## Unviewed screens

1. Welcome Screen pos 1 — untitled welcome video (guest home + keyboard + sign-in link)
2. Onboarding pos 1 — untitled onboarding video (sign-in sheet, spinner, tier toggle, pricing cards, dismissible toast)
3. Search pos 6 — Computer Mode Empty State
4. Others pos 7 — Discover Feed
5. Library pos 8 — Library Overview
6. Spaces pos 9 — Spaces Home
7. Spaces pos 10 — New Space Form
8. Spaces pos 11 — New Space Privacy
9. Artifacts pos 12 — Artifacts Empty State
10. Artifacts pos 13 — Artifact Type Filter
11. Connectors pos 14 — Connectors List
12. Connectors pos 15 — Connector Detail
13. Settings pos 16 — Settings Account
14. Settings pos 17 — Settings Preferences
15. Settings pos 18 — Settings Support

## Reading

- Near-zero onboarding copy: the whole pre-paywall journey (guest home → account sheet → email → link sent) spends about 40 words, none of them a value pitch. The product's first screen is the product; "Ask anything…" is the entire promise, and the account sheet's only persuasion word is "free".
- The paywall sells with a claim + evidence, not adjectives: one 5-word benefit headline ("Get the most accurate answers"), then a scrolling strip of rival model names (Claude, GPT, Kimi, Sonar) as proof, then a Free-vs-paid checkmark table whose rows are 3-5 word noun phrases. ~57 words total on the Pro screen, no trial, no countdown, no testimonial, no fine print.
- Price framing is unusually symmetric and unhedged: every card states both the billed figure and its converted equivalent ("$200 /yr · $17/mo"; "$20 /mo · $240/yr"; Max "$200 /mo · $2,400/yr"), and the only promotional device anywhere is the "-17%" yearly badge. Max gets no discount and no softening.
- Ongoing monetization is ambient, not interruptive: a dismissible toast ("Upgrade to Pro to automate your most complex tasks"), a usage meter ("1 upload remaining today"), lock icons on Deep research/Model council, and lowercase "max" chips on premium models. Voice is flat, second-person-light, and declarative; suggested follow-ups are written in the user's first person ("I am using Python and…"), which turns the next tap into the user's own sentence.
