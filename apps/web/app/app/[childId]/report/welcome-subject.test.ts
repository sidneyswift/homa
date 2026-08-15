import assert from "node:assert/strict";
import test from "node:test";

import { pickWelcomeSubject } from "./welcome-subject";

const subjects = [
  { id: "reading", name: "Reading" },
  { id: "math", name: "Math" },
];

test("legacy week handoff starts with the first grounded report subject", () => {
  assert.equal(
    pickWelcomeSubject({
      subjects,
      subjectLessonsEnabled: false,
      subjectLessons: [],
      viewerCanBuildLesson: false,
    })?.id,
    "reading",
  );
});

test("an account owner can build the first grounded subject lesson", () => {
  assert.equal(
    pickWelcomeSubject({
      subjects,
      subjectLessonsEnabled: true,
      subjectLessons: [],
      viewerCanBuildLesson: true,
    })?.id,
    "reading",
  );
});

test("a restricted viewer only sees a subject with an existing lesson", () => {
  assert.equal(
    pickWelcomeSubject({
      subjects,
      subjectLessonsEnabled: true,
      subjectLessons: [{ subjectId: "math" }],
      viewerCanBuildLesson: false,
    })?.id,
    "math",
  );
});

test("a restricted viewer without an existing lesson gets no false action", () => {
  assert.equal(
    pickWelcomeSubject({
      subjects,
      subjectLessonsEnabled: true,
      subjectLessons: [],
      viewerCanBuildLesson: false,
    }),
    null,
  );
});
