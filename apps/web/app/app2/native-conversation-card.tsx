"use client";

import { useRef, useState } from "react";

import type { NativeInputResponse } from "../../lib/conversation-native-input";
import type { ConversationFeedMessage } from "../../lib/conversation-feed";

export type NativeConversationBatch = NonNullable<ConversationFeedMessage["nativeInput"]>;

/** Options retain runtime IDs. Never infer authorization from a label or turn
 * an approval into arbitrary text; the server validates the complete batch. */
export function NativeConversationCard({ batch, queued, failed, onAnswer }: {
  batch: NativeConversationBatch; queued: NativeInputResponse[] | null; failed: boolean;
  onAnswer(responses: NativeInputResponse[]): Promise<boolean>;
}) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<NativeInputResponse[]>([]);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const question = batch.requests[step];
  const spent = batch.state === "answered" || queued !== null || submitted;
  async function answer(response: NativeInputResponse) {
    if (inFlight.current || spent) return;
    const next = [...responses, response];
    if (step + 1 < batch.requests.length) { setResponses(next); setText(""); setStep(value => value + 1); return; }
    inFlight.current = true; setSending(true);
    try { if (await onAnswer(next)) { setResponses(next); setSubmitted(true); } }
    finally { inFlight.current = false; setSending(false); }
  }
  if (spent) return <section aria-label="Homa’s question and your response" className="w-full max-w-[32rem] rounded-lg border border-border-subtle bg-card p-4 sm:p-5">
    <dl className="space-y-4">{batch.requests.map(request => {
      const response = (batch.responses ?? queued ?? responses).find(value => value.requestId === request.requestId);
      const answer = response?.text ?? request.options?.find(option => option.id === response?.optionId)?.label;
      return <div key={request.requestId}>
        <dt className="font-display text-lg text-strong">{request.prompt}</dt>
        {answer && <dd className="mt-2 text-sm text-muted"><span className="sr-only">Your response: </span>{answer}</dd>}
      </div>;
    })}</dl>
    <div className="mt-4 text-sm text-muted">{batch.state === "answered" ? "Answered in the conversation." : "Your response is ready to send."}</div>
  </section>;
  if (!question) return null;
  const approval = question.options?.length === 2 && question.options[0].id === "approve" && question.options[1].id === "deny";
  const freeform = !approval && (question.allowFreeform || question.display === "text" || !question.options?.length);
  return <section aria-label="Homa needs your response" className="w-full max-w-[32rem] rounded-lg border border-border-subtle bg-card p-4 sm:p-5">
    {failed && <div className="mb-3 text-sm text-muted" role="status">That response was not accepted. Please choose again.</div>}
    <h3 className="font-display text-lg text-strong">{question.prompt}</h3>
    {batch.requests.length > 1 && <div className="mt-1 text-sm text-muted">{step + 1} of {batch.requests.length}</div>}
    <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Options">
      {question.options?.map(option => <button key={option.id} type="button" disabled={sending}
        className="rounded-lg border border-border-subtle px-4 py-3 text-left text-sm text-strong disabled:opacity-50"
        onClick={() => { void answer({ requestId: question.requestId, optionId: option.id }); }}>
        {option.label}{option.description && <span className="mt-1 block text-xs text-muted">{option.description}</span>}
      </button>)}
    </div>
    {freeform && <form className="mt-4 flex flex-col gap-2" onSubmit={event => {
      event.preventDefault(); if (text.trim()) void answer({ requestId: question.requestId, text });
    }}>
      <label className="text-sm text-muted">Your answer<textarea value={text} disabled={sending} maxLength={64_000}
        onChange={event => setText(event.target.value)} className="mt-2 block w-full rounded-lg border border-border-subtle p-3 text-strong" /></label>
      <button type="submit" disabled={sending || !text.trim()} className="text-sm text-strong disabled:opacity-50">Send answer</button>
    </form>}
  </section>;
}
