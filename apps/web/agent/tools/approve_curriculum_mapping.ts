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
import { emitMapEvent } from "../../lib/map/events";
import {
  approveCurriculumMappingDraft,
  verifyCurriculumMappingDraft,
} from "../../lib/library/family-curriculum-mapping";
import {
  approveCurriculumMappingDraftState,
  canUseCurriculumMappingDraft,
  curriculumMappingSessionState,
} from "../curriculum-mapping-session-state";

/** The only write in the curriculum decomposition and mapping workflow. */
export default defineBoundedTool({
  description:
    "Save the exact visible curriculum preview as Library units and append its approved activities to the existing Planner. Call only after the parent clearly approves that preview. This is Homa Plus work. The signed token binds the source version, child assignments, plan versions, unit evidence, and exact placements. The write is atomic and idempotent, and it never creates calendar dates.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z
    .object({
      draftToken: z
        .string()
        .min(40)
        .max(300_000)
        .describe(
          "The latest draftToken returned with the preview the parent just approved, verbatim.",
        ),
    })
    .strict(),
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(ctx.session.auth.current?.attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { approved: false, error: "no_family", note: error.message };
      }
      throw error;
    }
    if (!(await familyHasPlusCapability(familyId))) {
      return {
        approved: false,
        error: "requires_plus",
        note: PLUS_CURRICULUM_NOTE,
      };
    }
    const payload = verifyCurriculumMappingDraft(
      input.draftToken,
      ctx.session.id,
      familyId,
      { secret: process.env.CRON_SECRET },
    );
    if (
      !payload ||
      !canUseCurriculumMappingDraft(
        curriculumMappingSessionState.get(),
        payload.draftId,
      )
    ) {
      return {
        approved: false,
        error: "invalid_draft",
        note:
          "This review expired. Library and Planner stayed unchanged. Build a new review from what is saved now.",
      };
    }
    const outcome = await approveCurriculumMappingDraft({
      familyId,
      sessionId: ctx.session.id,
      secret: process.env.CRON_SECRET,
      draftToken: input.draftToken,
    });
    if (outcome.status === "invalid") {
      return {
        approved: false,
        error: "invalid_draft",
        note:
          "This review expired. Library and Planner stayed unchanged. Build a new review from what is saved now.",
      };
    }
    if (outcome.status === "stale") {
      return {
        approved: false,
        error: "stale_draft",
        note:
          "Something changed while this review was open: the curriculum, the children selected for it, or a Planner plan. Nothing from this review was saved. Build a new review from what is saved now.",
      };
    }
    curriculumMappingSessionState.update((state) =>
      approveCurriculumMappingDraftState(state, outcome.draftId),
    );
    if (outcome.status === "approved") {
      await emitMapEvent("library.curriculum_mapped", {
        family_id: familyId,
        asset_id: outcome.sourceAssetId,
        draft_id: outcome.draftId,
        unit_count: outcome.unitAssets.length,
        planner_target_count: outcome.plannerTargets.length,
      });
    }
    return {
      approved: true,
      alreadyApproved: outcome.status === "already_approved",
      draftId: outcome.draftId,
      revision: outcome.revision,
      sourceAssetId: outcome.sourceAssetId,
      sourceLibraryUrl: outcome.sourceLibraryUrl,
      plannerUrl: outcome.plannerUrl,
      unitAssets: outcome.unitAssets,
      plannerTargets: outcome.plannerTargets,
      note:
        outcome.status === "already_approved"
          ? "These units and Planner activities were already saved. Nothing was added twice."
          : outcome.plannerTargets.length === 0
            ? `${outcome.unitAssets.length} approved ${outcome.unitAssets.length === 1 ? "unit is" : "units are"} in Library. Planner stayed unchanged.`
            : `${outcome.unitAssets.length} approved ${outcome.unitAssets.length === 1 ? "unit is" : "units are"} in Library, and ${outcome.plannerTargets.length} ${outcome.plannerTargets.length === 1 ? "activity was" : "activities were"} added to Planner. Existing Planner activities stayed in place. No calendar dates were added.`,
    };
  },
});
