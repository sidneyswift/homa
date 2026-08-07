"use client";

import { useId, useState } from "react";

import { PURCHASABLE_HOMA_PLANS, type WallDoor } from "@homa/core";

import type { BillingPeriod, PlanTier, TierCheckout } from "../../lib/billing/wall-types";
import { sendWallBeacon } from "./wall-beacon";
import {
  BILLING_TOGGLE_ANNUAL_BADGE,
  BILLING_TOGGLE_MONTHLY_LABEL,
  TIER_NAMES,
  billingToggleAnnualLabel,
  TRIAL_GATE_CTA,
  TRIAL_GATE_FAMILY_PRICE,
  tierChargeLine,
  tierDelta,
  tierPriceAmount,
  tierPriceUnit,
} from "./wall-copy";

const TIER_ORDER: PlanTier[] = PURCHASABLE_HOMA_PLANS.map(({ tier }) => tier);

/**
 * The tier picker: one row per available plan and one button
 * (2026-07-28 redesign).
 *
 * It replaced three stacked cards that each carried a name, a 1 to 3
 * sentence description, a price, a 40-character button, and two
 * checkmark bullets. Measured on a 390px phone, that layout put its
 * first price 1.1 screenfuls down behind 149 words, showed none of the
 * three prices in the first screenful, and offered three competing
 * primary actions. A teardown of 17 shipping pricing pages put the
 * median distance from the top of a phone screen to the first price at
 * 12 words.
 *
 * So the shape inverted. Each available tier is one row: name, one line
 * of what that tier includes, and the price, with the shared contents
 * stated once above the picker instead of repeating them in every row.
 * Selecting a row arms a single button. All available prices are
 * legible in one glance and comparable without scrolling, and the page
 * has exactly one primary action instead of one per tier.
 *
 * Two deliberate ethics choices, both against the grain of the paywalls
 * this pattern was taken from:
 *
 * 1. The default selection is the CHEAPEST tier. A pre-selected upsell
 *    is the most common dark pattern in this pattern's own lineage
 *    (Headspace pre-selects the plan WITHOUT the free trial), and Homa
 *    offers, never commands.
 * 2. No row carries an endorsement badge. "Most popular" was a
 *    popularity claim with no customers to support it, and the
 *    "Recommended" that replaced it was flagged by all ten parents in
 *    the review panel, three as a reason to leave: an endorsement on
 *    the pricier row turns a yes-or-no into a which-one. When more than
 *    one tier is available, each routes on its own line instead. Full
 *    reasoning lives in wall-copy.ts above TIER_NAMES.
 *
 * A tier with no checkout at all (Payment Links not configured for this
 * environment) doesn't render; regular is always present or the wall
 * itself would not have opened. The billing toggle only renders when at
 * least one tier actually has an annual link, so an environment with
 * monthly-only links shows monthly prices with no dead control.
 */
