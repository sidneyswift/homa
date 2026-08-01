import { createHash } from "node:crypto";

/**
 * Eve's Chat SDK bridge normally uses the Telnyx thread id as its durable
 * continuation token. Adding a hashed access epoch rotates model history
 * whenever this phone moves between unlinked, invited, or family scopes.
 * The adapter strips the suffix before calling Telnyx.
 */

const SMS_SESSION_SUFFIX = ":homa-session:";
const SMS_SESSION_SUFFIX_PATTERN = /:homa-session:[A-Za-z0-9_-]{16}$/u;
// A deliberate migration boundary: existing Eve SMS sessions may already be
// irrecoverable after a token-limit fault, so the deployed daily-session
// format must not resume them.
const SMS_SESSION_KEY_VERSION = "daily-v1";

export function buildSmsSessionThreadId(
  telnyxThreadId: string,
  accessEpoch: string,
  sessionDay?: string,
): string {
  const epochHash = createHash("sha256")
    .update(`${SMS_SESSION_KEY_VERSION}:${accessEpoch}:${sessionDay ?? ""}`)
    .digest("base64url")
    .slice(0, 16);
  return `${stripSmsSessionEpoch(telnyxThreadId)}${SMS_SESSION_SUFFIX}${epochHash}`;
}

/**
 * The model-side SMS session rolls over at 4am in the family's time zone,
 * matching web chat. The transport thread stays the same, while the hashed
 * day becomes a fresh Eve continuation key before a long-running thread can
 * hit Eve's unrecoverable per-session token ceiling.
 */
export function smsSessionDayKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  if (Number(value("hour")) >= 4) return date;

  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function stripSmsSessionEpoch(threadId: string): string {
  return threadId.replace(SMS_SESSION_SUFFIX_PATTERN, "");
}
