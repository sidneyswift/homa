import { ageInMonths } from "@homa/core";

import type { SubjectDoorRow } from "../../../../components/progress/subject-door-context";
import {
  trajectoryHasScaleChange,
  type TrajectoryEra,
} from "../../../../lib/map/trajectory-eras";
import { buildTrajectoryStory } from "../../../../lib/map/trajectory-story";
import { TrajectoryChart } from "./trajectory-chart";

/**
 * The snapshot: the interactive trajectory chart with a caption the data
 * writes itself (2026-07-13 pass, from the trajectory-chart directions
 * lab). The caption names what actually moved this week; the chart's
 * legend card names everything else, so the card never repeats what the
 * header and the subject cards already say. The tap-to-enlarge lightbox
 * retired with this pass: focusing a subject on the chart itself is the
 * closer look. When any stretch of the line crosses a measurement
 * change (dotted on the chart, mixed-scales fix 2), a short caption
 * under the chart says what the dots mean. Pure display over
 * already-computed scores; nothing here writes.
 */
export function ReportSnapshot({
  childName,
  birthMonth,
  generatedDate,
  eras,
  className = "mt-4",
  doorRows,
}: {
  childName: string;
  /** "YYYY-MM-DD" (or "YYYY-MM"), for the meaning box's age sentence. */
  birthMonth: string;
  /** Already formatted, e.g. "July 8, 2026" (matches the header band). */
  generatedDate: string;
  /** Oldest first, the live report last (lib/map/trajectory-eras). */
  eras: TrajectoryEra[];
  /** Outer spacing, owned by the layout: the letter-style page flows
   * this below the note (mt-4, the default); the in-app dashboard grid
   * spaces cards itself and passes "". */
  className?: string;
  /** Live Progress only: the subject rows that turn the legend card
   * into the subject-by-subject list (see subject-door-context). */
  doorRows?: SubjectDoorRow[];
}) {
  const story = buildTrajectoryStory(eras);
  const showsScaleChange = trajectoryHasScaleChange(eras);
  const childAgeYears = Math.floor(ageInMonths(birthMonth) / 12);

  if (story.subjects.length === 0) return null;

  return (
    <div className={`rounded-lg bg-[var(--surface-sunken)] p-5 ${className}`.trim()}>
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
        {childName}&apos;s snapshot {"\u00b7"} {generatedDate}
      </p>
      <p className="mt-1 text-sm text-muted">{story.caption}</p>
      <div className="mt-3">
        <TrajectoryChart
          story={story}
          childName={childName}
          childAgeYears={childAgeYears}
          now={new Date().getTime()}
          doorRows={doorRows}
        />
      </div>
      {/* The dotted-stretch caption lives with the chart, not in the card
          body: the copy-editor gate holds body copy to its two-sentence
          budget, and the dots this explains are right above it. */}
      {showsScaleChange ? (
        <p className="mt-2 text-xs text-muted">
          A dotted stretch means we improved how we measure, not that
          {" "}{childName} changed. Every number you see now is measured the
          new way.
        </p>
      ) : null}
    </div>
  );
}
