"use client";

import { QuietFrame } from "../../components/design";

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

export function ReportRail({
  childName,
  subjects,
  contentOnly = false,
  headingId,
}: {
  childName: string;
  subjects: RailSubject[];
  /** The stage-context composition owns the semantic aside. */
  contentOnly?: boolean;
  headingId?: string;
}) {
  const done = subjects.filter((subject) => subject.status === "done").length;
  const remaining = subjects.length - done;
  // Named individually: done (the payoff) and current (where she is).
  // Order preserved from `subjects`, not regrouped, since a domain's
  // position in the plan is meaningful.
  const visibleSubjects = subjects.filter((subject) => subject.status !== "upcoming");
  const upcomingCount = subjects.length - visibleSubjects.length;

  const content = (
      <QuietFrame as="div" tone="paper" className="quiet-report-rail sticky top-8 overflow-hidden">
        <div className="quiet-report-rail__header">
          <p className="quiet-report-rail__eyebrow">
            Building as you answer
          </p>
          <p id={headingId} className="quiet-report-rail__title">
            {childName}&apos;s <span className="quiet-report-rail__title-accent">progress report</span>
          </p>
        </div>
        <ul className="quiet-report-rail__list">
          {visibleSubjects.map((subject) => (
            <li key={subject.id} className="quiet-report-rail__item">
              {subject.status === "done" ? (
                <span aria-hidden="true" className="quiet-report-rail__mark quiet-report-rail__mark--done rail-check">
                  {"\u2713"}
                </span>
              ) : (
                <span aria-hidden="true" className="quiet-report-rail__mark quiet-report-rail__mark--current">
                  {"\u25cf"}
                </span>
              )}
              <span className={`quiet-report-rail__subject ${subject.status === "done" ? "quiet-report-rail__subject--done" : ""}`.trim()}>
                {subject.name}
              </span>
            </li>
          ))}
          {upcomingCount > 0 ? (
            <li className="quiet-report-rail__item quiet-report-rail__item--upcoming">
              <span aria-hidden="true" className="quiet-report-rail__mark">
                {"\u25cb"}
              </span>
              <span>
                + {upcomingCount} more subject{upcomingCount === 1 ? "" : "s"}
              </span>
            </li>
          ) : null}
        </ul>
        {remaining === 0 ? (
          <p className="quiet-report-rail__footer">
            All subjects placed
          </p>
        ) : null}
      </QuietFrame>
  );

  if (contentOnly) return content;

  return (
    <aside data-brand-layer="report-rail" aria-label={`${childName}'s report, assembling`} className="hidden lg:block">
      {content}
    </aside>
  );
}
