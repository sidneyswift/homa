import {
  appleProductAvailableForNewPurchase,
  providerProduct,
} from "@homa/core";

import {
  appleStatusToSharedVocabulary,
  verifyAppleNotification,
  verifyAppleTransaction,
} from "../../../../../lib/billing/apple-verify";
import {
  familyIdForAppleOriginalTransaction,
  recordFamilyAppleSubscription,
  recordVerifiedFamilyAppleSubscriptionStatus,
} from "../../../../../lib/billing/wall";
import {
  pendingApplePurchaseClaimForAttempt,
  resolveApplePurchaseClaim,
} from "../../../../../lib/billing/apple-purchase-interlock";

/**
 * POST /api/billing/apple/webhook (App Store Server Notifications V2)
 * The Apple twin of POST /api/billing/webhook. Security is the JWS
 * signature itself (verifyAppleNotification, apple-verify.ts), not a
 * separate shared secret the way Stripe's webhook has one: there is no
 * equivalent of STRIPE_WEBHOOK_SECRET to configure or leave dark here,
 * the endpoint URL is registered once in App Store Connect and every
 * request either verifies against Apple's root certificate or it does
 * not exist as far as this route is concerned.
 *
 * Renewals, cancellations, refunds, billing retries, and family-sharing
 * revocations all arrive here; the confirm route only ever sees the
 * moment of purchase. Body: { signedPayload: string }, Apple's fixed
 * shape for every notification.
 *
 * Never errors into Apple's retry loop for a transaction id this
 * database has not linked to a family yet: a fresh purchase's webhook
 * can outrace its own confirm call (the Stripe webhook's exact posture
 * for an unrecognized customer id), and Apple resends test
 * notifications from the sandbox that legitimately name no real family.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const signedPayload =
    body && typeof body === "object" && "signedPayload" in body
      ? (body as { signedPayload: unknown }).signedPayload
      : null;
  if (typeof signedPayload !== "string" || !signedPayload) {
    return Response.json({ ok: false, reason: "missing-payload" }, { status: 400 });
  }

  let notification;
  try {
    notification = await verifyAppleNotification(signedPayload);
  } catch (error) {
    console.error(
      "billing/apple/webhook: notification verification failed:",
      error instanceof Error ? error.message : "unknown",
    );
    // Unverifiable is the one case that IS an error worth a retry: a
    // transient key-fetch failure looks identical to a forged payload
    // from here, and Apple's retry will simply re-verify successfully
    // once whatever was transient passes.
    return Response.json({ ok: false, reason: "unverifiable" }, { status: 400 });
  }

  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  const status = notification.data?.status;
  if (!signedTransactionInfo || status === undefined) {
    // Notification types this endpoint has nothing to mirror yet
    // (CONSUMPTION_REQUEST, EXTERNAL_PURCHASE_TOKEN, and any type with
    // no subscription status attached): acknowledged, not an error.
    return Response.json({ ok: true, handled: false });
  }

  let transaction;
  try {
    transaction = await verifyAppleTransaction(signedTransactionInfo);
  } catch (error) {
    console.error(
      "billing/apple/webhook: embedded transaction verification failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "unverifiable" }, { status: 400 });
  }

  const originalTransactionId = transaction.originalTransactionId ?? transaction.transactionId;
  if (!originalTransactionId) {
    return Response.json({ ok: true, handled: false });
  }

  const product = providerProduct("apple", transaction.productId);
  if (!product) {
    console.error(
      `billing/apple/webhook: ignored unconfigured product ${transaction.productId ?? "unset"}`,
    );
    return Response.json({ ok: true, handled: false });
  }

  const [linkedFamilyId, pendingClaim] = await Promise.all([
    familyIdForAppleOriginalTransaction(originalTransactionId),
    transaction.appAccountToken
      ? pendingApplePurchaseClaimForAttempt(transaction.appAccountToken)
      : Promise.resolve(null),
  ]);
  const claim = resolveApplePurchaseClaim({
    linkedFamilyId,
    pendingClaim,
    signedProductId: product.productId,
  });
  if (claim.kind === "rejected") {
    console.error(
      `billing/apple/webhook: no matching family and product claim for original_transaction_id ${originalTransactionId} yet`,
    );
    return Response.json({ ok: true, handled: false });
  }
  if (
    claim.kind === "fresh"
    && !appleProductAvailableForNewPurchase(product.productId)
  ) {
    console.error(
      `billing/apple/webhook: rejected unavailable new-purchase product ${product.productId}`,
    );
    return Response.json({ ok: true, handled: false });
  }

  const subscription = {
    originalTransactionId,
    status: appleStatusToSharedVocabulary(status),
    productId: product.productId,
    tier: product.tier,
    period: product.period,
    expiresAtMs: transaction.expiresDate ?? null,
    purchaseAttemptId: claim.purchaseAttemptId,
    purchaseDateMs: transaction.purchaseDate ?? null,
    providerObservedAtMs: notification.signedDate
      ?? transaction.signedDate
      ?? transaction.purchaseDate
      ?? null,
  };
  if (claim.kind === "fresh") {
    await recordFamilyAppleSubscription(claim.familyId, subscription);
  } else {
    await recordVerifiedFamilyAppleSubscriptionStatus(claim.familyId, subscription);
  }

  return Response.json({ ok: true, handled: true });
}
