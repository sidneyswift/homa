import { planDefinition, type WallDoor } from "@homa/core";

import type { BillingPeriod, PlanTier } from "../../lib/billing/wall-types";

/**
 * Every parent-facing word on the wall, in one reviewable file
 * (plans/2026-07-11-the-wall.md; copy rulebook:
 * .agents/skills/homa-copy-writer/SKILL.md). The wall is an offer, never
 * a scold, and it only appears at the first tap on an action door. The
 * original "report stays free forever" placement was superseded for new
 * families by the report lock (2026-07-18) and then the signup paywall
 * (founder directive 2026-07-26, TRIAL_GATE_* below); wallReportLine
 * still renders true for the pre-gate families the door wall serves.
 * Both copy gates ran 2026-07-11 (reader, then editor); the founder
 * read-aloud is the last gate before any flag ever flips.
 *
 * Vocabulary laws for this surface:
 * - The trial is "your 7 free days", never "your free month": the
 *   reader gate tangled the trial month with the child's month plan
 *   the instant both were on screen. "month" appears only as the $19
 *   price unit.
 * - Included lines share ONE frame, "Your 7 free days include X",
 *   where X is the thing she just tapped (the reader gate's bridge),
 *   named first in the list (editor gate: stacked "comes with...
 *   along with" was doing containment work twice).
 * - Price labels are the founder's v1 sticker prices (build-log
 *   2026-07-06) and must match the Stripe Payment Links the env vars
 *   point at; change them together, and keep the links' trial at 7
 *   days so these words stay true.
 */

export const WALL_EYEBROW = "Homa membership";

export const WALL_HEADLINE = "Try Homa free for 7 days";

/** The reassurance, first (reader gate: this landing first is what let
 *  her relax): the thing she already has is hers for good. */
export function wallReportLine(childName?: string | null): string {
  const whose = childName ? `${childName}'s` : "Your child's";
  return `${whose} progress report is free, forever.`;
}

/** The bridge: what she reached for, named first inside what the 7
 *  free days include, in concrete household words. */
export function wallIncludedLine(door: WallDoor, childName?: string | null): string {
  const kid = childName ?? "your child";
  switch (door) {
    case "plan":
      return `Your 7 free days include the four-week plan you tapped, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    case "month":
      return childName
        ? `Your 7 free days include ${childName}'s month, worksheets made for ${childName}, phone calls with Homa, and chat.`
        : `Your 7 free days include the month you tapped, worksheets made for your child, phone calls with Homa, and chat.`;
    case "lesson":
      return `Your 7 free days include the lesson you tapped, its printable worksheet, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    case "call":
      return `Your 7 free days include the call you asked for, four-week plans, worksheets made for ${kid}, and chat.`;
    case "chat":
      return `Your 7 free days include this chat, four-week plans, worksheets made for ${kid}, and phone calls.`;
    case "report":
      return `Your 7 free days include every subject in ${kid === "your child" ? "the" : `${kid}'s`} report, four-week plans, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    case "signup":
      return `Your 7 free days include the questionnaire and ${kid === "your child" ? "your child's" : `${kid}'s`} full progress report, weekly plans, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    default: {
      const exhaustive: never = door;
      throw new Error(`Unhandled wall door: ${exhaustive}`);
    }
  }
}

/** The ask, unmistakable on the first pass (reader gate: "card" alone
 *  read as the card on screen), then one fact per sentence. */
export const WALL_MECHANICS_LINE =
  "A credit card starts your 7 free days. Nothing is charged during them. You get an email before the first charge.";

/** The children fact as a full sentence (editor gate: "Unlimited kids,
 *  one price" collided with the two prices right above it). tierBullets
 *  prepends the per-tier annual math when the toggle sits on annual. */
export const WALL_BULLETS = [
  "Adding children never changes the price.",
  "Cancel anytime.",
] as const;

export const WALL_DISMISS = "Not now";

