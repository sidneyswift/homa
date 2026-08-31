---
source: pasted by Sidney in chat, 2026-08-30, illustrating article-2-onboarding-10x-better.md
kind: screenshot descriptions (NOT saved as image files, see note below)
---

# Screenshots pasted alongside article 2

**Tooling limitation, stated plainly:** I can see and analyze images pasted
directly into chat, but I have no tool that exports a pasted image's actual
pixels to a file on disk; there is no local temp file the harness hands me
a path to, and Write only accepts text content. So this file is a detailed
written description of what's in each screenshot, not the images
themselves. If the literal files matter later (e.g. for a designer to trace
exact spacing/color), Sidney would need to drop them into this folder
directly (Finder drag, or a file-attachment channel if the client supports
one) rather than pasting them into chat.

## Screenshot 1: unnamed weight-loss/GLP-1 telehealth app onboarding (kree8.studio, illustrating tip 1: "define the activation moment")

A 2×5 grid of 10 screens, dark UI with an orange accent and a top progress
bar reading "1/16" on most of them:

1. **How do you identify yourself?**: Male / Female / Other / Prefer not
   to say, single-select (Male shown selected).
2. **When is your birthday?**: date-wheel picker, "You must be 18 or
   older to join the program," result stated large and bold below the
   picker: "26 yo."
3. **What's your ethnicity?**: multi-select list (Hispanic/Latino,
   Middle Eastern, Pacific Islander, South Asian, Southeast Asian,
   White/Caucasian, Other), two options shown selected.
4. **Medical Conditions**: "Mention any medical conditions you have
   right now," checklist (Diabetes, Hypertension, Depression/Anxiety
   ✓, Sleep Apnea ✓, GERD) plus a free-text "Others" field.
5. **Current Medications**: "Any medications you are taking right
   now," an "Add Medication +" button, otherwise empty.
6. **Health Screening**: "These questions help determine eligibility
   and safe treatment," a list of collapsed dropdowns (Diabetes,
   Hypertension, High Cholesterol, PCOS, Sleep Apnea, Family History).
7. **Safety Check**: "Your answers help ensure safe medication
   prescribing," a single yes/no question shown mid-swipe: "1/3 Have
   you ever been diagnosed with gastroparesis?"
8. **Focus Area**: same subtitle as Safety Check (looks like a
   copy-paste artifact in this mockup), single-select list (Exercise,
   Nutrition, Sleep, Stress, Habits, Meal Planning).
9. **Set Your Weight Goal**: "Build a clear, achievable plan for your
   health mission," two scroll-wheel weight pickers (current / target)
   and a "Target Date" dropdown ("1 week"), with a green inline
   reassurance banner: "This rate is safe and achievable."
10. **Day 0 Achievement**: a full-bleed orange gradient screen, a large
    hexagonal badge with a lightning-bolt icon, headline "Day 0
    Achievement," subtext "Awarded for completing the onboarding
    experience," CTA "Start My Mission."

**Read:** this is a medical-intake-heavy onboarding (the kind regulatory
stakes actually justify asking sensitive questions before showing value),
and it still ends the walk with a literal game-style achievement badge
unlock rather than a plain "you're set" screen, treating onboarding
completion itself as the first reward, before the user has done anything
else in the app.

## Screenshot 2: "Regen App" (kree8.studio, illustrating tip 2: "show value before asking for effort")

Dark near-black/maroon full-bleed screen, top progress bar roughly 15%
filled, back arrow top-left. Headline: "Good photos make you a lot more
attractive than you think." Below it, a line chart on a dark card: x-axis
"Low-quality profile" → "High-quality profile," a curve that stays flat
then rises steeply, with two small stacked photo thumbnails at the low
point and two more polished photo thumbnails at the high point. Below the
chart, a highlighted stat line: "Better photos increases men's ratings by
**3 points** on average (on a scale out of 10)." Orange pill CTA:
"Continue >".

**Read:** this is close to a textbook version of article 1's "stats screen
tied to a pain point": a population statistic, visualized as a curve, with
the specific number bolded, shown before any account creation or payment
ask.

## Screenshot 3: "Regen App," next screen in the same flow

Same dark theme, progress bar now ~75% filled. Headline: "What's a good
photo worth to you?" Subhead, bolded: "Better matches on dating apps."
Below it, a mocked-up phone-within-phone showing a dating-app conversation:
a photo of a man smiling on the phone, a green heart badge reading "11"
labeled "More right swipes," and two overlaid chat bubbles reading "Is
that you in the picture 💙" and "You looking so damn hott!! 💙💙💙". Orange
"Continue >" CTA.

**Read:** this is the emotional/outcome version of the same beat: instead
of a bare stat, it visualizes the lived result (a flattering match
conversation), which is a stronger, more personal proof mechanic than a
population percentage alone. Article 1 recommended stats; this screen
recommends showing the felt outcome the stat implies.

## Screenshot 4: "Walkify" (kree8.studio, illustrating tip 4: "one clear action per screen," though it's also the strongest example of tip 7)

Light theme, full-bleed white/light-gray. A card headlined "Congratulations!
You did it! Here's a little reward for your achievement," a party-popper
icon, a dashed ticket-stub divider, then "Coupon: Spotify Music - Total:
20% Off" with the Spotify logo. Below the card, carousel dots (position 2
of what looks like 3), then a headline "Walk, Earn, Enjoy" with subtext
"With Walkify, your steps earn real money, gift cards, and coupons." A
blue gradient "Log in" button, and below it, small text "Don't have an
account? Sign up." Decorative floating emoji (😍, dollar coins, 🔥) are
scattered around the card as ambient motion cues (implying a floating/
parallax animation on this screen, not stillness; see the motion note
below).

**Read:** this is the single most relevant screen in this batch for our
open account-timing question. Walkify shows a concrete, already-earned
reward (a real coupon) BEFORE asking for login/signup; account creation
is the very last step, and it's motivated by "log in to claim this,"
not a bare form. This is a working example of what article 1's "account
last" rule looks like in an actual screen, and it directly answers one of
delta.md's open questions: a reward-then-authenticate order is achievable
even for an app that, like Homa, needs an account to do anything real.
