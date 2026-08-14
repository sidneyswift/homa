import type { TransactionSql } from "postgres";

import { mapDb } from "../map/db";

export class ApplePurchaseInterlockUnavailableError extends Error {
  constructor() {
    super("The family is unavailable for a new App Store purchase");
    this.name = "ApplePurchaseInterlockUnavailableError";
  }
}

export const ACTIVE_APPLE_PURCHASE_INTERLOCK_STATES = [
  "prepared",
  "store_started",
  "cancel_pending",
] as const;

export type ActiveApplePurchaseInterlockState =
  (typeof ACTIVE_APPLE_PURCHASE_INTERLOCK_STATES)[number];
export type ApplePurchaseInterlockState =
  | ActiveApplePurchaseInterlockState
  | "canceled"
  | "resolved";

export interface ApplePurchaseInterlock {
  attemptId: string;
  productId: string;
  state: ApplePurchaseInterlockState;
}

export interface PendingApplePurchaseClaim extends ApplePurchaseInterlock {
  familyId: string;
}

export type ApplePurchaseClaimResolution =
  | {
      kind: "fresh" | "linked";
      familyId: string;
      purchaseAttemptId: string | null;
    }
  | {
      kind: "rejected";
      reason: "family-mismatch" | "product-mismatch" | "unclaimed";
    };

type ApplePurchaseInterlockRow = {
  attempt_id: string;
  family_id: string;
  product_id: string;
  state: ApplePurchaseInterlockState;
};

function interlockFromRow(row: ApplePurchaseInterlockRow): ApplePurchaseInterlock {
  return {
    attemptId: row.attempt_id,
    productId: row.product_id,
    state: row.state,
  };
}

export class ApplePurchaseInterlockConflictError extends Error {
  constructor() {
    super("The App Store purchase attempt belongs to a different request");
    this.name = "ApplePurchaseInterlockConflictError";
  }
}

export class ApplePurchaseAlreadyPendingError extends Error {
  readonly interlock: ApplePurchaseInterlock;

  constructor(interlock: ApplePurchaseInterlock) {
    super("Another App Store purchase attempt is still unresolved");
    this.name = "ApplePurchaseAlreadyPendingError";
    this.interlock = interlock;
  }
}

export class ApplePurchaseInterlockTransitionError extends Error {
  readonly interlock: ApplePurchaseInterlock;

  constructor(interlock: ApplePurchaseInterlock) {
    super(`The App Store purchase cannot advance from ${interlock.state}`);
    this.name = "ApplePurchaseInterlockTransitionError";
    this.interlock = interlock;
  }
}

export function canMarkApplePurchaseInterlockPhase(
  state: ApplePurchaseInterlockState,
  phase: "store_started" | "cancel_pending",
): boolean {
  if (phase === "store_started") {
    return state === "prepared" || state === "store_started";
  }
  return state === "store_started" || state === "cancel_pending";
}

/**
 * Resolve a verified Apple transaction without letting one valid attempt
 * claim a different product or family. A previously linked original
 * transaction remains authoritative for renewals and App Store upgrades.
 */
export function resolveApplePurchaseClaim({
  authenticatedFamilyId,
  linkedFamilyId,
  pendingClaim,
  signedProductId,
}: {
  authenticatedFamilyId?: string;
  linkedFamilyId: string | null;
  pendingClaim: PendingApplePurchaseClaim | null;
  signedProductId: string;
}): ApplePurchaseClaimResolution {
  if (linkedFamilyId) {
    if (authenticatedFamilyId && linkedFamilyId !== authenticatedFamilyId) {
      return { kind: "rejected", reason: "family-mismatch" };
    }
    const matchingPendingAttempt = pendingClaim
      && pendingClaim.familyId === linkedFamilyId
      && pendingClaim.productId === signedProductId
      ? pendingClaim.attemptId
      : null;
    return {
      kind: "linked",
      familyId: linkedFamilyId,
      purchaseAttemptId: matchingPendingAttempt,
    };
  }

  if (!pendingClaim) return { kind: "rejected", reason: "unclaimed" };
  if (
    authenticatedFamilyId
    && pendingClaim.familyId !== authenticatedFamilyId
  ) {
    return { kind: "rejected", reason: "family-mismatch" };
  }
  if (pendingClaim.productId !== signedProductId) {
    return { kind: "rejected", reason: "product-mismatch" };
  }
  return {
    kind: "fresh",
    familyId: pendingClaim.familyId,
    purchaseAttemptId: pendingClaim.attemptId,
  };
}

