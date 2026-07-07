"use client";

import { useRef, useState } from "react";

import { isValidBirthDate, MAP_KID_CAP } from "@homa/core";

/**
 * S2: add your family. Names and real birthdates (founder call 2026-07-06:
 * "get the actual birthday, not just month and year") ONLY, read-through
 * ruling still holds: interests and help-with are age-dependent and belong
 * after the checklist, and this form should never feel like a survey. A
 * nickname is explicitly fine; we're not after anyone's information beyond
 * what the checklist needs.
 *
 * UX review 2026-07-06 (approved in full):
 * - The birthday is three numeric fields with auto-advance, not three
 *   <select>s (a 17-option year menu was the slowest input on the page).
 * - The primary button stays enabled and explains what's missing on tap;
 *   a disabled button is a question the page refuses to answer.
 * - The button personalizes the moment a name is typed ("Start Maya's
 *   questionnaire").
 * - "+ Add another kid first" (ambiguous) became a quiet "+ add another
 *   kid" link, and the redundant "you can add more kids later" caption is
 *   gone; the subhead already carries that reassurance.
 * - Founder follow-up (2026-07-06, later the same day): the quiet link
 *   hid the control the MEDIAN family needs (P2 has three kids;
 *   reconciliation C7 requires multi-child lanes). Promoted to the design
 *   system's secondary pill (sage outline) and placed ABOVE the primary
 *   so the card reads in task order: fill in a kid, add the rest, start.
 *   The clay button stays the view's only primary action, and its label
 *   pluralizes once two or more kids are in play.
 * - The age range (2 to 16) is stated up front instead of surprising
 *   parents after they add an out-of-range kid.
 * - Founder follow-up (2026-07-06, later still): the birthday caption
 *   packed the reason (age-fitting) and the range disclosure into one
 *   sentence and read like a form justifying itself. Simplified to just
 *   the reason; the range surfaces instead at the moment it matters, in
 *   the out-of-range confirmation card below the form.
 *
 * Caught in the same review's follow-up (2026-07-06): right above this
 * form, the greeting addresses HER by name ("Nice to meet you, Sidney.").
 * A parent skimming past the subhead could land on a bare "Name or
 * nickname" field and re-enter her own name instead of her kid's. Fixed
 * with an explicit "your child's" label.
 *
 * Second follow-up, same day ("I hate this, the whole two-line structure
 * doesn't work"): "Nice to meet you, Sidney." as its own headline, THEN a
 * separate "Now, add your kids." sentence to actually get to the task,
 * was two disconnected beats, small talk, then a command. Collapsed into
 * one direct headline that's personalized AND the task in a single
 * breath: "Add your kids, Sidney."
 *
 * Third follow-up ("do we say kid too much?"): headline, subhead, and the
 * add-another button all said "kid" in the same glance. Subhead said
 * "each one" instead of "each kid", and the button read "+ Add a
 * sibling" to break the repetition.
 *
 * Fourth follow-up ("remove that line, make the header friendlier"): the
 * subhead's whole job, "a nickname is fine", was already said by the
 * field label itself ("...name or nickname"), so it was pure repetition
 * once you actually looked at the form. Cut it, and softened the
 * headline from a bare command ("Add your kids") to an invitation
 * ("Let's add your kids").
 *
 * Fifth follow-up: the "or nickname" and "why we need it" asides read as
 * equally important as the actual labels in bold prose. Demoted both to
 * parenthetical, regular-weight asides right on the label line, one line
 * saved on Birthday.
 *
 * Sixth follow-up ("doesn't tell me why I need their birthday"): "(for
 * their exact age)" restated what birthday already is, an age, not why
 * it's asked for. "(so questions match their age)" names the actual
 * reason, the questionnaire adapts to age.
 */

interface AddedKid {
  name: string;
  inRange: boolean;
}

const YEAR_SPAN = 17;

