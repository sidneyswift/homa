import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  updateFamilyEventCaller,
  updateFamilyEventPinned,
  type FamilyEventPatch,
} from "../../lib/family-events";

/**
 * Changes one existing family calendar event in one call (issue #257,
 * arc PR B0): retitle, retime, or move. Before this tool the only chat
 * path was remove + re-add, which loses the event outright when the
 * second call fails. The grid could already do this in one gesture
 * (calendar/actions.ts updateFamilyEventAction); this is chat catching
 * up, through the same parseFamilyEventInput validation via
 * applyFamilyEventPatch, so grid-edited and chat-edited events can
 * never drift apart.
 *
 * A model-supplied eventId is always re-scoped inside the caller's own
 * family on both the read and the write: a foreign or invented id
 * matches nothing, it can never touch another family's row.
 */

export default defineBoundedTool({
  description:
    "Change one existing family calendar event in one call: rename it, move it to another day, or change its time. Use eventId from list_family_events or add_family_event's own result. Only the fields you pass change; moving startsOn alone moves the whole event and keeps a multi-day event's length. Not for school plan activities; a plan activity's date moves with schedule_plan_activity and its wording with edit_plan. Prefer this over remove_family_event plus add_family_event, which can lose the event if the second call fails.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      eventId: z
        .uuid()
        .describe("The event's id, from list_family_events or add_family_event."),
      title: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe("New short, plain name for the event. Omit to keep the current title."),
      startsOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe(
          "New first day, YYYY-MM-DD. Omitting endsOn shifts the whole event by the same number of days, keeping its length. Use the family context block's date for relative days like 'Tuesday'.",
        ),
      endsOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("New last day, YYYY-MM-DD, for changing a multi-day event's length. Omit to keep it (moved along with startsOn)."),
      startTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable()
        .optional()
        .describe("New 24h HH:MM start time, e.g. '14:00'. Pass null to make the event all-day. Omit to keep the current time."),
      endTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable()
        .optional()
        .describe("New 24h HH:MM end time. Pass null to clear it. Omit to keep the current one."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { updated: false, note: error.message };
      }
      throw error;
    }

    const patch: FamilyEventPatch = {
      title: input.title,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      startTime: input.startTime,
      endTime: input.endTime,
    };
    const result =
      access.mode === "pinned"
        ? await updateFamilyEventPinned(access.familyId, input.eventId, patch)
        : await updateFamilyEventCaller(access.db, access.familyId, input.eventId, patch);
    if (!result.updated) return result;

    return {
      updated: true,
      done: true,
      event: {
        id: result.event.id,
        title: result.event.title,
        childId: result.event.childId,
        startsOn: result.event.startsOn,
        endsOn: result.event.endsOn,
        startTime: result.event.startTime,
        endTime: result.event.endTime,
      },
      note: "Updated on the family calendar. Confirm the change back in one short natural aside; the calendar page shows it right away.",
    };
  },
});
