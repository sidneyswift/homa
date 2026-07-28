# The signup trial gate, rebuilt as a decision instead of a document

**Date:** 2026-07-28
**Surface:** `/onboarding/trial` (`apps/web/components/billing/trial-gate.tsx`,
`tier-options.tsx`, `wall-copy.ts`)
**Status:** implemented on `claude/paywall-redesign-critique-b63ce8`, founder
decisions below still open

## Why this was opened

The founder's read of the page: too much on it that is not the job, no clear
place for the eye to land first, and no way to decide in ten seconds. The job
of this page is three things and nothing else. Let a parent understand what she
is paying and what she gets. Let her decide in under ten seconds. Make it
beautiful enough to be trusted.

## What the page actually did, measured

The page was measured by rendering the real `TrialGate` on a bench
(`apps/web/app/dev/paywall`) at 390x844 and reading the DOM, not by looking at
a screenshot. Harness and method: `scripts` in the session scratchpad, method
reproduced in the bench file's header comment.

| | Before | After |
|---|---|---|
| Page height (phone) | 2.35 screenfuls | 2.34 |
| Words before the first price | **149** | **48** |
| First price appears at | 1.10 screenfuls down | **0.59** |
| All three prices in the first screenful | **no** | **yes** |
| A button in the first screenful | **no** | **yes** |
| Competing primary actions | 3 | **1** |
| WCAG AA contrast failures | 4 | **0** |
| Total words on the page | 257 | 260 |

The word count came back up, deliberately. An intermediate version reached 20
words before the first price and 153 words total, and the panel then failed the
comprehension check ten times out of ten: every persona recalled the numbers and
none could say what they bought. Two named exactly that as their reason to leave.
The words that returned are the identity sentence, the charge and cancellation
mechanics at body weight, and the shared contents as a list. **The page is not
shorter than it was. It is ordered, and the prices reach the first screenful
anyway.**

The reference point for "words before the first price" is a teardown of 17
shipping pricing and paywall pages (Linear, Vercel, Notion, Framer, Cal.com,
Descript, Blinkist, Headspace, Duolingo, Spotify, Strava, Raycast, and others),
captured at the same viewport. Median distance from the top of a phone screen
to the first price: **12 words**. Practical ceiling: about 15. Every page under
it landed a price in the first screenful; every page over it did not. This page
had 149.

## The diagnosis

**1. The page was organised as a document, not a control panel.** Eyebrow,
headline, two-sentence reassurance, a three-card Today/Day 4/Day 7 timeline, a
24-word list of everything included, and only then the prices. Each element was
individually justified by a prior ruling and the sum was unreadable. Nobody had
re-examined the total budget since the parts were added.

**2. There was nothing for the eye to land on.** The founder's instinct was
right, but the sharper version is that the first screenful of a phone contained
no price, no plan, and nothing tappable. The eye does not know where to start
because there is no target.

**3. The same seven things were said twice.** `TRIAL_GATE_INCLUDED_LINE` listed
seven items in one sentence; each of the three cards then re-listed an
overlapping subset. A parent read "worksheets made for your child, phone calls
with Homa, and chat" twice before reaching a number.

**4. Reading burden rose with price.** Card word counts were 35, 41, and 51.
The tier that needs the most consideration was the hardest to scan.

**5. The visual hierarchy contradicted itself.** The card badged "Most popular"
carried the bordered secondary button; the $19 card carried the solid primary
one. The badge said choose this, the styling said choose that.

**6. The primary CTA failed WCAG AA at 3.44:1** (white on `#E7602F`,
14px/600, needs 4.5:1). The repo already knew: `report-button.ts` documents
`primary` as legacy and `primary-strong` as "AA-safe... for new normal-size
controls". The paywall used the failing one. The billing toggle failed at the
same ratio and was 32px tall against a 44px touch minimum.

**7. "Most popular" was fabricated social proof.** On the day it shipped there
were no paying families, so no tier was popular and none was most. Ruling C2
bans invented social proof; the FTC's 2024 rule on fake endorsements makes it
an exposure rather than a matter of taste.

## What replaced it

Rows, not cards. Each tier is one row: name, one line of what that tier adds,
and the price, with the shared contents stated once below rather than three
times inside. Selecting a row arms **one** button. All three prices are legible
in a single glance and comparable without scrolling.

