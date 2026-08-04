import { parsePasswordRecoveryConfirmation } from "@homa/core";
import type { Metadata } from "next";

import { Logo } from "../../../components/brand/Logo";
import { QuietAction, QuietFeedback, QuietFrame } from "../../../components/design";

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
        <form action="/auth/confirm" method="post" className="quiet-frame quiet-frame--paper mt-8 p-6">
          <input type="hidden" name="token_hash" value={confirmation.tokenHash} />
          <input type="hidden" name="type" value="recovery" />
          <QuietFeedback tone="info" title="Your reset link is ready.">
            Choose a new password to continue.
          </QuietFeedback>
          <QuietAction type="submit" size="large" className="mt-6 w-full">
            Choose a new password
          </QuietAction>
        </form>
      ) : (
        <QuietFrame as="article" className="mt-8 p-6">
          <QuietFeedback tone="error" title="This reset link is not active">
            That reset link is incomplete or no longer active.
          </QuietFeedback>
          <QuietAction kind="quiet" href="/forgot-password" className="mt-4">
            Send reset link
          </QuietAction>
        </QuietFrame>
      )}
    </main>
  );
}
