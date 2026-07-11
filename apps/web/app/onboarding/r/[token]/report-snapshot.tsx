import type { GrowthEra } from "./growth-story";
import { ChartLightbox } from "./chart-lightbox";
import { ReportTrajectory } from "./report-trajectory";

/**
 * The snapshot: the trajectory chart with one sentence about what it
 * shows, tap to view it larger (founder ask 2026-07-08: the old
 * snapshot's strengths / growing / closest-to-age lists and meta lines
 * repeated what the header, the whole picture, and the subject cards
 * already say; the chart is the part that earns the spot). The chart
 * itself marks today and the armed re-check, so no extra caption rows.
 * Pure display over already-computed scores; nothing here writes.
 */
export function ReportSnapshot({
  childName,
  generatedDate,
  plans,
  eras,
  className = "mt-4",
}: {
  childName: string;
  /** Already formatted, e.g. "July 8, 2026" (matches the header band). */
  generatedDate: string;
  plans: { subjectId: string; done: number; total: number; retestAt: string }[];
  /** Oldest first, the live report last (report-view's eras). */
  eras: GrowthEra[];
  /** Outer spacing, owned by the layout: the letter-style page flows
   * this below the note (mt-4, the default); the in-app dashboard grid
   * spaces cards itself and passes "". */
  className?: string;
}) {
  const now = new Date().getTime();
  const nextRecheck = plans
    .map((plan) => new Date(plan.retestAt))
    .filter((date) => date.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className={`rounded-lg bg-[var(--surface-sunken)] p-5 ${className}`.trim()}>
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
        {childName}&apos;s snapshot {"\u00b7"} {generatedDate}
      </p>
      <p className="mt-1 text-sm text-muted">
        {/* Explicit join: Turbopack's SWC JSX transform strips the leading
            space of a multi-line text node right after an expression,
            which rendered "Mayamoves". */}
        One line per subject, climbing as {childName}
        {" "}moves past what&apos;s typical for their age.
      </p>
      <div className="mt-3">
        <ChartLightbox title={`${childName}'s months ahead, by subject`}>
          <div className="rounded-md border border-border-subtle bg-card p-3 sm:p-4">
            <ReportTrajectory
              childName={childName}
              eras={eras}
              nextRecheckAt={nextRecheck ? nextRecheck.toISOString() : null}
            />
          </div>
        </ChartLightbox>
      </div>
    </div>
  );
}
