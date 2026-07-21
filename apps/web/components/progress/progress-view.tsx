import Link from "next/link";

import { ReportSnapshot } from "../../app/onboarding/r/[token]/report-snapshot";
import {
  buildProgressTiles,
  progressUpdatedLine,
} from "../../lib/child-progress/map-model";
import type { ChildProgressView } from "../../lib/child-progress/types";
import {
  progressAssessmentCta,
  progressEmptyState,
} from "../../lib/child-progress/view-copy";
import type { DashboardReport } from "../../lib/dashboard";
import type { TrajectoryEra } from "../../lib/map/trajectory-eras";
import { buildTrajectoryStory } from "../../lib/map/trajectory-story";
import { KidAvatar } from "../dashboard/kid-avatar";
import { PageColumn } from "../dashboard/page-column";
import { AskHomaAboutChild } from "./ask-homa-about-child";
import { LessonsCard, type ProgressLessonsCardData } from "./lessons-card";
import { ProgressMap } from "./progress-map";
import { ProgressSubjects } from "./progress-subjects";
import type { SubjectDoorRow } from "./subject-door-context";

/**
 * The live Progress page: a bare header with the freshness line and the
 * report door, then ONE subject card (founder ask 2026-07-13): the
 * snapshot chart whose legend rows are the subject-by-subject list,
 * each row opening the subject's detail panel. The separate tile grid
 * renders only when no chart exists yet (no scoring), so every subject
 * keeps a door; the meaning box and the second card retired with this
 * merge.
 */

export interface ProgressViewKid {
  id: string;
  name: string;
  /** The kid's profile photo (migration #75); null keeps the initial. */
  avatarUrl: string | null;
}

