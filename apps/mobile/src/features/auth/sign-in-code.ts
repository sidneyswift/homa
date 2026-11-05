import { supabase } from "../../lib/supabase";

/**
 * Default email sign-in by six digit code: send a code, check a code.
 * The email screen also offers optional existing-password sign-in.
 *
 * shouldCreateUser stays at its default of true, and that is the point.
 * It is what lets one screen serve a parent who has never opened Homa
 * and one coming back, without either of them choosing a mode. The Apple
 * and Google doors have always behaved this way; this makes email match.
 *
 * Dependencies that live in the Supabase dashboard, not here. The email
 * template must render {{ .Token }} or Supabase sends a magic link
 * instead and no code ever arrives, and OTP length must be 6. Both are
 * founder actions recorded 2026-08-18. Code that "handles" a missing
 * token would only hide the misconfiguration.
 */

export type SendCodeResult =
  | { status: "sent" }
  | { status: "invalid-email" }
  | { status: "rate-limited"; reason: string }
  | { status: "failed"; reason: string };

export type CheckCodeResult =
  | { status: "signed-in" }
  | { status: "wrong-code" }
  | { status: "expired" }
  | { status: "failed"; reason: string };

/** Deliberately permissive. The mail server is the real validator; this
 *  only catches the obvious typo before a parent waits on an email that
 *  was never going to arrive. */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function sendEmailCode(rawEmail: string): Promise<SendCodeResult> {
  const email = normalizeEmail(rawEmail);
  if (!looksLikeEmail(email)) return { status: "invalid-email" };

  const { error } = await supabase.auth.signInWithOtp({ email });
  if (!error) return { status: "sent" };

  // Supabase reports its email throttle as 429. Worth separating because
  // the parent's next move differs: waiting works, retrying does not.
  if (error.status === 429) {
    return { status: "rate-limited", reason: error.message };
  }
  return { status: "failed", reason: error.message };
}

export async function checkEmailCode(
  rawEmail: string,
  code: string,
): Promise<CheckCodeResult> {
  const email = normalizeEmail(rawEmail);
  const token = code.trim();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (!error) return { status: "signed-in" };

  // Supabase returns one 403 for both a wrong code and an expired one,
  // separated only by the message. The parent's next move is different
  // for each, so the two are told apart here rather than in the screen.
  const message = error.message.toLowerCase();
  if (message.includes("expired")) return { status: "expired" };
  if (message.includes("invalid") || message.includes("token")) {
    return { status: "wrong-code" };
  }
  return { status: "failed", reason: error.message };
}
