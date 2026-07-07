"use client";

/**
 * The live-assembling report (UX review 2026-07-06, approved in full): the
 * entry screen sells the flow with a report preview, then the preview
 * vanishes for the whole questionnaire, exactly when motivation is spent.
 * This rail keeps the artifact on screen and visibly fills it in as she
 * answers, so every tap reads as progress toward the thing she came for.
 *
 * Same visual language as report-preview.tsx (band-sky header, sage for
 * done, brand for in progress), just quieter: no tilt, shadow-sm only
 * (the question card must carry the screen's strongest elevation; this
 * is a companion, not a hero). Desktop-only: small screens get a single
 * hairline progress bar in the checklist header instead (second-pass
 * simplification 2026-07-06, "still seems like a lot going on": the
 * one-line strip that used to render here was a second progress row).
 * Each check-in lands with a soft ~200ms scale/fade (.rail-check in
 * globals.css, reduced-motion aware): the rail filling in IS the
 * delight, so each one should visibly land.
 */

export interface RailSubject {
  id: string;
  name: string;
  status: "done" | "current" | "upcoming";
}

export function ReportRail({ childName, subjects }: { childName: string; subjects: RailSubject[] }) {
  const done = subjects.filter((subject) => subject.status === "done").length;
  const remaining = subjects.length - done;

  return (
    <aside aria-label={`${childName}'s report, assembling`} className="hidden lg:block">
      <div className="sticky top-8 overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
        <div className="px-4 pb-3 pt-3.5" style={{ background: "var(--band-sky)" }}>
          <p
            className="font-mono text-[0.5625rem] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--pop-navy)" }}
          >
            Building as you answer
          </p>
          <p className="mt-0.5 font-display text-sm font-bold leading-tight text-strong">
            {childName}&apos;s <span style={{ color: "var(--clay-600)" }}>progress report</span>
          </p>
        </div>
        <ul className="px-4 py-3">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center gap-2 py-[3px] text-xs">
              {subject.status === "done" ? (
                <span aria-hidden="true" className="rail-check w-3.5 text-center font-bold text-sage">
                  {"\u2713"}
                </span>
              ) : subject.status === "current" ? (
                <span aria-hidden="true" className="w-3.5 text-center font-bold text-brand">
                  {"\u25cf"}
                </span>
              ) : (
                <span aria-hidden="true" className="w-3.5 text-center text-border-subtle">
                  {"\u25cb"}
                </span>
              )}
              <span
                className={`transition-colors duration-(--dur-base) ease-out ${
                  subject.status === "done"
                    ? "font-medium text-strong"
                    : subject.status === "current"
                      ? "font-semibold text-strong"
                      : "text-subtle"
                }`}
              >
                {subject.name}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-border-subtle px-4 py-2.5 text-center text-[0.6875rem] text-subtle">
          {remaining === 0
            ? "All subjects placed"
            : `${remaining} subject${remaining === 1 ? "" : "s"} to go`}
        </p>
      </div>
    </aside>
  );
}
