import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Purchase } from "expo-iap";

import type { BootstrapResult } from "../features/bootstrap/bootstrap";
import {
  BootstrapFailure,
} from "../features/bootstrap/bootstrap";
import { runMobileBootstrapStep } from "../features/bootstrap/mobile-bootstrap";
import { env, EVE_CHANNEL_HEADER } from "./env";
import { supabase } from "./supabase";

/**
 * The two calls the StoreKit flow needs on apps/web (arc F): the one
 * question a paywall must ask before it ever renders purchase UI
 * (GET /api/billing/gate), and the one call that turns a completed
 * StoreKit transaction into real entitlement
 * (POST /api/billing/apple/confirm). Both are bearer-authed the same
 * way turn-recovery.ts reaches eve: this app has no cookies, so the
 * Supabase access token IS the session.
 */

/** Why the gate answered `open` the way it did (the server's
 *  lib/billing/gate-reason.ts shape): real entitlement, the mobile
 *  onboarding free window, or a wall with purchase UI as the next step.
 *  The walk's late screens branch on this instead of guessing (spec
 *  2026-08-30 Outcome 6). */
export type BillingGateReason = "entitled" | "onboarding_grace" | "walled";

/** The durable onboarding record's state as stored: "done" is a free
 *  window that ENDED, "none" a family that never had one. */
export type BillingGateOnboarding = "active" | "done" | "none";

export interface BillingGateState {
  open: boolean;
  reason: BillingGateReason;
  onboarding: BillingGateOnboarding;
  lapsed: boolean;
  planTier: string;
  billingProvider: "stripe" | "apple" | "google" | null;
  billingPeriod: "monthly" | "annual" | null;
}

const GATE_REASONS: readonly BillingGateReason[] = [
  "entitled",
  "onboarding_grace",
  "walled",
];
const GATE_ONBOARDING_STATES: readonly BillingGateOnboarding[] = [
  "active",
  "done",
  "none",
];

async function bearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function apiUrl(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

/** A failed check carries a closed reason: a paywall that cannot ask the
 *  question must never guess either open or walled. */
export async function fetchBillingGate(): Promise<
  BootstrapResult<BillingGateState>
> {
  return runMobileBootstrapStep("billing", async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new BootstrapFailure("billing", "expired_session");
    const response = await fetch(apiUrl("/api/billing/gate"), {
      headers: { Authorization: `Bearer ${token}`, ...EVE_CHANNEL_HEADER },
    });
    if (response.status === 401 || response.status === 403) {
      throw new BootstrapFailure("billing", "expired_session");
    }
    if (response.status >= 500) {
      throw new BootstrapFailure("billing", "server_error");
    }
    if (!response.ok) throw new BootstrapFailure("billing", "unknown");
    const body = (await response.json()) as {
      ok?: boolean;
      open?: boolean;
      reason?: string;
      onboarding?: string;
      lapsed?: boolean;
      planTier?: string;
      billingProvider?: "stripe" | "apple" | "google" | null;
      billingPeriod?: "monthly" | "annual" | null;
    };
    if (!body.ok) throw new BootstrapFailure("billing", "unknown");
    const open = body.open === true;
    return {
      open,
      // A server predating the reason shape only says open; derive the
      // never-over-promising name for it (open with no name cannot be
      // told apart from entitlement, and "walled" is exact either way).
      reason: GATE_REASONS.find((reason) => reason === body.reason)
        ?? (open ? "entitled" : "walled"),
      onboarding:
        GATE_ONBOARDING_STATES.find((state) => state === body.onboarding)
          ?? "none",
      lapsed: body.lapsed === true,
      planTier: body.planTier ?? "regular",
      billingProvider: body.billingProvider ?? null,
      billingPeriod: body.billingPeriod ?? null,
    };
  });
}

export type ConfirmApplePurchaseResult =
  | {
      ok: true;
      planTier: string;
      purchaseAttemptId: string | null;
      blockedByDifferentAttempt: boolean;
    }
  | { ok: false; reason: string };

export type BeginApplePurchaseResult =
  | { ok: true; attemptId: string }
  | { ok: false; reason: string };

export type ApplePurchaseRecoveryAttempt = {
  attemptId: string;
  phase: ApplePurchaseAttemptPhase;
};

