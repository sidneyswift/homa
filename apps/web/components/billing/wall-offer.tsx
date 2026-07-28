"use client";

import type { WallDoor } from "@homa/core";

import type { WallCheckout } from "../../lib/billing/wall-types";
import { TierOptions } from "./tier-options";
import { WALL_EYEBROW, WALL_HEADLINE, WALL_MECHANICS_LINE, wallIncludedLine, wallReportLine } from "./wall-copy";

/**
 * The wall's offer card: the words, the two Payment Link buttons, and
 * nothing else. Dialog chrome (scrim, Not now, escape) belongs to
 * WallModal; the plan page composes this into its own full-page shell
 * with "back to the report" as the way out. Checkout opens the Stripe
 * Payment Link in the same tab; Stripe redirects back to
 * /api/billing/confirm, which stamps the trial and lands on /app.
 */
export function WallOffer({
  door,
  childName,
  checkout,
}: {
  door: WallDoor;
  childName?: string | null;
  checkout: WallCheckout;
}) {
  return (
    <div>
      {/* No uppercase transform: WALL_EYEBROW is "Homa membership", and
          rendering it uppercase puts "HOMA" on screen, which the
          2026-07-28 brand correction (`brand-casing-homa`) retires. The
          name is always written "Homa", and where the brand appears as
          a mark it is the real Logo component, never a text imitation
          of it. */}
      <p
        className="font-mono text-[0.7rem] tracking-wide"
        style={{ color: "var(--sage-700)" }}
      >
        {WALL_EYEBROW}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-strong">
        {WALL_HEADLINE}
      </h2>
      {/* Reassure before inform (and the reader gate's bridge): the
          report she already has is hers for good, then the thing she
          just tapped, named, inside what the 7 free days include. */}
      <p className="mt-3 text-body">{wallReportLine(childName)}</p>
      <p className="mt-2 text-body">{wallIncludedLine(door, childName)}</p>
      <p className="mt-2 text-body">{WALL_MECHANICS_LINE}</p>
      <TierOptions door={door} checkout={checkout} />
    </div>
  );
}
