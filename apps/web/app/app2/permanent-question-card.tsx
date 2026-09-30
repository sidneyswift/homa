"use client";

import { useState } from "react";

import type { ConversationQuestionAnswer } from "../../lib/conversation-question-answer";
import type { ConversationQuestionCard } from "../../lib/conversation-question-card";

/** Choices retain their positions, because two options may share a label. */
export function PermanentQuestionCard({ id, card, state, answers: savedAnswers, onAnswer, onTypeInstead }: {
  id: string; card: ConversationQuestionCard; state: string;
  answers: ConversationQuestionAnswer["answers"] | null;
  onAnswer(answer: ConversationQuestionAnswer): Promise<boolean>;
  onTypeInstead(): void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ConversationQuestionAnswer["answers"]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const question = card.questions[step];
  const spent = state === "answered" || state === "deleted" || submitted;
  const active = !spent && (state === "ready" || state === "continued");
  async function advance(options: number[]) {
    const next = [...answers, options.length ? { question: step, kind: "choice" as const, options } : { question: step, kind: "skip" as const }];
    if (step + 1 < card.questions.length) { setAnswers(next); setStep(value => value + 1); setSelected([]); return; }
    setSending(true);
    try { if (await onAnswer({ questionId: id, answers: next })) { setAnswers(next); setSubmitted(true); } }
    finally { setSending(false); }
  }
  const recordedAnswers=savedAnswers ?? answers;
  if (spent) return <section className="w-full max-w-[32rem] rounded-lg border border-border-subtle bg-card p-4 sm:p-5" aria-label="Your choices">
    {recordedAnswers.length === 0 && <p className="text-sm text-muted">{state === "deleted" ? "This question is no longer available." : "Answered in the conversation."}</p>}
    {recordedAnswers.map(answer => <p key={answer.question} className="text-sm text-muted">
      {card.questions[answer.question].header}: {answer.kind === "skip" ? "No preference" : answer.options.map(option => card.questions[answer.question].options[option].label).join(", ")}
    </p>)}
  </section>;
  return <section className="w-full max-w-[32rem] rounded-lg border border-border-subtle bg-card p-4 sm:p-5" aria-label="Homa asked you to choose">
    <p className="text-xs text-subtle">{question.header}{card.questions.length > 1 ? ` · ${step + 1}/${card.questions.length}` : ""}</p>
    <p className="mt-2 font-display text-lg text-strong">{question.question}</p>
    {question.multiSelect && <p className="mt-1 text-sm text-muted">Pick as many as fit.</p>}
    <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Options">
      {question.options.map((option, index) => <button key={index} type="button" disabled={!active || sending}
        aria-pressed={question.multiSelect ? selected.includes(index) : undefined}
        className="rounded-lg border border-border-subtle px-4 py-3 text-left text-sm text-strong disabled:opacity-50"
        onClick={() => { if (question.multiSelect) setSelected(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index]); else void advance([index]); }}>
        {option.label}{option.description && <span className="mt-1 block text-xs text-muted">{option.description}</span>}
      </button>)}
    </div>
    <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
      {question.multiSelect && <button type="button" disabled={!active || sending || !selected.length} onClick={() => { void advance(selected); }}>Continue</button>}
      <button type="button" disabled={!active || sending} onClick={() => { void advance([]); }}>Skip</button>
      <button type="button" disabled={!active || sending} onClick={onTypeInstead}>Type something else</button>
    </div>
  </section>;
}
