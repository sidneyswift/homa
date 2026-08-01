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
  restoreMonthPlanDraft,
  reviseMonthPlanDraft,
  verifyMonthPlanDraft,
} from "../../lib/month-plan-draft";
import { plannerEventClient } from "../../lib/planner-events";
import {
  abandonMonthPlanDraftState,
  activateMonthPlanDraft,
  monthPlanSessionState,
} from "../month-plan-session-state";

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    plan: proposedMonthPlanSchema.describe(
      "The complete four-week proposal for every child in the family.",
    ),
  }),
  z.object({
    action: z.literal("revise"),
    draftToken: z.string().min(40).max(200_000).describe(
      "The latest draftToken from preview_month_plan, verbatim.",
    ),
    plan: proposedMonthPlanSchema.describe(
      "The complete revised proposal. Preserve everything the parent did not ask to change.",
    ),
  }),
  z.object({
    action: z.literal("restore"),
    draftToken: z.string().min(40).max(200_000).describe(
      "The latest draftToken from preview_month_plan, verbatim.",
    ),
    restoreRevision: z.number().int().min(1).max(100).describe(
      "The earlier revision number to restore, from the visible preview history.",
    ),
  }),
  z.object({
    action: z.literal("abandon"),
    draftToken: z.string().min(40).max(200_000).describe(
      "The latest draftToken from preview_month_plan, verbatim.",
    ),
  }),
]);

/**
 * Preview-only month planning. The token is authenticated, session-bound
 * working state, not a database record. approve_month_plan is the only write.
 */
export default defineBoundedTool({
  description:
    "Create, revise, restore, or abandon a family month-plan PREVIEW. Use only after loading the planner, family events for the month, child progress from the authenticated context, and reusable final materials. The model owns the educational judgment and proposes the complete plan; this tool verifies family children, material ownership, dates, commitments, and revision lineage. It returns a native visual preview and a signed draftToken. Nothing is saved to the Planner. For a requested change, pass action revise with the latest token and the complete updated plan. For 'undo that change', restore the prior revision. Call approve_month_plan only after the parent explicitly approves the visible preview.",
  deadlineMs: TOOL_DEADLINE.quick,
  // A retry would mint a second draft id and duplicate preview telemetry.
  repeatable: false,
  inputSchema,
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

    const existingPayload = input.action === "create"
      ? null
      : verifyMonthPlanDraft(
        input.draftToken,
        ctx.session.id,
        access.familyId,
        { secret: process.env.CRON_SECRET },
      );
    if (
      input.action !== "create"
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

    const result =
      input.action === "create"
        ? await createMonthPlanDraft({
            familyId: access.familyId,
            sessionId: ctx.session.id,
            secret: process.env.CRON_SECRET,
            plan: input.plan,
          })
        : input.action === "revise"
          ? await reviseMonthPlanDraft({
              familyId: access.familyId,
              sessionId: ctx.session.id,
              secret: process.env.CRON_SECRET,
              draftToken: input.draftToken,
              plan: input.plan,
            })
          : restoreMonthPlanDraft({
              familyId: access.familyId,
              sessionId: ctx.session.id,
              secret: process.env.CRON_SECRET,
              draftToken: input.draftToken,
              restoreRevision: input.restoreRevision,
            });

    if (!result) {
      return {
        previewed: false,
        error: "invalid_draft",
        note: "This preview was not saved. Your Planner did not change. Ask Homa to rebuild it if you want it back.",
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
    } else {
      await emitMapEvent("planner.month_restored", {
        family_id: access.familyId,
        draft_id: result.preview.draftId,
        revision: result.preview.revision,
        restored_from: result.preview.restoredFrom ?? input.restoreRevision,
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
        "This is a preview. Nothing is on the Planner yet. Let the parent review it on screen, keep listening for changes, and call approve_month_plan only after she clearly approves this version.",
    };
  },
});
