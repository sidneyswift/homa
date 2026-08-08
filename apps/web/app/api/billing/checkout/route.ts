import Stripe from "stripe";

import { createServerCheckoutSession } from "../../../../lib/billing/server-checkout";
import {
  configuredCheckoutOrigin,
  configuredServerPaymentLinkUrls,
  configuredStripeSecretKey,
} from "../../../../lib/billing/stripe-checkout-config";
import { createStripeServerCheckoutGateway } from "../../../../lib/billing/stripe-server-checkout";
import { isPlanTier } from "../../../../lib/billing/wall-types";
import { mapDb } from "../../../../lib/map/db";
import { requireFamilyFromRequest } from "../../../../lib/map/session";

function isBillingPeriod(value: string | null): value is "monthly" | "annual" {
  return value === "monthly" || value === "annual";
}

function safeCheckoutDestination(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Converts a short-lived Homa intent into a Stripe Checkout Session. The
 * family row stays locked from the last active-family check through Stripe's
 * session creation, so account deletion and checkout cannot both win.
 */
export async function GET(request: Request): Promise<Response> {
  const family = await requireFamilyFromRequest(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const intent = requestUrl.searchParams.get("intent");
  const tier = requestUrl.searchParams.get("tier");
  const billingPeriod = requestUrl.searchParams.get("period");
  if (!intent || !isPlanTier(tier) || !isBillingPeriod(billingPeriod)) {
    return Response.json({ ok: false, reason: "invalid-checkout" }, { status: 400 });
  }

  const secretKey = configuredStripeSecretKey();
  if (!secretKey) {
    return Response.json({ ok: false, reason: "checkout-unavailable" }, { status: 503 });
  }
  const paymentLinkUrls = configuredServerPaymentLinkUrls();
  if (!paymentLinkUrls[tier]?.[billingPeriod]) {
    return Response.json({ ok: false, reason: "checkout-unavailable" }, { status: 503 });
  }

  try {
    const stripe = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
    const gateway = createStripeServerCheckoutGateway(stripe);
    const sql = mapDb();
    const session = await sql.begin(async (tx) => {
      const activeFamilies = await tx<Array<{ id: string; email: string | null }>>`
        select family.id, family.email
        from public.families family
        where family.id = ${family.id}
          and family.status <> 'deleted'
          and not exists (
            select 1
            from public.account_deletion_artifact_tombstones tombstone
            where tombstone.family_id = family.id
          )
        for update
      `;
      const activeFamily = activeFamilies[0];
      if (!activeFamily) return null;

      return await createServerCheckoutSession({
        gateway,
        intent,
        intentSecret: secretKey,
        familyId: activeFamily.id,
        tier,
        billingPeriod,
        paymentLinkUrls,
        customerEmail: activeFamily.email,
        trustedOrigin: configuredCheckoutOrigin(),
        trialPeriodDays: 7,
        isFamilyActive: async (familyId) => {
          const rows = await tx<Array<{ allowed: boolean }>>`
            select exists (
              select 1
              from public.families active_family
              where active_family.id = ${familyId}
                and active_family.status <> 'deleted'
                and not exists (
                  select 1
                  from public.account_deletion_artifact_tombstones tombstone
                  where tombstone.family_id = active_family.id
                )
            ) as allowed
          `;
          return rows[0]?.allowed === true;
        },
      });
    });

    if (!session) {
      return Response.json({ ok: false, reason: "account-closing" }, { status: 409 });
    }
    const destination = safeCheckoutDestination(session.url);
    if (!destination) {
      throw new Error("Stripe Checkout did not return a trusted destination.");
    }
    return Response.redirect(destination, 303);
  } catch (error) {
    console.error(
      "billing checkout failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "checkout-unavailable" }, { status: 503 });
  }
}
