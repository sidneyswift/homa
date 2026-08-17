import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PageColumn } from "../../../components/dashboard/page-column";
import { getAppData, getAppShellData } from "../../../lib/app-data";
import { familyAccountGate } from "../../../lib/billing/wall";
import { getFamilyEventsForFamily } from "../../../lib/family-events-read";
import {
  getHoursLogForFamily,
  getHoursLogForFamilyBetween,
} from "../../../lib/hours";
import { scopedToViewContext, toHoursEntries } from "../../../lib/hours-view";
import { emitMapEvent } from "../../../lib/map/events";
import { getPlannerLearningActivitiesForFamily } from "../../../lib/planner-learning-activities-read";
import { getScheduledActivitiesForFamily } from "../../../lib/plan-schedule-read";
import { effectiveTimeZone } from "../../../lib/time-zone";
import {
  monthGridRangeForDate,
  parsePlannerDate,
  parsePlannerView,
  todayDateOnly,
  weekRangeForDate,
} from "../../../lib/unified-planner";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { FirstWeekHandoff } from "./first-week-handoff";
import { UnifiedPlannerView } from "./unified-planner-view";

/**
 * One parent-facing Planner for scheduled schoolwork, fixed family
 * events, and the Hours record. Day is the quiet default. Week, Month,
 * and Hours are explicit views of the same route and active date.
 */

export const metadata: Metadata = {
  title: "Planner",
  robots: { index: false },
};

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    date?: string | string[];
    child?: string | string[];
    handoff?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const view = parsePlannerView(query.view);
  const paidData = view === "hours" ? null : await getAppData();
  const data = paidData ?? (view === "hours" ? await getAppShellData() : null);
  if (!data) redirect("/onboarding");
  const { family, children } = data;
  const plans = paidData?.plans ?? [];

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    children.map((child) => child.id),
  );
  // A report can take a signed-in parent straight to this child's week.
  // The query is only a focus preference, never authority: it is accepted
  // only after checking against the authenticated family's loaded children.
  const queryChildId = typeof query.child === "string" ? query.child : null;
  const focusChildId = children.some((child) => child.id === queryChildId)
    ? queryChildId
    : viewContext.kind === "child"
      ? viewContext.childId
      : null;
  // A report can start this focused handoff, but the query cannot turn on a
  // child experience unless the child itself was authenticated above.
  const handoffChild = query.handoff === "report" && focusChildId !== null
    ? children.find((child) => child.id === focusChildId) ?? null
    : null;
  const timeZone = effectiveTimeZone(family.time_zone);
  const now = new Date();
  const today = todayDateOnly(now, timeZone);
  const activeDate = parsePlannerDate(query.date, today);
  const range = view === "month"
    ? monthGridRangeForDate(activeDate, today)
    : weekRangeForDate(activeDate);

  // Calendar and day-hours reads stay bounded to the visible range. Hours
  // alone loads the full compliance record.
  const [familyEvents, scheduledActivities, learningActivities, hoursRows] = await Promise.all([
    view === "hours"
      ? Promise.resolve([])
      : getFamilyEventsForFamily(family.id, range.start, range.end).catch((error: unknown) => {
          console.error(
            "planner: family_events read failed (migration may be unapplied):",
            error instanceof Error ? error.message : "unknown",
          );
          return [];
        }),
    view === "hours"
      ? Promise.resolve([])
      : getScheduledActivitiesForFamily(family.id, range.start, range.end).catch(
          (error: unknown) => {
            console.error(
              "planner: plan_activity_schedule read failed (migration may be unapplied):",
              error instanceof Error ? error.message : "unknown",
            );
            return [];
          },
        ),
    view === "hours"
      ? Promise.resolve([])
      : getPlannerLearningActivitiesForFamily(family.id, range.start, range.end).catch(
          (error: unknown) => {
            console.error(
              "planner: learning activity read failed (migration may be unapplied):",
              error instanceof Error ? error.message : "unknown",
            );
            return [];
          },
        ),
    view === "hours"
      ? getHoursLogForFamily(family.id)
      : getHoursLogForFamilyBetween(family.id, range.start, range.end).catch(
          (error: unknown) => {
            console.error(
              "planner: bounded hours_log read failed:",
              error instanceof Error ? error.message : "unknown",
            );
            return [];
          },
        ),
  ]);
  const allHoursEntries = toHoursEntries(hoursRows, children);
  const hoursEntries = view === "hours"
    ? scopedToViewContext(allHoursEntries, viewContext)
    : allHoursEntries;

  if (view === "hours") {
    const gate = await familyAccountGate(family.id);
    if (gate.checkout !== null && allHoursEntries.length === 0) {
      redirect("/onboarding/trial");
    }
  }

  await emitMapEvent("planner.viewed", {
    family_id: family.id,
    surface: "planner_page",
    client: "web",
  });

  return (
    <PageColumn>
      {handoffChild && view === "week" ? <FirstWeekHandoff child={handoffChild} /> : null}
      <UnifiedPlannerView
        kids={children.map((child) => ({
          id: child.id,
          name: child.name,
          avatar_url: child.avatar_url,
        }))}
        plans={plans}
        familyEvents={familyEvents}
        scheduledActivities={scheduledActivities}
        learningActivities={learningActivities}
        hoursEntries={hoursEntries}
        timeZone={timeZone}
        now={now}
        today={today}
        activeDate={activeDate}
        view={view}
        focusChildId={focusChildId}
      />
    </PageColumn>
  );
}
