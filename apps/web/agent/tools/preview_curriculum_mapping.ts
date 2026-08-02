import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import {
  familyHasPlusCapability,
  PLUS_CURRICULUM_NOTE,
} from "../../lib/billing/plus-capability";
import {
  createCurriculumMappingDraft,
  proposedCurriculumMappingSchema,
  restoreCurriculumMappingDraft,
  reviseCurriculumMappingDraft,
  verifyCurriculumMappingDraft,
} from "../../lib/library/family-curriculum-mapping";
import {
  abandonCurriculumMappingDraftState,
  activateCurriculumMappingDraft,
  curriculumMappingSessionState,
} from "../curriculum-mapping-session-state";

export const previewCurriculumMappingInputSchema = z
  .object({
    action: z
      .enum(["create", "revise", "restore", "abandon"])
      .describe("Create, revise, restore, or abandon the review preview."),
    proposal: proposedCurriculumMappingSchema
      .optional()
      .describe(
        "The complete verified unit and Planner proposal. Required for create and revise.",
      ),
    draftToken: z
      .string()
      .min(40)
      .max(300_000)
      .optional()
      .describe(
        "The latest draftToken from this tool, verbatim. Required except for create.",
      ),
    restoreRevision: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("The earlier visible revision to restore."),
  })
  .superRefine((input, context) => {
    const requireField = (
      field: "proposal" | "draftToken" | "restoreRevision",
    ) => {
      if (input[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is required when action is ${input.action}`,
        });
      }
    };
    const omitField = (
      field: "proposal" | "draftToken" | "restoreRevision",
    ) => {
      if (input[field] !== undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is not allowed when action is ${input.action}`,
        });
      }
    };
    if (input.action === "create") {
      requireField("proposal");
      omitField("draftToken");
      omitField("restoreRevision");
    } else if (input.action === "revise") {
      requireField("proposal");
      requireField("draftToken");
      omitField("restoreRevision");
    } else if (input.action === "restore") {
      requireField("draftToken");
      requireField("restoreRevision");
      omitField("proposal");
    } else {
      requireField("draftToken");
      omitField("proposal");
      omitField("restoreRevision");
    }
  });

/** Preview only. Approval is the sole Library and Planner write. */
export default defineBoundedTool({
  description:
    "Build, revise, restore, or abandon a parent-reviewable preview that breaks one ready Family Library curriculum into ordered units and proposes where approved units will be appended in Planner. This is Homa Plus work. Use read_family_curriculum through the end first. Code verifies exact page quotes, canonical subjects, assigned children, existing plans, capacity, and revision lineage. Nothing is written until approve_curriculum_mapping, which may run only after the parent clearly approves the visible preview.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: previewCurriculumMappingInputSchema,
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(ctx.session.auth.current?.attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { previewed: false, error: "no_family", note: error.message };
      }
      throw error;
    }
    if (!(await familyHasPlusCapability(familyId))) {
      return {
        previewed: false,
        error: "requires_plus",
        note: PLUS_CURRICULUM_NOTE,
      };
    }

    const existingPayload =
      input.action === "create"
        ? null
        : verifyCurriculumMappingDraft(
            input.draftToken!,
            ctx.session.id,
            familyId,
            { secret: process.env.CRON_SECRET },
          );
    if (
      input.action !== "create" &&
      (!existingPayload ||
        curriculumMappingSessionState.get().activeDraftId !==
          existingPayload.draftId)
    ) {
      return {
        previewed: false,
        error: "invalid_draft",
        note:
          "This review is no longer active. Library and Planner did not change. Build a new review from what is saved now.",
      };
    }

    if (input.action === "abandon") {
      const payload = existingPayload!;
      curriculumMappingSessionState.update((state) =>
        abandonCurriculumMappingDraftState(state, payload.draftId),
      );
      return {
        previewed: false,
        abandoned: true,
        draftId: payload.draftId,
        revision: payload.history.at(-1)?.revision ?? 1,
        note: "The review was set aside. Library and Planner did not change.",
      };
    }

    const result =
      input.action === "create"
        ? await createCurriculumMappingDraft({
            familyId,
            sessionId: ctx.session.id,
            secret: process.env.CRON_SECRET,
            proposal: input.proposal!,
          })
        : input.action === "revise"
          ? await reviseCurriculumMappingDraft({
              familyId,
              sessionId: ctx.session.id,
              secret: process.env.CRON_SECRET,
              draftToken: input.draftToken!,
              proposal: input.proposal!,
            })
          : restoreCurriculumMappingDraft({
              familyId,
              sessionId: ctx.session.id,
              secret: process.env.CRON_SECRET,
              draftToken: input.draftToken!,
              restoreRevision: input.restoreRevision!,
            });

    if (!result.ok) {
      return {
        previewed: false,
        error: result.failure.code,
        note: result.failure.note,
        ...(result.failure.code === "invalid_evidence"
          ? { unitOrdinals: result.failure.unitOrdinals }
          : {}),
      };
    }
    curriculumMappingSessionState.update((state) =>
      activateCurriculumMappingDraft(state, result.preview.draftId),
    );
    return {
      previewed: true,
      draftToken: result.draftToken,
      preview: result.preview,
      note:
        "This review is ready. Library and Planner have not changed. Let the parent check the units, children, subjects, and weeks. Approve only after she clearly accepts this version.",
    };
  },
});
