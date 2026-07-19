import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import { jobWorkerContext, refuseNonJobWorkerSession } from "../../lib/jobs/guard";
import { completeStageFromWorker } from "../../lib/jobs/runner";

/**
 * How a job's build session finishes a stage (agent-jobs runner spec,
 * material-capture design). Only the runner's own build session may call
 * this: the job and stage come from the auth attributes the runner
 * stamped, never from the model, and the channel guard refuses any other
 * surface. The session names the materials it produced; this links them to
 * the stage and drives the transition (gate the first stage for the
 * parent's review, else approve and advance). Exactly-one-effect: the
 * stage must be the one actually building, so a stray call cannot move a
 * job.
 */
export default defineTool({
  description:
    "Finish the current stage of the build you are running by naming the material(s) you produced for it. Only call this from inside a job build, once the stage's material is created and passed its quality check.",
  inputSchema: z.object({
    materialIds: z
      .array(z.uuid())
      .min(1)
      .max(12)
      .describe("The ids of the materials you built for this stage, from your create_printable results."),
    sandboxCpuSeconds: z.number().min(0).optional(),
    pageFetchCount: z.number().int().min(0).optional(),
    modelTokens: z.number().int().min(0).optional(),
  }),
  async execute(input, ctx) {
    if (!agentJobsEnabled()) {
      return { recorded: false, note: "Long-running builds are not turned on yet." };
    }
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseNonJobWorkerSession(attributes);
    if (refusal) return { recorded: false, note: refusal };

    const worker = jobWorkerContext(attributes);
    if (!worker) {
      return { recorded: false, note: "This build session is missing its job context." };
    }

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { recorded: false, note: error.message };
      }
      throw error;
    }

    const result = await completeStageFromWorker(
      familyId,
      worker.jobId,
      worker.stageNumber,
      input.materialIds,
      {
        sandboxCpuSeconds: input.sandboxCpuSeconds,
        pageFetchCount: input.pageFetchCount,
        modelTokens: input.modelTokens,
      },
      // The build session reporting this stage is the one whose model spend
      // (its turns plus the images and reviews it caused) is this stage's real
      // cost. Recording it here is the authoritative billing key, not the
      // model-supplied metering above (agent-jobs cost attribution).
      ctx.session.id,
    );
    if (!result.ok) return { recorded: false, note: result.note };
    return {
      recorded: true,
      status: result.status,
      note:
        result.status === "awaiting_input"
          ? "Stage recorded. The build now waits for the parent to approve this first volume before continuing."
          : "Stage recorded. The build will continue to the next stage.",
    };
  },
});