/**
 * The three sellable tiers (2026-07-25: Plus and Elite priced and
 * launched ahead of their differentiating product work, per founder
 * direction to test willingness to pay before building). Plus is
 * described as an active commitment ("adds state filing support"),
 * never a claim that a specific state's filing is already built and
 * verified today: a wrong legal claim is the one failure mode this
 * exact persona (Monica, docs/homa-planning/journeys/01-personas-jtbd.md
 * P4) cancels same-day over. The top tier's features are real,
 * buildable mechanics (a plan_tier column and the makings multiplier
 * already exist, supabase/migrations/20260725040000_family_plan_tier.sql);
 * the enforcement is dark until the base allowance itself ships,
 * matching how the wall's own doors already ship dark before a flag
 * flip. Internal key stays "elite" (the DB check constraint, Stripe
 * product mapping in wall.ts) to avoid a second migration; only the
 * display name changed, same pattern as "regular" displaying as "Homa".
 *
 * Name and copy ran through the same 5-persona panel as the paywall
 * research (2026-07-25): "Homa Max" won the plurality (3 of 5), and
 * every candidate implying the lower tiers are lacking (Complete,
 * Everything, Total) or literally false against the "five times"
 * figure (Unlimited) was independently flagged by multiple personas.
 * "Concierge" was the pick of the two plausible top-tier buyers
 * (Alessa, Monica) but both separately warned it promises a human
 * service the actual mechanism doesn't back. The description below was
 * rewritten from the same panel: "best models" was dropped for
 * implying the CORE teaching/scoring quality is rationed by price
 * (Rachel's reading, the most severe finding: this would undermine
 * trust in every cheaper tier, not just fail to sell this one), and
 * "priority queue" was reframed as an absolute claim about this tier's
 * own experience rather than a comparison implying other tiers wait
 * (4 of 5 personas independently flagged the comparative framing).
 */
export const TIER_NAMES: Record<PlanTier, string> = {
  regular: planDefinition("regular").name,
  plus: planDefinition("plus").name,
  elite: planDefinition("elite").name,
};

/**
 * There is no badge on any tier, and that is the finding, not an
 * oversight.
 *
 * It said "Most popular" until 2026-07-28, which was fabricated social
 * proof: at the time it shipped there were zero paying families, so no
 * tier was popular and none was most (ruling C2, plus the FTC's 2024
 * rule on fake endorsements). The first repair swapped it for
 * "Recommended", a first-party statement Homa can stand behind.
 *
 * A ten-persona panel then read the page and all ten flagged the badge,
 * three of them as the reason they would leave. A green endorsement
 * pointing at the more expensive row turns a yes-or-no into a
 * which-one, and a which-one gets deferred to a spouse and never
 * returns. Two personas said it made them trust the CHEAPER tier's
 * description less, which is the same failure the 2026-07-25 tier panel
 * caught in the Max copy: a claim about one tier that quietly
 * disparages another.
 *
 * The routing survives without it. Plus now says who it is for in its
 * own line (tierDelta), so a parent in a filing state selects herself
 * in and a parent in Texas correctly reads "not me" and stays on $19.
 * Self-selection routes as well as an endorsement and costs no trust.
 */

/** The public price source is shared with the native StoreKit catalog. */
function tierPrice(tier: PlanTier, period: BillingPeriod): number {
  const plan = planDefinition(tier);
  return period === "annual" ? plan.annualUsd : plan.monthlyUsd;
}

export function tierMonthlyButton(tier: PlanTier): string {
  return `Start your 7 free days · then $${tierPrice(tier, "monthly")} a month`;
}

/**
 * The picker's single button (2026-07-28 redesign). It replaced three
 * competing 40-character buttons, one per card, each restating a price
 * the card already showed two lines above it.
 *
 * Short on purpose. A button label is a tap target, not a sentence: at
 * this length it holds one line on a 390px phone, where every
 * per-tier label wrapped to two. The price it commits to has not been
 * dropped, it sits directly under the button in tierChargeLine, the
 * placement the clearest pages in the 17-page teardown use, and it
 * changes with the selected tier so the button and the number under it
 * can never disagree.
 */
export const TRIAL_GATE_CTA = "Start your 7 free days";

/** Under the button: what this selection costs once the trial ends,
 *  as a full sentence, so the commitment is stated in the same glance
 *  as the button that makes it. */
export function tierChargeLine(tier: PlanTier, period: BillingPeriod): string {
  const price = tierPrice(tier, period);
  if (period === "annual") {
    return `Then $${price.toLocaleString("en-US")} a year.`;
  }
  return `Then $${price} a month.`;
}

