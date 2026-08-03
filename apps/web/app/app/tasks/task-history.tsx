"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Icon } from "../../../components/design/Icon";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { isResearchBriefFeedbackEligible } from "../../../lib/tasks/research-brief-feedback-contract";
import { recordResearchBriefFeedbackAction } from "./actions";
import { HISTORY_RUN_LIMIT } from "./task-copy";
import { runBriefFeedbackInteraction } from "./task-feedback-interaction";
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
      return <Icon name="progress" size={16} />;
    case "journal_prompt":
      return <Icon name="book" size={16} />;
    case "custom":
    case "agent_job":
      return <Icon name="tasks" size={16} />;
    default: {
      // Exhaustiveness stays compile-checked, but the runtime default must
      // render, not throw: run rows come from the database, so a kind added
      // by a newer deploy (agent_job, 2026-07-20) reaches older UI code and
      // a throw here kills the whole page during SSR streaming.
      const exhaustive: never = kind;
      void exhaustive;
      return <Icon name="info" size={16} />;
    }
  }
}

/** The done lines pair delivery truth with the on-page Ask Homa door.
 * Uncertain and failed rows stay factual: uncertainty does not prove the
 * canonical brief became visible, and a completed failed run does not imply
 * another attempt before the schedule's next planned time. */
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
      return "Skipped: this task's scheduled time had passed. It is scheduled again at its next time.";
    case "partial":
      // No counts: the string can't know how many deliveries failed
      // (editor gate 2026-07-13, no invented numbers).
      return "It reached at least one family member. It is available on this page.";
    case "partial_uncertain":
      return "It reached at least one family member. Homa can't tell yet whether other deliveries arrived. It is available on this page.";
    case "uncertain":
      return "Homa couldn't confirm delivery. Nothing else needs your attention right now.";
    case "failed":
      return "This task did not send.";
    case "running":
      return "Homa is preparing this task now.";
    default: {
      // Same law as runIcon: database statuses can be newer than this
      // deploy, and a display-only switch must degrade quietly, not throw.
      const exhaustive: never = run.status;
      void exhaustive;
      return null;
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

function showsBriefFeedback(run: TaskRunView): boolean {
  return isResearchBriefFeedbackEligible(run);
}

export function briefFeedbackControlState(
  selectedSignal: TaskRunView["feedbackSignal"],
  signal: "helpful" | "not_for_us",
  pending: boolean,
): { ariaPressed: boolean; disabled: boolean } {
  return {
    ariaPressed: selectedSignal === signal,
    disabled: pending,
  };
}

function BriefFeedbackControls({ run }: { run: TaskRunView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const promptId = `brief-feedback-label-${run.id}`;

  return (
    <div className="mt-3">
      <p id={promptId} className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
        Was this helpful?
      </p>
      <div
        className="mt-1.5 flex flex-wrap gap-2"
        role="group"
        aria-labelledby={promptId}
      >
        {(["helpful", "not_for_us"] as const).map((signal) => {
          const state = briefFeedbackControlState(run.feedbackSignal, signal, pending);
          const label = signal === "helpful" ? "Helpful" : "Not for us";
          const ariaPressedProps: {
            "aria-pressed": "true" | "false";
          } = state.ariaPressed
            ? { "aria-pressed": "true" }
            : { "aria-pressed": "false" };
          return (
            <button
              key={signal}
              type="button"
              aria-label={`Mark this brief ${signal === "helpful" ? "helpful" : "not for us"}`}
              {...ariaPressedProps}
              disabled={state.disabled}
              onClick={() => {
                startTransition(async () => {
                  await runBriefFeedbackInteraction(
                    { taskRunId: run.id, signal },
                    {
                      action: recordResearchBriefFeedbackAction,
                      setError,
                      refresh: () => router.refresh(),
                    },
                  );
                });
              }}
              className={
                state.ariaPressed
                  ? "min-h-11 min-w-11 rounded-[var(--homa-radius-control)] border-2 border-[var(--homa-midnight-action)] bg-[var(--homa-midnight-action)] px-3 py-2 text-xs font-semibold text-[var(--homa-paper)] disabled:cursor-not-allowed disabled:opacity-60"
                  : "min-h-11 min-w-11 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))] disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <p
        className="mt-1.5 min-h-4 text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
        aria-live="polite"
        aria-atomic="true"
      >
        {error ?? ""}
      </p>
    </div>
  );
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
    <section className="mt-8" data-brand-surface="task-history">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">Task history</h2>
      {runs.length === 0 ? (
        <QuietFrame tone="paper" as="section" className="mt-3 p-6 text-center">
          <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">Nothing here yet.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            When Homa finishes one of your tasks, it shows up here.
          </p>
        </QuietFrame>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          {groupRunsByDay(runs, timeZone).map((group) => (
            <div key={group.key}>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                {group.label}
              </p>
              <ol className="mt-2 flex flex-col gap-2.5">
                {group.runs.map((run) => {
                  const note = statusNote(run);
                  const askable = showsAskHoma(run);
                  const feedbackable = showsBriefFeedback(run);
                  return (
                    <li key={run.id}>
                      <QuietFrame as="article" tone="paper" className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 font-semibold text-[color:var(--homa-ink)]">
                          <span className="text-[color:var(--homa-brand-text)]">{runIcon(run.kind)}</span>
                          {run.title}
                        </p>
                        <p className="shrink-0 text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                          {timeLabel(run.startedAt, timeZone)}
                        </p>
                      </div>
                      {run.summary ? (
                        <p className="mt-2 max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
                          {run.summary}
                        </p>
                      ) : null}
                      {note || askable ? (
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          {note ? (
                            <p className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">{note}</p>
                          ) : null}
                          {askable ? (
                            <Link
                              href="/app"
                              className="text-xs font-semibold text-[color:var(--homa-brand-text)] hover:underline"
                            >
                              Ask Homa about this
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {feedbackable ? <BriefFeedbackControls run={run} /> : null}
                      </QuietFrame>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {/* The feed ends on purpose, and the capped line answers the
              real question plainly: kept, not thrown away (reader gate
              2026-07-13 flagged the soft version as trust-costing). */}
          <p className="text-center text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
            {runs.length >= HISTORY_RUN_LIMIT
              ? "This page shows your newest 30 task updates. Older ones are kept, just not shown here."
              : "That's everything so far."}
          </p>
        </div>
      )}
    </section>
  );
}
