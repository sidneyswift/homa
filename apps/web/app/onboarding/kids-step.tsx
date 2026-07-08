"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { MAP_KID_CAP } from "@homa/core";

/**
 * S2: add your kids, as the SAME add-a-child card the signed-in flow uses
 * (founder call 2026-07-08: one onboarding for every door, and this card
 * design, first name, birth month + year, interests, help-with, is the
 * one to keep). This overturns the 2026-07-06 "get the actual birthday"
 * ruling: month + year is what the card asks, and the day saves as 01,
 * the same convention /home has always used (age-band math needs month
 * precision only).
 *
 * Because interests and help-with are collected here now, the extras
 * step after the checklist only shows for a kid who left both empty
 * (MapFlow skips it otherwise), so nothing is ever asked twice.
 *
 * Multi-kid: "Add child" saves the form (POST /api/map/children, the
 * same route as before) and clears it for the next sibling; saved kids
 * stack up as quiet checkmarked rows above the form. The primary start
 * button appears once at least one kid is saved, and, as a kindness, a
 * filled-in form is saved automatically on start so typed work is never
 * lost to a missed "Add child" tap.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const YEAR_SPAN = 17;

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-card px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

interface AddedKid {
  name: string;
  inRange: boolean;
}

interface KidForm {
  name: string;
  month: string;
  year: string;
  interests: string;
  focus: string;
}

function emptyForm(): KidForm {
  return { name: "", month: "", year: "", interests: "", focus: "" };
}

function formIsBlank(form: KidForm): boolean {
  return (
    form.name.trim() === "" &&
    form.month === "" &&
    form.year === "" &&
    form.interests.trim() === "" &&
    form.focus.trim() === ""
  );
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
  const years = Array.from({ length: YEAR_SPAN }, (_, i) => currentYear - i);
  const [added, setAdded] = useState<AddedKid[]>([]);
  const [form, setForm] = useState<KidForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalKids = existingCount + added.length;
  const canAddMore = totalKids < MAP_KID_CAP;

  function updateForm(patch: Partial<KidForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  /** Null when valid, otherwise the friendly pointer to what's missing. */
  function validateForm(): string | null {
    if (!form.name.trim()) return "Add their first name (a nickname is fine) and we're off.";
    if (form.month === "" || form.year === "") {
      return `Pick ${form.name.trim()}'s birth month and year.`;
    }
    return null;
  }

  async function saveForm(): Promise<{ ok: boolean; inRange?: boolean; reason?: string }> {
    const interests = form.interests
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    const focus = form.focus.trim();
    const response = await fetch("/api/map/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        // Day is always 01 by design: age-band math needs month + year only.
        birthDate: `${form.year}-${form.month.padStart(2, "0")}-01`,
        interests,
        ...(focus ? { helpWith: focus } : {}),
      }),
    });
    return (await response.json()) as { ok: boolean; inRange?: boolean; reason?: string };
  }

  async function addChild(): Promise<boolean> {
    const problem = validateForm();
    if (problem) {
      setError(problem);
      return false;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await saveForm();
      if (!data.ok) {
        setError(
          data.reason === "kid-cap"
            ? "Five kids is the most one session holds. Everyone you added is saved."
            : "That didn't save. One more try usually does it.",
        );
        setBusy(false);
        return false;
      }
      setAdded((current) => [...current, { name: form.name.trim(), inRange: Boolean(data.inRange) }]);
      setForm(emptyForm());
      setBusy(false);
      return true;
    } catch {
      setError("Couldn't reach us just now. Nothing you typed is lost, try again.");
      setBusy(false);
      return false;
    }
  }

  /** A filled-in form saves itself first, so typed work is never lost to
   * a missed "Add child" tap; a blank form just starts. */
  async function startChecklist() {
    if (!formIsBlank(form)) {
      const saved = await addChild();
      if (!saved) return;
      onDone();
      return;
    }
    if (totalKids === 0) {
      setError("Add at least one kid and we're off.");
      return;
    }
    onDone();
  }

  const startLabel =
    totalKids + (formIsBlank(form) ? 0 : 1) > 1
      ? "Start the questionnaires"
      : "Start the questionnaire";

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        Let&apos;s add your kids.
      </h1>
      <p className="mt-3 text-body">
        {welcomeBack
          ? "Welcome back. Pick up right where you left off."
          : "Tell Homa about each kid. The questionnaire tunes itself to their age."}
      </p>

      {added.length > 0 ? (
        <div className="mt-6 flex flex-col gap-4">
          {added.map((kid, index) => (
            <div key={`${kid.name}-${index}`} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-sage-soft)] text-[var(--sage-700)]"
              >
                <Check size={13} strokeWidth={3} />
              </span>
              {kid.inRange ? (
                <p className="text-body">
                  <span className="font-semibold text-strong">{kid.name}</span> is saved and ready
                  for the questionnaire.
                </p>
              ) : (
                <p className="text-body">
                  <span className="font-semibold text-strong">{kid.name}</span> is saved. The
                  questionnaire starts at age 2, and I&apos;ll email you the moment {kid.name}&apos;s
                  is ready.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {canAddMore ? (
        <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-strong">Add a child</h2>

          <label className="mt-4 block font-medium text-strong" htmlFor="kid-name">
            First name
          </label>
          <input
            id="kid-name"
            type="text"
            autoFocus
            required
            value={form.name}
            onChange={(event) => updateForm({ name: event.target.value })}
            className={inputClass}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-strong" htmlFor="kid-birth-month">
                Birth month
              </label>
              <select
                id="kid-birth-month"
                required
                value={form.month}
                onChange={(event) => updateForm({ month: event.target.value })}
                className={inputClass}
              >
                <option value="" disabled>
                  Month
                </option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-strong" htmlFor="kid-birth-year">
                Birth year
              </label>
              <select
                id="kid-birth-year"
                required
                value={form.year}
                onChange={(event) => updateForm({ year: event.target.value })}
                className={inputClass}
              >
                <option value="" disabled>
                  Year
                </option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-4 block font-medium text-strong" htmlFor="kid-interests">
            What are they into right now?
          </label>
          <input
            id="kid-interests"
            type="text"
            value={form.interests}
            onChange={(event) => updateForm({ interests: event.target.value })}
            placeholder="dinosaurs, space, drawing"
            className={inputClass}
          />
          <p className="mt-1 text-sm text-muted">Separate with commas. This themes their materials.</p>

          <label className="mt-4 block font-medium text-strong" htmlFor="kid-focus">
            What would you love help with first?
          </label>
          <input
            id="kid-focus"
            type="text"
            value={form.focus}
            onChange={(event) => updateForm({ focus: event.target.value })}
            placeholder="letter sounds, counting to 40, writing her name"
            className={inputClass}
          />

          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          {/* "Add child" stays the card's own action (secondary weight so
              the flow's one primary is the start button below); it saves
              this kid and clears the card for a sibling. */}
          <button
            type="button"
            onClick={() => void addChild()}
            disabled={busy}
            className="mt-6 min-h-12 w-full rounded-pill border-[1.5px] border-[var(--sage-300)] bg-transparent px-6 py-3 text-base font-semibold text-[var(--sage-700)] transition duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
          >
            {busy ? "Saving\u2026" : "Add child"}
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Five kids is the most one session holds. Everyone you added is saved.
        </p>
      )}

      {error && !canAddMore ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {totalKids > 0 || !formIsBlank(form) ? (
        <button
          type="button"
          onClick={() => void startChecklist()}
          disabled={busy}
          className="mt-5 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Saving\u2026" : startLabel}
        </button>
      ) : null}
    </div>
  );
}