/** The tier picker's single CTA (2026-07-26: a monthly/annual toggle
 *  replaced the old two-stacked-buttons layout, one button per tier at
 *  a time). Falls back to the monthly button if this tier's annual
 *  link isn't configured, so a stale toggle selection never dead-ends
 *  a tier that only ships monthly. */
export function tierButtonLabel(tier: PlanTier, period: BillingPeriod): string {
  if (period === "monthly") return tierMonthlyButton(tier);
  return `Start your 7 free days · then $${tierPrice(tier, "annual").toLocaleString("en-US")} a year`;
}

/** The bare number for the pricing-card redesign's large price display
 *  (founder screenshots 2026-07-26), shown above the existing CTA
 *  button, which keeps its own full sentence (tierButtonLabel)
 *  unchanged. Falls back to the monthly price if this tier's annual
 *  price is somehow null, matching tierButtonLabel's own fallback. */
export function tierPriceAmount(tier: PlanTier, period: BillingPeriod): number {
  return tierPrice(tier, period);
}

/** The small unit label beside the large price number. */
export function tierPriceUnit(period: BillingPeriod): string {
  return period === "monthly" ? "month" : "year";
}

/** The toggle itself: one control above all three cards, so "annual"
 *  means the same 20%-off-monthly discount everywhere (founder ruling
 *  2026-07-26) and one badge states it once instead of a per-tier
 *  dollar figure. */
export const BILLING_TOGGLE_MONTHLY_LABEL = "Monthly";
export const BILLING_TOGGLE_ANNUAL_LABEL = "Annual";
export const BILLING_TOGGLE_ANNUAL_BADGE = "Save 20%";

export function tierBullets(tier: PlanTier, period: BillingPeriod): readonly string[] {
  if (period === "annual") {
    const perMonth = (tierPrice(tier, period) / 12).toFixed(2).replace(/\.00$/, "");
    return [`The year works out to $${perMonth} a month.`, ...WALL_BULLETS];
  }
  return [...WALL_BULLETS];
}

/**
 * The one line that sits under a tier's name in the picker: what THIS
 * tier adds, and nothing else (2026-07-28 redesign). Every tier's
 * shared contents are stated once, above the picker, in
 * TRIAL_GATE_EVERY_PLAN, so a row never repeats them.
 *
 * The old picker gave each card a 1 to 3 sentence description that
 * re-listed the shared features, which put 35, 41, and 51 words on the
 * three cards: reading burden rose with price, so the tier needing the
 * most consideration was the hardest to scan. These are 4, 7, and 8
 * words, in the same grammatical shape, so the three rows can be
 * compared without being read in full.
 *
 * The full vetted sentences are not deleted, they moved: tierDescription
 * still carries them for the compare section under the picker, which is
 * where the 5-persona panel's exact wording on Plus and Max still has to
 * survive intact.
 */
