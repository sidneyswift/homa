import { z } from "zod";

import type { ConversationQuestionCard } from "./conversation-question-card";

const answer = z.discriminatedUnion("kind", [
  z.object({ question: z.number().int().min(0).max(3), kind: z.literal("skip") }).strict(),
  z.object({ question: z.number().int().min(0).max(3), kind: z.literal("choice"),
    options: z.array(z.number().int().min(0).max(3)).min(1).max(4) }).strict(),
]);
export const conversationQuestionAnswerSchema = z.object({
  questionId: z.uuid(), answers: z.array(answer).min(1).max(4),
}).strict();
export type ConversationQuestionAnswer = z.infer<typeof conversationQuestionAnswerSchema>;

/** Positions are stable IDs inside the immutable card. Normalize ordering for
 * duplicate delivery, but never silently discard duplicate/invalid choices. */
export function normalizeQuestionAnswer(input: unknown): ConversationQuestionAnswer {
  const parsed = conversationQuestionAnswerSchema.parse(input);
  if (new Set(parsed.answers.map(value => value.question)).size !== parsed.answers.length) throw new Error("Duplicate question answer");
  return { ...parsed, answers: parsed.answers.map(value => {
    if (value.kind === "skip") return value;
    if (new Set(value.options).size !== value.options.length) throw new Error("Duplicate option");
    return { ...value, options: [...value.options].sort((a, b) => a - b) };
  }).sort((a, b) => a.question - b.question) };
}

/** Only the server renders the accepted answer from stored labels. Browser
 * labels cannot impersonate choices or bypass single/multiple selection rules. */
export function renderQuestionAnswer(card: ConversationQuestionCard, input: ConversationQuestionAnswer): string {
  if (input.answers.length !== card.questions.length) throw new Error("Incomplete question answer");
  return input.answers.map((value, index) => {
    const question = card.questions[index];
    if (value.question !== index) throw new Error("Unknown question");
    if (value.kind === "skip") return `${question.question}\nNo preference.`;
    if ((!question.multiSelect && value.options.length !== 1) || value.options.some(option => !question.options[option])) {
      throw new Error("Invalid question choice");
    }
    return `${question.question}\n${value.options.map(option => question.options[option].label).join(", ")}`;
  }).join("\n\n");
}
