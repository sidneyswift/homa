import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

const recoveryEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export type PasswordResetValidation =
  | "too-short"
  | "too-long"
  | "mismatch"
  | null;

export function normalizePasswordRecoveryEmail(value: string): string | null {
  const parsed = recoveryEmailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function passwordRecoveryRedirectUrl(origin: string): string | null {
  try {
    const base = new URL(origin);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    return new URL("/reset-password/confirm", base.origin).toString();
  } catch {
    return null;
  }
}

export function parsePasswordRecoveryConfirmation(
  tokenHash: string | null,
  type: string | null,
): { tokenHash: string } | null {
  const normalizedTokenHash = tokenHash?.trim();
  if (type !== "recovery" || !normalizedTokenHash) return null;
  return { tokenHash: normalizedTokenHash };
}

export function validatePasswordReset(
  password: string,
  confirmation: string,
): PasswordResetValidation {
  if (password.length < PASSWORD_MIN_LENGTH) return "too-short";
  if (password.length > PASSWORD_MAX_LENGTH) return "too-long";
  if (password !== confirmation) return "mismatch";
  return null;
}
