import { defineTool } from "eve/tools";
import { z } from "zod";

import { saveFamilyBasicsFromSms } from "../../lib/sms-onboarding";
import { NOT_SMS_REFUSAL, resolveSignupSession } from "../../lib/signup-session";

/**
 * Family basics over text (sms-onboarding-plan SO-2): the parent's
 * name, optional family display name, optional US state. Address is
 * never collected over SMS by design.
 */
export default defineTool({
  description:
    "Save the signing-up parent's name (and optionally their US state or a family display name) during text signup. Use exactly what she gave; never invent a state.",
  inputSchema: z.object({
    parentName: z.string().min(1).max(100).describe("Her name as she gave it."),
    familyName: z.string().max(80).optional().describe("Only if she offered one; otherwise omitted."),
    usState: z
      .string()
      .length(2)
      .optional()
      .describe("Two-letter US state code, only when she named her state."),
  }),
  async execute(input, ctx) {
    const session = await resolveSignupSession(ctx.session.auth.current?.attributes);
    if (!session) return { saved: false, note: NOT_SMS_REFUSAL };
    if (!session.familyId) {
      return { saved: false, note: "No signup is open for this number. Call begin_text_signup first." };
    }
    const result = await saveFamilyBasicsFromSms(session.familyId, input);
    if (!result.saved) {
      return {
        saved: false,
        note:
          "This number belongs to a family that already has a signed-in account, so there is no text signup to run and nothing was changed. Just keep helping them normally.",
      };
    }
    return {
      saved: true,
      note: "Saved. Next: her kids, one at a time (name and full birthday).",
    };
  },
});
