import { resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { correctHoursEntry } from "../../lib/hours-corrections";
import { hoursCorrectionSchema } from "../../lib/hours-corrections";

export default defineBoundedTool({
  description:
    "Correct or remove exact recorded time after inspect_hours_entry. Load hours-records first. Use child scope unless the parent explicitly requests every linked participant. Preserve all unrequested fields. Conflicts require a fresh read, never a blind retry.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: hoursCorrectionSchema,
  async execute(input, ctx) {
    try {
      return await correctHoursEntry(
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
