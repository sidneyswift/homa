"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Logo } from "../components/brand/Logo";

/**
 * Catches a render throw on any marketing/onboarding/admin page (the root
 * segment). app/app/error.tsx is the more specific boundary for the signed-in
 * shell and wins there; this one is the fallback everywhere else so a crash
 * never leaves a blank, unrecoverable tab (see AGENTS.md, prod-bugs-fixed-not-stored).
 */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-24 text-center">
      <Logo size={28} variant="mark" />
      <h1 className="mt-6 font-display text-2xl font-bold text-strong">
        Something didn&apos;t load right
      </h1>
      <p className="mt-3 text-body">Nothing you were working on is lost.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-pill px-6 py-3 text-base font-semibold text-body"
          style={{ border: "1px solid var(--border-default)" }}
        >
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
