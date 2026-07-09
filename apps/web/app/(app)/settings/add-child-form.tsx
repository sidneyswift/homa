"use client";

import { useActionState } from "react";

import { addChildAction, type SetupFormState } from "./actions";

/**
 * The add-a-child card, on /settings since 2026-07-09 (founder ask: it
 * sat on the dashboard before). The create-family form that used to live
 * beside it moved into /onboarding's FamilyStep (founder call 2026-07-08:
 * one onboarding for every door). The interests and help-with questions
 * left the card the same day (founder follow-up): the questionnaire's
 * extras beat asks them with tappable suggestions instead, so the card is
 * just name + birthday.
 */

const INITIAL_STATE: SetupFormState = { error: null };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function AddChildForm({ familyId }: { familyId: string }) {
  const [state, action, pending] = useActionState(addChildAction, INITIAL_STATE);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 19 }, (_, i) => currentYear - i);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">Add a child</h2>
      <input type="hidden" name="family_id" value={familyId} />

      <label className="mt-4 block font-medium text-strong" htmlFor="child-name">
        First name
      </label>
      <input id="child-name" name="child_name" type="text" required className={inputClass} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-strong" htmlFor="child-birth-month">
            Birth month
          </label>
          <select id="child-birth-month" name="birth_month" required defaultValue="" className={inputClass}>
            <option value="" disabled>Month</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-strong" htmlFor="child-birth-year">
            Birth year
          </label>
          <select id="child-birth-year" name="birth_year" required defaultValue="" className={inputClass}>
            <option value="" disabled>Year</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add child"}
      </button>
    </form>
  );
}
