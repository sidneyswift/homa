import assert from "node:assert/strict";
import { test } from "node:test";

import { conversationQuestionText, parseConversationQuestionResult } from "./conversation-question-card";

const output = { asked: true, note: "private implementation note", questions: [{ header: "Format",
  question: "What would help?", multiSelect: false,
  options: [{ label: "A worksheet", description: "To print" }, { label: "A game", description: null }] }] };
const event = { data: { status: "completed", sequence: 4, stepIndex: 2,
  result: { kind: "tool-result", toolName: "ask_user_questions", callId: "question-call", output } } };

test("confirmed card retains choices and source identity, strips unrelated output", () => {
  const parsed = parseConversationQuestionResult(event)!;
  assert.deepEqual(parsed, { callId: "question-call", sourceSequence: 4, stepIndex: 2, card: { questions: output.questions } });
  assert.equal(conversationQuestionText(parsed.card), "What would help?\nA worksheet: To print\nA game");
});

test("unrelated, rejected and failed tool output cannot become a parent question", () => {
  assert.equal(parseConversationQuestionResult(null), null);
  for (const result of [{ ...event.data.result, toolName: "other_tool" }, { ...event.data.result, isError: true }]) {
    assert.equal(parseConversationQuestionResult({ data: { ...event.data, result } }), null);
  }
  assert.equal(parseConversationQuestionResult({ data: { ...event.data, status: "failed" } }), null);
});

test("confirmed malformed output or source fails rather than silently dropping the question", () => {
  for (const changes of [{ sequence: -1 }, { sequence: undefined }, { stepIndex: 1.5 },
    { result: { ...event.data.result, callId: "" } },
    { result: { ...event.data.result, callId: "invalid\0source" } },
    { result: { ...event.data.result, output: { ...output, asked: false } } },
    { result: { ...event.data.result, output: { ...output, questions: [] } } },
    { result: { ...event.data.result, output: { ...output, questions: [{ ...output.questions[0], question: "bad\0text" }] } } }]) {
    assert.throws(() => parseConversationQuestionResult({ data: { ...event.data, ...changes } }));
  }
});
