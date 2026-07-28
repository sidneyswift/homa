import { familyAccountGate } from "../../../../lib/billing/wall";
import { isPlanTier } from "../../../../lib/billing/wall-types";
import { mapDb } from "../../../../lib/map/db";
import { requireFamily, requireFamilyFromBearer } from "../../../../lib/map/session";

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
 */
export async function GET(request: Request): Promise<Response> {
  const family = (await requireFamilyFromBearer(request)) ?? (await requireFamily());
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const gate = await familyAccountGate(family.id);

  let planTier = "regular";
  try {
    const sql = mapDb();
    const rows = await sql<{ plan_tier: string | null }[]>`
      select plan_tier from public.families where id = ${family.id}
    `;
    if (isPlanTier(rows[0]?.plan_tier)) planTier = rows[0].plan_tier;
  } catch (error) {
    // A tier read failing must never block the open/lapsed answer this
    // route exists for; "regular" is the never-over-grant default used
    // everywhere else a plan_tier read can fail (tierForStripeProduct).
    console.error(
      "billing/gate: plan_tier read failed, defaulting to regular:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return Response.json({
    ok: true,
    open: gate.checkout === null,
    lapsed: gate.lapsed,
    planTier,
  });
}
