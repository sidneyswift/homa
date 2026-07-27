# The report lock's offer card: what's actually blocking conversion, and what isn't

Status: PROPOSAL, D1 open (founder), tracked as issue #194. Written
after pulling live paywall numbers via direct prod query and reading the
actual offer components (not assumed from the 2026-07-11/07-18 docs).

**Read the numbers with a date on them (added 2026-07-27).** This was
written on day 7 of the 14-day kill test and recommends acting "this
week"; the window closes 2026-08-01. Two changes have since landed
underneath its funnel read: the signup paywall (card upfront at account
creation) and `1cd20d76`, which shortened the trial from 30 days to 7.
The day-7 report-lock funnel it measured is therefore not the funnel
running today. The two findings that do NOT depend on those numbers, and
are the reason this is worth keeping, are the correction that this is not
a copy problem and the discovery of a dormant "Homa Plus" tier.

## What prompted this

The report lock (`docs/homa-planning/plans/2026-07-18-report-lock.md`)
has been live since 2026-07-18, with a kill test armed through
2026-08-01: kill if trials-per-report-reached < 10% or
report-reached→materials.created < 28%.

Live read, 2026-07-25 (day 7 of 14), new claimed non-sandbox families:

| Metric | Value |
|---|---|
| New claimed families | 7 |
| Reached a report (met the lock) | 6 |
| `wall.viewed` | 4 |
| `wall.checkout_started` | 0 |
| `billing.trial_started` | 0 |

Both kill-test metrics are at 0% against 10%/28% floors. n=6 is small,
but the trend needs an honest look now, not just at the 08-01 deadline.

## First pass was wrong: it isn't a copy problem

My initial read (from the essay's benchmarks alone, before reading the
actual components) guessed generic offer copy was suppressing
conversion. Reading `apps/web/components/billing/wall-copy.ts` and
`report-lock-offer.tsx` directly disproves that:

- `reportLockReadyLine` names the child and the exact subject count.
- `reportLockHeldLine` names what's open vs. held in the family's own
  numbers.
- `reportLockRowLine` shows the parent's own answer count per held
  subject ("You answered 6 questions about science").
- Both copy gates (reader, editor) already ran on this surface
  2026-07-11, recorded in the file header.

**No copy change is proposed here.** Don't re-litigate copy that's
already personalized and gated; that would be busywork wearing a fix's
name.

## What's actually different from the essay's recommended shape

The essay's paywall skeleton: 2-3 priced options, annual anchored. The
live offer card renders **one option** (`WALL_MONTHLY_BUTTON`, $19/mo)
because `checkout.annualUrl` is null: `NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ANNUAL_URL`
is unset in production, by deliberate 2026-07-18 founder ruling: the
$99/yr sticker collides exactly with Homeschool Fox's annual price and
was withheld pending a founder read (`report-lock-four-open` ruling,
point 4).

That ruling is still open. **This document does not pick a number.**
Inventing a price to unblock a demo would repeat exactly the mistake the
existing ruling was written to prevent.

### D1 (founder): the annual sticker

Options on the table, for the founder to pick from or override:

1. Keep $99/yr and accept the exact-price collision with Homeschool Fox.
2. Move it (e.g. $89 or $109) to clear the collision while keeping "the
   year costs less than 6 months" as the pitch.
3. Ship monthy-only through this kill-test window and revisit annual
   after 08-01, so the current test isn't confounded by a mid-window
   pricing change.

Whichever is chosen, the code path is already built: `wall.ts`'s
`paymentLinkBases()` treats annual as optional and both offer components
(`wall-offer.tsx`, `report-lock-offer.tsx`) already render the second
button and the `$X/mo` math bullet whenever `annualUrl` is present. The
entire remaining work is: create the Payment Link in Stripe at the
chosen price, set the env var, redeploy. No component change needed.

## Also found, not proposed as urgent: a fully dormant second tier

`NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_MONTHLY_URL` /
`..._PLUS_ANNUAL_URL` exist in `.env.local` and Stripe (build-log
2026-07-06: "Homa Plus", $49/mo or $249/yr) but **nothing in the
codebase reads them.** No UI, no wall integration, no plan reference
beyond the original pricing entry. This isn't a launch blocker and isn't
part of the current kill test, flagging it here only so it doesn't
surface later as a surprise "wait, we already have a Plus price?" Not
actioned in this document.

## What this document is NOT proposing

- Not proposing to remove or change the report lock's placement (that's
  the thing already under test).
- Not proposing new offer copy (already personalized and gated).
- Not proposing to build the Plus tier.
- Not proposing to extend or shorten the kill-test window; 2026-08-01
  stands.

## Recommendation

Given n=6 and 0 conversions at day 7 of a 14-day window, the honest read
is: too early to call, and the single biggest lever left within the
window is D1 (ship the annual anchor). Everything else about the offer
(placement, personalization, mechanics copy) already matches the
essay's playbook. If D1 ships this week, the remainder of the window
becomes a fairer read of the lock concept; if it doesn't, the 08-01
score should be read as "monthly-only, no anchor" rather than as a
verdict on the report-lock idea itself.
