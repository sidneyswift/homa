import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MapAnswer } from "@homa/core";

import { isProgressEvidenceAnswer } from "./evidence-policy";
import type { ProgressEvidenceAnswer } from "./types";

function narrowProgressEvidenceAnswer(
  answer: MapAnswer,
): ProgressEvidenceAnswer | null {
  return isProgressEvidenceAnswer(answer) ? answer : null;
}

describe("progress evidence answer policy", () => {
  it("accepts only answers that describe skill progress", () => {
    assert.equal(isProgressEvidenceAnswer("easily"), true);
    assert.equal(isProgressEvidenceAnswer("getting_there"), true);
    assert.equal(isProgressEvidenceAnswer("not_yet"), true);
    assert.equal(isProgressEvidenceAnswer("not_sure"), false);
    assert.equal(isProgressEvidenceAnswer("skip"), false);
  });

  it("narrows accepted answers to the evidence-answer type", () => {
    assert.equal(narrowProgressEvidenceAnswer("easily"), "easily");
    assert.equal(narrowProgressEvidenceAnswer("skip"), null);
  });
});