/**
 * Commits a family-scoped purchase marker before StoreKit is allowed to open.
 * Account deletion takes the same family lock first, so exactly one side wins:
 * either deletion leaves a tombstone and this call fails, or this marker lands
 * and deletion must preserve access until the purchase outcome is known.
 *
 * Every attempt remains its own row. StoreKit signs attempt_id as the
 * appAccountToken, so a delayed result can resolve only the attempt that
 * created it and can never erase a newer purchase fence.
 */
export async function beginApplePurchaseInterlock(
  familyId: string,
  productId: string,
  attemptId: string,
): Promise<ApplePurchaseInterlock> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    const families = await tx<Array<{ id: string }>>`
      select family.id
      from public.families family
      where family.id = ${familyId}
        and family.status <> 'deleted'
      for update
    `;
    if (!families[0]) throw new ApplePurchaseInterlockUnavailableError();

    const tombstones = await tx<Array<{ family_id: string }>>`
      select tombstone.family_id
      from public.account_deletion_artifact_tombstones tombstone
      where tombstone.family_id = ${familyId}
      limit 1
    `;
    if (tombstones[0]) throw new ApplePurchaseInterlockUnavailableError();

    const exactAttempts = await tx<ApplePurchaseInterlockRow[]>`
      select attempt_id::text as attempt_id,
             family_id::text as family_id,
             product_id,
             state
      from public.apple_purchase_interlocks
      where attempt_id = ${attemptId}
      limit 1
    `;
    const exactAttempt = exactAttempts[0];
    if (exactAttempt) {
      if (
        exactAttempt.family_id !== familyId
        || exactAttempt.product_id !== productId
      ) {
        throw new ApplePurchaseInterlockConflictError();
      }
      return interlockFromRow(exactAttempt);
    }

    const activeAttempts = await tx<ApplePurchaseInterlockRow[]>`
      select attempt_id::text as attempt_id,
             family_id::text as family_id,
             product_id,
             state
      from public.apple_purchase_interlocks
      where family_id = ${familyId}
        and state in ('prepared', 'store_started', 'cancel_pending')
      order by created_at, attempt_id
      limit 1
    `;
    if (activeAttempts[0]) {
      throw new ApplePurchaseAlreadyPendingError(
        interlockFromRow(activeAttempts[0]),
      );
    }

    const attempts = await tx<ApplePurchaseInterlockRow[]>`
      insert into public.apple_purchase_interlocks
        (attempt_id, family_id, product_id, state)
      values (${attemptId}, ${familyId}, ${productId}, 'prepared')
      returning attempt_id::text as attempt_id,
                family_id::text as family_id,
                product_id,
                state
    `;
    const attempt = attempts[0];
    if (!attempt) throw new Error("App Store purchase protection did not start.");
    return interlockFromRow(attempt);
  });
}

/** Recover the one unresolved attempt after local storage loss or reinstall. */
export async function activeApplePurchaseInterlock(
  familyId: string,
): Promise<ApplePurchaseInterlock | null> {
  const sql = mapDb();
  const attempts = await sql<ApplePurchaseInterlockRow[]>`
    select attempt_id::text as attempt_id,
           family_id::text as family_id,
           product_id,
           state
    from public.apple_purchase_interlocks
    where family_id = ${familyId}
      and state in ('prepared', 'store_started', 'cancel_pending')
    order by created_at, attempt_id
    limit 1
  `;
  return attempts[0] ? interlockFromRow(attempts[0]) : null;
}

/** Persist the last client-known phase before StoreKit or cancellation advances. */
export async function markApplePurchaseInterlockPhase(
  familyId: string,
  attemptId: string,
  phase: "store_started" | "cancel_pending",
): Promise<ApplePurchaseInterlock | null> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    const attempts = await tx<ApplePurchaseInterlockRow[]>`
      select attempt_id::text as attempt_id,
             family_id::text as family_id,
             product_id,
             state
      from public.apple_purchase_interlocks
      where family_id = ${familyId}
        and attempt_id = ${attemptId}
      for update
    `;
    const attempt = attempts[0];
    if (!attempt) return null;
    const interlock = interlockFromRow(attempt);
    if (!canMarkApplePurchaseInterlockPhase(interlock.state, phase)) {
      throw new ApplePurchaseInterlockTransitionError(interlock);
    }
    if (interlock.state === phase) return interlock;

    const updated = await tx<ApplePurchaseInterlockRow[]>`
      update public.apple_purchase_interlocks
      set state = ${phase},
          updated_at = now()
      where family_id = ${familyId}
        and attempt_id = ${attemptId}
      returning attempt_id::text as attempt_id,
                family_id::text as family_id,
                product_id,
                state
    `;
    return updated[0] ? interlockFromRow(updated[0]) : null;
  });
}

