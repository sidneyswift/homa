"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { GoogleGlyph } from "../../components/brand/GoogleGlyph";
import { Doodle } from "../../components/marketing/Doodle";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { submitWaitlist } from "../../lib/waitlist-client";
import { ReportPreview } from "./report-preview";

/**
 * S1 (visible): the true entry screen, right after the silent anonymous
 * bootstrap: email and password, or "Sign up with Google" as a one-tap
 * alternative. Founder call 2026-07-08 overturns 2026-07-06's "password
 * is the last question" ruling (which deferred the password to
 * SignupStep, right before the report); that step is retired, this
 * screen creates the real Supabase Auth account directly (see
 * /api/map/claim). Google sign-ups still link the moment she returns
 * from the OAuth redirect (see /api/map/state).
 *
 * Her name deliberately is NOT asked here (founder follow-up 2026-07-08,
 * with screenshot): the create-your-family step right after this
 * collects it, and asking on both screens read as a bug.
 *
 * Real logo files live at public/images/benchmark-logos/ (founder-sourced
 * 2026-07-06). No CDC mark was supplied, so CDC dropped rather than sit as
 * a lone text placeholder next to real images; IES (the Institute of
 * Education Sciences, which runs NCES and NAEP) filled the third slot.
 * The Department of Education seal that arrived alongside these was
 * deliberately NOT wired in: federal seals carry real restrictions
 * against implying endorsement (18 U.S.C. 701), and "benchmarked against"
 * next to an official seal reads closer to "endorsed by" than intended.
 */
/** heightClass: optical sizing, a circular badge needs more height than a
 * wide wordmark to read as the same visual size. */
