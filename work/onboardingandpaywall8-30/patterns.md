# Cross-research synthesis: what actually holds up

Consolidates everything in this folder: [`article-94-percent-paywall-view-rate.md`](article-94-percent-paywall-view-rate.md),
[`article-2-onboarding-10x-better.md`](article-2-onboarding-10x-better.md),
[`current-state-audit.md`](current-state-audit.md), [`delta.md`](delta.md),
[`delta-article2.md`](delta-article2.md), [`motion-and-animation-gap.md`](motion-and-animation-gap.md),
and the seven-app research pass in [`research/`](research/) (Duolingo,
MyFitnessPal, Flo, PictureThis, ChatGPT, Facetune, plus a Mobbin cross-check
covering ~15 more flows including real kids/parenting apps).

This is the last research document before spec.md's open sections get
filled in. Read it as: here is what's actually evidenced, here is what
isn't, act accordingly, not as a re-statement of either article's claims.

## The headline finding

**Across 7 deeply-studied apps plus ~15 more sampled via Mobbin: 22+ real
shipped apps, cross-category, including the exact caliber of app the first
article says validates its model, not one runs that article's full,
exact sequence** (identity → context → desire → investment → trust →
permission → four consecutive pain-point frequency-scale screens → one
"personalizing" loader → two stats screens → paywall, account last).

Individual pieces of it show up constantly. The specific 17-screen
assembly, in that order, at that length, does not show up anywhere. This
is not "the article is wrong"; rather, it's evidence the article describes one
app's specific A/B-tested result, generalized into a "works for any
subscription app" claim the research doesn't support. Treat it as a menu
of techniques to evaluate individually, not a template to implement
wholesale.

## Claim-by-claim scorecard

| Article 1 claim | Apps that validate it | Apps that contradict it | Verdict |
| --- | --- | --- | --- |
| Desire/goals before any feature is shown | Duolingo (motivation screen before benefits), MyFitnessPal (goal screen 4, feature tour pushed to screen 20), Facetune (editing-goals screen), Flo (goal selection), ChatGPT (its one preference screen), Uxcel Go, Skillshare | None found | **Strongly validated, broadly convergent.** The single best-supported claim in the whole article. |
| Account creation last, only after purchase | PictureThis (no signup anywhere in the funnel), Flo (anonymous mode, no signup at all) | MyFitnessPal (soft gate at screen 2, hard gate at screen 18-19, both before the paywall), Facetune (full email+OTP before the paywall), ChatGPT (long multi-screen signup, though deferred until needed) | **Split, and category-dependent: see the kids-app finding below, which matters more for Homa specifically than this general split.** |
| Four consecutive pain-point screens on a frequency scale | None | Flo (the closest candidate) uses symptom checklists and emotionally-labeled cards, never a "very often/sometimes/rarely/never" scale, and never four in a clean row | **Not validated by any app studied.** The specific mechanism appears to be this one article's invention, not an observed pattern. |
| A "personalizing…" fake-progress loader right before the paywall | Facetune (one compressed screen, no checklist) | Flo's loader sits two-thirds through its flow, not pre-paywall, and has a real stat baked in rather than being fake/clean; MyFitnessPal has no loader at all, substituting ~6 distributed "education" screens instead | **Weakly present at best, never in the position or form the article describes.** |
| Stats/proof screens immediately pre-paywall | PictureThis (authority stats, but with zero preceding persuasion machinery, a different model entirely); Flo's last screen is a personalized risk summary, which is stats-adjacent | MyFitnessPal's last pre-paywall screen is a real product preview, not stats; ChatGPT has none | **Present in spirit (end on maximum salience) in Flo; absent or substituted elsewhere.** |
| Paywall is a fixed, guaranteed-position endpoint everyone reaches | Duolingo's and ChatGPT's paywalls are ambient, always-reachable upsells, never a checkpoint anyone is forced through; PictureThis and Flo do gate | Mixed: **roughly half the apps studied don't treat the paywall as a forced wall at all.** |
| Dismissing the paywall routes to a win-back offer | MyFitnessPal (25%-off "ENDS SOON" coupon on dismiss) | (none) | **Validated, at least once, concretely.** Worth adopting the pattern (not necessarily the discount-and-urgency framing, which conflicts with Homa's own paywall-claims laws). |

## Correction: the kids-app research was the wrong comparator category

An earlier draft of this document treated GoHenry/Greenlight/Spotify
Kids/Kit as Homa's closest category match, and concluded from their
account-first, no-persuasion pattern that Homa's category might not call
for a persuasion sequence at all. **Sidney corrected this, and it's a real
category error, not a nuance:** those apps' end user is the CHILD. The
parent is only the account administrator who sets up controls so the
child can use the product; she is not the one being sold to, retained,
or emotionally engaged by the app's own design. **Homa's end user and
buyer is the parent.** She is the one who opens the app, makes the
decision to keep paying, and needs to feel the product understands her.
That makes Homa's correct comparator category the **adult-facing
subscription apps** in this research (Duolingo, MyFitnessPal, Flo,
ChatGPT), where a real adult evaluates real value and makes a real
purchase decision inside the flow. That is exactly the category where the
claim-by-claim table above shows persuasion sequencing (goal-before-
features, real proof, default-selected pricing, trial-framed CTAs) is a
genuine, validated convention, not an unproven import.

**Ruled: Homa's v2 onboarding will have a real persuasion sequence.** Not
the reference article's exact 17-screen assembly (still unsupported by any
app studied, see the scorecard above), but a deliberate sequence built
from the techniques this research actually validated, applied to a parent
being sold a family-education subscription rather than a fitness or
language habit.

