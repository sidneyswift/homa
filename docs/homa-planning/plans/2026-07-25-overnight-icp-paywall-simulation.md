# Overnight simulated-ICP paywall research: 12 rounds, never hit 5/5

Status: RESEARCH COMPLETE, ships zero live pricing/copy changes on its own.
Run overnight 2026-07-25 while the founder slept, per explicit instruction to
run a Workflow-based simulated-ICP loop against onboarding/paywall variants
until 5/5 personas "bought." **That goal was not reached.** Baseline was 0/5;
the best any single round achieved anywhere in 12 rounds was 2/5, and it did
not hold up under its own follow-on iteration. This document reports that
honestly, says what's safe to build on it, what still needs a founder call,
and connects two real findings this research surfaced to concrete work
already shipped or scoped tonight.

Full round-by-round transcript (all 65 persona verdicts, verbatim):
[`2026-07-25-overnight-icp-paywall-simulation-transcript.md`](2026-07-25-overnight-icp-paywall-simulation-transcript.md).

## Method, and its honest limits

Five personas from Homa's own customer research
(`docs/homa-planning/journeys/01-personas-jtbd.md`, P1 Alessa, P2 Rachel, P3
Danielle, P4 Monica, P5 Jess), each simulated by an independent subagent
instructed to be skeptical by default and to only report "would buy" if the
exact described page would get their card out right now. A baseline round
(the live product, read directly from source, not from memory) ran first,
then a 7-way single-axis sweep, then up to 7 rounds of iteration on the
best-performing variant, then a synthesis pass. Stopping was structural
(round cap, or no improvement for 3 rounds), never a model's opinion that
things had "converged."

**This is not a customer study.** No real payment happened anywhere. n=5
per round cannot distinguish signal from noise, and the same axis produced
different results round to round in ways not fully explained by the
described change (P3 bought in round 8, then did not buy in round 9 against
a richer, not weaker, page). Read every number below as "what a panel of
grounded personas argued out loud," not as a conversion-rate prediction.

## The headline result

| Stage | Buy rate |
|---|---|
| Baseline (live product as it exists today) | 0/5 |
| Best of 7 sweep variants (pricing, paywall moment, copy framing, context capture, mechanics framing, sequence) | 0/5 |
| Best of 4 iteration rounds | **2/5** (round 8, adding a real per-child proof artifact) |
| Rounds 9-11 (extending the same idea further) | 1/5, then 0/5, then 0/5 |
| **Final** | **0/5. The 5/5 goal was not reached.** |

The single biggest, cleanest finding: **price was never the blocker for 4 of
5 personas.** Two full rounds tested an annual option at $89/yr and $109/yr
(simulated only, no live Stripe change). Zero personas moved on either.
Every persona who didn't buy for price-adjacent reasons was actually
objecting to something else (evidence, trust, or a real missing capability)
wearing a price complaint's clothes.

## What actually moved the needle, and why it didn't hold

Round 8 added one thing: a real, per-child worksheet thumbnail generated
from the child's own already-scored checklist answers (via the existing
materials-studio pipeline, not a mockup), shown between the free open
subjects and the offer card. Two of five personas (P3 Danielle, P5 Jess)
bought. Their own words:

> P3: "Okay wait, that's an actual worksheet, with her actual math on it,
> not some stock photo... fine, I believe you, I'll start the free days."

> P5: "I braced for the fake-screenshot thing every app does, tapped it
> anyway, and it actually had my kid's name and her actual level on it...
> fine, here's my card, I'm doing the monthly one though."

This is the clearest confirmation in the whole run of the pattern already
visible in real production data: the Cliff-2 finding from
`2026-07-20-onboarding-funnel-drip.md` was friction demanded *before* value;
round 8 is the mirror image, a card demanded before *proof*, and giving one
concrete, verifiable artifact (not more persuasive copy) is what closed it
for two personas who'd been unmoved by seven prior rounds of copy and price
changes.

**Then it reversed.** Round 9 added a second artifact (a weekly-plan
preview): P3 flipped back to no, citing cancellation-mechanics anxiety the
first artifact had outweighed for one session but the second didn't. Round
10 extended both artifacts to every child in the family (a real, valid fix
for P2's and P5's stated multi-kid doubt): 0/5. Round 11 made the
proof captions more specific: 0/5. **Stacking more of the same kind of
proof did not reliably stack more conversions in this simulation.** Treat
round 8 as the most interesting single data point in the whole run, not as
a proven lever — the synthesis agent's own words: "this reversal means the
round-8 'win' cannot be trusted as a stable, reproducible lift... without a
real, properly powered A/B test on live families."

