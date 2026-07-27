import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { addFamilyEventCaller, addFamilyEventPinned } from "../../lib/family-events";

/**
 * Homa's own family calendar (issue #176, CG-03), a co-founder's own
 * words: "have an option for each kid and then a family calendar...
 * added homa lessons, family subjects, related activities, appts etc."
 * This is the appointments-and-trips half; school-plan scheduling is a
 * separate tool, schedule_plan_activity. Not Google Calendar and never
 * synced externally (her words were explicit this is Homa's own
 * calendar), and this tool never reshuffles anything else on the
 * schedule around a new event: that optimizer ("doctor's appt Tuesday,
 * let's push things back") is explicitly out of scope for this slice.
 */

export default defineBoundedTool({
  description:
    "Add an appointment, trip, or other non-school event to the family's own calendar (never Google or any external calendar): a doctor's appointment, a co-op day, a museum visit, a family trip. Use when the parent mentions something happening on a specific day or date range that is not a school lesson. Give it a whole family (omit childId) or one child's own calendar. Does not touch or reshuffle anything else already scheduled.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      title: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .describe("Short, plain name for the event, e.g. \"Doctor's appt\" or \"Camping trip\"."),
      startsOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("The first day, YYYY-MM-DD. Use the family context block's date for relative days like 'Tuesday' or 'next week'."),
      endsOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("The last day, YYYY-MM-DD, for a multi-day event like a trip. Omit for a single-day event."),
      startTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional()
        .describe("24h HH:MM the event starts, e.g. '14:00' for 2pm. Omit for an all-day entry."),
      endTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional()
        .describe("24h HH:MM the event ends. Omit if unknown."),
      childId: z
        .uuid()
        .optional()
        .describe("The child this is for (id from the family context block). Omit for a whole-family event."),
      note: z
        .string()
        .max(500)
        .optional()
        .describe("Any extra detail the parent gave, in her own words."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { added: false, note: error.message };
      }
      throw error;
    }

    const result =
      access.mode === "pinned"
        ? await addFamilyEventPinned(access.familyId, input)
        : await addFamilyEventCaller(access.db, access.familyId, input);
    if (!result.added) return result;

    return {
      ...result,
      done: true,
      note: "Added to the family calendar. Confirm it back to the parent in one short natural aside; the calendar page shows it right away.",
    };
  },
});
