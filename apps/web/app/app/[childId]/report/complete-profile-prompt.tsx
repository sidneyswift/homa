"use client";

import { useActionState, useState } from "react";

import {
  saveProfileExtrasAction,
  type ProfileExtrasState,
} from "./profile-extras-actions";

/**
 * The post-report "complete your profile" card (funnel work 2026-07-20,
 * docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md). Shown
 * once, right after the first report is on screen (the ?fresh=1 landing
 * from scoring), when the family has no mailing address yet. The two asks
 * the signup card used to demand up front, mailing address and cell
 * number, live here instead, both optional, each with its own reason,
 * because the parent has now done the whole assessment and can see why
 * they help.
 *
 * Offers never commands (house rule): "Not now" is a first-class outcome
 * that costs nothing, and the same fields wait in settings forever.
 */

const inputClass =
  "mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-3 text-base text-[var(--homa-ink)] transition-colors duration-(--homa-motion-fast) ease-out focus:border-[var(--homa-midnight-action)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30";

const INITIAL_STATE: ProfileExtrasState = { error: null };

export function CompleteProfilePrompt({ childName }: { childName: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [state, action, pending] = useActionState(saveProfileExtrasAction, INITIAL_STATE);

  if (dismissed || state.saved) return null;

  return (
    <div data-brand-layer="report-profile-prompt" className="mx-auto mt-8 w-full max-w-[36rem] px-6">
      <form
        action={action}
        className="quiet-frame rounded-[var(--homa-radius-card)] border-[var(--homa-control-boundary)] p-6 shadow-sm"
      >
        <p className="font-mono text-xs text-subtle">optional, anytime</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-strong">
          A couple of extras, whenever you like
        </h2>
        <p className="mt-2 text-body">
          {childName}&apos;s report is yours to keep. If you want a little more from Homa,
          these two help, and you can always add them later in settings.
        </p>

        <label className="mt-5 block font-medium text-strong" htmlFor="extras-address">
          Mailing address{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          So Homa can mail printed materials, and point you to homeschool activities and
          groups near you.
        </p>
        <input
          id="extras-address"
          name="address_line"
          type="text"
          autoComplete="address-line1"
          placeholder="123 Maple Street"
          className={inputClass}
        />
        <div className="mt-3 grid grid-cols-[2fr_1fr] gap-3">
          <div>
            <label className="sr-only" htmlFor="extras-city">
              City
            </label>
            <input
              id="extras-city"
              name="address_city"
              type="text"
              autoComplete="address-level2"
              placeholder="City"
              className={inputClass}
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="extras-zip">
              ZIP
            </label>
            <input
              id="extras-zip"
              name="address_zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="ZIP"
              className={inputClass}
            />
          </div>
        </div>

        <label className="mt-5 block font-medium text-strong" htmlFor="extras-phone">
          Cell number <span className="font-normal text-muted">(optional)</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          So you can text Homa a photo or a question, and get a gentle nudge when there&apos;s
          progress to see.
        </p>
        <input
          id="extras-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="mobile tel"
          placeholder="(954) 555-0123"
          className={inputClass}
        />

        {state.error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="quiet-action quiet-action--primary mt-6 min-h-12 w-full px-6 py-3 text-base shadow-sm disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={pending}
          className="mt-2 w-full text-center text-sm text-subtle underline-offset-2 hover:underline"
        >
          Not now
        </button>
      </form>
    </div>
  );
}