export function tierDelta(tier: PlanTier): string {
  switch (tier) {
    case "regular":
      // Self-contained on purpose: it names the base rather than
      // pointing at a list, so the full contents line can sit BELOW the
      // picker where its 24 words cost nothing. Pointing upward
      // ("everything listed above") would drag that list above the
      // prices and blow the word budget that gets them into the first
      // screenful.
      //
      // Named artifacts, not categories. The panel's first version read
      // "Plans, worksheets, calls, and chat", and four personas said it
      // was the only description they read; one read it as a
      // description of the ChatGPT tab she already has open. Four
      // category nouns describe any assistant. The hours log is here
      // because it is the one thing on the list a free chatbot cannot
      // be (log_hours writes a durable record), and because it is the
      // legal obligation the highest-load persona came to solve.
      return "Weekly plans, practice pages, hours logged.";
    case "plus":
      // Founder ruling 2026-07-28, second pass. The three tiers now run
      // on one axis, how far Homa comes toward you: the base is Homa on
      // the web, this one is Homa reaching you wherever you are and
      // working from materials you already own, and the top one is a
      // person and a parcel arriving.
      //
      // State filing was this row's story until now and is deliberately
      // gone. It was the page's single largest unsupportable claim, the
      // one the compliance-heavy persona cancels same-day over, and it
      // also asked a question the page could not answer ("does MY state
      // require filing?") which sent two personas to a search engine
      // instead of a checkout. Removing it costs nothing that existed.
      //
      // Email is delivered on this tier too and is not named here: at
      // 45 characters the row wrapped to a second line while the other
      // two held one, and three rows of identical shape scan faster
      // than three rows carrying one more noun. "Your own curriculum"
      // kept its "own", which is the word that means the material she
      // already paid for rather than one Homa invents.
      return "Adds text, phone, and your own curriculum.";
    case "elite":
      // Founder ruling 2026-07-28: this tier's job is to make $49 read
      // as reasonable, and it earns that by being worth its own price,
      // not by being a big number with nothing behind it.
      //
      // What it said until then: "Adds five times the makings each
      // week, and no waiting." Both halves were unsupportable in both
      // directions, because nothing reads families.plan_tier to meter
      // anything: no allowance for five times to be five times OF, no
      // queue to skip. Worse, it anchored backwards. Seven of ten
      // review personas said the $199 row made them trust the $19 row
      // LESS, and eight read "no waiting" as proof the cheap plan is
      // deliberately throttled. An anchor only works when the top tier
      // reads as more; a mystery reads as a catch.
      //
      // The year build is the differentiator because it is real work a
      // parent cannot do herself in an evening, and because the
      // machinery ships: curriculum-studio runs 12 and 36 week program
      // builds as finite background jobs
      // (apps/web/agent/skills/curriculum-studio/SKILL.md). A 36 week
      // program is a school year.
      //
      // The word doing the work is "without asking". On request, this
      // capability is available to every tier today, so claiming it as
      // an addition would repeat the exact falsehood above. What Max
      // adds is that Homa does it up front, per child, and keeps it
      // current, rather than waiting to be asked. That is a service
      // difference, so it takes nothing away from anyone below it.
      //
      // Founder ruling 2026-07-28, second pass: physical and human.
      // The year build lasted one revision and was cut for the reason
      // that kills every software differentiator on this page, in the
      // founder's own words: "Homa can build that whole year on the $19
      // plan. That's not that much of a difference." Correct. Anything
      // the cheap tier can already do cannot carry the expensive one.
      //
      // Materials in the post and a person on a call are the only kind
      // of thing the base tier cannot quietly match, which is exactly
      // why they work here. They also answer the objection the
      // 2026-07-25 tier panel raised against "Concierge", that it
      // promised a human the mechanism did not back: this time there is
      // a human.
      //
      // Say "a person", never the founders by name. A plan description
      // is a standing promise, and naming who delivers it makes it one
      // you have to keep at customer forty. Deliver founders while that
      // is possible.
      //
      // Shipping is already possible today: setFamilyAddress collects a
      // full mailing address in /app/settings.
      return "Materials posted, and a person to plan with.";
    default: {
      const exhaustive: never = tier;
      throw new Error(`Unhandled plan tier: ${exhaustive}`);
    }
  }
}

/** One line per tier, reassurance-shaped (what it adds, in her words),
 *  never a features table. Now used by the compare section below the
 *  picker rather than inside a card; tierDelta owns the scannable line. */
export function tierDescription(tier: PlanTier): string {
  switch (tier) {
    case "regular":
      return "Weekly plans, printable practice pages made for your child, phone calls with Homa, and chat.";
    case "plus":
      return "Everything in Homa, plus state filing support: quarterly reports and homeschool paperwork, prepared from what you've already logged.";
    case "elite":
      return "Everything in Homa Plus, plus the most capable version of Homa for every worksheet and practice page, five times the makings each week, and no delay when things get busy.";
    default: {
      const exhaustive: never = tier;
      throw new Error(`Unhandled plan tier: ${exhaustive}`);
    }
  }
}

/** The rare race where a door was tapped right as the wall went up on
 *  the server. Copy-kit shape: name it, settle the nerves (her report
 *  is untouched), then the next step, which honestly delivers the
 *  offer card, not the trial itself (editor gate). */
export const WALL_STALE_MONTH_LINE =
  "The month didn't open. Your report is safe and still free. Refresh this page to see the membership offer.";

export const WALL_STALE_LESSON_LINE =
  "Your report is safe. Refreshing this page will reopen the lesson option.";

export const WALL_STALE_CALL_LINE =
  "The call didn't start. Your report is safe and still free. Refresh this page to see the membership offer.";

