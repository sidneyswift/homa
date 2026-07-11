"use client";

import { Bell, FlaskConical, Moon } from "lucide-react";

import type { TaskRunView } from "./tasks-view";

/**
 * The runs feed (HT-5): newest first, the parent-readable outcome of
 * each proactive run. Fleet research rows never reach this component
 * (RLS hides family_id-null rows), so everything here is this family's
 * own record. Failure copy stays calm by design law: no red, no alarm.
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

function whenLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
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
        <ol className="mt-3 flex flex-col gap-2.5">
          {runs.map((run) => {
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
                    {whenLabel(run.startedAt, timeZone)}
                  </p>
                </div>
                {run.summary ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-body">
                    {run.summary}
                  </p>
                ) : null}
                {note ? <p className="mt-2 text-xs font-semibold text-subtle">{note}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
