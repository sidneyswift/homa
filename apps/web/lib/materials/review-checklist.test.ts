import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RecipeChecklistItem } from "./recipe-checklist";
import { verifyChecklistAnswers } from "./review-checklist";

/**
 * The deterministic verifier behind the recipe checklist review. A
 * letter-formation page shipped too small to trace (2026-09-02) because
 * the reviewer had no structural spec to answer against; now it answers
 * each recipe item with a closed enum and this code decides what the
 * answers mean. Every rule here is one way a model answer could be
 * misread into either a false block or a silent pass.
 */

const ITEMS: readonly RecipeChecklistItem[] = [
  {
    id: "trace-box-count",
    severity: "blocking",
    check: "Exactly four trace boxes sit in one row under the model box.",
  },
  {
    id: "fade-order",
    severity: "advisory",
    check: "Support fades left to right across the trace row.",
  },
];

describe("verifyChecklistAnswers", () => {
  it("passes an empty checklist through untouched", () => {
    const verdict = verifyChecklistAnswers([], undefined);
    assert.deepEqual(verdict, { pass: true, issues: [], advisory: [], answers: [] });
  });

  it("passes when every item is answered yes", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.deepEqual(verdict.advisory, []);
  });

  it("fails on a blocking no and words the issue for the composer", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "no", note: "Page 1 shows three boxes." },
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, false);
    assert.deepEqual(verdict.issues, [
      "Checklist (trace-box-count): Exactly four trace boxes sit in one row under the model box. Reviewer: Page 1 shows three boxes.",
    ]);
    assert.deepEqual(verdict.advisory, []);
  });

  it("keeps an advisory no out of the blocking issues", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "no", note: "All four boxes are solid." },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.equal(verdict.advisory.length, 1);
    assert.match(verdict.advisory[0], /^Checklist \(fade-order\): Support fades/);
    assert.match(verdict.advisory[0], /Reviewer: All four boxes are solid\./);
  });

  it("treats a missing answer as cannot_tell, recorded as advisory, never a failure", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.deepEqual(verdict.advisory, [
      "Checklist (trace-box-count) could not be confirmed from the image.",
    ]);
    assert.equal(verdict.answers[0].answer, "cannot_tell");
  });

  it("records an explicit cannot_tell with its note as advisory on either severity", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "cannot_tell", note: "The boxes are too faint to count." },
      { id: "fade-order", answer: "cannot_tell", note: "" },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.advisory, [
      "Checklist (trace-box-count) could not be confirmed from the image: The boxes are too faint to count.",
      "Checklist (fade-order) could not be confirmed from the image.",
    ]);
  });

  it("drops answers for ids that are not checklist items", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "yes", note: "" },
      { id: "made-up-item", answer: "no", note: "This id was never on the list." },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.deepEqual(verdict.answers.map((answer) => answer.id), ["trace-box-count", "fade-order"]);
  });

  it("lets the first answer for an id win over a later duplicate", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "no", note: "Three boxes." },
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, false);
    assert.equal(verdict.answers[0].answer, "no");
  });

  it("joins each answer to the item's severity and check text for the durable record", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "no", note: "Solid throughout." },
    ]);
    assert.deepEqual(verdict.answers, [
      {
        id: "trace-box-count",
        answer: "yes",
        note: "",
        severity: "blocking",
        check: "Exactly four trace boxes sit in one row under the model box.",
      },
      {
        id: "fade-order",
        answer: "no",
        note: "Solid throughout.",
        severity: "advisory",
        check: "Support fades left to right across the trace row.",
      },
    ]);
  });

  it("carries the Checklist (<id>) prefix the skill tells Homa to look for", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "no", note: "" },
    ]);
    assert.match(verdict.issues[0], /^Checklist \(trace-box-count\): /);
    assert.doesNotMatch(verdict.issues[0], /Reviewer:/, "no empty Reviewer clause");
  });
});
