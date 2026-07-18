import { createHash } from "node:crypto";

import { defineTool } from "eve/tools";
import { z } from "zod";

import { normalizeUsPhoneE164 } from "@homa/core";

import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import { scanMemoryContent } from "../../lib/agent-memory";
import {
  createFamilySmsInvite,
  type CreateFamilySmsInviteResult,
} from "../../lib/family-sms-invites";

/**
 * The one deliberate exception to Homa's no-model-supplied-destination
 * rule. It is safe because the destination receives only fixed,
 * server-owned consent copy. The child update remains in the deny-all
 * invite row until that exact phone replies yes.
 */

const inviteInput = z.object({
  phoneNumber: z
    .string()
    .min(7)
    .max(30)
    .describe(
      "The US mobile number the parent just supplied for the other adult. Never infer or reuse a number from memory.",
    ),
  childId: z
    .uuid()
    .describe("The child id from this family's context whose update will be shared after consent."),
  learningUpdate: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .describe(
      "The exact short learning fact to share only after acceptance, without the child's name, links, or instructions.",
    ),
});

function inviteFailureNote(
  reason: Exclude<CreateFamilySmsInviteResult, { ok: true }>["reason"],
): string {
  switch (reason) {
    case "same-number":
      return "That is the number already texting Homa. Ask for the other adult's number.";
    case "already-linked":
      return "That number already belongs to this family, so no invitation is needed.";
    case "number-in-use":
      return "That number is already connected to another Homa account. Do not move it or reveal which family owns it.";
    case "pending-elsewhere":
      return "That number already has an active family invitation. Do not replace it; ask the parent to try another number or wait.";
    case "send-limit":
      return "The family invitation limit was reached for today. Offer to try again tomorrow.";
    case "source-not-linked":
      return "This SMS session could not be re-verified as one of the family's linked numbers. Do not send anything.";
    case "source-not-member":
      return "This phone has family access but is not tied to a signed-in parent. It cannot invite more people. A parent can send an email invite from Homa settings.";
    case "child-not-found":
      return "That child id is not in this family. Re-read the family context before trying again.";
    case "invalid-update":
      return "The learning update was empty after cleaning. Ask the parent what they want shared after consent.";
    case "sms-failed":
      return "The private invitation could not be texted. Nothing was linked and no child information was sent. Offer to try again later.";
    case "sms-uncertain":
      return "Homa could not confirm whether the carrier accepted this invitation. No child information is available yet. Do not retry in this turn; offer to try again later.";
    default: {
      const exhaustive: never = reason;
      throw new Error(`unhandled family SMS invitation failure: ${String(exhaustive)}`);
    }
  }
}

export default defineTool({
  description:
    "Invite another adult to this family's Homa by text after the linked parent gives you that adult's US phone number. Use only in a linked SMS conversation, only after the parent agrees to the offer, and only for one real child update. The first text is fixed anonymous consent copy with no child information. A recipient's yes still grants nothing; Homa asks the original parent to confirm the full number with a code before access or the update is released.",
  inputSchema: inviteInput,
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | {
          channel?: string;
          familyId?: string;
          phoneNumber?: string;
        }
      | undefined;
    if (attributes?.channel !== "sms") {
      return {
        invited: false,
        note: "Family phone invitations only work inside a linked SMS conversation.",
      };
    }

    const sourcePhoneE164 = normalizeUsPhoneE164(attributes.phoneNumber ?? "");
    const destinationPhoneE164 = normalizeUsPhoneE164(input.phoneNumber);
    if (!sourcePhoneE164) {
      return {
        invited: false,
        note: "The current SMS sender has no usable authenticated phone number. Do not send an invitation.",
      };
    }
    if (!destinationPhoneE164) {
      return {
        invited: false,
        note: "That is not a complete US mobile number. Ask the parent to check it and send it again.",
      };
    }

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { invited: false, note: error.message };
      }
      throw error;
    }

    const blocked = scanMemoryContent(input.learningUpdate);
    if (blocked) {
      return {
        invited: false,
        note: `${blocked} Do not send the invitation with this update.`,
      };
    }

    const result = await createFamilySmsInvite({
      familyId,
      sourcePhoneE164,
      destinationPhoneE164,
      childId: input.childId,
      learningUpdate: input.learningUpdate,
      requestKey: createHash("sha256")
        .update(
          [
            ctx.session.id,
            ctx.session.turn.id,
            destinationPhoneE164,
            input.childId,
          ].join("\u0000"),
        )
        .digest("hex"),
    });
    if (!result.ok) {
      return { invited: false, note: inviteFailureNote(result.reason) };
    }

    return {
      invited: true,
      note:
        "The anonymous invitation was sent without child information. Tell the parent that if the other adult says yes, Homa will text the full number back with a confirmation code before sharing anything.",
    };
  },
});
