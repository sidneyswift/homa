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
  approveMonthPlanDraft,
  verifyMonthPlanDraft,
} from "../../lib/month-plan-draft";
import { plannerEventClient } from "../../lib/planner-events";
import { finalizeWorkingPlan } from "../../lib/working-plans";
import {
  approveMonthPlanDraftState,
  canUseMonthPlanDraft,
  monthPlanSessionState,
} from "../month-plan-session-state";

/** The one exact write at the end of the preview-first month workflow. */
export default defineBoundedTool({
  description:
    "Save the exact visible month-plan preview to the family's existing Planner. Call only in direct response to the parent clearly approving that preview, such as 'I like it', 'yes, use this', or tapping Approve. Never call while choices remain unresolved or because the model thinks the plan is good. The signed draftToken binds the exact visible revision to this family and session. The write is idempotent and rejects a stale preview if the saved month changed since it was opened.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    draftToken: z.string().min(40).max(200_000).describe(
      "The latest draftToken returned with the preview the parent just approved, verbatim.",
    ),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { approved: false, error: "no_family", note: error.message };
      }
      throw error;
    }
    const payload = verifyMonthPlanDraft(
      input.draftToken,
      ctx.session.id,
      access.familyId,
      { secret: process.env.CRON_SECRET },
    );
    if (!payload || !canUseMonthPlanDraft(monthPlanSessionState.get(), payload.draftId)) {
      return {
        approved: false,
        error: "invalid_draft",
        note: "This preview was not saved. Your Planner did not change. Ask Homa to rebuild it if you want it back.",
      };
    }
    const outcome = await approveMonthPlanDraft({
      familyId: access.familyId,
      sessionId: ctx.session.id,
      secret: process.env.CRON_SECRET,
      draftToken: input.draftToken,
    });
    if (outcome.status === "invalid") {
      return {
        approved: false,
        error: "invalid_draft",
        note: "This preview expired. Your Planner stayed unchanged. Ask Homa to rebuild it from the latest saved plan.",
      };
    }
    if (outcome.status === "stale") {
      return {
        approved: false,
        error: "stale_draft",
        note: "The saved month changed while this preview was open. Your Planner stayed unchanged. Ask Homa to update the preview from the latest saved plan.",
      };
    }
    if (outcome.status === "unresolved") {
      return {
        approved: false,
        error: "unresolved_choices",
        note: "This preview still has choices for you. Make those choices with Homa before saving.",
      };
    }
    const attributes = (ctx.session.auth.current?.attributes ?? {}) as
      CallerAuthAttributes & { channel?: string };
    if (outcome.status === "approved") {
      await emitMapEvent("planner.month_approved", {
        family_id: access.familyId,
        draft_id: outcome.draftId,
        revision: outcome.revision,
        child_count: outcome.childCount,
        client: plannerEventClient(attributes.channel),
      });
    }
    monthPlanSessionState.update((state) =>
      approveMonthPlanDraftState(state, outcome.draftId),
    );
    // Planner approval is the primary effect. The Binder list also excludes
    // approval receipts, so a cleanup failure cannot make a saved plan look
    // unapproved or turn a successful save into a false error.
    await finalizeWorkingPlan({
      familyId: access.familyId,
      workingPlanId: outcome.draftId,
      revision: outcome.revision,
    }).catch(() => undefined);
    return {
      approved: true,
      alreadyApproved: outcome.status === "already_approved",
      draftId: outcome.draftId,
      revision: outcome.revision,
      childCount: outcome.childCount,
      note:
        outcome.status === "already_approved"
          ? "This month plan is already on the Planner. Nothing was saved twice."
          : "Your month plan is saved on the Planner.",
    };
  },
});