The trial timeline became one sentence under the button
(`TRIAL_GATE_CHARGE_NOTE`), which is where a pricing scan ends. Its three facts
all survive. It cost a full screenful to deliver 40 words the parent had already
been told at the landing CTA ("7 free days, then plans from $19 a month. Cancel
anytime.").

Two ethics choices, both against the grain of the paywalls this pattern came
from. The default selection is the **cheapest** tier, never the featured one:
Headspace pre-selects the plan *without* the free trial, and Homa offers rather
than commands. And no tier carries an endorsement badge (below).

## What a ten-parent panel did to it

Ten personas built from `journeys/01-personas-jtbd.md` (P1 to P5 plus the dad,
the skeptical co-op friend, a mother in a pickup line with 12% battery, a
mother previously auto-charged after a "free" trial, and a co-teaching
grandmother) reviewed the rebuilt page under realistic distraction. They were
instructed that leaving is the honest base rate and that a false yes is worse
than useless.

**Round 1: 0 of 10 proceeded.** The most useful failure was not a refusal, it
was that **10 of 10 could not answer "how do I avoid the charge"** from the
page.

What that round found, and what changed:

- **The price/child question was unanswered.** "Adding children never changes
  the price." has been in `WALL_BULLETS` since the wall shipped and the rewrite
  **stopped rendering it**. That was a regression I introduced, and it was the
  single most-asked question: a would-leave for both multi-child readers. Three
  kids at $19 is a conversation with a husband; three kids at $57 is a no; she
  will not type a card to find out which. Restored, at the button.
- **The badge had to go.** All ten flagged it, three as a reason to leave. An
  endorsement on the pricier row turns a yes-or-no into a which-one, and a
  which-one gets deferred to a spouse. Two said it made them trust the
  *cheaper* tier's description less. Plus now routes by self-selection instead:
  "If your state requires filing: quarterly reports and paperwork."
- **"Cancel anytime" with no mechanism reads as a trap** to the persona who has
  been burned. The path is real and self-serve, so the copy now says it: cancel
  in your settings.
- **"Adds five times the makings each week, and no waiting" is not true.**
  Nothing reads `families.plan_tier` to meter anything: there is no base
  allowance for five times to be five times *of*, and no queue for this tier to
  skip. Ten of ten did not know what a "making" was, and eight read "no
  waiting" as proof the $19 plan is deliberately throttled. See the founder
  decision below.
- **"Hours" appeared nowhere** on a page selling a homeschool assistant to a
  parent whose state wants a thousand logged hours. Added; `log_hours` is a
  bounded tool available on web, so the claim is true on this channel.
- **"Phone calls with Homa" was read by one persona as Homa telephoning her
  children**, and she is the reader six other families were waiting on. A
  misread with a child-safety flavour is not a wording preference. Now: a
  number you can call.
- **"Not ready today?" was the sentence that let six of them close the tab**,
  and all six called it kind. A question invites its answer. The fact stays as
  a statement; the invitation goes.
- **Five would have left over never seeing the product.** A text link asking a
  parent to leave the page at 9:40pm is not an answer, so a real practice page
  Homa made now sits below the button.

## What four review rounds actually established

Ten personas reviewed the page four times. **Zero proceeded in every round.** That
is the finding, not a failure of the design work, and the reason is worth stating
precisely: across rounds the blockers migrated from design to product, and then
stopped moving.

| Round | Proceeded | What stopped them |
|---|---|---|
| 1 | 0/10 | Could not tell whether the price covered every child; the badge turned a yes-or-no into a which-one; "cancel anytime" with no mechanism |
| 2 | 0/10 | **10/10 could not say what Homa does.** The page had won speed and lost meaning |
| 3 | 0/10 | Filing question raised and not answered; Max says nothing; the only sample is for a five-year-old; price against a single-income curriculum budget |
| 4 | 0/10 | Same four, unchanged. Comprehension on "am I charged today" recovered to 8/10, every one of them citing "the bold line right above the prices" |

Round 4 is the confirmation that the loop has converged. The one thing that moved
was the fact I had accidentally deleted; nothing else did, because nothing else
left is a page problem. The four blockers cited in round 4 are: the price against
a real single-income curriculum budget, the absence of an older-child artifact,
the unanswerable state-filing question, and the empty top tier. All four are on
the founder-decision list below.

By round 3 the adjudicator scored **6 of 10 as unreachable by any page change**:
two on price, two on unbuilt product (state filing, older-child materials), one
on packaging, one because she is not the cardholder. Four remain reachable, and
the remaining fixes for them need verification or a build, not copy: the real tap
count in the Stripe portal, wallet marks on the Payment Links, an in-page sample
excerpt, a data-export promise.

**The instruction was to iterate until all ten buy. That target is not reachable
by design,** and continuing to chase it would mean either weakening the reviewers
or writing claims the product cannot support. The panel punished exactly that
three times. The design work has converged; what is left is on this list.

### The two things the panel caught that were mine

- **I deleted a load-bearing fact as filler.** "Adding children never changes the
  price" has been in `WALL_BULLETS` since the wall shipped, the rewrite stopped
  rendering it, and it is the single most asked question of the panel.
- **I dropped "Nothing is charged today" while adding the identity sentence.**
  Comprehension on "am I charged today" went from 10/10 correct to 0/10 in one
  round. There is now a guard test asserting the component renders it, because a
  string test cannot catch a missing render.

## Evidence the research sweep added

Eleven research angles, every finding adversarially fact-checked against its
source: 55 survived, 22 were refuted as laundered or unsupported.

- **Legally binding, not a preference.** ROSCA (15 U.S.C. 8403) requires material
  terms clearly and conspicuously **before** billing information is collected.
  California's ARL as amended by AB 2863 (in force 1 July 2025) requires
  auto-renewal terms in "visual proximity to the request for consent" including
  the post-trial price. Amazon settled $2.5B in September 2025; Chegg $7.5M
  specifically over cancellation mechanism. The charge sentence under the button
  is the compliance element and the trust element at once, which is why it is
  body weight and not fine print.
- **On a 7-day trial, Visa's own 7-days-before reminder lands on enrollment day**,
  so the page has to carry the charge date itself. It now does, computed from the
  visitor's browser clock.
- **Cutting a tier to "simplify" is a misapplication of Hick's law.** Going from
  two options to three costs roughly 40 to 130ms, under 1.5% of a ten-second
  budget. Words dominate, not choices. This is why the fix for Plus and Max is
  what they *say*, not that they exist.
- **Never print a customer count.** At 78 families every number is negative
  social proof, and an unlinked star row reads as concealment.
- **The deepest structural defect, which no copy edit reaches:** the three tiers
  are not alignable. $19 planning, $49 filing, $199 "the most" are three
  different bundles, not three points on one axis. Non-alignable assortments are
  where extra options *reduce* choice share. A compromise effect cannot fire on
  $49 because there is no perceptible middle of anything.

## Founder rulings, 2026-07-28

**The top tier's job is to make $49 read as reasonable**, and it earns that by
being worth its own price rather than by being a large number with nothing
behind it. Shipped as "Homa builds your whole year, up front."

The claim is real: `curriculum-studio` runs 12 and 36 week program builds as
finite background jobs, and a 36 week program is a school year. The load-bearing
words are "up front": on request that capability is available to every tier
today, so claiming it as an *addition* would repeat the falsehood it replaced.
What Max adds is that Homa does it at the start and keeps it current instead of
waiting to be asked, which takes nothing away from anyone below it.

**The first attempt at that was wrong and lasted one revision.** It made the top
tier "Homa builds your whole year, up front", and the founder killed it in one
sentence: "Homa can build that whole year on the $19 plan. That's not that much
of a difference." Correct, and it generalises. **Anything the cheap tier can
already do cannot carry the expensive one**, and every software differentiator on
this page fails that test, because nothing is gated by tier.

So the top tier is physical and human: materials in the post, and a person who
plans with you. Those are the only things the base tier cannot quietly match,
which is exactly why they work. They also retire the objection the 2026-07-25
tier panel raised against "Concierge", that it promised a human the mechanism
did not back. This time there is a human.

Say "a person", never the founders by name. A plan description is a standing
promise, and naming who delivers it makes it one you have to keep at customer
forty. Deliver founders while that is possible. Shipping needs no new build:
`setFamilyAddress` already collects a full mailing address in `/app/settings`.

The ladder now runs on one axis, **how far Homa comes toward you**, which is what
an anchor needs to read as more rather than as a catch:

| | | |
|---|---|---|
| $19 | You come to Homa on the web | Weekly plans, practice pages, hours logged. |
| $49 | Homa comes to you | Adds text, phone, and your own curriculum. |
| $199 | A person and a parcel come to you | Materials posted, and a person to plan with. |

Two consequences of that ruling, both real:

- **State filing left the page entirely.** It was the largest unsupportable claim
  here and it also asked a question the page could not answer ("does MY state
  require filing?"), which sent two review personas to a search engine instead of
  a checkout. Removing it costs nothing that existed. If it should come back,
  that is a deliberate re-add, not a restore.
- **Text, email, and the phone line moved up from the base plan, and nothing
  gates them today.** Every family currently has all three. Until a tier check
  exists, the $49 row promises an upgrade that is already switched on, which is
  the same falsehood the Max copy was just cleaned of. There are no paying
  families yet and grandfathering already exists
  (`HOMA_SIGNUP_PAYWALL_SINCE`), so the window to do this cleanly is now.

Each tier line is held to roughly 44 characters so all three hold one line at
390px. Three rows of identical shape scan faster than three rows carrying one
more noun each, and the longer drafts pushed the button out of the first
screenful twice.

**Both paid tiers are sold before they are built, deliberately.** The buyer picks
the state rather than us guessing. Tracked as [gh#297](https://github.com/sidneyswift/homa/issues/297),
which owns the delivery path: neither tier has a trigger, an owner, or a stated
turnaround when the first sale lands.

### What the usage data says about all of this

30 days, 42 real families, co-founders excluded because they are the two heaviest
and are building the product rather than homeschooling with it:

| | |
|---|---|
| Typical family, model cost | **$2.52 / month** |
| 90th percentile | $5.32 |
| Heaviest real customer | $41.49 |
| Families costing more than $19 | **1 of 42** |
| Families costing more than $49 | 0 |

So at $19 you clear roughly 87% on almost everyone, and **Homa does not have a
compute problem.** The usage-tier playbook the AI labs run (limits on the
standard plan, a max tier that lifts them) does not transfer: Homa is a
scheduled product, a plan a week and a few pages, so nobody can hammer it the
way they hammer a chat box. A weekly cap generous enough to be fair would never
touch 40 of 42 families, which means it would be a restriction almost nobody
feels, sold as the thing the top tier removes. That is the "no waiting" failure
again in a different sentence, which is why the top tier sells more work done
rather than more allowance granted.

The tail is real but small: the heaviest genuine family costs 16x the median.
Worth re-checking once there are paying families, since the shape may change
when usage is not free.

## Founder decisions still open

**D1. The card sits before any value.** This page asks for a card before the
parent has seen a questionnaire, a report, or a worksheet. That is the founder
directive of 2026-07-26 and I have not designed around it, but it is the single
largest lever on this funnel and two personas are structurally unreachable while
it holds. Worth scoring against a no-card variant rather than assuming.

**D2. Removing the featured badge reverses part of the 2026-07-26 screenshot
direction.** The routing intent survives in the Plus row's own line. Confirm.

**D3. The brand coral fails AA as a button fill at this text size.** The button
now uses `clay-700` (the repo's own `primary-strong` remedy). `clay-600`
(`#C44C22`) measures 4.77:1 on white and also passes, and is closer to the
brand coral. Worth a design-system ruling, since it affects every primary
button, not just this one.

## Deliberately not done

- **Testimonials, ratings, or a customer count.** There are none. On this date:
  78 real families, no trial ever started, no active subscription. Two personas
  asked for evidence, which is not the same as testimonials, and the answer is
  the sample artifact, not an invented person.
- **Real calendar dates instead of "day 4" and "day 7".** `FamilyRow` carries
  no timezone, so a server-rendered charge date can be wrong by a day. A wrong
  date on a charge promise is worse than a relative one. Needs the family
  timezone first.
- **"Apple Pay accepted."** Not verified against the Payment Link config.
- **Naming a state anywhere.** Unsupportable and the worst possible one to
  guess on.

## Tracking

Filed on `sidneyswift/homa` (Issues is the live tracker, this doc is the spec):

- [gh#293](https://github.com/sidneyswift/homa/issues/293) Homa Max has no enforced
  differentiator (D1)
- [gh#294](https://github.com/sidneyswift/homa/issues/294) No stated policy for a
  family's hours log after cancellation
- [gh#295](https://github.com/sidneyswift/homa/issues/295) The three tiers are not
  alignable
- [gh#296](https://github.com/sidneyswift/homa/issues/296) Door wall and report lock
  still carry long-form prose above the rebuilt picker
- [gh#297](https://github.com/sidneyswift/homa/issues/297) Both paid tiers are sold
  before they are built: define the delivery path before the first sale
- [gh#298](https://github.com/sidneyswift/homa/issues/298) Text, email and phone moved
  to the $49 tier but nothing gates them
- [gh#293](https://github.com/sidneyswift/homa/issues/293) Homa Max differentiator,
  CLOSED: the unsupportable metering claim is gone and guarded

Still unfiled because they need a founder ruling on framing first: the Plus
filing gap (D2), the card-before-value sequencing (D3), the featured-badge
removal (D4), and the `clay-600` button contrast question (D5).

## Follow-ups

- The door wall (`wall-offer.tsx`) and the report lock (`report-lock-offer.tsx`)
  share the rebuilt picker and now render rows, but keep their own long-form
  prose above it. They have the same problem this page had and want the same
  treatment.
- `.agents/skills/homa-copy-writer/SKILL.md` still says `"HOMA" in the wordmark
  and on UI surfaces, per global founder ruling D8`, which the 2026-07-28
  brand correction retired. The stale rule is what produced the uppercase
  "HOMA MEMBERSHIP" eyebrow this redesign deleted.
- `apps/web/app/dev/paywall` is a development-only bench and should stay one.

## Evidence and reproduction

- Measurement harness and the 17-page teardown: session scratchpad, method in
  the bench header.
- Guard tests: `apps/web/components/billing/wall-copy.test.ts`, run by
  `pnpm check:billing`. Every law above that a future edit could break silently
  is asserted there, including the ban on unenforced metering claims and on
  social proof this product cannot support.
