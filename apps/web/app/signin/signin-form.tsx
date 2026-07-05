"use client";

import { useActionState, useState } from "react";

import { signInAction, signUpAction, type AuthFormState } from "./actions";

const INITIAL_STATE: AuthFormState = { error: null };

export function SignInForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signIn, signInPending] = useActionState(signInAction, INITIAL_STATE);
  const [signUpState, signUp, signUpPending] = useActionState(signUpAction, INITIAL_STATE);

  const active = mode === "signin"
    ? { action: signIn, pending: signInPending, error: signInState.error }
    : { action: signUp, pending: signUpPending, error: signUpState.error };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("signin")}
          aria-pressed={mode === "signin"}
          className={`min-h-10 rounded-pill border px-4 py-2 text-sm transition-colors ${
            mode === "signin"
              ? "border-brand bg-brand text-on-brand"
              : "border-border bg-card text-strong hover:border-brand"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          aria-pressed={mode === "signup"}
          className={`min-h-10 rounded-pill border px-4 py-2 text-sm transition-colors ${
            mode === "signup"
              ? "border-brand bg-brand text-on-brand"
              : "border-border bg-card text-strong hover:border-brand"
          }`}
        >
          Create account
        </button>
      </div>

      <form action={active.action} className="mt-6">
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
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />

        {active.error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {active.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={active.pending}
          className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {active.pending
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
