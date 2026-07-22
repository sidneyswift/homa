"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";
import { PageColumn } from "../../components/dashboard/page-column";

/**
 * Catches a render throw anywhere under /app (chat, planner, binder,
 * progress, tasks, kids, settings). error.tsx nests INSIDE its own
 * segment's layout.tsx (Next's component hierarchy), so app/app/layout.tsx
 * keeps the sidebar and top bar mounted here; only the content area falls
 * back to this. Cause: the 2026-07-21 Tasks page throw on an unhandled
 * agent_job run kind had nothing to catch it and left a dead tab.
 */
export default function AppError({
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
    <PageColumn>
      <div className="flex min-h-[50dvh] flex-col items-center justify-center text-center">
        <Logo size={28} variant="mark" />
        <h1 className="mt-5 font-display text-2xl font-bold text-strong">
          Something didn&apos;t load right
        </h1>
        <p className="mt-3 max-w-sm text-body">Nothing you were working on is lost.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="inline-flex min-h-12 items-center rounded-pill px-6 py-3 text-base font-semibold text-body"
            style={{ border: "1px solid var(--border-default)" }}
          >
            Go to chat
          </Link>
        </div>
      </div>
    </PageColumn>
  );
}
