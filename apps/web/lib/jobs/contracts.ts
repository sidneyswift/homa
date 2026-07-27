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
  /** Whether this stage parks for the parent's review before the build
   * continues. Each contract decides deliberately: a 36-week program gates
   * its first volume as a calibration checkpoint, while a single-page
   * making must land on its own or the "it will be waiting for you"
   * promise turns into a review chore she never asked for. */
  gatesStage: (stageNumber: number) => boolean;
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

// ---------------------------------------------------------------------------
// materials-studio: build ONE material in the background, a single-stage
// job. The onboarding artifact moment starts this the moment a parent's
// own words hand Homa a theme ("she's obsessed with dinosaurs"), so the
// promise she hears is backed by a durable queued row the runner owns:
// the build retries on its own, parks loudly when it cannot finish, and
// the finished page lands in the Binder and the conversation without
// holding any turn open (chat-first onboarding plan §2.6).
// ---------------------------------------------------------------------------

const materialPlanSchema = z.object({
  /** What to make, written for the build session: the material, the child
   * it is for, and what the parent actually asked for or revealed. */
  request: z.string().min(10).max(600),
  /** The parent's own words, verbatim, that sparked this making. The
   * build reuses her phrasing in the title and theme (aha law A3). */
  herWords: z.string().min(1).max(300).optional(),
  theme: z.string().min(1).max(120).optional(),
  /** e.g. "coloring", "worksheet"; the build may overrule with craft. */
  kind: z.string().min(1).max(60).optional(),
  childName: z.string().min(1).max(60).optional(),
});

/** One stage IS the whole plan: a single-stage job's payload carries the
 * same shape the plan does. */
const materialStagePayloadSchema = materialPlanSchema;

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
    // The first volume is the calibration checkpoint: she approves it
    // before weeks of material follow its shape.
    gatesStage: (stageNumber) => stageNumber === 1,
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
  "materials-studio": {
    planSchema: materialPlanSchema,
    stagePayloadSchema: materialStagePayloadSchema,
    // No skill-specific steering: a one-page build finishes or parks
    // before a steering conversation could reach it. Generic pause and
    // resume still apply; anything else is honestly refused.
    respondSchema: z.never(),
    describeStage: (payload) => {
      const parsed = materialStagePayloadSchema.safeParse(payload);
      if (!parsed.success) return "Making the page";
      return parsed.data.childName
        ? `Making ${parsed.data.childName}'s page`
        : "Making the page";
    },
    // A single page never gates: the whole point of the promise is that
    // it lands finished, and create_printable already runs its own
    // quality check on the rendered pixels before anything ships.
    gatesStage: () => false,
    example: {
      plan: {
        request:
          "A dinosaur coloring page for Mia, 5, who is obsessed with dinosaurs. Big friendly line art she can color.",
        herWords: "she's obsessed with dinosaurs",
        theme: "dinosaurs",
        kind: "coloring",
        childName: "Mia",
      },
      stagePayload: {
        request:
          "A dinosaur coloring page for Mia, 5, who is obsessed with dinosaurs. Big friendly line art she can color.",
        herWords: "she's obsessed with dinosaurs",
        theme: "dinosaurs",
        kind: "coloring",
        childName: "Mia",
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
