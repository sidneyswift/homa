"use client";

/**
 * The month / day / year selects both kid forms share (add and edit),
 * so the two always ask for the birthday the same way. Full date per
 * founder ruling 2026-07-11 ("get the full data so we know how old the
 * kid is"); the server action validates it as a real calendar date.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const selectClass =
  "mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-3 text-base text-[var(--homa-ink)] focus:border-[var(--homa-visual-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30";

/** "2019-03-14" from the children row, split for the three selects. */
function parseIsoDate(value: string | undefined): {
  year: number | null;
  month: number | null;
  day: number | null;
} {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return { year: null, month: null, day: null };
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function BirthdayFields({
  idPrefix,
  defaultDate,
}: {
  /** Unique per form instance so labels stay wired to their selects. */
  idPrefix: string;
  /** ISO date to preselect (the edit form); omit for the add form. */
  defaultDate?: string;
}) {
  const { year, month, day } = parseIsoDate(defaultDate);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 19 }, (_, i) => currentYear - i);

  return (
    <div className="mt-4 grid grid-cols-[1.4fr_1fr_1.1fr] gap-2.5">
      <div>
        <label className="block text-sm font-medium text-[var(--homa-ink)]" htmlFor={`${idPrefix}-month`}>
          Birth month
        </label>
        <select
          id={`${idPrefix}-month`}
          name="birth_month"
          required
          defaultValue={month ?? ""}
          className={selectClass}
        >
          <option value="" disabled>Month</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>{name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--homa-ink)]" htmlFor={`${idPrefix}-day`}>
          Day
        </label>
        <select
          id={`${idPrefix}-day`}
          name="birth_day"
          required
          defaultValue={day ?? ""}
          className={selectClass}
        >
          <option value="" disabled>Day</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--homa-ink)]" htmlFor={`${idPrefix}-year`}>
          Year
        </label>
        <select
          id={`${idPrefix}-year`}
          name="birth_year"
          required
          defaultValue={year ?? ""}
          className={selectClass}
        >
          <option value="" disabled>Year</option>
          {years.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