/** Return the exact row so the route can retain a started purchase fence. */
export async function requestApplePurchaseInterlockCancellation(
  familyId: string,
  attemptId: string,
): Promise<{
  cleared: boolean;
  interlock: ApplePurchaseInterlock | null;
}> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    const attempts = await tx<ApplePurchaseInterlockRow[]>`
      select attempt_id::text as attempt_id,
             family_id::text as family_id,
             product_id,
             state
      from public.apple_purchase_interlocks
      where family_id = ${familyId}
        and attempt_id = ${attemptId}
      for update
    `;
    const attempt = attempts[0];
    if (!attempt) return { cleared: false, interlock: null };
    const interlock = interlockFromRow(attempt);
    if (interlock.state === "canceled") {
      return { cleared: true, interlock };
    }
    if (interlock.state !== "prepared") {
      return { cleared: false, interlock };
    }

    const canceled = await tx<ApplePurchaseInterlockRow[]>`
      update public.apple_purchase_interlocks
      set state = 'canceled',
          canceled_at = now(),
          resolved_at = null,
          updated_at = now()
      where family_id = ${familyId}
        and attempt_id = ${attemptId}
        and state = 'prepared'
      returning attempt_id::text as attempt_id,
                family_id::text as family_id,
                product_id,
                state
    `;
    const canceledInterlock = canceled[0]
      ? interlockFromRow(canceled[0])
      : interlock;
    return {
      cleared: canceledInterlock.state === "canceled",
      interlock: canceledInterlock,
    };
  });
}

/** Only the exact prepared attempt may declare that StoreKit never started. */
export async function abandonApplePurchaseInterlock(
  familyId: string,
  attemptId: string,
): Promise<boolean> {
  return (
    await requestApplePurchaseInterlockCancellation(familyId, attemptId)
  ).cleared;
}

/**
 * Verified Apple evidence resolves only a marker that began before that exact
 * purchase. This timestamp fence prevents a delayed notification for an older
 * transaction from clearing a newer StoreKit gap.
 */
export async function clearApplePurchaseInterlockAfterVerifiedTransaction(
  familyId: string,
  attemptId: string | null | undefined,
  purchaseDateMs: number | null | undefined,
): Promise<boolean> {
  const sql = mapDb();
  return await sql.begin(async (tx) =>
    clearApplePurchaseInterlockAfterVerifiedTransactionInTransaction(
      tx,
      familyId,
      attemptId,
      purchaseDateMs,
    ));
}

export async function clearApplePurchaseInterlockAfterVerifiedTransactionInTransaction(
  tx: TransactionSql,
  familyId: string,
  attemptId: string | null | undefined,
  purchaseDateMs: number | null | undefined,
): Promise<boolean> {
  if (!attemptId || !Number.isFinite(purchaseDateMs)) return false;
  const cleared = await tx<Array<{ family_id: string }>>`
    update public.apple_purchase_interlocks
    set state = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        canceled_at = null,
        updated_at = now()
    where family_id = ${familyId}
      and attempt_id::text = ${attemptId}
      and created_at <= to_timestamp(${purchaseDateMs!} / 1000.0)
    returning family_id
  `;
  return Boolean(cleared[0]);
}

/**
 * A signed App Store notification can outrun the mobile confirmation request.
 * The signed appAccountToken is the exact attempt id, and may claim only the
 * family that committed that attempt before StoreKit opened.
 */
export async function pendingApplePurchaseClaimForAttempt(
  appAccountToken: string,
): Promise<PendingApplePurchaseClaim | null> {
  const sql = mapDb();
  const rows = await sql<ApplePurchaseInterlockRow[]>`
    select interlock.attempt_id::text as attempt_id,
           family.id::text as family_id,
           interlock.product_id,
           interlock.state
    from public.families family
    join public.apple_purchase_interlocks interlock
      on interlock.family_id = family.id
    where lower(interlock.attempt_id::text) = lower(${appAccountToken})
      and interlock.state in ('prepared', 'store_started', 'cancel_pending')
      and family.status <> 'deleted'
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    ...interlockFromRow(row),
    familyId: row.family_id,
  };
}
