import { MAP_SUBJECTS } from "@homa/core";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { patchFamilyAsset } from "../../lib/library/family-asset-store";
import { FAMILY_ASSET_RESOURCE_KINDS } from "../../lib/library/family-assets";

const SUBJECT_IDS = new Set(MAP_SUBJECTS.map((subject) => subject.id));

export default defineBoundedTool({
  description:
    "Update the title, resource type, child assignments, or canonical subjects on one resource in this family's Library. Use an id from find_family_assets or get_family_asset. Only supplied fields change, and every child and subject is verified before the update.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      assetId: z.string().uuid().describe("The exact Family Library asset id."),
      title: z
        .string()
        .trim()
        .min(1)
        .max(180)
        .optional()
        .describe("A corrected display title supplied or confirmed by the parent."),
      resourceKind: z
        .enum(FAMILY_ASSET_RESOURCE_KINDS)
        .nullable()
        .optional()
        .describe("A corrected resource type, or null when it is intentionally unset."),
      childIds: z
        .array(z.string().uuid())
        .max(50)
        .optional()
        .describe("The complete replacement child list. Empty means whole family."),
      subjectIds: z
        .array(
          z.string().refine((value) => SUBJECT_IDS.has(value), "Unknown subject"),
        )
        .max(MAP_SUBJECTS.length)
        .optional()
        .describe("The complete replacement canonical subject list."),
    })
    .refine(
      (input) =>
        input.title !== undefined ||
        input.resourceKind !== undefined ||
        input.childIds !== undefined ||
        input.subjectIds !== undefined,
      "Supply at least one Library field to change.",
    ),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { updated: false, note: error.message };
      }
      throw error;
    }
    const result = await patchFamilyAsset({
      familyId: access.familyId,
      patch: {
        id: input.assetId,
        title: input.title,
        resourceKind: input.resourceKind,
        childIds: input.childIds ? [...new Set(input.childIds)] : undefined,
        subjectIds: input.subjectIds ? [...new Set(input.subjectIds)] : undefined,
      },
    });
    if (!result.ok) {
      const note =
        result.reason === "not-found"
          ? "That resource is not in this family's active Library."
          : result.reason === "unknown-child"
            ? "At least one child is not in this family, so nothing changed."
            : "At least one subject is not in Homa's subject catalog, so nothing changed.";
      return { updated: false, reason: result.reason, note };
    }
    return {
      updated: true,
      asset: result.asset,
      note: "Library details updated. Confirm the specific change in one short sentence.",
    };
  },
});
