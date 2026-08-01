/**
 * Classifying provider delivery errors for the founder console.
 *
 * A send blocked because the parent texted STOP is a customer choice,
 * not a failure (founder ask 2026-07-23): those rows leave the alert
 * strip and land in the quiet "Stopped texting" list instead. Telnyx
 * reports the block as error code 40300, seen live in two shapes:
 * "Telnyx rejected the send: 40300 Blocked due to STOP message" and
 * "Failed to send message: Blocked due to STOP message ... 40300". Homa's
 * own preflight store reports the same durable state as "inbound-stop".
 *
 * This is deterministic on purpose: it reads a machine-written error
 * code, not human language, so the models-judge/code-verifies law does
 * not apply here.
 */

/** SQL ilike patterns that mark a delivery error as a STOP block. */
export const STOP_ERROR_PATTERNS = [
  "%40300%",
  "%stop message%",
  "%inbound-stop%",
] as const;

/** JS twin of the SQL patterns, for tests and display-side checks. */
export function isStopBlockedError(error: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("40300") ||
    lower.includes("stop message") ||
    lower.includes("inbound-stop")
  );
}
