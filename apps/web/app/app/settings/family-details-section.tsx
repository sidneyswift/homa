"use client";

import { useActionState, useState } from "react";

import { US_STATES } from "@homa/core";

import { setFamilyTimeZoneAction, type SetupFormState } from "./actions";
import { updateFamilyDetailsAction } from "./profile-actions";
import { SectionHeading } from "./section-heading";

/**
 * The details section of the one family card on /app/settings: the
 * family name and the address onboarding captured (the state drives
 * which homeschool rules Homa follows, and the street address is where
 * the thank-you card mails). The time zone fills itself, from the
 * device on first visit and from the address on a move (founder
 * direction 2026-07-12), so it renders as a quiet read-only line with a
 * rare-path Change control that saves on pick.
 */

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-card px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

const US_ZONES: ReadonlyArray<readonly [string, string]> = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

export interface FamilyDetails {
  name: string;
  addressLine: string;
  city: string;
  usState: string;
  zip: string;
  timeZone: string;
}

/** "Eastern" for the stored IANA name; unlisted zones show themselves. */
function zoneLabel(timeZone: string): string {
  const match = US_ZONES.find(([zone]) => zone === timeZone);
  return match ? match[1] : timeZone.replaceAll("_", " ");
}

/** The quiet zone line: label at rest, a save-on-pick select behind Change. */
function TimeZoneRow({ currentTimeZone }: { currentTimeZone: string }) {
  const [changing, setChanging] = useState(false);
  const [state, action, pending] = useActionState(setFamilyTimeZoneAction, INITIAL_STATE);
  const isListed = US_ZONES.some(([zone]) => zone === currentTimeZone);

  return (
    <form action={action} className="mt-4 border-t border-[var(--stone-100)] pt-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-muted">Time zone:</span>
        <span className="font-medium text-strong">
          {currentTimeZone ? zoneLabel(currentTimeZone) : "From your device on your next visit"}
        </span>
        <span className="text-xs text-muted" role="status">
          {pending ? "Saving\u2026" : state.saved ? "Saved" : ""}
        </span>
        {changing ? null : (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="ml-auto min-h-8 cursor-pointer rounded-pill px-3 py-1 text-sm font-medium text-muted transition-colors hover:text-strong"
          >
            Change
          </button>
        )}
      </div>
      {changing ? (
        <>
          <label className="sr-only" htmlFor="family-time-zone">
            Time zone
          </label>
          <select
            id="family-time-zone"
            name="time_zone"
            defaultValue={currentTimeZone}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className={inputClass}
          >
            <option value="" disabled>
              Pick a time zone
            </option>
            {/* A zone captured from a device outside the US list still
                shows as itself instead of silently snapping elsewhere. */}
            {currentTimeZone && !isListed ? (
              <option value={currentTimeZone}>{currentTimeZone.replaceAll("_", " ")}</option>
            ) : null}
            {US_ZONES.map(([zone, label]) => (
              <option key={zone} value={zone}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">
            Saves when you pick it. Usually it sets itself from your address and
            your device.
          </p>
        </>
      ) : null}
      {state.error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function FamilyDetailsSection({ details }: { details: FamilyDetails }) {
  const [state, action, pending] = useActionState(updateFamilyDetailsAction, INITIAL_STATE);

  return (
    <div>
      <SectionHeading>Family details</SectionHeading>

      <form action={action}>
        <label className="mt-3 block text-sm font-medium text-strong" htmlFor="family-name">
          Family name
        </label>
        <input
          id="family-name"
          name="family_name"
          type="text"
          required
          defaultValue={details.name}
          className={inputClass}
        />

        <label className="mt-4 block text-sm font-medium text-strong" htmlFor="family-address">
          Address
        </label>
        {/* The mail sentence retired (founder ask 2026-07-12: "real mail
            from Homa is creepy"); the state-rules reason stands alone. */}
        <p className="mt-1 text-sm text-body">
          The state sets which homeschool rules Homa follows.
        </p>
        <input
          id="family-address"
          name="address_line"
          type="text"
          autoComplete="address-line1"
          required
          defaultValue={details.addressLine}
          className={inputClass}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="block text-sm font-medium text-strong" htmlFor="family-city">
              City
            </label>
            <input
              id="family-city"
              name="address_city"
              type="text"
              autoComplete="address-level2"
              required
              defaultValue={details.city}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-strong" htmlFor="family-state">
              State
            </label>
            <select
              id="family-state"
              name="us_state"
              autoComplete="address-level1"
              required
              defaultValue={details.usState}
              className={inputClass}
            >
              <option value="" disabled>
                State
              </option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-strong" htmlFor="family-zip">
              ZIP
            </label>
            <input
              id="family-zip"
              name="address_zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              defaultValue={details.zip}
              className={inputClass}
            />
          </div>
        </div>

        {state.error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-10 cursor-pointer rounded-pill border border-border bg-card px-5 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            {pending ? "Saving\u2026" : "Save changes"}
          </button>
          <span className="text-xs text-muted" role="status">
            {state.saved && !pending ? "Saved" : ""}
          </span>
        </div>
      </form>

      <TimeZoneRow currentTimeZone={details.timeZone} />
    </div>
  );
}
