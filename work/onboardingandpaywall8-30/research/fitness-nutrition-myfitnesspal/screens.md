# MyFitnessPal: onboarding + paywall

Source: Appllama MCP, app_id `341232718`. Revenue $12M/mo, 700K downloads, 4.71★ (2.35M ratings), #11 Health & Fitness (US). Category: Health & Fitness / Food & Drink.

MyFitnessPal directly contradicts the article's two most load-bearing claims. First, "account last, only after purchase" is inverted here: there's a *soft* SSO gate at screen 2 (before any question is asked) and then a full email+password "Create Account" screen at position 18-19, both landing well before the paywall at 22-23: the paywall is the very last thing shown, not the account gate. Second, there's no fake-progress "personalizing…" loading screen anywhere in the flow at all; instead MFP alternates mechanically between a question screen and a full-bleed blue "education" screen (headline + line/bar chart + "Next") roughly once per topic, which does the emotional-landing job the article assigns to stats screens, but spread throughout the flow instead of concentrated right before the offer. Goal-setting (screen 4) does come before any feature is shown, which does match the article's "desire before features" principle, but MFP also shows a real, functional dashboard (with live ad banner and a "Go Premium" pill) immediately before the paywall rather than a stats/proof screen, meaning the "last screen before the offer" is a taste of the free product, not pain amplification.

## Onboarding (21 screens + 3 welcome screens, journey order)

