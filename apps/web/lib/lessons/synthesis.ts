import { generateObject } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import type { SegmentToneNotes } from "./tone";
import { MAX_LESSON_CLAUSES } from "./pairs";

/**
 * The finish-time synthesis pass (plan 2026-07-13-lesson-listen.md
 * §4.5): one generateObject call over three inputs (the assembled
 * transcript, every segment's tone notes, the media captions) that
 * produces the review document plus candidate ability-clause pairs.
 *
 * The model has NO scoring authority. Clause pairs leave here as
 * candidates only; lib/lessons/pairs.ts verifies each excerpt against
 * the transcript and each clause against its excerpt before anything
 * approaches the progress ledger, and the journal matcher still
 * decides what scores.
 */

export const lessonMomentSchema = z.object({
  segmentSeq: z.number().int().min(1),
  kind: z.enum([
    "excited",
    "engaged",
    "distracted",
    "frustrated",
    "breakthrough",
    "sweet",
  ]),
  /** One short sentence naming the beat. */
  headline: z.string().min(1).max(160),
  /** What happened, grounded in the transcript or tone notes. */
  detail: z.string().min(1).max(400),
});

export const lessonClausePairSchema = z.object({
  /** Parent-report style, the child's name as the subject. */
  clause: z.string().min(1).max(300),
  /** Verbatim words copied from the transcript. */
  excerpt: z.string().min(1).max(500),
  segmentSeq: z.number().int().min(1),
});

export const lessonInsightsSchema = z.object({
  summary: z.string().min(1).max(700),
  moments: z.array(lessonMomentSchema).max(8),
  whatWorked: z.array(z.string().min(1).max(300)).max(4),
  friction: z.array(z.string().min(1).max(300)).max(4),
  nextTime: z.array(z.string().min(1).max(300)).min(1).max(3),
  openQuestions: z.array(z.string().min(1).max(300)).max(3),
  /** Review text only when a sibling audibly appears (§7 Q2). */
  siblingNote: z.string().max(300).nullable(),
  clausePairs: z.array(lessonClausePairSchema).max(MAX_LESSON_CLAUSES),
});

export type LessonMoment = z.infer<typeof lessonMomentSchema>;

export type LessonInsights = z.infer<typeof lessonInsightsSchema>;

/** The insights JSONB the review row stores: everything except the
 *  clause pairs, which live on as evidence and observations instead. */
export type StoredLessonInsights = Omit<LessonInsights, "clausePairs">;

const SYNTHESIS_SYSTEM = `You turn one recorded homeschool lesson into
a short review for the parent who taught it. You read the transcript
(split into numbered ~3-minute segments), tone notes an audio model
wrote per segment, and captions of photos the parent snapped.

House rules, absolute:
- Reassure before inform. Offers, never commands ("a volcano book
  could carry the next session", not "you should").
- Never "behind", never red-alarm framing, never compare siblings.
- One idea per sentence, plain words, no jargon, no em dash anywhere.
- Never invent. Every moment must trace to the transcript or a tone
  note. Time references stay soft ("about 20 minutes in"), derived
  from segment numbers only.
- You are never told whether this child is a boy or a girl, and the
  name is not an answer. Write "they/them/their" unless the PARENT'S
  OWN WORDS in this transcript call the child "he" or "she"; then match
  her usage exactly. Never guess from the name.

The clausePairs field is special. For each concrete skill the CHILD
demonstrated or visibly struggled with, emit a pair:
- clause: one parent-report sentence with the child's name as the
  grammatical subject ("Emma read the whole page aloud without help",
  "Emma could not borrow from the tens place yet"). Use words from the
  excerpt wherever possible.
- excerpt: the verbatim transcript words backing it, copied exactly,
  spanning the exchange: include the parent's question or framing AND
  the child's response. A bare fragment of the child's speech ("four,
  five.") is never enough on its own; quote the words around it that
  carry the moment's meaning. One or two turns each side is plenty,
  never a whole page of transcript.
- segmentSeq: the segment the excerpt came from.
Only the child's own demonstrated ability counts: not the parent's
teaching, not tone, not effort. Fewer honest pairs beat many loose
ones. If the lesson shows no concrete skill moments, return an empty
clausePairs array.

If another child is audibly part of this lesson, say so in
siblingNote in one neutral sentence; otherwise return null for it.`;

export interface LessonSynthesisInput {
  familyId: string;
  childName: string;
  segments: Array<{
    seq: number;
    transcript: string | null;
    toneNotes: SegmentToneNotes | null;
  }>;
  mediaCaptions: Array<{
    caption: string;
    capturedDuringSeq: number | null;
  }>;
}

/**
 * assembleLessonTranscript(segments): the one transcript string both
 * the synthesis prompt and the pairs guard read, so "verbatim
 * substring" means the same thing in both places.
 */
export function assembleLessonTranscript(
  segments: LessonSynthesisInput["segments"],
): string {
  return segments
    .filter((segment) => (segment.transcript ?? "").trim().length > 0)
    .map(
      (segment) =>
        `[Segment ${segment.seq}, about minute ${(segment.seq - 1) * 3}]\n` +
        `${segment.transcript?.trim() ?? ""}`,
    )
    .join("\n\n");
}

function renderToneNotes(
  segments: LessonSynthesisInput["segments"],
): string {
  const noted = segments.filter((segment) => segment.toneNotes !== null);
  if (noted.length === 0) return "(no tone notes for this lesson)";
  return noted
    .map(
      (segment) =>
        `Segment ${segment.seq}: ${JSON.stringify(segment.toneNotes)}`,
    )
    .join("\n");
}

function renderMediaCaptions(
  captions: LessonSynthesisInput["mediaCaptions"],
): string {
  if (captions.length === 0) return "(no photos attached)";
  return captions
    .map((media) =>
      media.capturedDuringSeq === null
        ? `Photo (added at the end): ${media.caption}`
        : `Photo (during segment ${media.capturedDuringSeq}): ${media.caption}`,
    )
    .join("\n");
}

/**
 * synthesizeLessonReview(input): the review document plus candidate
 * clause pairs. Throws on model failure; the caller owns retry
 * (claim-and-sweep) and the honest failure copy.
 */
export async function synthesizeLessonReview(
  input: LessonSynthesisInput,
): Promise<LessonInsights> {
  const transcript = assembleLessonTranscript(input.segments);
  const startedAt = Date.now();
  const result = await generateObject({
    model: HOMA_MODEL,
    schema: lessonInsightsSchema,
    system: SYNTHESIS_SYSTEM,
    prompt: [
      `The child is ${input.childName}. Write the lesson review.`,
      `<transcript>\n${transcript.slice(0, 90_000)}\n</transcript>`,
      `<tone_notes>\n${renderToneNotes(input.segments)}\n</tone_notes>`,
      `<photos>\n${renderMediaCaptions(input.mediaCaptions)}\n</photos>`,
    ].join("\n\n"),
    // The schema's own caps allow roughly 19k characters (8 moments, 12
    // clause pairs with 500-char excerpts, the lists), and JSON adds
    // structure on top, so 6000 truncated the object and generateObject
    // failed to parse it once exchange-spanning excerpts made pairs
    // longer (verified 2026-07-21: analysis threw "No object generated"
    // on a real lesson that had synthesized fine with short excerpts).
    maxOutputTokens: 16_000,
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(input.familyId, "lesson_synthesis"),
      },
    },
  });

  await recordModelUsage({
    familyId: input.familyId,
    surface: "lesson_synthesis",
    channel: "web",
    model: HOMA_MODEL,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - startedAt,
  });

  return result.object;
}
