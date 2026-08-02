import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  deleteCustomTask,
  getTaskMutationSnapshot,
} from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

export default defineBoundedTool({
  description:
    "Permanently delete one of this family's CUSTOM scheduled tasks. Only after the parent clearly confirms which one, in this conversation. Built-in tasks (morning brief, evening check-in) cannot be deleted, only paused with update_task.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z.object({
    taskId: z.string().uuid().describe("The id from list_tasks."),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseScheduleSpawnedSession(attributes);
    if (refusal) return { deleted: false, note: refusal };

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { deleted: false, note: error.message };
      }
      throw error;
    }

    const before = await getTaskMutationSnapshot(familyId, input.taskId);
    if (!before || before.kind !== "custom") {
      return { deleted: false, note: "That task is not in this family." };
    }
    const receiptContext = voiceToolReceiptContext({
      familyId,
      attributes,
      runtimeSessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    });
    const mutate = () => deleteCustomTask(familyId, input.taskId);
    const armed = receiptContext
      ? await armVoiceActionThenMutate({
          familyId,
          record: () => recordVoiceAction({
            ...receiptContext,
            objectKind: "task",
            objectId: input.taskId,
            effect: "task.deleted",
            namedEffect: before.label ?? "scheduled task",
            undoCapability: "append_only_restore",
            payload: { effect: "task.deleted", before },
          }),
          mutate,
          replay: async (receipt) => receipt.undoneAt
            ? { ok: false as const, note: "That Voice action already ran and was undone." }
            : { ok: true as const },
          succeeded: (result) => result.ok,
        })
      : { actionReceipt: null, result: await mutate(), replayed: false };
    const result = armed.result;
    if (!result.ok) return { deleted: false, note: result.note };
    return {
      deleted: true,
      ...(armed.actionReceipt ? { actionReceipt: armed.actionReceipt } : {}),
      note: "Task deleted. Confirm to the parent in one short aside.",
    };
  },
});
