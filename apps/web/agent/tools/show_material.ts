import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  getMaterialCardCaller,
  getMaterialCardPinned,
} from "../../lib/materials/library";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import { sendHomaSms } from "../../lib/voice/telnyx-api";

/**
 * The re-surface path (Vega incident 2026-07-13: "can you send it
 * again" had no answer that put the page back in front of her, so the
 * conversation dead-ended into email). This tool shows an EXISTING
 * material where the parent is: on web the result renders the same
 * card create_printable renders; on SMS it re-texts the preview and
 * direct PDF link. No re-render, no new row; the review gate on SMS delivery is
 * the same one create_printable enforces.
 */
export default defineTool({
  description:
    "Show the parent an already-made material again, exactly as it is: the card reappears in this chat on web, or the preview picture and direct printable PDF link get re-texted on SMS. Use it when she asks to see, print, or re-send something that exists (\"can you send it again?\", \"I don't see it\", \"print that one from last week\"), with the id from find_materials or an earlier create result. Never rebuild a page just to show it again.",
  inputSchema: z.object({
    materialId: z
      .uuid()
      .describe("The material's id, from find_materials or an earlier create_printable result."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { shown: false, note: error.message };
      }
      throw error;
    }

    const material =
      access.mode === "pinned"
        ? await getMaterialCardPinned(access.familyId, input.materialId)
        : await getMaterialCardCaller(access.db, access.familyId, input.materialId);
    if (!material) {
      return {
        shown: false,
        note: "That material id is not in this family. Find the right one with find_materials first.",
      };
    }
    if (material.status === "superseded") {
      return {
        shown: false,
        note: `"${material.title}" was superseded when a later version was approved, and its files were tidied away. Show the final instead: find_materials returns it.`,
      };
    }

    const attributes = ctx.session.auth.current?.attributes as
      | { channel?: string; phoneNumber?: string }
      | undefined;
    const channel = usageChannelFromAttributes(attributes);

    // SMS delivery, behind the same review gate as create_printable: a
    // flagged page never lands on her phone. The number comes from
    // channel auth, never the model (anti-relay law).
    let sentByText = false;
    let previewSentByText = false;
    if (channel === "sms" && attributes?.phoneNumber) {
      if (!material.reviewPassed) {
        return {
          shown: false,
          note: "This version was flagged by the quality check, so it is not textable. Revise it with create_printable (revisesId set to this id); the passing version sends on its own.",
        };
      }
      const materialSmsIntro = `${material.title} is ready to print:`;
      previewSentByText = await sendHomaSms(
        attributes.phoneNumber,
        materialSmsIntro,
        [material.previewUrl, material.pdfUrl],
      );
      sentByText = previewSentByText;
      if (!sentByText) {
        sentByText = await sendHomaSms(
          attributes.phoneNumber,
          `${materialSmsIntro} ${material.pdfUrl}`,
        );
      }
    }

    const deliveryNote =
      channel === "sms"
        ? sentByText
          ? previewSentByText
            ? "The preview and printable link were submitted by text again. Follow with ONE short text naming the child and the skill."
            : "The printable link was submitted by text again. Follow with ONE short text naming the child and the skill."
          : "Text delivery failed. Tell her the page is ready in her Homa chat on the web, and offer to tweak anything."
        : "The card with the preview and print button is back in the chat, in this reply. Tell her in one warm sentence; never paste the links.";

    return {
      shown: true,
      done: true,
      material: {
        id: material.id,
        title: material.title,
        kind: material.kind,
        skill: material.skill,
        childName: material.childName,
        previewUrl: material.previewUrl,
        pdfUrl: material.pdfUrl,
        status: material.status,
      },
      sentByText,
      note: deliveryNote,
    };
  },
});
