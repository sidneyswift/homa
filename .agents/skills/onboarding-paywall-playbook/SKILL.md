---
name: onboarding-paywall-playbook
description: Growth-engineering playbook for Homa's signup-to-paid funnel, distilled from a Cal AI founder's onboarding/paywall essay and translated to Homa's actual live architecture (the wall + the four-open-subjects report lock, both ON in production since 2026-07-18 with an armed kill test). Use when designing or auditing anything on the path from landing to `billing.trial_started`: onboarding screen order or length, paywall placement or variants, wall/lock copy surfaces (`apps/web/components/billing/`), pricing stickers, trial structure, or reading `/admin/funnels` and prod events to diagnose where the funnel leaks. Also use when someone proposes "make onboarding shorter" or "remove a step" as a default without checking whether the step is actually the problem, and when specifying the NEXT paywall experiment (the kill-test pattern below is the house method). Not for writing the words themselves (see homa-copy-writer) or for statistical A/B test math (see the general ab-test-setup skill): this skill is about funnel shape, sequencing, and experiment discipline.
---

# Onboarding + paywall playbook

Source: a Cal AI founder's essay on why they lengthened onboarding and ran
100+ paywall tests. The essay is written for a consumer iOS app with an
app-store hard paywall; every law below is restated for Homa's shape (a
chat-first web product, Stripe Payment Links, no app store between Homa
and the customer). Where the essay's advice does not transfer, this file
says so explicitly rather than leaving you to guess.

Paywall placement at Homa is **experimental, not settled**. Variants are
decided by measured tests with pre-committed kill criteria, never by
argument or by treating any past placement as permanent.

## Production state (verify before trusting)

