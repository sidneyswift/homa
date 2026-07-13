"use client";

import Link from "next/link";
import { Bell, FlaskConical, Moon } from "lucide-react";

import { HISTORY_RUN_LIMIT } from "./task-copy";
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

/** Status copy passed both gates 2026-07-10; the done lines shortened
 * 2026-07-13 when the Ask Homa link took over naming the on-page door
 * (reader gate: the offer in a brief had no on-page way to say yes).
 * The failed line matches the dispatcher's real behavior: a released
 * schedule is retried by the next hourly tick, so "soon" is the truth
 * the Next chip also tells; a retry that misses the delivery window
 * records its own skipped row with the next-scheduled-time story. */
function statusNote(run: TaskRunView): string | null {
  switch (run.status) {
    case "done":
      return run.deliveredChannel === "sms"
        ? "Sent by text."
        : run.deliveredChannel === "email"
          ? "Sent by email."
          : run.deliveredChannel === "none"
            ? "Saved to this page."
            : null;
    case "skipped":
      return "Skipped: the moment for this one had already passed. It runs at the next scheduled time.";
    case "partial":
      // No counts: the string can't know how many deliveries failed
      // (editor gate 2026-07-13, no invented numbers).
      return "Sent to part of the family. Whoever missed it can read it here.";
    case "partial_uncertain":
      return "Sent to part of the family. Homa can't tell yet whether the rest arrived. It's saved here either way.";
    case "uncertain":
      return "Homa sent this, but can't tell yet whether it arrived. It's saved here either way.";
    case "failed":
      return "Didn't send. Homa tries again soon.";
    case "running":
      return "Working on it now.";
    default: {
      const exhaustive: never = run.status;
      throw new Error(`unhandled run status: ${String(exhaustive)}`);
    }
  }
}

/** A finished run is a conversation the parent can pick back up: the
 * brief's own offer ("want it in her week? just reply") needs a door on
 * THIS page, not a hunt for the text thread. "Ask Homa", never "Reply":
 * reply implies a message she may not have gotten (save-only runs), and
 * it would compete with texting back, which also works. */
function showsAskHoma(run: TaskRunView): boolean {
  return run.status === "done";
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
            The first time a task above runs, its work shows up here.
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
                  const askable = showsAskHoma(run);
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
                      {note || askable ? (
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          {note ? (
                            <p className="text-xs font-semibold text-subtle">{note}</p>
                          ) : null}
                          {askable ? (
                            <Link
                              href="/app"
                              className="text-xs font-semibold text-brand hover:underline"
                            >
                              Ask Homa about this
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {/* The feed ends on purpose, and the capped line answers the
              real question plainly: kept, not thrown away (reader gate
              2026-07-13 flagged the soft version as trust-costing). */}
          <p className="text-center text-xs font-semibold text-subtle">
            {runs.length >= HISTORY_RUN_LIMIT
              ? "This list shows the newest 30. Older runs are kept, just not shown here."
              : "That's everything so far."}
          </p>
        </div>
      )}
    </section>
  );
}
