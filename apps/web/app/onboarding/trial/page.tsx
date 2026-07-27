import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TrialGate } from "../../../components/billing/trial-gate";
import { Logo } from "../../../components/brand/Logo";
import { familyHasBillingRelationship } from "../../../lib/billing/portal";
import { familyAccountGate } from "../../../lib/billing/wall";
import { requireFamily } from "../../../lib/map/session";

/**
 * /onboarding/trial: the signup trial gate (founder directive
 * 2026-07-26, HOMA_SIGNUP_PAYWALL_ENABLED). The one page between the
 * account card and the product: a card starts the 7 free days on any
 * tier, and nothing (questionnaire, report, conversation) exists for a
 * new family before it. Server-decided on every visit, so no client
 * state can route around it; /app admission (lib/app-data.ts) and
 * /onboarding both funnel walled accounts here.
 *
 * Two invariants:
 *
 * 1. The gate only renders for a family whose account exists
 *    (has_account). A Google sign-up whose auth user has not been
 *    linked yet (the /api/map/state linking round trip) bounces to
 *    /onboarding first, because checkout from this page charges the
 *    resume cookie's family: selling to an un-linked sitting could
 *    stamp a trial onto an anonymous row that attachAuthUser then
 *    folds away, a paid family with no purchase to show for it.
 *
 * 2. Every non-walled state leaves immediately. An entitled family is
 *    handed to /onboarding, whose own router forwards finished
 *    families to /app; a shared decision function
 *    (familyAccountGate) on both pages is what makes the two redirects
 *    a hand-off instead of a loop.
 */

export const metadata: Metadata = {
  title: "Start your free trial",
  robots: { index: false, follow: false },
};

export default async function TrialGatePage() {
  const family = await requireFamily();
  if (!family || !family.has_account) redirect("/onboarding");

  const gate = await familyAccountGate(family.id);
  if (!gate.checkout) redirect("/onboarding");

  const portalAvailable = gate.lapsed
    ? await familyHasBillingRelationship(family.id)
    : false;

  // The onboarding flow's quiet chrome (OnboardingShell's focused-step
  // ruling): a logo home link and the two-link footer, nothing that
  // reads as an exit-ramp buffet at the commitment moment.
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page-warm)] [background-image:var(--bg-paper)]">
      <header className="flex w-full items-center px-6 py-4 sm:px-10">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[68rem] flex-1 flex-col px-6 pt-10 pb-16 sm:pt-12 sm:pb-20">
        <div className="my-auto w-full">
          <TrialGate
            checkout={gate.checkout}
            lapsed={gate.lapsed}
            portalAvailable={portalAvailable}
          />
        </div>
      </main>
      <footer className="mx-auto w-full max-w-[36rem] px-6 pb-8 text-center text-sm text-subtle">
        <p>
          <Link
            className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
            href="/onboarding/method"
          >
            How the report is made
          </Link>
          {" · "}
          <Link
            className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
            href="/privacy"
          >
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