As of 2026-07-18 (build-log entry "The wall and the report lock flip ON
in production"):

- `HOMA_WALL_ENABLED=1` live: paid-action doors (plan / month / call /
  chat / report) show the membership offer.
- `HOMA_REPORT_LOCK_ENABLED=1` live: a new family's report renders four
  subjects in full (fixed core: math, literacy, science,
  social-emotional, `packages/core/src/map/report-lock.ts`); every other
  mapped subject is held (name + the parent's own answer count, no blur)
  behind one inline $19/mo offer card.
- Pricing live: **$19 monthly only.** The annual link is deliberately
  withheld (the $99 sticker collides exactly with Homeschool Fox's
  annual price; needs a founder read before it ships).
- Existing pre-flip families were grandfathered via `billing_exempt`
  backfill (47 families, 2026-07-18T14:25:44Z). New signups meet the
  lock.
- Ruling `report-lock-four-open` (dated source
  `docs/homa-planning/plans/2026-07-18-report-lock.md`) explicitly
  superseded the earlier "the progress report remains free" placement
  from `plans/2026-07-11-the-wall.md` for walled families. Do not cite
  "the report is free forever" as current policy; it describes the
  pre-07-18 era and the grandfathered cohort only.

Flags flip and experiments end. Before advising on placement, confirm
the current flag state (Vercel env or a live probe) and check
`docs/homa-planning/build-log.md` for entries newer than this file.

## The live experiment and its kill test

The report lock IS the essay's "harder paywall" hypothesis running in
production, and it shipped the essay's way: as a measured test, not a
belief. From the flip entry, window 2026-07-18 to 2026-08-01, scored on
new claimed (non-sandbox) families only:

- **Kill** if trials per report-reached family < 10%, or report-reached
  → `materials.created` < 28% inside the lock cohort.
- **Earned** if ≥ 25% of report-reached new families start trials AND
  trial families create/keep at or above pre-lock rates.

The founder accepted the activation risk on the record because the
verified funnel collapse sits AFTER the report (prod pull 2026-07-16: 29
report, 8 created, 3 kept, 0 trials), so the lock stands upstream of the
break it is trying to fix. Flipping or keeping the lock without recording
the kill-test outcome is a process violation named in the plan itself.

**This kill-test pattern is the house method for every future paywall
variant:** variant defined precisely, thresholds pre-committed in a dated
plan doc under `docs/homa-planning/plans/`, cohort named (who is exempt,
who is scored), instrumentation reused not reinvented, and a decision
date. A placement change shipped without those is a rewrite wearing an
experiment's name.

## The order-of-operations law, translated

Essay: build the paywall first, onboarding second, in-app polish third,
because payment is the only honest signal.

Homa followed this shape: the wall shipped dark and instrumented
(`report.action_tapped`) before it flipped, so demand data exists from
the free era. Apply the same discipline forward:

1. When adding a new door or paid capability, instrument the tap event
   and ship it dark before touching conversion copy. Measure intent to
   act before you gate the action.
2. Don't invest in polishing free-tier experience ahead of the paywall
   evidence. While the kill test runs, its two metrics (trial rate,
   create/keep rate) outrank any unmeasured polish argument.

## Friction: an asset at the door, a liability before the demo

The essay's sharpest idea, and Homa's own data confirms it. The
2026-07-20 funnel audit (`plans/2026-07-20-onboarding-funnel-drip.md`)
found the exact predicted failure:

> Cliff 2, account to family setup: 23% loss... They created an account,
> saw the family step (name + full address + phone before any value), and
> left.

Friction demanded before the demo (the report) is a pure liability. The
checklist, by contrast, converts at ~95% per step: friction placed after
the promise, doing personalization work, exactly where the essay says
friction pays for itself.

**The test for any new onboarding field or step**: it must do at least
one of these:

- Personalize what the parent is about to see (a checklist answer, a
  kid's age)
- Deepen investment *after* a moment of shown value (not before one)
- Connect the parent's specific worry to what Homa is about to do

If a step fails all three, it is Cliff-2-shaped friction. Move it after
the report renders, or cut it, regardless of how "standard" it looks on
a signup form.

## Pain-matched onboarding length, applied to Homa

Essay: short onboarding for low-pain utility apps, long onboarding for
high-pain apps (something the user has already failed at).

Homa's parents are the high-pain case: "is my kid falling behind and is
it my fault," usually after a prior curriculum or school attempt that
didn't work. That argues for the longer, pain-agitating, personalizing
onboarding, not a race to minimum viable signup. Reasoning, not
assertion: cutting personalization steps trades away the exact mechanism
(agitate the pain, connect it to the report) that converts high-pain
users, in exchange for reducing a top-of-funnel loss the audit calls "an
upper bound on real-parent loss ... unfenceable" (bots and idle opens are
inside it). Shortening should target *identified* before-value friction,
never step count in general.

## The sequence skeleton, translated

| Essay's screen | Homa's equivalent | Notes |
|---|---|---|
| Promise screen | Landing CTA + pre-warmed welcome (2 copy-gated lines, instant) | The promise is the report itself |
| Demo (magic moment, <10s) | The report reveal, four subjects in full | This is Homa's demo. Anything that delays reaching it (address, phone before value) fights this beat |
| Questions (personalize + invest) | The checklist (~5 min/kid) | ~95%/step because it sits after the promise, before the demo pays off. The lock depends on this investment: held rows show the parent's own answer count |
| Progress you can feel | Checklist step indicators; credit/allowance visibility (chat-first plan §7) | Keep new steps inside a visible, finite counter |
| Mid-flow review ask | Not built | If added, time it right after the report reveal, never before |
| Personalized plan reveal | The report + note from Homa + the four open subjects | The lock's held rows make "leaving means abandoning THEIR report" literal |
| Paywall | The report lock's inline offer card, plus the wall at the action doors | Current live variant; placement stays testable per the kill-test pattern |
| Post-paywall onboarding | `?welcome=1` first-subject chooser after checkout confirm | The unlock is an onboarding moment, not just a receipt (ruling: one default next step, because the five-way choice after the report was the verified funnel break) |

The chat-first onboarding plan's aha catalog (Tier 1/2, D-series
in-session, F-series at-paywall moments) is Homa's own sequencing of
delight before the ask: read
`docs/homa-planning/plans/2026-07-21-chat-first-onboarding.md` §4 before
inventing new beats.

## Free trials

Essay: don't lean on trials until people pay outright; long trials
pollute paid-acquisition attribution; most trial cancellations decide on
day one.

Homa's live trial is **card-upfront, 30 days, via the Stripe Payment
Link** (`trial_period_days=30` on the live monthly link, verified via
Stripe API 2026-07-18). Card-upfront matches the essay's preference. Two
standing cautions:

- A no-card trial is a different experiment, not a tweak. If proposed,
  it needs its own kill-test spec; never bundle it with a placement test
  (two variables, unreadable result).
- The trial length interacts with the week-4 retest email (proof lands
  right before the first charge). Resizing the trial silently breaks
  that sequencing; treat trial length as coupled to the retention arc.

## Funnel benchmarks, translated to Homa's stages

The essay's three weekly diagnostics map to Homa's event names:

| Essay benchmark | Homa's stage | Where to read it |
|---|---|---|
| View → download (positioning problem if low) | Landing → `map.started` | `/admin/funnels`, landing analytics |
| Paywall-reach rate (onboarding problem if low) | `map.started` → `map.report_viewed` | `/admin/funnels` step funnel |
| Paywall conversion (offer problem if low) | report-reached → `wall.viewed` → `wall.checkout_started` → `billing.trial_started` | Live now; events in `packages/core/src/events.ts` (`WALL_DOORS`, five wall events, door "report") |

**Never invent Homa's current numbers.** Known snapshots (07-16 funnel
pull, 07-20 audit) are dated the moment you read them. Pull fresh numbers
from `/admin/funnels` (founder console) or a direct prod query before
diagnosing anything, and remember the kill-test denominators: new claimed
non-sandbox families only, grandfathered cohort excluded.

