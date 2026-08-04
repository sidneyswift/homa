"use client";

import { useRef, useState } from "react";

import { Icon } from "../../components/design/Icon";
import { QuietAction, QuietFeedback, QuietField, QuietFrame, QuietStatus } from "../../components/design";

import { MAP_KID_CAP } from "@homa/core";

/**
 * S2: add your kids, as the SAME add-a-child card the signed-in flow uses
 * (founder call 2026-07-08: one onboarding for every door). The card asks
 * for the full birthday, month, day, and year (founder ruling 2026-07-11:
 * "get the full data so we know how old the kid is", restoring the
 * 2026-07-06 ruling that the 2026-07-08 month-only card had overturned).
 * The day select clamps to the real day count for the chosen month, and
 * the server schema rejects impossible dates like Feb 30.
 *
 * Founder follow-up (2026-07-08, with screenshot): the interests and
 * help-with questions left this card. They belong to the questionnaire
 * instead, where the extras beat right after the last checklist question
 * asks them with tappable suggestions (ExtrasStep), so the card is just
 * name + birthday and never feels like a survey.
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

interface AddedKid {
  name: string;
  inRange: boolean;
}

interface KidForm {
  name: string;
  month: string;
  day: string;
  year: string;
}

function emptyForm(): KidForm {
  return { name: "", month: "", day: "", year: "" };
}

function formIsBlank(form: KidForm): boolean {
  return (
    form.name.trim() === "" && form.month === "" && form.day === "" && form.year === ""
  );
}

/** Day count for the picked month (and year, for February), defaulting
 * generously while either is unpicked; a leap default keeps Feb 29
 * pickable until the year says otherwise. */
