import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { removeFamilyEventCaller, removeFamilyEventPinned } from "../../lib/family-events";

/**
 * Removes one family calendar event (issue #176, CG-03). A model-supplied
 * eventId is always re-scoped inside the caller's own family: a foreign
 * or invented id simply matches nothing, it can never touch another
 * family's row.
 */

export default defineBoundedTool({
  description:
    "Remove one event from the family calendar (an appointment or trip added earlier, or a mistake). Use eventId from list_family_events or from add_family_event's own result. Never removes a school plan activity; that stays on the plan.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      eventId: z.uuid().describe("The event's id, from list_family_events or add_family_event."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { removed: false, note: error.message };
      }
      throw error;
    }

    const result =
      access.mode === "pinned"
        ? await removeFamilyEventPinned(access.familyId, input.eventId)
        : await removeFamilyEventCaller(access.db, access.familyId, input.eventId);
    if (!result.removed) return result;

    return {
      removed: true,
      done: true,
      note: "Removed from the family calendar. Confirm it back in one short natural aside.",
    };
  },
});
