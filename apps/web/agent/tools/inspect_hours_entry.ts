import { z } from "zod";
import { resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { inspectHoursEntry } from "../../lib/hours-corrections";
export default defineBoundedTool({
  description:
    "Load hours-records first. Inspect one exact Hours entry before correction. Returns the current revision, child and linked participants. A child filter never changes a shared record's ownership.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    entryId: z
      .uuid()
      .describe("Entry id returned by find_hours, never invented."),
  }),
  async execute(input, ctx) {
    try {
      return await inspectHoursEntry(
        await resolveAgentAccess(ctx.session.auth.current?.attributes),
        input.entryId,
      );
    } catch {
      return { result: "unavailable" };
    }
  },
});
