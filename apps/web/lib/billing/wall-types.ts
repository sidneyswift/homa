/**
 * Client-safe wall types (no server imports; the server module wall.ts
 * pulls the Postgres client, which has no browser build). A null
 * WallCheckout anywhere means "no wall for this family": the flag is
 * off, the family is exempt, or the trial already started.
 */

export interface WallCheckout {
  /** Stripe Payment Link URLs with client_reference_id (the family id)
   *  and prefilled_email already appended. Annual is null when its link
   *  is not configured: the founder ruled the flip starts monthly-only
   *  ($19) while the $99 sticker's Homeschool Fox collision is open, so
   *  a missing annual link narrows the offer instead of downing the
   *  wall (2026-07-18). */
  monthlyUrl: string;
  annualUrl: string | null;
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
