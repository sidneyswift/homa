"use client";

import { Bell, FlaskConical, Moon } from "lucide-react";

import type { TaskRunView } from "./tasks-view";

/**
 * The runs feed (HT-5): newest first, the parent-readable outcome of
 * each proactive run. Runs group under one quiet day label (Today,
 * Yesterday, then the date) so the feed scans as a week, not a wall of
 * repeated timestamps; each card keeps only its time. Fleet research
 * rows never reach this component (RLS hides family_id-null rows), so
 * everything here is this family's own record. Failure copy stays calm
 * by design law: no red, no alarm.
 */

function runIcon(kind: TaskRunView["kind"]) {
  switch (kind) {
    case "morning_brief":
    case "fleet_research":
      return <FlaskConical size={16} />;
    case "journal_prompt":
      return <Moon size={16} />;
    case "custom":
      return <Bell size={16} />;
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled run icon kind: ${String(exhaustive)}`);
    }
  }
}

/** Status copy passed both gates 2026-07-10. Sentence case; a brief
 * often ends with an offer, so the sent lines name the reply path. */
function statusNote(run: TaskRunView): string | null {
  switch (run.status) {
    case "done":
      return run.deliveredChannel === "sms"
        ? "Sent by text. Reply there and Homa answers."
        : run.deliveredChannel === "email"
          ? "Sent by email. Reply there and Homa answers."
          : run.deliveredChannel === "none"
            ? "Saved to this page."
            : null;
    case "skipped":
      return "Skipped: its time was already over. It runs again at the next scheduled time.";
    case "partial":
      return "Sent to part of the family. One delivery did not go through.";
    case "partial_uncertain":
      return "Sent to part of the family. Another phone carrier did not confirm the result.";
    case "uncertain":
      return "Homa sent this, but the phone carrier did not confirm the result.";
    case "failed":
      return "Didn't send. Homa tries again at the next scheduled time.";
    case "running":
      return "Working on it now.";
    default: {
      const exhaustive: never = run.status;
      throw new Error(`unhandled run status: ${String(exhaustive)}`);
    }
  }
}

function dayKey(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

function timeLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export interface TaskRunDayGroup {
  key: string;
  label: string;
  runs: TaskRunView[];
}

/**
 * groupRunsByDay(runs, timeZone, now): one group per family-local day,
 * newest day first (the input is already newest-run-first). Labels stay
 * plain: Today, Yesterday, then the dated weekday.
 */
export function groupRunsByDay(
  runs: TaskRunView[],
  timeZone: string,
  now: Date = new Date(),
): TaskRunDayGroup[] {
  const todayKey = dayKey(now, timeZone);
  const yesterdayKey = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);

  const groups: TaskRunDayGroup[] = [];
  for (const run of runs) {
    const started = new Date(run.startedAt);
    const key = dayKey(started, timeZone);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.runs.push(run);
      continue;
    }
    groups.push({
      key,
      label:
        key === todayKey
          ? "Today"
          : key === yesterdayKey
            ? "Yesterday"
            : started.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone,
              }),
      runs: [run],
    });
  }
  return groups;
}

export function TaskHistory({
  runs,
  timeZone,
}: {
  runs: TaskRunView[];
  timeZone: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-subtle">History</h2>
      {runs.length === 0 ? (
        <div className="mt-3 rounded-lg border border-border-subtle bg-card p-6 text-center shadow-sm">
          <p className="font-display text-lg font-semibold text-strong">Nothing here yet.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            The first time a task above runs, what it made shows up here.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          {groupRunsByDay(runs, timeZone).map((group) => (
            <div key={group.key}>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
                {group.label}
              </p>
              <ol className="mt-2 flex flex-col gap-2.5">
                {group.runs.map((run) => {
                  const note = statusNote(run);
                  return (
                    <li
                      key={run.id}
                      className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 font-semibold text-strong">
                          <span className="text-brand">{runIcon(run.kind)}</span>
                          {run.title}
                        </p>
                        <p className="shrink-0 text-xs font-semibold text-subtle">
                          {timeLabel(run.startedAt, timeZone)}
                        </p>
                      </div>
                      {run.summary ? (
                        <p className="mt-2 max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-body">
                          {run.summary}
                        </p>
                      ) : null}
                      {note ? (
                        <p className="mt-2 text-xs font-semibold text-subtle">{note}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
