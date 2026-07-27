import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { submitSkepticBrief, siteUrl } from "../../lib/map/email";
import { getFamilyEmail, getReportTokenForChild } from "../../lib/map/store";
import { loadChecklistState } from "../../lib/onboarding/checklist-state";

/**
 * D9, the skeptic brief (plans/2026-07-21-chat-first-onboarding.md §4.2):
 * "want a version of this you can forward to your husband, or your
 * mother-in-law?" Emailed to HER OWN inbox (never a third-party
 * address the model might invent), reframed so the doubting co-decider
 * can see it in five minutes with no account.
 *
 * Never invents a report: if this child has none yet, the tool refuses
 * and says so, because a "forward this" offer for a report that does
 * not exist would be the exact promise this codebase's tool-honesty
 * law exists to prevent.
 */
export default defineBoundedTool({
  description:
    "Email the family's own inbox a forwardable copy of one child's already-scored report, framed for a skeptical co-decider (a husband, a mother-in-law) to open in five minutes with no account. Offer this once, at most, after the reveal: 'want a version of this you can forward to your husband, or your mother-in-law?' Never call it for a child with no report yet.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({
    childId: z
      .uuid()
      .describe("The child whose report to send, using an id from the family context block."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { sent: false, note: error.message };
      }
      throw error;
    }

    const state = await loadChecklistState(access.familyId, input.childId);
    if (!state) {
      return {
        sent: false,
        note: "That child id is not in this family. Use an id from the family context block.",
      };
    }

    const token = await getReportTokenForChild(access.familyId, input.childId);
    if (!token) {
      return {
        sent: false,
        childName: state.childName,
        note: `${state.childName} has no report yet, so there is nothing to forward. Score the report first.`,
      };
    }

    const email = await getFamilyEmail(access.familyId);
    if (!email) {
      return {
        sent: false,
        childName: state.childName,
        note: "This family has no email on file, so nothing can be sent. Do not promise this again this sitting.",
      };
    }

    const submission = await submitSkepticBrief(
      email,
      state.childName,
      `${siteUrl()}/onboarding/r/${token}`,
      access.familyId,
    );
    if (submission.status !== "submitted") {
      return {
        sent: false,
        childName: state.childName,
        note: "The email did not go out. Say so plainly and do not promise it arrived.",
      };
    }

    return {
      sent: true,
      childName: state.childName,
      note: `SPEAK AFTER THIS ONE: it's on its way to her own inbox, one short line confirming it's there to forward whenever she wants, then hand the thread back.`,
    };
  },
});
