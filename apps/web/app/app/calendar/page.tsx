import { redirect, permanentRedirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { parseWeekOffset } from "../../../lib/calendar-view";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { addDaysDateOnly, todayDateOnly } from "../../../lib/unified-planner";

/** Compatibility door for old bookmarks. Planner is now canonical. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const query = await searchParams;
  const rawWeek = Array.isArray(query.week) ? query.week[0] : query.week;
  const weekOffset = parseWeekOffset(rawWeek);
  const timeZone = effectiveTimeZone(data.family.time_zone);
  const today = todayDateOnly(new Date(), timeZone);
  const date = addDaysDateOnly(today, weekOffset * 7);
  permanentRedirect(`/app/planner?view=week&date=${date}`);
}
