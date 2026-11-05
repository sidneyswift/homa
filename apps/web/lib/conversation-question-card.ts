import { z } from "zod";

/** Only the public card is stored here, never tool notes, authorization tokens,
 * arbitrary tool output, or model arguments from another capability. */
const text = z.string().refine(value => !value.includes("\0") && value.isWellFormed(), "Invalid text encoding");

export const conversationQuestionCardSchema = z.object({
  questions: z.array(z.object({
    header: text.min(1).max(16), question: text.min(1).max(160), multiSelect: z.boolean(),
    options: z.array(z.object({ label: text.min(1).max(60), description: text.max(120).nullable() })).min(2).max(4),
  })).min(1).max(4),
});
export type ConversationQuestionCard = z.infer<typeof conversationQuestionCardSchema>;

export function parseConversationQuestionResult(event: unknown): { callId: string; sourceSequence: number; stepIndex: number; card: ConversationQuestionCard } | null {
  const value = event as { data?: { status?: unknown; sequence?: unknown; stepIndex?: unknown; result?: {
    kind?: unknown; toolName?: unknown; callId?: unknown; isError?: unknown; output?: unknown;
  } } } | null;
  const result = value?.data?.result;
  if (result?.kind !== "tool-result" || result.toolName !== "ask_user_questions" ||
      value?.data?.status !== "completed" || result.isError) return null;
  if (typeof result.callId !== "string" || !result.callId || result.callId.length > 512 ||
      result.callId.includes("\0") || !result.callId.isWellFormed()) throw new Error("Invalid question source");
  const output = result.output as { asked?: unknown } | null;
  if (output?.asked !== true) throw new Error("Question result was not confirmed");
  const sourceSequence = value.data?.sequence, stepIndex = value.data?.stepIndex;
  if (!Number.isSafeInteger(sourceSequence) || (sourceSequence as number) < 0 ||
      !Number.isSafeInteger(stepIndex) || (stepIndex as number) < 0) throw new Error("Invalid question source");
  return { callId: result.callId, sourceSequence: sourceSequence as number, stepIndex: stepIndex as number, card: conversationQuestionCardSchema.parse(output) };
}

/** Readable fallback and model context retain every offered choice. */
export function conversationQuestionText(card: ConversationQuestionCard): string {
  return card.questions.map(question => [question.question, ...question.options.map(option =>
    `${option.label}${option.description ? `: ${option.description}` : ""}`)].join("\n")).join("\n\n");
}
