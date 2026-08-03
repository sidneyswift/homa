import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import {
  birthDateFromParts,
  checklistPositionFor,
  latestDetailRequest,
  parseChecklistCardPart,
  parseDetailCardPart,
  parseFirstMakingCardPart,
  parseReportCardPart,
  withChecklistAnswer,
} from "./onboarding-card-model";

function tool(toolName: string, output: Record<string, unknown>): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName,
    state: "output-available",
    toolCallId: `call-${toolName}`,
    input: {},
    output,
  } as unknown as EveMessagePart;
}

describe("mobile onboarding card parsers", () => {
  it("accepts complete checklist, detail, and report results", () => {
    assert.equal(parseChecklistCardPart(tool("start_checklist", {
      started: true,
      childId: "child-1",
      childName: "Mia",
    }))?.childName, "Mia");
    assert.equal(parseDetailCardPart(tool("ask_for_details", {
      asked: true,
      kind: "child",
    }))?.kind, "child");
    assert.equal(parseReportCardPart(tool("score_child_report", {
      scored: true,
      childId: "child-1",
      childName: "Mia",
      token: "report-token",
    }))?.token, "report-token");
    assert.equal(parseFirstMakingCardPart(tool("start_first_making", {
      started: true,
      jobId: "job-1",
      childId: "child-1",
      childName: "Mia",
      title: "Mia's dinosaur page",
    }))?.title, "Mia's dinosaur page");
  });

  it("rejects refusals and malformed outputs", () => {
    assert.equal(parseChecklistCardPart(tool("start_checklist", { started: false })), null);
    assert.equal(parseDetailCardPart(tool("ask_for_details", { asked: true, kind: "unknown" })), null);
    assert.equal(parseReportCardPart(tool("score_child_report", { scored: true })), null);
    assert.equal(parseFirstMakingCardPart(tool("start_first_making", {
      started: true,
      childId: "child-1",
    })), null);
  });

  it("settles a detail card after the next user message", () => {
    const assistant = {
      id: "assistant-1",
      role: "assistant",
      parts: [tool("ask_for_details", { asked: true, kind: "family_basics" })],
    } as unknown as EveMessage;
    assert.equal(latestDetailRequest([assistant])?.partKey, "assistant-1:0");
    assert.equal(latestDetailRequest([
      assistant,
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Done" }] } as EveMessage,
    ]), null);
  });
});

describe("mobile checklist state", () => {
  const child = {
    id: "child-1",
    name: "Mia",
    ageMonths: 72,
    inRange: true,
    reportToken: null,
    answered: 0,
    interests: [],
    helpWith: null,
    answers: [],
  };

  it("derives the current question from the shared bank", () => {
    const position = checklistPositionFor(child);
    assert.ok(position.currentItem);
    assert.ok(position.remaining > 0);
  });

  it("replaces an answer without inflating the count", () => {
    const itemId = checklistPositionFor(child).currentItem?.id;
    assert.ok(itemId);
    const once = withChecklistAnswer(child, itemId, "not_yet");
    const twice = withChecklistAnswer(once, itemId, "easily");
    assert.equal(twice.answered, 1);
    assert.equal(twice.answers[0]?.answer, "easily");
  });
});

describe("birthDateFromParts", () => {
  it("formats a real local calendar date", () => {
    assert.equal(
      birthDateFromParts({ year: "2019", month: "4", day: "7" }),
      "2019-04-07",
    );
  });

  it("rejects impossible dates", () => {
    assert.equal(
      birthDateFromParts({ year: "2019", month: "2", day: "31" }),
      null,
    );
  });
});
