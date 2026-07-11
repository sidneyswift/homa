import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { listFamilyTasks } from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";

export default defineTool({
  description:
    "List this family's scheduled tasks (the built-in morning brief and evening check-in plus any custom tasks), with days, hour, delivery, and paused state. Use before changing or deleting a task, or when the parent asks what is scheduled.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseScheduleSpawnedSession(attributes);
    if (refusal) return { tasks: [], note: refusal };

    let familyId: string;
    try {
      familyId = resolveAgentAccess(attributes).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { tasks: [], note: error.message };
      }
      throw error;
    }

    const tasks = await listFamilyTasks(familyId);
    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        kind: task.kind,
        label: task.label,
        prompt: task.prompt,
        weekdays: task.weekdays,
        localHour: task.localHour,
        deliveryPref: task.deliveryPref,
        paused: task.paused,
        nextRunAt: task.nextRunAt,
      })),
      note: "Built-in kinds (journal_prompt, morning_brief) can be paused or resumed but never edited or deleted; custom tasks can be changed freely.",
    };
  },
});