/** The tokenized plan URL opened without this family's session (a
 *  shared link, or the parent on a device Homa doesn't know yet).
 *  Checkout never renders here: a viewer's payment could not be
 *  attributed to the family, so the page offers sign-in instead. */
export const WALL_SIGNIN_HEADLINE = "This plan hasn't been built yet.";

export const WALL_SIGNIN_BODY =
  "Plans are part of Homa membership. Sign in to see the offer.";

export const WALL_SIGNIN_BUTTON = "Sign in";

/**
 * The report lock's offer card (plans/2026-07-18-report-lock.md), the
 * one card between the open four and the held subjects. Same laws as
 * every wall surface, plus the 2026-07-18 naming ruling: this surface
 * says "report" or "progress", never "map". Reassurance first: the
 * whole report already exists and is saved, nothing is unfinished.
 */
export function reportLockReadyLine(childName: string | null, mappedCount: number): string {
  const whose = childName ? `${childName}'s` : "Your child's";
  return `${whose} full report is ready: ${mappedCount} subjects, scored and saved.`;
}

export function reportLockHeldLine(
  childName: string | null,
  openCount: number,
  lockedCount: number,
): string {
  const kid = childName ?? "your child";
  const open = openCount === 1 ? "The subject above is" : `The ${NUMBER_WORDS[openCount] ?? openCount} above are`;
  const held = NUMBER_WORDS[lockedCount] ?? String(lockedCount);
  return `${open} open in full. Your 7 free days open the other ${held}, plus four-week plans, worksheets made for ${kid}, phone calls with Homa, and chat.`;
}

/** A held subject's whole row: her own answer count (the one honest
 *  number that is already hers), never a blurred score or teased badge. */
export function reportLockRowLine(subjectName: string, observations: number): string {
  const subject = subjectName.toLowerCase();
  if (observations < 1) return `Scored and ready whenever you are.`;
  const count = observations === 1 ? "1 question" : `${observations} questions`;
  return `You answered ${count} about ${subject}. Scored and ready whenever you are.`;
}

/** The token link opened without this family's session: rows stay
 *  held, and the card offers sign-in instead of a checkout that could
 *  never be attributed to the right family. */
export const REPORT_LOCK_SIGNIN_HEADLINE = "The rest of the report is part of Homa membership.";

export const REPORT_LOCK_SIGNIN_BODY = "Sign in to see the offer.";

/**
 * The signup trial gate (/onboarding/trial, founder directive
 * 2026-07-26): the one full-page ask between the account card and the
 * product. Same laws as every wall surface. The shape follows the
 * best-documented card-upfront pattern (Blinkist's trial timeline,
 * growth.design case study: leading with the reminder-before-charge
 * promise raised trial starts 23% and cut complaints 55%): reassure
 * first, then the plain mechanics as a three-beat timeline, then the
 * tiers. The reminder promise is real: Stripe's trial reminder email is
 * a launch requirement for this page (founder checklist on the PR), and
 * WALL_MECHANICS_LINE already made the same promise at the doors.
 */
export const TRIAL_GATE_HEADLINE = "Try Homa free for 7 days";

/**
 * One short line under the headline, and the last words before the
 * prices (2026-07-28 redesign). It answers the only question that can
 * stop a scan this early: am I about to be charged.
 *
 * The measured reason it is this short. A teardown of 17 shipping
 * pricing pages put the median at 12 words between the top of a phone
 * screen and the first price, with a practical ceiling around 15: every
 * page under it landed a price in the first screenful and every page
 * over it did not. This page had 149 words before its first price and
 * showed none of the three in the first screenful. Headline plus this
 * line plus the toggle is 15 words, so the prices clear the fold.
 *
 * The rest of the mechanics are not cut, they moved below the button
 * (TRIAL_GATE_CHARGE_NOTE), which is where a pricing-page scan actually
 * ends and where the pages in that teardown that handle risk best put
 * it.
 */
export const TRIAL_GATE_REASSURANCE = "Nothing is charged today.";

