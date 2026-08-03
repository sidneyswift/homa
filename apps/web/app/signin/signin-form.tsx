"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { GoogleGlyph } from "../../components/brand/GoogleGlyph";
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
}: {
  next?: string;
  /** The /join page turns this off: pointing a fresh invitee into the
   * standalone onboarding funnel would route them out of their invite
   * (reader pass 2026-07-11). */
  showOnboardingLink?: boolean;
}) {
  const [state, action, pending] = useActionState(signInAction, INITIAL_STATE);
  const [googlePending, setGooglePending] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

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
      <div className="quiet-frame quiet-frame--paper rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm" data-brand-layer="signin-form">
        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={googlePending}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-6 py-3 text-base font-semibold text-[var(--homa-ink)] transition-colors hover:border-[var(--homa-visual-coral)] disabled:opacity-60"
        >
          <GoogleGlyph />
          {googlePending ? "Redirecting to Google…" : "Continue with Google"}
        </button>
        {oauthError ? (
          <p className="mt-2 text-sm text-[var(--homa-error-ink)]" role="alert">
            {oauthError}
          </p>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--homa-soft-boundary)]" />
          <span className="text-sm text-[var(--homa-muted-ink)]">or</span>
          <span className="h-px flex-1 bg-[var(--homa-soft-boundary)]" />
        </div>

        <form action={action}>
          <input type="hidden" name="next" value={next} />
          <label className="block font-medium text-[var(--homa-ink)]" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] px-4 py-3 text-base text-[var(--homa-ink)] focus:border-[var(--homa-visual-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30"
          />

          <label className="mt-4 block font-medium text-[var(--homa-ink)]" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] px-4 py-3 text-base text-[var(--homa-ink)] focus:border-[var(--homa-visual-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30"
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-[var(--homa-brand-text)] underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>

          {state.error ? (
            <p className="mt-3 text-sm text-[var(--homa-error-ink)]" role="alert">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 min-h-12 w-full rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-6 py-3 text-base font-semibold text-[var(--homa-paper)] shadow-sm transition-colors hover:bg-[var(--homa-ink)] disabled:opacity-60"
          >
            {pending ? "One moment…" : "Sign in"}
          </button>
        </form>
      </div>

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
