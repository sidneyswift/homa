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
  redirect("/home");
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

  // Founding-family gate (placeholder for MJ-09's real invite codes): one
  // shared code from the environment. When unset (local dev), signup is open.
  const requiredCode = process.env.HOMA_SIGNUP_CODE;
  if (requiredCode) {
    const suppliedCode = String(formData.get("invite_code") ?? "").trim();
    if (suppliedCode !== requiredCode) {
      return { error: "That invite code isn't right. Check it and try again." };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }
  // Email confirmation may be required depending on project settings; when it
  // is disabled (dev), signUp returns a live session and /home works now.
  redirect("/home");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
