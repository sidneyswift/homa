import { defineTool } from "eve/tools";
import { z } from "zod";

import { setFamilyEmailSafe } from "../../lib/sms-onboarding";
import { NOT_SMS_REFUSAL, resolveSignupSession } from "../../lib/signup-session";

/**
 * The report email during text signup (sms-onboarding-plan SO-2).
 * Scoring requires an email on the family; an address that already
 * belongs to another Homa family is refused (no folding accounts
 * without a real sign-in).
 */
export default defineTool({
  description:
    "Save the email the report should go to, during text signup. Ask for it near the end ('where should I send the report?'). Refuses emails that already belong to another Homa account.",
  inputSchema: z.object({
    email: z.string().email().max(254),
  }),
  async execute(input, ctx) {
    const session = await resolveSignupSession(ctx.session.auth.current?.attributes);
    if (!session) return { saved: false, note: NOT_SMS_REFUSAL };
    if (!session.familyId) {
      return { saved: false, note: "No signup is open for this number. Call begin_text_signup first." };
    }

    const result = await setFamilyEmailSafe(session.familyId, input.email);
    if (!result.ok) {
      return {
        saved: false,
        note:
          result.reason === "taken"
            ? "That email already has a Homa account. She can sign in at thankshoma.com with it and link this number in settings, or give a different email for this new account."
            : "That does not look like a valid email; ask her to retype it.",
      };
    }
    return { saved: true, note: "Saved. Finish each completed child with signup_finish." };
  },
});
