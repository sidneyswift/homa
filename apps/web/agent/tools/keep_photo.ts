import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import {
  blobConfigured,
  uploadStudioImageBytes,
} from "../../lib/materials/artifact-store";
import {
  fetchWebPhotoBytes,
  verifyPhotoToken,
} from "../../lib/search/serp-images";

/**
 * The studio's photo desk, step two: exchange one search_photos token
 * for a permanent copy in THIS family's artifact space. The fetch
 * target comes from the verified token (Google-authored, family-bound,
 * HMAC-signed), never from model input, and the stored copy's URL then
 * passes isFamilyArtifactUrl, so it works everywhere family images
 * already work: <img> in create_printable html and generate_image
 * references, with no changes to those tools.
 */
export default defineBoundedTool({
  description:
    "Save one search_photos result into this family's own library and get back a permanent image URL. Pass a photoToken exactly as search_photos returned it. The returned URL is the only web-photo URL you may use: embed it with <img> in create_printable html (size it with CSS), or pass it to generate_image as a reference. Keep only the photo you will actually use.",
  deadlineMs: TOOL_DEADLINE.fetch,
  inputSchema: z.object({
    photoToken: z
      .string()
      .min(20)
      .max(4000)
      .describe("A photoToken from this conversation's search_photos results, verbatim."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { kept: false, note: error.message };
      }
      throw error;
    }
    const channel = usageChannelFromAttributes(
      ctx.session.auth.current?.attributes,
    );
    if (channel === "subject_lesson") {
      return {
        kept: false,
        note: "Use an HTML-only subject lesson worksheet without photo or reference imports.",
      };
    }

    if (!blobConfigured()) {
      return {
        kept: false,
        note: "This deployment has no artifact store, so web photos cannot be kept. Design without the photo.",
      };
    }

    const verified = verifyPhotoToken(input.photoToken, access.familyId);
    if (!verified) {
      return {
        kept: false,
        note: "That photoToken is not valid for this family. Pass a photoToken exactly as search_photos returned it, or search again.",
      };
    }

    const startedAt = Date.now();
    const fetched = await fetchWebPhotoBytes(verified.url);
    if (!fetched.ok) {
      const reasonNote =
        fetched.reason === "too_large"
          ? "That photo's file is too large to keep."
          : fetched.reason === "not_image"
            ? "That result did not serve a usable image file."
            : "That photo could not be downloaded from its site.";
      return {
        kept: false,
        note: `${reasonNote} Pick another search_photos result or search once more.`,
      };
    }

    const url = await uploadStudioImageBytes({
      familyId: access.familyId,
      bytes: fetched.bytes,
      mediaType: fetched.mediaType,
    });

    await emitMapEvent("materials.photo_imported", {
      family_id: access.familyId,
      channel,
      bytes: fetched.bytes.byteLength,
      duration_ms: Date.now() - startedAt,
    });

    return {
      kept: true,
      url,
      width: verified.width,
      height: verified.height,
      note: "Kept in the family's library. Embed it with <img src=\"...\"> sized to fit the page, or pass it to generate_image as a reference. It is a real photo from the web: fine on a page for home use, but never present it as the child's own work or as art you made.",
    };
  },
});
