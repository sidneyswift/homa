# Fitbod: Gym & Fitness Planner: onboarding + paywall copy deck

Source: Appllama (app_id 1041517543), journey-ordered screen walk. Captured 2026-08-31. Verbatim third-party capture: all strings below are transcribed exactly as rendered, including third-party punctuation.

## Flow overview

- 19 screens total: 2 welcome (1 video + 1 splash), 15 onboarding (1 flow video + 14 stills), 2 paywall variants (yearly/monthly of the same trial screen).
- Account gate position: END of onboarding, positions 12-14 of 15, after the quiz and the "plan is ready" reveal, immediately before the paywall. Framed as "sign up to save your profile."
- Paywall position: last, after account creation and a data-sync loading screen. Single trial paywall with a yearly/monthly segmented toggle; no tier grid, no lifetime option shown.
- The whole quiz is styled as a chat with "your coach": each answer becomes a chip, each new question opens with a conversational acknowledgment of the previous answer, and the key noun phrase of every question is highlighted in red.

## S1 Onboarding Intro (onb_zwp0a, onboarding pos 2)

- Wordmark: FITBOD
- H: Train Smarter. Live Better.
- CTA: START
- Secondary: Log In
- Background: blurred lifestyle photo of a hand holding the app's Equipment screen ("Garage Gym" with Kettlebells, Barbells, Flat Bench, Mini Loop Bands, Squat Rack, Dumbbells) — product-as-hero, not copy.
- Layout economy: ~8 visible words in the foreground, 4 elements (wordmark, headline, 2 buttons).

## S2 Fitness Goal Question (onb_fzlcn, onboarding pos 3)

- Body (coach message): Hey, it's your coach! I'm excited to kick off your new training plan.
- H (question, "top fitness goal?" in red): To start, what's your top fitness goal?
- Options: Get stronger and lift heavier / Build more muscle mass / Get lean and defined / Lose weight
- Layout economy: ~38 words, 7 elements (back arrow, faint wordmark, 2 text blocks, 4 option pills). No progress bar, no skip.

## S3 Training Routine Question (onb_ts1nm, onboarding pos 4)

- Prior answer chip (right-aligned, user side): Lose weight
- H (question, "routine?" in red): Great, and which best describes your current strength training routine?
- Options: I'm just getting started / I struggle with consistency / I'm coming back after a break / I strength train consistently
- Layout economy: ~32 words, 7 elements. Options are self-descriptions in first person, not levels.

## S4 Training Frequency Question (onb_i7trw, onboarding pos 6)

- Prior answer chip: I don't have any equipment
- Body (coach acknowledgment of the equipment answer): No problem. I'll only recommend bodyweight exercises but you can always adjust this later.
- H (question, "days per week" in red): How many days per week can you usually strength train?
- Options: 1-2 days a week / 2-3 days a week / 3-4 days a week / 5+ days a week
- Layout economy: ~45 words, 8 elements. The reassurance line ("No problem... adjust this later") defuses the low-equipment answer before asking the next question.

## S5 Notification Opt-In (onb_kbblk, onboarding pos 7)

- Prior answer chip: 3-4 days a week
- Body (coach acknowledgment): Okay, we'll build your plan around 4 days per week and adjust as needed.
- H (ask, "preview of your workout" in red): Do you want us to send you a preview of your workout on training days?
- Options: Yes, enable notifications / Maybe later
- Layout economy: ~35 words, 6 elements. Notification permission is framed as a content promise (a workout preview), with a soft decline ("Maybe later"), inside the same chat pattern as the quiz.

## S6 Calorie Tracking Question (onb_6fopo, onboarding pos 8)

- Prior status chip (green check): Notifications enabled
- Body (coach acknowledgment): Great! When it's almost time to train, we'll remind you so you can get ready.
- H (question, "calories you burn" in red): Lastly, do you want to calculate the calories you burn each workout?
- Options: Yes, Connect to Apple Health (with Apple Health icon) / Yes, input details manually / Maybe later
- Layout economy: ~44 words, 7 elements. "Lastly," signals the quiz is ending; two yes-paths plus a decline.

## S7 Profile Creation Loading (onb_wjhjt, onboarding pos 9)

- Line 1 (bright): Creating your profile..
- Line 2 (dimmed): Finalizing your training plan..
- Layout economy: 7 words, 2 text lines over a glowing orb. No spinner chrome, no percentage, no fake checklist.

## S8 Training Plan Summary (onb_klap0, onboarding pos 11)

