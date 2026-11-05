import { getAppData } from "../../../../lib/app-data";
import { getFamilyEventsForFamily } from "../../../../lib/family-events-read";
import { getHoursLogForFamilyBetween } from "../../../../lib/hours";
import { toHoursEntries } from "../../../../lib/hours-view";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { getPlannerLearningActivitiesForFamily } from "../../../../lib/planner-learning-activities-read";
import { getScheduledActivitiesForFamily } from "../../../../lib/plan-schedule-read";
import { loadWorkspacePlanner } from "../../../../lib/workspace-planner-data";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request): Promise<Response> {
  if (rateLimited(`workspace-planner:${clientIp(request)}`, 120)) return Response.json({ ok: false }, { status: 429, headers });
  try {
    // Same admission and caller-RLS readers as /app/planner. No service-role client.
    const data = await getAppData();
    if (!data) return Response.json({ ok: false, reason: "access" }, { status: 403, headers });
    const board = await loadWorkspacePlanner(data, new URL(request.url).searchParams, {
      events: getFamilyEventsForFamily, schedule: getScheduledActivitiesForFamily, learning: getPlannerLearningActivitiesForFamily,
      hours: async (familyId, start, end, children) => toHoursEntries(await getHoursLogForFamilyBetween(familyId, start, end), children),
    });
    return Response.json({ ok: true, board }, { headers });
  } catch {
    return Response.json({ ok: false, reason: "unavailable" }, { status: 502, headers });
  }
}
