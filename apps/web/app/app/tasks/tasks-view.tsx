"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, FlaskConical, Moon, Plus } from "lucide-react";

import { setTaskPausedAction } from "./actions";
import { BUILT_IN_COPY } from "./task-copy";
import { TaskEditOverlay } from "./task-edit-overlay";
import { TaskHistory } from "./task-history";

/**
 * The Homa's tasks board (HT-5/HT-6): scheduled work on top, what the
 * runs produced below. Pure client render over page-loaded data; every
 * write goes through the server actions. Clicking a task card opens the
 * editor dialog (task-edit-overlay.tsx); the on/off switch is the one
 * control that acts directly from the card. Copy follows the copy
 * rulebook: sentence case, offers never commands, no red or "behind"
 * framing (a failed run reads as "didn't send", muted, never alarmed).
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
      onClick={(event) => {
        // The switch acts from the card without opening the editor.
        event.stopPropagation();
        startTransition(async () => {
          const result = await setTaskPausedAction(task.id, on);
          if (result.error === null) router.refresh();
        });
      }}
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

function TaskCard({
  task,
  timeZone,
  textingLinked,
}: {
  task: TaskRowView;
  timeZone: string;
  textingLinked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const on = !task.paused;
  const copy =
    task.kind === "custom"
      ? { label: task.label ?? "Your task", description: task.prompt ?? "" }
      : BUILT_IN_COPY[task.kind];
  const next = on ? nextRunLabel(task.nextRunAt, timeZone) : null;

  return (
    <>
      {/* The whole card is a generous pointer target; the title button
          carries the real semantics for keyboard and screen readers
          (a native button cannot wrap the switch). The icon disc and
          the Next/Off chip wear the on/off state, so it reads from
          across the room, not just off the switch. */}
      <div
        onClick={() => setEditing(true)}
        className="group flex cursor-pointer flex-col rounded-lg border border-border-subtle bg-card p-4 shadow-sm transition duration-(--dur-fast) ease-out hover:border-[var(--clay-300)] motion-safe:active:scale-[var(--press-scale)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={
                on
                  ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand"
                  : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-[var(--clay-100,#eadfd2)] text-subtle"
              }
            >
              <TaskIcon kind={task.kind} />
            </span>
            <div>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={editing}
                onClick={() => setEditing(true)}
                className="text-left font-semibold text-strong"
              >
                {copy.label}
              </button>
              <p className={on ? "mt-0.5 text-sm text-muted" : "mt-0.5 text-sm text-subtle"}>
                {copy.description}
              </p>
              {/* Delivery shows for every kind since built-ins became a
                  choice too (founder ruling 2026-07-12 evening). */}
              <p className="mt-2 text-xs font-semibold text-subtle">
                {weekdaysLabel(task.weekdays)} {"\u00b7"} {hourLabel(task.localHour)}
                {` \u00b7 ${
                  task.deliveryPref === "text"
                    ? "by text"
                    : task.deliveryPref === "email"
                      ? "by email"
                      : "saved to this page"
                }`}
              </p>
            </div>
          </div>
          <PauseToggle task={task} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {next ? (
            <span className="rounded-pill bg-brand-soft px-2.5 py-1 text-[0.7rem] font-bold text-[var(--clay-700)]">
              Next {"\u00b7"} {next}
            </span>
          ) : !on ? (
            <span className="rounded-pill bg-[var(--clay-100,#eadfd2)] px-2.5 py-1 text-[0.7rem] font-bold text-muted">
              Off
            </span>
          ) : (
            <span />
          )}
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="shrink-0 text-subtle transition-transform duration-(--dur-fast) ease-out group-hover:translate-x-0.5"
          />
        </div>
      </div>
      {editing ? (
        <TaskEditOverlay
          task={task}
          textingLinked={textingLinked}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
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
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-[var(--clay-100,#eadfd2)] text-subtle"
        >
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
  textingLinked,
}: {
  tasks: TaskRowView[];
  runs: TaskRunView[];
  timeZone: string;
  briefFlagOn: boolean;
  textingLinked: boolean;
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
          aria-haspopup="dialog"
          aria-expanded={creating}
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          <Plus size={16} /> Add a task
        </button>
      </header>

      {creating ? (
        <TaskEditOverlay
          task={null}
          textingLinked={textingLinked}
          onClose={() => setCreating(false)}
        />
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
            // The check-in seeds switched off (kinds.ts seedPaused), so
            // its placeholder never promises it starts on its own.
            <DarkKindCard
              kind="journal_prompt"
              note="Almost ready. It stays off until you turn it on."
            />
          ) : null}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              timeZone={timeZone}
              textingLinked={textingLinked}
            />
          ))}
        </div>
      </section>

      <TaskHistory runs={runs} timeZone={timeZone} />
    </>
  );
}
