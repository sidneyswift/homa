"use client";

import { useOnboardingReset } from "../../../components/dev/use-onboarding-reset";

/**
 * The full-page version of the reset, for when the floating badge is
 * not what you want: a bookmark, a link to hand someone, or a surface
 * where the badge is hidden.
 *
 * Both call the same hook, so the page and the badge cannot end up
 * clearing different things.
 */

export function ResetClient() {
  const { phase, message, reset } = useOnboardingReset();

  return (
    <div className="mx-auto mt-16 w-full max-w-[26rem] px-6">
      <h1 className="font-display text-2xl font-bold text-strong">
        Start onboarding over
      </h1>
      <p className="mt-2 text-body">
        Deletes this test family and everything in it, then gives your account a
        fresh one. You stay signed in.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>Children, answers, reports and plans</li>
        <li>The whole conversation, and Homa&apos;s memories of it</li>
        <li>Materials, hours, and anything scheduled</li>
      </ul>
      <button
        type="button"
        onClick={() => void reset()}
        disabled={phase === "working"}
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === "working" ? "Resetting…" : "Reset and start over"}
      </button>
      {message ? <p className="mt-3 text-sm text-body">{message}</p> : null}
      <p className="mt-6 text-xs text-subtle">
        Development only. This route does not exist in production, and it refuses any
        family not marked as a test family.
      </p>
    </div>
  );
}
