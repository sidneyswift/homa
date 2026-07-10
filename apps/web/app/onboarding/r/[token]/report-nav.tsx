import Link from "next/link";

import { Logo } from "../../../../components/brand/Logo";

/**
 * The token report page's nav bar (founder ask 2026-07-08: the report
 * had no way back into the product). Slim, sticky, print-hidden. Both
 * links land on session-gated pages (/app and /app/settings), so a
 * shared-link viewer who taps them simply reaches sign-in, never someone
 * else's family.
 */
export function ReportNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-page/95 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/app" aria-label="Open Homa" className="inline-flex rounded-md">
          <Logo size={22} />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/app"
            className="inline-flex min-h-9 items-center rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-semibold text-strong transition-colors duration-(--dur-fast) ease-out hover:border-brand"
          >
            Open Homa
          </Link>
          <Link
            href="/app/settings"
            className="inline-flex min-h-9 items-center rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-semibold text-strong transition-colors duration-(--dur-fast) ease-out hover:border-brand"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
