"use client";

import type { WallDoor } from "@homa/core";

import { reportButtonClass } from "../../app/onboarding/r/[token]/report-button";
import type { PlanTier, TierCheckout } from "../../lib/billing/wall-types";
import { sendWallBeacon } from "./wall-beacon";
import {
  TIER_NAMES,
  tierAnnualBullets,
  tierAnnualButton,
  tierDescription,
  tierMonthlyButton,
} from "./wall-copy";

const TIER_ORDER: PlanTier[] = ["regular", "plus", "elite"];

/**
 * The three-tier picker: one card per sellable tier, each with its own
 * monthly button (always shown) and annual button (shown when that
 * tier's annual Payment Link is configured, same narrowing rule the
 * single-tier wall already used). A tier with no checkout at all
 * (Payment Links not configured for this environment) doesn't render;
 * regular is always present or the wall itself would not have opened.
 */
export function TierOptions({
  door,
  checkout,
  onBeforeCheckout,
}: {
  door: WallDoor;
  checkout: { regular: TierCheckout; plus: TierCheckout | null; elite: TierCheckout | null };
  /** Fires before navigation on any tier's button, e.g. the report
   *  lock's short-lived child cookie so checkout knows which child's
   *  report the trial started from. */
  onBeforeCheckout?: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {TIER_ORDER.map((tier) => {
        const tierCheckout = checkout[tier];
        if (!tierCheckout) return null;
        const annualButton = tierAnnualButton(tier);
        return (
          <div
            key={tier}
            className="rounded-md border border-border-subtle bg-card p-4"
          >
            <h3 className="font-display text-lg font-bold text-strong">{TIER_NAMES[tier]}</h3>
            <p className="mt-1 text-sm text-muted">{tierDescription(tier)}</p>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={tierCheckout.monthlyUrl}
                onClick={() => {
                  onBeforeCheckout?.();
                  sendWallBeacon({ kind: "checkout_started", door, plan: "monthly", tier });
                }}
                className={reportButtonClass(
                  tier === "regular" ? "primary" : "secondary",
                  "inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-semibold",
                )}
              >
                {tierMonthlyButton(tier)}
              </a>
              {tierCheckout.annualUrl && annualButton ? (
                <a
                  href={tierCheckout.annualUrl}
                  onClick={() => {
                    onBeforeCheckout?.();
                    sendWallBeacon({ kind: "checkout_started", door, plan: "annual", tier });
                  }}
                  className={reportButtonClass(
                    "secondary",
                    "inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-semibold",
                  )}
                >
                  {annualButton}
                </a>
              ) : null}
            </div>
            <ul className="mt-3 flex flex-col gap-1">
              {(tierCheckout.annualUrl ? tierAnnualBullets(tier) : tierAnnualBullets(tier).slice(1)).map(
                (line) => (
                  <li key={line} className="text-sm text-muted">
                    {line}
                  </li>
                ),
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
