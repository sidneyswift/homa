"use client";

import { useActionState } from "react";

import { setFamilyTimeZoneAction, type SetupFormState } from "./actions";

/**
 * The time-zone settings card: usually already right (TimeZoneSync fills
 * it from the parent's device), here for the family that plans on
 * grandma's laptop two states over. US zones only for now, matching the
 * product's US-only audience.
 */

const INITIAL_STATE: SetupFormState = { error: null };

const US_ZONES: ReadonlyArray<readonly [string, string]> = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

export function TimeZoneCard({ currentTimeZone }: { currentTimeZone: string | null }) {
  const [state, action, pending] = useActionState(setFamilyTimeZoneAction, INITIAL_STATE);
  const isListed = US_ZONES.some(([zone]) => zone === currentTimeZone);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">Your time zone</h2>
      <p className="mt-1 text-sm text-body">
        Sets the clock behind your greeting and the week planner&apos;s dates.
        {currentTimeZone ? "" : " Homa picks it up from your device on this visit."}
      </p>

      <label className="mt-4 block font-medium text-strong" htmlFor="family-time-zone">
        Time zone
      </label>
      <select
        id="family-time-zone"
        name="time_zone"
        defaultValue={currentTimeZone ?? ""}
        className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        <option value="" disabled>
          Pick a time zone
        </option>
        {/* A zone captured from a device outside the US list still shows
            as itself instead of silently snapping to something else. */}
        {currentTimeZone && !isListed ? (
          <option value={currentTimeZone}>{currentTimeZone.replaceAll("_", " ")}</option>
        ) : null}
        {US_ZONES.map(([zone, label]) => (
          <option key={zone} value={zone}>
            {label}
          </option>
        ))}
      </select>

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
        {pending ? "Saving\u2026" : "Save time zone"}
      </button>
    </form>
  );
}
