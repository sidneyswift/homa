import { familyAccountGate } from "../../../../lib/billing/wall";
import { familyBillingEntitlement } from "../../../../lib/billing/entitlements";
import { isPlanTier } from "../../../../lib/billing/wall-types";
import { mapDb } from "../../../../lib/map/db";
import { requireFamily, requireFamilyFromBearer } from "../../../../lib/map/session";
import { familyOnboardingActive } from "../../../../lib/onboarding/state";

/**
 * GET /api/billing/gate
 * The one question a client asks before it EVER shows purchase UI: is
 * this account open. Web answers this by redirecting to /onboarding/trial
 * (a page); the iOS app has no equivalent page-render gate (arc F,
 * docs/homa-planning/plans/2026-07-28-ios-app-store-launch.md), so it
 * needs the same familyAccountGate() decision as JSON. An entitled
 * family (grandfathered, exempt, or an active trial on either billing
 * provider) never sees the StoreKit paywall; this is also the
 * double-subscribe guard on the client side, mirroring how every web
 * gate already redirects an entitled family away from checkout.
 *
 * Bearer first: the mobile app has no cookies (requireFamilyFromBearer's
 * doc), so this is the primary caller this route exists for. Falls back
 * to the cookie session so a future web caller can use the same JSON
 * endpoint without a second route.
 *
 * The mobile-only onboarding exemption below (gh#305, founder ruling
 * 2026-07-28, "phone app only") mirrors the identical exemption in
 * agent/channels/eve.ts's per-turn gate exactly, on the same signal (the
 * X-Homa-Channel header only the mobile client sends), so a family the
 * chat already let through never sees a paywall screen contradicting
 * that, and a future web caller of this same JSON endpoint (the doc
 * above already anticipates one) is not silently granted an exemption
 * meant for the app.
 */
export async function GET(request: Request): Promise<Response> {
  const family = (await requireFamilyFromBearer(request)) ?? (await requireFamily());
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const gate = await familyAccountGate(family.id);
  const isMobile = request.headers.get("x-homa-channel") === "mobile";

  let planTier = "regular";
  let billingProvider: string | null = null;
  let billingPeriod: string | null = null;
  let onboardingActive = false;
  try {
    const sql = mapDb();
    const rows = await sql<
      { plan_tier: string | null; profile_completed_at: string | null; context: unknown }[]
    >`
      select plan_tier, profile_completed_at::text as profile_completed_at, context
      from public.families where id = ${family.id}
    `;
    const row = rows[0];
    if (isPlanTier(row?.plan_tier)) planTier = row.plan_tier;
    if (isMobile && row) {
      onboardingActive = familyOnboardingActive({
        profileCompletedAt: row.profile_completed_at,
        context: row.context,
      });
    }
  } catch (error) {
    // A tier or onboarding-state read failing must never block the
    // open/lapsed answer this route exists for; "regular" and "not
    // onboarding" are the never-over-grant defaults, matching
    // tierForStripeProduct's posture elsewhere in this file.
    console.error(
      "billing/gate: plan_tier/onboarding read failed, defaulting closed:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  // The ledger is additive and may not exist for the few minutes between a
  // compatible code deploy and its migration. Keep that failure isolated
  // from the family-row read above so it cannot erase the mobile onboarding
  // exemption or the legacy tier mirror during rollout.
  try {
    const entitlement = await familyBillingEntitlement(family.id);
    if (entitlement?.active) {
      planTier = entitlement.tier;
      billingProvider = entitlement.provider;
      billingPeriod = entitlement.period;
    }
  } catch (error) {
    console.error(
      "billing/gate: canonical entitlement read failed, using compatibility mirror:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return Response.json({
    ok: true,
    open: gate.checkout === null || onboardingActive,
    lapsed: gate.lapsed,
    planTier,
    billingProvider,
    billingPeriod,
  });
}
