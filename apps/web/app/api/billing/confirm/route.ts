import Stripe from "stripe";

import { startFamilyTrial } from "../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../lib/map/events";
import { requireFamily } from "../../../../lib/map/session";

/**
 * GET /api/billing/confirm?session_id={CHECKOUT_SESSION_ID}
 * The Payment Links' after-completion redirect (configured in the Stripe
 * dashboard, HUMAN-TODO). No webhooks in this phase: the same browser
 * that paid lands here, we retrieve the checkout session with the secret
 * key, verify it is complete AND that its client_reference_id names the
 * signed-in family (the tenancy law: the unlock target comes from auth
 * context, and the session must agree, so a pasted confirmation URL can
 * never unlock someone else's family). First confirm stamps
 * trial_started_at and fires billing.trial_started; revisits are no-ops.
 * Every path ends on /app: a verification hiccup strands nobody, the
 * founder reconciles from the Stripe dashboard (n is small by design).
 */

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const appUrl = new URL("/app", requestUrl);
  const sessionId = requestUrl.searchParams.get("session_id");
  if (!sessionId) return Response.redirect(appUrl, 302);

  const family = await requireFamily();
  if (!family) {
    // Sign in first, then bounce right back here (proxy.ts honors next).
    const signin = new URL("/signin", requestUrl);
    signin.searchParams.set("next", `/api/billing/confirm?session_id=${sessionId}`);
    return Response.redirect(signin, 302);
  }

  const secretKey = process.env.STRIPE_LIVE_SECRET_KEY ?? process.env.STRIPE_TEST_SECRET_KEY;
  if (!secretKey) {
    console.error("billing/confirm: no Stripe secret key configured");
    return Response.redirect(appUrl, 302);
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const complete = session.status === "complete";
    const sameFamily = session.client_reference_id === family.id;
    if (!complete || !sameFamily) {
      console.error(
        `billing/confirm: session rejected (complete=${String(complete)}, sameFamily=${String(sameFamily)})`,
      );
      return Response.redirect(appUrl, 302);
    }

    const customerId = typeof session.customer === "string" ? session.customer : null;
    const fresh = await startFamilyTrial(family.id, customerId);
    if (fresh) {
      await emitMapEvent("billing.trial_started", { family_id: family.id });
    }
  } catch (error) {
    console.error(
      "billing/confirm failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return Response.redirect(appUrl, 302);
}
