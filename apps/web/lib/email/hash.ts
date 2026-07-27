import { createHash } from "node:crypto";

/**
 * The one address-hashing definition Homa's email code shares: sha256 of the
 * lowercased, trimmed address, hex. It is the email_sends.to_hash value, the
 * email_suppressions key, and the unsubscribe token's payload, so all three
 * must agree byte-for-byte. Keep this the only place the hash is computed.
 */
export function emailHash(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("hex");
}
