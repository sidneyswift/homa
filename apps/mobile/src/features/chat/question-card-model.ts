import type { EveMessage, EveMessagePart } from "eve/react";

/**
 * The choice card's logic, the mobile twin of
 * apps/web/app/app/question-card.tsx. Ported verbatim on purpose: the
 * message the parent's taps compose is the same message on every
 * surface, so Homa reads one shape of answer no matter where she asked
 * (apps/web/app/app/question-card.test.ts is the same suite).
 *
 * Pure functions, no JSX and no react-native import, so the node test
 * runner can load this file directly.
 */

export interface QuestionCardOption {
  label: string;
  description: string | null;
}

export interface QuestionCardQuestion {
  header: string;
  question: string;
  multiSelect: boolean;
  options: QuestionCardOption[];
}

export interface QuestionCardData {
  questions: QuestionCardQuestion[];
}

function parseOption(raw: unknown): QuestionCardOption | null {
  if (typeof raw !== "object" || raw === null) return null;
  const option = raw as Record<string, unknown>;
  if (typeof option.label !== "string" || option.label.length === 0) return null;
  return {
    label: option.label,
    description:
      typeof option.description === "string" && option.description.length > 0
        ? option.description
        : null,
  };
}

function parseQuestion(raw: unknown): QuestionCardQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const question = raw as Record<string, unknown>;
  if (typeof question.question !== "string" || question.question.length === 0) {
    return null;
  }
  if (!Array.isArray(question.options)) return null;
  const options = question.options
    .map(parseOption)
    .filter((option): option is QuestionCardOption => option !== null);
  if (options.length === 0) return null;
  return {
    header: typeof question.header === "string" ? question.header : "",
    question: question.question,
    multiSelect: question.multiSelect === true,
    options,
  };
}

/**
 * An ask_user_questions result as a card, or null for anything this
 * screen must not draw. Defensive by design: a half-streamed part, a
 * refusal, or a question whose options never arrived all read as null
 * rather than throwing inside a transcript render.
 */
export function parseQuestionCardPart(
  part: EveMessagePart,
): QuestionCardData | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "ask_user_questions" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.asked !== true || !Array.isArray(output.questions)) return null;
  const questions = output.questions
    .map(parseQuestion)
    .filter((question): question is QuestionCardQuestion => question !== null);
  if (questions.length === 0) return null;
  return { questions };
}

export interface ActiveQuestionRequest {
  message: EveMessage;
  partKey: string;
  card: QuestionCardData;
}

/**
 * The one choice card that may still be answered: the newest one with
 * no user message after it. Anything older renders settled, so a spent
 * card never invites a second tap.
 */
export function latestQuestionRequest(
  messages: readonly EveMessage[],
): ActiveQuestionRequest | null {
  let latest: ActiveQuestionRequest | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const card = parseQuestionCardPart(part);
      if (card) {
        latest = { message, partKey: `${message.id}:${partIndex}`, card };
      }
    }
  }
  return latest;
}

/** What the parent chose, in question order. An empty array is a skip. */
export type QuestionAnswers = readonly (readonly string[])[];

/**
 * What a skipped question says. Saying it beats omitting it: Homa needs
 * to know the parent declined to pick, or she just asks again.
 */
const NO_PREFERENCE = "no preference";

/** Labels stay verbatim. One can carry a child's name, and recasing a
 * name to fit a sentence would corrupt it. */
function joinLabels(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Turn the parent's taps into the one message that goes back to Homa.
 *
 * `questions[i]` pairs with `answers[i]`; an empty `answers[i]` is a
 * skip. The result appears in the transcript as HER message, so one
 * answer reads as the bare words a person would type ("Phonics"), with
 * no label to explain what it answers: Homa asked it one line above.
 *
 * Several answers need the labels, because bare words in a list stop
 * saying what they answer. Homa's copy law puts clarity over
 * personality, so they go one per line under their own header rather
 * than run together into a sentence nobody would say out loud.
 */
export function composeAnswerMessage(
  questions: readonly QuestionCardQuestion[],
  answers: QuestionAnswers,
): string {
  const needsLabels = questions.length > 1;
  return questions
    .map((question, index) => {
      const picked = answers[index] ?? [];
      const said = picked.length > 0 ? joinLabels(picked) : NO_PREFERENCE;
      const header = question.header.trim();
      if (!needsLabels || header.length === 0) {
        return said.charAt(0).toUpperCase() + said.slice(1);
      }
      return `${header}: ${said}`;
    })
    .join("\n");
}