type ApplePurchaseAttemptPhase =
  | "prepared"
  | "store_started"
  | "cancel_pending"
  | "confirm_pending"
  | "finish_pending";

type PersistedApplePurchaseAttempt = {
  attemptId: string;
  familyId: string;
  productId: string;
  phase: ApplePurchaseAttemptPhase;
  signedTransaction?: string;
  finishPurchase?: Purchase;
};

type ServerApplePurchaseInterlock = {
  attemptId: string;
  productId: string;
  state: "prepared" | "store_started" | "cancel_pending" | "canceled" | "resolved";
};

const APPLE_PURCHASE_ATTEMPT_KEY = "@homa/apple-purchase-attempt/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CORRUPTED_APPLE_PURCHASE_ATTEMPT_ID = "00000000-0000-4000-8000-000000000000";

function normalizedApplePurchaseAttemptId(value: string | null): string | null {
  return value?.toLowerCase() ?? null;
}

function canonicalStoreKitFinishPurchase(purchase: Purchase): Purchase {
  return {
    id: purchase.id,
    ids: purchase.ids ?? undefined,
    isAutoRenewing: purchase.isAutoRenewing,
    platform: purchase.platform,
    productId: purchase.productId,
    purchaseState: purchase.purchaseState,
    purchaseToken: purchase.purchaseToken ?? null,
    quantity: purchase.quantity,
    store: purchase.store,
    transactionDate: purchase.transactionDate,
    transactionId: purchase.transactionId,
  } as Purchase;
}

function isStoreKitFinishPurchase(value: unknown): value is Purchase {
  if (!value || typeof value !== "object") return false;
  const purchase = value as Partial<Purchase>;
  return typeof purchase.id === "string"
    && typeof purchase.isAutoRenewing === "boolean"
    && typeof purchase.platform === "string"
    && typeof purchase.productId === "string"
    && typeof purchase.purchaseState === "string"
    && typeof purchase.purchaseToken === "string"
    && typeof purchase.quantity === "number"
    && typeof purchase.store === "string"
    && typeof purchase.transactionDate === "number"
    && typeof purchase.transactionId === "string"
    && (
      purchase.ids === undefined
      || (
        Array.isArray(purchase.ids)
        && purchase.ids.every((id) => typeof id === "string")
      )
    );
}

function applePurchaseAttemptStorageKey(familyId: string): string {
  return `${APPLE_PURCHASE_ATTEMPT_KEY}/${familyId}`;
}

function newApplePurchaseAttemptId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isPersistedApplePurchaseAttempt(
  value: unknown,
  familyId: string,
): value is PersistedApplePurchaseAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<PersistedApplePurchaseAttempt>;
  return attempt.familyId === familyId
    && typeof attempt.attemptId === "string"
    && UUID_PATTERN.test(attempt.attemptId)
    && typeof attempt.productId === "string"
    && (
      attempt.phase === "prepared"
      || attempt.phase === "store_started"
      || attempt.phase === "cancel_pending"
      || attempt.phase === "confirm_pending"
      || attempt.phase === "finish_pending"
    )
    && (attempt.signedTransaction === undefined || typeof attempt.signedTransaction === "string")
    && (attempt.finishPurchase === undefined || isStoreKitFinishPurchase(attempt.finishPurchase));
}

async function readApplePurchaseAttempt(
  familyId: string,
): Promise<PersistedApplePurchaseAttempt | null> {
  const key = applePurchaseAttemptStorageKey(familyId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPersistedApplePurchaseAttempt(parsed, familyId)) return parsed;
    return {
      attemptId: CORRUPTED_APPLE_PURCHASE_ATTEMPT_ID,
      familyId,
      productId: "corrupted-local-purchase",
      phase: "finish_pending",
    };
  } catch {
    return {
      attemptId: CORRUPTED_APPLE_PURCHASE_ATTEMPT_ID,
      familyId,
      productId: "corrupted-local-purchase",
      phase: "finish_pending",
    };
  }
}

async function persistApplePurchaseAttempt(
  attempt: PersistedApplePurchaseAttempt,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(
      applePurchaseAttemptStorageKey(attempt.familyId),
      JSON.stringify(attempt),
    );
    return true;
  } catch {
    return false;
  }
}

