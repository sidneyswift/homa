import type {
  OpenProgressConflictView,
  ProgressSubjectView,
} from "../../lib/child-progress/types";
import {
  progressSubjectHeadline,
  progressSubjectSummary,
} from "../../lib/child-progress/view-copy";
import { ProgressDomain } from "./progress-domain";

const SUBJECT_STATE_TONES: Record<
  ProgressSubjectView["state"],
  { background: string; color: string }
> = {
  updated_recently: {
    background: "var(--accent-sage-soft)",
    color: "var(--sage-700)",
  },
  older: {
    background: "var(--info-soft)",
    color: "var(--pop-navy)",
  },
  conflict: {
    background: "var(--gold-100)",
    color: "var(--gold-ink)",
  },
};

export function ProgressSubject({
  subject,
  conflicts,
  timeZone,
}: {
  subject: ProgressSubjectView;
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
}) {
  const headingId = `progress-subject-${subject.subjectId}`;
  const summary = progressSubjectSummary(subject, timeZone);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-border-subtle bg-[var(--surface-raised)] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id={headingId}
          className="font-display text-2xl font-semibold tracking-[-0.015em] text-strong"
        >
          {subject.displayName}
        </h2>
        <span
          className="w-fit rounded-pill px-3 py-1.5 text-sm font-semibold"
          style={SUBJECT_STATE_TONES[subject.state]}
        >
          {progressSubjectHeadline(subject.state)}
        </span>
      </div>
      {summary ? (
        <p className="mt-2 text-sm leading-relaxed text-body">
          {summary}
        </p>
      ) : null}

      <div className="mt-5 space-y-6">
        {subject.domains.map((domain) => (
          <ProgressDomain
            key={domain.domainId}
            domain={domain}
            conflicts={conflicts}
            timeZone={timeZone}
          />
        ))}
      </div>
    </section>
  );
}
