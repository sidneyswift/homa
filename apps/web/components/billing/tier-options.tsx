"use client";

import { useState } from "react";

import type { WallDoor } from "@homa/core";

import { reportButtonClass } from "../../app/onboarding/r/[token]/report-button";
import type { BillingPeriod, PlanTier, TierCheckout } from "../../lib/billing/wall-types";
import { sendWallBeacon } from "./wall-beacon";
import {
  BILLING_TOGGLE_ANNUAL_BADGE,
  BILLING_TOGGLE_ANNUAL_LABEL,
  BILLING_TOGGLE_MONTHLY_LABEL,
  TIER_NAMES,
  tierBullets,
  tierButtonLabel,
  tierDescription,
} from "./wall-copy";

const TIER_ORDER: PlanTier[] = ["regular", "plus", "elite"];

/**
 * The three-tier picker (2026-07-26: a monthly/annual toggle replaced
 * the old layout of two stacked buttons per card). One toggle above
 * all three cards, since every tier's annual price is the same 20%
 * off monthly (founder ruling 2026-07-26): a single "Save 20%" badge
 * says that once instead of a per-card dollar figure, and switching it
 * changes all three cards' price and button together, the standard
 * SaaS pricing-page pattern. The toggle itself only renders when at
 * least one tier actually has an annual link configured; until then
 * every card just shows its monthly price, same as before annual
 * pricing existed. A tier with no checkout at all (Payment Links not
 * configured for this environment) doesn't render; regular is always
 * present or the wall itself would not have opened.
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
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const anyAnnualAvailable = TIER_ORDER.some((tier) => checkout[tier]?.annualUrl);

  return (
    <div className="mt-5 flex flex-col gap-4">
      {anyAnnualAvailable ? (
        <div
          role="tablist"
          aria-label="Billing period"
          className="inline-flex w-fit items-center gap-1 self-center rounded-pill border border-border bg-card p-1"
        >
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={period === option}
              onClick={() => setPeriod(option)}
              className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition duration-(--dur-fast) ease-out motion-safe:active:scale-[var(--press-scale)] ${
                period === option ? "bg-brand text-on-brand" : "text-muted hover:text-strong"
              }`}
            >
              {option === "monthly" ? BILLING_TOGGLE_MONTHLY_LABEL : BILLING_TOGGLE_ANNUAL_LABEL}
              {option === "annual" ? (
                <span className="ml-1 text-xs font-normal opacity-80">{BILLING_TOGGLE_ANNUAL_BADGE}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {TIER_ORDER.map((tier) => {
        const tierCheckout = checkout[tier];
        if (!tierCheckout) return null;
        const usingAnnual = period === "annual" && Boolean(tierCheckout.annualUrl);
        const url = usingAnnual ? (tierCheckout.annualUrl as string) : tierCheckout.monthlyUrl;
        return (
          <div
            key={tier}
            className="rounded-md border border-border-subtle bg-card p-4"
          >
            <h3 className="font-display text-lg font-bold text-strong">{TIER_NAMES[tier]}</h3>
            <p className="mt-1 text-sm text-muted">{tierDescription(tier)}</p>
            <a
              href={url}
              onClick={() => {
                onBeforeCheckout?.();
                sendWallBeacon({
                  kind: "checkout_started",
                  door,
                  plan: usingAnnual ? "annual" : "monthly",
                  tier,
                });
              }}
              className={reportButtonClass(
                tier === "regular" ? "primary" : "secondary",
                "mt-3 inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-semibold",
              )}
            >
              {tierButtonLabel(tier, usingAnnual ? "annual" : "monthly")}
            </a>
            <ul className="mt-3 flex flex-col gap-1">
              {tierBullets(tier, usingAnnual ? "annual" : "monthly").map((line) => (
                <li key={line} className="text-sm text-muted">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
