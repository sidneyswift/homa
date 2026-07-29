import { notFound } from "next/navigation";
import Link from "next/link";

import { ReportLockOffer } from "../../../components/billing/report-lock-offer";
import { TrialGate } from "../../../components/billing/trial-gate";
import { WallOffer } from "../../../components/billing/wall-offer";
import { Logo } from "../../../components/brand/Logo";
import type { WallCheckout } from "../../../lib/billing/wall-types";

/**
 * Development-only bench for the signup trial gate (/onboarding/trial).
 *
 * This renders the REAL TrialGate the paywall renders, inside the real
 * page chrome from app/onboarding/trial/page.tsx, fed a fixture
 * WallCheckout. So it exercises the actual component, copy module,
 * design tokens, and Tailwind build, and a change that breaks the live
 * gate breaks this page too.
 *
 * It exists because the live gate is unreachable without a walled
 * family session plus configured Stripe Payment Links, which makes
 * every visual review of it either a hand-drawn mock or a production
 * signup. Screenshots taken here are of the same component the parent
 * sees.
 *
 * What it does NOT cover: the server gate decision (familyAccountGate),
 * the redirect hand-off with /onboarding, the beacons reaching
 * /api/billing/beacon, and Stripe checkout itself. Those need a real
 * session.
 *
 * Query params: ?lapsed=1 for the returning-family variant,
 * ?portal=1 to add the manage-billing link, ?tiers=1 to render the
 * base tier alone (the shape when Plus and Max Payment Links are not
 * configured for an environment).
 *
 * ?surface=doors renders the OTHER two places the shared tier picker
 * appears (the door wall's offer card and the report lock's card)
 * instead of the trial gate. They matter here because TierOptions is
 * shared: a change made for this page silently reshapes both of those
 * production surfaces, and this is the only way to look at them
 * without a walled family session and a scored report.
 *
 * Not linked from anywhere and returns 404 in production.
 */

const FIXTURE_URL = "https://example.test/checkout";

function fixtureCheckout(soloTier: boolean): WallCheckout {
  const tier = { monthlyUrl: FIXTURE_URL, annualUrl: FIXTURE_URL };
  return {
    regular: tier,
    plus: soloTier ? null : tier,
    elite: soloTier ? null : tier,
  };
}

export default async function PaywallBenchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const lapsed = params.lapsed === "1";
  const portalAvailable = params.portal === "1";
  const soloTier = params.tiers === "1";
  const doors = params.surface === "doors";
  const checkout = fixtureCheckout(soloTier);

  if (doors) {
    return (
      <div className="flex min-h-screen flex-col gap-8 bg-[var(--bg-page-warm)] [background-image:var(--bg-paper)] p-6">
        <section className="mx-auto w-full max-w-[36rem] rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
            Door wall offer (WallOffer)
          </h2>
          <WallOffer door="month" childName="Maya" checkout={checkout} />
        </section>
        <section className="mx-auto w-full max-w-[36rem]">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
            Report lock offer (ReportLockOffer)
          </h2>
          <ReportLockOffer
            childId="00000000-0000-0000-0000-000000000000"
            childName="Maya"
            mappedCount={9}
            openCount={4}
            lockedCount={5}
            checkout={checkout}
            signinNext="/onboarding"
          />
        </section>
      </div>
    );
  }

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
            checkout={fixtureCheckout(soloTier)}
            lapsed={lapsed}
            portalAvailable={portalAvailable}
          />
        </div>
      </main>
      <footer className="mx-auto w-full max-w-[36rem] px-6 pb-8 text-center text-sm text-muted">
        <p>
          <Link
            className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
            href="/privacy"
          >
            Privacy
          </Link>
          {" · "}
          <Link
            className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
            href="/terms"
          >
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
