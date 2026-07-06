"use client";

import { useState } from "react";

import { MAP_KID_CAP } from "@homa/core";

/**
 * S2: add your kids, names and ages ONLY (read-through ruling: interests
 * and help-with are age-dependent and belong after the checklist, and the
 * first form should never feel like a survey). A nickname is explicitly
 * fine; we're not after anyone's information.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

interface AddedKid {
  name: string;
  inRange: boolean;
}

export function KidsStep({
  existingCount,
  welcomeBack,
  onDone,
}: {
  existingCount: number;
  welcomeBack: boolean;
  onDone: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [added, setAdded] = useState<AddedKid[]>([]);
  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalKids = existingCount + added.length;
  const formReady = name.trim().length > 0 && month !== "" && year !== "";

  async function addKid(): Promise<boolean> {
    if (!formReady || busy) return false;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/map/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), birthMonth: `${year}-${month}` }),
      });
      const data = (await response.json()) as { ok: boolean; inRange?: boolean; reason?: string };
      if (!data.ok) {
        setError(
          data.reason === "kid-cap"
            ? "Five kids is the most one session holds. Everyone you added is saved."
            : "That didn't save. One more try usually does it.",
        );
        setBusy(false);
        return false;
      }
      setAdded((current) => [...current, { name: name.trim(), inRange: Boolean(data.inRange) }]);
      setName("");
      setMonth("");
      setYear("");
      setBusy(false);
      return true;
    } catch {
      setError("Couldn't reach us just now. Nothing you typed is lost, try again.");
      setBusy(false);
      return false;
    }
  }

  async function startChecklist() {
    if (formReady) {
      const ok = await addKid();
      if (!ok) return;
    }
    if (totalKids > 0 || formReady) {
      onDone();
    } else {
      setError("Add at least one kid and we're off.");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">Add your kids</h1>
      <p className="mt-3 text-body">
        {welcomeBack ? "Welcome back. " : ""}Names and ages, nothing else. A nickname works fine (&ldquo;Kid 1&rdquo; counts).
      </p>

      {added.map((kid) => (
        <div
          key={`${kid.name}-added`}
          className={`mt-4 rounded-lg border p-4 ${kid.inRange ? "border-border bg-card" : "border-sage/40 bg-[var(--accent-sage-soft)]"}`}
        >
          {kid.inRange ? (
            <p className="text-body">
              <span className="font-semibold text-strong">{kid.name}</span> is saved and ready for
              the checklist.
            </p>
          ) : (
            <p className="text-body">
              <span className="font-semibold text-strong">{kid.name}</span> is saved. The checklist starts
              at age 2, and I&apos;ll email you the moment {kid.name}&apos;s is ready.
            </p>
          )}
        </div>
      ))}

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <label className="block font-medium text-strong" htmlFor="kid-name">
          Name or nickname
        </label>
        <input
          id="kid-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />

        <p className="mt-4 font-medium text-strong">Born</p>
        <p className="mt-1 text-sm text-muted">
          Month and year only. The checklist fits their exact age.
        </p>
        <div className="mt-2 flex gap-2">
          <select
            aria-label="Birth month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-1/2 rounded-md border border-border px-3 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Month</option>
            {MONTHS.map((label, index) => (
              <option key={label} value={String(index + 1).padStart(2, "0")}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Birth year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="w-1/2 rounded-md border border-border px-3 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Year</option>
            {Array.from({ length: 17 }, (_, i) => currentYear - i).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void startChecklist()}
            disabled={busy || (!formReady && totalKids === 0)}
            className="min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
          >
            {busy ? "Saving\u2026" : "Start the checklist"}
          </button>
          {totalKids < MAP_KID_CAP - 1 ? (
            <button
              type="button"
              onClick={() => void addKid()}
              disabled={!formReady || busy}
              className="min-h-12 w-full rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition duration-(--dur-fast) ease-out hover:border-brand motion-safe:active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              + Add another kid first
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-center text-sm text-muted">You can add more kids later.</p>
      </div>
    </div>
  );
}