function daysInMonth(month: string, year: string): number {
  if (month === "") return 31;
  return new Date(Number(year || "2000"), Number(month), 0).getDate();
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
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const totalKids = existingCount + added.length;
  const canAddMore = totalKids < MAP_KID_CAP;

  function updateForm(patch: Partial<KidForm>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      // A month or year change can shrink the day count (Feb, leap years);
      // an out-of-range picked day resets rather than saving a fake date.
      if (next.day !== "" && Number(next.day) > daysInMonth(next.month, next.year)) {
        next.day = "";
      }
      return next;
    });
  }

  /** Null when valid, otherwise the friendly pointer to what's missing. */
  function validateForm(): string | null {
    if (!form.name.trim()) return "Add their first name (a nickname is fine) and we're off.";
    if (form.month === "" || form.day === "" || form.year === "") {
      return `Pick ${form.name.trim()}'s birthday: month, day, and year.`;
    }
    return null;
  }

  async function saveForm(): Promise<{ ok: boolean; inRange?: boolean; reason?: string }> {
    const response = await fetch("/api/map/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        // The real birthday, day included (founder ruling 2026-07-11).
        birthDate: `${form.year}-${form.month.padStart(2, "0")}-${form.day.padStart(2, "0")}`,
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
      // The cleared form plus the cursor back in First name says "ready
      // for the next kid" without a word of instruction.
      nameInputRef.current?.focus();
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

  // The start button says out loud what it will do with a half-entered
  // kid (founder confusion 2026-07-08: "idk if Im supposed to press add
  // child again"): a filled-in form makes it read "Save Gatsby and
  // start...", so nobody has to guess that starting saves them too.
  const draftName = form.name.trim();
  const questionnaireNoun =
    totalKids + (formIsBlank(form) ? 0 : 1) > 1 ? "the questionnaires" : "the questionnaire";
  const startLabel =
    !formIsBlank(form) && draftName
      ? `Save ${draftName} and start ${questionnaireNoun}`
      : `Start ${questionnaireNoun}`;

  return (
    <div data-brand-surface="onboarding-kids" className="quiet-onboarding__step">
      <h1 className="font-display text-3xl font-bold leading-tight text-[var(--homa-ink)]">
        Let&apos;s add your kids.
      </h1>
      <p className="mt-3 text-[var(--homa-ink)]">
        {welcomeBack
          ? "Welcome back. Pick up right where you left off."
          : "Tell Homa about each kid. The questionnaire tunes itself to their age."}
      </p>

      {added.length > 0 ? (
        <div className="quiet-onboarding__saved-kids mt-6" aria-live="polite">
          {added.map((kid, index) => (
            <QuietStatus
              key={`${kid.name}-${index}`}
              tone={kid.inRange ? "constructive" : "info"}
              className="quiet-onboarding__saved-kid"
            >
              <span className="quiet-onboarding__saved-kid-mark" aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
              {kid.inRange ? (
                <p className="text-[var(--homa-ink)]">
                  <span className="font-semibold text-[var(--homa-ink)]">{kid.name}</span> is saved and ready
                  for the questionnaire.
                </p>
              ) : (
                <p className="text-[var(--homa-ink)]">
                  <span className="font-semibold text-[var(--homa-ink)]">{kid.name}</span> is saved. The
                  questionnaire starts at age 2, and I&apos;ll email you the moment {kid.name}&apos;s
                  is ready.
                </p>
              )}
            </QuietStatus>
          ))}
        </div>
      ) : null}

      {canAddMore ? (
        <QuietFrame as="article" className="quiet-onboarding__form mt-6 p-6">
          <h2 className="quiet-onboarding__form-title">Add a child</h2>

          <QuietField id="kid-name" label="First name" required className="mt-5">
            <input
              ref={nameInputRef}
              type="text"
              autoFocus
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              aria-describedby={error ? "kids-form-error" : undefined}
            />
          </QuietField>

          <div className="quiet-onboarding__birthday-grid mt-4">
            <QuietField id="kid-birth-month" label="Birth month" required>
              <select
                value={form.month}
                onChange={(event) => updateForm({ month: event.target.value })}
                aria-describedby={error ? "kids-form-error" : undefined}
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
            </QuietField>
            <QuietField id="kid-birth-day" label="Day" required>
              <select
                value={form.day}
                onChange={(event) => updateForm({ day: event.target.value })}
                aria-describedby={error ? "kids-form-error" : undefined}
              >
                <option value="" disabled>
                  Day
                </option>
                {Array.from({ length: daysInMonth(form.month, form.year) }, (_, i) => i + 1).map(
                  (day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ),
                )}
              </select>
            </QuietField>
            <QuietField id="kid-birth-year" label="Birth year" required>
              <select
                value={form.year}
                onChange={(event) => updateForm({ year: event.target.value })}
                aria-describedby={error ? "kids-form-error" : undefined}
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
            </QuietField>
          </div>

          {error ? (
            <QuietFeedback id="kids-form-error" tone="error" className="mt-4">
              {error}
            </QuietFeedback>
          ) : null}

          {/* "Add child" stays the card's own action (secondary weight so
              the flow's one primary is the start button below); it saves
              this kid and clears the card for a sibling. */}
          <QuietAction
            kind="secondary"
            type="button"
            onClick={() => void addChild()}
            disabled={busy}
            className="mt-6 w-full"
          >
            {busy ? "Saving…" : "Add child"}
          </QuietAction>
        </QuietFrame>
      ) : (
        <p className="quiet-onboarding__capacity-note mt-6">
          Five kids is the most one session holds. Everyone you added is saved.
        </p>
      )}

      {error && !canAddMore ? (
        <QuietFeedback tone="error" className="mt-4">
          {error}
        </QuietFeedback>
      ) : null}

      {totalKids > 0 || !formIsBlank(form) ? (
        <QuietAction
          type="button"
          onClick={() => void startChecklist()}
          disabled={busy}
          size="large"
          className="mt-5 w-full"
        >
          {busy ? "Saving\u2026" : startLabel}
        </QuietAction>
      ) : null}
    </div>
  );
}
