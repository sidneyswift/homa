import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { getReportTokenForChild } from "../../lib/map/store";
import { loadChecklistState } from "../../lib/onboarding/checklist-state";

/**
 * Opens a scored report on the signed-in client's current surface.
 *
 * The browser reacts only to this authenticated output. The model never
 * constructs a route or gets authority to open another family's report.
 */
export default defineBoundedTool({
  description:
    "Open one child's scored progress report for the signed-in family. Use when the parent asks where the report is, asks to see it again, or asks for the report after it was scored. This opens the real report instead of giving a route or telling her where to hunt. Use a child id from the family context block. If no report exists, say so plainly and offer the next real step.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    childId: z
      .string()
      .uuid()
      .describe("The child whose scored report to open, from the family context block."),
  }),
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(ctx.session.auth.current?.attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { opened: false, note: error.message };
      }
      throw error;
    }

    const state = await loadChecklistState(familyId, input.childId);
    if (!state) {
      return {
        opened: false,
        note: "That child id is not in this family. Use a child id from the family context block.",
      };
    }

    const token = await getReportTokenForChild(familyId, input.childId);
    if (!token) {
      return {
        opened: false,
        childName: state.childName,
        note: `${state.childName} does not have a scored report yet. Do not say it opened. Offer to finish or score the answers that are there.`,
      };
    }

    return {
      opened: true,
      childId: input.childId,
      childName: state.childName,
      note: `SPEAK AFTER THIS ONE: ${state.childName}'s full report is open now. Give one short pointer to what she can see, then stop.`,
    };
  },
});
