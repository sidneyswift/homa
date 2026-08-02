import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  setTaskPaused,
  updateCustomTask,
  updateTaskSchedule,
  getTaskMutationSnapshot,
  type CustomTaskInput,
} from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

export default defineBoundedTool({
  description:
    "Change one of this family's scheduled tasks: pause or resume any task, edit a custom task's label or instructions, or change ANY task's days, hour, or delivery (text, email, or none = saved to the tasks page only). Built-in words stay Homa's: the morning brief and evening check-in label and prompt can never change. Use list_tasks first when the target is ambiguous.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z.object({
    taskId: z.string().uuid().describe("The id from list_tasks."),
    paused: z.boolean().optional().describe("Set to pause/resume; works for every kind."),
    label: z.string().min(3).max(60).optional(),
    prompt: z.string().min(10).max(1000).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    localHour: z.number().int().min(0).max(23).optional(),
    deliveryPref: z.enum(["text", "email", "none"]).optional(),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseScheduleSpawnedSession(attributes);
    if (refusal) return { updated: false, note: refusal };

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { updated: false, note: error.message };
      }
      throw error;
    }

    const { taskId, paused, ...patch } = input;
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<CustomTaskInput>;
    const hasPatch = Object.keys(cleanPatch).length > 0;
    // Days, hour, and delivery (text, email, or save to the tasks page)
    // are schedule fields, movable on every kind. Label and prompt stay
    // custom-task territory: built-in words are Homa's.
    const scheduleOnly =
      cleanPatch.label === undefined && cleanPatch.prompt === undefined;

    if (paused === undefined && !hasPatch) {
      return {
        updated: false,
        note: "No task changes were supplied. Ask what the parent wants changed.",
      };
    }

    // Nothing to act on: neither a pause/resume nor any field to edit. Say so
    // honestly instead of claiming a change was made (2026-07-11 review,
    // CR-07; tool-honesty rule in instructions.md).
    if (paused === undefined && Object.keys(patch).length === 0) {
      return {
        updated: false,
        note: "Nothing to change. Pass paused to pause or resume, and/or fields to edit.",
      };
    }

    const before = await getTaskMutationSnapshot(familyId, taskId);
    if (!before) return { updated: false, note: "That task is not in this family." };
    const normalizedWeekdays = cleanPatch.weekdays === undefined
      ? before.weekdays
      : [...new Set(cleanPatch.weekdays)].sort((left, right) => left - right);
    const after = {
      ...before,
      label: cleanPatch.label ?? before.label,
      prompt: cleanPatch.prompt ?? before.prompt,
      localHour: cleanPatch.localHour ?? before.localHour,
      weekdays: normalizedWeekdays,
      deliveryPref: cleanPatch.deliveryPref ?? before.deliveryPref,
      paused: paused ?? before.paused,
      pausedAt: paused === undefined
        ? before.pausedAt
        : paused
          ? (before.pausedAt ?? new Date().toISOString())
          : null,
    };
    const receiptContext = voiceToolReceiptContext({
      familyId,
      attributes,
      runtimeSessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    });
    const mutate = async () => {
      if (hasPatch) {
        const result = scheduleOnly
          ? await updateTaskSchedule(familyId, taskId, {
              ...(cleanPatch.weekdays !== undefined ? { weekdays: cleanPatch.weekdays } : {}),
              ...(cleanPatch.localHour !== undefined ? { localHour: cleanPatch.localHour } : {}),
              ...(cleanPatch.deliveryPref !== undefined
                ? { deliveryPref: cleanPatch.deliveryPref }
                : {}),
            })
          : await updateCustomTask(familyId, taskId, cleanPatch);
        if (!result.ok) return { updated: false as const, note: result.note };
      }
      if (paused !== undefined) {
        const result = await setTaskPaused(familyId, taskId, paused);
        if (!result.ok) return { updated: false as const, note: result.note };
      }
      return {
        updated: true as const,
        note: paused !== undefined && !hasPatch
          ? `Task ${paused ? "paused" : "resumed"}. Tell the parent in one short aside.`
          : "Task updated. Tell the parent in one short aside.",
      };
    };
    const armed = receiptContext
      ? await armVoiceActionThenMutate({
          familyId,
          record: () => recordVoiceAction({
            ...receiptContext,
            objectKind: "task",
            objectId: taskId,
            effect: "task.updated",
            namedEffect: `${before.label ?? "scheduled task"} changes`,
            undoCapability: "exact_restore",
            payload: { effect: "task.updated", before, after },
          }),
          mutate,
          replay: async (receipt) => receipt.undoneAt
            ? { updated: false as const, note: "That Voice action already ran and was undone." }
            : { updated: true as const, note: "Task updated." },
          succeeded: (result) => result.updated,
        })
      : { actionReceipt: null, result: await mutate(), replayed: false };
    if (!armed.result.updated) return armed.result;
    return {
      ...armed.result,
      ...(armed.actionReceipt ? { actionReceipt: armed.actionReceipt } : {}),
    };
  },
});