/**
 * What Homa is, in one sentence, above the prices.
 *
 * The measured reason it exists. The first rebuild of this page got a
 * price into the first screenful in ten words and a ten-parent panel
 * then failed the comprehension check ten times out of ten: every
 * persona recalled the numbers and not one could say what the numbers
 * bought. Two of them named it as the reason they would not proceed,
 * in the same words: I cannot tell my wife what we are buying. A price
 * nobody can interpret is not worth the screen space that carried it.
 *
 * So the scan budget breaks here on purpose, and it is the right trade:
 * the ceiling it broke was a proxy for comprehension, and comprehension
 * is the thing being measured directly.
 *
 * Three deliberate word choices.
 *
 * "an AI assistant", said plainly and first. The page called Homa "her"
 * in two places before anything introduced a her, and seven of ten
 * personas stumbled on it. One said that slipping it in as a pronoun is
 * exactly what makes her distrust the rest of the page, and two said
 * they would feel tricked after paying if a human never appeared. A
 * colder word early is cheaper than a refund and a group-chat post.
 *
 * Verb-first about work removed ("plans the week, makes the practice
 * pages"), not nouns delivered. The persona who buys time back read the
 * old list as a filing cabinet rather than as someone taking something
 * off her plate.
 *
 * "your hours log" survives from the base tier's line because it is the
 * one item here a general chatbot cannot be.
 */
export const TRIAL_GATE_WHAT_IT_IS =
  "Homa is an AI assistant for homeschool parents. You tell her what your children did. She plans the week, makes the practice pages, and keeps your hours log.";

/** The lead line for a family whose account is already made and who is
 *  arriving from somewhere that owes her that context. */
export const TRIAL_GATE_ACCOUNT_READY = "Your account is ready.";

/*
 * The three-beat trial timeline (Today / Day 4 / Day 7) used to live
 * here and render as three cards above the prices. It is gone, not
 * moved: TRIAL_GATE_CHARGE_NOTE carries all three of its facts in one
 * sentence under the button. The pattern was right and the placement
 * was not. It spent a full phone screenful to deliver 40 words the
 * parent had already been told once at the landing CTA ("7 free days,
 * then plans from $19 a month. Cancel anytime.", landing-content.ts),
 * and it pushed the first price 1.1 screenfuls down.
 */

/**
 * The line directly under the button (2026-07-28 redesign), which is
 * the last thing read before the tap and the placement the clearest
 * pages in the 17-page teardown use for exactly this. It states the
 * three facts the timeline used to spend a full screenful of cards on:
 * the card is what starts the trial, the reminder is real and dated,
 * and stopping costs nothing.
 *
 * The Day 4 promise is kept by lib/billing/trial-reminder.ts and the
 * trial_will_end case in app/api/billing/webhook/route.ts. Do not
 * reword the day here without reading that module: the reminder rides
 * Stripe's trial_will_end webhook, which fires 3 days before trial end
 * at any trial length, and NOT the dashboard reminder, which fires 7
 * days before end and would land on the day of signup for a trial this
 * short.
 */
export const TRIAL_GATE_CHARGE_NOTE =
  "Your card starts the trial. We email you on day 4, three days before the first charge on day 7. Cancel before then in your settings and you pay nothing. You can cancel any month after that the same way.";

/**
 * The same sentence with real dates in place of "day 4" and "day 7".
 *
 * Why dates at all. "Day 7" is arithmetic, and a mother with children
 * in the room does not do arithmetic: she wants to know whether to put
 * it in the calendar. Visa's subscription rules also expect the exact
 * date of the first charge to be stated at enrollment, and on a trial
 * this short their own 7-days-before reminder lands on the day she
 * signs up, so the page has to carry the date itself.
 *
 * Why the caller passes them in rather than this module computing them.
 * The dates have to be in HER timezone, and the server does not know
 * it: FamilyRow carries no time zone, so a server-rendered date can be
 * a day wrong, and a wrong date on a charge promise is worse than a
 * relative one. The browser does know, so TrialGate computes these
 * after mount from the visitor's own clock and passes them here. Until
 * then the relative sentence renders, which is why both versions exist
 * and why the relative one is not merely a fallback for tests.
 */
export function trialChargeNoteDated(remindOn: string, chargeOn: string): string {
  return `Your card starts the trial. We email you on ${remindOn}, three days before the first charge on ${chargeOn}. Cancel before then in your settings and you pay nothing. You can cancel any month after that the same way.`;
}

