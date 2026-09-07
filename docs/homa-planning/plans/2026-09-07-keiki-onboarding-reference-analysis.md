# Keiki onboarding: full screen and motion reference

Date: 2026-09-07. Status: reference research, not a Homa design yet. Feeds
the mobile onboarding v2 visual redesign (mascot-speaks-in-bubbles
direction), discussed the same day but not yet specced.

## 0. Source and method

Two sources, likely two different variants of the same app and not fully
reconcilable frame for frame:

1. **A static screenshot montage** the founder pasted directly into chat:
   roughly 24 screens across 3 rows, no motion, no timing.
2. **A screen recording**, `TRTnx0INOPLs7yuZ.mp4` (from the founder's
   Downloads folder, a Twitter-sourced clip, 1334x1078, 30fps, 27.6s),
   analyzed by extracting frames at 10fps with `ffmpeg` and tiling them
   into ten labeled contact sheets (timestamped, 30 frames each) for
   frame-by-frame reading.

**Important caveat on the video.** It is not a real-time recording. It is
a capture of someone scrubbing through Keiki's own ~99-second App Store
preview video, embedded in a review site ("appklife.com") with its own
visible progress counter. That counter reads roughly 0:09 at my captured
t=3.0s and roughly 1:38 at my captured t=27.5s: 89 seconds of source
content played out over 24.5 captured seconds, a compression of roughly
3.5x, and not evenly (the first ~2 seconds are a visible scrub, flickering
between the notification-permission dialog and the wordmark, before
settling into one continuous pass from t=3.0s onward). **Screen content,
sequence, and what-triggers-what are reliable. Absolute hold times and
animation speeds are not** and should never be cited as real Keiki timing.

Where the static montage and the video disagree (a screen only one of them
has, or the same job styled differently), both are noted rather than
silently merged into one fake composite flow.

## 1. Screen-by-screen inventory, in flow order

Numbers are running order in the video capture. "Static-only" marks
screens seen in the montage but not in the traced video (likely a
different variant); "video-only" marks screens the montage did not show.

