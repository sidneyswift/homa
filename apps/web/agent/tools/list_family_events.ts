import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { getChildrenPinned } from "../../lib/agent-pinned";
import {
  familyEventChildIds,
  listFamilyEventsPinned,
  MAX_EVENT_WINDOW_DAYS,
  resolveEventWindow,
} from "../../lib/family-events";
import { mapDb } from "../../lib/map/db";
import { effectiveTimeZone, zonedDateString } from "../../lib/time-zone";

/**
 * Read-only view of the family calendar (issue #176, CG-03), so Homa can
 * answer "what's on the calendar" or check before adding a new event
 * without guessing. Reads always run on the server connection with an
 * explicit family_id predicate, the same posture as open_planner's
 * getPlanBoard, regardless of whether this session is a caller-JWT web
 * session or a pinned channel like SMS.
 *
 * The window can look BACK as well as forward (issue #257, arc PR B0):
 * the tool used to be today-forward only, which meant a Tuesday
 * reshuffle could never see Monday. from/to win over daysAhead; the
 * span is clamped in lib/family-events.ts's resolveEventWindow.
 */

export default defineBoundedTool({
  description:
    "List events on the family calendar: appointments, trips, co-op days, anything added with add_family_event. Use before adding a new event (to avoid a duplicate), before any reshuffle or placement of school work, or when the parent asks what is coming up. Defaults to the next 30 days; pass from/to for a specific window, including past days (a mid-week reshuffle should read the whole week, Monday included). Read-only; change the calendar with add_family_event, update_family_event, or remove_family_event.",
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
        .describe(
          "How many days out to look, starting today (or startsOn from, when from is given without to). Defaults to 30. Ignored when both from and to are given.",
        ),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe(
          "First day of the window, YYYY-MM-DD. May be in the past, e.g. Monday of the current week for a mid-week reshuffle. Defaults to today.",
        ),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe(
          `Last day of the window, YYYY-MM-DD, inclusive. Defaults to from plus daysAhead. Windows wider than ${MAX_EVENT_WINDOW_DAYS} days are clamped.`,
        ),
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
    const window = resolveEventWindow({
      today,
      daysAhead: input.daysAhead,
      from: input.from,
      to: input.to,
    });
    if (!window.ok) {
      return { events: [], note: window.error };
    }

    const [events, children] = await Promise.all([
      listFamilyEventsPinned(familyId, window.fromDate, window.toDate),
      getChildrenPinned(familyId),
    ]);
    const nameById = new Map(children.map((child) => [child.id, child.name]));

    const windowNote = `Window: ${window.fromDate} to ${window.toDate}${
      window.clamped ? ` (clamped to ${MAX_EVENT_WINDOW_DAYS} days)` : ""
    }.`;
    return {
      events: events.map((event) => {
        const childIds = familyEventChildIds(event);
        return {
          id: event.id,
          title: event.title,
          childId: event.childId,
          childName: event.childId ? (nameById.get(event.childId) ?? null) : null,
          childIds,
          childNames: childIds.map((childId) => nameById.get(childId) ?? "Child"),
          startsOn: event.startsOn,
          endsOn: event.endsOn,
          startTime: event.startTime,
          endTime: event.endTime,
          note: event.note,
          recurrence: event.recurrence,
        };
      }),
      note:
        events.length === 0
          ? `Nothing on the calendar in that window. ${windowNote}`
          : `${windowNote} childIds is the full audience; an empty list means a whole-family event. childId remains the one-child compatibility marker.`,
    };
  },
});
