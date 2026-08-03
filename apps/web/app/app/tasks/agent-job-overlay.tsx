"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietStatus } from "../../../components/design/QuietStatus";
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

/** A stage status maps to the shared truthful state vocabulary. Calm-first:
 * constructive for finished, attention for the one waiting on the parent,
 * info for everything still ahead. No red, even for a failed stage. */
function stageChipTone(status: AgentJobStageStatus): "constructive" | "attention" | "info" {
  switch (status) {
    case "approved":
    case "skipped":
      return "constructive";
    case "ready_for_review":
      return "attention";
    case "in_progress":
      return "attention";
    default:
      return "info";
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
          className="flex items-center justify-between gap-3 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-2"
        >
          <span className="text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
            <span className="font-semibold text-[color:var(--homa-ink)]">
              {noun.singular} {stage.stageNumber}
            </span>
            {stage.title ? <span className="text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"> {"·"} {stage.title}</span> : null}
          </span>
          <QuietStatus tone={stageChipTone(stage.status)} className="shrink-0 px-2.5 py-1 text-[0.7rem] font-bold">
            {stageStatusLabel(stage.status)}
          </QuietStatus>
        </li>
      ))}
      {remaining ? (
        <li className="flex items-center justify-between gap-3 rounded-[var(--homa-radius-control)] border border-dashed border-[var(--homa-control-boundary)] px-3 py-2">
          <span className="text-sm font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            {remaining.from === remaining.to
              ? `${noun.singular} ${remaining.from}`
              : `${noun.plural} ${remaining.from}-${remaining.to}`}
          </span>
          <span className="shrink-0 rounded-[var(--homa-radius-control)] bg-[var(--homa-canvas)] px-2.5 py-1 text-[0.7rem] font-bold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
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
      <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
        <QuietAction kind="quiet" className="px-0 text-xs" onClick={() => setConfirming(true)}>
          Stop this build
        </QuietAction>
        {error ? <QuietStatus tone="error" className="mt-2 text-sm">{error}</QuietStatus> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          Stop this build? Everything already built stays in your Binder.
        </p>
        <div className="flex shrink-0 gap-2">
          <QuietAction
            kind="secondary"
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
            className="text-xs"
          >
            {pending ? "Stopping…" : "Stop build"}
          </QuietAction>
          <QuietAction kind="quiet" className="text-xs" onClick={() => setConfirming(false)}>
            Keep building
          </QuietAction>
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
        <QuietAction
          disabled={pending}
          onClick={() => run(() => approveAgentJobStageAction(job.id, readyStage))}
          icon={<Icon name="check" size={16} />}
        >
          {pending ? "Saving…" : "Approve and keep building"}
        </QuietAction>
      ) : null}

      {job.status === "paused" ? (
        <QuietAction
          kind="secondary"
          disabled={pending}
          onClick={() => run(() => resumeAgentJobAction(job.id))}
        >
          Resume building
        </QuietAction>
      ) : (
        <QuietAction
          kind="secondary"
          disabled={pending}
          onClick={() => run(() => pauseAgentJobAction(job.id))}
        >
          Pause
        </QuietAction>
      )}

      {error ? <QuietStatus tone="error" className="text-sm">{error}</QuietStatus> : null}
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
      <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">{note}</p>
      <VolumeList job={job} />
      <SteerControls job={job} onDone={onClose} />
      <CancelBuildButton job={job} onDone={onClose} />
    </DialogShell>
  );
}
