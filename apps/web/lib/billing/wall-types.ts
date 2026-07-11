/**
 * Client-safe wall types (no server imports; the server module wall.ts
 * pulls the Postgres client, which has no browser build). A null
 * WallCheckout anywhere means "no wall for this family": the flag is
 * off, the family is exempt, or the trial already started.
 */

export interface WallCheckout {
  /** Stripe Payment Link URLs with client_reference_id (the family id)
   *  and prefilled_email already appended. */
  monthlyUrl: string;
  annualUrl: string;
}
