import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS } from "./bank";
import {
  selectSubjectLessonTarget,
  selectSubjectPlanTargets,
} from "./lesson-target";
import { buildFourWeekPlan } from "./plans";

function getMathSubject() {
  const subject = MAP_SUBJECTS.find((entry) => entry.id === "math");
  assert.ok(subject);
  return subject;
}

describe("selectSubjectLessonTarget", () => {
  it("uses a named not-yet frontier when no lower skill is confirmed", () => {
    const subject = getMathSubject();
    const frontier = subject.items[10];
    const lesson = selectSubjectLessonTarget("math", 96, [
      { itemId: frontier.id, answer: "not_yet" },
    ]);

    assert.ok(lesson);
    assert.equal(lesson.targetItemId, frontier.id);
    assert.equal(lesson.targetStatement, frontier.statement);
    assert.equal(lesson.startingLine, null);
    assert.deepEqual(lesson.determinantAnswers, [
      { itemId: frontier.id, answer: "not_yet" },
    ]);
  });

  it("returns the next rung after the confirmed starting line", () => {
    const subject = getMathSubject();
    const confirmed = subject.items[0];
    const next = subject.items[1];
    const lesson = selectSubjectLessonTarget("math", 96, [
      { itemId: confirmed.id, answer: "easily" },
    ]);

    assert.ok(lesson);
    assert.equal(lesson.startingLine, confirmed.statement);
    assert.equal(lesson.targetItemId, next.id);
    assert.equal(lesson.targetStatement, next.statement);
  });

  it("returns the reviewed depth target when every item is confirmed", () => {
    const subject = getMathSubject();
    const lesson = selectSubjectLessonTarget(
      "math",
      204,
      subject.items.map((item) => ({ itemId: item.id, answer: "easily" }))
    );

    assert.ok(lesson);
    assert.equal(lesson.targetItemId, null);
    assert.equal(
      lesson.targetStatement,
      "Going wider in math: past every benchmark on file"
    );
    assert.equal(
      lesson.startingLine,
      subject.items[subject.items.length - 1].statement
    );
  });

  it("returns null for an unknown subject", () => {
    assert.equal(selectSubjectLessonTarget("unknown", 96, []), null);
  });

  it("returns the same first target used by the legacy plan", () => {
    const subject = getMathSubject();
    const answers = [
      { itemId: subject.items[0].id, answer: "easily" as const },
      { itemId: subject.items[1].id, answer: "not_yet" as const },
    ];
    const lesson = selectSubjectLessonTarget("math", 96, answers);
    const plan = buildFourWeekPlan("math", 96, answers);

    assert.ok(lesson);
    assert.ok(plan);
    assert.equal(lesson.targetStatement, plan.targets[0]);
    assert.equal(lesson.targetItemId, subject.items[1].id);
  });

  it("keeps only the single confirmation that determines the effective floor", () => {
    const subject = getMathSubject();
    const lowerConfirmed = subject.items[0];
    const effectiveConfirmed = subject.items[2];
    const laterNotYet = subject.items[8];
    const laterSkip = subject.items[9];
    const lesson = selectSubjectLessonTarget("math", 120, [
      { itemId: lowerConfirmed.id, answer: "easily" },
      { itemId: effectiveConfirmed.id, answer: "getting_there" },
      { itemId: laterNotYet.id, answer: "not_yet" },
      { itemId: laterSkip.id, answer: "skip" },
    ]);

    assert.ok(lesson);
    assert.deepEqual(lesson.determinantAnswers, [
      { itemId: effectiveConfirmed.id, answer: "getting_there" },
    ]);
  });

  it("breaks equal effective-floor ties deterministically", () => {
    const subject = getMathSubject();
    const pair = subject.items.flatMap((gettingThere) =>
      subject.items
        .filter(
          (easily) =>
            easily.typicalMonths === gettingThere.typicalMonths - 6,
        )
        .map((easily) => ({ easily, gettingThere })),
    )[0];
    assert.ok(pair);

    const first = selectSubjectLessonTarget("math", 120, [
      { itemId: pair.easily.id, answer: "easily" },
      { itemId: pair.gettingThere.id, answer: "getting_there" },
    ]);
    const reordered = selectSubjectLessonTarget("math", 120, [
      { itemId: pair.gettingThere.id, answer: "getting_there" },
      { itemId: pair.easily.id, answer: "easily" },
    ]);

    assert.ok(first);
    assert.ok(reordered);
    assert.deepEqual(first.determinantAnswers, [
      { itemId: pair.gettingThere.id, answer: "getting_there" },
    ]);
    assert.deepEqual(reordered.determinantAnswers, first.determinantAnswers);
  });

  it("keeps only the lowest not-yet answer when nothing is confirmed", () => {
    const subject = getMathSubject();
    const lowestNotYet = subject.items[5];
    const laterNotYet = subject.items[9];
    const lesson = selectSubjectLessonTarget("math", 120, [
      { itemId: lowestNotYet.id, answer: "not_yet" },
      { itemId: laterNotYet.id, answer: "not_yet" },
      { itemId: subject.items[10].id, answer: "not_sure" },
    ]);

    assert.ok(lesson);
    assert.equal(lesson.targetItemId, lowestNotYet.id);
    assert.deepEqual(lesson.determinantAnswers, [
      { itemId: lowestNotYet.id, answer: "not_yet" },
    ]);
  });

  it("preserves first-target parity after irrelevant answers change", () => {
    const subject = getMathSubject();
    const confirmed = subject.items[1];
    const baseAnswers = [{ itemId: confirmed.id, answer: "easily" as const }];
    const changedAnswers = [
      ...baseAnswers,
      { itemId: subject.items[8].id, answer: "not_yet" as const },
      { itemId: subject.items[9].id, answer: "skip" as const },
      { itemId: subject.items[10].id, answer: "not_sure" as const },
    ];

    const before = selectSubjectLessonTarget("math", 120, baseAnswers);
    const after = selectSubjectLessonTarget("math", 120, changedAnswers);
    const plan = buildFourWeekPlan("math", 120, changedAnswers);

    assert.ok(before);
    assert.ok(after);
    assert.ok(plan);
    assert.equal(after.targetStatement, before.targetStatement);
    assert.deepEqual(after.determinantAnswers, before.determinantAnswers);
    assert.equal(after.targetStatement, plan.targets[0]);
  });
});

describe("selectSubjectPlanTargets", () => {
  it("keeps the two-rung target walk used by four-week plans", () => {
    const subject = getMathSubject();
    const selection = selectSubjectPlanTargets("math", 96, [
      { itemId: subject.items[0].id, answer: "easily" },
    ]);

    assert.deepEqual(selection, {
      startingLine: subject.items[0].statement,
      targets: [subject.items[1].statement, subject.items[2].statement],
    });
  });
});
