"use client";

import { useMemo, useState } from "react";

import { HOURS_SUBJECTS, type HoursSubject } from "../../../lib/hours-model";
import {
  computeChildTotals,
  formatMinutesAsHours,
  filterEntries,
  groupEntriesByDay,
  SOURCE_LABELS,
  SUBJECT_LABELS,
  subjectOptions,
  type ChildHoursTotals,
  type HoursEntry,
  type HoursFilter,
} from "../../../lib/hours-view";
import { KidAvatar } from "../../../components/dashboard/kid-avatar";
import { HoursEntryOverlay } from "./hours-entry-overlay";

/**
 * The Hours page (CG-02, issue #174): a per-day log of every school-time
 * block Homa has heard about, editable in place, with running totals
 * per child. Same filter-chip and grouped-list shape as the Binder and
 * Tasks History, so the surface feels like the rest of /app rather than
 * a one-off. Voice law: totals render plainly, no red "behind" state,
 * because there is nothing to compare against yet (state minimums are
 * a follow-up, issue #174's deferral #1).
 */

const CHIP_ON =
  "min-h-9 rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]";
const CHIP_OFF =
  "min-h-9 rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:border-[var(--clay-200)]";

const SUBJECT_TONES: ReadonlyArray<readonly [string, string]> = [
  ["var(--clay-50)", "var(--clay-700)"],
  ["var(--sage-50)", "var(--sage-700)"],
  ["var(--gold-100)", "var(--gold-ink)"],
  ["var(--sky-100)", "var(--sky-600)"],
];

function subjectTone(subject: HoursSubject): readonly [string, string] {
  const index = Math.max(0, HOURS_SUBJECTS.indexOf(subject));
  return SUBJECT_TONES[index % SUBJECT_TONES.length];
}

/** A signed-in family's kid roster, the same slice PlannerKid reads, for
 * avatar tone and photo lookups by position in the FULL family list. */
export interface HoursKid {
  id: string;
  name: string;
  avatar_url: string | null;
}

function TotalsCard({
  total,
  kidIndex,
  avatarUrl,
}: {
  total: ChildHoursTotals;
  kidIndex: number;
  avatarUrl: string | null;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <KidAvatar name={total.childName} index={kidIndex} avatarUrl={avatarUrl} size={28} />
        <span className="font-display text-base font-semibold text-strong">{total.childName}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-subtle">This week</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold text-strong">
            {formatMinutesAsHours(total.week)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-subtle">This month</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold text-strong">
            {formatMinutesAsHours(total.month)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-subtle">School year</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold text-strong">
            {formatMinutesAsHours(total.schoolYear)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function EntryRow({
  entry,
  showChild,
  onEdit,
}: {
  entry: HoursEntry;
  showChild: boolean;
  onEdit: () => void;
}) {
  const [bg, ink] = subjectTone(entry.subject);
  return (
    <li className="flex flex-wrap items-center gap-2.5 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm">
      <span
        className="rounded-pill px-2.5 py-1 text-[0.68rem] font-bold"
        style={{ background: bg, color: ink }}
      >
        {SUBJECT_LABELS[entry.subject]}
      </span>
      <span className="font-display text-sm font-semibold text-strong">
        {formatMinutesAsHours(entry.minutes)}
      </span>
      {showChild ? (
        <span className="text-xs font-semibold text-subtle">
          {entry.childName ?? "Whole family"}
        </span>
      ) : null}
      {entry.note ? (
        <span className="min-w-0 flex-1 basis-40 truncate text-xs text-muted">{entry.note}</span>
      ) : (
        <span className="flex-1" />
      )}
      <span className="rounded-pill border border-border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-subtle">
        {SOURCE_LABELS[entry.source]}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-semibold text-brand hover:underline"
      >
        Edit
      </button>
    </li>
  );
}

export function HoursView({
  kids,
  entries,
  focusChildId,
  timeZone,
  now,
}: {
  /** The FULL family roster, always: avatar tones key off each kid's
   * position here so a kid keeps their color even when the context
   * switcher narrows the page to just them (same rule as PlannerView). */
  kids: HoursKid[];
  /** Already scoped to the view context (page.tsx's job): the whole
   * family's blocks, or one kid's own blocks plus anything family-wide. */
  entries: HoursEntry[];
  /** One kid selected in the context switcher, or null for everyone. */
  focusChildId: string | null;
  timeZone: string;
  /** Server-supplied, same reasoning as the Binder and Planner: keeps
   * render pure and testable. */
  now: Date;
}) {
  const [filter, setFilter] = useState<HoursFilter>({ subject: null });
  const [editingId, setEditingId] = useState<string | null>(null);

  const focusKid = focusChildId ? kids.find((kid) => kid.id === focusChildId) ?? null : null;

  const subjects = useMemo(() => subjectOptions(entries), [entries]);
  const filtered = useMemo(() => filterEntries(entries, filter), [entries, filter]);
  const groups = useMemo(
    () => groupEntriesByDay(filtered, timeZone, now),
    [filtered, timeZone, now],
  );
  const totals = useMemo(
    () => computeChildTotals(filtered, focusKid ? [focusKid] : kids, now, timeZone),
    [filtered, focusKid, kids, now, timeZone],
  );
  const editing = entries.find((entry) => entry.id === editingId) ?? null;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            The compliance record
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            Hours
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            {focusKid
              ? `Every school-time block logged for ${focusKid.name}, plus anything for the whole family.`
              : "Every school-time block Homa has heard about, by day."}
          </p>
        </div>
      </header>

      {totals.length > 0 ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {totals.map((total) => {
            const kidIndex = kids.findIndex((kid) => kid.id === total.childId);
            const kid = kids[kidIndex];
            return (
              <TotalsCard
                key={total.childId}
                total={total}
                kidIndex={Math.max(0, kidIndex)}
                avatarUrl={kid?.avatar_url ?? null}
              />
            );
          })}
        </section>
      ) : null}

      {subjects.length > 1 ? (
        <div
          className="mt-6 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by subject"
        >
          <span className="mr-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Subject
          </span>
          <button
            type="button"
            aria-pressed={filter.subject === null}
            onClick={() => setFilter({ subject: null })}
            className={filter.subject === null ? CHIP_ON : CHIP_OFF}
          >
            All
          </button>
          {subjects.map((subject) => (
            <button
              key={subject}
              type="button"
              aria-pressed={filter.subject === subject}
              onClick={() => setFilter({ subject })}
              className={filter.subject === subject ? CHIP_ON : CHIP_OFF}
            >
              {SUBJECT_LABELS[subject]}
            </button>
          ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-dashed border-border bg-card p-8 text-center">
          <p className="font-display text-lg font-semibold text-strong">Nothing logged yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            {"Homa logs school time the moment it comes up, on chat, text, or a call. Mention a block (\"we did 45 minutes of math\") and it lands here on its own."}
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
          {filter.subject
            ? `Nothing logged for ${SUBJECT_LABELS[filter.subject].toLowerCase()} yet.`
            : "Nothing logged yet."}
        </p>
      ) : (
        <div className="mt-7 flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
                  {group.label}
                </h2>
                <span className="text-xs font-semibold text-muted">
                  {formatMinutesAsHours(group.totalMinutes)}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    showChild={kids.length > 1}
                    onEdit={() => setEditingId(entry.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing ? (
        <HoursEntryOverlay entry={editing} onClose={() => setEditingId(null)} />
      ) : null}
    </>
  );
}
