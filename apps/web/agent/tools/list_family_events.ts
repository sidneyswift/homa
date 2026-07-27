import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { getChildrenPinned } from "../../lib/agent-pinned";
import { listFamilyEventsPinned } from "../../lib/family-events";
import { mapDb } from "../../lib/map/db";
import { effectiveTimeZone, zonedDateString } from "../../lib/time-zone";

/**
 * Read-only view of the family calendar (issue #176, CG-03), so Homa can
 * answer "what's on the calendar" or check before adding a new event
 * without guessing. Reads always run on the server connection with an
 * explicit family_id predicate, the same posture as open_planner's
 * getPlanBoard, regardless of whether this session is a caller-JWT web
 * session or a pinned channel like SMS.
 */

function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export default defineBoundedTool({
  description:
    "List upcoming events on the family calendar: appointments, trips, co-op days, anything added with add_family_event. Use before adding a new event (to avoid a duplicate) or when the parent asks what is coming up. Read-only; add or remove with add_family_event / remove_family_event.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z
    .object({
      daysAhead: z
        .number()
        .int()
        .min(1)
        .max(90)
        .default(30)
        .describe("How many days out to look, starting today. Defaults to 30."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { events: [], note: error.message };
      }
      throw error;
    }

    const sql = mapDb();
    const familyRows = await sql<{ time_zone: string | null }[]>`
      select time_zone from public.families where id = ${familyId}
    `;
    const timeZone = effectiveTimeZone(familyRows[0]?.time_zone);
    const today = zonedDateString(new Date(), timeZone);
    const toDate = addDays(today, input.daysAhead);

    const [events, children] = await Promise.all([
      listFamilyEventsPinned(familyId, today, toDate),
      getChildrenPinned(familyId),
    ]);
    const nameById = new Map(children.map((child) => [child.id, child.name]));

    return {
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        childId: event.childId,
        childName: event.childId ? (nameById.get(event.childId) ?? null) : null,
        startsOn: event.startsOn,
        endsOn: event.endsOn,
        startTime: event.startTime,
        endTime: event.endTime,
        note: event.note,
      })),
      note:
        events.length === 0
          ? `Nothing on the calendar in the next ${input.daysAhead} days.`
          : "A null childId means a whole-family event.",
    };
  },
});
