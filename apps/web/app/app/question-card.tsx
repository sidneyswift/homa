"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { Check } from "lucide-react";
import { useState } from "react";

import { Logo } from "../../components/brand/Logo";

/**
 * The choice card: when Homa asks the parent to pick
 * (agent/tools/ask_user_questions.ts), the ask renders as a stepped
 * card with tappable options, one question on screen at a time so the
 * parent never faces a wall of decisions. Her taps collect locally and
 * send as ONE ordinary message when the last question is answered,
 * because every send starts a full turn and Homa must not reply
 * halfway through the card.
 *
 * "Type something else" and "Skip" are always there: the card is an
 * offer, never a gate. Nothing is recorded anywhere until she sends.
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
 * card never invites a second tap (the same reader gate the progress
 * cards answer to).
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

export function QuestionCard({
  card,
  active,
  onSendAnswers,
  onTypeInstead,
  answeredSummary = null,
}: {
  card: QuestionCardData;
  active: boolean;
  onSendAnswers?: (message: string) => void;
  onTypeInstead?: () => void;
  /** What she sent from THIS card, once she has. */
  answeredSummary?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(() =>
    card.questions.map(() => []),
  );

  const total = card.questions.length;
  const question = card.questions[Math.min(step, total - 1)];
  const picked = answers[step] ?? [];
  const spent = !active || onSendAnswers === undefined;

  function commit(next: string[][]) {
    if (step + 1 < total) {
      setAnswers(next);
      setStep(step + 1);
      return;
    }
    onSendAnswers?.(composeAnswerMessage(card.questions, next));
  }

  function onPick(label: string) {
    if (question.multiSelect) {
      setAnswers(
        answers.map((entry, index) =>
          index === step
            ? entry.includes(label)
              ? entry.filter((value) => value !== label)
              : [...entry, label]
            : entry,
        ),
      );
      return;
    }
    commit(answers.map((entry, index) => (index === step ? [label] : entry)));
  }

  function onSkip() {
    commit(answers.map((entry, index) => (index === step ? [] : entry)));
  }

  if (answeredSummary !== null) {
    return (
      <section
        className="w-full max-w-[32rem] rounded-lg border border-border-subtle bg-card p-4 shadow-sm sm:p-5"
        aria-label="Homa asked you to choose"
      >
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
          <Logo size={15} variant="mark" />
          {total === 1 ? "One question" : `${total} questions`}
        </p>
        <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-sage">
          <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {/* pre-line: a multi-question answer is one line per question. */}
          <span className="whitespace-pre-line">You said: {answeredSummary}</span>
        </p>
      </section>
    );
  }

  return (
    <section
      className="w-full max-w-[32rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      aria-label="Homa asked you to choose"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
          <Logo size={15} variant="mark" />
          {question.header || "One question"}
        </p>
        {total > 1 ? (
          <p className="text-xs font-semibold tabular-nums text-subtle">
            {step + 1}/{total}
          </p>
        ) : null}
      </div>
      <p className="mt-2.5 font-display text-lg font-semibold leading-snug text-strong">
        {question.question}
      </p>
      {question.multiSelect ? (
        <p className="mt-1 text-sm text-muted">Pick as many as fit.</p>
      ) : null}

      {spent ? (
        <p className="mt-4 text-sm text-subtle">
          {question.options.map((option) => option.label).join(" · ")}
        </p>
      ) : (
        <>
          <div
            className="mt-4 flex flex-col gap-2"
            role="group"
            aria-label="Options"
          >
            {question.options.map((option) => {
              const on = picked.includes(option.label);
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={question.multiSelect ? on : undefined}
                  onClick={() => onPick(option.label)}
                  className={`flex min-h-12 w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors ${
                    on
                      ? "border-brand bg-brand/5"
                      : "border-border bg-page hover:border-brand"
                  }`}
                >
                  <span className="flex-1">
                    <span className="block text-base font-semibold text-strong">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block text-sm text-muted">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {question.multiSelect && on ? (
                    <Check
                      size={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-brand"
                    />
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              disabled={onTypeInstead === undefined}
              onClick={onTypeInstead}
              className="flex min-h-11 w-full items-center rounded-md border border-dashed border-border px-4 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:border-brand hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              Type something else
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-subtle pt-3">
            {question.multiSelect ? (
              <button
                type="button"
                disabled={picked.length === 0}
                onClick={() => commit(answers)}
                className="min-h-11 rounded-pill bg-brand px-5 py-2 text-sm font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {step + 1 < total ? "Next" : "Done"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSkip}
              className="min-h-11 rounded-pill px-2 py-2 text-sm font-medium text-muted transition-colors hover:text-strong"
            >
              Skip
            </button>
          </div>
        </>
      )}
    </section>
  );
}
