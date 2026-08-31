# Video motion mining: MyFitnessPal + Flo

Executes Track 1 ("mine what we already downloaded") from
`work/onboardingandpaywall8-30/motion-and-animation-gap.md`. Every `.mp4`
already present in the two research folders was probed with `ffprobe`,
sampled with `ffmpeg`, and every extracted frame was actually opened and
looked at (not just listed). Frames live in `img/frames/` next to each
source video; originals were not modified.

---

## MyFitnessPal (`research/fitness-nutrition-myfitnesspal/img/`)

### `welcome1_Hero.mp4`: 8.87s

**Kind:** Genuine screen recording of a real app launch, not a marketing
loop. 18 frames extracted at 2fps (`frames/welcome1_Hero_sample_01..18.png`).

**What it shows:** The MyFitnessPal cold-start splash screen: solid blue
background, white wordmark centered, and a spinning 8-blade loading
indicator near the bottom with status text under it. The status text
changes mid-animation, it reads "Updating…" through the first ~10
frames, then flips to "Loading…" around frame 10 (roughly the 5s mark), 
confirming this is a live app state machine, not a looping GIF. The
spinner keeps turning (blade-opacity animation) for about 7.5 of the
8.87 seconds. In the final ~1.3 seconds (frames 16-18) the whole screen
cuts to the "Welcome to myfitnesspal" carousel screen: a full-bleed photo
of a woman mid-workout with an overlaid translucent card showing a
"Protein - Last 7 days" bar chart, a 3-dot carousel indicator, and
"Sign Up For Free" / "Log In" CTAs. This single clip captures two real
moments back to back: the branded loading state (with live status-text
swap) and the hard cut into the first onboarding/marketing screen.

### `01_Intro.mp4`: 162.93s (2:43)

**Kind:** Genuine, long-form screen recording of a full onboarding-to-
paywall run, someone actually filling out the flow with real fake data.
11 frames sampled every 15s (`frames/01_Intro_sample_01..11.png`),
capturing the whole arc start to finish.

**What it shows, in sequence:**
1. **Name entry**: "First, what can we call you?" text field with the
   iOS keyboard open, step-progress bar at 1/7 segments filled.
2. **Multi-select checklist**: "In the past, what were barriers to
   achieving weight loss?" with checkbox rows; "Lack of time" is checked
   (filled blue checkbox + blue border highlight on the selected row).
3. **Single-select radios**: a sensitive GLP-1/Ozempic-class medication
   question with 5 plain radio options, none selected yet in this frame.
4. **Chip/pill multi-select grid**: "Which healthy habits are most
   important to you?" showing two tiers ("Recommended for you" / "More
   healthy habits") as rounded pill buttons; several pills are already
   toggled to the filled-blue selected state (Move more, Workout more,
   Track nutrients, Eat mindfully, Eat more vegetables, Drink more
   water), a real multi-tap sequence, not a single click.
5. **Demographics form**: sex toggle (Male/Female cards, Male checked),
   a numeric-keypad age field mid-entry (progress bar now 3/7), then a
   later frame shows the same screen with age filled to "25" and country
   dropdown resolved to "United States", proving the numeric keyboard
   was actually used and dismissed.
6. **Body metrics**: height (5 ft 6 in, with an "ft/in" unit-toggle
   chip) and current weight (90, "kg" unit-toggle chip) filled in, goal
   weight field empty and focused with the numeric keypad open.
7. **Weekly goal radios**: "Lose 1 kilogram per week" selected (filled
   checkmark), progress bar 5/7.
8. **Account creation**: email field filled with a realistic fake
   address (autocorrect red spellcheck underline visible under it), password field
   focused with an empty clear-icon.
9. **Submission loading state**: the very next sampled frame shows the
   same Create Account screen dimmed/grayed out with a white rounded
   square containing a circular spinner centered over the password
   field, and the Terms checkbox now checked, a genuine tap-to-submit
   loading overlay caught mid-animation.
10. **Paywall**: the flow lands directly on a dark-background discount
    paywall: an "ENDS SOON" urgency badge, a torn-ticket graphic reading
    "25% off Premium," headline "No more restarts. This time, it's
    real.", a single 12-month plan card ($79.99 struck through → $59.99/
    year, "$5/mo") with a filled checkmark, and an "Upgrade to Premium"
    CTA.

This is the single richest asset in either folder: a real, unbroken
recording of MyFitnessPal's entire onboarding questionnaire (name →
barriers → medication screen → habit chips → demographics → body
metrics → weekly goal → account creation → submit-loading spinner →
discount paywall), with visible tap states, filled form values, and a
genuine network-submit loading overlay.

---

## Flo (`research/health-cycle-flo/img/`)

### `welcome1_SplashVideo.mp4`: 8.53s

**Kind:** Genuine screen recording of a short animated intro sequence
(text/graphic build-in with a real screen transition), not a static
logo loop. 17 frames sampled at 2fps
(`frames/welcome1_SplashVideo_sample_01..17.png`).

