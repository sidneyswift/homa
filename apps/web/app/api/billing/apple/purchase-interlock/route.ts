import {
  appleProductAvailableForNewPurchase,
  providerProduct,
} from "@homa/core";

import {
  activeApplePurchaseInterlock,
  ApplePurchaseAlreadyPendingError,
  ApplePurchaseInterlockConflictError,
  ApplePurchaseInterlockTransitionError,
  ApplePurchaseInterlockUnavailableError,
  beginApplePurchaseInterlock,
  markApplePurchaseInterlockPhase,
  requestApplePurchaseInterlockCancellation,
} from "../../../../../lib/billing/apple-purchase-interlock";
import { requireFamilyFromRequest } from "../../../../../lib/map/session";

async function authenticatedFamily(request: Request) {
  return requireFamilyFromRequest(request);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Recover an unresolved handoff after reinstall, sign-out, or local storage loss. */
export async function GET(request: Request): Promise<Response> {
  const family = await authenticatedFamily(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const interlock = await activeApplePurchaseInterlock(family.id);
  return Response.json({ ok: true, interlock });
}

/** Commit the deletion interlock before the mobile app is allowed to open StoreKit. */
export async function POST(request: Request): Promise<Response> {
  const family = await authenticatedFamily(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const productId = body && typeof body === "object" && "productId" in body
    ? (body as { productId: unknown }).productId
    : null;
  const attemptId = body && typeof body === "object" && "attemptId" in body
    ? (body as { attemptId: unknown }).attemptId
    : null;
  if (typeof productId !== "string" || !providerProduct("apple", productId)) {
    return Response.json(
      { ok: false, reason: "unconfigured-product" },
      { status: 400 },
    );
  }
  if (!appleProductAvailableForNewPurchase(productId)) {
    return Response.json(
      { ok: false, reason: "product-unavailable" },
      { status: 400 },
    );
  }
  if (typeof attemptId !== "string" || !UUID_PATTERN.test(attemptId)) {
    return Response.json({ ok: false, reason: "bad-attempt" }, { status: 400 });
  }

  try {
    const interlock = await beginApplePurchaseInterlock(
      family.id,
      productId,
      attemptId,
    );
    return Response.json({ ok: true, interlock });
  } catch (error) {
    if (error instanceof ApplePurchaseInterlockUnavailableError) {
      return Response.json(
        { ok: false, reason: "account-closing" },
        { status: 409 },
      );
    }
    if (error instanceof ApplePurchaseAlreadyPendingError) {
      return Response.json(
        {
          ok: false,
          reason: "purchase-unresolved",
          interlock: error.interlock,
        },
        { status: 409 },
      );
    }
    if (error instanceof ApplePurchaseInterlockConflictError) {
      return Response.json(
        { ok: false, reason: "attempt-conflict" },
        { status: 409 },
      );
    }
    throw error;
  }
}

/** Advance only the exact persisted attempt before the next client effect. */
export async function PATCH(request: Request): Promise<Response> {
  const family = await authenticatedFamily(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const attemptId = body && typeof body === "object" && "attemptId" in body
    ? (body as { attemptId: unknown }).attemptId
    : null;
  const phase = body && typeof body === "object" && "phase" in body
    ? (body as { phase: unknown }).phase
    : null;
  if (typeof attemptId !== "string" || !UUID_PATTERN.test(attemptId)) {
    return Response.json({ ok: false, reason: "bad-attempt" }, { status: 400 });
  }
  if (phase !== "store_started" && phase !== "cancel_pending") {
    return Response.json({ ok: false, reason: "bad-phase" }, { status: 400 });
  }

  let interlock;
  try {
    interlock = await markApplePurchaseInterlockPhase(
      family.id,
      attemptId,
      phase,
    );
  } catch (error) {
    if (error instanceof ApplePurchaseInterlockTransitionError) {
      return Response.json(
        {
          ok: false,
          reason: "forbidden-transition",
          interlock: error.interlock,
        },
        { status: 409 },
      );
    }
    throw error;
  }
  if (!interlock) {
    return Response.json({ ok: false, reason: "unknown-attempt" }, { status: 404 });
  }
  return Response.json({ ok: true, interlock });
}

/** Clear only the exact attempt StoreKit explicitly canceled or rejected. */
export async function DELETE(request: Request): Promise<Response> {
  const family = await authenticatedFamily(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const attemptId = body && typeof body === "object" && "attemptId" in body
    ? (body as { attemptId: unknown }).attemptId
    : null;
  if (
    typeof attemptId !== "string"
    || !UUID_PATTERN.test(attemptId)
  ) {
    return Response.json({ ok: false, reason: "bad-attempt" }, { status: 400 });
  }

  const result = await requestApplePurchaseInterlockCancellation(
    family.id,
    attemptId,
  );
  if (!result.interlock) {
    return Response.json(
      { ok: false, reason: "unknown-attempt" },
      { status: 404 },
    );
  }
  if (!result.cleared) {
    return Response.json(
      {
        ok: false,
        reason: "purchase-may-have-started",
        cleared: false,
        interlock: result.interlock,
      },
      { status: 409 },
    );
  }
  return Response.json({
    ok: true,
    cleared: true,
    interlock: result.interlock,
  });
}
