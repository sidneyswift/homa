"use client";

import { useState } from "react";

import { MAP_KID_CAP } from "@homa/core";

/**
 * S2: who are we mapping? Name, birth month + year (no day, matching the
 * product's data-minimization choice), one tap of interests, one tap of
 * "help with first". Out-of-range kids get the sage promise inline, never
 * a rejection.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const INTEREST_CHIPS = [
  "dinosaurs", "horses", "space", "princesses", "trucks", "bugs",
  "ocean", "drawing", "music", "sports", "cooking", "animals",
] as const;

function helpChipsForAge(ageYears: number): readonly string[] {
  if (ageYears < 5) {
    return ["letters", "counting", "writing their name", "scissors", "colors and shapes", "calm-down skills"];
  }
  if (ageYears < 8) {
    return ["reading", "handwriting", "math", "focus", "science curiosity", "confidence"];
  }
  return ["reading", "writing", "math", "focus", "study habits", "confidence"];
}

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
  const [interests, setInterests] = useState<string[]>([]);
  const [helpWith, setHelpWith] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalKids = existingCount + added.length;
  const ageYears = year ? currentYear - Number(year) : 4;
  const formReady = name.trim().length > 0 && month !== "" && year !== "";

  function toggleInterest(chip: string) {
    setInterests((current) =>
      current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip].slice(0, 8),
    );
  }

  async function addKid(): Promise<boolean> {
    if (!formReady || busy) return false;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/map/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthMonth: `${year}-${month}`,
          interests,
          helpWith: helpWith ?? undefined,
        }),
      });
      const data = (await response.json()) as { ok: boolean; inRange?: boolean; reason?: string };
      if (!data.ok) {
        setError(
          data.reason === "kid-cap"
            ? `Five kids is the most one map session holds. Everyone you added is saved.`
            : "That didn't save. One more try usually does it.",
        );
        setBusy(false);
        return false;
      }
      setAdded((current) => [...current, { name: name.trim(), inRange: Boolean(data.inRange) }]);
      setName("");
      setMonth("");
      setYear("");
      setInterests([]);
      setHelpWith(null);
      setBusy(false);
      return true;
    } catch {
      setError("Couldn't reach us just now. Nothing you typed is lost, try again.");
      setBusy(false);
      return false;
    }
  }

  async function finish() {
    if (formReady) {
      const ok = await addKid();
      if (!ok) return;
    }
    if (totalKids + (formReady ? 1 : 0) > 0 || added.length > 0 || existingCount > 0) {
      onDone();
    } else {
      setError("Add at least one kid and we're off.");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        Who are we mapping?
      </h1>
      <p className="mt-3 text-body">
        {welcomeBack ? "Welcome back. " : ""}Add each of your kids. Their checklists and maps stay
        separate, and nothing ever compares them.
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
              <span className="font-semibold text-strong">{kid.name}</span> is saved. The checklist
              for {kid.name}&apos;s age is nearly ready, and I&apos;ll email you the moment it is.
              Everything you told me is kept.
            </p>
          )}
        </div>
      ))}

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <label className="block font-medium text-strong" htmlFor="kid-name">
          Name
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
          Month and year only, so the checklist asks about their age, not a grade.
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

        <p className="mt-4 font-medium text-strong">What are they loving right now?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEREST_CHIPS.map((chip) => {
            const selected = interests.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggleInterest(chip)}
                aria-pressed={selected}
                className={`min-h-11 rounded-pill border px-4 py-2 text-sm transition duration-(--dur-fast) ease-out motion-safe:active:scale-[var(--press-scale)] ${
                  selected ? "border-brand bg-brand text-on-brand" : "border-border bg-card text-strong hover:border-brand"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        <p className="mt-4 font-medium text-strong">What would you love a hand with first?</p>
        <p className="mt-1 text-sm text-muted">Just one to start. Optional.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {helpChipsForAge(ageYears).map((chip) => {
            const selected = helpWith === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setHelpWith(selected ? null : chip)}
                aria-pressed={selected}
                className={`min-h-11 rounded-pill border px-4 py-2 text-sm transition duration-(--dur-fast) ease-out motion-safe:active:scale-[var(--press-scale)] ${
                  selected ? "border-brand bg-brand text-on-brand" : "border-border bg-card text-strong hover:border-brand"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {totalKids < MAP_KID_CAP - 1 || !formReady ? (
            <button
              type="button"
              onClick={() => void addKid()}
              disabled={!formReady || busy}
              className="min-h-12 w-full rounded-pill border border-brand bg-card px-6 py-3 text-base font-semibold text-brand transition duration-(--dur-fast) ease-out hover:bg-brand-soft motion-safe:active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              {busy ? "Saving\u2026" : "Save and add another"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void finish()}
            disabled={busy || (!formReady && totalKids === 0)}
            className="min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
          >
            That&apos;s everyone
          </button>
        </div>
        <p className="mt-3 text-center text-sm text-muted">No pressure, you can always add more later.</p>
      </div>
    </div>
  );
}
