import {
  AppleTransactionClaimedError,
  recordFamilyAppleSubscription,
  startFamilyTrial,
  tierForAppleProduct,
} from "../../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../../lib/map/events";
import { requireFamily, requireFamilyFromBearer } from "../../../../../lib/map/session";
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
 * sets StoreKit's appAccountToken to the signed-in family's id at
 * purchase time (arc F's mobile client, task #21), Apple signs it into
 * the transaction, and this route verifies the signed value against the
 * AUTHENTICATED caller's own family, never trusting a client-supplied
 * field. A transaction whose appAccountToken does not match the caller
 * unlocks nobody.
 */
export async function POST(request: Request): Promise<Response> {
  const family = (await requireFamilyFromBearer(request)) ?? (await requireFamily());
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

  if (decoded.appAccountToken !== family.id) {
    console.error(
      `billing/apple/confirm: appAccountToken (${decoded.appAccountToken ?? "unset"}) does not match the signed-in family`,
    );
    return Response.json({ ok: false, reason: "family-mismatch" }, { status: 403 });
  }

  const originalTransactionId = decoded.originalTransactionId ?? decoded.transactionId;
  if (!originalTransactionId) {
    console.error("billing/apple/confirm: verified transaction carried no transaction id");
    return Response.json({ ok: false, reason: "malformed" }, { status: 400 });
  }

  const tier = tierForAppleProduct(decoded.productId);
  const fresh = await startFamilyTrial(family.id, null, tier);
  if (fresh) {
    await emitMapEvent("billing.trial_started", { family_id: family.id });
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
      productId: decoded.productId ?? null,
      expiresAtMs: decoded.expiresDate ?? null,
    });
  } catch (error) {
    if (error instanceof AppleTransactionClaimedError) {
      // The trial/tier stamp above already happened and stays: this
      // family is entitled either way. Only the transaction-identity
      // mirror failed to attach, worth surfacing for the founder to
      // look at (a shared Apple Account across two Homa families is the
      // most likely real-world cause), never worth walling a family
      // that just verifiably paid.
      console.error(`billing/apple/confirm: ${error.message}`);
    } else {
      throw error;
    }
  }

  return Response.json({ ok: true, planTier: tier });
}
