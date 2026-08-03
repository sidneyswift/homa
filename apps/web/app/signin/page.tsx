import type { Metadata } from "next";

import { Logo } from "../../components/brand/Logo";
import { QuietFrame } from "../../components/design/QuietFrame";
import { SignInForm } from "./signin-form";

/**
 * /signin: minimal email/password entry (M1-01 slice, no invite gate yet).
 * Unlinked from the marketing site on purpose; invited-family testing only.
 * ?next=/some/path returns the user there after auth. The onboarding
 * flow's "already have an account, sign in" link passes next=/app on
 * purpose, not /onboarding (founder report 2026-07-09: an existing
 * account with a completed report was landing back on the onboarding
 * hub instead of its dashboard): /app already redirects unfinished
 * setups straight back to /onboarding itself, so this is the one place
 * that decides, for every sign-in path, whether "home" means the
 * dashboard or a return trip to finish setup.
 */

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/app";
  return (
    <main className="quiet-auth-shell quiet-account-surface" data-brand-surface="signin">
      <QuietFrame className="quiet-auth-card" as="article">
        <Logo size={28} />
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-[var(--homa-ink)]">
          Welcome to Homa
        </h1>
        <p className="mt-2 text-[var(--homa-ink)]">Sign in to your family&apos;s space.</p>
        <div className="mt-8">
          <SignInForm next={safeNext} />
        </div>
      </QuietFrame>
    </main>
  );
}
