"use client";

import type { WallDoor } from "@homa/core";

import type { WallCheckout } from "../../lib/billing/wall-types";
import { TierOptions } from "./tier-options";
import { WALL_EYEBROW, WALL_MECHANICS_LINE, wallHeadline, wallIncludedLine } from "./wall-copy";

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
    <div className="quiet-paywall__content" data-brand-layer="wall-offer">
      {/* No uppercase transform: WALL_EYEBROW is "Homa membership", and
          rendering it uppercase puts "HOMA" on screen, which the
          2026-07-28 brand correction (`brand-casing-homa`) retires. The
          name is always written "Homa", and where the brand appears as
          a mark it is the real Logo component, never a text imitation
          of it. */}
      <p
        className="quiet-paywall__eyebrow"
      >
        {WALL_EYEBROW}
      </p>
      <h2 className="quiet-paywall__heading">
        {wallHeadline(door)}
      </h2>
      {/* Name the thing she just tapped first. Leading an action-door
          offer with report reassurance made the destination look wrong. */}
      <p className="quiet-paywall__copy quiet-paywall__copy--lead">{wallIncludedLine(door, childName)}</p>
      <TierOptions door={door} checkout={checkout} />
      {/* Keep the full renewal terms next to the consent control, where
          they answer risk without delaying the parent's first price. */}
      <p className="quiet-paywall__gate-charge-note">{WALL_MECHANICS_LINE}</p>
    </div>
  );
}
