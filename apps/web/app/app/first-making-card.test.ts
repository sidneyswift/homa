import assert from "node:assert/strict";
import test from "node:test";

import type { EveMessagePart } from "eve/react";

import { parseFirstMakingCardPart } from "./onboarding-cards";

function makingPart(output: Record<string, unknown>): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName: "start_first_making",
    state: "output-available",
    output,
  } as unknown as EveMessagePart;
}

const goodOutput = {
  started: true,
  alreadyStarted: false,
  jobId: "3c6a34d2-5b7e-4a0f-9a51-2f9d7c1e8b40",
  childId: "9f3b1a68-2d4c-4e5f-8a7b-6c5d4e3f2a1b",
  childName: "Mia",
  title: "Mia's dinosaur coloring page",
};

test("a started making parses into card data", () => {
  const card = parseFirstMakingCardPart(makingPart(goodOutput));
  assert.ok(card);
  assert.equal(card.jobId, goodOutput.jobId);
  assert.equal(card.childName, "Mia");
  assert.equal(card.title, "Mia's dinosaur coloring page");
  assert.equal(card.alreadyStarted, false);
});

test("a refused start renders no card", () => {
  const card = parseFirstMakingCardPart(
    makingPart({ started: false, note: "flag off" }),
  );
  assert.equal(card, null);
});

test("a result missing its job id renders no card", () => {
  const { jobId: _jobId, ...withoutJob } = goodOutput;
  assert.equal(parseFirstMakingCardPart(makingPart(withoutJob)), null);
});

test("other tools and unfinished parts never parse", () => {
  const otherTool = {
    ...makingPart(goodOutput),
    toolName: "create_printable",
  } as unknown as EveMessagePart;
  assert.equal(parseFirstMakingCardPart(otherTool), null);

  const streaming = {
    type: "dynamic-tool",
    toolName: "start_first_making",
    state: "input-available",
  } as unknown as EveMessagePart;
  assert.equal(parseFirstMakingCardPart(streaming), null);
});

test("an already-started making still parses, flagged", () => {
  const card = parseFirstMakingCardPart(
    makingPart({ ...goodOutput, alreadyStarted: true }),
  );
  assert.ok(card);
  assert.equal(card.alreadyStarted, true);
});
