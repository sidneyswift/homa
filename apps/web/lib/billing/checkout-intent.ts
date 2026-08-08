import { createHmac, timingSafeEqual } from "node:crypto";

import { isPlanTier } from "./wall-types";
import type { BillingPeriod, PlanTier } from "./wall-types";

/** A checkout authorization is intentionally useful for only five minutes. */
export const CHECKOUT_INTENT_MAX_TTL_MS = 5 * 60 * 1_000;

const MIN_SECRET_BYTES = 32;
const SIGNATURE_BYTES = 32;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface CheckoutIntentBinding {
  familyId: string;
  tier: PlanTier;
  billingPeriod: BillingPeriod;
}

export interface VerifiedCheckoutIntent extends CheckoutIntentBinding {
  expiresAtMs: number;
}

interface CheckoutIntentPayload {
  v: 1;
  f: string;
  t: PlanTier;
  p: BillingPeriod;
  i: number;
  e: number;
}

export interface MintCheckoutIntentOptions {
  /** Explicit by design. Production callers must choose the production secret. */
  secret: string;
  nowMs?: number;
  ttlMs?: number;
}

export interface VerifyCheckoutIntentOptions {
  /** Explicit by design. Verification never falls back to process.env. */
  secret: string;
  expected: CheckoutIntentBinding;
  nowMs?: number;
}

function requireSecret(secret: string): Buffer {
  const bytes = Buffer.from(secret, "utf8");
  if (bytes.byteLength < MIN_SECRET_BYTES) {
    throw new Error(`checkout intent secret must be at least ${MIN_SECRET_BYTES} bytes`);
  }
  return bytes;
}

function normalizeFamilyId(value: string): string | null {
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "annual";
}

function normalizeBinding(binding: CheckoutIntentBinding): CheckoutIntentBinding | null {
  const familyId = normalizeFamilyId(binding.familyId);
  if (!familyId || !isPlanTier(binding.tier) || !isBillingPeriod(binding.billingPeriod)) {
    return null;
  }
  return { familyId, tier: binding.tier, billingPeriod: binding.billingPeriod };
}

function hmac(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret).update(payload, "utf8").digest();
}

function decodeSignature(value: string): { bytes: Buffer; canonical: boolean } {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    return { bytes: Buffer.alloc(SIGNATURE_BYTES), canonical: false };
  }
  const bytes = Buffer.from(value, "base64url");
  const canonical =
    bytes.byteLength === SIGNATURE_BYTES && bytes.toString("base64url") === value;
  return {
    bytes: canonical ? bytes : Buffer.alloc(SIGNATURE_BYTES),
    canonical,
  };
}

/**
 * Mint a stateless authorization for exactly one family, tier, and billing
 * period. Email never enters the token. The token is authenticated, not
 * encrypted, so the UUID is the only family identifier it carries.
 */
export function mintCheckoutIntent(
  binding: CheckoutIntentBinding,
  options: MintCheckoutIntentOptions,
): string {
  const secret = requireSecret(options.secret);
  const normalized = normalizeBinding(binding);
  if (!normalized) throw new Error("checkout intent binding is invalid");

  const nowMs = options.nowMs ?? Date.now();
  const ttlMs = options.ttlMs ?? CHECKOUT_INTENT_MAX_TTL_MS;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error("checkout intent nowMs must be a non-negative integer");
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > CHECKOUT_INTENT_MAX_TTL_MS) {
    throw new Error(`checkout intent ttlMs must be between 1 and ${CHECKOUT_INTENT_MAX_TTL_MS}`);
  }

  const payload: CheckoutIntentPayload = {
    v: 1,
    f: normalized.familyId,
    t: normalized.tier,
    p: normalized.billingPeriod,
    i: nowMs,
    e: nowMs + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${hmac(encodedPayload, secret).toString("base64url")}`;
}

function parseAuthenticatedPayload(encodedPayload: string): CheckoutIntentPayload | null {
  if (
    encodedPayload.length === 0 ||
    encodedPayload.length > 512 ||
    !/^[A-Za-z0-9_-]+$/u.test(encodedPayload)
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url");
    if (decoded.toString("base64url") !== encodedPayload) return null;
    const value = JSON.parse(decoded.toString("utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const payload = value as Partial<CheckoutIntentPayload> & Record<string, unknown>;
    const keys = Object.keys(payload).sort();
    if (keys.join(",") !== "e,f,i,p,t,v") return null;
    if (
      payload.v !== 1 ||
      !normalizeFamilyId(payload.f as string) ||
      !isPlanTier(payload.t) ||
      !isBillingPeriod(payload.p) ||
      !Number.isSafeInteger(payload.i) ||
      !Number.isSafeInteger(payload.e)
    ) {
      return null;
    }
    return payload as CheckoutIntentPayload;
  } catch {
    return null;
  }
}

/**
 * Verify both the HMAC and the caller's authenticated purchase boundary.
 * The fixed-size digest comparison is timing-safe even for malformed
 * signatures of the wrong shape.
 */
export function verifyCheckoutIntent(
  token: string,
  options: VerifyCheckoutIntentOptions,
): VerifiedCheckoutIntent | null {
  const secret = requireSecret(options.secret);
  const expected = normalizeBinding(options.expected);
  if (!expected || token.length > 1_024) return null;

  const parts = token.split(".");
  const encodedPayload = parts[0] ?? "";
  const supplied = decodeSignature(parts.length === 2 ? (parts[1] ?? "") : "");
  const signatureMatches = timingSafeEqual(hmac(encodedPayload, secret), supplied.bytes);
  if (!supplied.canonical || !signatureMatches || parts.length !== 2) return null;

  const payload = parseAuthenticatedPayload(encodedPayload);
  if (!payload) return null;
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return null;
  if (
    payload.i > nowMs ||
    payload.e <= nowMs ||
    payload.e <= payload.i ||
    payload.e - payload.i > CHECKOUT_INTENT_MAX_TTL_MS
  ) {
    return null;
  }

  const familyId = normalizeFamilyId(payload.f);
  if (
    familyId !== expected.familyId ||
    payload.t !== expected.tier ||
    payload.p !== expected.billingPeriod
  ) {
    return null;
  }

  return {
    familyId,
    tier: payload.t,
    billingPeriod: payload.p,
    expiresAtMs: payload.e,
  };
}
