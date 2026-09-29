import { resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { scheduleLearningProgram } from "../../lib/learning-programs-server";
import { programScheduleSchema } from "../../lib/learning-programs";

export default defineBoundedTool({
  description:
    "Place a saved program on a bounded date range as independent planned classes per child. Load planner first. No hours are logged. Retrying never recreates removed occurrences.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: programScheduleSchema,
  async execute(input, ctx) {
    try {
      return await scheduleLearningProgram(
        await resolveAgentAccess(ctx.session.auth.current?.attributes),
        input,
      );
    } catch {
      return {
        status: "unavailable",
        confirmed: false,
        note: "The change could not be confirmed. Read the current record before retrying.",
      };
    }
  },
});
