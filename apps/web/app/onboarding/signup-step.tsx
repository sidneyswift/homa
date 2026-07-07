"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { GoogleGlyph } from "../../components/brand/GoogleGlyph";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import type { FlowChild } from "./flow-types";

/**
 * Password: the last question, right before the report (founder call
 * 2026-07-06, second revision: "have them create a password as the LAST
 * question before they get results"). Her email was already captured up
 * front (ParentStep); this is where the anonymous lead becomes a real
 * account, created here rather than at S1 so the highest-friction ask
 * lands after five minutes of investment, not before it. Runs right
 * before scoring for a child who finished the checklist, or, for a
 * family whose only kids are outside the scored age range, before the
 * hub, so "I'll email you when it's ready" stays an honest promise.
 *
 * UX review 2026-07-06 (approved in full): Google is re-offered here,
 * not just at S1, one tap beats typing a name and password at the exact
 * moment friction costs the most (the OAuth redirect lands back at
 * /onboarding, /api/map/state links the account, and the flow resumes at
 * scoring). The server's failure reasons surface honestly: an email that
 * already has an account gets a sign-in path, never a doomed "try again".
 */
export function SignupStep({
  child,
  email,
  onDone,
}: {
  /** For personalized copy; null only in the rare all-pending-band case. */
  child: FlowChild | null;
  /** Already known (captured at S1); shown for reassurance, not re-asked. */
  email: string | null;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const heading = child?.inRange
    ? `Create your account to see ${child.name}'s report`
    : child
      ? `Create your account, and I'll email you the moment ${child.name}'s questionnaire is ready`
      : "Create your free account";

  async function continueWithGoogle() {
    setError(null);
    setGoogleBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    if (oauthError) {
      setGoogleBusy(false);
      setError(oauthError.message);
    }
    // On success the browser is already navigating to Google; no cleanup.
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setError("Add your name to finish.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    const [firstName, ...rest] = normalizedName.split(" ");
    const lastName = rest.join(" ") || undefined;
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/map/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, password }),
      });
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (!data.ok) {
        if (data.reason === "exists") {
          setExistingAccount(true);
          setBusy(false);
          return;
        }
        setError("That didn't go through. One more try usually does it.");
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError("Couldn't reach us just now. Nothing you typed is lost, try again.");
      setBusy(false);
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-balance font-display text-[1.9rem] font-bold leading-[1.1] tracking-[-0.015em] text-strong sm:text-[2.2rem]">
        {heading}
      </h1>
      {email ? <p className="mt-2 text-body">For {email}</p> : null}

      <div className="mt-8 rounded-lg border border-border-subtle bg-card p-6 text-left shadow-lg sm:p-8">
        <button
          type="button"
          onClick={() => void continueWithGoogle()}
          disabled={googleBusy || busy}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition-colors duration-(--dur-fast) ease-out hover:border-brand disabled:opacity-60"
        >
          <GoogleGlyph />
          {googleBusy ? "Redirecting to Google\u2026" : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border-subtle" />
          <span className="text-sm text-muted">or set a password</span>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="block text-sm font-medium text-strong" htmlFor="signup-name">
            Your name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sarah Chen"
            className="mt-2 min-h-[54px] w-full rounded-md border-[1.5px] border-border px-4 py-3.5 text-[1.0625rem] text-strong transition-[border-color,box-shadow] duration-(--dur-fast) ease-out focus:border-[var(--clay-400)] focus:shadow-[var(--shadow-focus)] focus:outline-none"
          />

          <div className="mt-4 flex items-baseline justify-between">
            <label className="block text-sm font-medium text-strong" htmlFor="signup-password">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="text-sm text-subtle underline-offset-2 hover:underline"
              aria-pressed={showPassword}
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            aria-invalid={error !== null}
            aria-describedby={error ? "signup-form-error" : undefined}
            className={`mt-2 min-h-[54px] w-full rounded-md border-[1.5px] px-4 py-3.5 text-[1.0625rem] text-strong transition-[border-color,box-shadow] duration-(--dur-fast) ease-out focus:border-[var(--clay-400)] focus:shadow-[var(--shadow-focus)] focus:outline-none ${
              error ? "border-danger" : "border-border"
            }`}
          />
          {error ? (
            <p id="signup-form-error" className="mt-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {existingAccount ? (
            <p
              className="mt-2 rounded-md bg-[var(--accent-sage-soft)] p-3 text-sm text-body"
              role="status"
            >
              Good news: {email ?? "this email"} already has a Homa account.{" "}
              <a
                href="/signin?next=/onboarding"
                className="font-semibold text-brand underline underline-offset-2"
              >
                Sign in
              </a>{" "}
              and you&apos;ll come right back here.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || googleBusy}
            className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-brand px-6 py-3 text-[1.0625rem] font-semibold text-on-brand shadow-sm transition-[background-color,transform,box-shadow] duration-(--dur-fast) ease-out hover:bg-brand-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
          >
            {busy ? "Saving\u2026" : "Create my account"}
            {busy ? null : <ArrowRight size={18} aria-hidden="true" />}
          </button>
          <p className="mt-4 text-center text-sm text-muted">
            Just the report, and later, your invite. Delete anytime.
          </p>
        </form>
      </div>
    </div>
  );
}
