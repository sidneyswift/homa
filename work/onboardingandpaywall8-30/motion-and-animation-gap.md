# The motion problem: what static research can't show, and what to do about it

Sidney's flag (2026-08-30): motion, animation, and playfulness are called
out explicitly by article 2's tip 5, and are a real perceived-quality
signal for our ICP (homeschool millennial moms judge app trustworthiness
and "is this a real, well-made product" partly through polish and delight,
not just through what a screen says). Every research artifact in this
folder so far (every Appllama screenshot, every Mobbin still, the four
screenshots Sidney pasted) is a static frame. None of them can show
whether a transition is satisfying, whether a chip selection has spring
physics or just snaps, whether a loading screen breathes or freezes. This
file is the honest accounting of that gap and a concrete plan, not just a
flag.

## What we already have that ISN'T static (more than it first looks like)

Every single app-research pass in this folder returned at least one
`"kind": "video"` screen from Appllama and downloaded it as a real `.mp4`:

- Duolingo: `research/language-learning-duolingo/img/01_welcome_video.mp4`
- MyFitnessPal, Flo, PictureThis, ChatGPT, Facetune: each has 1-2 video
  files in their respective `img/` folders (confirmed present, not yet
  individually reviewed below; see follow-up plan).

**Correction to my own assumption, checked just now:** I expected
Duolingo's video to be a short looping hero animation. It's actually a
**4.8-minute real screen recording of someone playing an actual Duolingo
lesson**, verified by extracting frames with `ffmpeg` (available locally)
and looking at them directly: a live "COMBO x8" streak counter, a
"Tap what you hear" exercise with audio-icon buttons, a green "Great!"
success banner sliding up. That means Appllama's video assets are, at
least sometimes, genuine captured interaction footage, not marketing
loops: exactly the kind of motion evidence article 2's tip 5 is about.
Sampled frames (1 every 30s, 10 frames, 660KB) are saved at
`research/language-learning-duolingo/img/frames/` as a worked example of
the extraction technique below.

**I still cannot "watch" a video the way a person does**: the Read tool
shows me still images, not motion. Frame extraction lets me see *state
changes* (before/after a transition) but not the *feel* of the motion
itself (easing curve, spring bounce, timing). That distinction matters:
frames can tell us Duolingo shows a success banner; they cannot tell us
whether that banner springs in or fades in, or how satisfying it feels.

## What Homa itself already has (a real, running baseline, not a screenshot problem)

Unlike competitor apps, Homa's own onboarding motion isn't locked behind a
static image; it's real code we can run. `making-show.tsx` already has
genuine Reanimated investment: the easel sheet "breathes" on a sine-wave
loop, ink dots hop in a staggered sequence to signal live drawing, fact
chips drop in with real spring physics
(`withSpring(1, { damping: 13, stiffness: 90 })`), and a tap fires a
decorative spark that arcs to the easel. That is a real, running, feelable
answer to article 2's tip 5, just currently concentrated in one screen
(`making`) while `intent`, `kids`, and `you` are comparatively flat (plain
screen replacement, static chip grids, no equivalent motion budget). This
was already noted in `delta-article2.md`; repeating it here because it's
directly relevant: **we don't need to invent Homa's motion language from
zero, we need to extend an existing one and can verify it by actually
running the app**, not by describing it in prose.

## The plan: three tracks, not one

**Track 1: mine what we already downloaded.** Before pulling anything
new, check every existing `img/*.mp4` across all six research folders:
extract a handful of sampled frames per video (the Duolingo technique
above), note what interaction each one actually shows, and flag which
apps have genuine motion-relevant footage vs. static marketing loops.
Cheap (zero new API credits, ffmpeg is free), and might already answer
more than expected.

**Track 2: pull motion deliberately, not incidentally, for anything
Track 1 misses.** Both `list_app_screens` (Appllama) and `search_flows`
(Mobbin) can be re-queried for video-kind assets specifically. Worth a
second, narrow pass once the spec's actual candidate screens are chosen
(no need to do this for all six apps broadly; better spent on the 1-2
apps whose *sequence* we end up wanting to emulate).

**Track 3: name concrete targets instead of chasing "delightful" as an
adjective.** This is the one only Sidney can do: name 2-3 specific apps
(or even specific moments: "the way Cash App's confetti feels," "how
Arc's tab switch feels") that she personally considers AAA-feel, so the
spec can point at a real, nameable reference instead of vague adjectives
like "delightful" or "premium" that every spec claims and none defines.
The `appllama-app-design-skill` (installed, see prior message) is built
exactly for this handoff: study 20-30 real screens of a named app before
implementing anything, extract the pattern not the pixels.

## What this means for the spec itself

Per the spec-goals framework's own discipline (outcome must be verified by
real evidence, not adjectives): the eventual spec's verification surface
for motion cannot be "reads as premium" in prose. It should require an
actual device-verified, screen-recorded walkthrough of the shipped
onboarding, held up against named reference moments agreed on with
Sidney, the same standard as everything else in this spec, evidence over
description. This is a decision for the spec's own Verification Surface
section (spec.md §3), not fully resolved here; flagging it as a hard
requirement to carry forward, not leaving it as a vague aspiration.
