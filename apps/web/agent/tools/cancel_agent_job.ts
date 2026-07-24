import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import { refuseJobSpawnedSession } from "../../lib/jobs/guard";
import { cancelJob } from "../../lib/jobs/store";

/**
 * Cancel a running job (agent-jobs primitive). Cooperative: if the build
 * is mid-stage the tool records the cancel request and the runner stops
 * after the current stage, so the honest result is "it will stop after the
 * current part". If nothing is mid-flight it cancels immediately.
 * Everything already built stays in the family's Binder either way.
 * familyId comes from the session, so a model id only ever cancels this
 * family's own build.
 */
export default defineBoundedTool({
  description:
    "Stop a running background build, only on the parent's clear request. Everything already built stays saved. If a part is being built right now, it finishes that part first, then stops.",
  deadlineMs: TOOL_DEADLINE.quick,
  inputSchema: z.object({
    jobId: z.uuid().describe("The build to stop, from get_agent_job_status or your context."),
    reason: z
      .string()
      .max(240)
      .optional()
      .describe("Optional short note on why, for the record. Never a parent quote or anything private."),
  }),
  async execute(input, ctx) {
    if (!agentJobsEnabled()) {
      return { cancelled: false, note: "Long-running builds are not turned on yet." };
    }
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseJobSpawnedSession(attributes);
    if (refusal) return { cancelled: false, note: refusal };

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { cancelled: false, note: error.message };
      }
      throw error;
    }

    const memberUserId = (attributes as { memberUserId?: unknown } | undefined)?.memberUserId;
    const result = await cancelJob({
      familyId,
      actorUserId: typeof memberUserId === "string" ? memberUserId : null,
      jobId: input.jobId,
      reason: input.reason ?? null,
    });
    if (!result.ok) return { cancelled: false, note: result.note };
    return { cancelled: true, status: result.status, note: result.note };
  },
});
