import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { siteUrl } from "../../lib/map/email";
import { finishChildReport } from "../../lib/sms-onboarding";
import { NOT_SMS_REFUSAL, resolveSignupSession } from "../../lib/signup-session";

/**
 * Scores one child and returns the permanent report link
 * (sms-onboarding-plan SO-2). The agent texts the link itself in its
 * reply; the report email goes out through the existing background
 * pass, so nothing here double-sends.
 */
export default defineBoundedTool({
  description:
    "Finish text signup for one child whose checklist is complete: scores the answers and returns their report link to include in your reply. Requires the family email to be saved first.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({
    childId: z.uuid(),
  }),
  async execute(input, ctx) {
    const session = await resolveSignupSession(ctx.session.auth.current?.attributes);
    if (!session) return { finished: false, note: NOT_SMS_REFUSAL };
    if (!session.familyId) {
      return { finished: false, note: "No signup is open for this number. Call begin_text_signup first." };
    }

    const report = await finishChildReport(session.familyId, input.childId);
    if (!report) {
      return {
        finished: false,
        note: "Could not score this child (wrong child id, or no answers yet). Call begin_text_signup to see what is still needed.",
      };
    }
    if (!report.email) {
      return {
        finished: false,
        note: "The report needs an email first: ask where to send it, save it with signup_set_email, then finish again.",
      };
    }
    return {
      finished: true,
      childName: report.childName,
      reportUrl: `${siteUrl()}/onboarding/r/${report.token}`,
      note: "Text her the link with one warm sentence. Her texts to this number are her Homa line now: memories, hours, questions all work.",
    };
  },
});
