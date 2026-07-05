"use client";

import { useActionState } from "react";

import { US_STATES } from "@homa/core";

import { addChildAction, createFamilyAction, type SetupFormState } from "./actions";

const INITIAL_STATE: SetupFormState = { error: null };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function CreateFamilyForm() {
  const [state, action, pending] = useActionState(createFamilyAction, INITIAL_STATE);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">
        Set up your family
      </h2>
      <label className="mt-4 block font-medium text-strong" htmlFor="family-name">
        Family name
      </label>
      <input id="family-name" name="family_name" type="text" placeholder="The Swift family" className={inputClass} />

      <label className="mt-4 block font-medium text-strong" htmlFor="family-state">
        State (optional)
      </label>
      <select id="family-state" name="us_state" defaultValue="" className={inputClass}>
        <option value="">Choose a state</option>
        {US_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>

      {state.error ? (
        <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Setting up…" : "Create family"}
      </button>
    </form>
  );
}

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

      <label className="mt-4 block font-medium text-strong" htmlFor="child-interests">
        What are they into right now?
      </label>
      <input
        id="child-interests"
        name="interests"
        type="text"
        placeholder="dinosaurs, space, drawing"
        className={inputClass}
      />
      <p className="mt-1 text-sm text-muted">Separate with commas. This themes their materials.</p>

      <label className="mt-4 block font-medium text-strong" htmlFor="child-focus">
        What would you love help with first?
      </label>
      <input
        id="child-focus"
        name="focus"
        type="text"
        placeholder="letter sounds, counting to 40, writing her name"
        className={inputClass}
      />

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
