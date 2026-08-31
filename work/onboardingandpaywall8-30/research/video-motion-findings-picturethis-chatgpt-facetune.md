# Video motion mining: PictureThis, ChatGPT, Facetune

Executes Track 1 ("mine what we already downloaded") from
`work/onboardingandpaywall8-30/motion-and-animation-gap.md`. Six `.mp4` files
were already sitting in the three Appllama research folders, unwatched. Each
was probed with `ffprobe`, sampled into a `frames/` subfolder next to the
source video with `ffmpeg`, and every extracted frame was viewed directly.
Originals were not touched; only `frames/*.png` files were added.

Sampling method: videos under 10s were sampled at 2fps (or higher for a
sub-2s clip, to get enough frames to read the motion); videos in
screen-recording length (30s+) were sampled every 8-12 seconds, well inside
the 10-12-frame cap.

## plant-lifestyle-picturethis (PictureThis)

Source folder: `research/plant-lifestyle-picturethis/img/`

### 01_SplashIntroVideo.mp4

- Duration: 54.7s. Resolution 498x1080 (9:19.5, a phone-frame capture).
- Sampled every 8s -> 7 frames in `frames/01_SplashIntroVideo_sample_01..07.png`.
- **Kind: genuine screen recording**, not a marketing loop. It is a captured
  walkthrough of PictureThis's actual first-run flow, stitched end to end.
