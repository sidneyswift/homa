import { generateText } from "ai";

import { gatewayAttribution, recordModelUsage } from "../model-usage";

/**
 * Looking again at something a parent already sent (gh#351).
 *
 * Captions are one sentence written once, for search. They are not a
 * reading. On 2026-07-25 a parent's dictated list of page edits was cut
 * off mid-word, so she sent a screen recording of her own message and
 * then a screenshot of it. Both were captioned ("a screen recording of
 * a chat interface"), neither was read, and Homa had to ask her to
 * retype the whole thing. On 2026-07-28 she sent a reference layout and
 * Homa could not open it again a few turns later.
 *
 * The gap is not vision, it is that nothing could ask a SECOND question
 * about an image already in the family's own storage. Tool results are
 * text, so the model can never re-see pixels itself; it has to send a
 * question and get words back.
 *
 * Deliberately not a captioner: the caller supplies the question, and
 * for text the answer is a transcription rather than a description.
 */

const DEFAULT_DESCRIBE_MODEL = "openai/gpt-5.4-mini";

/** A parent is waiting on this inside a turn, so a slow read degrades to
 *  an honest miss rather than a stalled reply. */
const DESCRIBE_TIMEOUT_MS = 30_000;

export const DESCRIBE_MAX_CHARS = 4000;

const DESCRIBE_SYSTEM = `You look at one image a parent sent her
homeschool assistant and answer one question about it.

Two jobs, and the question decides which:

- Reading. When the question asks what something SAYS, transcribe the
  text exactly as written, in reading order, and nothing else. Keep her
  spelling, her line breaks, and her numbering. Never summarize text you
  were asked to read, and never repair it: if a word is cut off or
  unreadable, write what is there and mark the gap [unreadable].
- Describing. Otherwise answer plainly in a few sentences, naming what
  is actually visible.

Never guess at anything the image does not show. If the answer is not in
the image, say so in one sentence. Never guess whether a person is a boy
or a girl, a man or a woman: write "they/them/their" or describe by
role.`;

export function describeModelId(): string {
  return process.env.HOMA_DESCRIBE_MODEL ?? DEFAULT_DESCRIBE_MODEL;
}

export interface DescribeResult {
  text: string | null;
  /** Why there is no text, for an honest tool result. */
  reason: "ok" | "timeout" | "failed";
}

export async function describeAttachment(input: {
  url: string;
  mediaType: string;
  question: string;
  familyId: string;
  sessionId: string;
  turnId: string;
  attachmentId: string;
}): Promise<DescribeResult> {
  const model = describeModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DESCRIBE_TIMEOUT_MS);

  try {
    const result = await generateText({
      model,
      system: DESCRIBE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: input.mediaType,
              data: new URL(input.url),
            },
            { type: "text", text: input.question },
          ],
        },
      ],
      maxOutputTokens: 1500,
      maxRetries: 1,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: {
          ...gatewayAttribution(input.familyId, "attachment_describe"),
          disallowPromptTraining: true,
        },
      },
    });

    await recordModelUsage({
      familyId: input.familyId,
      surface: "attachment_describe",
      channel: "web",
      model,
      modality: "text",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: Date.now() - startedAt,
      sessionId: input.sessionId,
      turnId: input.turnId,
      resourceKind: "attachment",
      resourceId: input.attachmentId,
    });

    const text = result.text.trim().slice(0, DESCRIBE_MAX_CHARS);
    return text.length > 0 ? { text, reason: "ok" } : { text: null, reason: "failed" };
  } catch (error) {
    if (controller.signal.aborted) return { text: null, reason: "timeout" };
    console.error(
      "describeAttachment failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { text: null, reason: "failed" };
  } finally {
    clearTimeout(timeout);
  }
}
