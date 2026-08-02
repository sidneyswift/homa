import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitFamilyAssetUsed } from "../../lib/library/family-asset-events";
import { getFamilyAssetSource } from "../../lib/library/family-asset-retrieval";

export default defineBoundedTool({
  description:
    "Get one exact Family Library resource with its original URL, authenticated citation link, children, and bounded evidence with recorded provenance. Use only with an id from find_family_assets or a trusted current tool result. Calling this marks the chosen source as retrieved by Homa.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    assetId: z
      .string()
      .uuid()
      .describe("The exact Family Library asset id returned by find_family_assets."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { found: false, note: error.message };
      }
      throw error;
    }
    const asset = await getFamilyAssetSource(access.familyId, input.assetId);
    if (!asset) {
      return {
        found: false,
        note: "No active Family Library resource with that id belongs to this family.",
      };
    }
    let useRecorded = false;
    try {
      useRecorded = await emitFamilyAssetUsed({
        familyId: access.familyId,
        assetId: asset.id,
        useKind: "retrieval",
      });
    } catch (error) {
      console.error(
        "family Library retrieval event failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return {
      found: true,
      asset,
      useRecorded,
      note:
        "Use only what this record and its quoted evidence support. Cite the title with citationUrl and include a source locator when one is present. The original URL is usable as a family reference, but it is public to anyone who has that hard-to-guess URL until private storage ships.",
    };
  },
});
