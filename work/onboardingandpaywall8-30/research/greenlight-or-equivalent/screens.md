# BabySparks: onboarding + paywall

Source: Appllama MCP, app_id `794574199`. Revenue $10K/mo, ~1K downloads,
4.67★ (13,168 ratings). Category: Education / Health & Fitness. Publisher:
BabySparks Inc.

**Why this app, not Greenlight.** Greenlight was the first query
(`search_apps(query="Greenlight")`) and returned zero results; the two
mandated fallbacks (`"Step banking teens"`, `"kids money app"`) also
returned zero real kids-fintech matches: this catalog does not carry
Greenlight, GoHenry, Step, Chase First Banking, Copper, BusyKid, Till, or
FamZoo under any query tried. The catalog's top-grossing sampling simply
doesn't include that niche. Widening to `"debit card for kids and teens"`
and `"teen banking app parent"` confirmed the gap. BabySparks was chosen
from what the fallback searches actually surfaced (`"kids money app"` and
`"family allowance chores app"`) as the best real substitute: like
Greenlight, it is a **parent-administered app about a child**, not a
child-facing product the parent merely pays for, and it has the full
Welcome → Onboarding → Paywall set this research needs. Unlike the
fintech-for-kids category, BabySparks' persuasion target is the parent
throughout (there is no child-facing surface at all: the child is an
infant/toddler, not a user), which turns out to matter for the structural
questions below.

## Welcome (3 screens)

| # | Screen | What it does |
| - | --- | --- |
| welcome1 | Splash (video) | Autoplaying animated logo reveal on a white field, brand colors (cyan/green) established immediately. |
| welcome2 | Splash Screen | Static centered wordmark lockup (the two overlapping face-circles that form the "B" logomark) on white: a boot screen, not a persuasion beat. |
| welcome3 | Onboarding Welcome | "Welcome to BabySparks!" headline over a three-phone hero mockup (feed, an activity-instruction video, a topic browser), tagline "A Parenting Expert in Your Pocket," proof line "Created by experts, used by more than 10 million families worldwide," green "NEXT" CTA, "Already have an account? Login" below. First of six onboarding-carousel dots. |

## Onboarding (13 screens, journey order)

| # | Screen | What it does |
| - | --- | --- |
| 01 | Onboarding Intro (video) | Autoplaying feature-tour video, second carousel dot. |
| 02 | Child Stage Selection | "To give you the best personalized experience, please let us know:" with three cards (pregnant / child under 3 / child 3+), each with a cartoon avatar. This is the **first substantive question in the entire flow**, before any account field, before any parent-facing question. |
| 03 | Onboarding Benefits | "With BabySparks you will": three benefit rows (Connect with Experts, Support Your Pregnancy, Chat with Ava) each with a small illustrated avatar; this is a value/benefit screen, not a feature screenshot. |
| 04 | Expert Classes Intro | "Connect with leading prenatal and parenting experts" over a class-tile photo ("Baby & Toddler Sleep"), proof line "Hundreds of online classes to choose from." |
| 05 | Expert Classes Intro (2) | Same template repeated, a second class tile, reinforcing the same benefit with different content rather than a new topic. |
| 06 | Development Activities | "Support your child's growth and development from day one" over a real-photo activity grid (scissors/cutting practice, tummy-time mat, water play, crawling), age-banded ("4-6 Months"), caption "Click to view a sample activity," proof line "Frequently exposing your child to meaningful experiences significantly impacts their brain for life." Real photography, not illustration: the app's proof register throughout onboarding is authentic-looking photos of real activities, never stock-model imagery. |
| 07 | AI Parenting Expert Intro | "24/7 AI-powered parenting expert, Ava": a phone mockup of a live chat transcript: user asks "How does my baby develop during the first trimester?", Ava answers in full paragraph prose. This is a **real functional-proof screenshot of the actual AI chat**, not a mockup illustration: the same "show the real thing" move Homa's own research flagged as the single strongest proof pattern across the adult-app research (`patterns.md`). |
| 08 | Child Profile Setup | "To give you the best personalized experience tell us about your child": photo upload circle, Girl/Boy/"We don't know yet" segmented control, "First name or nickname" text field, "Expected due date" field, and an **"I am the child's ___" relationship dropdown** (parent identifies their own relationship to the child, not the reverse). A close (X) icon appears top-right for the first time: this screen is the first one framed as skippable/exit-able, signaling it now sits inside the "real" funnel rather than the marketing carousel. NEXT is disabled until required fields are filled. |
| 09 | Join BabySparks | A single "Email" field inside a white card on the same cyan wave background, "Join BabySparks" header, disabled NEXT until a value is entered. No password field is shown at this position: the account gate visible in this flow is email-only. |
| 10 | Personalization Loading | Full-screen cyan loader, centered status copy, white progress bar: the "personalizing…" beat the adult-app research found only weakly evidenced elsewhere; here it's a single clean screen, positioned immediately after the account/child-identity capture and before the home feed. |
| 11 | Milestone Opt-In Prompt | Dimmed home-feed skeleton behind a native-style dialog: "Upcoming Milestones - Do you want to receive your baby's upcoming milestones?" with Later/Yes. First in-app permission-flavored prompt, framed around the child (not the parent). |
| 12 | Notification Permission | Same dimmed-feed pattern behind an iOS system notification-permission alert. |
| 13 | Home Feed Loading | Real app chrome (teal header, hamburger menu, profile avatar, six-tab bottom nav: Today/Activities/Milestones/Classes/Articles/My Child) with feed cards still in skeleton-loading state: onboarding hands off directly into the live product shell. |

