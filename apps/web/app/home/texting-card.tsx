"use client";

import { useActionState } from "react";

import { setFamilyPhoneAction, type SetupFormState } from "./actions";

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

/**
 * The texting-line card on /home: shows the family's linked cell (if any)
 * and lets the parent set, change, or clear it. Homa's own number renders
 * only when the deployment has one configured.
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
      <h2 className="font-display text-xl font-semibold text-strong">Text with Homa</h2>
      <p className="mt-1 text-sm text-body">
        {linkedPhoneDisplay
          ? `Texts from ${linkedPhoneDisplay} reach your family's Homa.`
          : "Add your cell and texts from it will reach your family's Homa."}
        {homaNumberDisplay ? ` Her number is ${homaNumberDisplay}.` : ""}
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
        Leave it empty and save to stop texting. Standard messaging rates apply.
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
