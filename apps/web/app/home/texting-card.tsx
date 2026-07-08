"use client";

import { useActionState } from "react";

import { setFamilyPhoneAction, type SetupFormState } from "./actions";

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

/**
 * The phone number card on /home settings: shows the family's linked cell
 * (if any) and lets the parent set, change, or clear it. Account settings,
 * not a texting-feature gate (moved here 2026-07-08 from the onboarding
 * signup step it used to live on): the number saves the same way whether
 * or not this deployment's Homa texting line is live, so a family's
 * contact info is never lost to a feature flag. Homa's own number, and
 * the texting-specific framing, render only once the deployment has a
 * live line configured.
 */
export function TextingCard({
  linkedPhoneDisplay,
  homaNumberDisplay,
}: {
  /** "(954) 990-3497" or null when no number is linked yet. */
  linkedPhoneDisplay: string | null;
  /** Homa's own texting number, formatted, or null when SMS is off. */
  homaNumberDisplay: string | null;
}) {
  const [state, action, pending] = useActionState(setFamilyPhoneAction, INITIAL_STATE);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">
        {homaNumberDisplay ? "Text with Homa" : "Your phone number"}
      </h2>
      <p className="mt-1 text-sm text-body">
        {homaNumberDisplay
          ? linkedPhoneDisplay
            ? `Texts from ${linkedPhoneDisplay} reach your family's Homa. Her number is ${homaNumberDisplay}.`
            : `Add your cell and texts from it will reach your family's Homa. Her number is ${homaNumberDisplay}.`
          : "Save your cell so Homa can reach your family. Once her texting line is live, you'll be able to text her directly too."}
      </p>

      <label className="mt-4 block font-medium text-strong" htmlFor="family-phone">
        Your cell number
      </label>
      <input
        id="family-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="mobile tel"
        defaultValue={linkedPhoneDisplay ?? ""}
        placeholder="(954) 555-0123"
        className={inputClass}
      />
      <p className="mt-2 text-xs text-muted">
        {homaNumberDisplay
          ? "Leave it empty and save to stop texting. Standard messaging rates apply."
          : "Leave it empty and save to remove your number."}
      </p>

      {state.error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 min-h-12 rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save number"}
      </button>
    </form>
  );
}