export function TierOptions({
  door,
  checkout,
  onBeforeCheckout,
}: {
  door: WallDoor;
  checkout: { regular: TierCheckout; plus: TierCheckout | null; elite: TierCheckout | null };
  /** Fires before navigation on the button, e.g. the report lock's
   *  short-lived child cookie so checkout knows which child's report the
   *  trial started from. */
  onBeforeCheckout?: () => void;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selected, setSelected] = useState<PlanTier>("regular");
  const groupId = useId();

  const available = TIER_ORDER.filter((tier) => checkout[tier]);
  const anyAnnualAvailable = available.some((tier) => checkout[tier]?.annualUrl);

  // A selection can outlive the tier that carried it only if checkout
  // changed under the component, which nothing here does; falling back
  // to regular keeps the button armed rather than dead in that case.
  const activeTier = available.includes(selected) ? selected : "regular";
  const activeCheckout = checkout[activeTier] ?? checkout.regular;
  const usingAnnual = period === "annual" && Boolean(activeCheckout.annualUrl);
  const effectivePeriod: BillingPeriod = usingAnnual ? "annual" : "monthly";
  const href = usingAnnual ? (activeCheckout.annualUrl as string) : activeCheckout.monthlyUrl;

  return (
    <div className="quiet-tier-options quiet-paywall__tier-options" data-brand-layer="tier-options">
      {anyAnnualAvailable ? (
        // A tablist promises tab panels that do not exist here; this is
        // one choice between two options, so it is a real radio group
        // too, styled as a segmented control.
        //
        // self-start, not self-center: the page runs on one left
        // reading axis (headline, rows, and every line under the
        // button), and a centered control in the middle of it makes the
        // eye jump sideways on the way to the prices.
        <fieldset className="quiet-paywall__period">
          <legend className="sr-only">Billing period</legend>
          <div className="quiet-paywall__period-options">
            {(["monthly", "annual"] as const).map((option) => (
              <label
                key={option}
                htmlFor={`${groupId}-period-${option}`}
                // min-h-11 is the 44px touch minimum; the old pill was 32px.
                className={`quiet-paywall__period-option ${
                  period === option
                    ? "quiet-paywall__period-option--selected"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  id={`${groupId}-period-${option}`}
                  name={`${groupId}-period`}
                  value={option}
                  checked={period === option}
                  onChange={() => setPeriod(option)}
                  className="sr-only"
                />
                {option === "monthly"
                  ? BILLING_TOGGLE_MONTHLY_LABEL
                  : // The dollar figure lives in the control, not behind
                    // a tap. "Save 20%" with no number was named the
                    // oldest trick there is by two of ten personas, and
                    // four more declined to tap a toggle whose result
                    // they could not see.
                    billingToggleAnnualLabel(
                      tierPriceAmount(activeTier, "annual"),
                    )}
                {option === "annual" ? (
                  <span className="quiet-paywall__period-badge">
                    {BILLING_TOGGLE_ANNUAL_BADGE}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Native radios, not buttons with role="radio". An ARIA
          radiogroup owes its user roving tabindex and arrow-key
          movement between options, and hand-rolling that correctly is
          strictly more code than using the element that already does
          it. The input is visually hidden but focusable, so keyboard
          and screen-reader behaviour is the platform's, and
          focus-within paints the ring on the whole row. */}
      <fieldset className="quiet-paywall__tiers">
        <legend className="sr-only">Plan</legend>
        {available.map((tier) => {
          const isSelected = tier === activeTier;
          const rowPeriod: BillingPeriod =
            period === "annual" && checkout[tier]?.annualUrl ? "annual" : "monthly";
          return (
            <label
              key={tier}
              htmlFor={`${groupId}-${tier}`}
              // items-start, not items-center: the control reads as
              // belonging to the tier NAME, and centering it against a
              // row whose height varies with how the delta line wraps
              // leaves it floating beside nothing.
              className={`quiet-paywall__tier ${
                isSelected
                  ? "quiet-paywall__tier--selected"
                  : ""
              }`}
            >
              <input
                type="radio"
                id={`${groupId}-${tier}`}
                name={groupId}
                value={tier}
                checked={isSelected}
                onChange={() => setSelected(tier)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="quiet-paywall__tier-radio"
              >
                {isSelected ? (
                  <span className="quiet-paywall__tier-radio-mark" />
                ) : null}
              </span>

              {/* Name and price share the top line so the available prices
                  form one scannable right-hand column, and the delta
                  line gets the full row width underneath instead of
                  wrapping around the price. */}
              <span className="quiet-paywall__tier-copy">
                <span className="quiet-paywall__tier-topline">
                  <span className="quiet-paywall__tier-name">
                    {TIER_NAMES[tier]}
                  </span>
                  <span>
                    <span className="quiet-paywall__tier-price">
                      ${tierPriceAmount(tier, rowPeriod).toLocaleString("en-US")}
                    </span>
                    <span className="quiet-paywall__tier-unit">
                      /{tierPriceUnit(rowPeriod)}
                    </span>
                  </span>
                </span>
                <span className="quiet-paywall__tier-delta">{tierDelta(tier)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="quiet-paywall__checkout">
        <a
          href={href}
          onClick={() => {
            onBeforeCheckout?.();
            sendWallBeacon({
              kind: "checkout_started",
              door,
              plan: usingAnnual ? "annual" : "monthly",
              tier: activeTier,
            });
          }}
          className="quiet-action quiet-action--primary quiet-action--large flex min-h-14 w-full items-center justify-center px-6 text-base font-semibold"
        >
          {TRIAL_GATE_CTA}
        </a>
        {/* The two facts that decide the tap, in the order they are
            asked: what this costs after the trial, then whether that
            price covers every child. The second one is the panel's most
            asked question and a would-leave for both multi-child
            readers, so it sits at the button rather than below the
            fold. */}
        <p className="quiet-paywall__charge">
          {tierChargeLine(activeTier, effectivePeriod)}
        </p>
        <p className="quiet-paywall__family-price">{TRIAL_GATE_FAMILY_PRICE}</p>
      </div>
    </div>
  );
}
