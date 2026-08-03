import { parsePasswordRecoveryConfirmation } from "@homa/core";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../../components/brand/Logo";

export const metadata: Metadata = {
  title: "Confirm password reset",
  referrer: "no-referrer",
  robots: { index: false },
};

export default async function ConfirmPasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  const confirmation = parsePasswordRecoveryConfirmation(
    params.token_hash ?? null,
    params.type ?? null,
  );

  return (
    <main className="quiet-auth-shell quiet-account-surface" data-brand-surface="reset-password-confirm">
      <Logo size={28} />
      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-[var(--homa-ink)]">
        Reset your password
      </h1>
      {confirmation ? (
        <form
          action="/auth/confirm"
          method="post"
          className="mt-8 rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm"
        >
          <input type="hidden" name="token_hash" value={confirmation.tokenHash} />
          <input type="hidden" name="type" value="recovery" />
          <p className="text-[var(--homa-ink)]">Your reset link is ready.</p>
          <button
            type="submit"
            className="mt-6 min-h-12 w-full rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-6 py-3 text-base font-semibold text-[var(--homa-paper)] shadow-sm transition-colors hover:bg-[var(--homa-ink)]"
          >
            Choose a new password
          </button>
        </form>
      ) : (
        <div className="mt-8 rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm">
          <p className="text-[var(--homa-ink)]">That reset link is incomplete or no longer active.</p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block font-semibold text-[var(--homa-brand-text)] underline underline-offset-2"
          >
            Send reset link
          </Link>
        </div>
      )}
    </main>
  );
}
