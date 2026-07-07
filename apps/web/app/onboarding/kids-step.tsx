"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

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
 *
 * Seventh follow-up (2026-07-07, new standing rule: "only ever 1 input
 * per onboarding moment"): name and birthday were two competing fields
 * on one screen. Split into two moments, name then birthday, sharing
 * one card; "+ Add a sibling" and the primary start button (actions,
 * not inputs) moved to the birthday moment since that's where a kid's
 * entry is actually complete. The birthday moment gets a quiet "Edit
 * name" link back, and the name moment gets a secondary "start" button
 * of its own, but only once at least one kid is already saved and the
 * name field is empty, so stopping without adding another kid never
 * requires typing anything.
 *
 * Eighth follow-up (2026-07-07, "the card should feel dynamic, watch it
 * fill up"): saved kids used to render as their own separate bordered
 * cards stacked above a second bordered card for the active entry, two
 * card shapes doing one job. Merged into a single card: saved kids are
 * quiet checkmarked rows at the top, the active name/birthday moment
 * continues in the same container below a hairline divider, so the one
 * card visibly grows as she adds each kid instead of a new card
 * appearing every time.
 *
 * Ninth follow-up (2026-07-07, "put name and birthday on the same line
 * so it feels like adding 1 input"): the two-moment split from the
 * seventh follow-up satisfied the letter of "1 input per moment" but
 * cost an extra tap and a full step transition for something this
 * quick. Recombined onto one line instead: name and birthday sit
 * side by side in a single row under one label, read together as one
 * continuous act of filling in a kid rather than two competing form
 * fields stacked vertically. Headline simplified to "Hey {name}, let's
 * get started" (dropping "kids" plural): with everything on one line
 * now, there's no separate moment left for a plural headline to earn
 * its keep, and the multi-kid flexibility still reveals itself the
 * moment the first kid is saved, via "+ Add a sibling".
 *
 * Tenth follow-up (2026-07-07, "make add sibling more subtle, birthday
 * looks bulky"): the three date parts each carried their own border and
 * padding, three boxes doing the job of one field. Now one bordered
 * shell holds all three parts and the slashes between them. "+ Add a
 * sibling" lost its border and full width, an auto-width, border-free
 * button, deliberately stopping short of the bare text link the
 * 2026-07-06 review already ruled out (P2's three kids need this
 * control to stay a real, findable tap target, just a quiet one).
 *
 * Eleventh follow-up (2026-07-07, "some users want to add siblings
 * before naming each one"): "+ Add a sibling" used to require the
 * active row to be valid before it would save-and-clear it, so an
 * empty click just re-surfaced the same blank row. Reworked into a
 * list of draft rows instead of one active row: the button now always
 * appends a fresh blank row, no validation, so she can stack up "I
 * have three kids" worth of rows first and fill in names and
 * birthdays after, in any order. Saving happens once, in a batch, when
 * she starts the questionnaire(s); untouched rows are silently
 * ignored, and any row with SOME but not all of its fields filled in
 * blocks starting with its own inline error, so a half-entered kid is
 * never silently dropped.
 */

interface AddedKid {
  name: string;
  inRange: boolean;
}

interface DraftKid {
  name: string;
  month: string;
  day: string;
  year: string;
}

function emptyDraft(): DraftKid {
  return { name: "", month: "", day: "", year: "" };
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
  const [drafts, setDrafts] = useState<DraftKid[]>([emptyDraft()]);
  /** Per-row inline errors, keyed by the row's index in `drafts`. */
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  /** Whole-form errors that aren't about any one row: no kid at all, the
   * five-kid cap, or a failed save. */
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRefs = useRef<Array<HTMLInputElement | null>>([]);
  const monthRefs = useRef<Array<HTMLInputElement | null>>([]);
  const dayRefs = useRef<Array<HTMLInputElement | null>>([]);
  const yearRefs = useRef<Array<HTMLInputElement | null>>([]);

  const totalKids = existingCount + added.length;

  function draftIsBlank(draft: DraftKid): boolean {
    return draft.name.trim() === "" && draft.month === "" && draft.day === "" && draft.year === "";
  }
  const nonBlankDrafts = drafts.filter((draft) => !draftIsBlank(draft));
  const totalSlots = totalKids + drafts.length;
  const canAddMore = totalSlots < MAP_KID_CAP;

  // A newly appended row should take focus itself, the same way the
  // first row does on mount, so stacking up several blank rows in a row
  // never requires a click to find the next one.
  useEffect(() => {
    if (drafts.length > 1) nameRefs.current[drafts.length - 1]?.focus();
  }, [drafts.length]);

  function updateDraft(index: number, patch: Partial<DraftKid>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  /** Always appends a blank row, no validation: stacking up "I have
   * three kids" worth of empty rows before naming any of them is the
   * whole point (2026-07-07 follow-up). */
  function addSiblingRow() {
    if (!canAddMore) return;
    setDrafts((current) => [...current, emptyDraft()]);
  }

  function removeDraftRow(index: number) {
    setDrafts((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptyDraft()];
    });
    setRowErrors((current) => {
      const next: Record<number, string> = {};
      for (const [key, message] of Object.entries(current)) {
        const i = Number(key);
        if (i < index) next[i] = message;
        else if (i > index) next[i - 1] = message;
      }
      return next;
    });
  }

  /** Null when valid, otherwise the friendly pointer to what's missing. */
  function validateDraft(draft: DraftKid): string | null {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return "Add their name (a nickname is fine) and we're off.";
    if (draft.month === "" || draft.day === "" || draft.year === "") {
      return `Add ${trimmedName}'s full birthday and we're off.`;
    }
    const fullYear = Number(draft.year);
    if (draft.year.length !== 4 || Number.isNaN(fullYear)) {
      return "Write the birth year with all four digits, like 2021.";
    }
    if (fullYear > currentYear || fullYear < currentYear - YEAR_SPAN + 1) {
      return "Homa covers ages 0 to 16 for now, mind checking the year?";
    }
    const birthDate = `${draft.year}-${draft.month.padStart(2, "0")}-${draft.day.padStart(2, "0")}`;
    if (!isValidBirthDate(birthDate)) {
      return "That date doesn't look quite right, mind checking it?";
    }
    return null;
  }

  async function saveDraft(draft: DraftKid): Promise<{ ok: boolean; inRange?: boolean; reason?: string }> {
    const birthDate = `${draft.year}-${draft.month.padStart(2, "0")}-${draft.day.padStart(2, "0")}`;
    const response = await fetch("/api/map/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name.trim(), birthDate }),
    });
    return (await response.json()) as { ok: boolean; inRange?: boolean; reason?: string };
  }

  /** One save at the end for every row she actually filled in: rows
   * left completely blank (leftover "+ Add a sibling" slots) are
   * ignored rather than nagged about, but a row with SOME fields set
   * blocks starting until it's either finished or removed. */
  async function startChecklist() {
    setFormError(null);
    const rowsToSave = drafts
      .map((draft, index) => ({ draft, index }))
      .filter(({ draft }) => !draftIsBlank(draft));

    const nextRowErrors: Record<number, string> = {};
    for (const { draft, index } of rowsToSave) {
      const problem = validateDraft(draft);
      if (problem) nextRowErrors[index] = problem;
    }
    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      const firstBadIndex = Number(Object.keys(nextRowErrors)[0]);
      nameRefs.current[firstBadIndex]?.focus();
      return;
    }
    setRowErrors({});

    if (rowsToSave.length === 0) {
      if (totalKids > 0) {
        onDone();
      } else {
        setFormError("Add at least one kid and we're off.");
        nameRefs.current[0]?.focus();
      }
      return;
    }

    setBusy(true);
    const newlyAdded: AddedKid[] = [];
    for (const { draft } of rowsToSave) {
      try {
        const data = await saveDraft(draft);
        if (!data.ok) {
          if (newlyAdded.length > 0) setAdded((current) => [...current, ...newlyAdded]);
          setFormError(
            data.reason === "kid-cap"
              ? "Five kids is the most one session holds. Everyone you added is saved."
              : "That didn't save. One more try usually does it.",
          );
          setBusy(false);
          return;
        }
        newlyAdded.push({ name: draft.name.trim(), inRange: Boolean(data.inRange) });
      } catch {
        if (newlyAdded.length > 0) setAdded((current) => [...current, ...newlyAdded]);
        setFormError("Couldn't reach us just now. Nothing you typed is lost, try again.");
        setBusy(false);
        return;
      }
    }
    setAdded((current) => [...current, ...newlyAdded]);
    setDrafts([emptyDraft()]);
    setBusy(false);
    onDone();
  }

  /** Digits only, capped, with focus moving on once a field is full. */
  function handleDatePart(
    raw: string,
    maxLength: number,
    index: number,
    field: "month" | "day" | "year",
    nextField: HTMLInputElement | null,
  ) {
    const digits = raw.replace(/\D/g, "").slice(0, maxLength);
    updateDraft(index, { [field]: digits });
    if (digits.length === maxLength) nextField?.focus();
  }

  /** Only name-drops when exactly one kid, across everything filled in
   * right now, would start: naming an already-saved kid here read as
   * arbitrary and confusing right after "+ Add a sibling" (caught in
   * review, 2026-07-06). Generic phrasing once nothing is typed is the
   * honest state: "not sure yet who's next, still your call". */
  const soloDraftName = nonBlankDrafts.length === 1 ? nonBlankDrafts[0].name.trim() : null;
  const effectiveKidCount = totalKids + nonBlankDrafts.length;
  const startLabel =
    effectiveKidCount > 1
      ? "Start the questionnaires"
      : soloDraftName
        ? `Start ${soloDraftName}'s questionnaire`
        : "Start the questionnaire";

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        {greetName ? `Hey ${greetName}, let's get started.` : "Let's get started."}
      </h1>
      {!greetName && welcomeBack ? <p className="mt-3 text-body">Welcome back.</p> : null}

      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        {/* One card, growing: each saved kid lands as a quiet row here
            instead of spawning a new card, so the same container visibly
            fills up as she adds each one. */}
        {added.length > 0 ? (
          <div className="mb-6 flex flex-col gap-4 border-b border-border-subtle pb-6">
            {added.map((kid) => (
              <div key={`${kid.name}-added`} className="flex items-start gap-3">
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
                    questionnaire starts at age 2, and I&apos;ll email you the moment{" "}
                    {kid.name}&apos;s is ready.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Name and birthday read as one line, one act of "adding a kid",
            instead of two competing fields stacked vertically. One label
            covers every row: the first row's placeholder and format
            already teach the pattern for any row added after it. */}
        <label className="block font-medium text-strong" htmlFor="kid-name-0">
          Your child&apos;s name and birthday{" "}
          <span className="font-normal text-muted">(so questions match their age)</span>
        </label>
        <div className="mt-2 flex flex-col gap-3">
          {drafts.map((draft, index) => (
            <div key={index}>
              {/* Stacked on narrow phones, side by side from `sm` up:
                  `flex-wrap` used to let the birthday shell drop onto its
                  own line unpredictably around 375px wide, stranding the
                  remove button next to a date with no name in sight
                  (caught testing mobile, 2026-07-07). Below `sm`, the name
                  gets its own full-width row, and the date shell plus
                  remove button are grouped together on the row after, so
                  a wrap is always an intentional layout, never an
                  accident. */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* Explicitly "your child's" up in the label, not just
                    "name": she was addressed by her own name one line up
                    ("Nice to meet you, Sidney."), a skimmer landing
                    straight on this field could otherwise re-enter her
                    own name here instead of her kid's (caught in review,
                    2026-07-06). */}
                <input
                  id={index === 0 ? "kid-name-0" : undefined}
                  ref={(el) => {
                    nameRefs.current[index] = el;
                  }}
                  type="text"
                  autoFocus={index === 0}
                  value={draft.name}
                  onChange={(event) => updateDraft(index, { name: event.target.value })}
                  placeholder="Maya"
                  className="w-full rounded-md border border-border px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 sm:min-w-[8rem] sm:flex-1"
                />
                <div className="flex items-center gap-2">
                  {/* One bordered shell for all three date parts, not
                      three: three separate boxes each carrying their own
                      border and padding read as bulky, especially next
                      to the single-bordered name field beside them. The
                      slashes live inside the same shell, so the whole
                      date reads as one compact control. */}
                  <div className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-3 transition-colors duration-(--dur-fast) ease-out focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
                    <input
                      ref={(el) => {
                        monthRefs.current[index] = el;
                      }}
                      aria-label="Birth month"
                      type="text"
                      inputMode="numeric"
                      placeholder="MM"
                      value={draft.month}
                      onChange={(event) =>
                        handleDatePart(event.target.value, 2, index, "month", dayRefs.current[index])
                      }
                      className="w-6 border-none bg-transparent text-center text-base text-strong focus:outline-none"
                    />
                    <span aria-hidden="true" className="text-subtle">
                      /
                    </span>
                    <input
                      ref={(el) => {
                        dayRefs.current[index] = el;
                      }}
                      aria-label="Birth day"
                      type="text"
                      inputMode="numeric"
                      placeholder="DD"
                      value={draft.day}
                      onChange={(event) =>
                        handleDatePart(event.target.value, 2, index, "day", yearRefs.current[index])
                      }
                      className="w-6 border-none bg-transparent text-center text-base text-strong focus:outline-none"
                    />
                    <span aria-hidden="true" className="text-subtle">
                      /
                    </span>
                    <input
                      ref={(el) => {
                        yearRefs.current[index] = el;
                      }}
                      aria-label="Birth year"
                      type="text"
                      inputMode="numeric"
                      placeholder="YYYY"
                      value={draft.year}
                      onChange={(event) => handleDatePart(event.target.value, 4, index, "year", null)}
                      className="w-10 border-none bg-transparent text-center text-base text-strong focus:outline-none"
                    />
                  </div>
                  {/* Only once there's more than one row: a lone row has
                      nothing to remove it back to. */}
                  {drafts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeDraftRow(index)}
                      aria-label={draft.name.trim() ? `Remove ${draft.name.trim()}` : "Remove this row"}
                      className="shrink-0 rounded-full p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] hover:text-strong"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
              {rowErrors[index] ? (
                <p className="mt-2 text-sm text-danger" role="alert">
                  {rowErrors[index]}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {formError ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {canAddMore ? (
            /* A real button (not a bare text link: a quiet link once hid
               this control from the median 3-kid family, caught 2026-07-06),
               but visually light, auto-width and border-free, so it never
               competes with the primary button's weight. Always just
               appends a blank row, no validation: some families want to
               stack up every kid's row before naming any of them. */
            <button
              type="button"
              onClick={addSiblingRow}
              disabled={busy}
              className="self-start rounded-pill px-3 py-2 text-sm font-semibold text-[var(--sage-700)] transition duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] disabled:opacity-50"
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
