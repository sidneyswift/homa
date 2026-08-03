import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  familyHasPlusCapability,
  PLUS_CURRICULUM_NOTE,
} from "../../lib/billing/plus-capability";
import { familyAssetIdsIncludeCurriculumUnits } from "../../lib/library/family-curriculum-source";
import { emitFamilyAssetUsed } from "../../lib/library/family-asset-events";
import {
  familyAssetReferencesForSurface,
  MAX_FAMILY_ASSET_REFERENCES,
} from "../../lib/library/family-asset-reference";
import { emitMapEvent } from "../../lib/map/events";
import { siteUrl } from "../../lib/map/email";
import { MAX_ACTIVITY_TEXT, type PlanEdit } from "../../lib/map/plan-edits";
import { editPlanActivities, getPlanBoard } from "../../lib/map/store";

/**
 * Direct writes to one plan's activities (founder ruling 2026-07-19:
 * Homa edits the planner directly, no propose-then-confirm step). The
 * whole batch is validated against the current plan before anything is
 * written, and the check-off map is remapped in the same write, so a
 * half-applied edit or a check pointing at a moved activity cannot
 * exist. The tool result is the only truth about what changed; the web
 * chat renders it as a chip and refreshes the open planner canvas.
 *
 * Tenancy: familyId comes from session auth only; the model-supplied
 * childId is re-verified inside THAT family before the plan row is even
 * read, the same wall as every other tool.
 */

const WRONG_CHILD_NOTE =
  "That child id is not in this family. Use a child id from the family context block.";

const subjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/u);

/** Flat edit schema for provider compatibility (the explore_child_map
 * pattern); the per-action requirements are validated in execute. */
const editSchema = z
  .object({
    action: z.enum(["add", "replace", "remove"]),
    week: z.number().int().min(1).max(4),
    index: z
      .number()
      .int()
      .min(0)
      .max(30)
      .optional()
      .describe("The activity's index from open_planner. Required for replace and remove."),
    text: z
      .string()
      .trim()
      .min(1)
      .max(MAX_ACTIVITY_TEXT)
      .optional()
      .describe("The activity, one to three plain sentences a parent can act on. Required for add and replace."),
    sourceFamilyAssetIds: z
      .array(z.string().uuid())
      .max(MAX_FAMILY_ASSET_REFERENCES)
      .optional()
      .describe(
        "Exact Family Library asset ids that ground this added or replaced activity. Use ids from get_family_asset. Not allowed for remove.",
      ),
  })
  .strict();

function toPlanEdit(edit: z.infer<typeof editSchema>): PlanEdit | null {
  if (edit.action === "add") {
    return edit.text
      ? {
          action: "add",
          week: edit.week,
          text: edit.text,
          ...(edit.sourceFamilyAssetIds
            ? { sourceFamilyAssetIds: edit.sourceFamilyAssetIds }
            : {}),
        }
      : null;
  }
  if (edit.action === "replace") {
    return edit.index !== undefined && edit.text
      ? {
          action: "replace",
          week: edit.week,
          index: edit.index,
          text: edit.text,
          ...(edit.sourceFamilyAssetIds
            ? { sourceFamilyAssetIds: edit.sourceFamilyAssetIds }
            : {}),
        }
      : null;
  }
  return edit.index !== undefined && !edit.sourceFamilyAssetIds?.length
    ? { action: "remove", week: edit.week, index: edit.index }
    : null;
}

