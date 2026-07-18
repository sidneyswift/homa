import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS, selectSubjectLessonTarget } from "@homa/core";

import { lessonSourceFingerprint } from "./fingerprint";

const determinantAnswers = [
  { itemId: "math.counting-to-20", answer: "easily" as const },
  {
    itemId: "math.comparing-groups-more-or-fewer",
    answer: "getting_there" as const,
  },
];

describe("lessonSourceFingerprint", () => {
  it("is stable across object key and determinant answer order", () => {
    const first = lessonSourceFingerprint({
      subjectId: "math",
      targetItemId: "math.comparing-groups-more-or-fewer",
      targetStatement: "Compares two groups as more or fewer",
      startingLine: "Counts a group of objects to 20",
      bankVersion: "map-bank-test",
      determinantAnswers,
    });
    const reordered = lessonSourceFingerprint({
      determinantAnswers: [...determinantAnswers].reverse(),
      bankVersion: "map-bank-test",
      startingLine: "Counts a group of objects to 20",
      targetStatement: "Compares two groups as more or fewer",
      targetItemId: "math.comparing-groups-more-or-fewer",
      subjectId: "math",
    });

    assert.equal(first, reordered);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it("changes when a determinant answer changes", () => {
    const first = lessonSourceFingerprint({
      subjectId: "math",
      targetItemId: "math.comparing-groups-more-or-fewer",
      targetStatement: "Compares two groups as more or fewer",
      startingLine: "Counts a group of objects to 20",
      bankVersion: "map-bank-test",
      determinantAnswers,
    });
    const changedAnswer = lessonSourceFingerprint({
      subjectId: "math",
      targetItemId: "math.comparing-groups-more-or-fewer",
      targetStatement: "Compares two groups as more or fewer",
      startingLine: "Counts a group of objects to 20",
      bankVersion: "map-bank-test",
      determinantAnswers: [
        determinantAnswers[0],
        {
          itemId: determinantAnswers[1].itemId,
          answer: "not_yet",
        },
      ],
    });

    assert.notEqual(first, changedAnswer);
  });

  it("does not include changing interests in the source facts", () => {
    const firstInput = {
      subjectId: "math",
      targetItemId: "math.comparing-groups-more-or-fewer",
      targetStatement: "Compares two groups as more or fewer",
      startingLine: "Counts a group of objects to 20",
      bankVersion: "map-bank-test",
      determinantAnswers,
      interests: ["dinosaurs"],
    };
    const changedInterestInput = {
      ...firstInput,
      interests: ["space"],
    };

    assert.equal(
      lessonSourceFingerprint(firstInput),
      lessonSourceFingerprint(changedInterestInput)
    );
  });

  it("does not change for later skip, not-sure, or irrelevant not-yet answers", () => {
    const math = MAP_SUBJECTS.find((subject) => subject.id === "math");
    assert.ok(math);
    const confirmed = math.items[1];
    const baseAnswers = [{ itemId: confirmed.id, answer: "easily" as const }];
    const changedAnswers = [
      ...baseAnswers,
      { itemId: math.items[8].id, answer: "not_yet" as const },
      { itemId: math.items[9].id, answer: "skip" as const },
      { itemId: math.items[10].id, answer: "not_sure" as const },
    ];
    const before = selectSubjectLessonTarget("math", 120, baseAnswers);
    const after = selectSubjectLessonTarget("math", 120, changedAnswers);

    assert.ok(before);
    assert.ok(after);
    assert.equal(
      lessonSourceFingerprint({ subjectId: "math", ...before }),
      lessonSourceFingerprint({ subjectId: "math", ...after })
    );
  });

  it("does not change when lower confirmations change below the same effective floor", () => {
    const math = MAP_SUBJECTS.find((subject) => subject.id === "math");
    assert.ok(math);
    const effective = math.items[4];
    const lower = math.items[0];
    const before = selectSubjectLessonTarget("math", 120, [
      { itemId: effective.id, answer: "easily" },
    ]);
    const after = selectSubjectLessonTarget("math", 120, [
      { itemId: lower.id, answer: "getting_there" },
      { itemId: effective.id, answer: "easily" },
    ]);

    assert.ok(before);
    assert.ok(after);
    assert.equal(after.startingLine, before.startingLine);
    assert.equal(after.targetStatement, before.targetStatement);
    assert.deepEqual(after.determinantAnswers, before.determinantAnswers);
    assert.equal(
      lessonSourceFingerprint({ subjectId: "math", ...before }),
      lessonSourceFingerprint({ subjectId: "math", ...after }),
    );
  });

  it("does not change when a higher not-yet answer changes without confirmation", () => {
    const math = MAP_SUBJECTS.find((subject) => subject.id === "math");
    assert.ok(math);
    const lowestNotYet = math.items[5];
    const laterItem = math.items[9];
    const before = selectSubjectLessonTarget("math", 120, [
      { itemId: lowestNotYet.id, answer: "not_yet" },
      { itemId: laterItem.id, answer: "not_yet" },
    ]);
    const after = selectSubjectLessonTarget("math", 120, [
      { itemId: lowestNotYet.id, answer: "not_yet" },
      { itemId: laterItem.id, answer: "skip" },
    ]);

    assert.ok(before);
    assert.ok(after);
    assert.equal(
      lessonSourceFingerprint({ subjectId: "math", ...before }),
      lessonSourceFingerprint({ subjectId: "math", ...after })
    );
  });
});
