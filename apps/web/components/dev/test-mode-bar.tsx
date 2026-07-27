import Link from "next/link";

/**
 * The test-mode bar: a strip across the top of every page while
 * HOMA_DEV_TEST_SESSIONS is on.
 *
 * It exists because there was no way to tell. A dev server running the
 * harness looks exactly like the real product, so landing on the sign-in
 * page and wondering "is this test mode?" is the obvious question and
 * the app had no answer. Worse, the two things you actually want from
 * that screen (start a test session, start over) were URLs you had to
 * remember.
 *
 * Deliberately loud. Stone-900 rather than a brand color, because this
 * is not part of the product and should never be mistaken for it, and
 * it is the one surface where being slightly ugly is the point.
 *
 * Renders nothing in production and nothing without the flag, so it
 * cannot leak: the caller checks, and this checks again.
 */

export function devTestSessionsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = (process.env.HOMA_DEV_TEST_SESSIONS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export function TestModeBar() {
  if (!devTestSessionsEnabled()) return null;
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[var(--stone-900)] px-4 py-1.5 text-center text-xs text-[var(--stone-50)] print:hidden">
      <span className="font-mono font-bold uppercase tracking-[0.13em]">
        Test mode
      </span>
      <span className="text-[var(--stone-300)]">
        Real database, test families only.
      </span>
      <Link
        href="/api/dev/test-session"
        prefetch={false}
        className="font-semibold underline underline-offset-2 hover:text-white"
      >
        New test account
      </Link>
      <Link
        href="/dev/reset"
        prefetch={false}
        className="font-semibold underline underline-offset-2 hover:text-white"
      >
        Start over
      </Link>
    </div>
  );
}
