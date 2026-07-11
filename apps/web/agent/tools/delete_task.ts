import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { deleteCustomTask } from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";

export default defineTool({
  description:
    "Permanently delete one of this family's CUSTOM scheduled tasks. Only after the parent clearly confirms which one, in this conversation. Built-in tasks (morning brief, evening check-in) cannot be deleted, only paused with update_task.",
  inputSchema: z.object({
    taskId: z.string().uuid().describe("The id from list_tasks."),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseScheduleSpawnedSession(attributes);
    if (refusal) return { deleted: false, note: refusal };

    let familyId: string;
    try {
      familyId = resolveAgentAccess(attributes).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { deleted: false, note: error.message };
      }
      throw error;
    }

    const result = await deleteCustomTask(familyId, input.taskId);
    if (!result.ok) return { deleted: false, note: result.note };
    return { deleted: true, note: "Task deleted. Confirm to the parent in one short aside." };
  },
});
