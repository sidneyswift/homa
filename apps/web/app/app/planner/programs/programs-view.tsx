"use client";

import { useCallback, useEffect, useState } from "react";
import { QuietAction } from "../../../../components/design/QuietAction";
import { HOURS_SUBJECTS } from "../../../../lib/hours-model";
import { SUBJECT_LABELS } from "../../../../lib/hours-view";
import {
  classMinutes,
  programDraftSchema,
  type ProgramCatalog,
  type ProgramClass,
  type ProgramDraft,
  type ProgramOccurrence,
} from "../../../../lib/learning-programs";

const FIELD =
  "min-h-11 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm text-[color:var(--homa-ink)]";
function readableDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
type Child = { id: string; name: string };
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function newClass(): ProgramClass {
  return {
    id: crypto.randomUUID(),
    title: "",
    subject: "science",
    childIds: [],
    weekday: 1,
    startTime: null,
    endTime: null,
    plannedMinutes: null,
    category: null,
  };
}
async function change(action: string, input: unknown) {
  const response = await fetch("/api/learning-programs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "The change could not be confirmed.");
  return result;
}
async function fetchCatalog(
  from: string,
  through: string,
  signal?: AbortSignal,
): Promise<ProgramCatalog> {
  const response = await fetch(
    `/api/learning-programs?${new URLSearchParams({ from, through })}`,
    { signal, cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Programs could not load. Try again.");
  return data;
}
function ClassEditor({
  row,
  childrenList,
  onChange,
  onRemove,
}: {
  row: ProgramClass;
  childrenList: Child[];
  onChange: (row: ProgramClass) => void;
  onRemove: () => void;
}) {
  const field = (patch: Partial<ProgramClass>) =>
    onChange({ ...row, ...patch });
  return (
    <fieldset className="space-y-3 border-t border-[var(--homa-control-boundary)] py-4">
      <legend className="pt-3 font-semibold">{row.title || "New class"}</legend>
      <label className="block text-sm">
        Class name
        <input
          className={FIELD}
          value={row.title}
          required
          maxLength={300}
          onChange={(e) => field({ title: e.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Subject
          <select
            className={FIELD}
            value={row.subject}
            onChange={(e) =>
              field({ subject: e.target.value as ProgramClass["subject"] })
            }
          >
            {HOURS_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {SUBJECT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Day
          <select
            className={FIELD}
            value={row.weekday}
            onChange={(e) => field({ weekday: Number(e.target.value) })}
          >
            {DAYS.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm">Who attends?</legend>
        <div className="flex flex-wrap gap-3">
          {childrenList.map((child) => (
            <label
              key={child.id}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={row.childIds.includes(child.id)}
                onChange={(e) =>
                  field({
                    childIds: e.target.checked
                      ? [...row.childIds, child.id]
                      : row.childIds.filter((id) => id !== child.id),
                  })
                }
              />
              {child.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Starts
          <input
            type="time"
            className={FIELD}
            value={row.startTime ?? ""}
            onChange={(e) =>
              field({ startTime: e.target.value || null, plannedMinutes: null })
            }
          />
        </label>
        <label className="text-sm">
          Ends
          <input
            type="time"
            className={FIELD}
            value={row.endTime ?? ""}
            onChange={(e) =>
              field({ endTime: e.target.value || null, plannedMinutes: null })
            }
          />
        </label>
        <label className="text-sm">
          Minutes if no start/end time
          <input
            type="number"
            className={FIELD}
            min={1}
            max={600}
            disabled={Boolean(row.startTime || row.endTime)}
            value={row.plannedMinutes ?? ""}
            onChange={(e) =>
              field({
                plannedMinutes: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
      </div>
      <label className="block text-sm">
        Category within this subject (optional)
        <input
          className={FIELD}
          maxLength={40}
          value={row.category ?? ""}
          onChange={(e) => field({ category: e.target.value || null })}
        />
      </label>
      <QuietAction kind="quiet" onClick={onRemove}>
        Remove class from schedule
      </QuietAction>
    </fieldset>
  );
}
function OccurrenceRow({
  row,
  childName,
  busy,
  onRecord,
  onCancel,
}: {
  row: ProgramOccurrence;
  childName: string;
  busy: boolean;
  onRecord: (minutes: number) => void;
  onCancel: () => void;
}) {
  const [minutes, setMinutes] = useState(
    row.minutes === null ? "" : String(row.minutes),
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <li className="space-y-2 border-t border-[var(--homa-control-boundary)] py-4">
      <p className="font-semibold">
        {row.title ?? "Removed class"} · {childName}
      </p>
      <p className="text-sm">
        {readableDate(row.date)} ·{" "}
        {row.subject
          ? SUBJECT_LABELS[row.subject as keyof typeof SUBJECT_LABELS]
          : ""}{" "}
        · {row.programName}
      </p>
      <p className="text-sm">
        {row.status === "removed"
          ? "Removed. Reusing the schedule will not add it again."
          : row.minutes !== null
            ? `${row.minutes} minutes recorded`
            : row.status === "completed"
              ? "Marked completed in Planner; add minutes here if you want them recorded"
              : "Planned, no time recorded"}
      </p>
      {row.activityId && (
        <>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onRecord(Number(minutes));
            }}
          >
            <label className="text-sm">
              Actual minutes
              <input
                type="number"
                className={FIELD}
                min={1}
                max={600}
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={busy}
              />
            </label>
            <QuietAction type="submit" disabled={busy}>
              {row.minutes === null
                ? "Record attendance and time"
                : "Save corrected time"}
            </QuietAction>
            {row.plannedMinutes !== null && (
              <QuietAction
                kind="quiet"
                disabled={busy}
                onClick={() => setMinutes(String(row.plannedMinutes))}
              >
                Fill in {row.plannedMinutes} scheduled minutes
              </QuietAction>
            )}
          </form>
          <p className="text-sm">
            Recording confirms this child attended for the time entered.
          </p>
          {confirmCancel ? (
            <div className="space-y-2">
              <p className="text-sm">
                Remove this class and its recorded time for {childName}? Other
                children and home learning stay as they are.
              </p>
              <div className="flex gap-2">
                <QuietAction
                  kind="secondary"
                  disabled={busy}
                  onClick={onCancel}
                >
                  Remove this class
                </QuietAction>
                <QuietAction
                  kind="quiet"
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep it
                </QuietAction>
              </div>
            </div>
          ) : (
            <QuietAction
              kind="quiet"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              Remove this dated class
            </QuietAction>
          )}
        </>
      )}
    </li>
  );
}
export function ProgramsView({ childrenList }: { childrenList: Child[] }) {
  const [from, setFrom] = useState(today);
  const [through, setThrough] = useState(today);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [skipDate, setSkipDate] = useState("");
  const [catalog, setCatalog] = useState<ProgramCatalog | null>(null);
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [selected, setSelected] = useState("");
  const [child, setChild] = useState("");
  const [group, setGroup] = useState<"program" | "subject">("program");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [scheduleOpen,setScheduleOpen]=useState(false);
  const load = useCallback(async () => {
    setCatalog(await fetchCatalog(from, through));
    setError(null);
  }, [from, through]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchCatalog(from, through, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setCatalog(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e.message));
      });
    return () => controller.abort();
  }, [from, through]);
  async function run(work: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      setNotice(await work());
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The change could not be confirmed. Reload before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const filtered =
    catalog?.occurrences.filter(
      (row) =>
        (!selected || row.programId === selected) &&
        (!child || row.childId === child),
    ) ?? [];
  const groups = new Map<string, ProgramOccurrence[]>();
  for (const row of filtered) {
    const key =
      group === "program"
        ? row.programName
        : row.subject
          ? SUBJECT_LABELS[row.subject as keyof typeof SUBJECT_LABELS]
          : "Removed classes";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return (
    <section className="space-y-6 text-[color:var(--homa-ink)]">
      <QuietAction href="/app/planner" kind="quiet">
        Back to Planner
      </QuietAction>
      <header>
        <h1 className="font-display text-3xl">Programs and co-op</h1>
        <p className="mt-2">
          Keep the schedule together. Record what each child actually did.
        </p>
      </header>
      {notice && <p role="status">{notice}</p>}
      <details open={catalog?.programs.length===0 ? true : undefined}>
      <summary className="min-h-11 cursor-pointer font-semibold">Add another program or upload a schedule</summary>
      <div className="flex flex-wrap gap-2">
        <QuietAction href="/app">Open chat to upload a schedule</QuietAction>
        <QuietAction
          kind="secondary"
          disabled={busy || Boolean(draft) || !catalog}
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: "",
              expectedRevision: null,
              classes: [newClass()],
            })
          }
        >
          Enter a schedule here
        </QuietAction>
      </div>
      <p className="text-sm">
        A program can be your co-op, a club, or weekly lessons. Upload its
        schedule in chat, or enter the classes here.
      </p>
      </details>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <QuietAction
            kind="secondary"
            onClick={() =>
              void run(async () => {
                await load();
                return "Programs reloaded.";
              })
            }
          >
            Reload programs
          </QuietAction>
        </div>
      )}
      {draft && (
        <form
          className="quiet-card quiet-card--paper space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const parsed = programDraftSchema.safeParse(draft);
              if (!parsed.success)
                throw new Error(
                  parsed.error.issues.map((i) => i.message).join(" "),
                );
              const result = await change("save", parsed.data);
              setSelected(result.id);
              setDraft(null);
              return "Schedule saved. No hours have been recorded.";
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend className="font-display text-xl">
              Review the weekly schedule
            </legend>
            <label className="block text-sm">
              Program name
              <input
                className={FIELD}
                required
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            {draft.classes.map((row, index) => (
              <ClassEditor
                key={row.id}
                row={row}
                childrenList={childrenList}
                onChange={(next) =>
                  setDraft({
                    ...draft,
                    classes: draft.classes.map((c, i) =>
                      i === index ? next : c,
                    ),
                  })
                }
                onRemove={() =>
                  setDraft({
                    ...draft,
                    classes: draft.classes.filter((c) => c.id !== row.id),
                  })
                }
              />
            ))}
            <div className="flex flex-wrap gap-2">
              <QuietAction
                kind="secondary"
                disabled={draft.classes.length >= 64}
                onClick={() =>
                  setDraft({
                    ...draft,
                    classes: [...draft.classes, newClass()],
                  })
                }
              >
                Add class
              </QuietAction>
              <QuietAction type="submit">Save schedule</QuietAction>
              <QuietAction kind="quiet" onClick={() => setDraft(null)}>
                Cancel
              </QuietAction>
            </div>
          </fieldset>
        </form>
      )}
      {!(error && !catalog) && <>
      <p className="text-sm">These filters change what you see. To add classes, open the weekly schedule below.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Show classes from
          <input
            className={FIELD}
            type="date"
            value={from}
            onChange={(e) => {
              setCatalog(null);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label className="text-sm">
          Through
          <input
            className={FIELD}
            type="date"
            min={from}
            value={through}
            onChange={(e) => {
              setCatalog(null);
              setThrough(e.target.value);
            }}
          />
        </label>
        <label className="text-sm">
          Program
          <select
            className={FIELD}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">All programs</option>
            {catalog?.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Child
          <select
            className={FIELD}
            value={child}
            onChange={(e) => setChild(e.target.value)}
          >
            <option value="">All children</option>
            {childrenList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selected &&
        catalog?.programs
          .filter((p) => p.id === selected)
          .map((program) => (
            <details
              open={scheduleOpen}
              onToggle={event=>setScheduleOpen(event.currentTarget.open)}
              key={program.id}
              className="border-t border-[var(--homa-control-boundary)] pt-3"
            >
              <summary className="min-h-11 cursor-pointer font-semibold">
                Weekly schedule and upcoming dates
              </summary>
              <ul className="space-y-2 py-3">
                {program.classes.map((row) => (
                  <li key={row.id}>
                    {DAYS[row.weekday]} · {row.title} ·{" "}
                    {row.childIds
                      .map(
                        (id) =>
                          childrenList.find((c) => c.id === id)?.name ??
                          "Child no longer available",
                      )
                      .join(", ")}
                    {classMinutes(row) !== null
                      ? ` · ${classMinutes(row)} planned minutes`
                      : ""}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                Weekly schedule edits apply when you add new dates. Classes
                already in Planner keep their details.
              </p>
              <QuietAction
                kind="quiet"
                disabled={busy}
                onClick={() =>
                  setDraft({
                    id: program.id,
                    name: program.name,
                    expectedRevision: program.revision,
                    classes: program.classes,
                  })
                }
              >
                Edit weekly schedule
              </QuietAction>
              <form
                className="space-y-3 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const r = await change("schedule", {
                      programId: program.id,
                      expectedRevision: program.revision,
                      from,
                      through,
                      excludedDates: excluded,
                    });
                    setScheduleOpen(false);
                    return `${r.created} planned classes added from ${readableDate(from)} through ${readableDate(through)}.${excluded.length ? ` Skipped: ${excluded.filter(d=>d>=from&&d<=through).map(readableDate).join(", ")}.` : ""} No hours recorded.`;
                  });
                }}
              >
                <p className="text-sm">
                  Add each child’s selected classes from {readableDate(from)}{" "}
                  through {readableDate(through)}. Previously added classes will
                  not change.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    Skip a holiday or day off
                    <input
                      type="date"
                      min={from}
                      max={through}
                      className={FIELD}
                      value={skipDate}
                      onChange={(e) => setSkipDate(e.target.value)}
                    />
                  </label>
                  <QuietAction
                    kind="secondary"
                    disabled={!skipDate || excluded.includes(skipDate)}
                    onClick={() => {
                      setExcluded([...excluded, skipDate]);
                      setSkipDate("");
                    }}
                  >
                    Skip this date
                  </QuietAction>
                </div>
                <ul>
                  {excluded.map((date) => (
                    <li key={date}>
                      Skipped: {readableDate(date)}{" "}
                      <QuietAction
                        kind="quiet"
                        onClick={() =>
                          setExcluded(excluded.filter((d) => d !== date))
                        }
                      >
                        Include this date
                      </QuietAction>
                    </li>
                  ))}
                </ul>
                <QuietAction type="submit" disabled={busy}>
                  Add planned classes for these dates
                </QuietAction>
              </form>
            </details>
          ))}
      <label className="block text-sm">
        Group classes by
        <select
          className={FIELD}
          value={group}
          onChange={(e) => setGroup(e.target.value as "program" | "subject")}
        >
          <option value="program">Program</option>
          <option value="subject">Subject</option>
        </select>
      </label>
      </>}
      {!catalog && !error && <p role="status">Loading programs…</p>}
      {catalog?.programs.length === 0 && (
        <p>
          Your first program starts with a schedule. Add it here or share it
          with Homa.
        </p>
      )}
      {catalog && catalog.programs.length > 0 && filtered.length === 0 && (
        <p>
          No classes in this date range. Choose a program to reuse its weekly
          schedule.
        </p>
      )}
      {[...groups].map(([name, rows]) => (
        <section key={name}>
          <h2 className="font-display text-2xl">{name}</h2>
          <p className="text-sm">
            {rows.reduce((sum, row) => sum + (row.minutes ?? 0), 0)} recorded
            minutes in this view
          </p>
          <ul>
            {rows.map((row) => (
              <OccurrenceRow
                key={`${row.programId}:${row.classId}:${row.childId}:${row.date}:${row.revision}`}
                row={row}
                childName={
                  childrenList.find((c) => c.id === row.childId)?.name ??
                  "Child"
                }
                busy={busy}
                onRecord={(minutes) =>
                  void run(async () => {
                    await change("occurrence", {
                      activityId: row.activityId,
                      revision: row.revision,
                      operation: "record",
                      minutes,
                    });
                    return "Recorded time saved for this child.";
                  })
                }
                onCancel={() =>
                  void run(async () => {
                    await change("occurrence", {
                      activityId: row.activityId,
                      revision: row.revision,
                      operation: "cancel",
                      minutes: null,
                    });
                    return "Class and its time removed for this child.";
                  })
                }
              />
            ))}
          </ul>
        </section>
      ))}
      <QuietAction href="/app/planner?view=hours" kind="secondary">
        View and export school hours
      </QuietAction>
    </section>
  );
}
