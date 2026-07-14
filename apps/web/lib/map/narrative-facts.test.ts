import assert from "node:assert/strict";
import { test } from "node:test";

import { planQuestions, scoreMap, type MapAnswerInput } from "@homa/core";

import {
  allowedNumbersFrom,
  buildReportFacts,
  buildRescoreFacts,
  type ChangedAnswerFactInput,
} from "./narrative-facts";

/**
 * The rescore facts block (founder ask 2026-07-14): after a deeper
 * look or a correction, the writer receives WHY the rewrite exists and
 * the before/after readings, computed by code. These tests pin the
 * derivation; the prompt rules live in agent/report-writer.md.
 */

const AGE = 50;

const plans = planQuestions(AGE);
const baseAnswers: MapAnswerInput[] = plans.map((plan) => ({
  itemId: plan.base.id,
  answer: "getting_there" as const,
}));
const priorScores = scoreMap(AGE, baseAnswers);

const languagePlan = plans.find((plan) => plan.subjectId === "language");
assert.ok(languagePlan, "the bank has a language plan at 50 months");

const newAnswers: MapAnswerInput[] = baseAnswers.map((entry) =>
  entry.itemId === languagePlan.base.id ? { ...entry, answer: "easily" as const } : entry,
);
const currentScores = scoreMap(AGE, newAnswers);

const deepDiveChange: ChangedAnswerFactInput = {
  itemId: languagePlan.base.id,
  answer: "easily",
  previousAnswer: "getting_there",
  source: "deep_dive",
};

test("a deeper look produces a rescore block with reason, receipts, and shifts", () => {
  const rescore = buildRescoreFacts([deepDiveChange], currentScores, priorScores, "Maya");
  assert.ok(rescore, "rescore block exists");
  assert.match(rescore.reasonLine, /deeper/i);
  assert.match(rescore.reasonLine, /language/i);
  assert.equal(rescore.changedAnswers.length, 1);
  assert.equal(rescore.changedAnswers[0].was, "Getting there");
  assert.equal(rescore.changedAnswers[0].now, "Easily");
  assert.equal(rescore.changedAnswers[0].subjectName, "Language");
  const shift = rescore.subjectShifts.find((entry) => entry.subjectName === "Language");
  assert.ok(shift, "the changed subject gets a before/after row");
  assert.ok(shift.was.length > 0 && shift.now.length > 0);
});

test("a correction source names the correction, not a deeper look", () => {
  const rescore = buildRescoreFacts(
    [{ ...deepDiveChange, source: "report_correction" }],
    currentScores,
    priorScores,
    "Maya",
  );
  assert.ok(rescore);
  assert.match(rescore.reasonLine, /corrected/i);
  assert.doesNotMatch(rescore.reasonLine, /deeper/i);
});

test("first reports and unchanged rescores carry no rescore block", () => {
  assert.equal(buildRescoreFacts([deepDiveChange], currentScores, null, "Maya"), null);
  assert.equal(buildRescoreFacts([], currentScores, priorScores, "Maya"), null);
});

test("evidence outside the question bank never fabricates a block", () => {
  const rescore = buildRescoreFacts(
    [{ ...deepDiveChange, itemId: "graph.some-walk-topic" }],
    currentScores,
    priorScores,
    "Maya",
  );
  assert.equal(rescore, null);
});

test("buildReportFacts threads the changes through and allows their numbers", () => {
  const input = {
    childName: "Maya",
    birthMonth: "2022-05-01",
    parentFirstName: "Sarah",
    interests: [],
    helpWith: [],
    whatsWorkingBySubject: {},
    scores: currentScores,
    answers: newAnswers,
    history: [{ scores: priorScores, generated_at: new Date().toISOString() }],
    changedSinceLastScoring: [deepDiveChange],
  };
  const facts = buildReportFacts(input);
  assert.ok(facts.rescore, "facts carry the rescore block");
  const allowed = allowedNumbersFrom(facts);
  for (const digits of facts.rescore.reasonLine.match(/\d+/g) ?? []) {
    assert.ok(allowed.includes(digits), `reason number ${digits} is gate-allowed`);
  }

  const first = buildReportFacts({ ...input, history: [], changedSinceLastScoring: [] });
  assert.equal(first.rescore, null);
});
