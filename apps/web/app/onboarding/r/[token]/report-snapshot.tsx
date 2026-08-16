import { QuietFrame } from "../../../../components/design";
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
  generatedDate,
  eras,
  className = "mt-4",
  doorRows,
}: {
  childName: string;
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
  const nextSubject = story.subjects.find((subject) => subject.position === "growing") ?? null;

  if (story.subjects.length === 0) return null;

  return (
    <QuietFrame
      as="div"
      tone="mineral"
      data-brand-layer="report-snapshot"
      className={`quiet-report__snapshot p-5 ${className}`.trim()}
    >
      <p className="quiet-report__eyebrow">
        {childName}&apos;s snapshot {"\u00b7"} {generatedDate}
      </p>
      <p className="quiet-report__caption">{story.caption}</p>
      {nextSubject ? (
        <div className="quiet-report__next-step mt-3">
          <p className="quiet-report__next-step-label">Next skill</p>
          <p className="quiet-report__next-step-copy">
            {nextSubject.name} is growing right now.
            {nextSubject.frontierStatement ? ` Try: ${nextSubject.frontierStatement}` : " Homa can make the next practice simple."}
          </p>
        </div>
      ) : null}
      <div className="mt-3">
        <TrajectoryChart
          story={story}
          childName={childName}
          now={new Date().getTime()}
          doorRows={doorRows}
        />
      </div>
      {/* The dotted-stretch caption lives with the chart, not in the card
          body: the copy-editor gate holds body copy to its two-sentence
          budget, and the dots this explains are right above it. */}
      {showsScaleChange ? (
        <p className="quiet-report__fine-print">
          The dotted part uses a newer check-in approach. It does not mean {childName} changed.
        </p>
      ) : null}
    </QuietFrame>
  );
}
