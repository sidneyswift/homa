import { createHmac, timingSafeEqual } from "node:crypto";

import { emailHash } from "./hash";

/**
 * The unsubscribe token in a drip email's List-Unsubscribe link (funnel
 * work 2026-07-20). Stateless and signed: the payload is the address hash
 * (never the raw address, so no PII rides the URL), authenticated by an
 * HMAC over that hash. The route verifies the signature, recovers the hash,
 * and suppresses it. No stored token, no database round trip at mint time.
 *
 * Gated on EMAIL_UNSUBSCRIBE_SECRET: with it unset, mint returns null (the
 * email ships without the https List-Unsubscribe link, keeping the mailto
 * unsubscribe as the always-available path) and verify rejects everything.
 * Setting the secret is part of the drip go-live checklist.
 */

function secretFrom(explicit?: string): string | null {
  const secret = explicit ?? process.env.EMAIL_UNSUBSCRIBE_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function sign(hash: string, secret: string): string {
  return createHmac("sha256", secret).update(hash).digest("base64url");
}

/** Token for an address, or null when no secret is configured. */
export function mintUnsubscribeToken(address: string, secret?: string): string | null {
  const key = secretFrom(secret);
  if (!key) return null;
  const hash = emailHash(address);
  return `${hash}.${sign(hash, key)}`;
}

/** The address hash a valid token carries, or null when the secret is
 * unset, the shape is wrong, or the signature does not verify. */
export function verifyUnsubscribeToken(token: string, secret?: string): string | null {
  const key = secretFrom(secret);
  if (!key) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [hash, signature] = parts;
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;

  const expected = Buffer.from(sign(hash, key), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? hash : null;
}
