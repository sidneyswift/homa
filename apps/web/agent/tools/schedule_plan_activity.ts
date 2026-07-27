import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  schedulePlanActivityCaller,
  schedulePlanActivityPinned,
} from "../../lib/plan-schedule";

/**
 * Gives one plan activity a REAL persisted calendar date (issue #176,
 * CG-03): the actual M2-10 substrate the codebase has named as unbuilt
 * since the week board shipped. Before this tool, an activity's weekday
 * placement on /app/planner was presentation-only math
 * (spreadAcrossWeekdays); this is what makes "put the math worksheet on
 * Tuesday" a real, remembered fact instead of a guess the board
 * re-computes every visit. The scheduled activity then appears on
 * /app/calendar on that real date.
 *
 * Narrow and reusable on purpose (AGENTS.md tool-authoring law): this
 * assigns or moves ONE activity's date and nothing else. It does not
 * edit the activity's text (edit_plan does that) and it does not
 * reshuffle anything else already on the calendar around it; that
 * optimizer is explicitly out of scope for this slice.
 */

export default defineBoundedTool({
  description:
    "Give one plan activity a real calendar date, so it shows up on /app/calendar on that day. Use when the parent names a day for an existing activity ('let's do the math worksheet Tuesday', 'move story time to Thursday'), or right after finalizing a material built for a specific plan activity when the parent named a day for it. Always call open_planner first in this conversation to get real week and activity indices; never guess them. Re-scheduling the same activity (same child, subject, week, index) just moves its date, it never creates a duplicate.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      childId: z.uuid().describe("The child whose plan this is, from the family context block."),
      subjectId: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe('The plan, from open_planner: a subject id, or "month" for the month plan.'),
      week: z.number().int().min(1).max(4).describe("The activity's week, 1 through 4."),
      activityIndex: z
        .number()
        .int()
        .min(0)
        .describe("The activity's index within that week, from open_planner."),
      scheduledDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("The real calendar date, YYYY-MM-DD. Use the family context block's date for relative days like 'Tuesday'."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { scheduled: false, note: error.message };
      }
      throw error;
    }

    const result =
      access.mode === "pinned"
        ? await schedulePlanActivityPinned(access.familyId, input)
        : await schedulePlanActivityCaller(access.db, access.familyId, input);
    if (!result.scheduled) return result;

    return {
      ...result,
      done: true,
      note: "Scheduled on the family calendar. Confirm it back in one short natural aside, naming the day and the activity.",
    };
  },
});
