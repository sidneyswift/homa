import {
  appleProductAvailableForNewPurchase,
  providerProduct,
} from "@homa/core";

import {
  AppleFamilyUnavailableError,
  AppleTransactionClaimedError,
  familyIdForAppleOriginalTransaction,
  recordFamilyAppleSubscription,
  startFamilyTrial,
} from "../../../../../lib/billing/wall";
import {
  pendingApplePurchaseClaimForAttempt,
  resolveApplePurchaseClaim,
} from "../../../../../lib/billing/apple-purchase-interlock";
import { emitMapEvent } from "../../../../../lib/map/events";
import { requireFamilyFromRequest } from "../../../../../lib/map/session";
import { verifyAppleTransaction } from "../../../../../lib/billing/apple-verify";

/**
 * POST /api/billing/apple/confirm
 * The iOS twin of GET /api/billing/confirm (Stripe's Payment Link
 * redirect): the mobile client just completed a StoreKit 2 purchase and
 * hands over Transaction.jwsRepresentation for the server to verify and
 * unlock on. Body: { signedTransaction: string }.
 *
 * Tenancy check (the same law confirm/route.ts enforces with
 * client_reference_id, adapted to Apple's shape): the purchasing device
 * sets StoreKit's appAccountToken to a server-minted purchase attempt id.
 * Apple signs it into the transaction, and this route resolves that durable
 * attempt back to the authenticated caller's own family. A transaction whose
 * signed attempt belongs elsewhere unlocks nobody. Older family-id tokens may
 * update a subscription already linked to that family, but can never make a
 * fresh claim without the deletion interlock.
 */
export async function POST(request: Request): Promise<Response> {
  const family = await requireFamilyFromRequest(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const signedTransaction =
    body && typeof body === "object" && "signedTransaction" in body
      ? (body as { signedTransaction: unknown }).signedTransaction
      : null;
  if (typeof signedTransaction !== "string" || !signedTransaction) {
    return Response.json({ ok: false, reason: "missing-transaction" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await verifyAppleTransaction(signedTransaction);
  } catch (error) {
    console.error(
      "billing/apple/confirm: transaction verification failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "unverifiable" }, { status: 400 });
  }

  const originalTransactionId = decoded.originalTransactionId ?? decoded.transactionId;
  if (!originalTransactionId) {
    console.error("billing/apple/confirm: verified transaction carried no transaction id");
    return Response.json({ ok: false, reason: "malformed" }, { status: 400 });
  }

  const product = providerProduct("apple", decoded.productId);
  if (!product) {
    console.error(
      `billing/apple/confirm: verified transaction used an unconfigured product ${decoded.productId ?? "unset"}`,
    );
    return Response.json({ ok: false, reason: "unconfigured-product" }, { status: 400 });
  }

  const [pendingClaim, linkedFamilyId] = await Promise.all([
    decoded.appAccountToken
      ? pendingApplePurchaseClaimForAttempt(decoded.appAccountToken)
      : Promise.resolve(null),
    familyIdForAppleOriginalTransaction(originalTransactionId),
  ]);
  const claim = resolveApplePurchaseClaim({
    authenticatedFamilyId: family.id,
    linkedFamilyId,
    pendingClaim,
    signedProductId: product.productId,
  });
  if (claim.kind === "rejected") {
    console.error(
      `billing/apple/confirm: appAccountToken (${decoded.appAccountToken ?? "unset"}) does not match the signed-in family`,
    );
    return Response.json(
      {
        ok: false,
        reason: claim.reason === "product-mismatch"
          ? "product-mismatch"
          : "family-mismatch",
      },
      { status: 403 },
    );
  }
  if (
    claim.kind === "fresh"
    && !appleProductAvailableForNewPurchase(product.productId)
  ) {
    return Response.json(
      { ok: false, reason: "product-unavailable" },
      { status: 400 },
    );
  }

  try {
    // A freshly verified, unrevoked transaction is active by definition;
    // the App Store Server Notifications webhook (task #20) keeps this
    // current after this moment (renewals, cancellations, refunds). This
    // mirror exists for the same reason recordFamilySubscription exists
    // for Stripe: a re-subscribing family must not stay walled behind a
    // stale status while the webhook is still in flight.
    await recordFamilyAppleSubscription(family.id, {
      originalTransactionId,
      status: decoded.revocationDate ? "canceled" : "active",
      productId: product.productId,
      tier: product.tier,
      period: product.period,
      expiresAtMs: decoded.expiresDate ?? null,
      purchaseAttemptId: claim.purchaseAttemptId,
      purchaseDateMs: decoded.purchaseDate ?? null,
      providerObservedAtMs: decoded.signedDate ?? decoded.purchaseDate ?? null,
    });
  } catch (error) {
    if (error instanceof AppleTransactionClaimedError) {
      console.error(`billing/apple/confirm: ${error.message}`);
      return Response.json(
        { ok: false, reason: "transaction-already-claimed" },
        { status: 409 },
      );
    }
    if (error instanceof AppleFamilyUnavailableError) {
      return Response.json(
        { ok: false, reason: "account-closing" },
        { status: 409 },
      );
    } else {
      throw error;
    }
  }

  // The provider identity is committed first. That family-row write and
  // deletion share one lock, so deletion either sees active Apple billing and
  // blocks, or wins first and makes the provider write fail without granting.
  const tier = product.tier;
  const fresh = await startFamilyTrial(family.id, null, tier);
  if (fresh) {
    await emitMapEvent("billing.trial_started", { family_id: family.id });
  }

  return Response.json({
    ok: true,
    planTier: tier,
    purchaseAttemptId: claim.purchaseAttemptId,
  });
}