export function KidsStep({
  existingCount,
  welcomeBack,
  greetName,
  onDone,
}: {
  existingCount: number;
  welcomeBack: boolean;
  /** Set only when she just introduced herself on the previous screen. */
  greetName?: string | null;
  onDone: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [added, setAdded] = useState<AddedKid[]>([]);
  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const monthRef = useRef<HTMLInputElement | null>(null);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);

  const totalKids = existingCount + added.length;
  const formStarted = name.trim().length > 0 || month !== "" || day !== "" || year !== "";
  const trimmedName = name.trim();

  /** Null when valid, otherwise the friendly pointer to what's missing. */
  function validateForm(): string | null {
    if (!trimmedName) return "Add their name (a nickname is fine) and we're off.";
    if (month === "" || day === "" || year === "") {
      return `Add ${trimmedName}'s full birthday and we're off.`;
    }
    const fullYear = Number(year);
    if (year.length !== 4 || Number.isNaN(fullYear)) {
      return "Write the birth year with all four digits, like 2021.";
    }
    if (fullYear > currentYear || fullYear < currentYear - YEAR_SPAN + 1) {
      return "Homa covers ages 0 to 16 for now, mind checking the year?";
    }
    const birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (!isValidBirthDate(birthDate)) {
      return "That date doesn't look quite right, mind checking it?";
    }
    return null;
  }

  async function addKid(): Promise<boolean> {
    const problem = validateForm();
    if (problem) {
      setError(problem);
      return false;
    }
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      const response = await fetch("/api/map/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, birthDate }),
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
      setAdded((current) => [...current, { name: trimmedName, inRange: Boolean(data.inRange) }]);
      setName("");
      setMonth("");
      setDay("");
      setYear("");
      setBusy(false);
      return true;
    } catch {
      setError("Couldn't reach us just now. Nothing you typed is lost, try again.");
      setBusy(false);
      return false;
    }
  }

  async function addAnotherKid() {
    const ok = await addKid();
    if (ok) nameRef.current?.focus();
  }

  async function startChecklist() {
    if (formStarted) {
      const ok = await addKid();
      if (!ok) return;
      onDone();
      return;
    }
    if (totalKids > 0) {
      onDone();
    } else {
      setError("Add at least one kid and we're off.");
      nameRef.current?.focus();
    }
  }

  /** Digits only, capped, with focus moving on once a field is full. */
  function handleDatePart(
    raw: string,
    maxLength: number,
    set: (value: string) => void,
    nextField: React.RefObject<HTMLInputElement | null> | null,
  ) {
    const digits = raw.replace(/\D/g, "").slice(0, maxLength);
    set(digits);
    if (digits.length === maxLength) nextField?.current?.focus();
  }

  const effectiveKidCount = totalKids + (trimmedName ? 1 : 0);
  /** Only name-drops the one kid actively being typed in, right now, in
   * this form. Naming an already-saved kid here read as arbitrary and
   * confusing right after "+ Add a sibling" (caught in review,
   * 2026-07-06): she clicks it meaning "let me add another", and a button
   * that suddenly says "Start Story's questionnaire" (the kid she just
   * saved, not the one she's about to type) reads like the flow forgot
   * her sibling was mid-add. Generic phrasing once the form is empty
   * again is the honest state: "not sure yet who's next, still your
   * call". */
  const startLabel =
    effectiveKidCount > 1
      ? "Start the questionnaires"
      : trimmedName
        ? `Start ${trimmedName}'s questionnaire`
        : "Start the questionnaire";

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        {greetName ? `Let's add your kids, ${greetName}.` : "Let's add your kids"}
      </h1>
      {!greetName && welcomeBack ? <p className="mt-3 text-body">Welcome back.</p> : null}

      {added.map((kid) => (
        <div
          key={`${kid.name}-added`}
          className={`mt-4 rounded-lg border p-4 ${kid.inRange ? "border-border-subtle bg-card" : "border-sage/40 bg-[var(--accent-sage-soft)]"}`}
        >
          {kid.inRange ? (
            <p className="text-body">
              <span className="font-semibold text-strong">{kid.name}</span> is saved and ready for
              the questionnaire.
            </p>
          ) : (
            <p className="text-body">
              <span className="font-semibold text-strong">{kid.name}</span> is saved. The questionnaire starts
              at age 2, and I&apos;ll email you the moment {kid.name}&apos;s is ready.
            </p>
          )}
        </div>
      ))}

      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        {/* Explicitly "your child's", not just "name": she was addressed
            by her own name one line up ("Nice to meet you, Sidney."), a
            skimmer landing straight on this field could otherwise re-enter
            her own name here instead of her kid's (caught in review,
            2026-07-06). */}
        <label className="block font-medium text-strong" htmlFor="kid-name">
          Your child&apos;s name <span className="font-normal text-muted">(or nickname)</span>
        </label>
        <input
          id="kid-name"
          ref={nameRef}
          type="text"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Maya"
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />

        <p className="mt-4 font-medium text-strong">
          Birthday <span className="font-normal text-muted">(so questions match their age)</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={monthRef}
            aria-label="Birth month"
            type="text"
            inputMode="numeric"
            placeholder="MM"
            value={month}
            onChange={(event) => handleDatePart(event.target.value, 2, setMonth, dayRef)}
            className="w-[4.5rem] rounded-md border border-border px-3 py-3 text-center text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span aria-hidden="true" className="text-subtle">
            /
          </span>
          <input
            ref={dayRef}
            aria-label="Birth day"
            type="text"
            inputMode="numeric"
            placeholder="DD"
            value={day}
            onChange={(event) => handleDatePart(event.target.value, 2, setDay, yearRef)}
            className="w-[4.5rem] rounded-md border border-border px-3 py-3 text-center text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span aria-hidden="true" className="text-subtle">
            /
          </span>
          <input
            ref={yearRef}
            aria-label="Birth year"
            type="text"
            inputMode="numeric"
            placeholder="YYYY"
            value={year}
            onChange={(event) => handleDatePart(event.target.value, 4, setYear, null)}
            className="w-[5.5rem] rounded-md border border-border px-3 py-3 text-center text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {totalKids < MAP_KID_CAP - 1 ? (
            <button
              type="button"
              onClick={() => void addAnotherKid()}
              disabled={busy}
              className="min-h-12 w-full rounded-pill border-[1.5px] border-[var(--sage-300)] bg-transparent px-6 py-3 text-base font-semibold text-[var(--sage-700)] transition duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] motion-safe:active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              + Add a sibling
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void startChecklist()}
            disabled={busy}
            className="min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
          >
            {busy ? "Saving\u2026" : startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