**What it shows:** Opens on a static pink-gradient splash with the white
Flo feather mark and "Flo" wordmark (frames 1-4 look identical, the
splash simply holds). Around frame 5 it cuts to a cream/off-white social-
proof screen scattered with decorative flat-illustration icons (flowers,
mini umbrellas, a party hat), the decorations themselves are static
between frames, but the headline text builds progressively: "# 1 female"
appears alone first (frame 5), then "OB-GYN-recommended app for period
and cycle tracking" plus a supporting citation line ("Based on a survey
of 225 US OB-GYNs... DRG, 2021") animate in underneath by frame 9. By
frame 13 the "#1 female" line itself has been swapped out, leaving only
the "OB-GYN-recommended..." claim and citation, i.e. the two-line claim
sequences rather than just fading in once. Frame 15 is a completely
blank near-white frame with only the header chrome visible, a genuine
fade-through-white transition frame, before the clip lands (frame 17)
on a "Privacy first" consent screen: a pink shield-with-feather icon over
a scattered gear-and-cog illustration, three stacked consent checkboxes
(health-data processing, Privacy Policy/Terms, activity tracking/
AppsFlyer), an "Accept all" link, and a disabled-looking light-pink
"Next" button. So this 8.5s clip actually contains three distinct
screens joined by cross-fades: logo splash → animated-text social-proof
claim → privacy consent screen.

### `01_OnboardingIntroVideo.mp4`: 275.9s (4:36)

**Kind:** Genuine, long-form screen recording of a real onboarding run,
including live keyboard entry, a real iOS system permission dialog, and
a distinctive press-and-hold commitment gesture. 11 frames sampled every
25s (`frames/01_OnboardingIntroVideo_sample_01..11.png`).

**What it shows, in sequence:**
1. **Name entry, live typing**: "What would you like Flo to call you?"
   with a single-letter "M" typed and the iOS keyboard visible; a key
   callout bubble ("O") is captured floating above the keyboard mid-
   keystroke, proving this is a real recorded tap-by-tap typing session,
   not a pre-filled screenshot.
2. **Goal-selection grid**: "What can we help you do? Choose as many as
   you'd like." with 8 illustrated icon cards (Get pregnant, I'm already
   pregnant, Track my period, Charge my well-being, Manage my weight,
   Enhance my sex life, Decode my discharge, Explore contraception).
3. **Mascot intro screen**: Flo's green humanoid-battery mascot
   standing against an illustrated sky/clouds background, a speech
   bubble ("I'll reflect your sleep, activity, and cycle to see what
   impacts your well-being.") and a small "Cycle" info chip.
4. **Social-proof screen, mid cross-fade**: a testimonial wall ("THE
   MOST ACCURATE EVER!", "Over 7 million 5-star ratings", 5 gold stars,
   "on App store and Google Play", more quote cards) rendered at
   partial opacity with the mascot from the previous screen still
   visible ghosted on top, direct visual evidence of a cross-fade
   transition captured mid-blend between two onboarding screens.
5. **Birth control question**: mascot now wearing glasses and holding
   a clipboard (a costume/pose change for this "doctor" framing), radio
   list of birth-control methods, thin red progress bar at top.
6. **Personalized symptom picker**: "Morris, how do you feel today?"
   (the name typed in step 1 is echoed back live) with a 3x2 icon grid
   of symptom toggles (Cramps, Fatigue, Bloating, Tender breasts,
   Backache, None of these).
7. **Trust/credibility screen**: animated circular progress-ring
   indicators next to condition names ("Uterine fibroids - Low match,"
   "Endometriosis - Low match," "Polycystic ovary syndrome -
   Significant match"), a floating "Pay attention" gauge/badge card
   with a warning triangle, and a "Created in collaboration with Flo
   medical board" credential strip with a verified checkmark.
8. **Button press-state capture**: "Do you know how your cycle relates
   to your sex life?" with mascot showing hearts in a thought bubble;
   of the three answer rows (Yes / No / I don't know), "I don't know"
   is rendered in a solid filled-pink pressed state while the other two
   remain plain gray, a genuine tap-down visual-feedback frame.
9. **Real iOS system permission sheet**: a native HealthKit "Health
   Access" dialog (not an in-app mock) sliding up over a dimmed
   background, listing three data toggles (Basal Body Temperature,
   Sleep, Water) all off, a "Turn On All" link, and grayed-out
   "Allow" / "Don't Allow" buttons, captured mid-presentation
   animation.
10. **AI-style analysis/loading screen**: "Analyzing sleep patterns…"
    with a grayed-out mascot silhouette and small icons (a toast/bread
    icon, a birth-control pill pack, sparkle particles) arranged along
    an elliptical orbit path around it, "Powered by Flo Intelligence"
    branding at the bottom, a distinct orbiting-particles loading
    animation, different from any spinner seen elsewhere in either app.
11. **Press-and-hold commitment ritual**: the standout interaction in
    either research folder: a personalized pledge ("I, Morris, will use
    Flo to improve my relationship with my period, know my body better
    and be ready for anything.") sits above a large circular button
    with a glowing pink halo, a dashed circular progress ring drawn
    around the Flo feather icon, and the label "Keep holding!", with
    "Tap and hold on the Flo logo to commit." instructions below. This
    is a real long-press gesture caught mid-hold, not a simple tap.

---

## Summary

All 4 videos analyzed are genuine screen recordings of real interaction
(no pure marketing/logo loops in the strict sense, even the shortest
splash clips are actual recorded transitions between real app screens,
though `welcome1_Hero.mp4`'s first ~7.5s is a static branded loading
state before the cut). Together they document: live keyboard typing with
key-press callouts, multi-select checkbox/pill/chip toggle states,
radio-button and press-down visual feedback, unit-toggle chips (ft/in,
kg), a numeric keypad flow, a submit-triggered loading spinner overlay,
a real native iOS HealthKit permission sheet, an orbiting-particle AI-
analysis loading animation, cross-fade transitions between onboarding
screens (including one frame caught mid-blend and one fully blank
fade-through-white frame), and, the most distinctive single pattern
found, Flo's press-and-hold "commit to your pledge" gesture with a
radial progress ring and glow, plus MyFitnessPal's full unbroken
onboarding-to-paywall recording ending on a discount-urgency paywall.
