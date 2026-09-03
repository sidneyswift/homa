import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RecipeChecklistItem } from "./recipe-checklist";
import {
  CHECKLIST_NOTE_MAX_CHARS,
  verifyChecklistAnswers,
} from "./review-checklist";

/**
 * The deterministic verifier behind the recipe checklist review. A
 * letter-formation page shipped too small to trace (2026-09-02) because
 * the reviewer had no structural spec to answer against; now it answers
 * each recipe item with a closed enum and this code decides what the
 * answers mean. Every rule here is one way a model answer could be
 * misread into either a false block or a silent pass, and every relayed
 * string is checked for the internal label a parent must never read.
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
    assert.deepEqual(verdict, {
      pass: true,
      issues: [],
      advisory: [],
      unconfirmed: [],
      answers: [],
      duplicateIds: [],
    });
  });

  it("passes when every item is answered yes", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.deepEqual(verdict.advisory, []);
    assert.deepEqual(verdict.unconfirmed, []);
  });

  it("fails on a blocking no and labels the issue for the composer", () => {
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

  it("keeps an advisory no out of the blocking issues and out of the internal label", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "no", note: "All four boxes are solid." },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.deepEqual(verdict.advisory, [
      "Support fades left to right across the trace row. Reviewer: All four boxes are solid.",
    ]);
    assert.doesNotMatch(verdict.advisory[0], /Checklist \(/, "relayed text carries no internal label");
  });

  it("stores a missing answer as unanswered, distinct from cannot_tell, and never fails on it", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.issues, []);
    assert.equal(verdict.answers[0].answer, "unanswered");
    assert.deepEqual(verdict.unconfirmed, [
      "Exactly four trace boxes sit in one row under the model box.",
    ]);
  });

  it("stores an explicit cannot_tell as cannot_tell and carries the plain check as unconfirmed", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "cannot_tell", note: "The boxes are too faint to count." },
      { id: "fade-order", answer: "cannot_tell", note: "" },
    ]);
    assert.equal(verdict.pass, true);
    assert.deepEqual(
      verdict.answers.map((answer) => answer.answer),
      ["cannot_tell", "cannot_tell"],
    );
    assert.deepEqual(verdict.unconfirmed, [
      "Exactly four trace boxes sit in one row under the model box.",
      "Support fades left to right across the trace row.",
    ]);
    for (const text of verdict.unconfirmed) {
      assert.doesNotMatch(text, /Checklist \(/);
    }
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
    assert.deepEqual(verdict.duplicateIds, [], "an unknown id is not a duplicate");
  });

  it("lets the first answer for an id win and records the id as a duplicate", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "no", note: "Three boxes." },
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "trace-box-count", answer: "yes", note: "" },
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, false);
    assert.equal(verdict.answers[0].answer, "no");
    assert.deepEqual(verdict.duplicateIds, ["trace-box-count"]);
  });

  it("truncates an overlong note in code instead of failing the review", () => {
    const longNote = "x".repeat(CHECKLIST_NOTE_MAX_CHARS + 50);
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "no", note: longNote },
      { id: "fade-order", answer: "yes", note: "" },
    ]);
    assert.equal(verdict.pass, false);
    assert.equal(verdict.answers[0].note.length, CHECKLIST_NOTE_MAX_CHARS);
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

  it("carries the Checklist (<id>) prefix only on blocking issues, with no empty Reviewer clause", () => {
    const verdict = verifyChecklistAnswers(ITEMS, [
      { id: "trace-box-count", answer: "no", note: "" },
    ]);
    assert.match(verdict.issues[0], /^Checklist \(trace-box-count\): /);
    assert.doesNotMatch(verdict.issues[0], /Reviewer:/, "no empty Reviewer clause");
  });
});
