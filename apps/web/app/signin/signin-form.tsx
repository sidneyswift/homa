"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { GoogleGlyph } from "../../components/brand/GoogleGlyph";
import { QuietAction, QuietFeedback, QuietField, QuietFrame } from "../../components/design";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { signInAction, type AuthFormState } from "./actions";

/**
 * Sign-in only (founder call 2026-07-08: one onboarding for every door).
 * The create-account tab that used to live here is gone; new families
 * start at /onboarding, the single signup + setup flow, and the quiet
 * link below the card points them there.
 */

const INITIAL_STATE: AuthFormState = { error: null };

export function SignInForm({
  next = "/app",
  showOnboardingLink = true,
  callbackError = null,
}: {
  next?: string;
  /** The /join page turns this off: pointing a fresh invitee into the
   * standalone onboarding funnel would route them out of their invite
   * (reader pass 2026-07-11). */
  showOnboardingLink?: boolean;
  /** A safe, server-mapped provider failure from /auth/callback. */
  callbackError?: string | null;
}) {
  const [state, action, pending] = useActionState(signInAction, INITIAL_STATE);
  const [googlePending, setGooglePending] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(callbackError);

  async function continueWithGoogle() {
    setOauthError(null);
    setGooglePending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setGooglePending(false);
      setOauthError(error.message);
    }
    // On success the browser is already navigating to Google; no cleanup.
  }

  return (
    <div>
      <QuietFrame as="article" className="p-6" data-brand-layer="signin-form">
        <QuietAction
          kind="secondary"
          size="large"
          type="button"
          onClick={() => void continueWithGoogle()}
          disabled={googlePending}
          className="w-full"
          icon={<GoogleGlyph />}
        >
          {googlePending ? "Redirecting to Google…" : "Continue with Google"}
        </QuietAction>
        {oauthError ? (
          <QuietFeedback tone="error" className="mt-3">
            {oauthError}
          </QuietFeedback>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--homa-soft-boundary)]" />
          <span className="text-sm text-[var(--homa-muted-ink)]">or</span>
          <span className="h-px flex-1 bg-[var(--homa-soft-boundary)]" />
        </div>

        <form action={action}>
          <input type="hidden" name="next" value={next} />
          <QuietField id="auth-email" label="Email" required>
            <input name="email" type="email" autoComplete="email" />
          </QuietField>

          <QuietField id="auth-password" label="Password" required className="mt-4">
            <input name="password" type="password" autoComplete="current-password" />
          </QuietField>
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-[var(--homa-brand-text)] underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>

          {state.error ? (
            <QuietFeedback tone="error" className="mt-3">
              {state.error}
            </QuietFeedback>
          ) : null}

          <QuietAction
            type="submit"
            disabled={pending}
            size="large"
            className="mt-6 w-full"
          >
            {pending ? "One moment…" : "Sign in"}
          </QuietAction>
        </form>
      </QuietFrame>

      {showOnboardingLink ? (
        <p className="mt-4 text-center text-sm text-[var(--homa-ink)]">
          New to Homa?{" "}
          <Link href="/onboarding" className="font-semibold text-[var(--homa-brand-text)] underline underline-offset-2">
            Start your free trial
          </Link>
        </p>
      ) : null}
    </div>
  );
}
