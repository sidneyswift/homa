import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  prepareMaterialPrintCaller,
  prepareMaterialPrintPinned,
} from "../../lib/materials/print";
import { usageChannelFromAttributes } from "../../lib/model-usage";

/**
 * Exact server half of native printing. The materials skill decides what the
 * parent meant. This tool re-scopes the id, verifies the current revision,
 * finalizes a visible draft, selects labelled pages, and returns a bounded
 * request that only the native app can hand to UIKit.
 */
export default defineBoundedTool({
  description:
    "Prepare the current visible material for the native iOS print sheet after the parent asks to print it. Re-verifies the family and revision, finalizes an approved draft before printing, and returns exact pages and requested copies. Use the server-verified visible material id. The result means ready for the system sheet, never paper printed.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    materialId: z
      .uuid()
      .describe("The exact server-verified visible material id."),
    copies: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(1)
      .describe("The number of copies the parent requested, from 1 through 20."),
    includeAnswerKey: z
      .boolean()
      .default(true)
      .describe("False only when the parent explicitly asks to skip the answer key."),
  }),
  async execute(input, ctx) {
    const channel = usageChannelFromAttributes(ctx.session.auth.current?.attributes);
    if (channel === "subject_lesson") {
      return {
        ready: false,
        note: "Automatic lesson builds cannot approve or print materials. A parent must choose a material first.",
      };
    }
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { ready: false, note: error.message };
      }
      throw error;
    }
    const result = access.mode === "pinned"
      ? await prepareMaterialPrintPinned({
          familyId: access.familyId,
          materialId: input.materialId,
          copies: input.copies,
          includeAnswerKey: input.includeAnswerKey,
        })
      : await prepareMaterialPrintCaller({
          db: access.db,
          familyId: access.familyId,
          materialId: input.materialId,
          copies: input.copies,
          includeAnswerKey: input.includeAnswerKey,
        });
    if (!result.ready) return result;

    if (result.finalizedNow) {
      await emitMapEvent("materials.finalized", {
        family_id: access.familyId,
        channel,
        versions_superseded: result.versionsSuperseded,
      });
    }

    return {
      ready: true,
      done: true,
      material: {
        id: result.material.id,
        title: result.material.title,
        kind: result.material.kind,
        skill: result.material.skill,
        childName: null,
        previewUrl: result.material.previewUrl,
        pdfUrl: result.material.pdfUrl,
        pageCount: result.material.pageCount,
        ...(result.material.pagePreviewUrls
          ? { pagePreviewUrls: result.material.pagePreviewUrls }
          : {}),
        status: result.material.status,
        revisesId: result.activeMaterial.revisesId,
        ...(result.activeMaterial.pageRoles
          ? { pageRoles: result.activeMaterial.pageRoles }
          : {}),
      },
      printRequest: result.printRequest,
      note:
        "The final PDF and pages are ready. The app is opening Apple's print sheet now. Tell her to choose the printer and confirm copies there. Do not say printed until the native completion result arrives.",
    };
  },
});
