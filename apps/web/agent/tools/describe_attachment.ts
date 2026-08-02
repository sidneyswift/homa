import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { describeAttachment } from "../../lib/attachments/describe";
import { isFamilyArtifactUrl } from "../../lib/materials/artifact-store";
import { mapDb } from "../../lib/map/db";

/**
 * Looking again at something she already sent (gh#351).
 *
 * find_attachments returns a one-sentence caption, written once, for
 * search. That is the model's only view of a photo, and it is not a
 * reading. On 2026-07-25 a parent's dictated list of page edits was cut
 * off mid-word, so she sent a screen recording of her own message and
 * then a screenshot of it; both were captioned as "a screen recording
 * of a chat interface", neither was read, and Homa asked her to retype
 * the whole list. On 2026-07-28 she sent a reference layout and Homa
 * could not open it again a few turns later.
 *
 * Tool results are text, so the model can never re-see pixels itself.
 * It sends a question and gets words back.
 *
 * Tenancy: the URL is re-checked against this family's own storage
 * prefix AND against a row in chat_attachments, so a model-supplied URL
 * can only ever name something this family already sent.
 */
export default defineBoundedTool({
  description:
    "Look again at an image this family already sent, and answer one question about it. Use when you need what a picture SAYS (a screenshot of her own message, a worksheet she photographed, a book cover) or a closer look at one you only have a one-line caption for. Ask what something says to get its text back word for word. Get the url from find_attachments.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    url: z
      .string()
      .describe("The attachment's url, exactly as find_attachments returned it."),
    question: z
      .string()
      .min(3)
      .max(300)
      .describe(
        "What you need to know. 'What does this say, word for word?' transcribes the text; anything else gets a plain description.",
      ),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { read: false, note: error.message };
      }
      throw error;
    }

    if (!isFamilyArtifactUrl(input.url, access.familyId)) {
      return {
        read: false,
        note: "That url is not one of this family's files. Use a url from find_attachments.",
      };
    }

    const rows = await mapDb()<{
      id: string;
      media_type: string;
      kind: string;
    }[]>`
      select id, media_type, kind from public.chat_attachments
      where family_id = ${access.familyId} and url = ${input.url}
      limit 1
    `;
    const row = rows[0];
    if (row === undefined) {
      return {
        read: false,
        note: "No attachment of this family's has that url. Use a url from find_attachments.",
      };
    }
    if (!row.media_type.startsWith("image/")) {
      return {
        read: false,
        note: `This one is ${row.kind}, not an image, so there is nothing to look at. Only images can be read this way.`,
      };
    }

    const result = await describeAttachment({
      url: input.url,
      mediaType: row.media_type,
      question: input.question,
      familyId: access.familyId,
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      attachmentId: row.id,
    });

    if (result.text === null) {
      return {
        read: false,
        note:
          result.reason === "timeout"
            ? "Looking at it took too long. Say plainly that you could not read it this time, and ask her to tell you what it says rather than pretending to know."
            : "Could not read it. Say so plainly and ask her rather than guessing what it shows.",
      };
    }

    return {
      read: true,
      answer: result.text,
      note: "This is what the picture actually shows. Use it; do not ask her to retype something you can now read.",
    };
  },
});
