# Flo Cycle & Period Tracker: onboarding + paywall

Source: Appllama MCP, app_id `1038369065`. Revenue $7M/mo, ~2M downloads, 4.75★ (1.9M ratings). Category: Health & Fitness / Medical, rank #2 in US Health & Fitness.

Flo validates the article's endpoint but not its mechanism. The flow does end on maximum problem salience: the very last onboarding screen (39 of 39) is a fear-framed "We detected symptoms that might need your attention" risk summary invoking PCOS and endometriosis, built from the user's own just-given answers, immediately followed by a paywall that opens with a star rating and a user quote. That much matches the article's thesis exactly. But the *mechanism* the article prescribes (a clean identity → context → desire → investment → trust → permission → four consecutive pain-point frequency-scale screens → personalizing loader → two stats screens → paywall) is not what Flo actually does. Flo interleaves surveys, functional product demos (it has the user pick real period dates on a live calendar), proof stats, testimonials, and education facts throughout all 39 screens rather than sequencing them into discrete phases. There is no "very often / sometimes / rarely / never" 4-point frequency scale anywhere in the flow; pain is surfaced instead through single/multi-select symptom checklists and emotionally-labeled choice cards ("I hate it 😠", "Embarrassed 😱"). The "personalizing" loading screen (position 29, "Analyzing your cycle…") lands two-thirds through the flow, not immediately pre-paywall, and it has a proof stat baked directly into it rather than being a clean separate beat. Trust (doctor testimonial) appears as early as screen 6, before most of the investment/goal steps, contradicting the article's "trust after investment" ordering claim. No explicit account-creation screen appeared anywhere in onboarding or paywall, consistent with Flo's marketed "Anonymous Mode": this app may simply not gate on signup before the paywall at all, which the article doesn't anticipate as an option.

## Onboarding (39 screens, journey order)

| # | Screen | What it does |
| - | --- | --- |
| 1 | Onboarding Intro (video) | Autoplaying trailer previewing app mechanics: roadmap, grid selector, wheel picker, progress bar, calendar logging, and even a glimpse of the subscription paywall. This is closer to the "feature tour" the article says to avoid, though it's one short video, not a multi-screen swipeable tour. |
| 2 | Mascot Name Entry | "What's your name?" text field, skippable pink CTA. Matches article step 1 (identity first). |
| 3 | Welcome Greeting | "Hello, I'm Flo": mascot intro, pure branding, minimal content. |
| 4 | Birth Year Picker | Wheel-picker demographic question. |
| 5 | Provider Referral | Bold question + gray choice cards, skippable, likely "do you have a healthcare provider?" |
| 6 | Doctor Testimonial | Full-height OB-GYN photo + quote ("I always recommend Flo to my patients"). Trust screen placed very early, before most investment/goal steps: diverges from the article's "trust after investment" ordering. |
| 7 | Acquisition Source | "Where did you hear about us": matches article step 4 (referral/attribution, no UX effect). |
| 8 | Goal Selection | Two-column icon grid, multi-goal picker. Matches article step 5 (desire before features). |
| 9 | Mascot Intro Tip | Speech-bubble mascot moment, low content, keeps momentum. |
| 10 | Usage Reasons Survey | Progress bar appears here for the first time; mascot header + choice cards, single-select reasons for using the app. |
| 11 | Mascot Assurance | Info cards fanned around mascot: reassurance/trust beat. |
| 12 | Period Feelings Survey (pain-point, not frequency-scale) | "How do you feel about your period, Morris?": emotionally-labeled single-select cards ("It's a love-hate relationship 🙄", "Embarrassed 😱", "I hate it 😠", "I want to understand it better 🤔"). One option has an embedded stat ("89% of Flo users say Flo helped them feel more informed"). This is real felt-pain framing, but structured as labeled choice cards, not a 4-point frequency scale. |
| 13 | Cycle Data Proof (stats/social-proof) | "Flo's tracked over 2.2 billion cycles" plus a sample dashboard mockup. Proof screen appearing mid-flow, not clustered at the end. |
| 14 | Period Knowledge Survey | Progress bar + choice cards, single-select. |
| 15 | Education Fact | Large fact-style text + illustration, minimal layout. |
| 16 | Pass It On Intro | Social-impact badge messaging (philanthropic/cause framing). |
| 17 | Ratings Social Proof | Dual award laurels + star ratings + review cards. Trust/social-proof screen, positioned after several investment steps (goal selection, surveys): this instance does match the article's "trust after investment" logic even though screen 6 (Doctor Testimonial) does not. |
| 18 | Feature Path Preview | Dotted roadmap with locked step icons + mascot: previews what's coming later in the app, teases investment. |
| 19 | Period Regularity Survey | Choice cards + a pink info callout card. |
| 20 | Period Import Prompt | Apple Health import card with calendar preview: functional/permission-style ask (not a native OS permission dialog, an in-app one). |
| 21 | Period Calendar Picker | Real interactive calendar: user logs actual period dates. A functional product demo embedded in onboarding, not a survey. |
| 22 | Logging Confirmation | "Nice!"-style centered praise text confirming the log. |
| 23 | Follicular Phase Result | Personalized cycle line chart with a mascot marker, built from the dates just logged. |
| 24 | Cycle Education Proof (stats/social-proof) | "83% of members said Flo taught them what is and isn't a normal cycle," paired with the user's own (sample) cycle flagged ABNORMAL/IRREGULAR. Proof + light fear-framing combined, mid-flow. |
| 25 | Birth Control Survey | Progress bar + choice list, single-select. |
| 26 | Safety Education Intro | Illustration row + centered educational copy. |
| 27 | Health Conditions Survey | Checkbox-style multi-select list. |
| 28 | Community Expert Intro | Preview of a community/expert-search feature (investment/teaser). |
| 29 | Cycle Analysis Loading ("personalizing" moment) | "Analyzing your cycle…" with a spinning-orbit loader AND an embedded stat ("90% of members said Flo accurately predicts the start of their period"). This is the article's "personalizing" beat, but it lands two-thirds through the flow (not immediately pre-paywall) and mixes in proof rather than being a clean separate beat. |
| 30 | Next Period Prediction | Personalized result screen + tip callout card. |
| 31 | Feature Path Transition | Roadmap steps shown unlocking, dotted path continues. |
| 32 | Mood Check-In (pain-point, symptom-checklist) | "Morris, how do you feel today? Select your symptoms": Cramps, Fatigue, Bloating, Tender breasts, Backache, None. Multi-select symptom checklist, not a frequency scale. |
| 33 | Readiness Calendar Tip | Calendar preview + verification badge, educational tip. |
| 34 | Discharge Knowledge | Yes/No question style with an input field. |
| 35 | Discharge Education | Cycle-ring diagram with colored callout labels: educational, not a survey. |
| 36 | Health Check-In Intro | Doctor illustration + report chart preview: teases a health check-in feature. |
| 37 | Cycle Concern Survey | Progress bar + choice cards, single-select. |
| 38 | Hormone Symptom Survey (pain-point, symptom-checklist) | "Have you noticed any signs that your hormones might be out of balance? Choose all that apply": Acne, Excess hair, Hair loss, Weight gain. Multi-select, felt-symptom framing, not a frequency scale. |
| 39 | Symptom Risk Summary (pain amplification + implied stats, last screen) | "We detected symptoms that might need your attention": warning icons flag "Cycle abnormalities" and "Symptoms of hormonal imbalance," explicitly naming PCOS and endometriosis as possible causes. This is the single strongest pain-amplification beat in the whole flow, built from the user's own answers, and it is the LAST onboarding screen before the paywall: the clearest match to the article's "problem is now maximally salient" principle. |

