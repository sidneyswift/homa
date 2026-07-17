/**
 * Canonicalizes one RFC Message-ID for exact provider-native reply matching.
 * Resend's API id is intentionally rejected because it has no `@` separator.
 */
export function normalizeRfcMessageId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const inner =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  if (
    inner.length === 0 ||
    !inner.includes("@") ||
    /[\s<>]/u.test(inner)
  ) {
    return null;
  }
  return `<${inner}>`;
}
