import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProgressUnavailable } from "../../../../components/progress/progress-unavailable";
import { ProgressView } from "../../../../components/progress/progress-view";
import { getAppData } from "../../../../lib/app-data";
import { familyWallCheckout, reportLockEnabled } from "../../../../lib/billing/wall";
import {
  getChildProgressLedger,
  getChildProgressView,
} from "../../../../lib/child-progress";
import { firstsPageFromLedger } from "../../../../lib/child-progress/firsts-from-ledger";
import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { abilitiesExplorerEnabled } from "../../../../lib/child-progress/abilities-explorer-flag";
import { buildAbilitiesExplorerPayload } from "../../../../lib/child-progress/abilities-explorer";
import { loadChildProgressPageState } from "../../../../lib/child-progress/page-state";
import { progressRoutePolicy } from "../../../../lib/child-progress/route-policy";
import { getHoursMinutesBySubjectForChild } from "../../../../lib/hours";
import { resolveHoursWindow } from "../../../../lib/hours-summary";
import { lessonListenEnabled } from "../../../../lib/lessons/flag";
import { listLessonsForChild } from "../../../../lib/lessons/store";
import { getTrajectoryEvidence } from "../../../../lib/map/store";
import {
  buildTrajectoryEras,
  type TrajectoryEra,
} from "../../../../lib/map/trajectory-eras";
import { effectiveTimeZone, zonedDateString } from "../../../../lib/time-zone";

export const metadata: Metadata = {
  title: "Progress",
  robots: { index: false },
};

export default async function ChildProgressPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const child = data.children.find((entry) => entry.id === childId);
  if (!child) notFound();

  // The wall (plans/2026-07-11-the-wall.md): used only for the route-policy
  // decision below, never passed into ProgressView. A family currently
  // owed the report lock is sent to /app/{childId}/report instead, which
  // already renders the locked experience; this page stays out of scope
  // for rendering the lock itself. A child with no report yet has
  // nothing to lock, so this mirrors report/page.tsx's own no-report
  // exception exactly (Boolean(token) gates both the wall read and
  // lockApplies), keeping the two pages' redirect decisions identical.
  const token = data.reports.get(childId)?.token;
  const wall = token ? await familyWallCheckout(data.family.id) : null;
  const lockApplies = Boolean(token) && Boolean(wall) && reportLockEnabled();

  const policy = progressRoutePolicy(
    { surface: "child_progress", childId },
    liveProgressEnabled() && !lockApplies,
  );
  if (policy.kind === "redirect") {
    redirect(policy.href);
  }

  const timeZone = effectiveTimeZone(data.family.time_zone);
  const today = zonedDateString(new Date(), timeZone);
  const hoursWindow = resolveHoursWindow("school_year", today, data.family.school_year_start_on);

  // Lessons, the firsts ledger, and this school year's Hours minutes
  // load alongside the view: all four need only the family and the
  // child already re-scoped above, so none waits on the others. The
  // ledger read is degraded to null on failure so it can only ever cost
  // the firsts door, never the Progress page; Hours degrades to an
  // empty map for the same reason (it is a display-only companion
  // figure, never load-bearing for the page itself).
  const [pageState, lessons, ledger, hoursMinutesBySubject] = await Promise.all([
    loadChildProgressPageState(
      {
        familyId: data.family.id,
        child: {
          id: child.id,
          name: child.name,
          birthDate: child.birth_month,
        },
        timeZone,
      },
      { loadView: getChildProgressView },
    ),
    lessonListenEnabled()
      ? listLessonsForChild(data.family.id, child.id, 5)
      : Promise.resolve([]),
    getChildProgressLedger(data.family.id, child.id).catch(() => null),
    getHoursMinutesBySubjectForChild(
      data.family.id,
      child.id,
      today,
      data.family.school_year_start_on,
    ).catch(() => ({})),
  ]);
  if (pageState.status === "unavailable") {
    console.error(
      "Live Progress could not load.",
      pageState.error,
    );
    return (
      <ProgressUnavailable
        childId={child.id}
        childName={child.name}
      />
    );
  }

  // The firsts door only renders when there is something behind it. A
  // door into an empty keepsake lands hardest on the child whose answers
  // were honest (all getting_there / not_yet, so not "never assessed"),
  // which is exactly who the celebration spec's named-worry rail
  // protects. hasFirsts is a boolean, never a count.
  const hasFirsts =
    ledger !== null &&
    firstsPageFromLedger({
      ledger,
      otherChildNames: data.children
        .filter((entry) => entry.id !== child.id)
        .map((entry) => entry.name),
    }).rows.length > 0;

  // The permanent token report stays reachable from live Progress
  // (agent-led-live-progress ruling: token and share reports remain).
  const report = data.reports.get(child.id) ?? null;

  const abilitiesExplorer = abilitiesExplorerEnabled()
    ? buildAbilitiesExplorerPayload(
        pageState.view,
        new Date(pageState.view.projectedAt),
      )
    : null;

  // The chart's eras, re-normalized to one measuring stick where the
  // evidence ledger reaches (mixed-scales fix 3). familyId comes from
  // the session and the child was re-scoped above, per the tenancy law.
  const eras: TrajectoryEra[] = report
    ? buildTrajectoryEras({
        archived: [...report.history].reverse(),
        live: { generated_at: report.generatedAt, scores: report.scores },
        evidence: await getTrajectoryEvidence(data.family.id, child.id),
        birthDate: child.birth_month,
      })
    : [];

  return (
    <ProgressView
      view={pageState.view}
      reportHref={report?.token ? `/onboarding/r/${report.token}` : null}
      report={report}
      eras={eras}
      hasFirsts={hasFirsts}
      kids={data.children.map((entry) => ({
        id: entry.id,
        name: entry.name,
        avatarUrl: entry.avatar_url,
      }))}
      lessons={
        lessonListenEnabled()
          ? {
              recordHref: `/app/${child.id}/lessons/record`,
              lessons: lessons.map((lesson) => ({
                id: lesson.id,
                status: lesson.status,
                startedAt: lesson.startedAt,
              })),
            }
          : null
      }
      abilitiesExplorer={abilitiesExplorer}
      hoursMinutesBySubject={hoursMinutesBySubject}
      hoursWindowLabel={hoursWindow.schoolYearFallback ? "all time through today" : "this school year"}
    />
  );
}