const BENCHMARK_SOURCES: ReadonlyArray<{
  slug: string;
  name: string;
  src: string;
  width: number;
  height: number;
  heightClass: string;
}> = [
  { slug: "common-core", name: "Common Core", src: "/images/benchmark-logos/common-core.png", width: 382, height: 385, heightClass: "h-12" },
  { slug: "ngss", name: "Next Generation Science Standards", src: "/images/benchmark-logos/ngss.png", width: 512, height: 247, heightClass: "h-10" },
  { slug: "ies", name: "Institute of Education Sciences", src: "/images/benchmark-logos/nces.png", width: 2264, height: 534, heightClass: "h-10" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ParentStep({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Reassurance (not an error) when the lead was captured via the offline queue. */
  const [notice, setNotice] = useState<string | null>(null);
  /** An email that already has a real account never succeeds by retrying
   * here; offer sign-in instead of a doomed "try again". */
  const [existingAccount, setExistingAccount] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setGoogleError(null);
    setGoogleBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // next=/app, not /onboarding: /app already redirects unfinished
      // setups straight back here (see app/app/page.tsx), so a
      // brand-new Google sign-up still resumes the flow, but an existing
      // account with a completed report lands on its dashboard instead
      // of the onboarding hub (founder report 2026-07-09).
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
    if (oauthError) {
      setGoogleBusy(false);
      setGoogleError(oauthError.message);
    }
    // On success the browser is already navigating to Google; no cleanup.
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setError(null);
    setExistingAccount(false);
    setBusy(true);

    try {
      const response = await fetch("/api/map/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
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
      // Dead wifi: capture the lead through the offline waitlist queue so
      // it is never lost, and say so honestly. The account itself can only
      // be created once connection returns; the queue exists so her spot
      // is never simply lost to bad convention-center wifi.
      const outcome = await submitWaitlist({
        email: normalizedEmail,
        kidCount: undefined,
        kidAgeBands: [],
        source: "organic",
        utm: {},
      });
      setNotice(
        outcome === "queued"
          ? "You're offline, so your spot is saved on this device and will send itself when connection returns. Come back to finish once you're back online."
          : "Your spot is saved. Come back once you have a steadier connection to finish.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          {/* The doodles ride inside nowrap spans so each one stays glued to
              its word through every line-wrap. No hand shape exists in the
              doodle set; the heart is the set's "helping hand" mark (same
              use as the landing hero). */}
          <h1 className="text-balance font-display text-[2.1rem] font-bold leading-[1.08] tracking-[-0.015em] text-strong sm:text-[2.45rem]">
            Find out where your child{" "}
            <span className="whitespace-nowrap">
              shines
              <Doodle
                name="sun"
                size={27}
                color="var(--gold-500)"
                style={{ marginLeft: 7, verticalAlign: "-0.06em" }}
              />
            </span>
            , and where they need a{" "}
            <span className="whitespace-nowrap">
              hand
              <Doodle
                name="heart"
                size={25}
                color="var(--pop-blush)"
                rotate={10}
                style={{ marginLeft: 7, verticalAlign: "-0.06em" }}
              />
            </span>
          </h1>
          <p className="mt-4 max-w-[28rem] text-pretty text-body">
            Answer a five-minute questionnaire to get your child&apos;s free progress report.
            Strengths come first. Anything still growing comes with a next step. A free account
            saves the report.
          </p>

          {/* Open form, no card: the report preview is the page's one card,
              so the ask sits directly on the paper (founder call
              2026-07-06: "we don't need a white card, the progress report
              is a card"). */}
          <div className="mt-9 max-w-[28rem] text-left">
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={googleBusy}
              className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-pill border border-border bg-card px-6 py-3 text-[1.0625rem] font-semibold text-strong shadow-[var(--shadow-xs)] transition-colors duration-(--dur-fast) ease-out hover:border-brand disabled:opacity-60"
            >
              <GoogleGlyph />
              {googleBusy ? "Redirecting to Google\u2026" : "Sign up with Google"}
            </button>
            {googleError ? (
              <p className="mt-2 text-sm text-danger" role="alert">
                {googleError}
              </p>
            ) : null}

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border-subtle" />
              <span className="text-sm text-muted">or</span>
              <span className="h-px flex-1 bg-border-subtle" />
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Visible labels removed per design (2026-07-08); each input
                  keeps an accessible name via a sr-only label for screen
                  readers, and the placeholder carries the visible hint.
                  No name field here: FamilyStep asks it, once. */}
              <label className="sr-only" htmlFor="parent-email">
                Where should I send the report?
              </label>
              <input
                id="parent-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="min-h-[54px] w-full rounded-md border-[1.5px] border-border bg-card px-4 py-3.5 text-[1.0625rem] text-strong shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-(--dur-fast) ease-out focus:border-[var(--clay-400)] focus:shadow-[var(--shadow-focus)] focus:outline-none"
              />

              <label className="sr-only" htmlFor="parent-password">
                Create a password
              </label>
              <div className="relative mt-3">
                <input
                  id="parent-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password (at least 8 characters)"
                  className={`min-h-[54px] w-full rounded-md border-[1.5px] bg-card px-4 py-3.5 pr-12 text-[1.0625rem] text-strong shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-(--dur-fast) ease-out focus:border-[var(--clay-400)] focus:shadow-[var(--shadow-focus)] focus:outline-none ${
                    error ? "border-danger" : "border-border"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-[var(--stone-100)] hover:text-body"
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              {error ? (
                <p id="parent-form-error" className="mt-2 text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              {existingAccount ? (
                <p className="mt-2 rounded-md bg-[var(--accent-sage-soft)] p-3 text-sm text-body" role="status">
                  Good news: {email} already has a Homa account.{" "}
                  <a
                    href="/signin?next=/app"
                    className="font-semibold text-brand underline underline-offset-2"
                  >
                    Sign in
                  </a>{" "}
                  and we&apos;ll take you to the right place.
                </p>
              ) : null}
              {notice ? (
                <p className="mt-2 rounded-md bg-[var(--accent-sage-soft)] p-3 text-sm text-body" role="status">
                  {notice}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="group mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-brand px-6 py-3 text-[1.0625rem] font-semibold text-on-brand shadow-sm transition-[background-color,transform,box-shadow] duration-(--dur-fast) ease-out hover:bg-brand-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
              >
                {busy ? "One moment\u2026" : "Get started"}
                {busy ? null : (
                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                    className="transition-transform duration-(--dur-fast) ease-out motion-safe:group-hover:translate-x-0.5"
                  />
                )}
              </button>
            </form>
          </div>

          <div className="mt-10">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
              Checked against national standards and research
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4">
              {/* Plain <img>, not next/image: these are already-optimized static
                  files, and the image optimizer's cache doesn't reliably bust
                  when a public/ file's bytes change on disk under the same
                  path (seen live 2026-07-06: stale opaque-background renders
                  survived a source-file fix until this switch). Small trust
                  badges below the fold, not an LCP concern. */}
              {BENCHMARK_SOURCES.map((source) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={source.slug}
                  src={source.src}
                  alt={source.name}
                  title={source.name}
                  width={source.width}
                  height={source.height}
                  className={`${source.heightClass} w-auto object-contain opacity-80 grayscale transition-[opacity,filter] duration-(--dur-base) ease-out hover:opacity-100 hover:grayscale-0`}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <ReportPreview />
          <p className="mt-4 text-center text-xs text-subtle">
            <a
              href="/onboarding/sample"
              className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
            >
              See a sample report first
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
