import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { rateLimited } from "../../lib/map/ratelimit";
import { blobConfigured } from "../../lib/materials/artifact-store";
import {
  generateStudioImage,
  IMAGE_SHAPES,
} from "../../lib/materials/generate-image";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGES_PER_FAMILY_PER_DAY = 30;

export function subjectLessonImageGenerationRestriction(
  _input: { referenceImageUrls?: readonly string[] },
  attributes: unknown,
): string | null {
  const channel = (attributes as { channel?: unknown } | null | undefined)
    ?.channel;
  return channel === "subject_lesson"
    ? "Use an HTML-only subject lesson worksheet. Automatic lesson builds cannot generate or reference images."
    : null;
}

/**
 * The materials studio's art department (MS-1): one image per call,
 * generated through the Vercel AI Gateway. Not illustration-shaped:
 * coloring art, themed headers, infographics, or the ENTIRE page in one
 * image (shape 'portrait', then create_printable's pageImageUrl path).
 * Reference images from the family's own library steer style and enable
 * "same page, different character". Costs real money per image, so it
 * is family-gated and rate limited; the model receives only the
 * finished URL, never bytes. Prompt craft lives in the materials-studio
 * skill, not here.
 */
export default defineTool({
  description:
    "Generate one image through the image model: coloring art, a themed header, counting objects, an infographic, or an entire printable page in a single image. Write the full visual description yourself (style first). Optionally pass 1-4 reference image URLs from this family's own materials (a final's previewUrl, an earlier generate_image URL, or a child's photoUrl from the family context) to match a style, swap a character while keeping the layout, or draw the child as an illustrated character in their own material. A child's photo is a drawing reference only, never an identification input, and photorealistic renders of a child are off the table: keep the output in an illustration style. Returns a URL to embed in page HTML or pass to create_printable as pageImageUrl. Each call costs real money; reuse a good image instead of regenerating it.",
  inputSchema: z.object({
    prompt: z
      .string()
      .trim()
      .min(10)
      .max(2000)
      .describe(
        "The complete visual description, art style named first (e.g. 'black and white coloring book line art, thick clean outlines, no shading, white background'). With references, describe what changes and what stays.",
      ),
    shape: z
      .enum(IMAGE_SHAPES)
      .optional()
      .describe(
        "Output shape. Default square; landscape/wide for header banners, portrait for a full letter-page image, tall for a full-height strip.",
      ),
    referenceImageUrls: z
      .array(z.string())
      .max(4)
      .optional()
      .describe(
        "Up to 4 URLs from THIS family's own space (find_materials previewUrl, an earlier generate_image URL, or a child's photoUrl from the family context) whose style, layout, characters, or likeness should guide the result.",
      ),
  }),
  async execute(input, ctx) {
    const restriction = subjectLessonImageGenerationRestriction(
      input,
      ctx.session.auth.current?.attributes,
    );
    if (restriction) {
      return { generated: false, note: restriction };
    }

    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { generated: false, note: error.message };
      }
      throw error;
    }
    const channel = usageChannelFromAttributes(
      ctx.session.auth.current?.attributes,
    );
    if (channel === "subject_lesson") {
      return {
        generated: false,
        note: "Use an HTML-only subject lesson worksheet. Automatic lesson builds cannot generate or reference images.",
      };
    }

    if (!blobConfigured()) {
      return {
        generated: false,
        note: "Image generation is not configured on this deployment. Design the page without a generated image.",
      };
    }
    if (
      rateLimited(`agent-image:${access.familyId}`, MAX_IMAGES_PER_FAMILY_PER_DAY, DAY_MS)
    ) {
      return {
        generated: false,
        note: "This family's image budget for today is used up. Design with what you already generated, or use pure CSS.",
      };
    }

    const attributes = ctx.session.auth.current?.attributes as
      | { phoneNumber?: string }
      | undefined;

    // Image generation is the slow leg of an SMS material build. This
    // fallback shares the progress window with send_heads_up.
    if (channel === "sms" && attributes?.phoneNumber) {
      await sendSmsProgressTextOnce({
        familyId: access.familyId,
        phoneNumber: attributes.phoneNumber,
      });
    }

    const startedAt = Date.now();
    const result = await generateStudioImage({
      familyId: access.familyId,
      channel,
      prompt: input.prompt,
      shape: input.shape,
      referenceImageUrls: input.referenceImageUrls,
    });
    if (!result.ok) {
      return { generated: false, note: result.note };
    }

    await emitMapEvent("materials.image_generated", {
      family_id: access.familyId,
      channel,
      duration_ms: Date.now() - startedAt,
      has_references: (input.referenceImageUrls?.length ?? 0) > 0,
    });

    return {
      generated: true,
      url: result.url,
      note: "Embed it with <img src=\"...\"> in page HTML, or pass it to create_printable as pageImageUrl when it IS the whole page. Reuse this exact URL for revisions.",
    };
  },
});
