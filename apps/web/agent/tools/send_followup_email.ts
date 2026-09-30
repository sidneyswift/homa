import { BANNED_WORDS, EM_DASH } from "@homa/core";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  getFamilyEmail,
  sendAgentComposedEmail,
  sendAgentMaterialEmail,
} from "../../lib/map/email";
import { rateLimited } from "../../lib/map/ratelimit";
import { getMaterialCaller, getMaterialPinned } from "../../lib/materials/library";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_FAMILY_PER_DAY = 5;

/**
 * Sends a real email to this family's own registered address (build-log
 * 2026-07-08: "what tools can she trigger, can she send an email"). The
 * recipient is ALWAYS the caller's own family email, resolved server-
 * side under RLS, never an address the model supplies (BUILD.md law #1:
 * a model-controlled recipient would turn Homa's transactional domain
 * into a spam relay). Content still goes through the brand-law check
 * (no em dash, no banned words) before anything is actually sent.
 */
export default defineBoundedTool({
  description:
    "Send a real email to this family's own address on file. Use only when the parent asks for something in writing, or a written summary is clearly the useful next step (e.g., recapping today's conversation, a plan to remember). Do not overuse: this sends a real email every time. Compose a subject and a few short lines, then confirm success in one aside without repeating the contents. For a requested visible material, keep that exact version first and supply its server-verified materialId. This sends from Homa to the family address on file; native sharing uses the parent's chosen app and account.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({
    subject: z.string().trim().min(1).max(120),
    bodyLines: z
      .array(z.string().trim().min(1).max(600))
      .min(1)
      .max(6)
      .describe("A few short paragraphs, in your own warm voice."),
    materialId: z
      .uuid()
      .optional()
      .describe("The exact server-verified visible final material id when the parent explicitly asks Homa to email that artifact."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { sent: false, note: error.message };
      }
      throw error;
    }
    const { familyId } = access;

    if (rateLimited(`agent-email:${familyId}`, MAX_PER_FAMILY_PER_DAY, DAY_MS)) {
      return {
        sent: false,
        note: "Too many emails already sent to this family today. Tell the parent you'll follow up another way instead.",
      };
    }

    const allText = [input.subject, ...input.bodyLines].join(" ");
    if (EM_DASH.test(allText) || BANNED_WORDS.test(allText)) {
      return {
        sent: false,
        note: "That text used an em dash or a banned word (behind, diagnosis-type language). Rewrite without it and call this tool again.",
      };
    }

    let email: string | null = null;
    if (access.mode === "pinned") {
      email = await getFamilyEmail(familyId);
    } else {
      const { data: family, error } = await access.db
        .from("families")
        .select("email")
        .eq("id", familyId)
        .maybeSingle();
      if (error) {
        return { sent: false, note: "No email is on file for this family yet." };
      }
      email = family?.email ?? null;
    }
    if (!email) {
      return { sent: false, note: "No email is on file for this family yet." };
    }

    const material = input.materialId
      ? access.mode === "pinned"
        ? await getMaterialPinned(familyId, input.materialId, { finalOnly: true })
        : await getMaterialCaller(access.db, familyId, input.materialId)
      : null;
    if (input.materialId && (!material || material.status !== "final")) {
      return {
        sent: false,
        note: "That version is not ready to email. Open the copy you want and tap Keep. Then ask Homa to email it again.",
      };
    }
    const sent = material
      ? await sendAgentMaterialEmail(email, input.subject, input.bodyLines, material, familyId)
      : await sendAgentComposedEmail(email, input.subject, input.bodyLines, undefined, familyId);
    if (!sent) {
      return { sent: false, note: "The email failed to send. Tell the parent you'll try again shortly." };
    }

    const channel = (ctx.session.auth.current?.attributes as { channel?: string } | undefined)
      ?.channel;
    await emitMapEvent("chat.email_sent", {
      family_id: familyId,
      channel: channel === "sms" ? "sms" : "web",
    });

    return {
      sent: true,
      done: true,
      note: "Sent. Mention it to the parent in one short natural aside, do not repeat the email's contents back to her.",
    };
  },
});
