import { MAP_ANSWERS } from "@homa/core";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  legacyProgressTransportIdempotencyKey,
} from "../../lib/child-progress/legacy-adapters";
import { saveAnswer } from "../../lib/map/store";
import { nextChecklistItem } from "../../lib/sms-onboarding";
import { NOT_SMS_REFUSAL, resolveSignupSession } from "../../lib/signup-session";

/**
 * One checklist answer during text signup (sms-onboarding-plan SO-2).
 * The model's job is translation: the parent answers in her own words
 * and the tool stores the matching chip. The result always carries the
 * next question, so the conversation never stalls or invents items.
 */
export default defineBoundedTool({
  description:
    "Record the parent's answer to the current checklist question during text signup, translated to one of: easily (does it confidently), getting_there (sometimes, with help, emerging), not_yet (not doing it), not_sure, skip (she declined). When her reply is genuinely ambiguous, ask ONE short clarifying question instead of guessing. Returns the next question, or checklist completion.",
  deadlineMs: TOOL_DEADLINE.fetch,
  inputSchema: z.object({
    childId: z.uuid().describe("The child this answer is for (from signup_add_child or begin_text_signup)."),
    itemId: z.string().min(1).describe("The question item id you are answering, exactly as the tool gave it."),
    answer: z.enum(MAP_ANSWERS),
  }),
  async execute(input, ctx) {
    const attributes = (
      ctx.session.auth.current?.attributes ?? {}
    ) as {
      canonicalInboundMessageId?: string;
      inboundReceiptId?: string;
      memberUserId?: string;
      providerMessageId?: string;
    };
    const session = await resolveSignupSession(attributes);
    if (!session) return { recorded: false, note: NOT_SMS_REFUSAL };
    if (!session.familyId) {
      return { recorded: false, note: "No signup is open for this number. Call begin_text_signup first." };
    }

    const result = await saveAnswer(
      session.familyId,
      input.childId,
      input.itemId,
      input.answer,
      {
        source: "checklist",
        memberUserId:
          typeof attributes.memberUserId === "string"
            ? attributes.memberUserId
            : null,
        channel: "sms",
        messageId: attributes.canonicalInboundMessageId,
        providerMessageId: attributes.providerMessageId,
        observedAt: new Date().toISOString(),
        idempotencyKey:
          legacyProgressTransportIdempotencyKey({
            operation: "signup-answer",
            channel: "sms",
            providerMessageId:
              attributes.providerMessageId ?? null,
            inboundReceiptId:
              attributes.inboundReceiptId ?? null,
            runtimeSessionId: ctx.session.id,
            turnId: ctx.session.turn.id,
          }),
      },
    );
    if (!result.ok) {
      return {
        recorded: false,
        note: "That answer did not save (unknown question or child). Call begin_text_signup to re-check where things stand.",
      };
    }
    const next = await nextChecklistItem(session.familyId, input.childId);
    if (!next) {
      return {
        recorded: true,
        checklistDone: true,
        note: "That was the last question for this child. If another kid still has an open checklist, move to them; otherwise collect the report email (signup_set_email) and finish.",
      };
    }
    return {
      recorded: true,
      checklistDone: false,
      nextQuestion: next,
      note: "Ask the next question in plain parent language. Never recite the count.",
    };
  },
});
