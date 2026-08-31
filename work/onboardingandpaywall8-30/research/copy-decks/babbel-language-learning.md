# Babbel - Language Learning: onboarding + paywall copy deck

Source: Appllama (app_id 829587759), journey-ordered screen walk. Captured 2026-08-31. Verbatim third-party capture: all quoted strings are transcribed exactly as rendered in the screenshots, including third-party punctuation.

## Flow overview

- 59 captured screens total: Welcome Screen 4, Onboarding 22, Paywall 3, other tabs 30 (post-onboarding app surfaces, not part of this deck).
- The onboarding+paywall journey is 29 screens (two of them are flow-recording videos rather than stills).
- Account gate position: END of onboarding, positions 20-22 of 22 (Name Signup, Email Signup, Password Signup), placed after every quiz question and immediately before the paywall. No third-party SSO visible on the captured gate screens; it is a classic name/email/password ladder, one field per screen.
- Paywall position: immediately after account creation, 3 screens: a plan-picker paywall (annual + lifetime), the same paywall with all 4 plans expanded, then a 7-day free-trial save screen (shown on decline/close).
- No hard content wall before the gate: the entire quiz runs logged-out; the gate and paywall arrive only after the app has collected language, motivations, level, time budget, age, and acquisition source.

## S1 Onboarding Welcome (Welcome Screen, position 3) - VIEWED

- Logo: `Babbel` (orange wordmark, centered top)
- Display type (huge orange serif greetings, deliberately cropped off the screen edges, stacked): `Hello` / `Salut` / `Hej` / `Ciao`
- CTA: none on this frame (splash/greeting moment)

Layout economy: ~5 words, 2 element types (logo + word art). Zero instruction copy; the product's subject matter IS the art.

## S2 Welcome Login Choice (Onboarding, position 3) - VIEWED

- Logo: `Babbel`
- H (black serif, centered): `Speak with confidence`
- Social proof block: five gold stars, then `Over 2 million` (with `2 million` in orange serif) / `5-star reviews`
- CTA (orange pill): `Choose a language`
- Secondary CTA (outlined pill): `Log in`

Layout economy: ~12 visible words, 5 elements. Note the primary CTA is a task ("Choose a language"), not "Get started"; the first tap is already the first quiz answer.

## S3 Target Language Pick (Onboarding, position 4) - VIEWED

- H (serif): `What would you like to learn?`
- Body: `You can switch to another one any time you want!`
- Section label: `I speak`
- Selected row: `American English` (US flag, chevron)
- Section label: `I want to learn`
- Options (flag cards in a 3-column grid, each with a learner-count under a people icon): `Spanish (Latin America)` `15.8M` / `Spanish` `5.8M` / `French` `7.3M` / `Italian` `5.1M` / `German` `5.1M` / `Russian` `2.2M` / `Portuguese` `1.5M` / `Norwegian` `468.6K` / `Polish` `692.5K` (grid continues below fold)
- CTA: none; tapping a card advances

Layout economy: ~35 words on screen but nearly all of them are option labels/counts; instruction copy is 1 question + 1 reassurance line. Learner counts double as social proof inside a form control.

## S4 Motivation Selection (Onboarding, position 6) - VIEWED

- Progress: thin orange top bar (~15%), back arrow
- H (serif): `Why do you want to learn Spanish?`
- Body: `Select as many motivations as you'd like.`
- Options (icon + checkbox rows; multi-select): `Live abroad or plan to` / `School or an exam` / `Brain training or for fun` / `Communicate with partner` / `Family, friends, or community` / `Career or business` / `Travel` / `Other`
- CTA (orange pill): `Next`

Layout economy: ~34 words, 8 options + 1 CTA. Question restates the user's chosen language ("learn Spanish?"), personalizing from the very first quiz step.

## S5 Recommendation Loading (Onboarding, position 8) - VIEWED

- Spinner (centered)
- H (serif): `Adjusting recommendations`
- Divider line
- Social proof block: five gold stars / `Over 2 million` (orange emphasis) / `5-star reviews`

Layout economy: 7 words, 3 elements. The loading moment is reused as a second social-proof impression; no fake progress checklist, just one gerund phrase.

## S6 Beginner Social Proof (Onboarding, position 11) - VIEWED

- Collage cards (colored tiles with illustrations): `Plan to meet up` / `Beginner courses` / `Talk about your origins`
- H (large black serif): `65% of Babbel users are beginners`
- Progress: thin pager bar at bottom; back arrow top

Layout economy: ~14 words, 4 elements. Interstitial shown after picking a beginner level; the stat normalizes being a beginner rather than praising the app.

## S7 Daily Time Pick (Onboarding, position 13) - VIEWED

- Progress: orange top bar (~40%), back arrow
- H (serif): `How much tiempo do you want to commit to learning Spanish?` (the word `tiempo` set in orange italic)
- Options (single-select rows): `5 min / day` / `15 min / day` / `30 min / day` / `60 min / day` / `I'm not sure`
- CTA: none; tapping advances

Layout economy: ~24 words, 5 options. The headline smuggles a first Spanish word into the question itself, a micro-taste of the product inside the quiz.

## S8 Email Signup (Onboarding, position 21, account gate) - VIEWED

- Close X (top left area, this frame shows back-less X variant)
- H (serif): `What's your email?`
- Field placeholder: `Email address` (envelope icon)
- CTA (disabled gray pill): `Continue`
- Legal/consent copy: `Once you have registered, Babbel GmbH sends tips, tricks, and offers related to Babbel's language-learning products and services to this email address. You can always unsubscribe by using the unsubscribe link in our emails or emailing support@babbel.com.` (`support@babbel.com` underlined)