No explicit account-creation/signup screen appears anywhere in the 39 onboarding screens or the 2 paywall screens retrieved. Flo markets an "Anonymous Mode" (no name/email/personal identifiers required), so this app may not gate on account creation before the paywall at all.

## Paywall (2 screens)

| # | Screen | Notes |
| - | --- | --- |
| 1 | Subscription Offer | Full-screen paywall. Headline "Choose your plan," 5-star row + a real user quote ("A ladies best friend. Awesome and quite accurate! 👍👍👍") directly on the paywall: social proof carried straight through from onboarding into the offer itself. "Not sure yet? Start a free trial" row. Yearly Plan badged "MOST POPULAR" at $5/mo ($59.99 billed annually, pre-selected), Flo Family plan (1-6 members) at $6.67/mo ($79.99/yr) as the only alternative shown by default. Single "Continue" CTA, "View all plans and trials" link exposes more options, "Subscribe in the App Store" subtext, and a cancellation/limited-access link. |
| 2 | Trial Paywall Sheet | A modal/bottom-sheet variant over a dimmed backdrop of screen 1, with a different testimonial. Notably the free-trial toggle here defaults OFF ("Not sure yet? Enable free trial", toggle unchecked), meaning the default purchase path is a straight paid annual charge, not an opt-out trial. Same Yearly (MOST POPULAR) / Family tiers, plus a visible Monthly option ($14.99/mo) not shown on screen 1. "Go back" link returns to screen 1. |

## Verdict for our spec

- The article's core claim (end onboarding on maximum problem salience, right before the offer) is genuinely validated by Flo: screen 39 of 39 is a fear-framed, personalized risk summary (PCOS/endometriosis) built from the user's own answers, landing immediately before a paywall that opens with more social proof. That end-state ordering is worth copying.
- The article's specific *mechanism* (identity → context → desire → investment → trust → permission → four back-to-back frequency-scale pain screens → one clean "personalizing" loader → two stats screens → paywall) is not how Flo is built. Flo interleaves proof, education, functional product demos, and pain surveys continuously across all 39 screens rather than sequencing them into clean phases, and its "personalizing" loader sits two-thirds through the flow, not immediately pre-paywall.
- Flo never uses a literal 4-point frequency scale ("very often/sometimes/rarely/never"). Pain is surfaced through multi-select symptom checklists and emotionally-labeled single-select cards instead. For Homa this distinction matters: a frequency-scale question about a parent's own stress reads very differently from a symptom checklist about her child's needs, and either would need adaptation, not a literal port.
- Aggressive multi-screen pain-amplification about the *parent's own body/health* (Flo's model) does not translate cleanly to Homa. Homa's product is about a child's education, so pain amplification aimed at a parent's own felt suffering (embarrassment, fear of PCOS) has no equivalent subject; the honest analog would be pain/friction in the *parenting experience* (overwhelm, falling behind, not knowing what to teach) rather than manufactured fear about the child. This needs explicit product judgment, not a straight copy.
- The paywall itself is directly usable: pairing a star rating + real user quote with the plan picker, pre-selecting the "MOST POPULAR" annual tier, and defaulting the free-trial toggle OFF (making the paid annual plan the default single-tap path) are all concrete, low-risk patterns Homa's paywall could adopt. The complete absence of a visible account-creation screen (Flo's anonymous-mode positioning) is also worth flagging as a real alternative to "account creation last": it's possible to not require an account at all pre-paywall.
