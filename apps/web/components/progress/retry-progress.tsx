"use client";

import { useRouter } from "next/navigation";

import { retryProgressPage } from "./retry-progress-action";

export function RetryProgress() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        retryProgressPage({ refresh: () => router.refresh() })
      }
      className="inline-flex min-h-11 items-center rounded-pill bg-[var(--brand-active)] px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-[var(--clay-600)]"
    >
      Retry
    </button>
  );
}
