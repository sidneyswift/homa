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

export function SignInForm({ next = "/app" }: { next?: string }) {
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
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={googlePending}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
        >
          <GoogleGlyph />
          {googlePending ? "Redirecting to Google…" : "Continue with Google"}
        </button>
        {oauthError ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {oauthError}
          </p>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border-subtle" />
          <span className="text-sm text-muted">or</span>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>

        <form action={action}>
          <input type="hidden" name="next" value={next} />
          <label className="block font-medium text-strong" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />

          <label className="mt-4 block font-medium text-strong" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />

          {state.error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? "One moment…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-body">
        New to Homa?{" "}
        <Link href="/onboarding" className="font-semibold text-brand underline underline-offset-2">
          Get your child&apos;s free progress report
        </Link>
      </p>
    </div>
  );
}
