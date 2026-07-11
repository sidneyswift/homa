import type { WallDoor } from "@homa/core";

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
    case "call":
      return `Your 30 free days include the call you asked for, four-week plans, worksheets made for ${kid}, and chat.`;
    case "chat":
      return `Your 30 free days include this chat, four-week plans, worksheets made for ${kid}, and phone calls.`;
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

/** The buttons differ from the first words (editor gate: twin labels
 *  whose only difference sat after the mid-dot forced a compare-the-
 *  endings pause at the commitment point). */
export const WALL_MONTHLY_BUTTON = "Start your 30 free days \u00b7 then $19 a month";

export const WALL_ANNUAL_BUTTON = "Choose the year instead \u00b7 then $99 a year";

/** The year's math done for her ($99 / 12, real division), and the
 *  children fact as a full sentence (editor gate: "Unlimited kids, one
 *  price" collided with the two prices right above it). */
export const WALL_BULLETS = [
  "The year works out to $8.25 a month.",
  "Adding children never changes the price.",
  "Cancel anytime.",
] as const;

export const WALL_DISMISS = "Not now";

/** The rare race where a door was tapped right as the wall went up on
 *  the server. Copy-kit shape: name it, settle the nerves (her report
 *  is untouched), then the next step, which honestly delivers the
 *  offer card, not the trial itself (editor gate). */
export const WALL_STALE_MONTH_LINE =
  "The month didn't open. Your report is safe and still free. Refresh this page to see the membership offer.";

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
