import { generateObject } from "ai";
import { z } from "zod";

import { gatewayAttribution, recordModelUsage } from "../model-usage";

/**
 * The tone lane (plan 2026-07-13-lesson-listen.md §4.4, founder
 * direction §1 item 7): transcripts flatten a lesson into words, so an
 * audio-input model listens to each ~3-minute segment and writes down
 * what the words lose: energy, engagement shifts, laughter, long
 * silences, frustration and excitement beats.
 *
 * Fail-soft like every media pass in this repo (caption-image.ts):
 * null on any failure, never throws, and a lesson with no tone notes
 * still gets its transcript-only review. HOMA_LESSON_TONE=off disables
 * fleet-wide; HOMA_LESSON_TONE_MODEL swaps the model. The default is
 * the gateway's audio-capable Gemini tier; the LL-5 spike pins or
 * corrects it before the flag ever flips (plan §4.4).
 */

const DEFAULT_TONE_MODEL = "google/gemini-3-flash";

/** A 3-minute segment should tone-note in well under this; past it the
 *  segment simply rides without tone rather than stalling the lane. */
const TONE_TIMEOUT_MS = 45_000;

export const toneBeatSchema = z.object({
  kind: z.enum([
    "excited",
    "engaged",
    "distracted",
    "frustrated",
    "breakthrough",
    "laughter",
    "long_silence",
  ]),
  position: z.enum(["early", "middle", "late"]),
  /** One plain sentence about what was audible, nothing invented. */
  note: z.string().min(1).max(300),
});

export const segmentToneNotesSchema = z.object({
  energy: z.enum(["low", "steady", "high", "mixed"]),
  /** Rough audible sense only; never an identity claim. */
  speakers: z.string().min(1).max(200),
  beats: z.array(toneBeatSchema).max(6),
});

export type SegmentToneNotes = z.infer<typeof segmentToneNotesSchema>;

const TONE_SYSTEM = `You listen to one short segment of a homeschool
lesson a parent recorded, and write down what a transcript cannot hold:
tone, energy, and engagement. The child's parent is teaching; the child
is learning. Report only what is audible in THIS audio: energy level,
who is roughly speaking and how much (by role, never identity), and up
to six notable beats (excitement, engagement, distraction, frustration,
a breakthrough, laughter, a long silence) with where in the segment
they fall. Plain sentences. Never invent, never diagnose, never
compare this child to anyone.`;

export function toneNotesEnabled(): boolean {
  return process.env.HOMA_LESSON_TONE !== "off";
}

export function toneModelId(): string {
  return process.env.HOMA_LESSON_TONE_MODEL ?? DEFAULT_TONE_MODEL;
}

/**
 * toneNotesForSegment(...): structured tone notes for one segment, or
 * null when the lane is off, the model refuses the container, or the
 * clock runs out. The audio rides by public blob URL so segment bytes
 * never pass through this function.
 */
export async function toneNotesForSegment(input: {
  audioUrl: string;
  mediaType: string;
  familyId: string;
}): Promise<SegmentToneNotes | null> {
  if (!toneNotesEnabled()) return null;

  const model = toneModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TONE_TIMEOUT_MS);

  try {
    const result = await generateObject({
      model,
      schema: segmentToneNotesSchema,
      system: TONE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: input.mediaType,
              data: new URL(input.audioUrl),
            },
            {
              type: "text",
              text: "Write the tone notes for this lesson segment.",
            },
          ],
        },
      ],
      maxOutputTokens: 800,
      maxRetries: 1,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: {
          ...gatewayAttribution(input.familyId, "lesson_tone"),
          disallowPromptTraining: true,
        },
      },
    });

    await recordModelUsage({
      familyId: input.familyId,
      surface: "lesson_tone",
      channel: "web",
      model,
      modality: "text",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: Date.now() - startedAt,
    });

    return result.object;
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(
        "lesson tone notes failed (segment rides without tone):",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
