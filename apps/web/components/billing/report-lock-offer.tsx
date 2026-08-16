"use client";

import { useEffect } from "react";
import Link from "next/link";

import { reportButtonClass } from "../../app/onboarding/r/[token]/report-button";
import type { WallCheckout } from "../../lib/billing/wall-types";
import { TierOptions } from "./tier-options";
import { sendWallBeacon } from "./wall-beacon";
import {
  REPORT_LOCK_SIGNIN_BODY,
  REPORT_LOCK_SIGNIN_HEADLINE,
  WALL_EYEBROW,
  WALL_HEADLINE,
  WALL_MECHANICS_LINE,
  WALL_SIGNIN_BUTTON,
  reportLockHeldLine,
  reportLockReadyLine,
} from "./wall-copy";

/**
 * The report lock's offer card (plans/2026-07-18-report-lock.md): sits
 * between the open four subjects and the held rows, once, inline in
 * the report itself. Not a modal on purpose: the lock is a state of
 * the page she is already reading, and offers are never ambushes.
 *
 * The cookie: checkout leaves for Stripe and comes back through
 * /api/billing/confirm, which knows the family but not which child's
 * report she was reading. One short-lived cookie carries that, so the
 * unlock can land back on this child with the first-week chooser open
 * instead of dropping her on /app to start over.
 */

const TRIAL_CHILD_COOKIE = "homa_trial_child";

export function ReportLockOffer({
  childId,
  childName,
  mappedCount,
  checkout,
  signinNext,
}: {
  childId: string;
  childName: string;
  mappedCount: number;
  /** null: this viewer cannot pay here (a shared token link without
   *  the family's session); the card offers sign-in instead. */
  checkout: WallCheckout | null;
  signinNext: string;
}) {
  useEffect(() => {
    sendWallBeacon({ kind: "wall_viewed", door: "report" });
  }, []);

  function rememberChild() {
    try {
      document.cookie = `${TRIAL_CHILD_COOKIE}=${childId}; path=/; max-age=3600; samesite=lax`;
    } catch {
      // A blocked cookie only costs the welcome landing, never checkout.
    }
  }

  if (!checkout) {
    return (
      <div data-brand-layer="report-lock" className="quiet-paywall__report-lock">
        <p
          // No uppercase transform: WALL_EYEBROW is "Homa membership",
          // and rendering it uppercase puts "HOMA" on screen, retired by
          // the 2026-07-28 brand correction (`brand-casing-homa`).
          className="quiet-paywall__eyebrow"
        >
          {WALL_EYEBROW}
        </p>
        <h3 className="quiet-paywall__report-lock-heading">
          {REPORT_LOCK_SIGNIN_HEADLINE}
        </h3>
        <p className="quiet-paywall__copy quiet-paywall__copy--lead">{reportLockReadyLine(childName, mappedCount)}</p>
        <p className="quiet-paywall__copy">{REPORT_LOCK_SIGNIN_BODY}</p>
        <Link
          href={`/signin?next=${encodeURIComponent(signinNext)}`}
          className={reportButtonClass(
            "primary",
            "mt-4 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold",
          )}
        >
          {WALL_SIGNIN_BUTTON}
        </Link>
      </div>
    );
  }

  return (
    <div data-brand-layer="report-lock" className="quiet-paywall__report-lock">
      <p
        // No uppercase transform: see the sign-in branch above.
        className="quiet-paywall__eyebrow"
        style={{ color: "var(--homa-info-ink)" }}
      >
        {WALL_EYEBROW}
      </p>
      <h3 className="quiet-paywall__report-lock-heading">
        {WALL_HEADLINE}
      </h3>
      {/* Reassure before inform: the whole report exists and is hers,
          then what the free days open, the held subjects named first. */}
      <p className="quiet-paywall__copy quiet-paywall__copy--lead">{reportLockReadyLine(childName, mappedCount)}</p>
      <p className="quiet-paywall__copy">{reportLockHeldLine(childName)}</p>
      <TierOptions door="report" checkout={checkout} onBeforeCheckout={rememberChild} />
      {/* Keep the full renewal terms next to the consent control, where
          they answer risk without delaying the parent's first price. */}
      <p className="quiet-paywall__gate-charge-note">{WALL_MECHANICS_LINE}</p>
    </div>
  );
}
