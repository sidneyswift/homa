"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

/**
 * Email/password sign-in server actions (minimal M1-01 slice). The
 * sign-up action that used to live here retired on 2026-07-08 (founder
 * call: one onboarding for every door); account creation happens in
 * /onboarding's entry step only. Every row a signed-in caller can touch
 * is scoped by RLS to their own family regardless.
 */

export interface AuthFormState {
  error: string | null;
}

/** Only same-origin paths; anything else falls back to /app. */
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/app";
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("signin failed:", error.message);
    return { error: "That email and password didn't match. You can try again when you're ready." };
  }
  redirect(safeNext(formData));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
