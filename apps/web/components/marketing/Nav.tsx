import Link from "next/link";

import { Logo } from "../brand/Logo";

/**
 * Marketing site nav (BUILD.md Deliverable 0). Deliberately minimal: no
 * "sign in" or pricing links, since neither exists yet, just the brand mark
 * and a path to the one thing this page does, join the waitlist.
 */
export function Nav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center gap-8 border-b border-border-subtle bg-page/85 px-6 py-4 backdrop-blur-sm sm:px-10">
      <Link href="/" aria-label="Homa" className="flex items-center">
        <Logo size={26} />
      </Link>
      <Link
        href="/#how-it-works"
        className="hidden text-sm font-medium text-muted transition-colors duration-(--dur-fast) ease-out hover:text-body sm:inline"
      >
        How it works
      </Link>
      <Link
        href="/#waitlist"
        className="ml-auto whitespace-nowrap rounded-pill bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] sm:px-5"
      >
        <span className="sm:hidden">Join waitlist</span>
        <span className="hidden sm:inline">Join the waitlist</span>
      </Link>
    </nav>
  );
}
