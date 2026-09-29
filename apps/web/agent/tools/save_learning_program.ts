import { resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { saveLearningProgram } from "../../lib/learning-programs-server";
import { programDraftSchema } from "../../lib/learning-programs";

export default defineBoundedTool({
  description:
    "Save a reviewed reusable program schedule. Load planner and its programs reference first. This saves classes only, never attendance or Hours. Keep stable program and class IDs on retries.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: programDraftSchema,
  async execute(input, ctx) {
    try {
      return await saveLearningProgram(
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
