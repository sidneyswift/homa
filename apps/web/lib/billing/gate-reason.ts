/**
 * The gate's reason shape (2026-08-30 spec, Outcome 6; system-model.md
 * move 2). GET /api/billing/gate used to flatten three different kinds
 * of "open" into one boolean: real entitlement, the mobile onboarding
 * grace window, and an account wall that is simply off. A client cannot
 * be honest with a boolean (the walk's decline screen says different
 * true things for "your free window is still open" and "you are
 * subscribed"), so the boolean gets a name, and `open` is DERIVED from
 * the name so the two can never disagree.
 *
 * Pure and I/O-free on the house pattern (onboardingActiveForRow,
 * accountAccessDecisionWithEntitlement) so the decomposition is testable
 * without an HTTP harness.
 */

/** Why the gate answered `open` the way it did. */
export type GateReason =
  /** The account needs no checkout: subscribed, active trial, exempt,
   *  grandfathered, or the signup wall is off entirely. */
  | "entitled"
  /** A checkout would be required, but the family is inside the mobile
   *  onboarding free window (gh#305 exemption, mobile channel only). */
  | "onboarding_grace"
  /** A checkout is required and nothing excuses it: purchase UI is the
   *  next step. */
  | "walled";

/** The durable onboarding record's state as stored, with "none" for a
 *  family that never entered the chat/native flow. A raw read, not the
 *  flag-gated exemption: reason carries the exemption; this carries the
 *  record, so a client can tell "free window ended" (done) apart from
 *  "never had one" (none). */
export type GateOnboardingState = "active" | "done" | "none";

export function gateReason(inputs: {
  /** familyAccountGate said a checkout is required (checkout !== null). */
  checkoutRequired: boolean;
  /** The mobile onboarding exemption applies to this caller. */
  onboardingExempt: boolean;
}): GateReason {
  if (!inputs.checkoutRequired) return "entitled";
  if (inputs.onboardingExempt) return "onboarding_grace";
  return "walled";
}

/** The one derivation of `open`: a reason is walled or it is not. */
export function gateOpenForReason(reason: GateReason): boolean {
  return reason !== "walled";
}
