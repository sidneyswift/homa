import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import {
  cardSignature,
  composeAnswerMessage,
  latestQuestionRequest,
  parseQuestionCardPart,
  type QuestionCardQuestion,
} from "./question-card-model";

/**
 * The mobile twin of apps/web/app/app/question-card.test.ts. Same cases
 * on purpose: the message a parent's taps compose must read the same
 * whether she tapped on the phone or in the browser, so a change to one
 * card that does not change the other should turn this suite red.
 *
 * Run it with `pnpm check:mobile-chat`. This is the app's first node
 * test, and tsconfig.json excludes `*.test.ts` from `tsc --noEmit` on
 * purpose: typing `node:test` would mean adding @types/node to a client
 * app, which pulls Node globals into every screen's type environment and
 * re-resolves the workspace lockfile. The runner is the check here.
 */

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
    assert.equal(
      card?.questions[0].options[0].description,
      "Short daily sound drills.",
    );
    assert.equal(card?.questions[0].options[1].description, null);
    assert.equal(card?.questions[0].multiSelect, false);
  });

  it("ignores output carrying no questions", () => {
    assert.equal(parseQuestionCardPart(askPart({ note: "Nothing to ask." })), null);
  });

  it("ignores another tool's output", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "create_printable",
      state: "output-available",
      output: { material: { previewUrl: "https://example.test/p.png" } },
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

  it("never throws on an unexpected shape", () => {
    // Anything the transcript can hand it renders as no card, not as a
    // crashed chat screen.
    const shapes: unknown[] = [
      null,
      "questions",
      42,
      { asked: true, questions: "one" },
      { asked: true, questions: [null, 7, "x"] },
      { asked: true, questions: [{ question: "", options: [{ label: "" }] }] },
      { asked: true, questions: [{ question: "Pick", options: [{}, 3] }] },
      { asked: "yes", questions: ONE_QUESTION.questions },
    ];
    for (const shape of shapes) {
      assert.equal(parseQuestionCardPart(askPart(shape)), null);
    }
    assert.equal(
      parseQuestionCardPart({ type: "text", text: "Hi" } as EveMessagePart),
      null,
    );
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

  it("joins a pair of multi-select labels with a bare and", () => {
    const asked = [question("Who", ["Maya", "Jordan"], true)];
    assert.equal(
      composeAnswerMessage(asked, [["Maya", "Jordan"]]),
      "Maya and Jordan",
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
    const composed = composeAnswerMessage(asked, [[], []]);
    assert.equal(composed, "Subject: no preference\nPace: no preference");
    assert.notEqual(composed.trim(), "");
  });

  it("drops the label when a question arrived without a header", () => {
    const asked = [question("", ["Phonics"]), question("Pace", ["Gentle"])];
    assert.equal(
      composeAnswerMessage(asked, [["Phonics"], ["Gentle"]]),
      "Phonics\nPace: Gentle",
    );
  });

  it("treats a missing answer slot as a skip", () => {
    const asked = [question("Subject", ["Phonics"])];
    assert.equal(composeAnswerMessage(asked, []), "No preference");
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

  it("keys the card by its part index, so a later part wins", () => {
    // The partKey the transcript builds is `${message.id}:${index}`;
    // message-view.tsx has to agree with this or no card takes taps.
    const active = latestQuestionRequest([
      message("a", "assistant", [
        { type: "text", text: "Two ways to go here." } as EveMessagePart,
        askPart(ONE_QUESTION),
      ]),
    ]);
    assert.equal(active?.partKey, "a:1");
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
  // Guards the same dead-tap bug web hit: a card arriving with a different
  // question count must reset its answer slots, or every tap does nothing.
  const q = (header: string, labels: string[], multiSelect = false) => ({
    header,
    question: `${header}?`,
    multiSelect,
    options: labels.map((label) => ({ label, description: null })),
  });

  it("changes when the question count changes", () => {
    assert.notEqual(
      cardSignature({ questions: [q("Subject", ["Phonics"])] }),
      cardSignature({
        questions: [q("Subject", ["Phonics"]), q("Days", ["Monday"])],
      }),
    );
  });

  it("is stable for the same ask, so state survives a re-render", () => {
    const card = { questions: [q("Days", ["Monday", "Friday"], true)] };
    assert.equal(cardSignature(card), cardSignature(card));
  });
});
