/**
 * Is Homa's copy of "who is paying" still in step with Stripe?
 *
 * Homa never asks Stripe directly. It keeps a mirror on the families row
 * (stripe_subscription_status and friends) that only the billing webhook
 * writes, and accountAccessDecision trusts that mirror completely. So if
 * the webhook ever goes quiet, the mirror freezes at its last value and a
 * family who cancelled keeps access indefinitely. Issue #274 has the real
 * repair, which is to reconcile against Stripe on a schedule. This module
 * is the cheaper half: make the drift VISIBLE, so a silent webhook stops
 * being something the founder has to remember to suspect.
 *
 * Deliberately pure and Stripe-free. Every signal here is a fact the
 * database can already answer, which is what makes it safe to run on an
 * admin page load.
 */

/** Stripe's own dunning runs for days before a subscription gives up, and
 *  a renewal moves the period end forward at the boundary rather than
 *  exactly on it. Two days keeps normal billing noise out of the count. */
const STALE_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/** The trial Stripe is configured to grant, plus a day. A family past this
 *  with no subscription on file never had one recorded, which is the other
 *  way the mirror can be wrong. */
const TRIAL_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

/** The mirror says this family is paying. Anything else is already handled
 *  by accountAccessDecision and is not drift. */
const PAYING_STATUSES = new Set(["active", "trialing"]);

/** Postgres numeric expressions arrive as strings when adminDb keeps type
 * fetching off, so normalize them before comparing or rendering dates. */
type EpochMilliseconds = number | string;

function finiteEpochMilliseconds(value: EpochMilliseconds | null): number | null {
  if (value === null) return null;
  const milliseconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export interface BillingMirrorRow {
  status: string | null;
  /** families.stripe_current_period_end, the date they are paid through. */
  currentPeriodEndMs: EpochMilliseconds | null;
  trialStartedAtMs: EpochMilliseconds | null;
  hasSubscriptionId: boolean;
  billingExempt: boolean;
}

export type BillingFreshnessVerdict = "no-billing-yet" | "healthy" | "stale";

export interface BillingFreshness {
  verdict: BillingFreshnessVerdict;
  /** Mirror still says paying, but the date they were paid through has
   *  passed. Stripe should have spoken by now and did not. */
  stalePayers: number;
  /** Past the trial window with no subscription recorded at all. */
  trialsWithoutSubscription: number;
  /** How long since ANY billing update arrived from Stripe, null if none
   *  ever has. A heartbeat: silence here is the earliest warning. */
  lastUpdateAgeMs: number | null;
  /** The same moment as an ISO string, so the console can render it
   *  without reaching for Date.now() inside a component (react-hooks
   *  purity). Computed here because this module already knows the clock. */
  lastUpdateAtIso: string | null;
  /** Families carrying any Stripe record at all, so the copy can say
   *  "nothing to drift yet" honestly instead of a reassuring zero. */
  familiesWithBilling: number;
}

/**
 * billingFreshness(rows, lastUpdateMs, nowMs)
 *
 * "no-billing-yet" is its own verdict on purpose. Before the first real
 * subscription exists, every count here is zero, and a zero that means
 * "nothing has happened" must not read as a zero that means "everything
 * is fine". That distinction is the whole reason this is on the page.
 */
export function billingFreshness(
  rows: readonly BillingMirrorRow[],
  lastUpdateMs: EpochMilliseconds | null,
  nowMs: number,
): BillingFreshness {
  let stalePayers = 0;
  let trialsWithoutSubscription = 0;
  let familiesWithBilling = 0;

  for (const row of rows) {
    if (row.billingExempt) continue;
    const currentPeriodEndMs = finiteEpochMilliseconds(row.currentPeriodEndMs);
    const trialStartedAtMs = finiteEpochMilliseconds(row.trialStartedAtMs);
    const hasAnyBilling = row.status !== null || row.hasSubscriptionId;
    if (hasAnyBilling) familiesWithBilling += 1;

    if (
      row.status !== null &&
      PAYING_STATUSES.has(row.status) &&
      currentPeriodEndMs !== null &&
      currentPeriodEndMs < nowMs - STALE_GRACE_MS
    ) {
      stalePayers += 1;
      continue;
    }

    if (
      !row.hasSubscriptionId &&
      trialStartedAtMs !== null &&
      trialStartedAtMs < nowMs - TRIAL_WINDOW_MS
    ) {
      trialsWithoutSubscription += 1;
    }
  }

  const verdict: BillingFreshnessVerdict =
    familiesWithBilling === 0 && trialsWithoutSubscription === 0
      ? "no-billing-yet"
      : stalePayers > 0 || trialsWithoutSubscription > 0
        ? "stale"
        : "healthy";
  const lastUpdate = finiteEpochMilliseconds(lastUpdateMs);

  return {
    verdict,
    stalePayers,
    trialsWithoutSubscription,
    lastUpdateAgeMs: lastUpdate === null ? null : Math.max(0, nowMs - lastUpdate),
    lastUpdateAtIso: lastUpdate === null ? null : new Date(lastUpdate).toISOString(),
    familiesWithBilling,
  };
}

/**
 * One line for the console. Says what is true, including the case where
 * nothing has happened yet, and never dresses an empty system up as a
 * healthy one.
 */
export function billingFreshnessLine(f: BillingFreshness): string {
  if (f.verdict === "no-billing-yet") {
    return "No family has a Stripe record yet, so there is nothing to compare.";
  }
  if (f.verdict === "healthy") {
    return `Billing records match Stripe for all ${f.familiesWithBilling} families with a subscription.`;
  }
  const parts: string[] = [];
  if (f.stalePayers > 0) {
    parts.push(
      f.stalePayers === 1
        ? "1 family still reads as paying past the date they were paid through"
        : `${f.stalePayers} families still read as paying past the date they were paid through`,
    );
  }
  if (f.trialsWithoutSubscription > 0) {
    parts.push(
      f.trialsWithoutSubscription === 1
        ? "1 family is past the trial window with no subscription on file"
        : `${f.trialsWithoutSubscription} families are past the trial window with no subscription on file`,
    );
  }
  return `${parts.join(", and ")}. Stripe may have stopped reaching the billing webhook.`;
}
