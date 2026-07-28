"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, Layers } from "lucide-react";

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
  return skill === "curriculum-studio" ? <BookOpen size={18} /> : <Layers size={18} />;
}

const PILL_CLASS: Record<JobPillTone, string> = {
  attention: "bg-brand-soft text-[var(--clay-700)]",
  building: "bg-[var(--sage-50)] text-[var(--sage-700)]",
  muted: "bg-[var(--brand-soft-2)] text-muted",
};

export function AgentJobCard({ job, timeZone }: { job: AgentJobView; timeZone: string }) {
  const [open, setOpen] = useState(false);
  const pill = jobPill(job.status);
  const calm = job.status !== "paused";

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="group flex cursor-pointer flex-col rounded-lg border border-border-subtle bg-card p-4 shadow-sm transition duration-(--dur-fast) ease-out hover:border-[var(--clay-300)] motion-safe:active:scale-[var(--press-scale)]"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={
              calm
                ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand"
                : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-[var(--brand-soft-2)] text-subtle"
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
              className="text-left font-semibold text-strong"
            >
              {job.title}
            </button>
            <p className="mt-0.5 text-sm text-muted">{jobMetaLine(job, timeZone)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className={`rounded-pill px-2.5 py-1 text-[0.7rem] font-bold ${PILL_CLASS[pill.tone]}`}
          >
            {pill.label}
          </span>
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="shrink-0 text-subtle transition-transform duration-(--dur-fast) ease-out group-hover:translate-x-0.5"
          />
        </div>
      </div>
      {open ? <AgentJobOverlay job={job} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
