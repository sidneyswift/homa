import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { promoteFamilyAttachment } from "../../lib/library/family-asset-promotion";

const FAILURE_NOTES = {
  "not-found": "That attachment is not in this family. Use find_attachments and choose its id.",
  "bad-source": "That attachment is not inside this family's chat files, so it was not saved.",
  "blob-not-found": "The attachment record exists, but its original file is no longer available.",
  "too-large": "That attachment is outside the Library size boundary, so it was not saved.",
  "copy-failed": "The original could not be copied into Library this time.",
  "save-failed": "The original may have copied, but Homa could not confirm a Library record. Do not claim it was saved.",
} as const;

export default defineBoundedTool({
  description:
    "Save one file this family already shared in chat into Family Library. Use find_attachments first and pass its attachment id. The tool copies the original into Library, keeps source provenance, and returns the only truth about whether it was saved. Not for arbitrary URLs or Homa-created materials.",
  deadlineMs: TOOL_DEADLINE.generate,
  repeatable: false,
  inputSchema: z.object({
    attachmentId: z
      .string()
      .uuid()
      .describe("The exact attachment id returned by find_attachments."),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { saved: false, note: error.message };
      }
      throw error;
    }
    const memberUserId = (attributes as { memberUserId?: unknown } | undefined)
      ?.memberUserId;
    const result = await promoteFamilyAttachment({
      familyId: access.familyId,
      attachmentId: input.attachmentId,
      uploadedByUserId:
        typeof memberUserId === "string" ? memberUserId : null,
    });
    if (!result.ok) {
      return { saved: false, reason: result.reason, note: FAILURE_NOTES[result.reason] };
    }
    return {
      saved: true,
      alreadySaved: !result.created,
      asset: {
        id: result.asset.id,
        title: result.asset.title,
        resourceKind: result.asset.resourceKind,
        status: result.asset.status,
        processingNote: result.asset.processingNote,
      },
      note:
        result.asset.status === "ready"
          ? "Saved in Family Library. Confirm it in one short sentence."
          : "The original is saved in Family Library. Its details may still need attention, so say that plainly without treating the original as lost.",
    };
  },
});
