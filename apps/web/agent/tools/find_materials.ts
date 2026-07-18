import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { MATERIAL_KINDS } from "../../lib/materials/artifact-store";
import {
  findMaterialsCaller,
  findMaterialsPinned,
  getMaterialCaller,
  getMaterialPinned,
} from "../../lib/materials/library";

export function subjectLessonMaterialFinalOnly(
  attributes: unknown,
): boolean {
  const channel = (
    attributes as { channel?: unknown } | null | undefined
  )?.channel;
  return channel === "subject_lesson";
}

/**
 * The library's read path (MS-4): before designing anything, look for a
 * final that already fits. A found final's previewUrl works as a
 * generate_image reference (style continuity, "same page for the other
 * kid with her character"), and fetching one material by id returns its
 * stored html for direct reuse with the theme swapped.
 */
export default defineTool({
  description:
    "Search this family's saved materials (worksheets, coloring pages, flash cards...) before designing something new. Returns finals by default with their preview URLs; a final's previewUrl can be passed to generate_image as a reference image, and fetching one material by id also returns its html for reuse with a swapped theme or character.",
  inputSchema: z.object({
    materialId: z
      .uuid()
      .optional()
      .describe("Fetch exactly this material WITH its html (the reuse path). All other filters are ignored."),
    childId: z.uuid().optional().describe("Only materials made for this child."),
    kind: z.enum(MATERIAL_KINDS).optional(),
    subject: z.string().trim().max(80).optional().describe("Substring match, e.g. 'handwriting'."),
    theme: z.string().trim().max(120).optional().describe("Substring match, e.g. 'Paw Patrol'."),
    character: z.string().trim().max(60).optional().describe("A character name to match."),
    status: z
      .enum(["final", "draft", "any"])
      .optional()
      .describe("Defaults to final (the approved keepers)."),
    limit: z.number().int().min(1).max(12).optional().describe("Defaults to 6."),
  }),
  async execute(input, ctx) {
    const finalOnly = subjectLessonMaterialFinalOnly(
      ctx.session.auth.current?.attributes,
    );

    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { materials: [], note: error.message };
      }
      throw error;
    }

    if (input.materialId) {
      const material =
        access.mode === "pinned"
          ? await getMaterialPinned(
              access.familyId,
              input.materialId,
              { finalOnly },
            )
          : await getMaterialCaller(access.db, access.familyId, input.materialId);
      if (!material || (finalOnly && material.status !== "final")) {
        return {
          materials: [],
          note: "No material with that id in this family.",
        };
      }
      return {
        materials: [material],
        note: "Reuse the html with the theme or character swapped, or pass previewUrl to generate_image as a reference.",
      };
    }

    const filters = {
      childId: input.childId,
      kind: input.kind,
      subject: input.subject,
      theme: input.theme,
      character: input.character,
      status: finalOnly
        ? ("final" as const)
        : input.status ?? ("final" as const),
      limit: input.limit ?? 6,
    };
    const materials =
      access.mode === "pinned"
        ? await findMaterialsPinned(access.familyId, filters)
        : await findMaterialsCaller(access.db, access.familyId, filters);

    return {
      materials,
      note:
        materials.length > 0
          ? "To show one of these to the parent again, call show_material with its id. A previewUrl here works as a generate_image reference; fetch one by materialId to get its html for reuse."
          : "Nothing saved matches. Design fresh, and finals you make will be here next time.",
    };
  },
});