## A correction to my own research setup

Nearly every persona, in nearly every round, said some version of "the
'adding children never changes the price' reassurance only shows up on the
annual plan, which isn't even live." **That line in my baseline description
was wrong.** I re-read the actual code after the run finished:

```
{(checkout.annualUrl ? WALL_BULLETS : WALL_BULLETS.slice(1)).map(...)}
```

`WALL_BULLETS.slice(1)` — used whenever there's no annual link, which is the
live state today — still includes `"Adding children never changes the
price."` and `"Cancel anytime."` Only the annual-math bullet
(`"The year works out to $X a month."`) is hidden without annual. **The live
product already shows the multi-kid reassurance by default; I told the
simulation it didn't.**

What survives this correction: the reassurance sentence, even where it's
genuinely present, sits in a small bullet list at the bottom of the card,
after the button, easy to miss on a tired phone scroll. P2's repeated ask
("put it at the top, in plain numbers, not buried in bullet three") is still
a legitimate, low-risk copy/layout suggestion. What doesn't survive: any
claim that the line is "missing" or "annual-only" in the live product. I'm
flagging this prominently because shipping a "fix" for a bug that only
existed in my own prompt would have been exactly the kind of unverified
claim this whole research method is supposed to avoid.

## The most valuable thing this research found: a real, live, confirmed gap

