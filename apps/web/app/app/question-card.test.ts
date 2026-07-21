import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import {
  cardSignature,
  composeAnswerMessage,
  latestQuestionRequest,
  parseQuestionCardPart,
  type QuestionCardQuestion,
} from "./question-card";

function askPart(output: unknown): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName: "ask_user_questions",
    state: "output-available",
    output,
  } as unknown as EveMessagePart;
}

const ONE_QUESTION = {
  asked: true,
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
  ],
};

function message(id: string, role: string, parts: EveMessagePart[]): EveMessage {
  return { id, role, parts } as unknown as EveMessage;
}

describe("parseQuestionCardPart", () => {
  it("reads a well formed ask", () => {
    const card = parseQuestionCardPart(askPart(ONE_QUESTION));
    assert.equal(card?.questions.length, 1);
    assert.equal(card?.questions[0].question, "Where should we start with Maya?");
    assert.equal(card?.questions[0].options.length, 2);
    assert.equal(card?.questions[0].options[0].description, "Short daily sound drills.");
    assert.equal(card?.questions[0].options[1].description, null);
    assert.equal(card?.questions[0].multiSelect, false);
  });

  it("ignores output carrying no questions", () => {
    assert.equal(parseQuestionCardPart(askPart({ note: "Nothing to ask." })), null);
  });

  it("ignores another tool's output", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "ask_for_photo",
      state: "output-available",
      output: { requested: true, question: "Can you show me?" },
    } as unknown as EveMessagePart;
    assert.equal(parseQuestionCardPart(part), null);
  });

  it("drops a question whose options never arrived", () => {
    const card = parseQuestionCardPart(
      askPart({
        asked: true,
        questions: [
          { header: "Pace", question: "How fast?", options: [] },
          ONE_QUESTION.questions[0],
        ],
      }),
    );
    assert.equal(card?.questions.length, 1);
    assert.equal(card?.questions[0].header, "Subject");
  });

  it("returns null when a streaming part has no output yet", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "ask_user_questions",
      state: "input-available",
    } as unknown as EveMessagePart;
    assert.equal(parseQuestionCardPart(part), null);
  });
});

function question(
  header: string,
  labels: string[],
  multiSelect = false,
): QuestionCardQuestion {
  return {
    header,
    question: `${header}?`,
    multiSelect,
    options: labels.map((label) => ({ label, description: null })),
  };
}

describe("composeAnswerMessage", () => {
  it("sends one answer as the bare words a person would type", () => {
    const asked = [question("Subject", ["Phonics", "Reading aloud"])];
    assert.equal(composeAnswerMessage(asked, [["Phonics"]]), "Phonics");
  });

  it("labels each answer once there is more than one question", () => {
    const asked = [
      question("Subject", ["Phonics"]),
      question("Pace", ["Gentle"]),
    ];
    assert.equal(
      composeAnswerMessage(asked, [["Phonics"], ["Gentle"]]),
      "Subject: Phonics\nPace: Gentle",
    );
  });

  it("joins a multi-select pick without recasing the labels", () => {
    // "Maya" must survive verbatim: recasing a name to fit a sentence
    // would corrupt it.
    const asked = [question("Who", ["Maya", "Jordan", "Skye"], true)];
    assert.equal(
      composeAnswerMessage(asked, [["Maya", "Jordan", "Skye"]]),
      "Maya, Jordan and Skye",
    );
  });

  it("says no preference for a skip, so Homa does not just ask again", () => {
    const asked = [question("Subject", ["Phonics"])];
    assert.equal(composeAnswerMessage(asked, [[]]), "No preference");
  });

  it("keeps a skip readable beside a real answer", () => {
    const asked = [
      question("Subject", ["Phonics"]),
      question("Pace", ["Gentle"]),
    ];
    assert.equal(
      composeAnswerMessage(asked, [["Phonics"], []]),
      "Subject: Phonics\nPace: no preference",
    );
  });

  it("still says something when she skips every question", () => {
    // Skipping everything means proceed without me, not silence.
    const asked = [question("Subject", ["Phonics"]), question("Pace", ["Gentle"])];
    const message = composeAnswerMessage(asked, [[], []]);
    assert.equal(message, "Subject: no preference\nPace: no preference");
    assert.notEqual(message.trim(), "");
  });

  it("drops the label when a question arrived without a header", () => {
    const asked = [question("", ["Phonics"]), question("Pace", ["Gentle"])];
    assert.equal(
      composeAnswerMessage(asked, [["Phonics"], ["Gentle"]]),
      "Phonics\nPace: Gentle",
    );
  });
});

describe("latestQuestionRequest", () => {
  it("finds the only card", () => {
    const active = latestQuestionRequest([
      message("a", "assistant", [askPart(ONE_QUESTION)]),
    ]);
    assert.equal(active?.partKey, "a:0");
  });

  it("goes quiet once she has answered", () => {
    const active = latestQuestionRequest([
      message("a", "assistant", [askPart(ONE_QUESTION)]),
      message("b", "user", [{ type: "text", text: "Phonics" } as EveMessagePart]),
    ]);
    assert.equal(active, null);
  });

  it("keeps only the newest card live", () => {
    const active = latestQuestionRequest([
      message("a", "assistant", [askPart(ONE_QUESTION)]),
      message("b", "user", [{ type: "text", text: "Phonics" } as EveMessagePart]),
      message("c", "assistant", [askPart(ONE_QUESTION)]),
    ]);
    assert.equal(active?.partKey, "c:0");
  });

  it("has nothing live in a transcript with no ask", () => {
    assert.equal(
      latestQuestionRequest([
        message("a", "assistant", [{ type: "text", text: "Hi" } as EveMessagePart]),
      ]),
      null,
    );
  });
});

describe("cardSignature", () => {
  // The reset key behind a dead-tap bug found by clicking the real card:
  // useState's initializer runs once, so a card arriving with a different
  // question count left the answer slots at the old length and every tap
  // silently did nothing. The signature has to notice that change.
  const one = { questions: [question("Subject", ["Phonics"])] };
  const two = {
    questions: [question("Subject", ["Phonics"]), question("Days", ["Monday"])],
  };

  it("changes when the question count changes", () => {
    assert.notEqual(cardSignature(one), cardSignature(two));
  });

  it("changes when the options change under the same question", () => {
    assert.notEqual(
      cardSignature({ questions: [question("Subject", ["Phonics"])] }),
      cardSignature({ questions: [question("Subject", ["Reading aloud"])] }),
    );
  });

  it("changes when multi-select flips", () => {
    assert.notEqual(
      cardSignature({ questions: [question("Days", ["Monday"], false)] }),
      cardSignature({ questions: [question("Days", ["Monday"], true)] }),
    );
  });

  it("is stable for the same ask, so state survives a re-render", () => {
    assert.equal(cardSignature(two), cardSignature(two));
  });
});
