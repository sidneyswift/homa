"use client";

import { useState } from "react";

import { Icon } from "../../../components/design/Icon";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";

import { AgentJobOverlay } from "./agent-job-overlay";
import { jobMetaLine, jobPill, type AgentJobView, type JobPillTone } from "./agent-job-view";

/**
 * One card for a running build on /app/tasks (plan §A2, "Another Task").
 * Ports the TaskCard visual language: icon disc, a title that opens the
 * dialog, a meta line, and a status pill in place of the Next/Off chip.
 * Unlike a scheduled task there is no on/off switch; a build is steered
 * from inside the overlay. The card is generic over job skills; only the
 * disc icon and the meta-line noun are skill-flavored.
 */

function JobIcon({ skill }: { skill: string }) {
  return skill === "curriculum-studio" ? <Icon name="book" size={20} /> : <Icon name="tasks" size={20} />;
}

const STATUS_TONE: Record<JobPillTone, "attention" | "constructive" | "info"> = {
  attention: "attention",
  building: "constructive",
  muted: "info",
};

export function AgentJobCard({ job, timeZone }: { job: AgentJobView; timeZone: string }) {
  const [open, setOpen] = useState(false);
  const pill = jobPill(job.status);
  const calm = job.status !== "paused";

  return (
    <>
      <QuietFrame
        as="article"
        onClick={() => setOpen(true)}
        className="quiet-task-card group flex cursor-pointer flex-col p-4 transition duration-(--dur-fast) ease-out hover:border-[var(--homa-midnight-action)] motion-safe:active:scale-[var(--press-scale)]"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={
              calm
                ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--homa-radius-control)] bg-[var(--homa-highlight-tint)] text-[var(--homa-highlight-ink)]"
                : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--homa-radius-control)] bg-[var(--homa-canvas)] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
            }
          >
            <JobIcon skill={job.skill} />
          </span>
          <div className="min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="text-left font-semibold text-[color:var(--homa-ink)]"
            >
              {job.title}
            </button>
            <p className="mt-0.5 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">{jobMetaLine(job, timeZone)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <QuietStatus tone={STATUS_TONE[pill.tone]} className="quiet-task-status px-2.5 py-1 text-[0.7rem] font-bold">
            {pill.label}
          </QuietStatus>
          <Icon name="next" size={16} className="shrink-0 text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))] transition-transform duration-(--dur-fast) ease-out group-hover:translate-x-0.5" />
        </div>
      </QuietFrame>
      {open ? <AgentJobOverlay job={job} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
