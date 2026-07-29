import { defineDynamic } from "eve/tools";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  suppressInTurnGeneration,
  type GenerationGateAttributes,
} from "../../lib/onboarding/generation-gate";
import {
  decodeStudioAnchorBytes,
  getStudioAnchor,
  listStudioAnchors,
  studioAnchorIds,
} from "../../lib/materials/anchors";
import { blobConfigured } from "../../lib/materials/artifact-store";
import {
  generateStudioImage,
  IMAGE_SHAPES,
} from "../../lib/materials/generate-image";
import {
  imageBudgetNote,
  imagesGeneratedToday,
  MAX_IMAGES_PER_FAMILY_PER_DAY,
} from "../../lib/materials/image-budget";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";

// The fixed anchor menu, rendered once for the tool schema. The model may
// only name an id from this list; it can never pass a URL through the
// anchor path, so no tenant boundary is crossed (see lib/materials/anchors).
const ANCHOR_MENU = listStudioAnchors()
  .map((anchor) => `"${anchor.id}" (${anchor.useWhen})`)
  .join("; ");

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
const generateImage = defineBoundedTool({
  description:
    "Generate one image through the image model: coloring art, a themed header, counting objects, an infographic, or an entire printable page in a single image. Write the full visual description yourself (style first). Optionally pass 1-4 reference image URLs from this family's own materials (a final's previewUrl, an earlier generate_image URL, or a child's photoUrl from the family context) to match a style, swap a character while keeping the layout, or draw the child as an illustrated character in their own material. A child's photo is a drawing reference only, never an identification input, and photorealistic renders of a child are off the table: keep the output in an illustration style. When the material you are building is a format with a fleet anchor, every call for it also passes that anchorIds entry, so a shared Homa reference image holds the quality bar (see the anchorIds menu). Returns a URL to embed in page HTML or pass to create_printable as pageImageUrl. Each call costs real money; reuse a good image instead of regenerating it.",
  deadlineMs: TOOL_DEADLINE.generate,
  repeatable: false,
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
    anchorIds: z
      .array(z.string())
      .max(4)
      .optional()
      .describe(
        `Fleet anchor ids: shared Homa reference images that hold the visual quality bar for a FORMAT of material. Match the MATERIAL you are building against the menu, never this one image: when the material is a menu format, pass its anchor id on every generate_image call for that material, small spot art as much as a full page. The anchor leads the reference set; still write your own prompt (your own example content and wording). Menu: ${ANCHOR_MENU}. No menu entry names the material? Omit anchorIds; never pass a near-miss.`,
      ),
  }),
  async execute(input, ctx) {
    // Retries after a transient failure tend to shed optional inputs while
    // the model hunts for the failing knob; the anchor is never that knob,
    // and dropping it silently lowers the material's quality bar.
    const anchorRetryReminder = input.anchorIds?.length
      ? " If you retry this image, keep the same anchorIds."
      : "";
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
        return {
          generated: false,
          note: `${error.message}${anchorRetryReminder}`,
        };
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
    const usedToday = await imagesGeneratedToday(access.familyId);
    if (usedToday >= MAX_IMAGES_PER_FAMILY_PER_DAY) {
      return {
        generated: false,
        note: `This family's image budget for today is used up. Design with what you already generated, or use pure CSS. ${imageBudgetNote(usedToday)}`,
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

    // Resolve fleet anchor ids to trusted bytes. The model may only name an
    // id from the fixed registry; an unknown id is a model-readable error,
    // never a URL fetch. Family references still flow through
    // isFamilyArtifactUrl inside generateStudioImage.
    const anchorBytes: Uint8Array[] = [];
    for (const anchorId of input.anchorIds ?? []) {
      const bytes = getStudioAnchor(anchorId)
        ? decodeStudioAnchorBytes(anchorId)
        : null;
      if (!bytes) {
        return {
          generated: false,
          note: `Unknown material anchor "${anchorId}". Use one of: ${studioAnchorIds().join(", ")}, or omit anchorIds.`,
        };
      }
      anchorBytes.push(bytes);
    }

    const startedAt = Date.now();
    const result = await generateStudioImage({
      familyId: access.familyId,
      channel,
      prompt: input.prompt,
      shape: input.shape,
      referenceImageUrls: input.referenceImageUrls,
      anchorBytes,
    });
    if (!result.ok) {
      return {
        generated: false,
        note: `${result.note}${anchorRetryReminder}`,
      };
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
      note: `Embed it with <img src="..."> in page HTML, or pass it to create_printable as pageImageUrl when it IS the whole page. Reuse this exact URL for revisions. ${imageBudgetNote(usedToday + 1)}`,
    };
  },
});

// During web onboarding this tool does not exist (generation-gate.ts):
// an in-turn image render is 40-60 held-open seconds in the parent's
// first conversation, and the background first making owns generation
// there. The agent-job build session keeps it.
export default defineDynamic({
  // step.started, never turn.started: a dynamic TOOL resolved on
  // turn.started is persisted as durable metadata and replayed on later
  // steps by looking its execute up in an in-memory step registry. These
  // tools have no bundler-generated step function, so eve registers a
  // fallback into `globalThis` at resolve time, and any later step that
  // lands on a different lambda isolate finds nothing and drops the tool
  // with only a log line. The model then simply does not have it, which
  // reads to the parent as "my tool is not connected" (2026-07-26/27,
  // gh#345). step.started re-resolves live every step and carries the
  // real closure, which is what eve documents for framework tools.
  events: {
    "step.started": (_event, ctx) => {
      const attributes = ctx.session.auth.current?.attributes as
        | GenerationGateAttributes
        | undefined;
      if (suppressInTurnGeneration(attributes)) return null;
      return generateImage;
    },
  },
});
