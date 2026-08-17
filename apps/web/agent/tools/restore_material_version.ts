import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { familyAssetReferencesForSurface } from "../../lib/library/family-asset-reference";
import { siteUrl } from "../../lib/map/email";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import {
  restoreMaterialVersionCaller,
  restoreMaterialVersionPinned,
} from "../../lib/materials/restore-version";

export const restoreMaterialVersionInputSchema = z.object({
  materialId: z
    .uuid()
    .describe("The current material id from the visible material context or find_materials."),
  versionOrdinal: z
    .int()
    .min(1)
    .max(3000)
    .optional()
    .describe("The number shown under the earlier version in the Binder. Omit for the version immediately before the current one."),
});

export default defineBoundedTool({
  description:
    "Restore an earlier version of a material after the parent clearly asks to go back. Omit versionOrdinal for 'use the previous version', or pass the number she names from the Binder's Earlier tries rail. This creates a new final copy, rebuilds its printable file, and leaves every existing version untouched. Never use it for an edit or on your own judgment.",
  deadlineMs: TOOL_DEADLINE.render,
  repeatable: false,
  inputSchema: restoreMaterialVersionInputSchema,
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const channel = usageChannelFromAttributes(attributes);
    if (channel === "subject_lesson") {
      return {
        restored: false,
        note: "Automatic lesson builds cannot restore a parent material version.",
      };
    }
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { restored: false, note: error.message };
      }
      throw error;
    }

    const result = access.mode === "pinned"
      ? await restoreMaterialVersionPinned({
          familyId: access.familyId,
          materialId: input.materialId,
          versionOrdinal: input.versionOrdinal,
          channel,
        })
      : await restoreMaterialVersionCaller({
          db: access.db,
          familyId: access.familyId,
          materialId: input.materialId,
          versionOrdinal: input.versionOrdinal,
        });
    if (!result.restored) return result;
    return {
      ...result,
      done: true,
      material: {
        ...result.material,
        sources: familyAssetReferencesForSurface([], { siteRoot: siteUrl() }),
        status: "final" as const,
      },
      note: "The earlier version is back as the newest copy. Its preview and print button are in this reply. Tell her plainly that the older history is still there.",
    };
  },
});
