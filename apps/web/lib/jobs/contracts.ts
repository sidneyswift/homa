import { z } from "zod";

/**
 * The typed job-contract registry (agent-jobs plan §A1, expert council
 * 2026-07-18). This is what makes the generic job primitive general
 * without becoming a jsonb swamp: each fleet skill declares the shape of
 * its own plan, its per-stage payload, and the steering ("respond") arms
 * it accepts. The generic infra (lib/jobs/store.ts, the four tools, the
 * runner) validates against these schemas and NEVER branches on skill
 * semantics; only the skill's own reading of plan/payload knows what a
 * "week" or a "volume" means.
 *
 * Adding a new job-consuming skill is one entry here plus a SKILL.md, with
 * no migration and no change to the generic infra. scripts/jobs-check.mts
 * (pnpm check:jobs) enforces that every entry parses its own example and
 * resolves to a real skill package, the same discipline check:events
 * applies to the event registry.
 */

/** Steering arms every job supports regardless of skill. respond_to_agent_job
 * tries these first, then the skill's own arms. */
export const GENERIC_RESPOND_SCHEMA = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
]);
export type GenericRespond = z.infer<typeof GENERIC_RESPOND_SCHEMA>;

export interface JobContract {
  /** The plan (scope and sequence) the skill drafts up front. */
  planSchema: z.ZodTypeAny;
  /** One stage's slice of the plan. */
  stagePayloadSchema: z.ZodTypeAny;
  /** Skill-specific steering arms (approve_stage, revise_plan, provide_input,
   * ...), a discriminated union on "action". Generic pause/resume are added
   * on top by the store, so a skill never redeclares them. */
  respondSchema: z.ZodTypeAny;
  /** A one-line, non-PII status string for a stage, used by generic status
   * rendering. Receives an already-validated stage payload. */
  describeStage: (payload: unknown) => string;
  /** A self-test example so check:jobs can prove the schemas parse. */
  example: { plan: unknown; stagePayload: unknown };
}

// ---------------------------------------------------------------------------
// curriculum-studio: build a multi-week curriculum for one child.
// ---------------------------------------------------------------------------

const curriculumPlanSchema = z.object({
  // Atlas id when the build started from a known profile
  // (find_curriculum_profile); absent when built from a described source.
  curriculumKey: z
    .string()
    .regex(/^[a-z0-9_-]{2,60}$/u)
    .optional(),
  pacing: z.enum(["fixed", "mastery"]),
  weeks: z.number().int().min(1).max(200),
  scopeAndSequence: z
    .array(
      z.object({
        block: z.string().min(1).max(120),
        focus: z.string().min(1).max(280),
      }),
    )
    .min(1)
    .max(200),
});

const curriculumStagePayloadSchema = z.object({
  weekNumber: z.number().int().min(1).max(200),
  theme: z.string().min(1).max(120),
  focus: z.string().min(1).max(280),
  activities: z.array(z.string().min(1).max(280)).max(12).optional(),
});

const curriculumRespondSchema = z.discriminatedUnion("action", [
  // Approve the volume that is waiting for review, then keep building.
  z.object({ action: z.literal("approve_stage"), stageNumber: z.number().int().min(1) }),
  // Reshape the parts not yet built. Approved stages are never rebuilt.
  z.object({ action: z.literal("revise_plan"), instruction: z.string().min(1).max(1000) }),
]);

export const JOB_CONTRACTS: Record<string, JobContract> = {
  "curriculum-studio": {
    planSchema: curriculumPlanSchema,
    stagePayloadSchema: curriculumStagePayloadSchema,
    respondSchema: curriculumRespondSchema,
    describeStage: (payload) => {
      const parsed = curriculumStagePayloadSchema.safeParse(payload);
      if (!parsed.success) return "Building the next part";
      return `Building week ${parsed.data.weekNumber}: ${parsed.data.theme}`;
    },
    example: {
      plan: {
        curriculumKey: "all-about-learning",
        pacing: "mastery",
        weeks: 12,
        scopeAndSequence: [
          { block: "Letter sounds", focus: "Single consonant and short vowel sounds" },
          { block: "Blending", focus: "Two and three sound words" },
        ],
      },
      stagePayload: {
        weekNumber: 3,
        theme: "Short a blending",
        focus: "Blend short a CVC words",
        activities: ["Sound tiles for cat, mat, sat", "Trace and read practice"],
      },
    },
  },
};

export type JobSkill = keyof typeof JOB_CONTRACTS;

export const JOB_SKILLS = Object.keys(JOB_CONTRACTS);

export function getJobContract(skill: string): JobContract | null {
  return Object.prototype.hasOwnProperty.call(JOB_CONTRACTS, skill)
    ? JOB_CONTRACTS[skill]
    : null;
}

/** Validate a skill's plan. familyId scoping is the tool's job, not this. */
export function parseJobPlan(
  skill: string,
  plan: unknown,
): { ok: true; skill: string } | { ok: false; note: string } {
  const contract = getJobContract(skill);
  if (!contract) {
    return { ok: false, note: `"${skill}" is not a job-capable skill.` };
  }
  const parsed = contract.planSchema.safeParse(plan);
  if (!parsed.success) {
    return {
      ok: false,
      note: parsed.error.issues[0]?.message ?? "The plan does not match this skill's shape.",
    };
  }
  return { ok: true, skill };
}
