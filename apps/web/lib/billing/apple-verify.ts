import {
  Environment,
  SignedDataVerifier,
  Status,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

/**
 * Verifies Apple's own signatures using Apple's official server library
 * and Apple's public Root CA. This is verification only: no App Store
 * Server API calls, no private key, no founder-only credential
 * required. That is a separate, later capability (the reconciliation
 * cron, #274) needing an App Store Connect API key the founder has not
 * provisioned; do not conflate it with the Sign in with Apple REST key
 * #314 tracks, a different key for a different purpose.
 *
 * Bundle id is fixed: this project has exactly one iOS app.
 */
const BUNDLE_ID = "com.thankshoma.homa";

/**
 * Apple's public root CA (downloaded from
 * https://www.apple.com/certificateauthority/, checked against its
 * published SHA-256 fingerprint, 2026-07-28), embedded directly rather
 * than read from a sibling file. Caught twice in this session before
 * landing here: a process.cwd()-relative path threw ENOENT depending
 * on the caller's working directory, and the fix for that,
 * fileURLToPath(new URL(".", import.meta.url)), builds cleanly under
 * Node's test runner and eve's own bundler but fails Next.js's
 * Turbopack production build ("Module not found: Can't resolve '.'"),
 * which statically analyzes new URL(_, import.meta.url) calls as asset
 * references and cannot resolve a bare directory. A base64 constant
 * has no filesystem dependency at all, so it is identical across every
 * runtime this file loads in: tsx --test, eve build, next build, and
 * the deployed Vercel function.
 */
const APPLE_ROOT_CA_G3_BASE64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9v" +
  "dCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UE" +
  "CgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2" +
  "WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmlj" +
  "YXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqG" +
  "SM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxE" +
  "tX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNC" +
  "MEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0P" +
  "AQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3m" +
  "eoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkL" +
  "F1vLUagM6BgD56KyKA==";

let rootCertificate: Buffer | null = null;
function appleRootCertificates(): Buffer[] {
  rootCertificate ??= Buffer.from(APPLE_ROOT_CA_G3_BASE64, "base64");
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
