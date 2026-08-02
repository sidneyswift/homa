import { isPlanTier, type PlanTier } from "@homa/core";

import { mapDb } from "../map/db";
import {
  familyBillingEntitlement,
  type FamilyBillingEntitlement,
} from "./entitlements";

const PLUS_TIERS: ReadonlySet<PlanTier> = new Set(["plus", "elite"]);
const LEGACY_LAPSED_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
  "past_due",
  "paused",
  "unpaid",
]);

export interface PlusCapabilityRow {
  billingExempt: boolean;
  planTier: PlanTier | null;
  providerStatuses: readonly (string | null)[];
}

/**
 * Pure Plus decision shared by every curriculum action. The canonical billing
 * ledger wins when it exists. The family mirror remains only for trials,
 * manually provisioned families, and the provider-ledger rollout window.
 */
export function plusCapabilityDecision(input: {
  family: PlusCapabilityRow;
  entitlement: FamilyBillingEntitlement | null;
}): boolean {
  if (input.family.billingExempt) return true;
  if (input.entitlement) {
    return input.entitlement.active && PLUS_TIERS.has(input.entitlement.tier);
  }
  if (!input.family.planTier || !PLUS_TIERS.has(input.family.planTier)) {
    return false;
  }
  const observedStatuses = input.family.providerStatuses.filter(
    (status): status is string => Boolean(status),
  );
  return (
    observedStatuses.length === 0 ||
    observedStatuses.some((status) => !LEGACY_LAPSED_STATUSES.has(status))
  );
}

/** Fail closed for a paid action. Original Library access never calls this. */
export async function familyHasPlusCapability(familyId: string): Promise<boolean> {
  try {
    const sql = mapDb();
    const rows = await sql<
      Array<{
        billing_exempt: boolean | null;
        plan_tier: string | null;
        stripe_subscription_status: string | null;
        apple_subscription_status: string | null;
      }>
    >`
      select billing_exempt, plan_tier, stripe_subscription_status,
             apple_subscription_status
      from public.families
      where id = ${familyId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return false;
    const entitlement = await familyBillingEntitlement(familyId);
    return plusCapabilityDecision({
      family: {
        billingExempt: row.billing_exempt === true,
        planTier: isPlanTier(row.plan_tier) ? row.plan_tier : null,
        providerStatuses: [
          row.stripe_subscription_status,
          row.apple_subscription_status,
        ],
      },
      entitlement,
    });
  } catch (error) {
    console.error(
      "Plus capability lookup failed closed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}

export const PLUS_CURRICULUM_NOTE =
  "Your original stays in Library. Breaking it into units and optionally adding activities to Planner is a Homa Plus feature.";