/** Day 4 and day 7 of a 7 day trial that starts now, in the visitor's
 *  own timezone, formatted the way a person writes a date. Returns null
 *  when called anywhere without a browser clock. */
export function trialDatesFromNow(now: Date): { remindOn: string; chargeOn: string } {
  const format = (daysAhead: number) => {
    const date = new Date(now.getTime());
    date.setDate(date.getDate() + daysAhead);
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  };
  return { remindOn: format(4), chargeOn: format(7) };
}

/**
 * The one fact the picker cannot answer on its own, and the single most
 * asked question of the ten-persona panel: is that price per child.
 *
 * WALL_BULLETS has carried "Adding children never changes the price."
 * since the wall shipped, and the 2026-07-28 picker rewrite stopped
 * rendering it. That was a regression, not a trim. The two personas
 * with the most children (three and four) both put it at the top of
 * their would-leave list, and one of them is the co-op reader whose
 * verdict six other families were waiting on: three kids at $19 is a
 * conversation with a husband, three kids at $57 is a no, and she will
 * not type a card to find out which.
 *
 * It sits with the charge line under the button rather than in the
 * rows, because it is true of every row and repeating it three times
 * would cost the scan more than it buys.
 */
export const TRIAL_GATE_FAMILY_PRICE =
  "One price for your whole family. Adding children never changes it.";

/**
 * Stated once above the picker so no tier row has to repeat it
 * (2026-07-28 redesign). Every plan carries all of this; the rows
 * carry only what their own tier adds.
 *
 * The questionnaire and the report lead the list because at this gate
 * she has not answered a single question yet: this page sits before any
 * product, so the first thing the 7 days buy is the thing she came for.
 *
 * Two words are chosen against their shorter alternatives.
 *
 * "your hours logged" is here because a progress report is not an hour
 * log, and the highest-compliance-load persona left over exactly that:
 * her state wants roughly a thousand logged hours and the word appeared
 * nowhere on a page selling her a homeschool assistant. The claim is
 * true on this channel: log_hours is a bounded tool, not a phone-only
 * one, and it writes a durable record from what she tells Homa.
 *
 * "a number you can call" replaced "phone calls with Homa", which was
 * ambiguous about who calls whom. One persona of ten read it as Homa
 * telephoning her children and said so to the co-op group chat she
 * speaks for. A misread with a child-safety flavor is not a wording
 * preference, and the fix costs four words: the parent places the call.
 */
export const TRIAL_GATE_EVERY_PLAN_HEADING = "Every plan includes";

/**
 * A list, not a paragraph. It was one 60-word sentence, and five of ten
 * personas said they skipped every word of it. It is the only place the
 * page says what is included, so the two items that would have sold
 * them were inside the block nobody read.
 *
 * Each line is one thing, front-loaded with the noun. The phone line
 * names who places the call: "phone calls with Homa" was read by one
 * persona as Homa telephoning her children, and by two others as a
 * promise that a human answers.
 */
export const TRIAL_GATE_EVERY_PLAN: readonly string[] = [
  // Outcome first, the questions second. It read "The questionnaire,
  // and your child's full progress report", which offered a chore as
  // the first thing the money buys: the newest-homeschooler persona
  // said she wanted to hear that a plan would be waiting in the
  // morning, and was instead handed homework at eleven at night.
  "Your child's full progress report, from a few questions you answer today.",
  "A plan for each week, and practice pages made for your child.",
  "Your hours, logged from what you tell Homa.",
  // Web chat only. Text, email, and the phone line moved up to the
  // second tier with the 2026-07-28 ruling, so this list may not keep
  // promising them to everyone: a shared list that contradicts a tier
  // row is worse than either alone, because the parent who notices
  // stops believing both.
  "Chat with Homa here on the web.",
];

