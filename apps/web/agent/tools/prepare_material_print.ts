import { z } from "zod";
import { printPageSummary } from "@homa/core";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { siteUrl } from "../../lib/map/email";
import { printSigninUrl } from "../../lib/materials/print-handoff-link";
import {
  prepareMaterialPrintCaller,
  prepareMaterialPrintPinned,
} from "../../lib/materials/print";
import { usageChannelFromAttributes } from "../../lib/model-usage";

/**
 * Exact server preparation for printing. The materials skill decides what the
 * parent meant. This tool re-scopes the id, verifies the current revision,
 * finalizes a visible draft, selects labelled pages, and returns a bounded
 * request that web and native controls can recheck before opening print options.
 */
export default defineBoundedTool({
  description:
    "Prepare the current visible material for printing, following the loaded materials-studio skill. That skill owns approval, revision-before-print and channel handoff choices. Re-verifies the family and revision, finalizes an approved draft, and returns exact pages and requested copies. Use the server-verified visible material id. The result prepares pages and a requested copy count. It does not open a sheet or send a print job.",
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

    const printUrl = channel === "sms" ? printSigninUrl(siteUrl(), result.printRequest) : null;
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
      ...(printUrl ? { printUrl, printSummary: printPageSummary(result.printRequest) } : {}),
      note: channel === "sms"
        ? printUrl
          ? "Include the returned printUrl and printSummary in your text reply. This link opens sign-in if needed, then opens only the verified selected PDF pages. She uses the PDF print button and confirms copies in the system dialog. No text print control exists, no link was sent by this tool, and no print job was sent. Never substitute the original full PDF for this selection."
          : "The pages were prepared, but a verified sign-in link could not be created. Explain that the print handoff could not be completed. Do not claim a text print control or send the original full PDF instead."
        :
        "The PDF, selected pages, and requested copies are prepared. This result does not open a print sheet or send a print job. The print control handles the next step. Copies must be confirmed in the system print dialog. Never claim physical printing.",
    };
  },
});
