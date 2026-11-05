import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { normalizeQuestionAnswer, renderQuestionAnswer } from "./conversation-question-answer";

const questionId = randomUUID();
const question = { header: "Activity", question: "Which activity?", multiSelect: false,
  options: [{ label: "Game", description: null }, { label: "Worksheet", description: null }] };

test("all choices are rendered from immutable stored options, including explicit skip", () => {
  const answer = normalizeQuestionAnswer({ questionId, answers: [{ question: 1, kind: "skip" },
    { question: 0, kind: "choice", options: [1, 0] }] });
  assert.equal(renderQuestionAnswer({ questions: [{ ...question, multiSelect: true }, question] }, answer),
    "Which activity?\nGame, Worksheet\n\nWhich activity?\nNo preference.");
});
test("duplicate, incomplete, unknown and forged choices fail closed", () => {
  for (const answers of [[], [{ question: 0, kind: "choice", options: [0, 0] }],
    [{ question: 0, kind: "skip" }, { question: 0, kind: "skip" }],
    [{ question: 0, kind: "choice", options: [0], label: "forged" }]]) {
    assert.throws(() => normalizeQuestionAnswer({ questionId, answers }));
  }
  for (const answers of [[{ question: 0, kind: "choice", options: [0, 1] }],
    [{ question: 0, kind: "choice", options: [3] }], [{ question: 1, kind: "skip" }]]) {
    assert.throws(() => renderQuestionAnswer({ questions: [question] }, normalizeQuestionAnswer({ questionId, answers })));
  }
  assert.throws(() => renderQuestionAnswer({ questions: [question, question] },
    normalizeQuestionAnswer({ questionId, answers: [{ question: 0, kind: "skip" }] })));
});
