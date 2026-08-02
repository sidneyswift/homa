import { MAP_SUBJECTS } from "@homa/core";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { findFamilyAssets } from "../../lib/library/family-asset-retrieval";
import {
  FAMILY_ASSET_RESOURCE_KINDS,
  FAMILY_ASSET_STATUSES,
} from "../../lib/library/family-assets";
import { emitMapEvent } from "../../lib/map/events";

const SUBJECT_IDS = new Set(MAP_SUBJECTS.map((subject) => subject.id));

export default defineBoundedTool({
  description:
    "After loading family-librarian, search or list resources this family saved in Family Library. Combines meaning-based retrieval with exact filters for resource type, child, subject, and processing status. Use when a parent asks what they own, names an uploaded curriculum or worksheet, or asks Homa to use one of their sources. Search returns candidates only; call get_family_asset on the chosen id before using or citing it.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .optional()
      .describe("Meaning or words to find. Leave off to list recent matches by filters."),
    resourceKinds: z
      .array(z.enum(FAMILY_ASSET_RESOURCE_KINDS))
      .max(FAMILY_ASSET_RESOURCE_KINDS.length)
      .optional()
      .describe("Optional exact resource types such as curriculum or worksheet."),
    childId: z
      .string()
      .uuid()
      .optional()
      .describe("Only resources assigned to this child. The id is re-scoped to the family."),
    subjectIds: z
      .array(
        z.string().refine((value) => SUBJECT_IDS.has(value), "Unknown subject"),
      )
      .max(MAP_SUBJECTS.length)
      .optional()
      .describe("Optional canonical Homa subject ids."),
    statuses: z
      .array(z.enum(FAMILY_ASSET_STATUSES))
      .max(FAMILY_ASSET_STATUSES.length)
      .optional()
      .describe("Optional exact processing states. Leave off to include every saved original."),
    limit: z.number().int().min(1).max(10).optional().describe("Defaults to 6."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { found: 0, assets: [], note: error.message };
      }
      throw error;
    }

    const assets = await findFamilyAssets({
      familyId: access.familyId,
      usageAttribution: {
        sessionId: ctx.session.id,
        turnId: ctx.session.turn.id,
      },
      query: input.query,
      resourceKinds: input.resourceKinds,
      childId: input.childId,
      subjectIds: input.subjectIds,
      statuses: input.statuses,
      limit: input.limit,
    });
    const compact = assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      originalName: asset.originalName,
      resourceKind: asset.resourceKind,
      status: asset.status,
      children: asset.children,
      evidence: asset.evidence,
      matchReason: asset.matchReason,
      updatedAt: asset.updatedAt,
    }));
    try {
      await emitMapEvent("library.searched", {
        family_id: access.familyId,
        query_length: Math.min(
          180,
          input.query?.normalize("NFKC").trim().length ?? 0,
        ),
        active_filters: [
          input.resourceKinds?.length,
          input.childId,
          input.subjectIds?.length,
          input.statuses?.length,
        ].filter(Boolean).length,
        result_count: compact.length,
      });
    } catch (error) {
      console.error(
        "family Library search event failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return {
      found: compact.length,
      assets: compact,
      note:
        compact.length > 0
          ? "These are candidates from this family only. Choose the best match, then call get_family_asset before using it or presenting a source citation."
          : "Nothing in this family's Library matched. Try one meaningfully different query once, then ask the parent instead of inventing or substituting a public source.",
    };
  },
});
