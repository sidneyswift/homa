import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import { refuseJobSpawnedSession } from "../../lib/jobs/guard";
import { respondToJob } from "../../lib/jobs/store";

/**
 * The single steering channel for a running job (agent-jobs primitive, the
 * council's four-verb contract). One tool serves web buttons, chat
 * sentences, and SMS replies, and no skill ships its own lifecycle tool.
 * The response's `action` is a discriminated union: generic "pause"/
 * "resume", plus whatever steering arms the job's skill declares in its
 * JOB_CONTRACTS (for curriculum-studio: "approve_stage", "revise_plan").
 * familyId comes from the session; the acting adult is recorded.
 */
export default defineTool({
  description:
    "Steer a running background build: pause it, resume it, approve the part waiting for review so it keeps going, or apply a change to the parts not yet built. Pass the job's id and a response object whose 'action' says what to do; the skill tells you which actions its builds accept.",
  inputSchema: z.object({
    jobId: z.uuid().describe("The build to steer, from get_agent_job_status or your context."),
    response: z
      .record(z.string(), z.unknown())
      .describe(
        "What to do, as an object with an 'action' field. Generic: { action: 'pause' } or { action: 'resume' }. Skill-specific arms (e.g. { action: 'approve_stage', stageNumber } or { action: 'revise_plan', instruction }) are defined by the job's skill.",
      ),
  }),
  async execute(input, ctx) {
    if (!agentJobsEnabled()) {
      return { applied: false, note: "Long-running builds are not turned on yet." };
    }
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseJobSpawnedSession(attributes);
    if (refusal) return { applied: false, note: refusal };

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { applied: false, note: error.message };
      }
      throw error;
    }

    const memberUserId = (attributes as { memberUserId?: unknown } | undefined)?.memberUserId;
    const result = await respondToJob({
      familyId,
      actorUserId: typeof memberUserId === "string" ? memberUserId : null,
      jobId: input.jobId,
      response: input.response,
    });
    if (!result.ok) return { applied: false, note: result.note };
    return { applied: true, status: result.status, note: result.note };
  },
});
