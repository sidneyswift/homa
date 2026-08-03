"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { setTaskPausedAction } from "./actions";
import { AgentJobCard } from "./agent-job-card";
import type { AgentJobView } from "./agent-job-view";
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
  kind: "journal_prompt" | "morning_brief" | "custom" | "fleet_research" | "agent_job";
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
  feedbackSignal?: "helpful" | "not_for_us" | null;
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

function nextRunLabel(iso: string, timeZone: string): string {
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
      return <Icon name="plan" size={20} />;
    case "journal_prompt":
      return <Icon name="voice" size={20} />;
    case "custom":
      return <Icon name="tasks" size={20} />;
    default: {
      // Display-only switch: schedule kinds come from the database, so an
      // additive kind from a newer deploy must render a generic icon, not
      // throw and take the page down (the agent_job lesson, 2026-07-21).
      const exhaustive: never = kind;
      void exhaustive;
      return <Icon name="tasks" size={20} />;
    }
  }
}

function PauseToggle({ task }: { task: TaskRowView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const on = !task.paused;
  return (
    // The padding + negative margin trades no visual space for a 44px
    // hit area: a near-miss lands on the switch, never on the card
    // behind it (which would open the editor).
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
      className="quiet-task-switch -m-2.5 shrink-0 cursor-pointer p-2.5 disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={
          on
            ? "relative block h-6 w-11 rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] transition-colors"
            : "relative block h-6 w-11 rounded-[var(--homa-radius-control)] bg-[var(--homa-canvas)] transition-colors"
        }
      >
        <span
          className={
            on
              ? "absolute top-0.5 left-[1.4rem] h-5 w-5 rounded-[var(--homa-radius-control)] bg-[var(--homa-paper)] shadow-sm transition-all"
              : "absolute top-0.5 left-0.5 h-5 w-5 rounded-[var(--homa-radius-control)] bg-[var(--homa-paper)] shadow-sm transition-all"
          }
        />
      </span>
    </button>
  );
}

function TaskCard({
  task,
  timeZone,
  textingLinked,
  now,
}: {
  task: TaskRowView;
  timeZone: string;
  textingLinked: boolean;
  now: Date;
}) {
  const [editing, setEditing] = useState(false);
  const on = !task.paused;
  const copy =
    task.kind === "custom"
      ? { label: task.label ?? "Your task", description: task.prompt ?? "" }
      : BUILT_IN_COPY[task.kind];
  // next_run_at lags the scheduler on purpose (it advances after a run
  // finishes, and a failed run keeps it until the retry). A timestamp
  // already in the past would contradict History right below, so those
  // windows say "soon" instead.
  const upcoming =
    on && task.nextRunAt !== null && new Date(task.nextRunAt).getTime() > now.getTime();
  const next = upcoming && task.nextRunAt !== null ? nextRunLabel(task.nextRunAt, timeZone) : null;

  return (
    <>
      {/* The whole card is a generous pointer target; the title button
          carries the real semantics for keyboard and screen readers
          (a native button cannot wrap the switch). The icon disc and
          the Next/Off chip wear the on/off state, so it reads from
          across the room, not just off the switch. */}
      <QuietFrame
        as="article"
        onClick={() => setEditing(true)}
        className="quiet-task-card group flex cursor-pointer flex-col p-4 transition duration-(--dur-fast) ease-out hover:border-[var(--homa-midnight-action)] motion-safe:active:scale-[var(--press-scale)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={
                on
                  ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--homa-radius-control)] bg-[var(--homa-highlight-tint)] text-[var(--homa-highlight-ink)]"
                  : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--homa-radius-control)] bg-[var(--homa-canvas)] text-[var(--homa-muted-ink)]"
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
                className="text-left font-semibold text-[var(--homa-ink)]"
              >
                {copy.label}
              </button>
              <p className={on ? "mt-0.5 text-sm text-[var(--homa-muted-ink)]" : "mt-0.5 text-sm text-[var(--homa-muted-ink)] opacity-70"}>
                {copy.description}
              </p>
              {/* Delivery shows for every kind since built-ins became a
                  choice too (founder ruling 2026-07-12 evening). */}
              <p className="mt-2 text-xs font-semibold text-[var(--homa-muted-ink)]">
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
            <QuietStatus tone="constructive" className="quiet-task-status px-2.5 py-1 text-[0.7rem] font-bold">
              Next {"\u00b7"} {next}
            </QuietStatus>
          ) : on && task.nextRunAt !== null ? (
            <QuietStatus tone="constructive" className="quiet-task-status px-2.5 py-1 text-[0.7rem] font-bold">
              Next {"\u00b7"} soon
            </QuietStatus>
          ) : !on ? (
            <QuietStatus tone="info" className="quiet-task-status px-2.5 py-1 text-[0.7rem] font-bold">
              Off
            </QuietStatus>
          ) : (
            <span />
          )}
          <Icon name="next" size={16} className="shrink-0 text-[var(--homa-muted-ink)] transition-transform duration-(--dur-fast) ease-out group-hover:translate-x-0.5" />
        </div>
      </QuietFrame>
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
    <QuietFrame as="article" tone="mineral" className="border-dashed p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--homa-radius-control)] bg-[var(--homa-paper)] text-[var(--homa-muted-ink)]"
        >
          <TaskIcon kind={kind} />
        </span>
        <div>
          <p className="font-semibold text-[var(--homa-ink)]">{copy.label}</p>
          <p className="mt-0.5 text-sm text-[var(--homa-muted-ink)]">{copy.description}</p>
          <p className="mt-2 text-xs font-semibold text-[var(--homa-muted-ink)]">{note}</p>
        </div>
      </div>
    </QuietFrame>
  );
}

