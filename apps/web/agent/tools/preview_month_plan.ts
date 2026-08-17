import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
  type CallerAuthAttributes,
} from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  createMonthPlanDraft,
  proposedMonthPlanSchema,
  resumeMonthPlanDraft,
  restoreMonthPlanDraft,
  reviseMonthPlanDraft,
  verifyMonthPlanDraft,
} from "../../lib/month-plan-draft";
import { plannerEventClient } from "../../lib/planner-events";
import {
  archiveWorkingPlan,
  loadWorkingMonthPlan,
  saveWorkingMonthPlan,
} from "../../lib/working-plans";
import {
  abandonMonthPlanDraftState,
  activateMonthPlanDraft,
  monthPlanSessionState,
} from "../month-plan-session-state";

export const previewMonthPlanInputSchema = z
  .object({
    action: z
      .enum(["create", "revise", "restore", "resume", "abandon"])
      .describe(
        "Create a preview, revise it, restore an earlier revision, resume it from the Binder, or abandon it.",
      ),
    plan: proposedMonthPlanSchema
      .optional()
      .describe(
        "The complete four-week proposal. Required for create and revise; omit for restore and abandon.",
      ),
    draftToken: z
      .string()
      .min(40)
      .max(200_000)
      .optional()
      .describe(
        "The latest draftToken from preview_month_plan, verbatim. Required except when creating the first preview.",
      ),
    restoreRevision: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "The earlier visible revision number. Required only when action is restore.",
      ),
  })
  .strict()
  .superRefine((input, context) => {
    type ConditionalField =
      | "plan"
      | "draftToken"
      | "restoreRevision";
    const requireField = (field: ConditionalField) => {
      if (input[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is required when action is ${input.action}`,
        });
      }
    };
    const omitField = (field: ConditionalField) => {
      if (input[field] !== undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is not allowed when action is ${input.action}`,
        });
      }
    };

    if (input.action === "create") {
      requireField("plan");
      omitField("draftToken");
      omitField("restoreRevision");
    } else if (input.action === "revise") {
      requireField("plan");
      requireField("draftToken");
      omitField("restoreRevision");
    } else if (input.action === "restore") {
      requireField("draftToken");
      requireField("restoreRevision");
      omitField("plan");
    } else if (input.action === "resume") {
      omitField("plan");
      omitField("draftToken");
      omitField("restoreRevision");
    } else {
      requireField("draftToken");
      omitField("plan");
      omitField("restoreRevision");
    }
  });

/**
 * Preview-only month planning. The token is authenticated session state, and
 * the verified payload is saved as recoverable Binder work. The Planner is
 * still changed only by approve_month_plan.
 */
