/**
 * Client-safe wall types (no server imports; the server module wall.ts
 * pulls the Postgres client, which has no browser build). A null
 * WallCheckout anywhere means "no wall for this family": the flag is
 * off, the family is exempt, or the trial already started.
 */

export type PlanTier = "regular" | "plus" | "elite";

export const PLAN_TIERS: readonly PlanTier[] = ["regular", "plus", "elite"];

/** Narrows a value read back out of Postgres. families.plan_tier is a
 *  check-constrained text column, so anything else means the constraint
 *  changed under us; callers fall back to "regular" rather than trust it. */
export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && (PLAN_TIERS as readonly string[]).includes(value);
}

/** Which price the tier picker's monthly/annual toggle currently shows. */
export type BillingPeriod = "monthly" | "annual";

export interface TierCheckout {
  /** Stripe Payment Link URLs with client_reference_id (the family id)
   *  and prefilled_email already appended. Annual is null when its link
   *  is not configured for this environment: a missing annual link
   *  narrows that tier to monthly-only instead of hiding the tier. */
  monthlyUrl: string;
  annualUrl: string | null;
}

export interface WallCheckout {
  regular: TierCheckout;
  /** null when Plus's Payment Links aren't configured for this
   *  environment: the tier just doesn't render, same narrowing rule as
   *  a tier's missing annual link. */
  plus: TierCheckout | null;
  elite: TierCheckout | null;
}

/**
 * The report lock (plans/2026-07-18-report-lock.md): when present, the
 * report renders freeSubjects in full and holds every other mapped
 * subject behind the membership offer. checkout is null for a viewer
 * who cannot pay here (a shared token link without this family's
 * session): rows still lock, the offer becomes a sign-in line, and the
 * shareable URL never renders another family's checkout.
 */
export interface ReportLock {
  freeSubjects: string[];
  checkout: WallCheckout | null;
}
