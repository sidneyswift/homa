import { z } from "zod";

import { normalizeUsPhoneE164 } from "@homa/core";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { updatePhoneLead } from "../../lib/phone-leads";

/**
 * Lead capture for UNLINKED text conversations (lead-funnel-plan LF-3).
 * When a stranger texting Homa volunteers her name, email, or situation,
 * this saves it onto her phone_leads row so signup can meet her halfway
 * later. The row is keyed by the SESSION's own phone number (stamped by
 * the SMS channel from the sender), never by anything the model types.
 *
 * Linked families never need this (their workspace exists); the tool
 * refuses so the model cannot misfile a member as a lead.
 */

const captureInput = z.object({
  name: z
    .string()
    .max(120)
    .optional()
    .describe("Her first name, exactly as she gave it."),
  email: z
    .string()
    .email()
    .max(254)
    .optional()
    .describe("Her email, only when she volunteered it for signup or follow-up."),
  note: z
    .string()
    .max(500)
    .optional()
    .describe("One sentence of context in her words, e.g. 'two kids, 4 and 6, starting in the fall'."),
  sentSignupLink: z
    .boolean()
    .optional()
    .describe("True when your reply includes the signup link, so the lead is marked invited."),
});

export default defineBoundedTool({
  description:
    "Save what an unlinked texter shares about herself (name, email, situation) to Homa's lead record, and mark when you have given her the signup link. Use it the moment details come up; never ask for details just to fill fields. Only works on text conversations from numbers without an account.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: captureInput,
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | {
          channel?: string;
          familyId?: string;
          familySmsInviteLookupFailed?: string;
          familySmsInviteState?: string;
          phoneNumber?: string;
        }
      | undefined;

    if (
      attributes?.channel !== "sms" ||
      attributes.familyId ||
      attributes.familySmsInviteLookupFailed === "true" ||
      attributes.familySmsInviteState
    ) {
      return {
        saved: false,
        note: "This tool is only for text conversations with numbers that have no account. This conversation does not qualify; just keep helping.",
      };
    }
    const phone = normalizeUsPhoneE164(attributes.phoneNumber ?? "");
    if (!phone) {
      return { saved: false, note: "No usable number on this session; skip saving and keep helping." };
    }

    const result = await updatePhoneLead({
      phoneE164: phone,
      name: input.name ?? null,
      email: input.email ?? null,
      note: input.note ?? null,
      invited: input.sentSignupLink === true,
      channel: "sms",
    });

    return result.saved
      ? { saved: true, note: "Saved. Never recite what you saved; keep the conversation natural." }
      : { saved: false, note: "Nothing to update for this number; keep helping." };
  },
});
