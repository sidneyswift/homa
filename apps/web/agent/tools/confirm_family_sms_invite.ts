import { z } from "zod";

import { normalizeUsPhoneE164 } from "@homa/core";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { confirmFamilySmsInvite } from "../../lib/family-sms-invite-confirmation";
import type { FamilySmsInviteParentDecision } from "../../lib/family-sms-invite-consent";

/**
 * Applies the original parent's coded confirmation. Every decision input
 * comes from the authenticated SMS channel, never from the model.
 */
export default defineBoundedTool({
  description:
    "Apply the coded family-invite confirmation already authenticated from this linked parent's complete SMS. There are no model-selected inputs. Call only when SMS instructions say a valid confirmation or cancellation is present.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | {
          channel?: string;
          familySmsInviterConfirmationCodeHash?: string;
          familyId?: string;
          familySmsInviterConfirmationDecision?: FamilySmsInviteParentDecision;
          familySmsInviterConfirmationId?: string;
          phoneNumber?: string;
        }
      | undefined;
    const inviterPhoneE164 = normalizeUsPhoneE164(
      attributes?.phoneNumber ?? "",
    );
    if (
      attributes?.channel !== "sms" ||
      !attributes.familyId ||
      !attributes.familySmsInviterConfirmationCodeHash ||
      !attributes.familySmsInviterConfirmationDecision ||
      !attributes.familySmsInviterConfirmationId ||
      !inviterPhoneE164
    ) {
      return {
        handled: false,
        note:
          "No authenticated family invitation confirmation is available in this turn. Do not change access.",
      };
    }

    const result = await confirmFamilySmsInvite({
      familyId: attributes.familyId,
      confirmationCodeHash:
        attributes.familySmsInviterConfirmationCodeHash,
      inviterPhoneE164,
      inviteId: attributes.familySmsInviterConfirmationId,
      decision: attributes.familySmsInviterConfirmationDecision,
    });
    return {
      handled: true,
      ...result,
      note:
        "Use replyText exactly as your one normal reply. Do not add another family or child detail.",
    };
  },
});