### Cold open
1. Wordmark splash ("KEIKI") on solid purple.
2. OS notification-permission dialog ("'Keiki World' would like to send
   you notifications").
3. Wordmark again, small loading-dot flicker at bottom center.
4. **Welcome screen**: mascot riding a unicorn holding a striped umbrella
   (illustration only, no bubble), headline "Finally, balanced screen
   time", primary "Get started" pill, secondary text link "I have an
   account".

### Persona intro (video-only, no chrome, mascot alone on flat purple)
5. Bubble: **"Hi, I'm Didi."** — the mascot names itself before asking
   anything.
6. Bubble swap: **"Tell me about your kiddo — I'll do the rest."**
7. Bubble swap: **"Just between us, promise."** — privacy reassurance.
   First "Continue" button appears here, pinned bottom.
8. Transition: mascot visibly shrinks and docks to the top-left corner.
   A progress bar appears at the top of the screen for the first time.
   This transition happens exactly once, and marks entering the
   question run.

### The question run (mascot small, top-left, bubble beside it, progress bar creeping)
9. **Age**: bubble "How old is your kid?", chip grid (0-1, 2, 3, 4, 5,
   6+), caption "Add more kids or edit anytime", one chip highlights on tap.
10. **Name**: bubble "What should I call your kid?", text field
    ("Enter name") with keyboard, caption "We never share or sell any
    information", green "Let's go!" appears once text is entered.
    Confirmed name in this capture: "Daniel".
11. **Learning buddy (video-only)**: bubble "Let Daniel pick a learning
    buddy!", then a swipeable carousel of character cards, one visible
    at a time: **Jack** ("Learning to turn big energy into brave, kind
    action"), **Sparky** ("How things make him happy"), **Tofu** ("He
    loves to share and care"). Each card has a 5-star rating and its own
    "Choose <name>" button.
12. **Stat interstitial, tied to the age just picked (video-only)**: a
    real photo of a toddler with a device, "800K+ 3-year-olds are
    learning with Keiki", green Continue.
13. **Relationship to child (video-only)**: bubble "Who are you to
    Daniel?", radio list: Parent, Grandparent, Relative, Specialist,
    Other.
14. **Acquisition source (video-only)**: bubble "How did you hear about
    Keiki?", list: App Store, Teacher or Therapist, Facebook / Instagram,
    Google search / YouTube, Friend or family recommendation.
15. **First focus (video-only)**: bubble "What would you like Daniel to
    focus on most?", caption "We'll use this to pick Daniel's first
    activities", three icon options: First words & talking, Shapes &
    colors, A bit of everything.
16. **Extra goals, multi-select**: bubble "Choose extra learning goals
    for Daniel", caption "Pick up to 3 extra goals", checklist: Build
    logical skills, Practice basic math, Enhance fine motor skills, Boost
    memory and focus, Strengthen second language, Check my kid's school
    readiness. (This is the montage's goals screen, but on its own
    screen, not merged with age the way the montage implied.)
17. **Desired features (video-only)**: bubble "What would help you and
    Daniel the most?", caption "Select all that apply", icon grid: Skill
    assessments, Interactive games, Printable worksheets, Personalized
    learning plan, Progress tracking, Other.
18. **Daily challenges (video-only)**: bubble "What challenges in
    Daniel's daily routine do you face?", checklist: Speech &
    communication, Textures and emotional outbursts, Sleep and bedtime
    transitions, Short attention span, Nothing specific.
19. **Independent play duration (video-only)**: bubble "How long can
    Daniel play independently?", options: Less than 5 min, 5-10 min,
    10-30 min, 30+ min.
20. **Stat interstitial, dynamically worded around the prior answer
    (video-only)**: "Real independent play starts with Keiki", body
    reads "Daniel's independent play... 82% of parents say they can
    work, rest, or just breathe for up to 60 min while their kids learn
    with Keiki." The stat's framing changes with what was just answered,
    not a fixed screen.
21. **Speech skill level (video-only)**: bubble "What speech skills does
    Daniel have?", checklist: Uses gestures to communicate, Says basic
    words and can name familiar objects, Combines two words into simple
    phrases, Speaks in full sentences.
22. **Homeschooling, binary (video-only)**: bubble "Is Daniel being
    homeschooled?", segmented No/Yes control. Selecting Yes immediately
    reveals a bonus stat banner beneath it: "Homeschoolers using Keiki
    report a 34% increase in curriculum learning" — the reward for a
    Yes appears inline, not as a separate screen.
23. **Credibility interstitial (video-only)**: "Science-backed
    activities", a badge/seal icon, short supporting copy.
24. **Static-only, not seen in the video**: a 3x2 icon grid "What
    activities does your child prefer most?" (Trace, Drawing, Discover
    nature, Count, Read, Puzzle solving) with an "X out of 3" counter.
    Likely the same job as #16 in a different variant, not a screen to
    assume both exist together.

### Permission priming (each with its own bespoke soft-ask before the real dialog)
25. **Notifications**: soft-ask "Get insights about Daniel's progress!",
    "Enable notifications" primary, "Not now" secondary → real OS
    notification dialog.
26. **Microphone**: soft-ask "Let's make speaking fun for Daniel!" with a
    chat-bubble icon, copy "Turn on microphone access to help build
    communication skills. You can change permissions anytime.", "Enable
    microphone access" → real OS microphone dialog ("Keiki uses your
    microphone to enable interactive speech practice through content").
27. **Speech recognition**: same soft-ask screen reused, then a second
    real OS dialog specifically for Speech Recognition ("Speech data
    from this app will be sent to Apple to process your voice
    requests...").
28. **Stat interstitial**: "Screen time you can feel good about", bar
    chart, "Kids stay focused 3x longer and learn 3.5x more with Keiki
    than with other apps", "Start personalization" primary — this is
    the button that actually kicks off the next screen.

### The "Personalizing" screen — one screen, three sequential fills
29. Header "Personalizing Keiki for Daniel...", a small illustrated
    tablet-and-plant icon with the mascot beside it.
    - Row 1 **Goals**: 0→100%, caption cycles through the specific goal
      being woven in, e.g. "Strengthen second language".
    - Row 2 **Picking content**: 0→100%, interrupted mid-fill by a modal
      captioned "To move forward, specify:" asking "Does your kid have
      their own device?" (No/Yes). The bar does not advance while the
      modal is up.
    - Row 3 **Adjusting game difficulty**: 0→100%, interrupted the same
      way by "Does your kid have ADHD?" (No/Yes).
    - Static-montage variant of this same screen shows a green
      checkmark instead of a percentage once a row completes; the video
      shows a small green dot/check icon rather than a full checkmark
      circle — same idea, different render, not worth reconciling
      further.

### Payoff
30. Confetti-dot burst around the mascot, then "Daniel's learning
    journey is ready!" (mascot alone, no chrome).
31. **7-day plan preview (video-only)**: "Let's start the 7-day learning
    plan!", a concrete day-by-day list (Day 1 Trace letters, Day 2 Learn
    numbers, Day 3 Spell words, Day 4 Name colors, Day 5 Follow
    routines, Day 6 Check progress, roughly), "Set up learning" primary.
    This shows the actual curriculum before any account is created.
32. **Account creation**: "Ok, last step! Sign up to track Daniel's
    progress", Email field, Password field (show/hide eye icon),
    checkbox "Send me updates about my kid", green "Start tracking",
    "Have an account? Sign in" link. (Montage's version of this screen
    is headed "Create Account" instead, same fields.)

### Paywall — three screens, not one
33. **Personified trial intro**: mascot holds a small heart, "I'd love
    for Daniel to enjoy Keiki, 7 days free", "No payment due now", "Try
    for $0.00" primary. A native App Store review-request modal
    ("Enjoying Keiki World? Tap a star to rate it") interrupts here once,
    with a "Not Now" dismiss.
34. **Reminder reassurance**: mascot holds a bell, "We'll send you a
    reminder before your free trial ends", same "No payment due now" /
    "Try for $0.00" pairing. The video capture ends holding on this
    screen.
35. **Pricing table**: "Start Daniel's learning now!", a bulleted
    benefit list with icons (learning hours, worksheets library access,
    progress tracking), a plan toggle (1 Week vs. 6 Month, a "SAVE 50%"
    or similar badge on the discounted one), price shown per-week,
    "Cancel anytime, secured with App Store" reassurance line, green
    "Get my 50% off!" primary.
36. **Static-only**: the montage additionally shows a post-trial
    "Trial offer Unlocked! You have 7 days of free full access" confirm
    state with a "Start 7-day Free trial" button, not reached in the
    video excerpt.

## 2. Motion and animation catalog

Described as mechanics (what triggers it, what it looks like), not as
timed specs, per the caveat in §0.

- **Bubble entry**: a speech bubble never simply fades in. It grows from
  a small dot/tail near the mascot's head, tail-first, then expands into
  the full bubble shape. Consistent every time a bubble appears or
  swaps content.
- **Mascot's two modes, one transition between them**: "big, centered,
  no persistent chrome" (intro, success, paywall) versus "small,
  docked top-left, progress bar visible" (every question screen). The
  shrink-and-dock happens exactly once, right after the privacy-promise
  bubble, and reads as the moment the flow "gets down to business". It
  never happens again in reverse until the walk is fully done.
- **Selection feedback**: a tapped chip, card, or checklist row
  highlights (fill or border change) immediately, and the primary
  button (previously muted/disabled-looking) turns solid green the
  instant a valid selection exists.
- **Card carousel (learning buddy)**: one full character card visible
  at a time, swapped by what reads as a swipe, each card its own
  self-contained mini-profile (name, one-line trait, star rating,
  its own "Choose X" CTA) rather than a grid of thumbnails.
- **Progress bar with a named caption**: the "Personalizing" screen's
  bars do not just fill silently. A line of text under the bar names
  the specific input being incorporated, changing as the bar advances,
  so the wait reads as "doing something with what you told me" rather
  than a generic spinner.
- **Modal-interrupts-progress**: twice during the Personalizing screen,
  a small modal drops in over the still-visible progress bar, asks one
  yes/no question captioned "To move forward, specify:", and the bar
  visibly holds until answered. This turns dead loading time into two
  more data points instead of wasting it.
- **Answer-reactive reveal**: answering "Yes" to homeschooling
  immediately reveals a new stat line under the same screen, no
  navigation. Stat interstitials elsewhere are worded around whatever
  was just answered (the age picked, the independent-play duration
  picked) rather than being fixed, generic copy.
- **Permission soft-ask before every real dialog**: notifications,
  microphone, and speech recognition each get a bespoke, on-brand
  screen (mascot illustration matched to the ask, one-line benefit,
  named "why") immediately before the actual OS permission sheet fires.
  Never a bare native prompt with no lead-in.
- **Confetti burst**: a handful of small particle dots appear briefly
  around the mascot at the exact moment the "journey is ready" success
  copy appears, not sustained, not large.

## 3. Principles and concepts to carry forward

These are the reusable ideas, independent of Keiki's specific copy or
palette:

1. **The mascot introduces itself before it asks anything.** Name,
   pitch, privacy promise, in that order, before the first question.
   A greeting that never asks a question yet is not wasted time, it is
   trust-building.
2. **One mascot posture change marks the whole flow's one big gear
   shift.** Big-and-centered means "we're talking", small-and-docked
   means "we're working". Using it exactly once (not per-screen) is
   what makes it legible as a signal rather than decoration.
3. **A progress bar should say what it's doing, not just that it's
   doing something.** Naming the specific input being processed is
   nearly free to implement and meaningfully changes how "personalizing
   Homa for your kid" reads versus a bare percentage.
4. **Dead time is real estate.** A forced wait (personalization,
   permission priming) is the cheapest place to ask one more low-stakes
   question, provided the question is genuinely optional-feeling
   (No/Yes, not required to proceed in spirit even if required in
   practice).
5. **Persuasion beats should be personalized, not templated.** A stat
   screen that restates the exact answer just given ("Daniel's
   independent play...82% of parents...") reads as responsive; a fixed
   stat screen reads as marketing. Cheap to do once the child's name
   and the prior answer are already in state.
6. **Every native permission earns its own ask.** A soft-ask screen
   matched in tone and illustration to what's being requested, every
   single time, never a bare system dialog as the first thing a parent
   sees.
7. **Show the actual product before asking for payment.** The 7-day
   plan preview, naming real days and real activities, lands before
   account creation and well before the paywall. It is evidence, not a
   promise.
8. **The paywall is a sequence, not a screen.** Personified trial offer
   (in the mascot's own voice) → reassurance ("we'll remind you before
   it ends") → the actual pricing table. Splitting reassurance from
   price gives the reassurance room to land before the parent is
   thinking about money.
9. **A carousel of named characters outperforms a settings-style list**
   for anything meant to feel like a companion choice (the learning
   buddy), versus a plain multi-select grid (extra goals). The format
   should match how much the choice is supposed to *feel like* a
   choice versus a checkbox.

## 4. Open questions for the Homa v2 design (not answered here)

- Homa already collects most of this same information (child's name,
  age, interests, "working on") through `kids.tsx`; the open question
  is which of Keiki's *additional* asks (relationship to child,
  acquisition source, daily challenges, homeschooling, desired
  features) Homa actually wants, versus which are Keiki-specific
  (Keiki is a kid-facing game app with a "learning buddy" mascot
  companion; Homa is a parent-facing lesson-generation and
  compliance-tracking tool, so a buddy-picker or an ADHD/homeschooling
  branch may or may not translate).
- Homa's walk currently has no analogous "processing with named
  captions" moment; `making.tsx` is the closest existing screen and is
  a real job-status view, not a cosmetic delay, so the modal-interrupt
  trick would need a genuine reason to interrupt, not a borrowed one.
- None of this changes the `labs/onboarding-v2` isolation plan already
  agreed: this document is reference material for whatever gets built
  there, not a decision to build any specific screen from this list.
