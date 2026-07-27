import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import { getJobStatus } from "../../lib/jobs/store";

/**
 * Read the real status of a family's running jobs (agent-jobs primitive).
 * Always family-scoped: a job id from the model can only ever read this
 * family's own rows. Use this when the parent asks how a build is going;
 * quote what it returns, never invent a percentage or a finish date.
 */
export default defineBoundedTool({
  description:
    "Check how a family's background builds are going: pass a jobId for one, or omit it to list all of this family's active builds. Returns real status and stage counts. Never guess progress or a finish date; report exactly what this returns.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    jobId: z
      .uuid()
      .optional()
      .describe("A specific job to check. Omit to list every active build for this family."),
  }),
  async execute(input, ctx) {
    if (!agentJobsEnabled()) {
      return { jobs: [], note: "Long-running builds are not turned on yet." };
    }
    const attributes = ctx.session.auth.current?.attributes;
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { jobs: [], note: error.message };
      }
      throw error;
    }

    const result = await getJobStatus(familyId, input.jobId ?? null);
    if (!result.ok) return { jobs: [], note: result.note };
    return {
      jobs: result.jobs,
      note:
        result.jobs.length === 0
          ? "No active builds right now."
          : "Report these plainly; the stage counts and status are the truth.",
    };
  },
});
