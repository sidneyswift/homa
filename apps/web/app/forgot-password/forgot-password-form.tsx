"use client";

import {
  normalizePasswordRecoveryEmail,
  passwordRecoveryRedirectUrl,
} from "@homa/core";
import { useState } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function ForgotPasswordForm({ expired = false }: { expired?: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizePasswordRecoveryEmail(email);
    if (!normalizedEmail) {
      setError("Enter a valid email address.");
      return;
    }

    const redirectTo = passwordRecoveryRedirectUrl(window.location.origin);
    if (!redirectTo) {
      setError("We couldn't send the reset link. Try again in a minute.");
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo },
    );
    setPending(false);

    if (resetError) {
      console.error("password recovery request failed:", resetError.message);
      setError("We couldn't send the reset link. Try again in a minute.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="quiet-frame quiet-frame--paper rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm" data-brand-layer="forgot-password-success" aria-live="polite">
        <h2 className="font-display text-xl font-semibold text-[var(--homa-ink)]">Check your inbox</h2>
        <p className="mt-2 text-[var(--homa-ink)]">
          If that email is connected to Homa, a reset link is on its way. It may take a minute.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="quiet-frame quiet-frame--paper rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm"
      data-brand-layer="forgot-password-form"
    >
      {expired ? (
        <p className="mb-4 text-sm text-[var(--homa-ink)]" role="alert">
          That reset link has expired or already been used. Send yourself a fresh one below.
        </p>
      ) : null}
      <label className="block font-medium text-[var(--homa-ink)]" htmlFor="recovery-email">
        Email
      </label>
      <input
        id="recovery-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] px-4 py-3 text-base text-[var(--homa-ink)] focus:border-[var(--homa-visual-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30"
      />
      {error ? (
        <p className="mt-3 text-sm text-[var(--homa-error-ink)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 min-h-12 w-full rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-6 py-3 text-base font-semibold text-[var(--homa-paper)] shadow-sm transition-colors hover:bg-[var(--homa-ink)] disabled:opacity-60"
      >
        {pending ? "Sending link…" : "Send reset link"}
      </button>
    </form>
  );
}