## Paywall (1 screen)

| # | Screen | Notes |
| - | --- | --- |
| pay1 | Subscription Offer | Blue full-bleed screen. Urgency eyebrow "Promotion valid today only," headline "Our welcome gift to you!", giant "60% OFF*" in yellow-green (no visible original price shown anywhere on screen: the discount has no baseline to discount from). Social-proof line "Join 10+ million parents worldwide who trust BabySparks." Two plain price cards: BASIC $1.49/month* (activities/milestones/articles, personalization, family/caregiver sharing) and PREMIUM $2.99/month* (adds unlimited Ava access + expert-led classes). Each card's own "Start TODAY!" CTA. Single footnote at the bottom, in small type, detached from either price: **"*Billed annually."** No trial mentioned, no restore-purchases link visible on this screen, no ratings/testimonials beyond the bare "10+ million" figure. |

## Structural questions (per task mandate)

**Child identity: before or after the parent's own account exists?**
Squarely **before**. The order is Child Stage (02) → six benefit/proof
screens (03-07) → Child Profile Setup with name/photo/DOB/relationship
(08) → Join BabySparks email-only gate (09). A full name, photo,
gender, and due date for the child are captured while the parent has
supplied nothing but taps: no email, no password, no account of any
kind exists yet. The account itself, when it finally appears, is a
single email field with no password shown at this position, the
lightest-weight "account" gate in any app sampled across this whole
research set (lighter than MyFitnessPal's soft-SSO-then-hard-password
sequence, lighter than Duolingo ABC's fuller signup). This is the
concrete evidence spec.md's open question 8 asked for: BabySparks proves
"child-identity-before-full-account" is a real, shipped, top-of-category
pattern, not a hypothetical, directly relevant to whether Homa's `kids`
screen can move ahead of a full account the same way.

**Who gets persuaded: parent, child, both, or neither?**
**Parent, exclusively, and only the parent**: this is the sharpest
contrast with the true kids-fintech category (Greenlight/GoHenry/Step),
where the *child* is the end user the product experience is designed
around even though the parent administers the account. BabySparks has no
child-facing surface at all: the subject (a baby or toddler) cannot read,
tap deliberately, or evaluate a subscription. Every single onboarding
screen (the benefit carousel, the real-photo activity grid, the Ava
chat-transcript proof, the "10+ million families" line, both paywall
price cards) is written in second person to an adult ("you," "your
child," never "you, kid"). This confirms the founder's persuasion-
sequence-yes ruling from a second angle: even in a category built
entirely around a non-parent subject (the child), the shipped, revenue-
generating persuasion machinery still targets the adult 100% of the time.
There is no app in either research pass (kids-fintech or this
parent-of-a-dependent category) where the dependent is persuaded rather
than the administrator.

## Verdict for our spec

- **Confirms spec.md's open question 8 with a concrete example**: a
  top-of-category app collects the dependent's identity (name, photo,
  DOB) a full two screens before any account field appears, and the
  account gate that does appear is startlingly light (email only, no
  password visible at that step). If Homa's data model can support a
  temporary/unclaimed child profile, this is evidence that pattern
  converts well enough to ship at scale, not just a design preference.
- **The "I am the child's ___" relationship field is a detail worth
  copying if Homa ever needs to disambiguate a non-parent caregiver
  filling out a child's profile**: a small, cheap field that resolves
  real ambiguity (grandparent, guardian, co-parent) without extra screens.
- **The real-photo activity grid and the live Ava chat transcript are
  the two strongest proof beats in this flow**, and both are real product
  artifacts, not staged mockups, consistent with `patterns.md`'s
  cross-category finding that real functional proof outperforms fabricated
  proof. Homa's own real-worksheet reveal is already this pattern.
- **The paywall is a caution, not a template.** "Promotion valid today
  only" paired with a discount that has no visible original price to
  discount from, plus an unqualified "10+ million parents" trust claim,
  are exactly the fabricated-urgency and unverifiable-social-proof moves
  `homa-paywall-claims-laws` rules out for Homa (no paying customers means
  no counts/claims Homa can't back). The "*Billed annually" disclosure
  sitting in small print, detached from either per-month price it
  actually modifies, is a pattern to explicitly avoid, not adapt: Homa's
  own constraint already requires charge terms to sit near the button.
- **One clean "personalizing…" loader does appear here**, positioned
  right after identity capture and before the home feed: a real, if
  isolated, data point for the loader mechanic `patterns.md` found only
  weakly evidenced elsewhere (Facetune's single compressed screen).
