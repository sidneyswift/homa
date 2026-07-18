"use client";

import type { WallDoor } from "@homa/core";

import { reportButtonClass } from "../../app/onboarding/r/[token]/report-button";
import type { WallCheckout } from "../../lib/billing/wall-types";
import { sendWallBeacon } from "./wall-beacon";
import {
  WALL_ANNUAL_BUTTON,
  WALL_BULLETS,
  WALL_EYEBROW,
  WALL_HEADLINE,
  WALL_MECHANICS_LINE,
  WALL_MONTHLY_BUTTON,
  wallIncludedLine,
  wallReportLine,
} from "./wall-copy";

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
      <p
        className="font-mono text-[0.65rem] uppercase tracking-widest"
        style={{ color: "var(--sage-700)" }}
      >
        {WALL_EYEBROW}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-strong">
        {WALL_HEADLINE}
      </h2>
      {/* Reassure before inform (and the reader gate's bridge): the
          report she already has is hers for good, then the thing she
          just tapped, named, inside what the 30 free days include. */}
      <p className="mt-3 text-body">{wallReportLine(childName)}</p>
      <p className="mt-2 text-body">{wallIncludedLine(door, childName)}</p>
      <p className="mt-2 text-body">{WALL_MECHANICS_LINE}</p>
      <div className="mt-5 flex flex-col gap-2">
        <a
          href={checkout.monthlyUrl}
          onClick={() => sendWallBeacon({ kind: "checkout_started", door, plan: "monthly" })}
          className={reportButtonClass(
            "primary",
            "inline-flex min-h-12 items-center justify-center px-6 py-3 text-sm font-semibold",
          )}
        >
          {WALL_MONTHLY_BUTTON}
        </a>
        {checkout.annualUrl ? (
          <a
            href={checkout.annualUrl}
            onClick={() => sendWallBeacon({ kind: "checkout_started", door, plan: "annual" })}
            className={reportButtonClass(
              "secondary",
              "inline-flex min-h-12 items-center justify-center px-6 py-3 text-sm font-semibold",
            )}
          >
            {WALL_ANNUAL_BUTTON}
          </a>
        ) : null}
      </div>
      <ul className="mt-4 flex flex-col gap-1">
        {/* The first bullet is the year's math; without an annual link
            on offer it would explain a price that is not on screen. */}
        {(checkout.annualUrl ? WALL_BULLETS : WALL_BULLETS.slice(1)).map((line) => (
          <li key={line} className="text-sm text-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
