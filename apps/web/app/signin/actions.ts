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
  const inviteCode = String(formData.get("invite_code") ?? "").trim();
  if (!email || password.length < 8) {
    return { error: "Enter an email and a password of at least 8 characters." };
  }
  if (!inviteCode) {
    return { error: "An invite code is required while Homa is invite-only." };
  }

  const supabase = await createSupabaseServerClient();

  // The founding-family gate is enforced IN the database (migration #7):
  // a trigger on auth.users rejects signups whose metadata lacks the valid
  // code and auto-confirms the account when it matches, so there is no
  // confirmation-email round-trip and no bypass via the raw auth API.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { invite_code: inviteCode } },
  });
  if (error) {
    // The trigger's rejection surfaces from the auth API as a 500 whose
    // message is unusable (supabase-js wraps it as a retryable fetch error
    // with message "{}"). The invite gate is the only insert trigger on
    // auth.users, so a 500 here means the code was wrong; translate it.
    const messageIsGarbage = !error.message || error.message === "{}";
    if (error.status === 500 || messageIsGarbage || /database error/i.test(error.message)) {
      return { error: "That invite code isn't right. Check it and try again." };
    }
    return { error: error.message };
  }

  // The account is confirmed at creation, so password sign-in works
  // immediately and deterministically establishes the session cookie.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return { error: signInError.message };
  }
  redirect("/home");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
