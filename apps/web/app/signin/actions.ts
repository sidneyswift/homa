"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

/**
 * Email/password sign-in and sign-up server actions (minimal M1-01 slice).
 * No invite codes yet: MJ-09 adds the gate; until then this surface is only
 * reachable by people who know the URL, and every row they can touch is
 * scoped by RLS to their own family regardless.
 */

export interface AuthFormState {
  error: string | null;
}

/** Only same-origin paths; anything else falls back to /home. */
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") ? next : "/home";
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
    return { error: error.message };
  }
  redirect(safeNext(formData));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    return { error: "Enter an email and a password of at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();

  // Open signup: accounts are auto-confirmed at creation by a DB trigger
  // (migration #8), so there is no email round-trip.
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  // Sign in right after so the session cookie is set deterministically even
  // if the project's email-confirmation setting is still on.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return { error: signInError.message };
  }
  redirect(safeNext(formData));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