- H: Your training plan is ready.
- Card badge (check icon): Goal: Improve body composition
- Card bullets: Train 4 times a week / Focus on increasing volume each week / Leverage isolation movements / Bodyweight only / Keep workouts fresh and varied
- Section label: Exercise Sneak Peek
- (Sneak peek row: 3 exercise photo thumbnails with muscle-map badges; no captions.)
- CTA: Continue
- Layout economy: ~35 words, ~9 elements. The plan echoes the user's own answers back ("Train 4 times a week", "Bodyweight only") as proof of personalization.

## S9 Signup Method Selection (onb_3dem3, onboarding pos 12)

- H: Your custom workout program is ready
- Body: Sign up below to save your profile and start training.
- Options: Sign up with Apple / Sign up with Google / Continue with Email
- Divider: OR
- Secondary: Log in with existing account
- Legal footer: By signing up, you agree to our Privacy Policy and Terms & Conditions
- Layout economy: ~40 words, 9 elements. The gate re-asserts the finished artifact ("program is ready") and frames the account as saving it, not as registration.

## S10 Email Signup Form (onb_1ccos, onboarding pos 13)

- Nav title: Join Fitbod
- H: Save your settings, workout progress and more.
- Field placeholders: First Name / Last Name / Email / Password (with show/hide eye icon)
- Helper under password: Minimum 6 characters
- CTA (disabled until valid): Sign Up with Email
- Divider: OR
- Secondary: Log in with existing account
- Legal footer: By signing up, you agree to our Privacy Policy and Terms & Conditions
- Layout economy: ~35 words, ~11 elements. Four fields; the headline restates the save-your-progress benefit rather than "create an account."

## S11 Yearly Trial Paywall (pay_oa5kx, paywall pos 1)

- Faded wordmark: FITBOD
- H: Try 7 days for free
- Price line (bold price): then $95.99/year ($8.00/month)
- Billing tabs (Yearly selected): Yearly / Monthly
- Benefits card (pink check icons, bold title + gray sub each):
  - Drives real results — Watch strength & body metrics improve
  - Built for your body — Tailored to your history & goals
  - Progresses with you — Reps & weight increase as you log
  - Adapts to your week — Daily updates based on your performance
- Toggle row (switch ON by default): Remind me before my trial ends
- CTA (with external-link icon): Try for $0.00
- Below CTA: Purchase in app
- Footer links: Have a subscription? / Privacy / Terms
- Layout economy: ~68 visible words, ~14 elements. No close X visible; decline path is implicit. Price is complete and adjacent to the header, with yearly translated to a monthly equivalent.

## S12 Monthly Trial Paywall (pay_f5i0t, paywall pos 2)

- Identical layout to S11 with Monthly selected.
- Price line: then $15.99/month
- All other strings identical: Try 7 days for free / benefits card / Remind me before my trial ends / Try for $0.00 / Purchase in app / Have a subscription? / Privacy / Terms
- Layout economy: ~66 visible words, ~14 elements. Toggling billing rewrites only the price line; the offer framing never changes.

## Unviewed screens

1. Welcome Screen pos 1 — (untitled welcome video: splash logotype, video background, START/Log In pills)
2. Welcome Screen pos 2 — Splash Screen (FITBOD logo + italic tagline)
3. Onboarding pos 1 — (untitled full onboarding flow video)
4. Onboarding pos 5 — Training Location Question
5. Onboarding pos 10 — Training Plan Ready State
6. Onboarding pos 14 — Terms Acceptance Modal
7. Onboarding pos 15 — Data Sync Loading

## Reading

- The quiz is literally a conversation: a first-person "coach" ("Hey, it's your coach!") asks one question per screen, echoes every answer back with an acknowledgment sentence ("No problem. I'll only recommend bodyweight exercises...", "Okay, we'll build your plan around 4 days per week..."), and the user's prior answer stays on screen as a chat chip. Permission asks (notifications, Apple Health) are folded into the same chat so they read as coaching questions, not OS interruptions.
- One accent trick carries the whole flow: the key noun phrase of every question is set in red ("top fitness goal?", "days per week", "calories you burn"), so a skimming user can reconstruct the entire quiz from the red words alone. Sentences stay short and spoken-length; options are first-person self-descriptions ("I struggle with consistency") rather than category labels.
- Price framing is unusually plain for the category: full sticker adjacent to the free-trial header ("Try 7 days for free / then $95.99/year ($8.00/month)"), a trial-reminder toggle ON by default, and a $0-anchored CTA ("Try for $0.00"). No anchoring strikethroughs, no "most popular" badge, no countdown, no testimonials, no ratings, no plan-comparison table.
- What is omitted: no progress bar in the quiz, no body-stat interrogation before the paywall (weight/height live behind the optional calorie step), no discount screen between the two paywall variants, and account creation is sold entirely as "save your profile / settings / progress," never as a requirement in its own right.