async function clearApplePurchaseAttempt(
  familyId: string,
  attemptId: string,
): Promise<boolean> {
  const current = await readApplePurchaseAttempt(familyId);
  if (current?.attemptId !== attemptId) return true;
  try {
    await AsyncStorage.removeItem(applePurchaseAttemptStorageKey(familyId));
    return true;
  } catch {
    // A terminal server acknowledgment remains authoritative. A later launch
    // will reconcile this stale local journal against the retained server row.
    return false;
  }
}

function localPhaseForServerState(
  state: ServerApplePurchaseInterlock["state"],
): ApplePurchaseAttemptPhase | null {
  if (state === "prepared" || state === "store_started" || state === "cancel_pending") {
    return state;
  }
  return null;
}

async function fetchActiveApplePurchaseInterlock(
  token: string,
): Promise<ServerApplePurchaseInterlock | null | undefined> {
  try {
    const response = await fetch(apiUrl("/api/billing/apple/purchase-interlock"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      ok?: boolean;
      interlock?: ServerApplePurchaseInterlock | null;
    };
    return body.ok ? body.interlock ?? null : undefined;
  } catch {
    return undefined;
  }
}

export async function applePurchaseAttemptForRecovery(
  familyId: string,
): Promise<ApplePurchaseRecoveryAttempt | null> {
  let current = await readApplePurchaseAttempt(familyId);
  if (!current) {
    const token = await bearerToken();
    if (!token) return null;
    const active = await fetchActiveApplePurchaseInterlock(token);
    if (!active) return null;
    const phase = localPhaseForServerState(active.state);
    if (!phase) return null;
    current = {
      attemptId: active.attemptId,
      familyId,
      productId: active.productId,
      phase,
    };
    if (!(await persistApplePurchaseAttempt(current))) return null;
  }
  return { attemptId: current.attemptId, phase: current.phase };
}

/**
 * Durable server acknowledgment required before StoreKit may open. This is
 * intentionally separate from confirmApplePurchase: the charge happens in the
 * gap between these calls, so account deletion must see that gap itself.
 */
export async function beginApplePurchase(
  familyId: string,
  productId: string,
): Promise<BeginApplePurchaseResult> {
  try {
    const token = await bearerToken();
    if (!token) return { ok: false, reason: "no-session" };
    let persisted = await readApplePurchaseAttempt(familyId);
    if (!persisted) {
      const active = await fetchActiveApplePurchaseInterlock(token);
      if (active === undefined) return { ok: false, reason: "network-error" };
      if (active) {
        const phase = localPhaseForServerState(active.state);
        if (!phase) return { ok: false, reason: "purchase-resolved" };
        persisted = {
          attemptId: active.attemptId,
          familyId,
          productId: active.productId,
          phase,
        };
        if (!(await persistApplePurchaseAttempt(persisted))) {
          return { ok: false, reason: "device-storage-error" };
        }
      }
    }
    if (persisted && persisted.productId !== productId) {
      return { ok: false, reason: "purchase-unresolved" };
    }
    if (persisted?.phase === "cancel_pending") {
      if (!(await abandonApplePurchase(familyId, persisted.attemptId))) {
        return { ok: false, reason: "purchase-unresolved" };
      }
      persisted = null;
    }
    if (
      persisted?.phase === "store_started"
      || persisted?.phase === "confirm_pending"
      || persisted?.phase === "finish_pending"
    ) {
      return { ok: false, reason: "purchase-unresolved" };
    }
    if (!persisted) {
      persisted = {
        attemptId: newApplePurchaseAttemptId(),
        familyId,
        productId,
        phase: "prepared",
      };
      if (!(await persistApplePurchaseAttempt(persisted))) {
        return { ok: false, reason: "device-storage-error" };
      }
    }
    const response = await fetch(apiUrl("/api/billing/apple/purchase-interlock"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, attemptId: persisted.attemptId }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      reason?: string;
      interlock?: ServerApplePurchaseInterlock;
    };
    if (!response.ok || !body.ok || !body.interlock) {
      if (body.interlock) {
        const phase = localPhaseForServerState(body.interlock.state);
        if (phase) {
          await persistApplePurchaseAttempt({
            attemptId: body.interlock.attemptId,
            familyId,
            productId: body.interlock.productId,
            phase,
          });
        }
      }
      if (body.reason === "account-closing" || body.reason === "attempt-conflict") {
        await clearApplePurchaseAttempt(familyId, persisted.attemptId);
      }
      return { ok: false, reason: body.reason ?? "interlock-failed" };
    }
    if (body.interlock.state === "canceled") {
      if (!(await clearApplePurchaseAttempt(familyId, persisted.attemptId))) {
        return { ok: false, reason: "device-storage-error" };
      }
      return beginApplePurchase(familyId, productId);
    }
    if (body.interlock.state === "resolved") {
      return { ok: false, reason: "purchase-unresolved" };
    }
    return { ok: true, attemptId: body.interlock.attemptId };
  } catch {
    return { ok: false, reason: "network-error" };
  }
}

async function persistKnownApplePurchaseInterlock(
  familyId: string,
  interlock: ServerApplePurchaseInterlock,
): Promise<boolean> {
  const phase = localPhaseForServerState(interlock.state);
  if (!phase) return false;
  const current = await readApplePurchaseAttempt(familyId);
  if (current && current.attemptId !== interlock.attemptId) return false;
  if (current?.phase === "confirm_pending" || current?.phase === "finish_pending") {
    return true;
  }
  return persistApplePurchaseAttempt({
    attemptId: interlock.attemptId,
    familyId,
    productId: interlock.productId,
    phase,
  });
}

async function markApplePurchaseCancellationPending(
  familyId: string,
  token: string,
  interlock: ServerApplePurchaseInterlock,
): Promise<void> {
  if (
    interlock.state !== "store_started"
    && interlock.state !== "cancel_pending"
  ) {
    return;
  }
  if (!(await persistKnownApplePurchaseInterlock(familyId, interlock))) return;
  if (interlock.state === "cancel_pending") return;

  try {
    const response = await fetch(apiUrl("/api/billing/apple/purchase-interlock"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attemptId: interlock.attemptId,
        phase: "cancel_pending",
      }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      interlock?: ServerApplePurchaseInterlock;
    };
    if (
      body.ok === true
      && body.interlock?.attemptId === interlock.attemptId
      && body.interlock.state === "cancel_pending"
    ) {
      await persistKnownApplePurchaseInterlock(familyId, body.interlock);
    }
  } catch {
    // The exact store_started journal remains. Recovery retries without
    // claiming the provider-uncertain transition reached the server.
  }
}

/** Ask the server to cancel only if StoreKit was never allowed to start. */
export async function abandonApplePurchase(
  familyId: string,
  attemptId: string,
): Promise<boolean> {
  try {
    const token = await bearerToken();
    if (!token) return false;
    const response = await fetch(apiUrl("/api/billing/apple/purchase-interlock"), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attemptId }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      cleared?: boolean;
      interlock?: ServerApplePurchaseInterlock;
    };
    if (
      response.ok
      && body.ok === true
      && body.cleared === true
      && body.interlock?.attemptId === attemptId
      && body.interlock.state === "canceled"
    ) {
      await clearApplePurchaseAttempt(familyId, attemptId);
      return true;
    }
    if (body.interlock?.attemptId === attemptId) {
      await markApplePurchaseCancellationPending(familyId, token, body.interlock);
    }
    return false;
  } catch {
    return false;
  }
}

