import Link from "next/link";

import { ReportSnapshot } from "../../app/onboarding/r/[token]/report-snapshot";
import {
  buildProgressTiles,
  progressUpdatedLine,
} from "../../lib/child-progress/map-model";
import type { ChildProgressView } from "../../lib/child-progress/types";
import { progressEmptyState } from "../../lib/child-progress/view-copy";
import type { DashboardReport } from "../../lib/dashboard";
import type { TrajectoryEra } from "../../lib/map/trajectory-eras";
import { KidAvatar } from "../dashboard/kid-avatar";
import { PageColumn } from "../dashboard/page-column";
import { AskHomaAboutChild } from "./ask-homa-about-child";
import { ProgressMap } from "./progress-map";

/**
 * The live Progress page in the founder-chosen refined shape
 * (plans/2026-07-12-progress-tab-refined.html): a bare header with the
 * freshness line and the report door, the report's own trajectory chart,
 * then the subject map. Tiles open a detail panel (ProgressMap); the
 * stacked subject cards and the intro sentence retired with this layout.
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
}: {
  view: ChildProgressView;
  /**
   * The child's permanent token report, kept available by the
   * agent-led-live-progress ruling. Null when no report exists yet.
   */
  reportHref: string | null;
  /** The child's report row (chart history and movement); null before
   * the first scoring. */
  report: Pick<DashboardReport, "scores" | "generatedAt" | "history"> | null;
  /** The trajectory chart's scorings, oldest first, live last,
   * re-normalized server-side (lib/map/trajectory-eras). Empty before
   * the first scoring. */
  eras: TrajectoryEra[];
  /** The family's kids in family order (drives the switcher's tones). */
  kids: ProgressViewKid[];
}) {
  const updatedLine = progressUpdatedLine(view);
  const tiles = buildProgressTiles(view, report?.history[0], new Date());

  const generatedDate = report
    ? new Date(report.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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

        {view.subjects.length === 0 ? (
          <div className="mt-7">
            <ProgressEmptyState
              childId={view.childId}
              childName={view.childName}
            />
          </div>
        ) : (
          <>
            {report && generatedDate && eras.length > 0 ? (
              <ReportSnapshot
                childName={view.childName}
                birthMonth={view.birthDate}
                generatedDate={generatedDate}
                eras={eras}
                className="mt-6"
              />
            ) : null}

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
                />
              </div>
            </div>
          </>
        )}
      </div>
    </PageColumn>
  );
}
