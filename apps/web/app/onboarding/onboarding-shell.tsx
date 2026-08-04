"use client";

import { useState } from "react";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";
import { Footer } from "../../components/marketing/Footer";
import { Nav } from "../../components/marketing/Nav";
import type { FlowPhase } from "./flow-types";
import { MapFlow } from "./map-flow";
import type { OnboardingChatProps } from "./onboarding-chat-props";

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

/** Surfaces that own the whole viewport. Nav, footer, page padding and
 *  the 68rem measure all belong to a page you read; the conversation is
 *  a surface you live in, built around the message box at the bottom of
 *  a phone. The chrome goes away, but the SHAPE of the tree does not:
 *  see the note in the component. */
const CHROMELESS_PHASES: ReadonlySet<FlowPhase> = new Set<FlowPhase>(["chat"]);

export function OnboardingShell({
  chat = null,
  paywallPending = false,
}: {
  /** Chat-first onboarding's server-assembled props, or null when the
   *  flag is off and the card flow runs exactly as it always has. */
  chat?: OnboardingChatProps | null;
  /** The signup paywall's client-side handoff (founder directive
   *  2026-07-26): true means whoever finishes the account card here is
   *  forwarded to /onboarding/trial instead of the flow's next step. */
  paywallPending?: boolean;
}) {
  // Opened on the same answer MapFlow opens on, and for the same reason:
  // "loading" takes full chrome, so a shell that starts there paints the
  // marketing Nav and Footer around a skeleton before the conversation
  // replaces the lot. Both have to start in the right place or the flash
  // just moves from one of them to the other.
  const [phase, setPhase] = useState<FlowPhase>(
    chat && !paywallPending ? "chat" : "loading",
  );
  const chromeless = CHROMELESS_PHASES.has(phase);
  const fullChrome = FULL_CHROME_PHASES.has(phase) && !chromeless;
  const topAnchored = TOP_ANCHORED_PHASES.has(phase);

  // MapFlow is rendered in exactly ONE place, and every phase difference
  // below is a class name or a null sibling. An early return that put it
  // somewhere else in the tree cost an afternoon: React reconciles by
  // position, so moving MapFlow unmounted it, its phase reset to
  // "loading", that flowed back up through onPhaseChange, the shell
  // moved it back, and the two states chased each other. It showed up as
  // 911 calls to /api/map/state and a permanent loading skeleton.
  return (
    <div
      data-brand-surface="onboarding"
      className={`quiet-onboarding-surface quiet-onboarding__page${chromeless ? "" : " quiet-onboarding__page--flow"}`}
    >
      {chromeless ? null : fullChrome ? (
        <Nav />
      ) : (
        <header className="quiet-onboarding__header">
          <Link href="/" aria-label="Homa home" className="inline-flex">
            <Logo size={26} />
          </Link>
        </header>
      )}

      {/* Wide shell: the entry step is a two-column hero and the
          questionnaire grows a report rail; every other step re-constrains
          itself inside MapFlow's phase wrapper. */}
      <main
        className={
          chromeless
            ? "contents"
            : `quiet-onboarding__main ${fullChrome ? "quiet-onboarding__main--full" : "quiet-onboarding__main--focused"}`
        }
      >
        <div className={chromeless ? "contents" : `quiet-onboarding__main-inner ${topAnchored ? "quiet-onboarding__main-inner--anchored" : ""}`}>
          <MapFlow onPhaseChange={setPhase} chat={chat} paywallPending={paywallPending} />
        </div>
      </main>

      {chromeless ? null : fullChrome ? (
        <Footer />
      ) : (
        <footer className="quiet-onboarding__footer">
          <p>
            <Link
              className="quiet-onboarding__footer-link"
              href="/onboarding/method"
            >
              How the report is made
            </Link>
            {" \u00b7 "}
            <Link
              className="quiet-onboarding__footer-link"
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