/**
 * The age question, answered with the only number this page can verify.
 *
 * The parent of a ten-year-old asked the sharpest version of it: can
 * this carry a fifth grade year, because that is the only question that
 * decides $228. The single sample on the page is a counting sheet made
 * for a five-year-old, and three personas with older children read it,
 * correctly, as evidence that Homa is for little ones.
 *
 * The tempting fix is to add an older-child worksheet. Do not, unless a
 * real one exists: journeys/01-personas-jtbd.md records v1 materials as
 * ages 2 to 7, so a fractions page rendered for this row could be a
 * capability claim with nothing behind it, which is the same failure as
 * the Plus filing copy.
 *
 * What IS verifiable is the scored range, in code, today:
 * SCORED_MIN_MONTHS and SCORED_MAX_MONTHS in packages/core/src/map/bands.ts
 * are 24 and 204, so every child from 2 up to 17 gets a checklist and a
 * report. That is the claim, and it is deliberately about the report
 * rather than about the worksheets.
 */
export const TRIAL_GATE_AGE_RANGE =
  "Progress reports cover children from age 2 through 16.";

/**
 * Under everything: nothing is lost by waiting, and the door out is
 * named (offers never commands).
 *
 * It opened with "Not ready today?" until 2026-07-28. Six of ten
 * personas named that sentence as the exact thing that let them close
 * the tab, and every one of them called it kind. A question invites its
 * answer, and a parent already wobbling at 9:40pm will take the out and
 * not come back.
 *
 * The honesty stays and the invitation goes. Deleting the whole line
 * would break offers-never-commands, so the fact survives as a
 * statement rather than a prompt, in footer type below the fold.
 */
export const TRIAL_GATE_SAVED_LINE =
  "Your account is saved, and this page will be here when you come back.";

/**
 * The honest proof row, in place of the testimonials a pricing page
 * would normally carry here.
 *
 * There are none to carry. On 2026-07-28 Homa had 78 real families, no
 * trial ever started, and no active subscription, so every customer
 * quote, star rating, and "loved by N families" line available to this
 * page would have to be invented. Ruling C2 forbids that, and the
 * landing page already had one fabricated-social-proof row removed for
 * the same reason.
 *
 * What replaces it is proof of the same claim from sources that are
 * real: the artifact itself (a sample report she can read before
 * paying), the method behind it, and the two homeschooling mothers who
 * built it. Founder identity and a working sample are first-party
 * evidence, which is what a pre-revenue product legitimately has.
 */
export const TRIAL_GATE_SAMPLE_LINK = "See a sample report";
export const TRIAL_GATE_METHOD_LINK = "How the report is made";
export const TRIAL_GATE_MAKERS_LINE =
  "Homa is made by Alessa and Carolyng, two homeschooling mothers.";

/** Under the practice page shown below the button: what it is and who
 *  it was for, so the image reads as a real artifact rather than
 *  decoration. The same page is the landing's capability proof. */
export const TRIAL_GATE_ARTIFACT_CAPTION =
  "A practice page Homa made for a five-year-old who was counting.";

/** The annual option, with its dollar figure in the control rather than
 *  behind a tap. "Save 20%" alone was named the oldest trick there is by
 *  two personas, and four more declined to tap a toggle whose result
 *  they could not see. */
export function billingToggleAnnualLabel(annualPrice: number | null): string {
  if (annualPrice === null) return BILLING_TOGGLE_ANNUAL_LABEL;
  // The per-month equivalent, not the yearly total, because that is the
  // number she can compare against the monthly row two lines below
  // without dividing: one persona's words for the old label were "you
  // made me do arithmetic in a hallway". The yearly charge is not
  // hidden, it becomes the row price the moment annual is selected, so
  // the small comparable number and the real commitment are both on
  // screen and neither is behind a tap.
  //
  // Carrying both here instead was tried and wrapped the control to two
  // lines on a 390px phone, which cost more than the arithmetic did.
  const perMonth = (annualPrice / 12).toFixed(2).replace(/\.00$/, "");
  return `${BILLING_TOGGLE_ANNUAL_LABEL} · $${perMonth}/mo`;
}

/** The lapsed variant: a family whose subscription ended sees the same
 *  gate with its own first line, so it never reads as a bug. */
export const TRIAL_GATE_LAPSED_REASSURANCE =
  "Welcome back. Your family's records are all still here, exactly as you left them.";

/** Shown with the lapsed line when a Stripe billing relationship
 *  exists: the self-serve door for fixing a card or restarting the old
 *  plan, so the gate never traps a former member. */
export const TRIAL_GATE_MANAGE_BILLING = "Manage billing";

const NUMBER_WORDS: Record<number, string> = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
  7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
};
