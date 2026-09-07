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

/** Authenticated bounded source reading, shared by lesson use and decomposition. */
export default defineBoundedTool({
  description:
    "Read the next bounded pages or sections from one ready Family Library curriculum, caching source transcription. Use after family-librarian and get_family_asset identify the exact curriculum. Read just the located pages for a lesson or requested packet; curriculum-mapping owns whole-source decomposition. This is Homa Plus work. It never creates Library units or changes Planner. Scanned pages have explicit method and coverage; at most one new page is transcribed per call. Use physical page ordinals, never assume a lesson or printed page number is the cursor. Honor gaps and coverage; a metadata sample is not a lesson read.",
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
        .describe("The physical PDF page or section ordinal, not a lesson number or printed page number. Start at 1 for contents, or jump to a location established by the source."),
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
            ? "The original stays in Library. Homa can read its lesson pages when its Library status is Ready."
            : "Homa could not read that curriculum. Open it in Library and check its status before trying again.",
      };
    }
    return {
      read: result.page.segments.some(segment => segment.text.length > 0 && segment.state !== "unreadable"),
      assetId: result.asset.id,
      title: result.asset.title,
      segmentKind: result.document.segmentKind,
      totalSegments: result.document.totalSegments,
      sourceTruncated: result.document.truncated || result.page.truncated,
      contentSha256: result.document.contentSha256,
      extractionVersion: result.document.extractionVersion,
      segments: result.page.segments,
      nextCursor: result.page.nextCursor,
      note:
        result.document.coverageNote ?? (result.page.nextCursor === null
          ? "You reached the end of this readable source. Use only the returned evidence and honor any partial coverage."
          : `Continue with cursor ${result.page.nextCursor}. Read further only if needed for the requested scope; this does not establish full-book coverage.`),
    };
  },
});
