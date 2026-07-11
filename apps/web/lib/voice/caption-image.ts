import { generateText } from "ai";

import { gatewayAttribution, recordModelUsage } from "../model-usage";

/**
 * One-line captions for photos texted to Homa (the microwave lesson,
 * founder review 2026-07-10 evening: a photo-only conversation was
 * invisible to recall, so Homa denied it ever happened). The caption
 * joins the turn text as a bracketed block, which makes it part of the
 * persisted conversation_messages row, which makes the photo findable
 * by recall's FTS and semantic search forever after.
 *
 * Failure posture: null on any failure, never throws, never blocks the
 * turn (founder ruling 2026-07-10: never deny input). The image part
 * still rides to the model either way; the caption is for the archive.
 * Cost control: HOMA_MEDIA_CAPTIONS=off disables fleet-wide;
 * HOMA_CAPTION_MODEL swaps the model (default the same cheap vision
 * tier as the materials reviewer).
 */

const DEFAULT_CAPTION_MODEL = "openai/gpt-5.4-mini";

/** The SMS lane already tolerates seconds of media work (voice notes
 *  transcribe inline); a caption slower than this degrades to no
 *  caption rather than a stalled reply. */
const CAPTION_TIMEOUT_MS = 20_000;

const CAPTION_MAX_CHARS = 240;

const CAPTION_SYSTEM = `You caption photos a parent texts to her
homeschool assistant, so the conversation can be searched later. Reply
with ONE plain factual sentence naming what the photo shows: the main
objects, any readable text, and the child's work when that is what it
is. Examples: "An over-range microwave with a loose door handle." or
"A handwriting practice page with the letter O traced in pencil." No
preamble, no guesses about people's names, no commentary.`;

export function captionsEnabled(): boolean {
  return process.env.HOMA_MEDIA_CAPTIONS !== "off";
}

export function captionModelId(): string {
  return process.env.HOMA_CAPTION_MODEL ?? DEFAULT_CAPTION_MODEL;
}

/**
 * captionSmsImage(...): one searchable sentence about the photo, or
 * null when captions are off, the model fails, or the clock runs out.
 * The image arrives as bytes (converted formats) or by URL (the same
 * short-lived Telnyx URL the chat model itself reads).
 */
export async function captionSmsImage(input: {
  image: Uint8Array | URL;
  mediaType: string;
  familyId: string | null;
}): Promise<string | null> {
  if (!captionsEnabled()) return null;

  const model = captionModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAPTION_TIMEOUT_MS);

  try {
    const result = await generateText({
      model,
      system: CAPTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: input.mediaType,
              data: input.image instanceof URL ? input.image : Buffer.from(input.image),
            },
            { type: "text", text: "Caption this photo in one sentence." },
          ],
        },
      ],
      maxOutputTokens: 120,
      maxRetries: 1,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: {
          ...gatewayAttribution(input.familyId, "media_caption"),
          disallowPromptTraining: true,
        },
      },
    });

    await recordModelUsage({
      familyId: input.familyId,
      surface: "media_caption",
      channel: "sms",
      model,
      modality: "text",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: Date.now() - startedAt,
    });

    const caption = result.text.trim().replace(/\s+/g, " ");
    return caption.length > 0 ? caption.slice(0, CAPTION_MAX_CHARS) : null;
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(
        "captionSmsImage failed (photo rides uncaptioned):",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
