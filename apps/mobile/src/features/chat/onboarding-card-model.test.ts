import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import {
  birthDateFromParts,
  checklistChaptersFor,
  checklistPositionFor,
  latestDetailRequest,
  parseChecklistCardPart,
  parseDetailCardPart,
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
  });

  it("rejects refusals and malformed outputs", () => {
    assert.equal(parseChecklistCardPart(tool("start_checklist", { started: false })), null);
    assert.equal(parseDetailCardPart(tool("ask_for_details", { asked: true, kind: "unknown" })), null);
    assert.equal(parseReportCardPart(tool("score_child_report", { scored: true })), null);
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

  it("asks first about what the parent said the child is working on", () => {
    const usual = checklistChaptersFor(child).chapters.map((chapter) => chapter.subjectId);
    assert.equal(usual[0], "math");
    const reading = { ...child, helpWith: "Reading" };
    assert.equal(checklistPositionFor(reading).currentItem?.id.split(".")[0], "literacy");
    const chapters = checklistChaptersFor(reading).chapters.map((chapter) => chapter.subjectId);
    assert.deepEqual(chapters.slice(0, 3), ["literacy", "phonics", "math"]);
    assert.deepEqual([...chapters].sort(), [...usual].sort());
  });
});

describe("checklistChaptersFor (D15 rechaptering)", () => {
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

  it("makes a chapter of every planned subject, first one current", () => {
    const position = checklistChaptersFor(child);
    assert.ok(position.totalChapters > 1);
    assert.equal(position.chapters.length, position.totalChapters);
    assert.equal(position.currentIndex, 1);
    assert.equal(position.chapters[0]?.state, "current");
    assert.ok(position.chapters.slice(1).every((chapter) => chapter.state === "upcoming"));
    assert.ok(position.chapters[0]?.subjectName.length > 0);
  });

  it("advances the current chapter when a subject closes", () => {
    // A non-easily answer ends the subject's ladder, so its chapter is
    // done and the next subject becomes current.
    const first = checklistPositionFor(child).currentItem;
    assert.ok(first);
    const after = withChecklistAnswer(child, first.id, "not_yet");
    const position = checklistChaptersFor(after);
    assert.equal(position.chapters[0]?.state, "done");
    assert.equal(position.chapters[0]?.answered, 1);
    assert.equal(position.currentIndex, 2);
  });

  it("keeps a chapter open while easily climbs its ladder", () => {
    const first = checklistPositionFor(child).currentItem;
    assert.ok(first);
    const after = withChecklistAnswer(child, first.id, "easily");
    const position = checklistChaptersFor(after);
    // The same subject either offers its next rung (still current) or,
    // with no rung to climb, closes; both are honest states, never a
    // fake fixed total.
    const firstChapter = position.chapters[0];
    assert.ok(firstChapter?.state === "current" || firstChapter?.state === "done");
    assert.equal(firstChapter?.answered, 1);
  });

  it("reports completion as a null current index", () => {
    // Answer every question the adaptive queue ever offers, non-easily,
    // so each subject closes at its base.
    let state = child;
    for (let guard = 0; guard < 200; guard += 1) {
      const item = checklistPositionFor(state).currentItem;
      if (!item) break;
      state = withChecklistAnswer(state, item.id, "getting_there");
    }
    const position = checklistChaptersFor(state);
    assert.equal(position.currentIndex, null);
    assert.ok(position.chapters.every((chapter) => chapter.state === "done"));
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
