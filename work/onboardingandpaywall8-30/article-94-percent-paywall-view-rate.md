---
source: pasted by Sidney, 2026-08-30, no URL given
kind: article
used_for: reference sequence for native onboarding + paywall v2 spec
---

# The Onboarding Structure Behind a 94% Paywall View Rate (Full Breakdown)

Most onboarding flows lose people before they ever see the offer.

The old version of our onboarding opened with a feature tour — screen after
screen showing off the product before asking a single thing about the user.
It felt like a pitch deck. And it was quietly bleeding people out before
they ever reached the paywall.

We rebuilt it from scratch. Now 94% of users who start onboarding actually
reach the paywall. Here's the exact sequence we landed on, why every screen
is ordered the way it is.

This isn't specific to one app or one niche — the sequence works for any
subscription app where the paywall is the whole point of onboarding.

## The hypothesis we questioned

Our old flow led with features: welcome screen, then three or four "here's
what the app does" screens, then name/questionnaire steps.

The problem: users don't care about your features before they feel
understood. Showing off the product before you've earned any emotional
relevance just adds screens between the user and the moment that actually
matters. Every extra screen before that moment is another chance to bounce.

So we flipped the whole logic. Stop pitching the product first. Start
asking about the user's actual problem first. We built the new flow as a
real A/B variant and ran it in production, not just gut-decided our way
into it.

## The new flow, screen by screen

Here's the actual sequence, in order, with what each screen is doing and
why it's placed there.

0. **Welcome** — Hero screen, "Get Started" CTA, ATT prompt fires here on
   iOS. This is also where the variant gets assigned and tagged as a
   Mixpanel Super Property.
1. **Name** — A friendly, casual framing ("what's your name?"), text field,
   skippable. This is the very first data point we ask for — deliberately.
   Asking for a name before anything else starts the "this is being built
   for me" feeling immediately, and it's low-friction enough that almost
   nobody skips it.
2. **Gender** — Single-select. Quick, low-effort, keeps momentum.
3. **Usage frequency** — Single-select on how often they engage with the
   problem space. This calibrates how the rest of the copy and stats will
   land later.
4. **Referral source** — Where did you hear about us? Single-select across
   the usual channels (App Store, TikTok, Meta, YouTube, friend/family,
   search, X, Instagram, other). Pure attribution insight — doesn't affect
   the user experience, but it's gold for understanding which channels
   actually bring people through onboarding, not just installs.
5. **Goals** — Multi-select on what they want to get out of the app. This
   is the "desire" step — asked before we've shown a single feature. We're
   finding out what job they want done, not showing them what we built.
6. **Favorites / preferences** — An optional multi-select that feeds
   personalization later. This is an investment step — the moment the
   product starts to feel like it's already being built around their
   specific answers, even though nothing's "built" yet.
7. **Social proof** — Reviews / social proof screen, plus the native iOS
   rating prompt fires here. Notice this comes after the investment steps,
   not on screen 2 — trust lands better once someone already feels some
   ownership.
8. **Notifications permission** — We explain the value of reminders before
   asking. Continue works regardless of allow/deny — never block progress
   on a permission.
9. **Pain point 1 — timing** — A statement-style question ("always doing
   this last minute?") with a 4-point frequency scale (very often /
   sometimes / rarely / never). This is where pain amplification starts —
   surfacing the problem in the user's own felt experience, not our copy.
10. **Pain point 2** — Same 4-point scale, different pain point specific to
    the product's core problem.
11. **Pain point 3** — Same structure again. By now we've asked about the
    problem from three different angles.
12. **Pain point 4** — The emotional one — how it makes them feel (stress,
    frustration, whatever fits the niche). Same 4-point scale.
13. **"Personalizing…" moment** — A fake-progress loading screen (~4–5
    seconds) with a checklist of things being "customized" based on
    everything they just answered. This is the "we heard you" beat — it
    closes the loop on the previous four screens and sets up the next two.
14. **Stats screen 1** — A social-proof statistic tied to pain point 1
    (e.g. "X% of people in this situation report Y outcome"), shown with a
    chart or visual. This is proof the pain is real and common — not just
    their problem.
15. **Stats screen 2** — Same format, second pain point, usually a bar
    chart breaking down specifics. This is the last screen before the
    offer — the problem is now maximally salient.
16. **Paywall** — The offer, running through RevenueCat (or your
    subscription infra of choice) as an experiment/offering. Purchase or
    restore leads to your app. Dismissing can route to a win-back/cancel
    offer before letting someone fully leave.

## The logic behind the order

1. Identity first — name + basics → "this is for me," immediately
2. Context — usage frequency calibrates everything that follows
3. Desire before features — ask what they want before showing what you
   built
4. Investment — preference screens make the product feel personalized
   already
5. Trust — social proof placed after investment, not before
6. Permission — ask for notifications once value is already felt
7. Pain amplification — four angles on the same core problem, in their own
   felt terms
8. The "we heard you" moment — personalizing screen closes the loop
9. Proof of pain — stats right before the offer, while the problem is
   fresh
10. The offer — paywall exactly when the problem is most salient
11. Account last — signup only after purchase, never before

## The result

94% of users who begin onboarding now reach the paywall. This onboarding
setup keeps people moving instead of bouncing off a feature tour they never
asked for.

The decision rule we used wasn't "more screen views." It was: which version
gets more users to a meaningful paywall decision, with a healthier purchase
conversion once they're there.

## The lesson

Onboarding isn't a product tour. It's a persuasion sequence.

Every screen before the paywall should do one job: make the user feel
understood, right before you offer to solve the exact problem they just
described. Features can wait. They can wait until after someone's already
paying you to find out.

## The short version

1. Don't lead onboarding with a feature tour — it delays emotional
   relevance and bleeds users before the offer.
2. Order: identity → context → desire → investment → trust → permission →
   pain (multiple angles) → proof → offer → app.
3. A/B test the sequence — don't just guess which order converts better.
4. Result: 94% paywall view rate. Pain-first sequencing gets people to the
   offer instead of losing them before it.
