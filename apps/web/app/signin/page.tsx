import type { Metadata } from "next";

import { Logo } from "../../components/brand/Logo";
import { SignInForm } from "./signin-form";

/**
 * /signin: minimal email/password entry (M1-01 slice, no invite gate yet).
 * Unlinked from the marketing site on purpose; invited-family testing only.
 * ?next=/some/path returns the user there after auth (the onboarding flow
 * uses this so "sign in instead" comes back to the report, not /home).
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
  const safeNext = next?.startsWith("/") ? next : "/home";
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <Logo size={28} />
      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-strong">
        Welcome to Homa
      </h1>
      <p className="mt-2 text-body">Sign in to your family&apos;s space.</p>
      <div className="mt-8">
        <SignInForm next={safeNext} />
      </div>
    </main>
  );
}
