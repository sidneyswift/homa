"use client";

import { useState } from "react";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";
import { Footer } from "../../components/marketing/Footer";
import { Nav } from "../../components/marketing/Nav";
import type { FlowPhase } from "./flow-types";
import { MapFlow } from "./map-flow";

/**
 * Chrome for the onboarding flow (UX review 2026-07-06, approved in full).
 *
 * Two rulings live here:
 *
 * 1. Full site Nav + Footer only on the "page-like" moments (entry, hub,
 *    and the loading beat before we know which). Mid-flow, the marketing
 *    nav is an exit-ramp buffet, and its "Sign Up" button navigates to
 *    /onboarding itself, which remounts the flow and dumps a
 *    mid-questionnaire parent onto the hub. Focused steps get quiet
 *    chrome instead: just a logo home link (the "everything saves as
 *    you go" caption that used to sit beside it was cut 2026-07-07, on
 *    request), and the original two-link footer.
 *
 * 2. The centering bug: the old shell centered with justify-center on a
 *    flex column, and a step taller than the leftover viewport overflows
 *    EQUALLY in both directions under that rule, pushing its heading up
 *    underneath the sticky nav where no scroll position can reach it
 *    (seen live on the signup step). Auto margins on the child center
 *    when there's room and top-align when there isn't, which is exactly
 *    the behavior wanted.
 *
 * 3. Question phases anchor to the top instead of centering (founder
 *    feedback 2026-07-07, mobile review): vertical centering re-centers
 *    the whole step every time the question card's height changes, so
 *    the kid/subject header visibly drifted between questions. Pinning
 *    the checklist and deep dive near the top keeps that header still,
 *    and card growth extends downward where nothing sits below it.
 */

const FULL_CHROME_PHASES: ReadonlySet<FlowPhase> = new Set<FlowPhase>([
  "loading",
  "parent",
  "hub",
  "bootstrap-error",
]);

/** Long-lived question surfaces whose header must hold still while the
 * card below changes height between questions. */
const TOP_ANCHORED_PHASES: ReadonlySet<FlowPhase> = new Set<FlowPhase>(["checklist", "deepdive"]);

export function OnboardingShell() {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const fullChrome = FULL_CHROME_PHASES.has(phase);
  const topAnchored = TOP_ANCHORED_PHASES.has(phase);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page-warm)] [background-image:var(--bg-paper)]">
      {fullChrome ? (
        <Nav />
      ) : (
        <header className="flex w-full items-center px-6 py-4 sm:px-10">
          <Link href="/" aria-label="Homa home" className="inline-flex">
            <Logo size={26} />
          </Link>
        </header>
      )}

      {/* Wide shell: the entry step is a two-column hero and the
          questionnaire grows a report rail; every other step re-constrains
          itself inside MapFlow's phase wrapper. */}
      <main
        className={`mx-auto flex w-full max-w-[68rem] flex-1 flex-col px-6 ${
          fullChrome ? "pt-16 pb-24 sm:pt-24 sm:pb-32" : "pt-10 pb-16 sm:pt-12 sm:pb-20"
        }`}
      >
        <div className={`w-full ${topAnchored ? "" : "my-auto"}`}>
          <MapFlow onPhaseChange={setPhase} />
        </div>
      </main>

      {fullChrome ? (
        <Footer />
      ) : (
        <footer className="mx-auto w-full max-w-[36rem] px-6 pb-8 text-center text-sm text-subtle">
          <p>
            <Link
              className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
              href="/onboarding/method"
            >
              How the report is made
            </Link>
            {" \u00b7 "}
            <Link
              className="underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
              href="/privacy"
            >
              Privacy
            </Link>
          </p>
        </footer>
      )}
    </div>
  );
}
