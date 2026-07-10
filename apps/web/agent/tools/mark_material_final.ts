import { defineTool } from "eve/tools";
import { z } from "zod";

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
export default defineTool({
  description:
    "Mark a material as the approved final version after the parent clearly approves it ('great', 'print it', 'she loves it'). Earlier drafts in its revision chain are superseded and cleaned up; the final becomes reusable as a reference for future materials. Use the id from the create_printable result.",
  inputSchema: z.object({
    materialId: z.uuid().describe("The approved version's id from the create_printable result."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
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

    await emitMapEvent("materials.finalized", {
      family_id: access.familyId,
      channel: usageChannelFromAttributes(ctx.session.auth.current?.attributes),
      versions_superseded: result.versionsSuperseded ?? 0,
    });

    return {
      ...result,
      done: true,
      note: "Kept as the final version; earlier drafts tidied away. Mention it in one short natural aside at most.",
    };
  },
});
