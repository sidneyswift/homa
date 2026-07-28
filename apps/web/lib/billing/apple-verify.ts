import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Environment,
  SignedDataVerifier,
  Status,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

/**
 * Verifies Apple's own signatures using Apple's official server library
 * and Apple's public Root CA (apple-certs/AppleRootCA-G3.cer, downloaded
 * from https://www.apple.com/certificateauthority/ and checked against
 * its published SHA-256 fingerprint, 2026-07-28). This is verification
 * only: no App Store Server API calls, no private key, no founder-only
 * credential required. That is a separate, later capability (the
 * reconciliation cron, #274) needing an App Store Connect API key the
 * founder has not provisioned; do not conflate it with the Sign in with
 * Apple REST key #314 tracks, a different key for a different purpose.
 *
 * Bundle id is fixed: this project has exactly one iOS app.
 */
const BUNDLE_ID = "com.thankshoma.homa";

// Resolved relative to this source file, never process.cwd(): the caller's
// working directory varies (apps/web for Next.js and eas builds, the
// monorepo root for `pnpm check:billing` from the top level), and a
// cwd-relative path silently resolves to the wrong place and throws
// ENOENT under at least one of those callers. Caught exactly that way in
// this session: `pnpm check:billing` from repo root passed anyway,
// because the test's assert.rejects() did not check WHICH error it
// threw; the transaction was "rejected" for the wrong reason.
const CERT_PATH = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "apple-certs/AppleRootCA-G3.cer",
);

let rootCertificate: Buffer | null = null;
function appleRootCertificates(): Buffer[] {
  rootCertificate ??= readFileSync(CERT_PATH);
  return [rootCertificate];
}

let productionVerifier: SignedDataVerifier | null = null;
let sandboxVerifier: SignedDataVerifier | null = null;

function getVerifier(environment: Environment): SignedDataVerifier {
  if (environment === Environment.PRODUCTION) {
    productionVerifier ??= new SignedDataVerifier(
      appleRootCertificates(),
      true,
      Environment.PRODUCTION,
      BUNDLE_ID,
    );
    return productionVerifier;
  }
  sandboxVerifier ??= new SignedDataVerifier(
    appleRootCertificates(),
    true,
    Environment.SANDBOX,
    BUNDLE_ID,
  );
  return sandboxVerifier;
}

/**
 * Tries production first, falls back to sandbox. Apple sends both real
 * purchases and TestFlight/sandbox test notifications to the SAME
 * webhook URL, and StoreKit test transactions on a device signed into a
 * sandbox Apple Account are also sandbox-environment; there is no
 * separate sandbox endpoint to configure. The library throws on an
 * environment mismatch between the signed payload and the verifier it
 * was checked against, which is exactly the signal used to pick the
 * other verifier rather than reject a legitimate sandbox transaction as
 * invalid during testing.
 */
export async function verifyAppleTransaction(
  signedTransactionInfo: string,
): Promise<JWSTransactionDecodedPayload> {
  try {
    return await getVerifier(Environment.PRODUCTION).verifyAndDecodeTransaction(
      signedTransactionInfo,
    );
  } catch {
    return await getVerifier(Environment.SANDBOX).verifyAndDecodeTransaction(
      signedTransactionInfo,
    );
  }
}

export async function verifyAppleNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  try {
    return await getVerifier(Environment.PRODUCTION).verifyAndDecodeNotification(
      signedPayload,
    );
  } catch {
    return await getVerifier(Environment.SANDBOX).verifyAndDecodeNotification(
      signedPayload,
    );
  }
}

/**
 * Normalizes Apple's numeric subscription Status into the same four
 * strings LAPSED_SUBSCRIPTION_STATUSES already uses (wall.ts), so
 * accountAccessDecision's providerState() never needs an Apple-specific
 * vocabulary. Billing retry and grace period stay "active" on purpose,
 * the same posture Stripe's past_due already has here: dunning is the
 * platform's job, not a lockout.
 */
export function appleStatusToSharedVocabulary(status: Status | number): string {
  switch (status) {
    case Status.EXPIRED:
    case Status.REVOKED:
      return "canceled";
    case Status.ACTIVE:
    case Status.BILLING_RETRY:
    case Status.BILLING_GRACE_PERIOD:
    default:
      return "active";
  }
}
