"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, FlaskConical, Moon, Plus } from "lucide-react";

import { deleteTaskAction, setTaskPausedAction } from "./actions";
import { TaskForm } from "./task-form";
import { TaskHistory } from "./task-history";

/**
 * The Homa's tasks board (HT-5/HT-6): scheduled work on top, what the
 * runs produced below. Pure client render over page-loaded data; every
 * write goes through the server actions. Copy follows the copy rulebook:
 * sentence case, offers never commands, no red or "behind" framing (a
 * failed run reads as "didn't send", muted, never alarmed).
 */

export interface TaskRowView {
  id: string;
  kind: "journal_prompt" | "morning_brief" | "custom";
  label: string | null;
  prompt: string | null;
  localHour: number;
  weekdays: number[];
  deliveryPref: "text" | "email" | "none";
  paused: boolean;
  enabled: boolean;
  nextRunAt: string | null;
}

export interface TaskRunView {
  id: string;
  kind: "journal_prompt" | "morning_brief" | "custom" | "fleet_research";
  status:
    | "running"
    | "done"
    | "partial"
    | "partial_uncertain"
    | "uncertain"
    | "failed"
    | "skipped";
  title: string;
  summary: string | null;
  deliveredChannel: "sms" | "email" | "none" | null;
  startedAt: string;
}

// Copy passed both gates 2026-07-10 (reader, then editor). Vocabulary
// law for this surface: the morning artifact is a "brief" (its card
// title carries the name, nothing else renames it), parent-created
// things are "tasks", and results are "saved to this page".
const BUILT_IN_COPY: Record<
  "morning_brief" | "journal_prompt",
  { label: string; description: string }
> = {
  morning_brief: {
    label: "Morning research brief",
    description:
      "Every weekday morning: one thing Homa looked into for your kids, and why it matters.",
  },
  journal_prompt: {
    label: "Evening check-in",
    description:
      "One easy question in the evening. Answer in a sentence and Homa remembers the day.",
  },
};

export function hourLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${hour < 12 ? "am" : "pm"}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdaysLabel(weekdays: number[]): string {
  const set = new Set(weekdays);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return [...set]
    .sort((a, b) => a - b)
    .map((day) => DAY_SHORT[day])
    .join(", ");
}

function nextRunLabel(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function TaskIcon({ kind }: { kind: TaskRowView["kind"] | "fleet_research" }) {
  switch (kind) {
    case "morning_brief":
    case "fleet_research":
      return <FlaskConical size={18} />;
    case "journal_prompt":
      return <Moon size={18} />;
    case "custom":
      return <Bell size={18} />;
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled task icon kind: ${String(exhaustive)}`);
    }
  }
}

function PauseToggle({ task }: { task: TaskRowView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const on = !task.paused;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Turn this task off" : "Turn this task on"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setTaskPausedAction(task.id, on);
          if (result.error === null) router.refresh();
        })
      }
      className={
        on
          ? "relative h-6 w-11 shrink-0 rounded-pill bg-brand transition-colors disabled:opacity-60"
          : "relative h-6 w-11 shrink-0 rounded-pill bg-[var(--clay-100,#eadfd2)] transition-colors disabled:opacity-60"
      }
    >
      <span
        className={
          on
            ? "absolute top-0.5 left-[1.4rem] h-5 w-5 rounded-pill bg-card shadow-sm transition-all"
            : "absolute top-0.5 left-0.5 h-5 w-5 rounded-pill bg-card shadow-sm transition-all"
        }
      />
    </button>
  );
}

function TaskCard({ task, timeZone }: { task: TaskRowView; timeZone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const copy =
    task.kind === "custom"
      ? { label: task.label ?? "Your task", description: task.prompt ?? "" }
      : BUILT_IN_COPY[task.kind];
  const next = task.paused ? null : nextRunLabel(task.nextRunAt, timeZone);

  return (
    <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-brand">
            <TaskIcon kind={task.kind} />
          </span>
          <div>
            <p className="font-semibold text-strong">{copy.label}</p>
            <p className="mt-0.5 text-sm text-muted">{copy.description}</p>
            <p className="mt-2 text-xs font-semibold text-subtle">
              {weekdaysLabel(task.weekdays)} {"\u00b7"} {hourLabel(task.localHour)}
              {task.kind === "custom"
                ? ` \u00b7 ${
                    task.deliveryPref === "text"
                      ? "by text"
                      : task.deliveryPref === "email"
                        ? "by email"
                        : "saved to this page"
                  }`
                : ""}
              {next ? ` \u00b7 next: ${next}` : task.paused ? " \u00b7 off" : ""}
            </p>
          </div>
        </div>
        <PauseToggle task={task} />
      </div>
      {task.kind === "custom" ? (
        <div className="mt-3 flex gap-3 border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${copy.label}"? This can't be undone.`)) return;
              startTransition(async () => {
                const result = await deleteTaskAction(task.id);
                if (result.error === null) router.refresh();
              });
            }}
            className="text-xs font-semibold text-muted hover:underline disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      ) : null}
      {editing ? (
        <div className="mt-3">
          <TaskForm task={task} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </div>
  );
}

function DarkKindCard({
  kind,
  note,
}: {
  kind: "morning_brief" | "journal_prompt";
  note: string;
}) {
  const copy = BUILT_IN_COPY[kind];
  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-subtle">
          <TaskIcon kind={kind} />
        </span>
        <div>
          <p className="font-semibold text-strong">{copy.label}</p>
          <p className="mt-0.5 text-sm text-muted">{copy.description}</p>
          <p className="mt-2 text-xs font-semibold text-subtle">{note}</p>
        </div>
      </div>
    </div>
  );
}

export function TasksView({
  tasks,
  runs,
  timeZone,
  briefFlagOn,
  journalFlagOn,
}: {
  tasks: TaskRowView[];
  runs: TaskRunView[];
  timeZone: string;
  briefFlagOn: boolean;
  journalFlagOn: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const hasBrief = tasks.some((task) => task.kind === "morning_brief");
  const hasJournal = tasks.some((task) => task.kind === "journal_prompt");

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            On her own schedule
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            Homa&apos;s tasks
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Homa works on these by herself: research for your kids, check-ins,
            and any tasks you give her. Everything she finishes shows up
            below. Your kids&apos; week stays in the Week planner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="inline-flex items-center gap-2 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          <Plus size={16} /> Add a task
        </button>
      </header>

      {creating ? (
        <div className="mt-5 rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <TaskForm onDone={() => setCreating(false)} />
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-subtle">Scheduled</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {!hasBrief ? (
            <DarkKindCard
              kind="morning_brief"
              note={
                briefFlagOn
                  ? "Starts on its own once your family's first report is ready."
                  : "Almost ready. It starts on its own, nothing to set up."
              }
            />
          ) : null}
          {!hasJournal ? (
            <DarkKindCard
              kind="journal_prompt"
              note={
                journalFlagOn
                  ? "Starts on its own in the evening."
                  : "Almost ready. It starts on its own, nothing to set up."
              }
            />
          ) : null}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} timeZone={timeZone} />
          ))}
        </div>
      </section>

      <TaskHistory runs={runs} timeZone={timeZone} />
    </>
  );
}
