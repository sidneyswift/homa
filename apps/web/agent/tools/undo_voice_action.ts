import { z } from "zod";

import { defineBoundedTool, TOOL_DEADLINE } from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { undoVoiceAction } from "../../lib/voice/action-receipts";

export default defineBoundedTool({
  description:
    "Undo one recent reversible action from this same Voice session. Call with no receiptId for 'undo that'. If the result says choose, ask one short question using the returned named effects, then call again with the chosen receiptId. Never use for sends, printing, purchases, filings, account changes, or any effect the tool does not return.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    receiptId: z
      .string()
      .uuid()
      .optional()
      .describe("Only after a choose result: the exact receipt id for the named effect the parent selected."),
  }).strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | { memberUserId?: unknown; messageModality?: unknown }
      | undefined;
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { undone: false, reason: "no_family", note: error.message };
      }
      throw error;
    }
    if (attributes?.messageModality !== "voice") {
      return {
        undone: false,
        reason: "not_voice",
        note: "This receipt belongs to Voice actions only. Nothing changed.",
      };
    }
    if (typeof attributes.memberUserId !== "string") {
      return {
        undone: false,
        reason: "no_actor",
        note: "Homa could not verify which adult made that action. Nothing changed.",
      };
    }
    const result = await undoVoiceAction({
      familyId,
      actorUserId: attributes.memberUserId,
      runtimeSessionId: ctx.session.id,
      undoTurnId: ctx.session.turn.id,
      ...(input.receiptId ? { receiptId: input.receiptId } : {}),
    });
    if (result.status === "choose") {
      return {
        undone: false,
        reason: "choose",
        candidates: result.candidates.map((receipt) => ({
          receiptId: receipt.id,
          namedEffect: receipt.namedEffect,
        })),
        note: "Two recent actions could fit. Ask which named effect to undo, in one short question.",
      };
    }
    if (result.status !== "undone") {
      return { undone: false, reason: result.status, note: result.note };
    }
    return {
      undone: true,
      alreadyUndone: result.alreadyUndone,
      receipt: result.receipt,
      preview: `Undo ${result.receipt.namedEffect}`,
      note: result.alreadyUndone
        ? "That action was already undone. Nothing changed twice."
        : `Undone: ${result.receipt.namedEffect}.`,
    };
  },
});
