"use client";

import { RotateCcw } from "lucide-react";

import { useOnboardingReset } from "./use-onboarding-reset";

/**
 * The dev badge: one tap to be a brand new parent again.
 *
 * Testing onboarding means arriving as somebody who has never been
 * here, over and over. Navigating somewhere to do that breaks the loop
 * every time, so this sits on top of whatever surface is being tested,
 * the way the framework's own dev indicator does.
 *
 * Top right on purpose. The framework badge owns the bottom left and
 * the composer owns the bottom of a phone, so those are the two places
 * it must not be. It sits above the chat's own layers but below the
 * checklist takeover and any dialog, because those are what is being
 * tested and covering them would defeat the point.
 *
 * Never rendered in production: the layout only mounts it when the
 * server says the reset route exists, and that route 404s without
 * NODE_ENV development plus HOMA_DEV_TEST_SESSIONS.
 */
export function DevToolbar({ familyId }: { familyId: string | null }) {
  const { phase, message, reset } = useOnboardingReset();

  return (
    // Half opacity until hovered: at full strength it sat on top of the
    // day separator and became part of the thing being judged, which is
    // the opposite of what a dev affordance is for.
    // z-40, BELOW the checklist takeover's z-50, which the header comment
    // always promised and the class contradicted: at z-[60] the
    // half-transparent "Restart onboarding" button, whose click deletes
    // the family, floated directly over the takeover's "Back to chat"
    // exit. A founder aiming for the exit was one tap from wiping the
    // walk they were testing.
    <div className="fixed right-3 top-3 z-40 flex flex-col items-end gap-1 opacity-45 transition-opacity duration-(--dur-base) hover:opacity-100 focus-within:opacity-100 print:hidden">
      <button
        type="button"
        onClick={() => void reset()}
        disabled={phase === "working"}
        title={
          familyId
            ? `Delete family ${familyId.slice(0, 8)} and start over as a new parent`
            : "Delete this test family and start over as a new parent"
        }
        className="flex min-h-8 items-center gap-1.5 rounded-pill border border-border-subtle bg-card/90 px-2.5 py-1 text-xs font-semibold text-muted shadow-sm backdrop-blur transition-colors hover:border-brand hover:text-strong disabled:cursor-not-allowed disabled:opacity-70"
      >
        <RotateCcw size={13} aria-hidden="true" />
        {phase === "working" ? "Resetting…" : "Restart onboarding"}
      </button>
      {familyId ? (
        // Which run this is. Two walks look identical on screen, and
        // this is the difference between them.
        <span className="rounded-pill bg-card/80 px-2 py-0.5 font-mono text-[0.6rem] text-subtle backdrop-blur">
          {familyId.slice(0, 8)}
        </span>
      ) : null}
      {message ? (
        <span className="max-w-[16rem] rounded-md bg-card/95 px-2 py-1 text-right text-[0.7rem] text-body shadow-sm backdrop-blur">
          {message}
        </span>
      ) : null}
    </div>
  );
}
