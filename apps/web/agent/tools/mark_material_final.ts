import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  finalizeMaterialCaller,
  finalizeMaterialPinned,
} from "../../lib/materials/library";
import { usageChannelFromAttributes } from "../../lib/model-usage";

/**
 * The keeper moment (MS-3): when the parent approves a material ("great,
 * print two copies", "he loves it"), the approved version becomes the
 * family's final. Its revision chain is superseded, draft bytes are
 * tidied away, and the final joins the library find_materials searches
 * and future creations reference. Never call it on your own judgment;
 * approval is hers.
 */
export function subjectLessonMaterialFinalizationRestriction(
  attributes: unknown,
): string | null {
  const channel = (attributes as { channel?: unknown } | null | undefined)
    ?.channel;
  return channel === "subject_lesson"
    ? "Automatic lesson builds cannot approve materials. The worksheet stays draft until parent approval."
    : null;
}

export default defineBoundedTool({
  description:
    "Mark a material as the approved final version after the parent clearly approves it ('great', 'print it', 'she loves it'). Earlier drafts in its revision chain are superseded and cleaned up; the final becomes reusable as a reference for future materials. Use the id from the create_printable result.",
  deadlineMs: TOOL_DEADLINE.quick,
  // Repeatable: finalization is idempotent by construction. The plan
  // reports `transitioned: false` for a material that is already final,
  // supersedes nothing twice, and deletes no bytes on the replay. Marked
  // false until 2026-07-28, which meant a deadline overrun told the model
  // not to retry, and a parent's four approved worksheets stayed draft
  // with Homa unable to say whether the save had landed (gh#346).
  repeatable: true,
  inputSchema: z.object({
    materialId: z.uuid().describe("The approved version's id from the create_printable result."),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const restriction = subjectLessonMaterialFinalizationRestriction(
      attributes,
    );
    const channel = usageChannelFromAttributes(attributes);
    if (restriction || channel === "subject_lesson") {
      return {
        finalized: false,
        note:
          restriction
          ?? "Automatic lesson builds cannot approve materials. The worksheet stays draft until parent approval.",
      };
    }

    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { finalized: false, note: error.message };
      }
      throw error;
    }

    const result =
      access.mode === "pinned"
        ? await finalizeMaterialPinned(access.familyId, input.materialId)
        : await finalizeMaterialCaller(access.db, access.familyId, input.materialId);
    if (!result.finalized) return result;

    if (result.transitioned) {
      await emitMapEvent("materials.finalized", {
        family_id: access.familyId,
        channel,
        versions_superseded: result.versionsSuperseded,
      });
    }

    return {
      ...result,
      materialId: input.materialId,
      done: true,
      note: result.transitioned
        ? "Kept as the final version; earlier drafts tidied away. Mention it in one short natural aside at most."
        : "That version was already kept. Mention it in one short natural aside at most.",
    };
  },
});
