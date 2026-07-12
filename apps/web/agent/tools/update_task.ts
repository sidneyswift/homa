import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  setTaskPaused,
  updateCustomTask,
  updateTaskSchedule,
  type CustomTaskInput,
} from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";

export default defineTool({
  description:
    "Change one of this family's scheduled tasks: pause or resume any task, edit a custom task's label, instructions, days, hour, or delivery, or change a built-in task's (morning brief, evening check-in) days, hour, or delivery. Built-in words stay Homa's: their label and prompt can never change. Use list_tasks first when the target is ambiguous.",
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
      familyId = resolveAgentAccess(attributes).familyId;
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
    // Days, hour, and text/email delivery are schedule fields, movable
    // on every kind. Label, prompt, and save-only delivery stay
    // custom-task territory (built-in words are Homa's; built-ins
    // always message the parent).
    const scheduleOnly =
      cleanPatch.label === undefined &&
      cleanPatch.prompt === undefined &&
      cleanPatch.deliveryPref !== "none";

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

    if (paused !== undefined) {
      const result = await setTaskPaused(familyId, taskId, paused);
      if (!result.ok) return { updated: false, note: result.note };
      if (!hasPatch) {
        return {
          updated: true,
          note: `Task ${paused ? "paused" : "resumed"}. Tell the parent in one short aside.`,
        };
      }
    }

    if (hasPatch) {
      const result = scheduleOnly
        ? await updateTaskSchedule(familyId, taskId, {
            ...(cleanPatch.weekdays !== undefined ? { weekdays: cleanPatch.weekdays } : {}),
            ...(cleanPatch.localHour !== undefined ? { localHour: cleanPatch.localHour } : {}),
            ...(cleanPatch.deliveryPref === "text" || cleanPatch.deliveryPref === "email"
              ? { deliveryPref: cleanPatch.deliveryPref }
              : {}),
          })
        : await updateCustomTask(familyId, taskId, cleanPatch);
      if (!result.ok) return { updated: false, note: result.note };
    }
    return { updated: true, note: "Task updated. Tell the parent in one short aside." };
  },
});
