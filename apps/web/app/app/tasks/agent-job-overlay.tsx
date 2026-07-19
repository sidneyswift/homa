"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pause, Play } from "lucide-react";

import {
  approveAgentJobStageAction,
  cancelAgentJobAction,
  pauseAgentJobAction,
  resumeAgentJobAction,
} from "./actions";
import { DialogShell } from "./dialog-shell";
import {
  remainingStageRange,
  stageNoun,
  stageStatusLabel,
  type AgentJobStageStatus,
  type AgentJobView,
} from "./agent-job-view";

/**
 * The steer dialog for a running build (plan §A2). Clicking a build card
 * opens it: the full volume list from agent_job_stages plus the controls a
 * parent can act on. Any signed-in adult may steer (council decision); the
 * acting adult is recorded server-side. The one primary action is coral and
 * only appears when the build is actually waiting on the parent; Pause and
 * Cancel stay quiet, per the copy law's offers-not-commands and single-CTA
 * rules. Every button calls a server action (actions.ts) that re-scopes the
 * jobId inside the caller's own family; this component never touches the DB.
 */

/** A stage status's chip color. Calm-first: sage for finished, warm brand
 * for the one waiting on the parent, muted for everything still ahead. No
 * red, ever, not even for a failed stage (copy law). */
function stageChipClass(status: AgentJobStageStatus): string {
  switch (status) {
    case "approved":
    case "skipped":
      return "bg-[var(--sage-50)] text-[var(--sage-700)]";
    case "ready_for_review":
      return "bg-brand-soft text-[var(--clay-700)]";
    case "in_progress":
      return "bg-brand-soft text-brand";
    default:
      return "bg-[var(--brand-soft-2)] text-muted";
  }
}

function VolumeList({ job }: { job: AgentJobView }) {
  const noun = stageNoun(job.skill);
  const remaining = remainingStageRange(job);

  return (
    <ol className="mt-4 flex flex-col gap-1.5">
      {job.stages.map((stage) => (
        <li
          key={stage.stageNumber}
          className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-page px-3 py-2"
        >
          <span className="text-sm text-body">
            <span className="font-semibold text-strong">
              {noun.singular} {stage.stageNumber}
            </span>
            {stage.title ? <span className="text-muted"> {"·"} {stage.title}</span> : null}
          </span>
          <span
            className={`shrink-0 rounded-pill px-2.5 py-1 text-[0.7rem] font-bold ${stageChipClass(
              stage.status,
            )}`}
          >
            {stageStatusLabel(stage.status)}
          </span>
        </li>
      ))}
      {remaining ? (
        <li className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border-subtle px-3 py-2">
          <span className="text-sm font-semibold text-muted">
            {remaining.from === remaining.to
              ? `${noun.singular} ${remaining.from}`
              : `${noun.plural} ${remaining.from}-${remaining.to}`}
          </span>
          <span className="shrink-0 rounded-pill bg-[var(--brand-soft-2)] px-2.5 py-1 text-[0.7rem] font-bold text-muted">
            Up next
          </span>
        </li>
      ) : null}
    </ol>
  );
}

/** Two taps to stop, both inside the dialog (house pattern, no grey system
 * confirm). Reassure-before-inform: everything already built is kept. */
function CancelBuildButton({ job, onDone }: { job: AgentJobView; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <div className="mt-4 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-semibold text-muted hover:underline"
        >
          Stop this build
        </button>
        {error ? <p className="mt-2 text-sm text-muted">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border-subtle pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">
          Stop this build? Everything already built stays in your Binder.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await cancelAgentJobAction(job.id);
                if (result.error === null) {
                  onDone();
                  router.refresh();
                } else {
                  setError(result.error);
                }
              });
            }}
            className="rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            {pending ? "Stopping…" : "Stop build"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-pill px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:text-body"
          >
            Keep building
          </button>
        </div>
      </div>
    </div>
  );
}

function SteerControls({ job, onDone }: { job: AgentJobView; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The stage the store will actually approve is the one it finds at
  // status ready_for_review; this number just satisfies the schema and
  // labels the button, so fall back to the working position if no row is
  // flagged yet.
  const readyStage =
    job.stages.find((stage) => stage.status === "ready_for_review")?.stageNumber ??
    job.position;

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error === null) {
        onDone();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {job.status === "awaiting_input" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveAgentJobStageAction(job.id, readyStage))}
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          <Check size={16} aria-hidden="true" />
          {pending ? "Saving…" : "Approve and keep building"}
        </button>
      ) : null}

      {job.status === "paused" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resumeAgentJobAction(job.id))}
          className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
        >
          <Play size={15} aria-hidden="true" />
          Resume building
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => pauseAgentJobAction(job.id))}
          className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
        >
          <Pause size={15} aria-hidden="true" />
          Pause
        </button>
      )}

      {error ? <p className="text-sm text-muted">{error}</p> : null}
    </div>
  );
}

export function AgentJobOverlay({ job, onClose }: { job: AgentJobView; onClose: () => void }) {
  // The progress note is the runner's own one-liner ("Building week 5 of
  // 36"); show it when present, otherwise a plain, honest fallback.
  const note =
    job.progressNote ??
    (job.status === "awaiting_input"
      ? "The first part is ready for you to look over."
      : job.status === "paused"
        ? "Paused. Nothing already built is lost."
        : "Homa is building this, part by part.");

  return (
    <DialogShell titleId="agent-job-title" heading={job.title} onClose={onClose}>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <VolumeList job={job} />
      <SteerControls job={job} onDone={onClose} />
      <CancelBuildButton job={job} onDone={onClose} />
    </DialogShell>
  );
}
