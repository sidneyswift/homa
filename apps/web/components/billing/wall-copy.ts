import type { WallDoor } from "@homa/core";

import type { BillingPeriod, PlanTier } from "../../lib/billing/wall-types";

/**
 * Every parent-facing word on the wall, in one reviewable file
 * (plans/2026-07-11-the-wall.md; copy rulebook:
 * .agents/skills/homa-copy-writer/SKILL.md). The wall is an offer, never
 * a scold: the report stays free forever, and the wall only appears at
 * the first tap on an action door. Both copy gates ran 2026-07-11
 * (reader, then editor); the founder read-aloud is the last gate
 * (HUMAN-TODO) before the flag ever flips.
 *
 * Vocabulary laws for this surface:
 * - The trial is "your 30 free days", never "your free month": the
 *   reader gate tangled the trial month with the child's month plan
 *   the instant both were on screen. "month" appears only as the $19
 *   price unit.
 * - Included lines share ONE frame, "Your 30 free days include X",
 *   where X is the thing she just tapped (the reader gate's bridge),
 *   named first in the list (editor gate: stacked "comes with...
 *   along with" was doing containment work twice).
 * - Price labels are the founder's v1 sticker prices (build-log
 *   2026-07-06) and must match the Stripe Payment Links the env vars
 *   point at; change them together, and keep the links' trial at 30
 *   days so these words stay true.
 */

export const WALL_EYEBROW = "Homa membership";

export const WALL_HEADLINE = "Try Homa free for 30 days";

/** The reassurance, first (reader gate: this landing first is what let
 *  her relax): the thing she already has is hers for good. */
export function wallReportLine(childName?: string | null): string {
  const whose = childName ? `${childName}'s` : "Your child's";
  return `${whose} progress report is free, forever.`;
}

/** The bridge: what she reached for, named first inside what the 30
 *  free days include, in concrete household words. */
export function wallIncludedLine(door: WallDoor, childName?: string | null): string {
  const kid = childName ?? "your child";
  switch (door) {
    case "plan":
      return `Your 30 free days include the four-week plan you tapped, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    case "month":
      return childName
        ? `Your 30 free days include ${childName}'s month, worksheets made for ${childName}, phone calls with Homa, and chat.`
        : `Your 30 free days include the month you tapped, worksheets made for your child, phone calls with Homa, and chat.`;
    case "lesson":
      return `Your 30 free days include the lesson you tapped, its printable worksheet, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    case "call":
      return `Your 30 free days include the call you asked for, four-week plans, worksheets made for ${kid}, and chat.`;
    case "chat":
      return `Your 30 free days include this chat, four-week plans, worksheets made for ${kid}, and phone calls.`;
    case "report":
      return `Your 30 free days include every subject in ${kid === "your child" ? "the" : `${kid}'s`} report, four-week plans, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    case "signup":
      return `Your 30 free days include the questionnaire and ${kid === "your child" ? "your child's" : `${kid}'s`} full progress report, weekly plans, worksheets made for ${kid}, phone calls with Homa, and chat.`;
    default: {
      const exhaustive: never = door;
      throw new Error(`Unhandled wall door: ${exhaustive}`);
    }
  }
}

/** The ask, unmistakable on the first pass (reader gate: "card" alone
 *  read as the card on screen), then one fact per sentence. */
export const WALL_MECHANICS_LINE =
  "A credit card starts your 30 free days. Nothing is charged during them. You get an email before the first charge.";

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
  regular: "Homa",
  plus: "Homa Plus",
  elite: "Homa Max",
};

/** The featured/recommended tier for the pricing-card redesign
 *  (founder screenshots 2026-07-26): Plus is the natural middle upsell
 *  target between the base and top tiers, so its card carries the
 *  "Most popular" badge and the elevated styling. */
export const TIER_FEATURED: PlanTier = "plus";

export const TIER_MOST_POPULAR_BADGE = "Most popular";