/** Commit the uncertain phase before the native purchase sheet may open. */
export async function markApplePurchaseStoreStarted(
  familyId: string,
  attemptId: string,
): Promise<boolean> {
  try {
    const token = await bearerToken();
    if (!token) return false;
    const current = await readApplePurchaseAttempt(familyId);
    if (!current || current.attemptId !== attemptId) return false;
    const storeStarted = { ...current, phase: "store_started" as const };
    if (!(await persistApplePurchaseAttempt(storeStarted))) return false;
    const response = await fetch(apiUrl("/api/billing/apple/purchase-interlock"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attemptId, phase: "store_started" }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as {
      ok?: boolean;
      interlock?: ServerApplePurchaseInterlock;
    };
    return body.ok === true && body.interlock?.state === "store_started";
  } catch {
    return false;
  }
}

/** signedTransaction is StoreKit's Transaction.jwsRepresentation,
 *  handed back by expo-iap as purchase.purchaseToken on iOS. The
 *  server re-verifies the signature itself; nothing here is trusted
 *  client-side. */
export async function confirmApplePurchase(
  familyId: string,
  signedTransaction: string,
  purchaseAttemptId: string | null,
  finishPurchase: Purchase,
): Promise<ConfirmApplePurchaseResult> {
  try {
    const token = await bearerToken();
    if (!token) return { ok: false, reason: "no-session" };
    const signedAttemptId = normalizedApplePurchaseAttemptId(purchaseAttemptId);
    let current = await readApplePurchaseAttempt(familyId);
    if (!current && signedAttemptId && UUID_PATTERN.test(signedAttemptId)) {
      const active = await fetchActiveApplePurchaseInterlock(token);
      if (active === undefined) return { ok: false, reason: "network-error" };
      if (!active || active.attemptId.toLowerCase() === signedAttemptId) {
        current = {
          attemptId: signedAttemptId,
          familyId,
          productId: active?.productId ?? finishPurchase.productId,
          phase: active ? (localPhaseForServerState(active.state) ?? "store_started") : "store_started",
        };
      }
    }
    if (current?.attemptId.toLowerCase() === signedAttemptId) {
      const confirmPending = {
        ...current,
        phase: "confirm_pending" as const,
        signedTransaction,
        finishPurchase: canonicalStoreKitFinishPurchase(finishPurchase),
      };
      if (!(await persistApplePurchaseAttempt(confirmPending))) {
        return { ok: false, reason: "device-storage-error" };
      }
    }
    const response = await fetch(apiUrl("/api/billing/apple/confirm"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signedTransaction }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      reason?: string;
      planTier?: string;
      purchaseAttemptId?: string | null;
    };
    if (!response.ok || !body.ok) {
      return { ok: false, reason: body.reason ?? "confirm-failed" };
    }
    const confirmedAttemptId = normalizedApplePurchaseAttemptId(
      body.purchaseAttemptId ?? null,
    );
    const afterConfirmation = await readApplePurchaseAttempt(familyId);
    const blockedByDifferentAttempt = afterConfirmation !== null
      && afterConfirmation.attemptId.toLowerCase() !== confirmedAttemptId;
    if (afterConfirmation?.attemptId.toLowerCase() === confirmedAttemptId) {
      const finishPending = {
        ...afterConfirmation,
        phase: "finish_pending" as const,
        signedTransaction,
        finishPurchase: canonicalStoreKitFinishPurchase(finishPurchase),
      };
      if (!(await persistApplePurchaseAttempt(finishPending))) {
        return { ok: false, reason: "device-storage-error" };
      }
    }
    return {
      ok: true,
      planTier: body.planTier ?? "regular",
      purchaseAttemptId: confirmedAttemptId,
      blockedByDifferentAttempt,
    };
  } catch {
    return { ok: false, reason: "network-error" };
  }
}

/** Retry a signed confirmation that survived a crash or lost HTTP response. */
export async function resumeApplePurchaseConfirmation(
  familyId: string,
): Promise<ConfirmApplePurchaseResult | null> {
  const current = await readApplePurchaseAttempt(familyId);
  if (
    current?.phase !== "confirm_pending"
    || !current.signedTransaction
    || !current.finishPurchase
  ) {
    return null;
  }
  return confirmApplePurchase(
    familyId,
    current.signedTransaction,
    current.attemptId,
    current.finishPurchase,
  );
}

export async function pendingApplePurchaseFinish(
  familyId: string,
): Promise<{ attemptId: string; purchase: Purchase } | null> {
  const current = await readApplePurchaseAttempt(familyId);
  if (current?.phase !== "finish_pending" || !current.finishPurchase) return null;
  return { attemptId: current.attemptId, purchase: current.finishPurchase };
}

/** Remove only the exact local journal after StoreKit confirms completion. */
export async function completeApplePurchaseFinish(
  familyId: string,
  attemptId: string,
): Promise<boolean> {
  const current = await readApplePurchaseAttempt(familyId);
  if (current?.attemptId.toLowerCase() !== attemptId.toLowerCase()) return true;
  if (current.phase !== "finish_pending") return false;
  return clearApplePurchaseAttempt(familyId, attemptId);
}
