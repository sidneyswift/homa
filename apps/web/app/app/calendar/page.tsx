import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { calendarWeekDates, parseWeekOffset } from "../../../lib/calendar-view";
import { getFamilyEventsForFamily } from "../../../lib/family-events-read";
import { getHoursLogForFamily } from "../../../lib/hours";
import { emitMapEvent } from "../../../lib/map/events";
import { getScheduledActivitiesForFamily } from "../../../lib/plan-schedule-read";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { PageColumn } from "../../../components/dashboard/page-column";
import { CalendarView } from "./calendar-view";

/**
 * /app/calendar (issue #176, CG-03: "calendar and homeschool planner in
 * one"). Same setup gates and view-context scoping as the rest of /app;
 * auth is enforced by proxy.ts, data access is enforced by RLS
 * regardless. This page only reads: family_events and
 * plan_activity_schedule are net-new tables from this same change,
 * applied to production 2026-07-26 (see the PR thread). The reads below
 * still fail closed to an empty week rather than erroring on any target
 * where the migration is somehow missing, exactly like any other family
 * with nothing on the calendar yet.
 */

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false },
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children, reports, plans } = data;

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    children.map((child) => child.id),
  );

  const { week } = await searchParams;
  const weekOffset = parseWeekOffset(week);
  const weekOffsetDays = weekOffset * 7;

  const timeZone = effectiveTimeZone(family.time_zone);
  const now = new Date();
  const days = calendarWeekDates(now, timeZone, weekOffsetDays);
  const fromDate = days[0].date;
  const toDate = days[days.length - 1].date;

  // family_events and plan_activity_schedule were applied to production
  // 2026-07-26 (confirmed in PR #232). The wrappers stay for targets
  // where the tables are missing (a fresh local database): those reads
  // fail closed to an empty week rather than a broken page, the same
  // honest "nothing here yet" a brand-new family would see. hours_log
  // (migration #37) is long-since live everywhere, so its read is not
  // wrapped: a real failure there should surface normally.
  const [familyEvents, scheduledActivities, hoursRows] = await Promise.all([
    getFamilyEventsForFamily(family.id, fromDate, toDate).catch((error: unknown) => {
      console.error(
        "calendar: family_events read failed (migration may be unapplied):",
        error instanceof Error ? error.message : "unknown",
      );
      return [];
    }),
    getScheduledActivitiesForFamily(family.id, fromDate, toDate).catch((error: unknown) => {
      console.error(
        "calendar: plan_activity_schedule read failed (migration may be unapplied):",
        error instanceof Error ? error.message : "unknown",
      );
      return [];
    }),
    getHoursLogForFamily(family.id),
  ]);

  // One planner arc instrumentation (issue #257 PR B0): both old week
  // surfaces count views, so the B1 flip has a baseline. Server-side
  // and best-effort, the same posture as map.plan_built's page emit.
  await emitMapEvent("planner.viewed", {
    family_id: family.id,
    surface: "calendar_page",
    client: "web",
  });

  return (
    <PageColumn>
      <CalendarView
        kids={children.map((child) => ({
          id: child.id,
          name: child.name,
          avatar_url: child.avatar_url,
        }))}
        plans={plans}
        reports={reports}
        familyEvents={familyEvents}
        scheduledActivities={scheduledActivities}
        hoursEntries={hoursRows.map((row) => ({
          childId: row.childId,
          happenedOn: row.happenedOn,
          minutes: row.minutes,
        }))}
        timeZone={timeZone}
        now={now}
        focusChildId={viewContext.kind === "child" ? viewContext.childId : null}
        weekOffset={weekOffset}
        familyName={family.name}
      />
    </PageColumn>
  );
}
