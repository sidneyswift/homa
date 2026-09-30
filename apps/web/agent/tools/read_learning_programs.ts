import { z } from "zod";
import { resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { programDateSchema } from "../../lib/learning-programs";
import { readLearningPrograms } from "../../lib/learning-programs-server";
export default defineBoundedTool({
  description:
    "Load planner first. Read the family's saved program schedules and dated class occurrences, including current revisions. Removed classes stay removed; scheduled minutes are not actual Hours.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    from: programDateSchema,
    through: programDateSchema,
  }),
  async execute(input, ctx) {
    try {
      return {
        complete: true,
        ...(await readLearningPrograms(
          await resolveAgentAccess(ctx.session.auth.current?.attributes),
          input.from,
          input.through,
        )),
      };
    } catch {
      return {
        complete: false,
        note: "Programs could not be read completely. Do not claim there are none.",
      };
    }
  },
});