export function TasksView({
  tasks,
  jobs,
  runs,
  timeZone,
  briefFlagOn,
  textingLinked,
  now,
}: {
  tasks: TaskRowView[];
  /** The family's active agent jobs (curriculum builds and any future job
   * skill). Empty when the flag is off or nothing is building. */
  jobs: AgentJobView[];
  runs: TaskRunView[];
  timeZone: string;
  briefFlagOn: boolean;
  textingLinked: boolean;
  /** The server's render instant, so the Next chip never shows a past
   * time and server and client hydrate the same words. */
  now: Date;
}) {
  const [creating, setCreating] = useState(false);
  const hasBrief = tasks.some((task) => task.kind === "morning_brief");
  const hasJournal = tasks.some((task) => task.kind === "journal_prompt");

  return (
    <div data-brand-surface="tasks" data-brand-fixture="quiet-authority-v1" className="quiet-task-surface">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--homa-brand-text)]">
            On her own schedule
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--homa-ink)]">
            Homa&apos;s tasks
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--homa-muted-ink)]">
            Homa works on these by herself: morning briefs about your kids,
            evening check-ins, and any tasks you give her. Everything she
            does shows up below. Your kids&apos; week stays in the
            Planner tab.
          </p>
        </div>
        <QuietAction
          aria-haspopup="dialog"
          aria-expanded={creating}
          onClick={() => setCreating(true)}
          icon={<Icon name="add" size={16} />}
        >
          Add a task
        </QuietAction>
      </header>

      {creating ? (
        <TaskEditOverlay
          task={null}
          textingLinked={textingLinked}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {/* Active builds sit above the recurring schedule: they are a
          different shape of work (a finite thing Homa is finishing, not a
          switch that runs every day), so they get their own calm heading
          rather than mixing in under "Scheduled". Hidden entirely when
          nothing is building. */}
      {jobs.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--homa-muted-ink)]">
            In progress
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {jobs.map((job) => (
              <AgentJobCard key={job.id} job={job} timeZone={timeZone} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--homa-muted-ink)]">Scheduled</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {!hasBrief ? (
            // The placeholder names time, never a control or a concept
            // she has not met yet (reader gate 2026-07-13: "report"
            // read as jargon on the first visit).
            <DarkKindCard
              kind="morning_brief"
              note={
                briefFlagOn
                  ? "Starts on its own within a day. Nothing to set up."
                  : "Almost ready. It starts on its own, nothing to set up."
              }
            />
          ) : null}
          {!hasJournal ? (
            // The check-in seeds switched off (kinds.ts seedPaused), and
            // its placeholder has no switch yet, so the note explains
            // when the switch appears instead of pointing at a control
            // that is not there (reader gate 2026-07-13).
            <DarkKindCard
              kind="journal_prompt"
              note="Off until you turn it on. The switch shows up here within a day."
            />
          ) : null}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              timeZone={timeZone}
              textingLinked={textingLinked}
              now={now}
            />
          ))}
        </div>
      </section>

      <TaskHistory runs={runs} timeZone={timeZone} />
    </div>
  );
}