/** Every annual price is 20% off the monthly price times twelve, rounded
 *  to the nearest dollar (founder ruling 2026-07-26): $19, $49, and $199
 *  a month become $182, $470, and $1,910 a year. */
const TIER_PRICES: Record<PlanTier, { monthly: number; annual: number | null }> = {
  regular: { monthly: 19, annual: 182 },
  plus: { monthly: 49, annual: 470 },
  elite: { monthly: 199, annual: 1910 },
};

export function tierMonthlyButton(tier: PlanTier): string {
  return `Start your 30 free days · then $${TIER_PRICES[tier].monthly} a month`;
}

/** The tier picker's single CTA (2026-07-26: a monthly/annual toggle
 *  replaced the old two-stacked-buttons layout, one button per tier at
 *  a time). Falls back to the monthly button if this tier's annual
 *  link isn't configured, so a stale toggle selection never dead-ends
 *  a tier that only ships monthly. */
export function tierButtonLabel(tier: PlanTier, period: BillingPeriod): string {
  if (period === "monthly") return tierMonthlyButton(tier);
  const annual = TIER_PRICES[tier].annual;
  if (annual === null) return tierMonthlyButton(tier);
  return `Start your 30 free days · then $${annual.toLocaleString("en-US")} a year`;
}

/** The bare number for the pricing-card redesign's large price display
 *  (founder screenshots 2026-07-26), shown above the existing CTA
 *  button, which keeps its own full sentence (tierButtonLabel)
 *  unchanged. Falls back to the monthly price if this tier's annual
 *  price is somehow null, matching tierButtonLabel's own fallback. */
export function tierPriceAmount(tier: PlanTier, period: BillingPeriod): number {
  if (period === "monthly") return TIER_PRICES[tier].monthly;
  const annual = TIER_PRICES[tier].annual;
  return annual === null ? TIER_PRICES[tier].monthly : annual;
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
  const price = TIER_PRICES[tier];
  if (period === "annual" && price.annual !== null) {
    const perMonth = (price.annual / 12).toFixed(2).replace(/\.00$/, "");
    return [`The year works out to $${perMonth} a month.`, ...WALL_BULLETS];
  }
  return [...WALL_BULLETS];
}

/** One line per tier, reassurance-shaped (what it adds, in her words),
 *  never a features table. */
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
  return `${open} open in full. Your 30 free days open the other ${held}, plus four-week plans, worksheets made for ${kid}, phone calls with Homa, and chat.`;
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
export const TRIAL_GATE_EYEBROW = "Homa membership";

export const TRIAL_GATE_HEADLINE = "Try Homa free for 30 days";

/** Reassurance first: the account is made and everything she does next
 *  is kept. The gate is the next step, not a toll on what she has. */
export const TRIAL_GATE_REASSURANCE =
  "Your account is ready. Pick a plan to start your 30 free days; everything below is open the whole time.";

/** The Blinkist-style timeline: what happens today, before the charge,
 *  and on day 30, each as one plain fact. */
export const TRIAL_GATE_TIMELINE: ReadonlyArray<{ marker: string; line: string }> = [
  {
    marker: "Today",
    line: "A credit card starts your 30 free days. Nothing is charged today.",
  },
  {
    marker: "Day 23",
    line: "We email you a reminder, a week before the first charge.",
  },
  {
    marker: "Day 30",
    line: "Your plan begins. Cancel before then and you pay nothing.",
  },
];

/** Above the tiers: what the 30 free days hold, in household words. */
export const TRIAL_GATE_INCLUDED_LINE =
  "Your 30 free days include the questionnaire and your child's full progress report, weekly plans, worksheets made for your child, phone calls with Homa, and chat.";

/** Under the tiers: nothing is lost by waiting, and the door out is
 *  named (offers never commands). */
export const TRIAL_GATE_SAVED_LINE =
  "Not ready today? Everything you've entered is saved to your account, and this page will be here when you come back.";

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
