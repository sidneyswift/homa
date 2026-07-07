/**
 * US phone normalization for the family texting line (build-log
 * 2026-07-07). One number per family, cohort one is US-only, so the
 * canonical stored shape is +1 followed by exactly ten digits.
 */

/**
 * normalizeUsPhoneE164(raw: string): string | null
 * Accepts human-typed US numbers ("954-990-3497", "(954) 990 3497",
 * "+1 954 990 3497", "19549903497") and returns "+19549903497".
 * Returns null for anything that is not a ten-digit US number, including
 * other countries: the texting line only serves US numbers for now.
 */
export function normalizeUsPhoneE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const digits = trimmed.replace(/\D/gu, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Display form for a stored +1XXXXXXXXXX value: "(954) 990-3497". */
export function formatUsPhone(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/u.exec(e164);
  if (!match) return e164;
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}
