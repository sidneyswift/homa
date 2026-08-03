"use client";

import type { EveMessage } from "eve/react";
import { useState } from "react";

import { MessageView } from "../../app/message-parts";

/**
 * Development-only bench for the choice card
 * (agent/tools/ask_user_questions.ts).
 *
 * This renders the REAL transcript path, not a copy of it: the same
 * MessageView the chat uses, fed a message part shaped exactly like the
 * tool's output. So it exercises parseQuestionCardPart, the assistant-item
 * switch, the stepper, the newest-card-wins rule, and composeAnswerMessage
 * together, and a change that breaks any of them breaks this page.
 *
 * What it does NOT cover: the eve round trip. Nothing here proves the model
 * calls the tool, that the answer message reaches a real turn, or that the
 * card survives streaming. Those need a signed-in session.
 *
 * Not linked from anywhere and returns 404 outside development.
 */

interface Scenario {
  id: string;
  label: string;
  questions: unknown[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "one",
    label: "One question, three options",
    questions: [
      {
        header: "Which child",
        question: "Who is the reading page for?",
        multiSelect: false,
        options: [
          { label: "Maya", description: "7, reading short chapter books" },
          { label: "Jordan", description: "9, wants harder work" },
          { label: "Skye", description: "4, sounding out letters" },
        ],
      },
    ],
  },
  {
    id: "multi",
    label: "Two questions, second is multi-select",
    questions: [
      {
        header: "Subject",
        question: "Where should we start with Maya?",
        multiSelect: false,
        options: [
          { label: "Phonics", description: "Short daily sound drills." },
          { label: "Reading aloud", description: null },
        ],
      },
      {
        header: "Days",
        question: "Which days work this week?",
        multiSelect: true,
        options: [
          { label: "Monday", description: null },
          { label: "Wednesday", description: null },
          { label: "Friday", description: null },
        ],
      },
    ],
  },
  {
    id: "long",
    label: "Long labels and descriptions (overflow check)",
    questions: [
      {
        header: "Pace",
        question:
          "How much should we take on for the rest of the month, given how tired everyone is?",
        multiSelect: false,
        options: [
          {
            label: "Keep the current plan and add one review day each week",
            description:
              "Nothing new gets introduced, and the review day absorbs anything that slipped.",
          },
          {
            label: "Lighten it",
            description: "Half the activities, same subjects, no catch-up expected.",
          },
        ],
      },
    ],
  },
];

function messageFor(scenario: Scenario): EveMessage {
  return {
    id: `bench-${scenario.id}`,
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "ask_user_questions",
        state: "output-available",
        output: { asked: true, questions: scenario.questions },
      },
    ],
  } as unknown as EveMessage;
}

export function ChoiceCardBench() {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [sent, setSent] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ReadonlyMap<string, string>>(new Map());
  const message = messageFor(scenario);
  const partKey = `${message.id}:0`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-strong">
          Choice card bench
        </h1>
        <p className="mt-1 text-sm text-muted">
          The real transcript renderer, fed the real tool output shape.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setScenario(option);
              setSent(null);
              setAnswers(new Map());
            }}
            className={`min-h-11 rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${
              option.id === scenario.id
                ? "border-brand bg-brand/5 text-strong"
                : "border-border bg-page text-muted hover:border-brand"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <MessageView
        message={message}
        timeZone="America/Los_Angeles"
        activeQuestionPartKey={sent === null ? partKey : undefined}
        onSendQuestionAnswers={(text) => {
          setSent(text);
          setAnswers(new Map([[partKey, text]]));
        }}
        onQuestionTypeInstead={() => setSent("(composer focused)")}
        questionAnswers={answers}
      />

      <div className="rounded-lg border border-border-subtle bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
          Message that would be sent
        </p>
        <pre
          data-testid="composed"
          className="mt-2 whitespace-pre-wrap break-words text-sm text-strong"
        >
          {sent ?? "(nothing yet)"}
        </pre>
      </div>
    </main>
  );
}
