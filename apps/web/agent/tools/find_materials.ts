import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { MATERIAL_KINDS } from "../../lib/materials/artifact-store";
import {
  findMaterialsCaller,
  findMaterialsPinned,
  getMaterialCaller,
  getMaterialPinned,
} from "../../lib/materials/library";
import {
  selectMaterialPages,
  splitPageBodies,
} from "../../lib/materials/page-shell";

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
export default defineBoundedTool({
  description:
    "Load materials-studio before finding or reopening generated Binder work with this tool, including a named worksheet or packet. Also search before designing something new. Returns finals by default with their preview URLs; a final's previewUrl can be passed to generate_image as a reference image, and fetching one material by id also returns its html for reuse with a swapped theme or character.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    materialId: z
      .uuid()
      .optional()
      .describe("Fetch exactly this material WITH its html (the reuse path). All other filters are ignored."),
    pageIndex: z
      .int()
      .min(1)
      .optional()
      .describe("With materialId on a multi-page packet, return only THIS page's html (1 is the first page) instead of all of them. Use it when you are revising one page: you need that page's html to rewrite it, and the others come back by reference through create_printable's fromMaterialId + pageIndex."),
    title: z.string().trim().min(1).max(240).optional().describe("Case-insensitive literal title substring, such as Letter Sounds Workbook. Punctuation is literal, not a wildcard."),
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
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
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
      // A multi-page packet's html is the whole document, and on a real
      // twelve-page packet that is about 45KB. Handing all of it back so
      // the model can rewrite one page is what pushed a live session to
      // 276k input tokens on 2026-07-27, and re-emitting it is what
      // stopped producing a parseable tool call
      // (plans/2026-07-27-packet-page-revision-failure.md). So: one page
      // when asked for one, and when not asked, say plainly that asking
      // is cheaper.
      const pages = splitPageBodies(material.html ?? "");
      if (pages.length > 1 && input.pageIndex !== undefined) {
        const selected = selectMaterialPages(material.html ?? "", input.pageIndex);
        if (!selected.ok) {
          return {
            materials: [],
            note: `"${material.title}" has ${selected.pageCount} pages, so there is no page ${input.pageIndex}. Pages count from 1.`,
          };
        }
        return {
          materials: [{ ...material, html: selected.bodies[0] }],
          note: `Page ${input.pageIndex} of ${pages.length} of "${material.title}". Rewrite this page only; carry the other ${pages.length - 1} into create_printable as fromMaterialId ${material.id} entries with their own pageIndex, so you never retype them.`,
        };
      }
      return {
        materials: [material],
        note:
          pages.length > 1
            ? `This is all ${pages.length} pages of "${material.title}". Revising ONE page? Ask again with pageIndex for just that page and pass the rest to create_printable by reference (fromMaterialId + pageIndex); retyping a packet this size is slow enough to fail. Otherwise reuse the html with the theme or character swapped.`
            : "Reuse the html with the theme or character swapped, or pass previewUrl to generate_image as a reference.",
      };
    }

    const filters = {
      title: input.title,
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

    // Per-page preview URLs stay out of search results (six long URLs
    // per packet would drown the useful fields); pageCount stays in so
    // a packet is recognizable at a glance.
    const compact = materials.map((material) => {
      const { pagePreviewUrls, ...rest } = material;
      void pagePreviewUrls;
      return rest;
    });

    // A library whose earlier work never reached 'final' is invisible to
    // this search, because status defaults to final. Saying "nothing saved
    // matches" then is a lie that costs real work: it sends the agent
    // hunting through filter permutations for pages it already made, and
    // invites it to rebuild them. The Swift family's alphabet task
    // (2026-07-19) burned ten find_materials calls that way, three of which
    // hung, because every one of Story's existing letter pages was still a
    // draft. Only look when the caller could actually act on the answer.
    let emptyNote =
      "No saved materials match these filters. Follow the materials-studio lookup workflow before deciding what to do next.";
    if (materials.length === 0 && !finalOnly && filters.status === "final") {
      const anyStatus = { ...filters, status: "any" as const };
      const unfinalized =
        access.mode === "pinned"
          ? await findMaterialsPinned(access.familyId, anyStatus)
          : await findMaterialsCaller(access.db, access.familyId, anyStatus);
      if (unfinalized.length > 0) {
        emptyNote =
          `No finals match, but ${unfinalized.length} unfinalized ` +
          `${unfinalized.length === 1 ? "draft matches" : "drafts match"}. ` +
          `Pass status:"any" to see them before you build anything, so you ` +
          `continue that work instead of repeating it.`;
      }
    }

    return {
      materials: compact,
      note:
        materials.length > 0
          ? "To show one of these to the parent again, call show_material with its id. A previewUrl here works as a generate_image reference; fetch one by materialId to get its html for reuse, or pass its id in create_printable's pages (fromMaterialId) to compile a packet."
          : emptyNote,
    };
  },
});
