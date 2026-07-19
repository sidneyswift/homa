import { generateImage } from "ai";

import {
  gatewayAttribution,
  recordModelUsage,
  type UsageChannel,
} from "../model-usage";
import { isFamilyArtifactUrl, uploadStudioImageBytes } from "./artifact-store";

/**
 * Image generation for the materials studio, through the Vercel AI
 * Gateway (GPT Image 2 by default): the same gateway the chat agent
 * already speaks through, so no separate credential exists. Model id is
 * env-swappable (config over convention): HOMA_IMAGE_MODEL changes the
 * model without a deploy, and the calibration harness
 * (scripts/materials-calibration.mts) re-baselines what the new model
 * can do.
 *
 * Not illustration-shaped on purpose (founder direction 2026-07-10):
 * callers may be making coloring art, a themed header, an infographic,
 * or the entire page in one image. Reference images (the family's own
 * approved finals, validated by isFamilyArtifactUrl) steer style and
 * enable "same page, different character" without re-imagining.
 *
 * Image models return bytes, never a hosted URL, so this module owns
 * the one hop that makes the result reusable: decode, upload to Blob,
 * hand back a plain https URL. Every call records a model_usage row and
 * tags the Gateway request for /v1/report attribution (MS-6).
 */

const DEFAULT_IMAGE_MODEL = "openai/gpt-image-2";
const GENERATION_TIMEOUT_MS = 150_000;
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

/** GPT Image 2's five supported output sizes, named for what a page
 * designer actually reaches for. */
const SHAPE_SIZE = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
  tall: "1024x1792",
  wide: "1792x1024",
} as const satisfies Record<string, `${number}x${number}`>;

export const IMAGE_SHAPES = Object.keys(SHAPE_SIZE) as (keyof typeof SHAPE_SIZE)[];
export type ImageShape = keyof typeof SHAPE_SIZE;

export function imageModelId(): string {
  return process.env.HOMA_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
}

export type StudioImageResult =
  | { ok: true; url: string }
  | { ok: false; note: string };

async function fetchReferenceBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > 0 && bytes.byteLength <= MAX_REFERENCE_BYTES
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * generateStudioImage(...): one hosted image URL or a model-readable
 * failure note. Never throws: a generation hiccup should read as "try a
 * simpler prompt", not a broken turn.
 */
export async function generateStudioImage(input: {
  familyId: string;
  channel: UsageChannel;
  prompt: string;
  shape?: ImageShape;
  referenceImageUrls?: string[];
  // The calling eve session, so this image's spend lands in model_usage keyed
  // to the session that caused it (agent-jobs cost attribution). Optional and
  // null-safe: a chat-driven image simply attributes to its chat session, a
  // background build's image to its build session, reuniting a job's real
  // material cost with its chat turns by build session id.
  sessionId?: string | null;
}): Promise<StudioImageResult> {
  const referenceUrls = (input.referenceImageUrls ?? []).slice(0, MAX_REFERENCE_IMAGES);
  for (const url of referenceUrls) {
    if (!isFamilyArtifactUrl(url, input.familyId)) {
      return {
        ok: false,
        note: "Reference images must come from this family's own library (a previewUrl or image url a tool returned). Drop the outside URL and try again.",
      };
    }
  }

  const references: Uint8Array[] = [];
  for (const url of referenceUrls) {
    const bytes = await fetchReferenceBytes(url);
    if (!bytes) {
      return {
        ok: false,
        note: "One of the reference images could not be loaded. Re-check it with find_materials, or generate without references.",
      };
    }
    references.push(bytes);
  }

  const model = imageModelId();
  const size = SHAPE_SIZE[input.shape ?? "square"];
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    const result = await generateImage({
      model,
      prompt:
        references.length > 0
          ? { images: references, text: input.prompt }
          : input.prompt,
      size,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: gatewayAttribution(input.familyId, "materials_image"),
      },
    });
    const image = result.image;
    if (!image?.base64) {
      return {
        ok: false,
        note: "The image provider returned nothing usable. Try a reworded prompt, or design the page without it.",
      };
    }

    await recordModelUsage({
      familyId: input.familyId,
      surface: "materials_image",
      channel: input.channel,
      model,
      modality: "image",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      imagesCount: result.images.length,
      imageSize: size,
      durationMs: Date.now() - startedAt,
      sessionId: input.sessionId ?? null,
    });

    const url = await uploadStudioImageBytes({
      familyId: input.familyId,
      bytes: Buffer.from(image.base64, "base64"),
      mediaType: image.mediaType ?? "image/png",
    });
    return { ok: true, url };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        note: "The image is taking too long. Try once more with a simpler prompt, or design the page without it.",
      };
    }
    console.error(
      "generateStudioImage failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      ok: false,
      note: "Image generation failed this time. Try a reworded prompt, or design the page without it.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
