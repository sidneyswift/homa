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
import { readFamilyCurriculumSource } from "../../lib/library/family-curriculum-source";

/** Authenticated source reading for the Plus decomposition workflow. */
export default defineBoundedTool({
  description:
    "Read the next bounded set of exact pages or sections from one ready Family Library curriculum. Use only after get_family_asset identifies the exact curriculum and after loading curriculum-mapping. This is Homa Plus work. It never changes Library or Planner. Continue with nextCursor until null before claiming a full decomposition.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z
    .object({
      assetId: z
        .string()
        .uuid()
        .describe("The exact ready curriculum id returned by get_family_asset."),
      cursor: z
        .number()
        .int()
        .min(1)
        .max(5_000)
        .default(1)
        .describe("The next page or section ordinal. Start with 1."),
    })
    .strict(),
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(ctx.session.auth.current?.attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { read: false, error: "no_family", note: error.message };
      }
      throw error;
    }
    if (!(await familyHasPlusCapability(familyId))) {
      return {
        read: false,
        error: "requires_plus",
        note: PLUS_CURRICULUM_NOTE,
      };
    }
    const result = await readFamilyCurriculumSource({
      familyId,
      assetId: input.assetId,
      cursor: input.cursor,
    });
    if (!result.ok) {
      return {
        read: false,
        error: result.reason,
        note:
          result.reason === "not-ready"
            ? "The original stays in Library. Homa can build units from it when its Library status is Ready."
            : "Homa could not read that curriculum. Open it in Library and check its status before trying again.",
      };
    }
    return {
      read: true,
      assetId: result.asset.id,
      title: result.asset.title,
      segmentKind: result.document.segmentKind,
      totalSegments: result.document.totalSegments,
      sourceTruncated: result.document.truncated || result.page.truncated,
      segments: result.page.segments,
      nextCursor: result.page.nextCursor,
      note:
        result.page.nextCursor === null
          ? "You reached the end of the readable source. Build the complete preview now, or mark it partial if sourceTruncated is true."
          : `Continue with cursor ${result.page.nextCursor}. Do not claim a full decomposition yet.`,
    };
  },
});
