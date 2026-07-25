import Stripe from "stripe";
import { cookies } from "next/headers";

import { startFamilyTrial, tierForStripeProduct } from "../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../lib/map/events";
import { requireFamily } from "../../../../lib/map/session";
import { childBelongsToFamily } from "../../../../lib/map/store";

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
 *
 * The welcome landing (plans/2026-07-18-report-lock.md): checkout that
 * left from a child's report carries that child in a short-lived
 * cookie (set by ReportLockOffer). A verified confirm re-scopes the
 * cookie's child to the signed-in family (tenancy law: a pasted or
 * forged cookie can never land on another family's child) and lands
 * on that report with ?welcome=1, where the first-subject chooser
 * turns the fresh trial into one default next step. No cookie, or a
 * cookie that fails re-scoping, lands on /app exactly as before.
 */

const TRIAL_CHILD_COOKIE = "homa_trial_child";

async function welcomeTarget(requestUrl: URL, familyId: string): Promise<URL | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(TRIAL_CHILD_COOKIE)?.value ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return null;
    if (!(await childBelongsToFamily(raw, familyId))) return null;
    return new URL(`/app/${raw}/report?welcome=1`, requestUrl);
  } catch {
    // The welcome landing is a nicety; losing it must never lose the
    // unlock itself.
    return null;
  }
}

/** Redirect that also retires the one-shot child cookie. */
function redirectClearingCookie(target: URL): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": `${TRIAL_CHILD_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    },
  });
}

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

  // || not ??: an empty LIVE var (a dev environment shadowing the live
  // key) must fall through to TEST, matching paymentLinkBases.
  const secretKey = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY;
  if (!secretKey) {
    console.error("billing/confirm: no Stripe secret key configured");
    return Response.redirect(appUrl, 302);
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"],
    });
    const complete = session.status === "complete";
    const sameFamily = session.client_reference_id === family.id;
    if (!complete || !sameFamily) {
      console.error(
        `billing/confirm: session rejected (complete=${String(complete)}, sameFamily=${String(sameFamily)})`,
      );
      return Response.redirect(appUrl, 302);
    }

    const customerId = typeof session.customer === "string" ? session.customer : null;
    const purchasedProduct = session.line_items?.data[0]?.price?.product;
    const productId = typeof purchasedProduct === "string" ? purchasedProduct : purchasedProduct?.id;
    const tier = tierForStripeProduct(productId);
    const fresh = await startFamilyTrial(family.id, customerId, tier);
    if (fresh) {
      await emitMapEvent("billing.trial_started", { family_id: family.id });
    }

    // Verified checkout: land on the child's report with the
    // first-subject chooser when the cookie names one of THIS
    // family's children, /app otherwise.
    const target = (await welcomeTarget(requestUrl, family.id)) ?? appUrl;
    return redirectClearingCookie(target);
  } catch (error) {
    console.error(
      "billing/confirm failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return Response.redirect(appUrl, 302);
}
