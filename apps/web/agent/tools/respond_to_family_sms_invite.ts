import { z } from "zod";

import { normalizeUsPhoneE164 } from "@homa/core";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { respondToFamilySmsInvite } from "../../lib/family-sms-invite-response";

/**
 * Accepts or declines the pending invitation for the current SMS sender.
 * There is intentionally no decision, phone, or family input: the channel
 * classifies a complete yes or no before the model runs, and possession of
 * the inbound number selects the exact invitation.
 */

const responseInput = z.object({});

export default defineBoundedTool({
  description:
    "Apply the family-invite response already classified from this unlinked SMS sender's complete message. The authenticated channel supplies the exact invitation, phone, and accept-or-decline decision. A yes only asks the original parent to confirm the full number; it does not grant access. There are no model-selected inputs.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: responseInput,
  async execute(_input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | {
          channel?: string;
          familyId?: string;
          familySmsInviteDecision?: "accept" | "decline";
          familySmsInviteId?: string;
          familySmsInviteState?:
            | "pending"
            | "awaiting-parent"
            | "expired";
          phoneNumber?: string;
        }
      | undefined;
    if (
      attributes?.channel !== "sms" ||
      attributes.familyId ||
      !attributes.familySmsInviteDecision ||
      !attributes.familySmsInviteId ||
      !attributes.familySmsInviteState
    ) {
      return {
        handled: false,
        note:
          "This tool is only for an unlinked SMS number with a family invitation. Do not change any family access.",
      };
    }

    const phoneE164 = normalizeUsPhoneE164(attributes.phoneNumber ?? "");
    if (!phoneE164) {
      return {
        handled: false,
        note:
          "The SMS session has no usable authenticated phone number. Do not accept or decline anything.",
      };
    }

    const result = await respondToFamilySmsInvite(
      phoneE164,
      attributes.familySmsInviteId,
      attributes.familySmsInviteDecision,
    );
    return {
      handled: true,
      ...result,
      note:
        "Use replyText exactly as your one normal reply. Do not add another greeting, explanation, or child detail.",
    };
  },
});
