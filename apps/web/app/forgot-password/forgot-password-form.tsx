"use client";

import {
  normalizePasswordRecoveryEmail,
  passwordRecoveryRedirectUrl,
} from "@homa/core";
import { useState } from "react";

import { QuietAction, QuietFeedback, QuietField, QuietFrame } from "../../components/design";
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
      <QuietFrame as="article" className="p-6" data-brand-layer="forgot-password-success">
        <QuietFeedback tone="constructive" title="Check your inbox">
          If that email is connected to Homa, a reset link is on its way. It may take a minute.
        </QuietFeedback>
      </QuietFrame>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="quiet-frame quiet-frame--paper p-6"
      data-brand-layer="forgot-password-form"
    >
      {expired ? (
        <QuietFeedback tone="highlight" title="That link has expired" className="mb-4">
          That reset link has expired or already been used. Send yourself a fresh one below.
        </QuietFeedback>
      ) : null}
      <QuietField id="recovery-email" label="Email" required>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </QuietField>
      {error ? (
        <QuietFeedback tone="error" className="mt-3">
          {error}
        </QuietFeedback>
      ) : null}
      <QuietAction
        type="submit"
        disabled={pending}
        size="large"
        className="mt-6 w-full"
      >
        {pending ? "Sending link…" : "Send reset link"}
      </QuietAction>
    </form>
  );
}
