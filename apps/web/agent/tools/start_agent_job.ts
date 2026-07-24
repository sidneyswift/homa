import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import { refuseJobSpawnedSession } from "../../lib/jobs/guard";
import { startJob } from "../../lib/jobs/store";

/**
 * Start a finite, resumable, multi-stage job for a fleet skill (agent-jobs
 * primitive, agent-jobs plan §A1/§A4). Generic on purpose: the skill names
 * itself and hands its own plan shape; the tool re-derives familyId from
 * the authenticated caller (never the model), validates the plan against
 * that skill's JOB_CONTRACTS schema, and enforces one active job per
 * family + skill + child. The skill's SKILL.md owns WHEN to call this;
 * this tool owns the durable, tenant-safe effect.
 */
export default defineBoundedTool({
  description:
    "Start a finite background job that builds in stages over time, for a skill that needs it (a multi-week curriculum, a multi-part project). Only call this after the skill's procedure says to, and after the parent has confirmed the scope. familyId is taken from the session, never from you. If a job for this skill and child is already running, this returns that one instead of starting a second.",
  deadlineMs: TOOL_DEADLINE.quick,
  inputSchema: z.object({
    skill: z
      .string()
      .min(2)
      .max(60)
      .describe("The fleet skill that owns this job, e.g. 'curriculum-studio'. Must be a job-capable skill."),
    title: z
      .string()
      .min(1)
      .max(160)
      .describe("A short parent-facing name for the build, e.g. \"Theo's All About Reading plan\"."),
    plan: z
      .record(z.string(), z.unknown())
      .describe("The scope and sequence, in the exact shape the skill's contract defines. The skill tells you this shape."),
    totalStages: z
      .number()
      .int()
      .min(1)
      .max(200)
      .describe("How many stages the build has (e.g. the number of weeks)."),
    childId: z
      .uuid()
      .optional()
      .describe("The child this build is for, from your family context. Omit for a family-wide build."),
    startIdempotencyKey: z
      .string()
      .min(3)
      .max(160)
      .optional()
      .describe("Optional stable key so a repeated identical start does not spawn a second job."),
  }),
  async execute(input, ctx) {
    if (!agentJobsEnabled()) {
      return {
        started: false,
        note: "Long-running builds are not turned on yet. Offer to make the first part now instead, or set it up as a task if it repeats.",
      };
    }
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseJobSpawnedSession(attributes);
    if (refusal) return { started: false, note: refusal };

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { started: false, note: error.message };
      }
      throw error;
    }

    const memberUserId = (attributes as { memberUserId?: unknown } | undefined)?.memberUserId;
    const result = await startJob({
      familyId,
      requestedByUserId: typeof memberUserId === "string" ? memberUserId : null,
      sessionId: ctx.session.id,
      skill: input.skill,
      title: input.title,
      plan: input.plan,
      totalStages: input.totalStages,
      childId: input.childId ?? null,
      startIdempotencyKey: input.startIdempotencyKey ?? null,
    });
    if (!result.ok) return { started: false, note: result.note };
    return {
      started: true,
      jobId: result.jobId,
      status: result.status,
      alreadyRunning: result.alreadyExisted,
      note: result.note,
    };
  },
});
