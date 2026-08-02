import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { deleteFamilyAsset } from "../../lib/library/family-asset-store";

export default defineBoundedTool({
  description:
    "Permanently remove one original and its details from this family's Library. Use only after the parent clearly confirms the exact resource in this conversation. Anything Homa already created in Binder stays there.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({
    assetId: z
      .string()
      .uuid()
      .describe("The exact Family Library asset id the parent confirmed deleting."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { deleted: false, note: error.message };
      }
      throw error;
    }
    const result = await deleteFamilyAsset({
      familyId: access.familyId,
      assetId: input.assetId,
    });
    if (!result.ok) {
      return {
        deleted: false,
        reason: result.reason,
        note:
          result.reason === "not-found"
            ? "That resource is not in this family's active Library."
            : "The original could not be removed yet. Do not claim it was deleted; it remains visible with a retryable attention state.",
      };
    }
    return {
      deleted: true,
      note:
        "The Library original and its details were deleted. Anything already in Binder remains there.",
    };
  },
});
