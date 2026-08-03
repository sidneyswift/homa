"use client";

/**
 * The live-assembling report (UX review 2026-07-06, approved in full): the
 * entry screen sells the flow with a report preview, then the preview
 * vanishes for the whole questionnaire, exactly when motivation is spent.
 * This rail keeps the artifact on screen and visibly fills it in as she
 * answers, so every tap reads as progress toward the thing she came for.
 *
 * Same visual language as report-preview.tsx (info header, constructive for
 * done, coral for in progress), just quieter: no tilt, shadow-sm only
 * (the question card must carry the screen's strongest elevation; this
 * is a companion, not a hero). Desktop-only: small screens get a single
 * hairline progress bar in the checklist header instead (second-pass
 * simplification 2026-07-06, "still seems like a lot going on": the
 * one-line strip that used to render here was a second progress row).
 * Each check-in lands with a soft ~200ms scale/fade (.rail-check in
 * globals.css, reduced-motion aware): the rail filling in IS the
 * delight, so each one should visibly land.
 *
 * Follow-up (2026-07-07, "what info is unneeded"): naming all 16
 * subjects up front, most of them empty circles she hasn't reached
 * yet, read like a syllabus and undercut the entry page's "5 minutes"
 * promise with a literal "16 subjects to go". Done and current subjects
 * still show by name (that's the payoff, watching it fill in), but
 * everything still upcoming collapses into one "+ N more" line instead
 * of itemizing subjects she has no context for yet. The old footer
 * ("N subjects to go") is redundant with that line now, so it only
 * shows once for the actual finish, "All subjects placed".
 */

export interface RailSubject {
  id: string;
  name: string;
  status: "done" | "current" | "upcoming";
}

export function ReportRail({ childName, subjects }: { childName: string; subjects: RailSubject[] }) {
  const done = subjects.filter((subject) => subject.status === "done").length;
  const remaining = subjects.length - done;
  // Named individually: done (the payoff) and current (where she is).
  // Order preserved from `subjects`, not regrouped, since a domain's
  // position in the plan is meaningful.
  const visibleSubjects = subjects.filter((subject) => subject.status !== "upcoming");
  const upcomingCount = subjects.length - visibleSubjects.length;

  return (
    <aside data-brand-layer="report-rail" aria-label={`${childName}'s report, assembling`} className="hidden lg:block">
      <div className="sticky top-8 overflow-hidden rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] shadow-sm">
        <div className="px-4 pb-3 pt-3.5" style={{ background: "var(--homa-info-tint)" }}>
          <p
            className="font-mono text-[0.5625rem] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--homa-info-ink)" }}
          >
            Building as you answer
          </p>
          <p className="mt-0.5 font-display text-sm font-bold leading-tight text-strong">
            {childName}&apos;s <span style={{ color: "var(--homa-brand-text)" }}>progress report</span>
          </p>
        </div>
        <ul className="px-4 py-3">
          {visibleSubjects.map((subject) => (
            <li key={subject.id} className="flex items-center gap-2 py-[3px] text-xs">
              {subject.status === "done" ? (
                <span aria-hidden="true" className="rail-check w-3.5 text-center font-bold text-[var(--homa-constructive-ink)]">
                  {"\u2713"}
                </span>
              ) : (
                <span aria-hidden="true" className="w-3.5 text-center font-bold text-[var(--homa-visual-coral)]">
                  {"\u25cf"}
                </span>
              )}
              <span
                className={`transition-colors duration-(--dur-base) ease-out ${
                  subject.status === "done" ? "font-medium text-strong" : "font-semibold text-strong"
                }`}
              >
                {subject.name}
              </span>
            </li>
          ))}
          {upcomingCount > 0 ? (
            <li className="flex items-center gap-2 py-[3px] text-xs text-subtle">
              <span aria-hidden="true" className="w-3.5 text-center">
                {"\u25cb"}
              </span>
              <span>
                + {upcomingCount} more subject{upcomingCount === 1 ? "" : "s"}
              </span>
            </li>
          ) : null}
        </ul>
        {remaining === 0 ? (
          <p className="border-t border-[var(--homa-soft-boundary)] px-4 py-2.5 text-center text-[0.6875rem] text-[var(--homa-muted-ink)]">
            All subjects placed
          </p>
        ) : null}
      </div>
    </aside>
  );
}
