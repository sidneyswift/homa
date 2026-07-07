import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens for the map flow. Two kinds, both unguessable random values:
 *   - resume token: lives in an httpOnly cookie (and in emailed resume
 *     links); only its sha256 is stored, so a database read never yields
 *     a usable credential.
 *   - report token: the permanent /onboarding/r/[token] URL. Stored as-is because
 *     the URL itself is the shareable artifact (decision D7 lineage:
 *     sharing is the marketing).
 */

export const MAP_RESUME_COOKIE = "homa_map_resume";

export function newToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
