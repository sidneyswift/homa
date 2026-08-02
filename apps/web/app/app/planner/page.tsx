import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PageColumn } from "../../../components/dashboard/page-column";
import { getAppData } from "../../../lib/app-data";
import { getFamilyEventsForFamily } from "../../../lib/family-events-read";
import { getHoursLogForFamily } from "../../../lib/hours";
import { scopedToViewContext, toHoursEntries } from "../../../lib/hours-view";
import { emitMapEvent } from "../../../lib/map/events";
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
  }>;
}) {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children, reports, plans } = data;

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    children.map((child) => child.id),
  );
  const focusChildId = viewContext.kind === "child" ? viewContext.childId : null;

  const query = await searchParams;
  const timeZone = effectiveTimeZone(family.time_zone);
  const now = new Date();
  const today = todayDateOnly(now, timeZone);
  const activeDate = parsePlannerDate(query.date, today);
  const view = parsePlannerView(query.view);
  const range = view === "month"
    ? monthGridRangeForDate(activeDate, today)
    : weekRangeForDate(activeDate);

  // Calendar reads stay bounded to the visible view. Hours is the only
  // view that needs the full compliance record, so Day does not pay for
  // a 3,000-row hours query merely because Hours lives one tab away.
  const [familyEvents, scheduledActivities, hoursRows] = await Promise.all([
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
    view === "hours" ? getHoursLogForFamily(family.id) : Promise.resolve([]),
  ]);
  const hoursEntries = scopedToViewContext(
    toHoursEntries(hoursRows, children),
    viewContext,
  );

  await emitMapEvent("planner.viewed", {
    family_id: family.id,
    surface: "planner_page",
    client: "web",
  });

  return (
    <PageColumn>
      <UnifiedPlannerView
        kids={children.map((child) => ({
          id: child.id,
          name: child.name,
          avatar_url: child.avatar_url,
        }))}
        plans={plans}
        reports={reports}
        familyEvents={familyEvents}
        scheduledActivities={scheduledActivities}
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