| # | Screen | What it does |
| - | --- | --- |
| W1 | Hero (video) | Autoplaying video splash behind the app icon/brand moment; first frame users see. |
| W2 | Splash Loading | Solid blue MFP-brand splash with spinner and "Updating…" text: a boot screen, not a persuasion beat. |
| W3 | Welcome carousel | "Welcome to myfitnesspal" + swipeable hero photo carousel (a runner with a "Protein - last 7 days" bar-chart overlay), copy "Ready for some wins? Start tracking, it's easy!", primary CTA "Sign Up For Free", secondary "Log In". This is the only welcome-style screen; no ATT prompt visible here. |
| 1 | Intro (video) | Video-based opening onboarding beat (autoplay), sets tone before the first real screen. |
| 2 | Sign Up (soft) | "Welcome! Let's customize MyFitnessPal for your goals." Continue / Continue with Google / Continue with Apple, plus a data-collection disclosure line. This is an early, low-friction identity gate, asked before a single preference question, which is the opposite of "account last." |
| 3 | Name Entry | Text field for name, top progress bar starts (step 1 of ~7 segments). |
| 4 | Goal Selection | Multi/single-select on primary goal (lose weight, etc.): the "desire" step, asked before any feature is shown, matching the article's ordering principle here. |
| 5 | Weight Loss Education | Full-bleed blue screen: "OK, real talk: Losing weight isn't always easy. But we'll motivate you through the ups and downs" + a stylized declining line chart (Today → 6 months) + "P.S. You've already done the hardest part: getting started." This is a mid-flow emotional/proof beat, not concentrated near the paywall. |
| 6 | Barrier Selection | "In the past, what were barriers to achieving weight loss?": multi-select checkboxes (lack of time, regimen too hard, didn't enjoy food, food choices, social eating, cravings, lack of progress). This is the closest MFP gets to the article's "pain point" screens, but it's one screen with multiple checkbox options, not four separate single-pain screens with a frequency scale. |
| 7 | Lifestyle Education | Same blue full-bleed education template, different headline/body, reinforcing motivation. |
| 8 | Medication Question | "Are you taking GLP-1 medications like Ozempic, Mounjaro, Wegovy, Zepbound, etc.?" radio options (Yes / prescribed not started / in process / No / prefer not to say): sensitive health-data collection folded into onboarding, framed as support ("We're here to support you"). |
| 9 | Habit Selection | Multi-select chips on habits to build. |
| 10 | Habit Education | Blue education template again, with an orange mascot/illustration card. |
| 11 | Meal Planning Frequency | Single-select radio question on how often they plan meals. |
| 12 | Kitchen Rules Education | Blue education template, chef-hat illustration. |
| 13 | Meal Plan Opt In | Radio question offering to opt into meal planning, with helper text. |
| 14 | Activity Level | Radio-card question on activity level. |
| 15 | Profile Details | Gender toggle, text inputs, country dropdown: demographic collection. |
| 16 | Body Metrics | Height/weight split fields with unit toggle (imperial/metric). |
| 17 | Weekly Goal | Radio list for weekly weight-change goal pace. |
| 18 | Create Account (empty) | "Almost done! Create your account." Email + password (10-char minimum) fields, T&C checkbox, and a notice that email is used for "critical account and security updates." Progress bar nearly full. This is the hard account-creation gate, well before the paywall, contradicting "account last." |
| 19 | Create Account (filled) | Same screen shown with fields populated, likely an A/B or example capture state. |
| 20 | Feature Tools Pitch | Dark full-bleed screen: "Stay on it with tools that turn habits into results" with a strawberry/tracker illustration and three feature rows (scan a barcode, use your voice, take a photo). This is the one true "feature tour" screen in the whole flow, and it's placed near the very end, not the beginning, the opposite of the old flow the article says it replaced. |
| 21 | Today Dashboard | The real, live app home screen: calorie/macro rings at 0, a week-day streak tracker, a live ad banner ("Get ad-free tracking in Premium - upgrade now"), and a "Go Premium" pill in the header. Users see the actual (ad-supported, capped) free product before ever reaching the paywall screen. |

## Paywall (2 screens)

| # | Screen | Notes |
| - | --- | --- |
| pay1 | Free Trial Paywall | Dark navy screen. Headline "Guess less. Progress more. Start for free." Two plan cards: Annual $79.99/yr ($6.67/mo, "Save 67%", pre-selected) vs Monthly $19.99/mo. Reassurance copy "Try it free for 7 days. Trust the process. See the results for yourself." Primary CTA "Try it free" (trial-first framing, not price-first), secondary "Learn more" text link. Fine print discloses billing starts after the 7-day trial and auto-renews. No testimonials, ratings, or social-proof counts anywhere on the paywall. |
| pay2 | Premium Discount Offer (dismiss/win-back) | Shown after dismissing pay1. Coupon-ticket graphic "25% off Premium", "ENDS SOON" urgency badge, headline "No more restarts. This time, it's real." with a discounted annual plan ($59.99/yr, was $79.99, "$5/mo"). CTA "Upgrade to Premium", secondary "No thanks": a single-touch win-back offer, exactly matching the article's "dismissing routes to a win-back offer" step. |

## Verdict for our spec

- **Account creation is NOT last**: MyFitnessPal puts a soft SSO gate at screen 2 (before any preference is collected) and a hard email+password gate at screen 18, both ahead of the paywall. This is direct counter-evidence to the article's rule #11 ("account last, only after purchase"); a top-grossing app in a different vertical does the opposite and still converts well enough to hit $12M/mo.
- **No fake-progress "personalizing" screen exists.** Instead of one concentrated loading/checklist moment, MFP distributes ~6 static full-bleed "education" screens (line/bar chart + motivational copy) evenly through the flow, roughly alternating with question screens. If Homa wants the "we heard you" beat, this app suggests it doesn't have to be a single timed loading screen: repeated, shorter emotional-landing beats can substitute.
- **Desire before features holds up**: goal selection (screen 4) precedes any feature description, and the one genuine feature-tour screen (barcode/voice/photo scanning) is pushed to position 20, right before the real dashboard preview: features are shown last, not first, which does match the article's core critique of "feature-tour-first" onboarding.
- **Pain is asked, but shallow and singular**, not the article's four-angle sequence: one multi-select "barriers to weight loss" screen (time, difficulty, food enjoyment, cravings, etc.) stands in for what the article treats as four separate pain-frequency screens. Sensitive data collection (GLP-1 medication use) is folded in as its own screen mid-flow, something Homa's spec has no equivalent for and shouldn't need.
- **The screen right before the paywall is a real product preview (the live Today dashboard with an ad banner and "Go Premium" pill), not a stats/proof screen.** This is a genuinely different mechanism for making the offer land: instead of manufacturing urgency with pain statistics, MFP lets the free experience's own limitations (ads, a nagging premium pill) do the selling. Worth testing against Homa's context, where a comparable "free plan has real friction" beat could exist post-onboarding, pre-paywall.
- **Paywall itself is trial-first, price-anchored, and has zero social proof**: no ratings, testimonials, or user counts on either paywall screen, consistent with Homa's own claims-law constraint (no unearned social proof) and the general note in our paywall-claims research that fabricated proof is legally/ethically off the table anyway.