- What it shows, in order across the 7 frames:
  1. A full-bleed 3-column collage of real plant/flower photography (the
     app's "browse" or teaser grid) - no chrome/progress bar visible yet.
  2. An auto-advancing **social-proof carousel** with a thin progress bar
     across the top that fills left-to-right per slide (Stories/Reels
     pattern): "100M+ plant lovers worldwide" over a flat-illustration globe
     scene with people celebrating.
  3. Next slide, progress bar reset and refilling: "400,000+ plant species
     covered" over an illustrated hiker using the app in the field.
  4. Next slide: "6 years as #1 in accuracy" over a trophy/confetti
     illustration, dark navy background (visual contrast beat between
     slides).
  5. Next slide: "1.56X more accurate than others" with an **animated bar
     chart** - a curved white arrow sweeps up into an orange "1.56X" badge
     that sits above a tall green bar (PictureThis) next to a shorter gray
     bar (57%, "Other Plant App") - a build-in comparison-chart animation.
  6. Cut to the **paywall**: "Design Your Trial" on a dark green gradient
     background, four checklisted benefit rows with green checkmarks, a
     "Remind me 2 days before trial ends" toggle (shown off), and two
     selectable plan rows (Free 7 days / $0.99 1-month "Best Deal").
  7. Cut to a **post-paywall interstitial modal**: "Discover what's in
     season and nearby" over a phone-mockup illustration showing a live
     notification card ("3,000+ snaps this week", "Don't miss the best time
     to see Tulips"), with a location dropdown ("India") behind it and a
     green "Select City" CTA pill.
- Net verdict: this is a full recorded pass through PictureThis's
  reels-style onboarding carousel (auto-advancing progress-bar slides with a
  built-in-place stat animation) straight into its trial paywall and a
  location-permission-flavored upsell modal. Reusable evidence for: the
  progress-bar-per-slide idiom, the animated comparison-bar-chart beat, and
  the paywall-then-modal sequencing.

### welcome1_SplashScan.mp4

- Duration: 5.4s. Resolution 498x1080.
- Sampled at 2fps -> 11 frames in `frames/welcome1_SplashScan_sample_01..11.png`.
- **Kind: logo/splash animation**, not an interaction recording.
- What it shows: green vector fragments (leaf shrapnel) scattered on a white
  background **assemble into a hand-drawn line outline** of a leaf, which
  **fills in with the solid gradient leaf mark**, framed by scan-corner
  brackets, resolving into the full-color "PictureThis" wordmark lockup.
  After a hold, the tagline **"Botanist in Your Pocket" fades in** beneath
  the logo while the scan-bracket icon stays on screen; a "By tapping
  Continue..." consent line and green "Continue" button are present at the
  bottom of the frame the whole time this plays out above them.
- Net verdict: a genuine build-on logo animation (assemble/morph -> draw-on
  -> settle -> tagline fade) used as the literal first-launch splash, not
  stock footage or a marketing reel.

## ai-productivity-chatgpt (ChatGPT)

Source folder: `research/ai-productivity-chatgpt/img/`

### welcome1_SplashLoader.mp4

- Duration: 6.7s. Resolution 1080x2336.
- Sampled at 2fps -> 13 frames in `frames/welcome1_SplashLoader_sample_01..13.png`.
- **Kind: genuine screen recording** of the cold-launch loading sequence.
- What it shows: blank white screen -> a light-gray outlined **ChatGPT
  "flower knot" mark rendered as a loading glyph** (present, unchanging in
  scale, across multiple sampled frames - reads as a static/near-static
  loader rather than a spinning wheel) -> the loader is replaced by the
  **empty chat screen** (composer bar with "Ask ChatGPT" placeholder, plus,
  mic, and send-arrow affordances already live) -> a **modal sheet slides
  up from the bottom** carrying the "Welcome to ChatGPT" legal/consent
  screen (three bullet rows: Responses can be inaccurate / Don't share
  sensitive info / Control your chat history, with a black "Continue" pill).
- Net verdict: real cold-start sequence, not a logo loop - loader mark,
  then chat shell paints in, then the consent sheet is presented on top.

### 01_OnboardingIntroVideo.mp4

- Duration: 110.4s. Resolution 1080x2336.
- Sampled every 12s -> 9 frames in `frames/01_OnboardingIntroVideo_sample_01..09.png`.
- **Kind: genuine, extensive screen recording of a real live session** -
  the richest, most literal "real interaction" evidence of the six videos.
  It captures actual token-by-token model output, a real native auth sheet
  with iOS's own password-manager autofill bar, and native OS dialogs, not
  staged illustration.
- What it shows, in order:
  1. A guest chat mid-response, with the composer's send button switched to
     a **black stop/square icon** (streaming state) while a long assistant
     answer about game-design programming languages is **visibly still
     rendering/scrolling** under a translucent "Log in" pill pinned at top.
  2. A **native bottom sheet, "Log in or sign up,"** slides up over a dimmed
     background: ChatGPT mark, an email field with **live-typed text**
     ("morriss.sun1@") and, genuinely, **iOS's own QuickType/password-manager
     suggestion bar** docked above the system keyboard offering a saved
     "password for openai.com" - i.e. this is an actual recorded device
     interaction, autofill chrome included, not a designed mock.
  3. Same sheet re-skinned as **"How old are you?"** with Full name / Age
     text fields and a **disabled (gray) Continue pill** that is presumably
     enabled once both fields are non-empty.
  4. Fields now filled ("Morris" / "25"), and a **native iOS confirm
     alert** ("Confirm your birthday... setting your birthday to Jun 5,
     2001... Cancel / OK") is caught **mid-presentation-animation** -
     overlapping/ghosted text from the sheet underneath is still visible
     through the alert as it animates in, which is a real compositing
     artifact you only get from scrubbing a live recording.
  5. Loader mark reappears briefly (transition beat between the age-gate and
     the next step).
  6. **"What do you want to use ChatGPT for?"** - a single-select radio list
     (School / Work / Personal tasks / Fun & entertainment / Other) with a
     black "Continue" pill.
  7. A **fresh empty chat thread with a blinking text-input caret** already
     placed in the composer (post-onboarding landing state).
  8. A **real multi-turn conversation being scrolled**: a prior exchange
     ghosted at the top ("...5 practical ways to save time each week based
     on my daily routine"), then a clearly legible turn - user: "Help me
     create a 30-minute plan to finish a task I've been procrastinating
     on," assistant reply **actively streaming**, caught mid-sentence at
     "Sure. Tell me the task, and" with the stop/square send-icon confirming
     generation is still in progress.
- Net verdict: this is not a curated demo reel - it is a real recorded
  device session (System autofill bar, live confirm-alert animation,
  mid-stream text) covering guest chat -> login gate -> age-gate -> use-case
  picker -> live multi-turn chat. Strongest source in the batch for genuine
  interaction-motion reference: text-streaming behavior, disabled-to-enabled
  button states, and native OS sheet/alert transitions.

## photo-video-facetune (Facetune)

Source folder: `research/photo-video-facetune/img/`

### 01_OnboardingSplash.mp4

- Duration: 66.8s. Resolution 498x1080.
- Sampled every 10s -> 7 frames in `frames/01_OnboardingSplash_sample_01..07.png`.
- **Kind: genuine screen recording** of Facetune's full sign-up funnel,
  captured live (visible autofill, live OTP digits, a loading spinner mid
  animation).
- What it shows, in order:
  1. A **long consent/legal screen mid-scroll** (Face Data / biometric
     processing disclosure) with a **disabled (grayed) "Accept and
     continue" pill** pinned at the bottom.
  2. **"What year were you born?" (2 of 3)** - a genuine **iOS-style
     scrollable date-wheel picker**, caught mid-scroll: rows blur toward
     the top/bottom edges, a translucent selection band sits over "1999 /
     1998," and a small blue drag-indicator dot hovers over "1996," i.e. a
     live scroll/inertia gesture was in progress when this frame was
     captured.
  3. **"I want to use Facetune to..." (3 of 3)** - a multi-select chip grid
     (16 options: Smooth skin, Whiten teeth, Remove objects, etc.), several
     already shown selected (blue outline/text: Remove objects, Reshape
     features, Apply makeup, Conceal eye bags, Change clothes), with a blue
     "Finish" pill.
  4. **Sign-up screen**: "Join 200 million people already using Facetune!"
     over a photo collage of real portrait/beauty shots, with Apple/Google/
     phone-number/email/Facebook auth options and a pre-checked marketing-
     opt-in toggle.
  5. **Email entry with the live system keyboard open** and an actual typed
     value ("morriss.sun1") sitting in the field above a blue "Send code"
     pill.
  6. **OTP verification screen**: 6 boxed digits already auto-filled
     ("626362"), the "Continue" pill grayed out underneath a **circular
     spinner actively mid-spin**, overlaid center-screen - i.e. this frame
     was caught exactly during the async "verifying code" wait state.
  7. **Paywall: "Ready to go VIP?"** - a portrait photo of a model in a pink
     hat with a **white circular highlight/glow sitting on her forehead**
     (reads as a moving spotlight/sparkle effect scanning the face, likely
     tied to an "AI enhancement" or face-detection cue), three checklist
     bullets (VIP tools / unlimited saves / higher AI usage limits), a
     Yearly plan pre-selected with an "87% OFF" badge ($77.99/yr as
     $1.49/wk) versus Weekly ($11.99/wk), a black "Continue" pill, and
     "7 days free, then $77.99/year" fine print.
- Net verdict: a genuine, unusually complete recorded funnel - the only clip
  in the batch that shows a native scroll-wheel picker mid-gesture and an
  async spinner mid-spin. Strong reference for: disabled-button-until-valid
  patterns, a real date-picker interaction, and a paywall that pairs a
  living/animated hero photo with the pricing table instead of a static
  image.

### welcome1_SplashVideo.mp4

- Duration: 1.6s (shortest file in the batch). Resolution 498x1080.
- Sampled at 8fps -> 13 frames in `frames/welcome1_SplashVideo_sample_01..13.png`.
- **Kind: short looping background/marketing asset**, not an interaction
  recording.
- What it shows: the static **Facetune logo mark holds** for the first
  ~0.5s of the clip, then the "Welcome to Facetune! Share with confidence"
  headline and a bottom "Get started" pill appear as fixed UI chrome, while
  the **photo-collage background behind them crossfades rapidly through
  several unrelated beauty/portrait images** in well under a second per
  frame sampled - a portrait grid, a makeup-swatch collage, an abstract
  amber glass-orb still life, then a moody neon-lit portrait. Given the
  clip is only 1.6s total, this reads as a fast auto-cycling background
  loop (a Ken-Burns/crossfade slideshow) sitting behind static welcome-
  screen text, rather than any recorded tap-through.
- Net verdict: decorative motion only (ambient crossfade behind a static
  welcome card), no actual app interaction to mine here.

## Summary table

| App | File | Duration | Kind | Standout motion |
|---|---|---|---|---|
| PictureThis | 01_SplashIntroVideo.mp4 | 54.7s | Real screen recording | Progress-bar carousel + build-in bar-chart comparison animation |
| PictureThis | welcome1_SplashScan.mp4 | 5.4s | Logo animation | Fragment-assemble + draw-on leaf logo, tagline fade |
| ChatGPT | welcome1_SplashLoader.mp4 | 6.7s | Real screen recording | Loader mark -> chat shell -> consent sheet slide-up |
| ChatGPT | 01_OnboardingIntroVideo.mp4 | 110.4s | Real screen recording | Live token streaming, native autofill bar, live confirm-alert animation |
| Facetune | 01_OnboardingSplash.mp4 | 66.8s | Real screen recording | Mid-scroll date-wheel picker, mid-spin OTP verify spinner, animated paywall hero |
| Facetune | welcome1_SplashVideo.mp4 | 1.6s | Background loop | Fast crossfade photo-collage behind static welcome text |