function ProgressEmptyState({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const copy = progressEmptyState(childName);

  return (
    <section
      aria-labelledby="progress-empty-heading"
      className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-6 shadow-sm"
    >
      <h2
        id="progress-empty-heading"
        className="font-display text-xl font-semibold text-strong"
      >
        {copy.heading}
      </h2>
      <p className="mt-2 max-w-2xl text-body">{copy.body}</p>
      <div className="mt-5">
        <AskHomaAboutChild
          childId={childId}
          childName={childName}
          variant="primary"
        />
      </div>
    </section>
  );
}

/**
 * Never assessed: no report yet and nothing shared. Offer the first
 * check-in, the onboarding checklist deep-linked to THIS child via
 * `?start`, so the parent lands straight on their questions (the report's
 * "map next kid" card uses the same link). Ask HOMA stays as a quieter
 * second door for parents who would rather talk it through.
 */
function AssessmentCta({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const copy = progressAssessmentCta(childName);

  return (
    <section
      aria-labelledby="progress-assessment-heading"
      className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-6 shadow-sm"
    >
      <h2
        id="progress-assessment-heading"
        className="font-display text-xl font-semibold text-strong"
      >
        {copy.heading}
      </h2>
      <p className="mt-2 max-w-2xl text-body">{copy.body}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link
          href={`/onboarding?start=${childId}`}
          className="inline-flex min-h-11 items-center rounded-pill bg-[var(--brand-active)] px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-[var(--clay-600)]"
        >
          {copy.cta}
        </Link>
        <AskHomaAboutChild
          childId={childId}
          childName={childName}
          variant="secondary"
        />
      </div>
    </section>
  );
}

/** The in-page sibling switcher (same pattern as the kid page's), so a
 * phone visitor can reach the other kid without the drawer. */
function KidSwitcher({
  kids,
  currentChildId,
}: {
  kids: ProgressViewKid[];
  currentChildId: string;
}) {
  if (kids.length < 2) return null;
  return (
    <nav aria-label="Switch kid" className="mt-4 flex flex-wrap gap-2">
      {kids.map((kid, index) => {
        const current = kid.id === currentChildId;
        return (
          <Link
            key={kid.id}
            href={`/app/${kid.id}/progress`}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3.5 py-1.5 text-sm font-bold text-[var(--clay-700)]"
                : "inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-card px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-body"
            }
          >
            <KidAvatar name={kid.name} index={index} avatarUrl={kid.avatarUrl} size={20} />
            {kid.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProgressView({
  view,
  reportHref,
  report,
  eras,
  kids,
  lessons = null,
  deeperChecks = true,
}: {
  view: ChildProgressView;
  /**
   * The child's permanent token report, kept available by the
   * agent-led-live-progress ruling. Null when no report exists yet.
   */
  reportHref: string | null;
  /** The child's report row (the chart card's scoring date); null
   * before the first scoring. */
  report: Pick<DashboardReport, "generatedAt"> | null;
  /** The trajectory chart's scorings, oldest first, live last,
   * re-normalized server-side (lib/map/trajectory-eras). Empty before
   * the first scoring. */
  eras: TrajectoryEra[];
  /** The family's kids in family order (drives the switcher's tones). */
  kids: ProgressViewKid[];
  /** The lesson-listen door and this child's latest reviews. Null while
   * the flag is off, and absent on read-only mirrors, which have no
   * business offering a recording door. */
  lessons?: ProgressLessonsCardData | null;
  /** False on read-only mirrors (the founder console): the subject
   * panel's deep-dive door walks the family's own flow, so only her
   * session offers it. */
  deeperChecks?: boolean;
}) {
  const now = new Date();
  const updatedLine = progressUpdatedLine(view, now);
  const tiles = buildProgressTiles(view, now);

  const generatedDate = report
    ? new Date(report.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // The merged card needs a chart with at least one plottable line;
  // before the first scoring the tile grid stays, so subjects keep
  // their doors either way.
  const hasChart =
    report !== null &&
    generatedDate !== null &&
    eras.length > 0 &&
    buildTrajectoryStory(eras).subjects.length > 0;
  const doorRows: SubjectDoorRow[] = tiles.map((tile) => ({
    subjectId: tile.subjectId,
    displayName: tile.displayName,
    needsConfirm: tile.needsConfirm,
  }));

  // A child with no subjects and no report has never been assessed, so
  // the first check-in stays the page's one ask and the recording door
  // waits below it. Every other child sees the door up top.
  const neverAssessed = view.subjects.length === 0 && report === null;

  return (
    <PageColumn>
      <div className="mx-auto w-full max-w-[var(--container-md)]">
        <header>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              {updatedLine ? (
                <p
                  className={
                    updatedLine.today
                      ? "font-mono text-[0.68rem] font-bold uppercase tracking-widest text-[var(--sage-700)]"
                      : "font-mono text-[0.68rem] font-bold uppercase tracking-widest text-subtle"
                  }
                >
                  {updatedLine.label}
                </p>
              ) : null}
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-0.015em] text-strong sm:text-4xl">
                {view.childName}&apos;s progress
              </h1>
            </div>
            {reportHref ? (
              <Link
                href={reportHref}
                className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
              >
                Open the full report
              </Link>
            ) : null}
          </div>
          <KidSwitcher kids={kids} currentChildId={view.childId} />
        </header>

        {/* Directly under the header, where a parent looking for it will
            find it. It shipped below the chart first and was invisible
            in practice (2026-07-21): on a scored child the chart plus a
            dozen subject rows push it a full screen down, with nothing
            above hinting it exists. */}
        {lessons && !neverAssessed ? <LessonsCard card={lessons} /> : null}

        {view.subjects.length === 0 ? (
          <div className="mt-7">
            {report === null ? (
              // No report and nothing shared: this child has never been
              // assessed, so offer the first check-in rather than the
              // waiting-for-answers empty state.
              <AssessmentCta
                childId={view.childId}
                childName={view.childName}
              />
            ) : (
              <ProgressEmptyState
                childId={view.childId}
                childName={view.childName}
              />
            )}
          </div>
        ) : hasChart && generatedDate ? (
          <div className="mt-6">
            <ProgressSubjects
              childId={view.childId}
              subjects={view.subjects}
              tiles={tiles}
              conflicts={view.conflicts}
              timeZone={view.timeZone}
              deeperChecks={deeperChecks}
            >
              <ReportSnapshot
                childName={view.childName}
                birthMonth={view.birthDate}
                generatedDate={generatedDate}
                eras={eras}
                className=""
                doorRows={doorRows}
              />
            </ProgressSubjects>
          </div>
        ) : (
          <div className="mt-7">
            <h2 className="font-display text-xl font-semibold text-strong">
              Subject by subject
            </h2>
            <div className="mt-3">
              <ProgressMap
                childId={view.childId}
                tiles={tiles}
                subjects={view.subjects}
                conflicts={view.conflicts}
                timeZone={view.timeZone}
                deeperChecks={deeperChecks}
              />
            </div>
          </div>
        )}

        {lessons && neverAssessed ? <LessonsCard card={lessons} /> : null}
      </div>
    </PageColumn>
  );
}
