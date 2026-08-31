# Delta: Homa's walk deck vs the 50-app corpus

This compares the Homa onboarding/paywall copy deck
(`docs/homa-planning/plans/2026-08-30-mobile-onboarding-paywall-v2/copy-deck.md`,
the S1-S12 walk plus D13 notifications) against 50 verbatim onboarding and
paywall captures in this folder, across three dimensions: copy style,
sections and structure, and word/element economy. Quoted third-party strings
are reproduced exactly, including their own punctuation. Findings are stated
as OURS vs THEIRS; the final section turns them into prioritized changes.

## Copy style

**Cancel language at the point of commitment.** OURS: S10 carries zero
cancel copy and never names the auto-renew mechanic; all cancel language is
deferred to a push notification two days later. THEIRS: a cancel line on the
paywall is near-universal. Lingokids: "First week is FREE, then $71.99/year.
Cancel anytime." Headspace: "Cancel anytime in Settings". Headway puts it
inside the CTA itself ("2 taps to start, super easy to cancel"). PictureThis
makes "Cancel from the app or your iCloud account" checklist item two. Cal
AI's fine print names the channel: "Plan auto-renews unless you cancel.
Cancel in the App Store." No corpus winner defers cancel copy off-screen,
and none omits auto-renew from the paywall. This is our largest single
divergence from the corpus.

**Absolute charge dates.** OURS: the deck defines a `{charge_date}` token in
its conventions and then never uses it in any string; every reference is
relative ("your free week ends in 2 days"). THEIRS: winners state the first
charge as a calendar date. Noom footnotes "*Billed on June 11 unless
canceled beforehand", YNAB gates the CTA on a checkbox containing "my free
trial will last until July 8, 2026, and will auto-renew at $109.00/year",
Blinkist's timeline reads "May 27 - Become a member", Rocket Money's
authorization names "October 08, 2025".

**Welcome length and shape.** OURS: S1's 24-word body enumerates four
capabilities (worksheets, weeks, hours, 10pm questions), longer than any
welcome in the corpus, and it spends a joke where all 28 captured welcomes
are plain declarative claims. THEIRS: one 4-11 word claim and let the hero
carry the rest. Duolingo: "Learn for free. Forever." (4 words). Cal AI:
"Calorie tracking made easy". Fitbod: "Train Smarter. Live Better."
Blinkist: "Understand powerful ideas in 15 mins". The corpus pattern is one
claim per screen.

**The parent's name.** OURS: S7 collects the name ("so I stop calling you
\"hey\"") and no later string ever uses it; we spend `{kid}` everywhere and
the parent's name nowhere, which makes the S7 joke a promise the deck
breaks. THEIRS: winners spend the name within one or two screens and again
at emotional peaks. Noom: "Welcome to Noom, Morris" immediately after entry.
MyFitnessPal: "Hey, Morris. 👋" on the very next question. YNAB: "Hi Morris!
How did you hear about us?" plus a personalized loading joke. Lifesum's
paywall headline: "Morris, be 5x more likely...". Fabulous's signed
contract: "I, Morris, will make the most of tomorrow".

**Per-question rationale.** OURS: two asks carry a "why we ask" line
(interests: "Whatever you put here ends up on the worksheet."; state:
"because homeschool rules are local and I've done the reading") but the age
and subjects questions ship bare. THEIRS: the rationale line is mandatory
per-question furniture. Cal AI repeats "This will be used to calibrate your
custom plan." verbatim across steps, BetterMe: "Your sex impacts key body
metrics...", ELSA: "This helps AI recognize your voice", Flo: "to make the
predictions better", Lifesum recurs "This helps us personalize your daily
recommendations".

