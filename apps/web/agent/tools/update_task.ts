import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { setTaskPaused, updateCustomTask } from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";

export default defineTool({
  description:
    "Change one of this family's scheduled tasks: pause or resume any task (including the built-in morning brief and evening check-in), or edit a custom task's label, instructions, days, hour, or delivery. Use list_tasks first when the target is ambiguous.",
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

    if (paused !== undefined) {
      const result = await setTaskPaused(familyId, taskId, paused);
      if (!result.ok) return { updated: false, note: result.note };
      if (Object.keys(patch).length === 0) {
        return {
          updated: true,
          note: `Task ${paused ? "paused" : "resumed"}. Tell the parent in one short aside.`,
        };
      }
    }

    if (Object.keys(patch).length > 0) {
      const result = await updateCustomTask(familyId, taskId, patch);
      if (!result.ok) return { updated: false, note: result.note };
    }
    return { updated: true, note: "Task updated. Tell the parent in one short aside." };
  },
});
