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

export interface BillingGateState {
  open: boolean;
  lapsed: boolean;
  planTier: string;
  billingProvider: "stripe" | "apple" | "google" | null;
  billingPeriod: "monthly" | "annual" | null;
}

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
      lapsed?: boolean;
      planTier?: string;
      billingProvider?: "stripe" | "apple" | "google" | null;
      billingPeriod?: "monthly" | "annual" | null;
    };
    if (!body.ok) throw new BootstrapFailure("billing", "unknown");
    return {
      open: body.open === true,
      lapsed: body.lapsed === true,
      planTier: body.planTier ?? "regular",
      billingProvider: body.billingProvider ?? null,
      billingPeriod: body.billingPeriod ?? null,
    };
  });
}

export type ConfirmApplePurchaseResult =
  | { ok: true; planTier: string }
  | { ok: false; reason: string };

/** signedTransaction is StoreKit's Transaction.jwsRepresentation,
 *  handed back by expo-iap as purchase.purchaseToken on iOS. The
 *  server re-verifies the signature itself; nothing here is trusted
 *  client-side. */
export async function confirmApplePurchase(
  signedTransaction: string,
): Promise<ConfirmApplePurchaseResult> {
  try {
    const token = await bearerToken();
    if (!token) return { ok: false, reason: "no-session" };
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
    };
    if (!response.ok || !body.ok) {
      return { ok: false, reason: body.reason ?? "confirm-failed" };
    }
    return { ok: true, planTier: body.planTier ?? "regular" };
  } catch {
    return { ok: false, reason: "network-error" };
  }
}
