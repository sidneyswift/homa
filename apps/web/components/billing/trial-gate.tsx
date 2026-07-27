"use client";

import { useEffect } from "react";

import type { WallCheckout } from "../../lib/billing/wall-types";
import { sendWallBeacon } from "./wall-beacon";
import { TierOptions } from "./tier-options";
import {
  TRIAL_GATE_EYEBROW,
  TRIAL_GATE_HEADLINE,
  TRIAL_GATE_INCLUDED_LINE,
  TRIAL_GATE_LAPSED_REASSURANCE,
  TRIAL_GATE_MANAGE_BILLING,
  TRIAL_GATE_REASSURANCE,
  TRIAL_GATE_SAVED_LINE,
  TRIAL_GATE_TIMELINE,
} from "./wall-copy";

/**
 * The signup trial gate's body (/onboarding/trial, founder directive
 * 2026-07-26): reassurance, the three-beat trial timeline, the tier
 * cards, and the saved-line under them. A full page rather than a
 * modal: there is no product behind it to dismiss back into, so a
 * dialog's "Not now" would be a door painted on a wall. The honest way
 * out is named in TRIAL_GATE_SAVED_LINE instead (offers never
 * commands: leaving costs nothing and the page says so).
 *
 * Analytics: one wall_viewed beacon (door "signup") plus the per-card
 * funnel step ("paywall"), both fire-and-forget on mount, so the
 * founder console can see account-created -> gate-viewed ->
 * checkout_started -> trial_started as one ladder.
 */
export function TrialGate({
  checkout,
  lapsed,
  portalAvailable,
}: {
  checkout: WallCheckout;
  /** True when this family had a trial or subscription that ended:
   *  the first line welcomes her back instead of greeting a stranger. */
  lapsed: boolean;
  /** True when a Stripe billing relationship exists, so the gate can
   *  offer the self-serve portal (fix a card, restart the old plan). */
  portalAvailable: boolean;
}) {
  useEffect(() => {
    sendWallBeacon({ kind: "wall_viewed", door: "signup" });
    void fetch("/api/map/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "paywall" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-[52rem]">
      <p
        className="font-mono text-[0.65rem] uppercase tracking-widest"
        style={{ color: "var(--sage-700)" }}
      >
        {TRIAL_GATE_EYEBROW}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-strong">
        {TRIAL_GATE_HEADLINE}
      </h1>
      <p className="mt-3 max-w-[36rem] text-body">
        {lapsed ? TRIAL_GATE_LAPSED_REASSURANCE : TRIAL_GATE_REASSURANCE}
      </p>

      {/* The trial timeline: three plain facts in order, the pattern
          that beat feature-selling for card-upfront trials (see
          wall-copy.ts). */}
      <ol className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
        {TRIAL_GATE_TIMELINE.map((beat, index) => (
          <li
            key={beat.marker}
            className="flex flex-1 items-start gap-3 rounded-lg border border-border-subtle bg-card p-4"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xs font-bold text-on-brand"
            >
              {index + 1}
            </span>
            <div>
              <p className="font-display text-sm font-bold text-strong">{beat.marker}</p>
              <p className="mt-1 text-sm text-body">{beat.line}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 max-w-[40rem] text-body">{TRIAL_GATE_INCLUDED_LINE}</p>

      <TierOptions door="signup" checkout={checkout} />

      <p className="mt-6 text-center text-sm text-subtle">
        {TRIAL_GATE_SAVED_LINE}
        {lapsed && portalAvailable ? (
          <>
            {" "}
            <a
              href="/api/billing/portal"
              className="font-semibold text-brand underline underline-offset-2"
            >
              {TRIAL_GATE_MANAGE_BILLING}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
