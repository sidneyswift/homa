import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../components/brand/Logo";

/**
 * Branded 404. Serves a real 404 status (soft-404 hygiene for crawlers) and
 * offers the two paths that matter: the front door and the progress report.
 * Voice: reassure before inform, offers never commands.
 */

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-20">
      <Logo size={26} />
      <h1 className="mt-8 font-display text-2xl font-bold text-strong">
        No worries, this page just isn&apos;t here.
      </h1>
      <p className="mt-3 text-body">
        The link may be old, or the address has a small typo. Everything that is
        here starts at the front door.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
        >
          Go to the homepage
        </Link>
        <Link
          href="/onboarding"
          className="inline-flex min-h-12 items-center rounded-pill px-6 py-3 text-base font-semibold text-body"
          style={{ border: "1px solid var(--border-default)" }}
        >
          See where your child stands
        </Link>
      </div>
    </main>
  );
}