export default defineBoundedTool({
  description:
    "Create, revise, restore, resume, or abandon a family month-plan PREVIEW. Use only after loading the planner, family events for the month, child progress from the authenticated context, and reusable final materials. The model owns the educational judgment and proposes the complete plan; this tool verifies family children, material ownership, dates, commitments, and revision lineage. Every valid preview is saved as unfinished work in the Binder, and resume reopens the family-owned draft selected by the Binder request. It returns a native visual preview and a signed draftToken. Nothing is saved to the Planner. For a requested change, pass action revise with the latest token and the complete updated plan. For 'undo that change', restore the prior revision. Call approve_month_plan only after the parent explicitly approves the visible preview.",
  deadlineMs: TOOL_DEADLINE.quick,
  // A retry would mint a second draft id and duplicate preview telemetry.
  repeatable: false,
  inputSchema: previewMonthPlanInputSchema,
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { previewed: false, error: "no_family", note: error.message };
      }
      throw error;
    }
    const attributes = (ctx.session.auth.current?.attributes ?? {}) as
      CallerAuthAttributes & { channel?: string };
    const client = plannerEventClient(attributes.channel);

    const existingPayload = input.action === "create" || input.action === "resume"
      ? null
      : verifyMonthPlanDraft(
        input.draftToken!,
        ctx.session.id,
        access.familyId,
        { secret: process.env.CRON_SECRET },
      );
    if (
      input.action !== "create"
      && input.action !== "resume"
      && (!existingPayload
        || monthPlanSessionState.get().activeDraftId !== existingPayload.draftId)
    ) {
      return {
        previewed: false,
        error: "invalid_draft",
        note: "This preview was not saved. Your Planner did not change. Ask Homa to rebuild it if you want it back.",
      };
    }

    if (input.action === "abandon") {
      const payload = existingPayload;
      if (!payload) {
        return {
          previewed: false,
          error: "invalid_draft",
          note: "This preview was not saved. Your Planner did not change. Ask Homa to rebuild it if you want it back.",
        };
      }
      const revision = payload.history[payload.history.length - 1].revision;
      await emitMapEvent("planner.month_abandoned", {
        family_id: access.familyId,
        draft_id: payload.draftId,
        revision,
        client,
      });
      await archiveWorkingPlan({
        familyId: access.familyId,
        workingPlanId: payload.draftId,
      });
      monthPlanSessionState.update((state) =>
        abandonMonthPlanDraftState(state, payload.draftId),
      );
      return {
        previewed: false,
        abandoned: true,
        draftId: payload.draftId,
        revision,
        note: "This preview was not saved. Your Planner did not change. Ask Homa to rebuild it if you want it back.",
      };
    }

    const resumedPayload = input.action === "resume"
      ? attributes.workingPlanId
        ? await loadWorkingMonthPlan({
            familyId: access.familyId,
            workingPlanId: attributes.workingPlanId,
          })
        : null
      : null;
    const result =
      input.action === "create"
        ? await createMonthPlanDraft({
            familyId: access.familyId,
            sessionId: ctx.session.id,
            secret: process.env.CRON_SECRET,
            plan: input.plan!,
          })
        : input.action === "revise"
          ? await reviseMonthPlanDraft({
              familyId: access.familyId,
              sessionId: ctx.session.id,
              secret: process.env.CRON_SECRET,
              draftToken: input.draftToken!,
              plan: input.plan!,
            })
          : input.action === "restore"
            ? restoreMonthPlanDraft({
                familyId: access.familyId,
                sessionId: ctx.session.id,
                secret: process.env.CRON_SECRET,
                draftToken: input.draftToken!,
                restoreRevision: input.restoreRevision!,
              })
            : resumeMonthPlanDraft({
                familyId: access.familyId,
                sessionId: ctx.session.id,
                secret: process.env.CRON_SECRET,
                payload: resumedPayload,
              });

    if (!result) {
      return {
        previewed: false,
        error: "invalid_draft",
        note: "This preview was not saved. Your Planner did not change. Ask Homa to rebuild it if you want it back.",
      };
    }
    const durablePayload = verifyMonthPlanDraft(
      result.draftToken,
      ctx.session.id,
      access.familyId,
      { secret: process.env.CRON_SECRET },
    );
    const saved = durablePayload
      ? await saveWorkingMonthPlan({
          familyId: access.familyId,
          ownerUserId: attributes.memberUserId ?? null,
          sessionId: ctx.session.id,
          payload: durablePayload,
        })
      : false;
    if (!saved) {
      return {
        previewed: false,
        error: "working_plan_save_failed",
        note: "I could not save this unfinished plan safely, so I did not present it as recoverable. Your Planner did not change.",
      };
    }
    monthPlanSessionState.update((state) =>
      activateMonthPlanDraft(state, result.preview.draftId),
    );

    if (input.action === "create") {
      await emitMapEvent("planner.month_draft_requested", {
        family_id: access.familyId,
        draft_id: result.preview.draftId,
        child_count: result.preview.children.length,
        client,
      });
    } else if (input.action === "revise") {
      await emitMapEvent("planner.month_revised", {
        family_id: access.familyId,
        draft_id: result.preview.draftId,
        revision: result.preview.revision,
        client,
      });
    } else if (input.action === "restore") {
      await emitMapEvent("planner.month_restored", {
        family_id: access.familyId,
        draft_id: result.preview.draftId,
        revision: result.preview.revision,
        restored_from: result.preview.restoredFrom ?? input.restoreRevision!,
        client,
      });
    }
    await emitMapEvent("planner.month_preview_ready", {
      family_id: access.familyId,
      draft_id: result.preview.draftId,
      revision: result.preview.revision,
      conflict_count: result.preview.conflicts.length,
      unresolved_count: result.preview.unresolvedChoices.length,
      client,
    });

    return {
      previewed: true,
      draftToken: result.draftToken,
      preview: result.preview,
      note:
        "This preview is saved in the Binder, but nothing is on the Planner yet. Let the parent review it on screen, keep listening for changes, and call approve_month_plan only after she clearly approves this version.",
    };
  },
});
