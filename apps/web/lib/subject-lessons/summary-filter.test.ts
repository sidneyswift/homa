import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAP_SUBJECTS,
  selectSubjectLessonTarget,
  type MapAnswer,
} from "@homa/core";

import { lessonSourceFingerprint } from "./fingerprint";
import { filterSubjectLessonSummariesForCurrentTargets } from "./summary-filter";

function fingerprintFor(
  subjectId: string,
  ageMonths: number,
  answers: Array<{ itemId: string; answer: MapAnswer }>
): string {
  const target = selectSubjectLessonTarget(subjectId, ageMonths, answers);
  assert.ok(target);
  return lessonSourceFingerprint({ subjectId, ...target });
}

describe("filterSubjectLessonSummariesForCurrentTargets", () => {
  it("hides the old lesson when changed answers select a new target", () => {
    const math = MAP_SUBJECTS.find((subject) => subject.id === "math");
    assert.ok(math);
    const initialAnswers = [
      { itemId: math.items[0].id, answer: "easily" as const },
    ];
    const changedAnswers = [
      ...initialAnswers,
      { itemId: math.items[1].id, answer: "easily" as const },
    ];
    const initialFingerprint = fingerprintFor(math.id, 96, initialAnswers);
    const changedFingerprint = fingerprintFor(math.id, 96, changedAnswers);
    assert.notEqual(initialFingerprint, changedFingerprint);

    const oldLesson = {
      id: "11111111-1111-4111-8111-111111111111",
      subjectId: math.id,
      buildStatus: "ready" as const,
      sourceFingerprint: initialFingerprint,
    };

    assert.deepEqual(
      filterSubjectLessonSummariesForCurrentTargets({
        ageMonths: 96,
        answers: initialAnswers,
        lessons: [oldLesson],
      }),
      [
        {
          id: oldLesson.id,
          subjectId: math.id,
          buildStatus: "ready",
        },
      ]
    );
    assert.deepEqual(
      filterSubjectLessonSummariesForCurrentTargets({
        ageMonths: 96,
        answers: changedAnswers,
        lessons: [oldLesson],
      }),
      []
    );
  });
});
