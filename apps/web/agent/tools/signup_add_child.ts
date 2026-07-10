import { defineTool } from "eve/tools";
import { z } from "zod";

import { addChildFromSms, nextChecklistItem } from "../../lib/sms-onboarding";
import { NOT_SMS_REFUSAL, resolveSignupSession } from "../../lib/signup-session";

/**
 * Adds one child during text signup (sms-onboarding-plan SO-2) and
 * hands back that child's first checklist question so the conversation
 * flows straight into it.
 */
export default defineTool({
  description:
    "Add one child during text signup: name plus birth month and year (day is never collected). Returns the child's first checklist question when they are in the scored range (ages 2 to 16).",
  inputSchema: z.object({
    name: z.string().min(1).max(80),
    birthMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("YYYY-MM. When she says an age ('she's 4'), ask for birth month and year instead of guessing."),
  }),
  async execute(input, ctx) {
    const session = await resolveSignupSession(ctx.session.auth.current?.attributes);
    if (!session) return { added: false, note: NOT_SMS_REFUSAL };
    if (!session.familyId) {
      return { added: false, note: "No signup is open for this number. Call begin_text_signup first." };
    }

    const child = await addChildFromSms(session.familyId, input);
    if (!child.inRange) {
      return {
        added: true,
        childId: child.childId,
        inRange: false,
        note: "Saved. This child is outside the scored range (2 to 16), so there is no checklist for them; their report unlocks when they reach age 2. Ask about the next kid, or continue.",
      };
    }
    const next = await nextChecklistItem(session.familyId, child.childId);
    return {
      added: true,
      childId: child.childId,
      inRange: true,
      firstQuestion: next,
      note: "Saved. Ask the first checklist question now, in plain parent language, one question per text.",
    };
  },
});
