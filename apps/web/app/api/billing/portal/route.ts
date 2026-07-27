import { familyBillingPortalUrl } from "../../../../lib/billing/portal";
import { requireFamily } from "../../../../lib/map/session";

/**
 * GET /api/billing/portal
 * The "Manage billing" door: redirects a signed-in family to their own
 * Stripe customer portal (cancel, update card, view invoices). Makes
 * the wall's "Cancel anytime." claim real; see lib/billing/portal.ts for
 * why this route didn't exist until 2026-07-25. familyId always comes
 * from requireFamily()'s auth context, never a query param.
 */
export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const settingsUrl = new URL("/app/settings", requestUrl);

  const family = await requireFamily();
  if (!family) {
    const signin = new URL("/signin", requestUrl);
    signin.searchParams.set("next", "/api/billing/portal");
    return Response.redirect(signin, 302);
  }

  const url = await familyBillingPortalUrl(family.id, settingsUrl.toString());
  // No Stripe customer yet, or the portal call failed: land back on
  // settings rather than strand the family on an error page.
  return Response.redirect(url ?? settingsUrl, 302);
}
