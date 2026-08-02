"use client";

import { PASSWORD_MAX_LENGTH, validatePasswordReset } from "@homa/core";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type RecoverySessionState = "checking" | "ready" | "missing";

function validationMessage(result: Exclude<ReturnType<typeof validatePasswordReset>, null>) {
  if (result === "too-short") return "Use at least 8 characters for your password.";
  if (result === "too-long") return "That password is too long.";
  return "Those passwords don't match yet.";
}

function updateErrorMessage(code: string | undefined): string {
  if (code === "same_password") return "Choose a password you haven't used for this account.";
  if (code === "weak_password") {
    return "Try a longer password with a mix of letters, numbers, and symbols.";
  }
  return "Your password wasn't changed. Try updating it again. If the update fails again, send a new reset link.";
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sessionState, setSessionState] = useState<RecoverySessionState>("checking");
  const [pending, setPending] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active) return;
      setSessionState(!userError && data.user ? "ready" : "missing");
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePasswordReset(password, confirmation);
    if (validation) {
      setError(validationMessage(validation));
      return;
    }
    if (sessionState !== "ready") {
      setError("That reset link is no longer active. Send yourself a fresh one.");
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      console.error("password reset failed:", updateError.message);
      setError(updateErrorMessage(updateError.code));
      return;
    }

    setUpdated(true);
  }

  if (sessionState === "checking") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-body shadow-sm" aria-live="polite">
        Checking your reset link…
      </div>
    );
  }

  if (sessionState === "missing") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-body">That reset link has expired or already been used.</p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block font-semibold text-brand underline underline-offset-2"
        >
          Send reset link
        </Link>
      </div>
    );
  }

  if (updated) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm" aria-live="polite">
        <h2 className="font-display text-xl font-semibold text-strong">Password changed</h2>
        <p className="mt-2 text-body">You&apos;re signed in.</p>
        <Link
          href="/app"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand"
        >
          Continue to Homa
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <label className="block font-medium text-strong" htmlFor="new-password">
        New password
      </label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={PASSWORD_MAX_LENGTH}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <label className="mt-4 block font-medium text-strong" htmlFor="confirm-password">
        Confirm new password
      </label>
      <input
        id="confirm-password"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={PASSWORD_MAX_LENGTH}
        required
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Updating password…" : "Update password"}
      </button>
    </form>
  );
}
