import { createHash } from "node:crypto";

/**
 * Eve's Chat SDK bridge normally uses the Telnyx thread id as its durable
 * continuation token. Adding a hashed access epoch rotates model history
 * whenever this phone moves between unlinked, invited, or family scopes.
 * The adapter strips the suffix before calling Telnyx.
 */

const SMS_SESSION_SUFFIX = ":homa-session:";
const SMS_SESSION_SUFFIX_PATTERN = /:homa-session:[A-Za-z0-9_-]{16}$/u;

export function buildSmsSessionThreadId(
  telnyxThreadId: string,
  accessEpoch: string,
): string {
  const epochHash = createHash("sha256")
    .update(accessEpoch)
    .digest("base64url")
    .slice(0, 16);
  return `${stripSmsSessionEpoch(telnyxThreadId)}${SMS_SESSION_SUFFIX}${epochHash}`;
}

export function stripSmsSessionEpoch(threadId: string): string {
  return threadId.replace(SMS_SESSION_SUFFIX_PATTERN, "");
}