export default defineBoundedTool({
  description:
    "Edit the activities on an existing plan (a subject's four weeks, or the month plan with subjectId \"month\"): add an activity to a week, replace one, or remove one. Changes land immediately on the family's planner and plan pages. Call open_planner first and copy its planRevision; activities are addressed by the indices it returned, and a changed revision is a conflict that must reopen the planner. Removing or replacing an activity also clears or shifts its check-offs honestly. This tool cannot create a new month from nothing: when no plan exists, the parent builds one with one tap in the child's progress report.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      childId: z.string().uuid(),
      subjectId: subjectIdSchema.describe(
        'The plan to edit, from open_planner: a subject id, or "month" for the month plan.',
      ),
      planRevision: z
        .number()
        .int()
        .min(1)
        .describe("The positive plan revision returned by open_planner for this edit."),
      edits: z.array(editSchema).min(1).max(10),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { error: "no_family", note: error.message };
      }
      throw error;
    }

    const edits: PlanEdit[] = [];
    for (const rawEdit of input.edits) {
      const edit = toPlanEdit(rawEdit);
      if (!edit) {
        return {
          error: "invalid_edit",
          note: "add needs text; replace needs index and text; remove needs index. Fix the batch and try again.",
        };
      }
      edits.push(edit);
    }

    const requestedSourceIds = [
      ...new Set(
        edits.flatMap((edit) =>
          edit.action === "remove" ? [] : edit.sourceFamilyAssetIds ?? [],
        ),
      ),
    ];
    if (
      (await familyAssetIdsIncludeCurriculumUnits(familyId, requestedSourceIds)) &&
      !(await familyHasPlusCapability(familyId))
    ) {
      return { error: "requires_plus", note: PLUS_CURRICULUM_NOTE };
    }

    const outcome = await editPlanActivities(
      familyId,
      input.childId,
      input.subjectId,
      edits,
      undefined,
      input.planRevision,
    );
    if (outcome.status === "unknown_child") {
      return { error: "unknown_child", note: WRONG_CHILD_NOTE };
    }
    if (outcome.status === "no_plan") {
      const board = await getPlanBoard(familyId, input.childId);
      const subjects = board?.plans.map((plan) => plan.subjectId) ?? [];
      return {
        error: "no_plan",
        note:
          subjects.length > 0
            ? `This child has no "${input.subjectId}" plan. Their plans: ${subjects.join(", ")}.`
            : "This child has no plans yet. A month is built with one tap in their progress report; offer that door.",
      };
    }
    if (outcome.status === "stale") {
      return { error: "stale_plan", note: outcome.note };
    }
    if (outcome.status === "invalid_edit") {
      return { error: "invalid_edit", note: outcome.note };
    }

    await emitMapEvent("map.plan_edited", {
      family_id: familyId,
      child_id: input.childId,
      subject: input.subjectId,
      added: outcome.added,
      replaced: outcome.replaced,
      removed: outcome.removed,
    });

    const usedAssetIds = [
      ...new Set(
        edits.flatMap((edit) =>
          edit.action === "remove" ? [] : edit.sourceFamilyAssetIds ?? [],
        ),
      ),
    ];
    for (const assetId of usedAssetIds) {
      try {
        await emitFamilyAssetUsed({
          familyId,
          assetId,
          useKind: "planner",
        });
      } catch (error) {
        console.error(
          "family Library planner-use event failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    const touchedWeeks = [...new Set(edits.map((edit) => edit.week))].sort();
    return {
      updated: true,
      childId: input.childId,
      subjectId: input.subjectId,
      summary: outcome.summary,
      /** The touched weeks as they now stand, indices included, so the
       * next edit in this conversation never works from stale numbers. */
      weeks: outcome.plan.weeks
        .filter((week) => touchedWeeks.includes(week.week))
        .map((week) => ({
          week: week.week,
          focus: week.focus,
          activities: week.activities.map((text, index) => ({
            index,
            text,
            sources: outcome.sourceLinks
              .filter(
                (link) =>
                  link.week === week.week && link.activityIndex === index,
              )
              .map((link) => ({
                ...familyAssetReferencesForSurface(
                  [{ id: link.assetId, title: link.sourceTitle }],
                  { siteRoot: siteUrl() },
                )[0],
                sourceLocator: link.sourceLocator,
              })),
          })),
        })),
    };
  },
});