## Pricing

- "Price for mindshare over margin": live sticker is $19/mo, no lifetime
  SKU, no annual yet. The $99/yr sticker is parked on the Homeschool Fox
  collision until a founder read; don't ship the annual link as a side
  effect of other work.
- "Anchor the annual, 2-3 options max": applies the day annual ships.
  The wall/lock offer components (`wall-offer.tsx`,
  `report-lock-offer.tsx`) already treat annual as optional; keep 2-3
  options and annual visually primary when it lands.
- "Mind the cash-flow gap" (CAC paid today, subscription collected over
  months) is founder/finance territory. Flag it in the plan doc when a
  pricing or trial-length change moves the CAC-to-first-charge gap;
  never resize the trial silently.
- Parent-facing surfaces say "report" or "progress," never "map"
  (ruling `paywall-naming-and-price`). Code identifiers are unaffected.

## What does not transfer, and why

- **App-store cuts / web2app.** Homa is already a web product on Stripe;
  the essay's "own your channel" state is Homa's default. Only relevant
  if the mobile app ships its own IAP path later.
- **Apple/Google paywall rules** (trial toggles, rating-prompt timing)
  don't govern a web wall. Ignore for the web funnel; they matter only
  for a native mobile purchase flow.
- **"Never bring up payment over text."** SMS is unwalled by standing
  ruling; a walled family can still text Homa. Paywall experiments never
  extend onto SMS.

## How to use this skill

**Audit mode** ("is our funnel healthy," "how is the lock doing"):

1. Confirm flag state and check the build-log for anything newer than
   this file.
2. Pull current numbers (fresh, not remembered), scored on the right
   cohort (new claimed non-sandbox; grandfathered excluded).
3. If the kill-test window is open, score against its pre-committed
   thresholds first; everything else is secondary.
4. For the weakest stage, apply the friction test before proposing a
   fix, and name which of the three friction conditions the failing step
   violates.
5. Non-trivial findings become a dated plan doc under
   `docs/homa-planning/plans/`. A confirmed live production bug follows
   `prod-bugs-fixed-not-stored` instead: fix it in the same session.

**Design mode** ("add a step," "new paywall variant," "change the offer"):

1. Place the beat against the sequence table relative to the demo (the
   report reveal).
2. Run the three-condition friction test on any new blocking field or
   screen.
3. A placement or offer change is a variant: spec it with the kill-test
   pattern (variant, cohort, thresholds, decision date, reused events)
   in a dated plan doc before code.
4. Check "what does not transfer" before importing an app-store-flavored
   assumption.
5. Route the actual words through `homa-copy-writer` and its gates; this
   skill governs shape and placement, not sentences.

## Anti-patterns

- Citing "the report is free forever" as current policy (superseded
  2026-07-18 for new families), or citing the lock as permanent (it is
  inside an armed kill test).
- Shipping a paywall-placement change to live traffic without
  pre-committed thresholds, a named cohort, and a plan doc.
- Bundling a trial-structure change with a placement change in one
  experiment.
- Citing the essay's RevenueCat industry percentages as if they were
  Homa's numbers, or citing any dated snapshot as current without
  re-pulling it.
- Cutting a personalizing step to shorten onboarding without checking
  whether it's before-value friction (bad, cut it) or after-value
  investment (working, keep it).
- Scoring paywall metrics on a denominator that includes sandbox or
  grandfathered families.
- Extending any paywall experiment onto SMS, or shipping the annual link
  before the Homeschool Fox collision gets its founder read.

## Done looks like

An onboarding or paywall change that names which stage it targets, cites
fresh funnel evidence scored on the right cohort, ships as a spec'd
variant with pre-committed kill criteria rather than a silent
replacement, and places new friction after a shown moment of value
unless that assumption is itself what the variant is testing.