Layout economy: ~50 words, but 43 of them are the marketing-consent disclosure; the ask itself is 3 words + 1 field. Full-sentence GDPR-style transparency instead of a checkbox.

## S9 Password Signup (Onboarding, position 22, account gate) - VIEWED

- Back arrow
- H (serif): `Choose a password`
- Field: password input (lock icon, clear X)
- CTA (orange pill): `Sign up now`
- Terms line: `By registering I accept the Terms & Conditions.` (`Terms & Conditions` underlined)
- Privacy line: `Further information on the use of your data can be found in our Privacy Policy.` (`Privacy Policy` underlined)

Layout economy: ~29 words, 5 elements. Acceptance-by-action ("By registering I accept"), no checkbox; the only bolded things are the two legal links and the CTA.

## S10 Subscription Offer (Paywall, position 1, primary paywall) - VIEWED

- Close X (top right; decline affordance present from first paywall frame)
- H (serif): `Choose a plan that works for you`
- Benefit checklist: `Practical lessons for real-world situations` / `Learn at your own pace` / `20 million subscriptions sold`
- Badge (orange, on selected card): `SAVE 50%`
- Selected plan card (orange border): `12 months` / `$9.00 per month` / `$215.96*` (strikethrough) `$107.99` `charged every 12 months`
- Second plan card: `Lifetime` / `$299.99` `Pay once, learn forever`
- Link: `Show all plans`
- Divider
- Social proof H (serif): `Loved by millions of learners worldwide` (review card begins below fold)
- CTA (black pill, sticky): `Subscribe now`

Layout economy: ~55 visible words, ~10 elements. Per-month price leads the card; the full charge amount and cadence sit on the same card in plain text ("charged every 12 months"), asterisked against the strikethrough anchor.

## S11 Expanded Plan Picker (Paywall, position 2) - VIEWED

Same page as S10 with `Show all plans` expanded; scrollable list:

- Badge (purple-to-orange gradient on selected card): `SAVE 50%`
- Card 1 (selected, gradient border): `12 months` / `$9.00 per month` / `$215.96*` (strikethrough) `$107.99` `charged every 12 months`
- Card 2: `Lifetime` / `$299.99` `Pay once, learn forever`
- Card 3: `6 months` / `$13.50 per month` / `$107.98*` (strikethrough) `$80.99` `charged every 6 months`
- Card 4: `3 months` / `$18.00 per month` / `$53.99` `charged every 3 months` (no strikethrough anchor)
- Benefit checklist still pinned above: `Practical lessons for real-world situations` / `Learn at your own pace` / `20 million subscriptions sold`
- Social proof H: `Loved by millions of learners worldwide`
- CTA (black pill, sticky): `Subscribe now`

Layout economy: ~70 visible words, 4 plan cards. Every card repeats the identical three-line grammar (term / per-month / total + cadence), so comparison is pure arithmetic; the 3-month card's missing discount quietly makes annual look better.

## S12 Free Trial Offer (Paywall, position 3, decline/save screen) - VIEWED

- Close X (top right)
- Gift icon (orange outline, centered)
- H (serif, two lines): `Need time to decide?` / `Try it free for 7 days` (the word `free` in orange)
- Body: `Enjoy full access to lessons and more! Cancel anytime.`
- Bottom pricing bar (above CTA, separated by divider): `Free for 7 days, then $215.96*` (strikethrough on `$215.96*`) / `$107.99 every 12 months ($9.00/mo)` (bold)
- CTA (black pill): `Start your free trial`

Layout economy: ~35 words, 6 elements. The trial is withheld until after a decline, then framed as a gift ("Need time to decide?"); charge terms sit directly above the button in the ROSCA position.

## Unviewed screens

Welcome Screen section:
- W1: (unnamed flow video)
- W2: Splash Screen
- W4: Cookie Consent

Onboarding section:
- O1: (unnamed flow video)
- O2: Onboarding Intro
- O5: Native Language List
- O7: Motivation Ranking
- O9: Learning Goals Pick
- O10: Skill Level Pick
- O12: Skill Focus Pick
- O14: Reminder Prompt
- O15: Goal Success Proof
- O16: Age Selection
- O17: Subscriber Proof
- O18: Acquisition Source
- O19: Course Benefit Offer
- O20: Name Signup

Other tabs (30 screens, outside this deck's scope), beginning with: Home Dashboard.

## Reading

- Second person question, first person answer, one thought per screen. Every quiz headline is a serif question addressed to "you" ("What would you like to learn?", "Why do you want to learn Spanish?"); options are short noun phrases or "I speak / I want to learn / I'm not sure" first-person fragments. Headlines run 4-10 words; almost no screen carries more than one supporting sentence.
- The product leaks into the chrome. Greeting word-art in four languages as the splash, "tiempo" in orange italic inside an English question: Babbel demonstrates language learning inside the onboarding copy instead of describing it.
- Price is framed per-month, disclosed per-charge. Cards lead with "$9.00 per month" but print the real total, the strikethrough anchor, and "charged every 12 months" on the same card, and the trial screen repeats "Free for 7 days, then... $107.99 every 12 months ($9.00/mo)" immediately above the button. The 50% discount does the selling; the disclosure is never more than one line away. The free trial is not offered upfront; it appears only as the third-screen save offer, gift-framed.
- What is omitted: no testimonial quotes above the fold, no countdown timers, no feature comparison table, no "Most popular" tag (the badge is a factual "SAVE 50%"), no guilt copy on decline paths, and the close X is present on every paywall frame. Social proof is exclusively large round numbers the company can own: "Over 2 million 5-star reviews", "20 million subscriptions sold", "65% of Babbel users are beginners".