The kids-app research isn't wasted, though: it remains the best available
model for the one genuinely novel piece of Homa's flow that no adult-
subscription app in this research has to solve: collecting a THIRD
PARTY's (the child's) identity and details inside a flow whose actual
subject and buyer is the parent. Duolingo ABC's short "who's learning →
how old are they → pick an avatar" sequence, embedded inside what is
still fundamentally a parent-facing product decision, is the closest
partial analog found for that specific sub-problem, worth a closer look
for how Homa's `kids` screen sits inside a persuasion-sequence redesign,
not for whether to have one.

## What's genuinely convergent enough to act on

Independent of either article, these showed up repeatedly enough across
unrelated apps to be worth adopting on their own evidence:

1. **Ask what they want before showing what you built.** The single
   most consistently validated pattern across every category studied.
2. **Real functional proof beats fabricated proof.** Duolingo's actual
   playable lesson, ChatGPT's real guest chat with a real streamed
   answer, Flo's real interactive calendar: every one of these
   out-performs a staged stat or mockup as the "does this actually work"
   moment. Homa's own real-worksheet reveal is already this pattern, and
   is arguably the strongest single asset in Homa's current flow (see
   `delta.md` and `delta-article2.md`, and both independently flagged this
   as a keeper, now a third source agrees).
3. **Default-select the annual/best-value tier and label it clearly**
   (Flo's "MOST POPULAR," Facetune's pre-selected annual, PictureThis's
   "Best Deal"/"Best Value"). Cheap, safe, near-universal.
4. **Free-trial-framed CTA copy over price-first copy** ("Try it free,"
   "Try for $0.00") is the dominant convention, not price-forward
   language, consistent across Duolingo, MyFitnessPal, Facetune,
   PictureThis.
5. **A single win-back offer on paywall dismissal** (MyFitnessPal) is a
   real, working mechanism: implement the mechanism, not necessarily
   MyFitnessPal's urgency/discount framing, which sits uncomfortably
   against Homa's own ruled-on paywall-claims constraints.

## What's genuinely NOT supported and shouldn't be ported by default

1. **The rigid four-screen pain-frequency-scale block.** Zero precedent.
2. **A fake "personalizing" loader with an invented checklist.** What
   little precedent exists (Facetune) is thin and compressed; Homa's own
   `making` screen is already a *real* loader (an actual worksheet
   building), which is strictly better evidence-wise than anything found
   in this research; don't regress toward fakery to match a screen
   count.
3. **Manufactured urgency and decoy pricing** (Facetune's weekly-vs-87%-off
   annual anchor). Already ruled out by Homa's own paywall-claims laws
   (see `homa-paywall-claims-laws` memory); the research gives no reason
   to revisit that.
4. **Forcing account creation before any value is shown**, where a
   product's category doesn't require it (MyFitnessPal, Facetune do this
   and it's the article's own named anti-pattern). This is separate from
   Homa's specific case, where SOME identity is structurally required
   early (a worksheet needs a child's name/age/interests), so the real
   question for Homa is narrower: does the *account* (email, auth) need
   to exist before the *first personalization*, or could the child's
   details be captured pre-account the way a guest-mode product would?
   Not resolved by this research; flagged as open below.

## Motion (separate axis, see motion-and-animation-gap.md for full detail)

Every research pass here is fundamentally screenshot-based, and article
2's tip 5 (motion, haptics, satisfying transitions) is real and can't be
assessed from stills. Short version: Appllama's video assets turned out to
be genuine screen recordings (verified on Duolingo's, which is 4.8 minutes
of someone actually playing a lesson), Homa's own `making` screen already
has real Reanimated investment worth extending rather than replacing, and
the one thing only Sidney can supply is 2-3 named apps/moments she
considers AAA-feel so the spec has a concrete target instead of adjectives.
That file's three-track plan (mine existing videos, pull more
deliberately once candidate screens are chosen, name concrete references)
still stands as the plan.

## What this means for spec.md

- **Outcome (§2):** should be framed as building a real persuasion
  sequence for the parent, assembled from the techniques this research
  actually validated (goal-before-features, real proof over fabricated
  proof, default-selected annual pricing, trial-framed CTAs, a win-back
  offer on dismiss), not the reference article's specific 17-screen
  assembly, which no app studied actually runs. This also needs to fix
  the two confirmed structural problems already on record: the wall's
  unpredictable trigger timing (`delta.md`), and the account-first/
  no-value-shown-first mismatch (`delta-article2.md`): a persuasion
  sequence that still front-loads the biggest ask before showing any
  value would just be a better-decorated version of the same problem.
- **Constraints (§4):** carry forward the no-fabricated-proof /
  no-manufactured-urgency laws explicitly; this research surfaced
  real competitor patterns (decoy pricing, discount-badged win-back
  offers) that are tempting-looking but already ruled out.
- **Open questions (§8):** the framing question is resolved (persuasion
  sequence: yes). What's still open is which specific techniques compose
  it, how the child's identity-collection step (`kids` screen) sits
  inside a parent-facing persuasion sequence, and the more granular
  items already listed in `delta.md` and `delta-article2.md`.