Independent of any specific round's buy count, one objection recurred
across nearly every round from two different personas (P1, P3): the
cancellation mechanics on the offer card ("you get an email before the
first charge") are vague, and given each persona's own history of
forgotten/hard-to-cancel subscriptions, that vagueness reads as a trap.

Chasing that down against the real code, not the simulation, found
something worse than vague copy: **there was no self-serve cancellation
mechanism in the product at all.** No Stripe billing portal, no cancel
route, nothing — a family's only path to cancel was asking the founder to
do it by hand in the Stripe dashboard. "Cancel anytime." has been on the
live offer card since the wall shipped, unfulfillable by the customer,
since day one.

**This is fixed and shipped tonight**, independent of this doc:
[PR #154](https://github.com/sidneyswift/homa/pull/154) — a live Stripe
billing portal configuration (created fresh, none existed) plus
`GET /api/billing/portal` plus a "Manage billing" link in settings, gated
to families who actually have a Stripe customer id. Zero real families
were affected (all 192 rows in prod have `stripe_customer_id = null`,
confirmed by direct query), but it would have landed on the first real
subscriber, and shipping more persuasive paywall copy while an existing
claim was false would have been the wrong order of operations. This is the
single highest-value thing that came out of tonight's work, and the
simulation is what pointed at it — not because the simulation is a proof of
customer behavior, but because it kept independently surfacing the same
real objection until it was worth checking against the actual code.

## Recurring objections across the whole run (the durable signal)

Unlike any single round's buy count, an objection repeated by the same
persona across many *different* variants is a stronger signal, because it
survived every attempted fix on other axes:

| Objection | Who, how often | Status |
|---|---|---|
| Cancellation mechanics vague / no visible mechanism | P1, P3, nearly every round | **Fixed tonight, PR #154** |
| Card required before any real, verifiable proof is shown | P1, P2, P3, P5, rounds 0-7; partially answered round 8+ | Partially addressed; see "safe to build next" |
| "Does $19 (or $89-109/yr) cover all my kids or is it secretly per-child" | P2 in 6+ rounds, echoed by P5 | Reassurance line already exists in code (see correction above) but is low-visibility; real unresolved piece is P2's spouse-sharing ask below |
| No way to show the free report to a spouse/co-decision-maker without a card | P2, in rounds 0, 2, 4, 6, 8, 10, 11 | **Not yet built** — see recommendation below |
| No evidence Homa knows this family's actual state filing requirements (NY IHIP/quarterly) | P4, literally every round, 0 through 11 | Correctly never faked; needs a real, unbuilt capability + founder product call |
| "Will this still be good/personalized in month two" | P1, most rounds; echoed by P5 from round 8 | Not resolved by any tested variant; needs a real second time-separated data point, which cannot be honestly produced at signup |
| A single annual pull feels riskier than four monthly pulls, even knowing the math | P3, rounds 1-2 | Argues for keeping monthly-first sequencing whenever annual ships |

## Recommended next build: let the free report reach the second decision-maker

The single most repeated objection with no round anywhere testing a fix for
it: P2 (Rachel) says any subscription over ~$15/month is a two-person
decision in her house, and **the only way to show her husband the free,
already-unlocked report tonight is handing him her unlocked phone.**

This may already be closer to solved than it looks: the report has a
shareable, token-based public URL
(`/onboarding/r/[token]`, `docs/homa-planning/plans/2026-07-18-report-lock.md`)
that already holds rows for every viewer and renders checkout owner-only —
exactly the "let someone else look, only the account owner can pay"
behavior P2 is asking for. What's missing is discoverability: there is no
"share" or "copy link" affordance anywhere on the in-app report page
(`apps/web/app/app/[childId]/report/page.tsx`, checked directly — no
share/copy-link UI exists there tonight). A parent looking at her own
signed-in report has no visible way to hand the existing shareable link to
a spouse.

This is genuinely safe to build: no pricing change, no new claim, no
fabrication risk, reuses existing tenancy-safe infrastructure (checkout
already renders owner-only for any other viewer of that URL). I did not
build it tonight — two real fixes already shipped this session
(the array-param/link_tokens production bug earlier, and the billing portal
above), and cramming a third UI feature in at this hour risked lower
quality than giving it a clean, well-scoped start. Recommended as the
clear next PR: a "Share with your partner" / copy-link button on the
in-app report page, surfacing the token URL that already exists.

## What needs a founder call before it could ever ship live

- **The exact annual price.** Rounds 1-2 tested $89/yr and $109/yr; neither
  moved a single simulated persona, so this run validates neither number.
  The real blocker (the $99/yr-vs-Homeschool Fox collision) from
  `2026-07-18-report-lock.md` point 4 is unchanged and still open.
- **Whether to test removing or delaying the card requirement.** The
  single most repeated ask across nearly every persona in nearly every
  round (P1, P3, P5), and no round in this entire loop actually tested it.
  This needs a founder decision on monetization/fraud risk before anyone
  builds a no-card or shorter-preview variant.
- **A separate, higher compliance tier.** P4 (the NY persona) named $49/mo,
  unprompted, as what she'd pay for a tool that reliably nails her
  quarterly filing — a different purchase decision from "$19-109 for
  worksheets and chat." This is a new SKU tied to a product capability
  (a real, state-correct compliance-document generator) that does not
  exist yet. Not a copy change; needs a founder product and pricing
  ruling. The panel correctly refused to fabricate this capability at any
  point in 12 rounds.

## Honest caveats (the synthesis agent's own words, kept verbatim because softening them would be dishonest)

- "n=5 personas per round is far too small to distinguish signal from
  noise. A move from 0/5 to 2/5 (round 8) or back down to 0/5 (rounds 10 and
  11) is well within what randomness alone could produce even if the
  underlying 'true' conversion probability never changed."
- "LLM personas may be systematically more skeptical than real humans...
  or systematically more agreeable... These biases do not necessarily
  cancel out, and this transcript gives no way to measure which direction,
  if any, dominates."
- "Several of the most-requested fixes across the whole test (a no-card
  trial window, sharing the report with a spouse pre-card, a real second
  time-separated data point) were never actually built and tested as a
  variant in any of these 12 rounds; their absence from the results is not
  evidence they wouldn't work, it is evidence they were never tried."
- "Nothing here should be read as validating a specific lift percentage, a
  specific price point, or a specific artifact's ROI against real Homa
  users. The correct use of this transcript is to prioritize what to build
  and test next, not to greenlight a launch off simulated numbers."

## What shipped tonight, separately from this research

- [PR #149](https://github.com/sidneyswift/homa/pull/149): `/admin/funnels`
  production 500 (array-param bug on the `fetch_types:false` console
  client) + an unapplied `link_tokens` migration that was silently dropping
  `wall.viewed` events and breaking material PDF downloads. Merged, deployed,
  verified live.
- [PR #151](https://github.com/sidneyswift/homa/pull/151): the
  `onboarding-paywall-playbook` skill (the Cal AI essay translated to
  Homa's real architecture). Merged.
- [PR #152](https://github.com/sidneyswift/homa/pull/152): day-7 kill-test
  read on the live report lock, and the annual-price founder decision (D1).
  Open.
- [PR #154](https://github.com/sidneyswift/homa/pull/154): self-serve
  cancellation via a real Stripe billing portal, found while chasing this
  research's most-repeated post-round-8 objection. Open pending CI.

## Done looks like

This document, read plainly: the overnight loop did not hit 5/5, price was
ruled out as the primary blocker for 4 of 5 personas, one real live product
gap got found and fixed as a direct result, one clearly-scoped safe next
build got identified but deliberately left unbuilt for a clean start, and
every founder-owned decision this research touches is named specifically
rather than decided by a simulated persona's vote.
