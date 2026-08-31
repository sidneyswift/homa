# Duolingo: onboarding + paywall

Source: Appllama MCP, app_id `570060128`. Revenue $48M/mo, 5M downloads,
rating 4.72. Category: Education / Social Networking.

**Headline finding: Duolingo does not gate onboarding behind a paywall at
all.** The welcome screen's own tagline is "Learn for free. Forever." The
"Paywall" flow (2 screens) is reached from the bottom tab bar as an
in-app upsell ("Super Duolingo"), not a blocking step at the end of
onboarding. This directly contradicts the reference article's premise that
the paywall must be the deliberate endpoint of onboarding, one of the
most successful subscription apps alive runs the opposite model: free
forever, subscription is upsell.

## Onboarding (32 screens, journey order)

| # | Screen | What it does |
| - | --- | --- |
| 1 | Welcome (video) | Animated hero loop |
| 2 | Welcome | Mascot, wordmark, "Learn for free. Forever.", Get Started / I already have an account |
| 3 | Mascot Introduction | Duo speaks directly, one line at a time |
| 4 | Practice Setup Intro | Duo frames the next ask |
| 5 | Language Selection | Which language to learn (single-select) |
| 6 | Course Language List | Full flag list if not in the quick picks |
| 7 | Course Building | "Building your course" loader (real, not fake: course content is being assembled) |
| 8 | Course Language Selected | Confirms pick |
| 9 | Discovery Source | How did you hear about Duolingo (attribution, optional) |
| 10 | Learning Goal | **"How much Japanese do you know?"**: self-assessed skill level, 5-point scale, Duo speech-bubble framing |
| 11 | Onboarding Confirmation | Acknowledges the answer |
| 12 | Motivation Selection | Why are you learning (multi-select checkboxes) |
| 13 | Motivation Selected | One selected |
| 14 | Multiple Motivation Selected | Several selected |
| 15 | Daily Goal Selection | Minutes/day commitment (single-select) |
| 16 | Notification Prompt | Duo explains value BEFORE the OS prompt |
| 17 | iOS Notification Permission | The real system dialog, with a blue arrow pointing at "Allow" |
| 18 | Home Widget Prompt | Duo pitches the home-screen widget |
| 19 | Add Widget Preview | Shows what the widget looks like |
| 20 | Benefits Overview | Icon row recapping what the app does (the ONLY screen that's a feature list, and it's screen 20 of 32, not screen 1) |
| 21 | Start Point Choice | "Recommended" placement test vs. "start from scratch" |
| 22 | Lesson Prep Loading | Real loader |
| 23 | First Lesson Intro | Celebratory framing before the first real lesson |
| 24–32 | **A full real lesson, played inline** | Image quiz, correct-answer feedback, translate-sentence, tap-word tutorial (spotlight overlay), sentence success, lesson complete, more exercises |

**The core insight:** roughly the last third of Duolingo's onboarding (24–32)
isn't a "personalizing" screen or a stats screen: it's an actual, real
first lesson, played to completion, inside onboarding. The proof-of-value
moment is literally the product working, not a claim about the product.
Aligns with the article's "give before you ask" instinct, but Duolingo's
version is 100% functional, not persuasion theater.

## Paywall (2 screens, reached from the tab bar, NOT gating onboarding)

| # | Screen | Notes |
| - | --- | --- |
| 1 | Subscription Plans | Blue gradient hero, mascot art, "RECOMMENDED" ribbon on Individual plan, benefit checklist (unlimited energy / unlimited video call / no ads), **"TRY FOR $0.00"** CTA, trial-framed, not price-framed |
| 2 | Subscription Plans (scrolled) | Family plan ("for you and 5 others, only $2 more/month"), gift-subscription section |

No stats, no pain recap, no urgency: the paywall's entire pitch is three
bullet benefits plus a free-trial CTA. Consistent with Duolingo's brand:
the product already proved itself in the lesson you just played.

## Verdict for our spec

- Confirms functional-proof-over-persuasion-theater is a real, viable,
  extremely successful strategy, not just Homa's own aesthetic preference.
- Permission asks (notifications, widget) sit mid-onboarding, framed by
  the mascot before the OS prompt fires, a pattern worth studying if Homa
  ever adds a notifications ask.
- The "how much do you already know" self-assessment (screen 10) is a
  softer version of Homa's own age/level questions: self-reported
  calibration, not a quiz with a right answer.
- Directly undercuts the reference article's "paywall must be the fixed
  endpoint" framing as a universal law: it's a choice, not a given, even
  among the most successful subscription apps.
