import { z } from "zod";

import { defineBoundedTool, TOOL_DEADLINE } from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  undoVoiceAction,
  type VoiceActionEffect,
  type VoiceUndoCapability,
} from "../../lib/voice/action-receipts";

function undoResultCopy(input: {
  effect: VoiceActionEffect;
  undoCapability: VoiceUndoCapability;
  namedEffect: string;
  alreadyUndone: boolean;
}): string {
  const restoresPriorState = input.undoCapability !== "exact_delete";
  const result = input.effect === "family_event.updated"
    ? `the earlier details for ${input.namedEffect}`
    : input.namedEffect;
  if (input.alreadyUndone) {
    const verb = input.effect === "family_event.updated"
      ? "were already restored"
      : restoresPriorState
        ? "was already restored"
        : "was already removed";
    return `${result[0].toUpperCase()}${result.slice(1)} ${verb}. Nothing changed this time.`;
  }
  const verb = restoresPriorState ? "Restored" : "Removed";
  return `${verb} ${result}.`;
}

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
        note: "Nothing changed. Go back to the Voice conversation where you made the change and say ‘undo that.’",
      };
    }
    const actor = z.string().uuid().safeParse(attributes.memberUserId);
    if (!actor.success) {
      return {
        undone: false,
        reason: "no_actor",
        note: "Nothing changed. Reopen Voice from your signed-in Homa app and try again.",
      };
    }
    const result = await undoVoiceAction({
      familyId,
      actorUserId: actor.data,
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
        note: "Homa found two recent actions. Nothing is undone yet. Ask which named effect to undo, in one short question.",
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
      note: undoResultCopy({
        effect: result.receipt.effect,
        undoCapability: result.receipt.undoCapability,
        namedEffect: result.receipt.namedEffect,
        alreadyUndone: result.alreadyUndone,
      }),
    };
  },
});
