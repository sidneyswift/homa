import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  getFamilyEventCaller,
  getFamilyEventPinned,
  removeFamilyEventCaller,
  removeFamilyEventPinned,
} from "../../lib/family-events";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

/**
 * Removes one family calendar event (issue #176, CG-03). A model-supplied
 * eventId is always re-scoped inside the caller's own family: a foreign
 * or invented id simply matches nothing, it can never touch another
 * family's row.
 */

export default defineBoundedTool({
  description:
    "Remove one event from the family calendar (an appointment or trip added earlier, or a mistake). Use eventId from list_family_events or from add_family_event's own result. Never removes a school plan activity; that stays on the plan.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      eventId: z.uuid().describe("The event's id, from list_family_events or add_family_event."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { removed: false, note: error.message };
      }
      throw error;
    }

    const receiptContext = voiceToolReceiptContext({
      familyId: access.familyId,
      attributes,
      runtimeSessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    });
    const before = receiptContext
      ? access.mode === "pinned"
        ? await getFamilyEventPinned(access.familyId, input.eventId)
        : await getFamilyEventCaller(access.db, access.familyId, input.eventId)
      : null;
    if (receiptContext && !before) {
      return { removed: false, note: "That event wasn't found on this family's calendar." };
    }
    const mutate = () => access.mode === "pinned"
      ? removeFamilyEventPinned(access.familyId, input.eventId, before ?? undefined)
      : removeFamilyEventCaller(access.db, access.familyId, input.eventId, before ?? undefined);
    const armed = receiptContext && before
      ? await armVoiceActionThenMutate({
          familyId: receiptContext.familyId,
          record: () => recordVoiceAction({
            ...receiptContext,
            objectKind: "family_event",
            objectId: input.eventId,
            effect: "family_event.removed",
            namedEffect: `${before.title} on the family calendar`,
            undoCapability: "append_only_restore",
            payload: {
              effect: "family_event.removed",
              before: {
                childId: before.childId,
                title: before.title,
                startsOn: before.startsOn,
                endsOn: before.endsOn,
                startTime: before.startTime,
                endTime: before.endTime,
                note: before.note,
                recurrence: before.recurrence ?? null,
              },
            },
          }),
          mutate,
          replay: async (receipt) => receipt.undoneAt
            ? { removed: false as const, note: "That Voice action already ran and was undone." }
            : { removed: true as const, title: before.title, event: before },
          succeeded: (result) => result.removed,
        })
      : { actionReceipt: null, result: await mutate(), replayed: false };
    const result = armed.result;
    if (!result.removed) return result;

    return {
      removed: true,
      done: true,
      title: result.title,
      ...(armed.actionReceipt ? { actionReceipt: armed.actionReceipt } : {}),
      note: "Removed from the family calendar. Confirm it back in one short natural aside.",
    };
  },
});