**Possessive CTAs at commitment.** OURS: the only possessive CTA is S4's
"Make one for my kid"; the paywall CTA "Try it for $0.00" is impersonal
(that exact form is separately winner-validated: Duolingo, Lingokids,
Monarch, and Fitbod all run "Try for $0.00"), and our possessive trial
phrasing appears only on the decline secondary ("Actually, start the free
week"). THEIRS: winners flip to first person at the money moment. Duolingo:
"I'M COMMITTED". Headspace: "Start my free trial". Speak renames the trial
at the final tap ("Start my free week"). ELSA: "Commit to daily goal".

**Headline framing.** OURS: "Keep {kid}'s pages coming." is the corpus's
only continuation-framed paywall headline. THEIRS: every corpus paywall
headline is acquisition-framed, unlock/get (Calm "Unlock Calm for free",
Lingokids "Unlock unlimited FUN with Lingokids Plus!", ELSA "Get 7 Days Full
Access for Free", Lensa "Get Full Access", ChatGPT "Get ChatGPT Plus") or
start-framed (Keiki "Start Sun's learning now!"). Ours coheres with the
endowment move of the child's real page as hero, but it has no winner
precedent: a genuine bet, not a validated pattern.

**Who talks about money.** OURS: the persona's "I" carries the money
conversation ("I'll remind you 2 days before your free week ends", "the
next page is on me"). THEIRS: mascots go silent or corporate at the paywall.
Duolingo's Duo asks every quiz question but the paywall is voiceless
("Subscription / COMPARE PLANS"), Keiki's Didi disappears from the paywall
headline, Cal AI switches to "We'll send you a reminder". The corpus split
is mascot-for-questions, brand-"we"-for-billing. Our single voice is
distinctive and unvalidated, though Fitbod's coach ("Hey, it's your coach!")
and Flo ("Hello, I'm Flo") show persona voice surviving near the money.

**Register.** OURS: zero exclamation marks across the walk, the
premium-quiet register of ChatGPT (none, no emoji, no superlatives), Calm,
and Lensa. THEIRS, in our own category: the direct kid-app winners shout.
Keiki: "Ok, last step!", "Start Sun's learning now!", "Get my 50% OFF!".
Lingokids: "Unlock unlimited FUN with Lingokids Plus!". Coherent
differentiation, but it should be a confirmed choice, since both direct
kid-app winners monetize with heat.

**Decline tone.** OURS: two full warm screens on the no path ("Take your
time.", "No pressure.", "{Kid}'s page is yours to keep... the next page is
on me"). THEIRS: loss aversion or silence. Fabulous threatens ("If you exit
now, you will not have access to this offer for the next 12 months"), ELSA
warns ("If you close this screen, you'll lose the gift!"), MyFitnessPal
shames ("No more restarts. This time, it's real."), and most winners give
decline no words at all (Keiki offers only a back chevron; Monarch's is a
quiet "Continue in-app >"). Homa is the only deck that spends copy
generosity on declining.

**Where we match the canon.** Our price grammar is corpus-canonical: "7
days free, then $119 a year ($9.92 a month)." tracks Blinkist ("7 days
free, then $139.99 per year"), Imprint ("7 days free, then $74.99/year
($6.25/mo). Billed annually. Cancel anytime."), and PictureThis ("7 days
free, then just $39.99/yr(~$3.33/mo)") almost word for word; "Nothing due
today." matches Cal AI's thrice-repeated "No Payment Due Now", Speak's "No
payment due now.", and ELSA's "No payment today". Our one-name-per-concept
law ("free week", never "trial") is winner-supported at the warm end (Speak
renames to "my free week" at the final tap; Lingokids' CTA is "Start my
FREE week"). Our reassurance-at-anxiety lines ("The page is saved for you
either way.", "You can stop whenever you like.") match MyFitnessPal ("It's
ok to estimate, you can update this later."), Blinkist ("You can always
update your answers."), and Keiki ("Add more kids or edit anytime"). And
our humor placement matches YNAB, the corpus's only comparably funny deck,
which spends jokes exclusively at friction points (the name field, the
loading wait, the account gate); our one off-pattern joke is on the welcome
screen, the screen winners keep flattest.

## Sections and structure

**Length band.** OURS: 11 beats, bottom quartile of the corpus. THEIRS:
three bands, quiz-paywall engines at 29-62 pre-paywall screens (Cal AI 38,
Praktika 43, Natural Cycles 46, Yazio 50, Fitify 55, Lose It 62), a
demo-first middle at 9-15 (Lingokids 9, Photoroom 9, Lensa 9, Facetune 9,
Pimsleur 12, Fitbod 15), account-only utilities at 4-10. We are structurally
a demo app, which fits real generation at S8-S9, but we cannot lean on
quiz-length sunk cost the way Cal AI, Noom, and Fabulous (39 screens to
paywall) do.

**Skeleton.** The canonical welcome-goal-questions-loader-gate-reveal-paywall
spine appears in roughly 40 of 50 apps; Homa has every canonical section
plus two the corpus lacks (a true decline state, a post-paywall router). One
inversion: our proof (S4 gallery) comes before the questions, where the
corpus puts proof interstitials between and after questions (Speech Blubs,
Insight Timer, Flo, Yazio). Only PictureThis shares the proof-first shape.

**Social proof.** OURS: none, anywhere, by law (no paying customers, no
counts). THEIRS: 18+ apps devote a dedicated screen to counts, ratings, or
awards (Keiki "700K+ 3-year-olds", Balance "1,051,603 people your age",
Headway "55M+", ELSA "50 Million", Flo "#1 OB-GYN-recommended" with
citation, Fabulous's Duke/96%/22M). The S4 gallery of real worksheets is the
honest substitute: artifact proof filling the aggregate-proof slot.

**Outcome promise.** OURS: no outcome claim anywhere; the closest is S12's
"the better every page gets". THEIRS: 10+ apps run a chart or dated claim
immediately pre-paywall (Keiki's minutes-of-focus chart, Cal AI "Lose twice
as much" plus "14.8 kg by September 11", Speech Blubs "In 4 Months Morris
can reach their full potential", Lifesum "you will reach your goal by
January 24, 2027"). Correct under our claims laws; note the corpus fills
this slot exactly where our S9-S10 seam sits.

**Account gate.** OURS: S5 at beat 4 of 11 (~36%), header "Save your
progress." over three doors, no body. THEIRS: 16 of 50 never gate, ~14 gate
at the start, and 9 winners gate at the very end after the plan is built
(Cal AI 31/38, YNAB 28/28, Lose It 62/62, Keiki 39/39). The caveat on our
own provenance: every corpus app using save-your-progress framing (Cal AI,
Fitbod, Lifesum, Balance, Keiki) gates after heavy investment, while at our
placement the saved "progress" is two taps. Plumbing forces the position;
the header copy carries more load here than anywhere in the corpus.

**Loader.** OURS: S8 is a real 85s+ build filled with a multi-chapter
structured interview producing progress-report receipts. THEIRS: 20+ apps
stage a loading moment and it is nearly always fake work spent on persuasion
(Duolingo's "3 million people" line, ELSA's B2B logo wall, BetterSleep
concentrating all its social proof in the loader, YNAB's joke). Only Keiki
(one ADHD interrupt modal) and Headway (one inline survey in the fake bar)
harvest anything. Nobody else converts loader dead time into durable product
value. This is our most defensible structural invention.

**Decline path.** OURS: S11 gives product value (a free page credit plus
snooze) instead of a price cut, the only such decline state in the corpus.
THEIRS: 13+ apps run a discount ladder (Balance 4 rungs ending in
pay-what-you-want, Fabulous 4 rungs down to a $19.99/yr "gift", Fitify
30% then 50% countdowns, Headway 44%, Blinkist 25%, Lose It 50%). Structural
bonus for us: never anchoring a fake discount keeps the $119 price credible.

**Post-paywall router.** OURS: S12's three doors run identically for payers
and decliners, nearly unique in the corpus. Nearest analogues: PictureThis's
single-purpose activation screen ("We've prepared a plant for you!") and
Headway's post-trial guide. Everyone else dumps the user onto home with an
upgrade pill.

**Trial reminder device.** OURS: one automatic sentence, the strongest
commitment version (no toggle to leave off) but the leanest structural
version. THEIRS: 12+ apps spend a whole beat on it, either a dedicated
pre-paywall screen (Cal AI runs two, Balance shows it before any price with
its own consent CTA "Sounds good", Facetune's "How your free trial works"
timeline, Blinkist's dated 3-step timeline) or an on-paywall toggle (Fitbod
and Calm default ON). The corpus treats forgot-to-cancel anxiety as the
paywall's biggest objection.

**Missing beat: notification permission.** OURS: no permission beat in the
walk, yet S10's reminder line and the D13 trial notification are explicitly
gated on permission ("renders only when the notification can actually fire,
or falls back to email"). THEIRS: 13+ apps place a benefit-framed
pre-permission beat inside onboarding (Duolingo's mascot promise with an
arrow at "Allow", Fitbod's "preview of your workout" framing, Headspace's
"gentle reminders" with equal-weight decline, Flo's mock notification card).
Without an in-walk permission moment, our paywall's strongest trust line
will frequently degrade or vanish.

**Personalization receipt.** OURS: S9 replaces the recap card with the real
artifact plus one attribution line ("Built from what you told me:
{interest} + {subject}"). THEIRS: 12+ apps insert a recap screen echoing
quiz answers immediately before monetization (ELSA's recap cards with edit
chevrons, Fitbod's plan card echoing "Train 4 times a week / Bodyweight
only", Cal AI's number-and-date pill). Ours is stronger evidence than any
recap; cutting S9's checkmark receipt row was safe because the artifact is
the receipt.

**Question-run rhythm and the roster.** OURS: the S6-S7 run (4+ questions
per kid plus 2 parent fields) has zero interstitials, and the S6 roster loop
("That's everyone / Add another kid") has no corpus precedent: no corpus app
builds multiple child profiles during onboarding (Keiki picks one age and
defers with "Add more kids or edit anytime"). THEIRS: quizzes salt question
runs with proof or education beats every 3-6 screens (Insight Timer
alternates by design, MyFitnessPal alternates white questions with blue
"real talk" beats, Yazio drops "Awesome!" interstitials). Watch item: with
multi-kid families S6 is the walk's only unbounded stretch and it has no
variety beats. Related divergence: kids apps make child age the first
question because age routes all content (Keiki and Lingokids both at
position 5); our S3 age cut replaces that router with loud age labels on
the S4 gallery cards, an approach no corpus app uses.

**Paywall architecture and hero.** OURS: single plan default plus a "View
other plans" sheet, price sentence directly above the CTA, and the kid's
real page as full-screen hero, free to keep on decline. THEIRS: the
single-plan-plus-sheet shape is the dominant winner pattern (Lingokids one
plan + "View all plans", Headway one-sentence paywall + plan sheet, ELSA
plan card + "Change Plan", Headspace literally one plan) against the
plan-grid minority (Babbel 4 cards, Lifesum 3-tier table, Keiki 3 plans).
The own-artifact hero has exactly two corpus peers, both photo apps: Retake
("Your Retake is Ready!" handing into "Now it's your turn!" over the
generated portrait) and Photoroom. We go one step further than both: Retake
watermarks its demo and PictureThis's sample plant belongs to the funnel,
while "{Kid}'s page is yours to keep".

## Simplicity

Corpus baselines: welcomes 8-25 words / 3-6 elements, question screens
12-35 words, primary paywalls ~35-95 words / 6-15 elements with a median
around 55-65 words (Flo 62w/12el, Babbel 55w/10el, Speak 65w, MyFitnessPal
63w/9el, Fitbod 68w/14el, Monarch 80w/14el, Blinkist 95w/12el, Copilot
115w).

**S10 is our strongest screen on this dimension.** At 41 words / 8 elements
it lands in the leanest quartile; only Cal AI's gift-framed trial screen
(~25w/7el), Headspace (~35w/8el), Headway (~38w/6el), and Calm's collapsed
sheet (~35w) are sparer, and Headway proves the pattern converts with its
entire terms disclosure as one sentence over mostly empty cream space. Our
cuts are exactly what the lean camp omits and the heavy camp pays for: the
3-row trial timeline costs 75-115 words where it survives (Copilot 115w,
Blinkist ~95w, Cal AI's plan sheet ~95w), feature bullets cost 50-70+
(Keiki 3 benefits at ~70w/15el). The automatic one-sentence reminder
out-spares the whole corpus: Calm, Fitbod, PictureThis, Flo, and Speech
Blubs all ship an interactive toggle, and Cal AI, Balance, and Speech Blubs
each spend an entire screen on the promise; saying "Nothing due today."
once beats Cal AI repeating "✓ No Payment Due Now" three times.

**S5 matches the corpus minimum.** Cal AI's hard gate is literally "Save
your progress" plus three sign-in doors at 12 words / 4 elements with no
body copy; our S5 is identical in shape. Gates that add benefit copy
(Fitbod ~40w, Monarch's badge-stacked signup ~55w) are the heavier
minority.

**Three screens are still heavy for their slots.** S1 at ~50 words sits
against an 8-25 word welcome norm, and no corpus winner enumerates
capabilities there (Lingokids compresses its whole catalog into one 9-word
sentence). S4 at ~50 words sits against an 11-28 word proof-screen norm,
and its swipe hint ("Swipe through: every age is in here.") is instruction
copy the corpus never spends: galleries in Blinkist, ELSA, and Imprint
carry zero browse instructions; a peeking card edge is the affordance. S12
at ~50 words sits against a 4-24 word post-success norm, driven by the
28-word speech bubble, 2-4x the corpus mascot-speech norm (Duolingo's "Hi
there! I'm Duo!" is 5 words, Keiki's "Hi, I'm Didi" is 4, Fitbod's coach
caps around 14).

**Two element-count notes.** S11's armed branch offers 3 competing actions
(Remind me later chip + See {kid}'s page CTA + "Actually, start the free
week" secondary) where the corpus decline norm is 1 CTA + 1 quiet exit;
even wordy downsells (Blinkist 75w, MyFitnessPal 70w) present exactly one
CTA plus one decline. And S2 keeps a Continue button under 4 single-select
options where the sparest quiz screens advance on tap (Babbel, Balance,
Fabulous, Photoroom, Speech Blubs, Flo).

**The whitespace warning.** Half the corpus's simplicity formula is
emptiness, not word count: Blinkist leaves the top two-thirds of its
welcome white, Headway's 38-word paywall is mostly empty, Photoroom leaves
the bottom half of question screens blank. The implementation risk for our
lean screens (S2, S5, S9, S10) is refilling saved words with decoration;
the winners pair few words with deliberate emptiness or one full-bleed
artifact. Separately, our forbidden-by-law omissions happen to match what
the leanest paywalls omit anyway: Cal AI, Headspace, MyFitnessPal,
Photoroom, ChatGPT, Copilot, and Noom all ship primary paywalls with zero
testimonials, ratings, or user counts.

## What to change, what to keep

Prioritized. Items 1-7 are changes; 8-10 are keeps that need either a
guardrail or a founder confirmation.

1. **Put cancel and auto-renew on the paywall itself.** Extend the S10
   price sentence or caption with the mechanic and the channel, in the Cal
   AI / Lingokids form: "Cancel anytime in the App Store." That is ~6 words
   and keeps S10 in the leanest quartile (47 words, still under the 55-65
   median); every corpus winner carries it, none defers it to a
   notification, and our ROSCA/ARL posture already wants charge terms
   complete at the button.

2. **Spend the `{charge_date}` token the deck already defines.** Make the
   reminder line or a footnote absolute, per Noom ("*Billed on June 11
   unless canceled beforehand") and YNAB's dated checkbox: for example
   "Free until {charge_date}. I'll remind you 2 days before." One dated
   line resolves the corpus's biggest paywall objection more concretely
   than any relative window.

3. **Add a benefit-framed notification permission beat before S10.** The
   reminder line is the paywall's strongest trust sentence and it is gated
   on permission we never ask for in the walk; 13+ winners pre-sell the
   permission inside onboarding (Duolingo, Fitbod, Headspace, Flo's mock
   notification card). Natural slot: on entering S8, framed as "I'll tell
   you the moment {kid}'s page is ready", which is also the walk's one
   honest immediate reason to want a notification.

4. **Use the parent's name after S7, at least twice.** The S7 joke ("so I
   stop calling you \"hey\"") is currently a broken promise. Cheapest
   winner-validated spends: the very next screen or receipt (MyFitnessPal
   "Hey, Morris. 👋", Noom, YNAB) and one emotional peak, S9's reveal or
   S12's speech (Lifesum puts the name in its paywall headline). Keep the
   paywall itself name-free if S10's word budget is sacred; S9/S12 are not.

5. **Cut S1's body to one claim.** ~50 words against an 8-25 word welcome
   norm, and the four-job catalog duplicates what S2's option list already
   demonstrates one screen later. Keep the sub (the name-on-worksheet
   promise is the walk's real hook); reduce the body to the worksheet claim
   alone, in the Duolingo/Cal AI one-claim shape. Move or drop the 10pm
   joke: all 28 corpus welcomes are flat, and YNAB shows wit pays best at
   friction points, which S1 is not.

6. **Add a one-line "why we ask" to the bare S6 questions.** Age and
   subjects ship without rationale while interests and state have strong
   ones; the corpus treats the line as mandatory furniture (Cal AI's
   verbatim "This will be used to calibrate your custom plan." on every
   step, ELSA, Flo, Lifesum). Age: one plain clause about pitching the page
   at {kid}'s speed. Subjects: what lands on the page. Plain beats witty
   here, per Sidney's clarity-beats-clever direction on the interests sub.

7. **Trim the two remaining heavy-for-slot moments.** S4: cut the swipe
   hint and let a peeking card edge carry the affordance, per every corpus
   gallery (Blinkist, ELSA, Imprint); that is the cheapest ~7 words in the
   deck. S12: halve the speech bubble toward the corpus's 4-14 word
   mascot norm, keeping one sentence, not two ("the better every page
   gets" is the clause doing conversion work; the print-grab image is
   charm the hero artifact already delivered at S9).

8. **Keep S10's spare architecture, and defend it in implementation.**
   Single plan + sheet, price sentence above the CTA, automatic reminder,
   captionless artifact hero: each is the dominant or leanest winner
   pattern (Lingokids/Headway/ELSA/Headspace on architecture, Imprint on
   one-line terms, Photoroom/Retake on the own-artifact hero). The corpus
   risk is refill: winners pair few words with deliberate emptiness, so any
   added element (including items 1-2 above) must displace pixels, not
   whitespace.

9. **Keep the no-discount, value-giving decline, but thin the armed branch
   to two actions.** Never anchoring a fake discount keeps $119 credible
   against the corpus's 13-app discount-ladder norm, and the free-page
   credit is a genuine invention; keep both. But 3 competing actions
   exceeds the universal 1 CTA + 1 quiet exit decline norm: fold "Remind me
   later" into the body or the snooze notification path and present See
   {kid}'s page + "Actually, start the free week" only.

10. **Confirm the three unvalidated bets as deliberate, and watch them.**
    (a) The continuation-framed headline "Keep {kid}'s pages coming." vs
    the corpus-universal unlock/get/start framing; (b) Homa's "I" carrying
    the money conversation where corpus mascots go silent or corporate;
    (c) the zero-exclamation quiet register where both direct kid-category
    winners (Keiki, Lingokids) monetize with heat. All three cohere with
    the endowment strategy and the brand, none has winner precedent, and
    together they are the deck's identity. Ship them as confirmed founder
    choices, and if paywall conversion disappoints, these are the first
    three variables to test, in that order, before touching the validated
    spine (price grammar, "Nothing due today.", the artifact hero).
