"use client";

import { PASSWORD_MAX_LENGTH, validatePasswordReset } from "@homa/core";
import { useEffect, useState } from "react";

import { QuietAction, QuietFeedback, QuietField, QuietFrame } from "../../components/design";
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
      <QuietFrame as="article" className="p-6" data-brand-layer="reset-password-checking">
        <QuietFeedback tone="info" busy title="Checking your reset link">
          We&apos;re making sure this link is still active.
        </QuietFeedback>
      </QuietFrame>
    );
  }

  if (sessionState === "missing") {
    return (
      <QuietFrame as="article" className="p-6" data-brand-layer="reset-password-missing">
        <QuietFeedback tone="error" title="This reset link is no longer active">
          That reset link has expired or already been used.
        </QuietFeedback>
        <QuietAction kind="quiet" href="/forgot-password" className="mt-4">
          Send reset link
        </QuietAction>
      </QuietFrame>
    );
  }

  if (updated) {
    return (
      <QuietFrame as="article" className="p-6" data-brand-layer="reset-password-success">
        <QuietFeedback tone="constructive" title="Password changed">
          You&apos;re signed in.
        </QuietFeedback>
        <QuietAction href="/app" size="large" className="mt-5 w-full">
          Continue to Homa
        </QuietAction>
      </QuietFrame>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="quiet-frame quiet-frame--paper p-6"
      data-brand-layer="reset-password-form"
    >
      <QuietField id="new-password" label="New password" hint="Use at least 8 characters." required>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </QuietField>
      <QuietField id="confirm-password" label="Confirm new password" required className="mt-4">
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={PASSWORD_MAX_LENGTH}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
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
        {pending ? "Updating password…" : "Update password"}
      </QuietAction>
    </form>
  );
}
