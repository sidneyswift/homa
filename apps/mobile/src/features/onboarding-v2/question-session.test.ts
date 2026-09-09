import assert from "node:assert/strict";
import { test } from "node:test";
import { MAP_SUBJECTS, type MapAnswer } from "@homa/core";
import { buildLadderPlans, INITIAL_CURSOR, stepFor } from "./ladder";
import { nextPosition, resumeQuestions, sessionAnswers, type QuestionSession } from "./question-session";

const plans = buildLadderPlans(72);

function answerAndAdvance(session: QuestionSession, answer: MapAnswer): QuestionSession {
  const next = nextPosition(plans, session, answer);
  assert.ok(next);
  return { ...next, selected: null, history: [...session.history, {
    subjectIndex: session.subjectIndex, cursor: session.cursor, answer,
  }] };
}

test("returning to questions resumes after saved answers instead of starting over", () => {
  const start = resumeQuestions(plans, {});
  const afterMath = answerAndAdvance(start, "getting_there");
  const saved = sessionAnswers(plans, afterMath);
  assert.deepEqual(resumeQuestions(plans, saved), afterMath);
});

test("changing an earlier answer drops abandoned climb evidence from the report", () => {
  const start = resumeQuestions(plans, {});
  const climb = answerAndAdvance(start, "easily");
  assert.equal(climb.cursor.phase, "climb");
  const climbStep = stepFor(plans, climb.subjectIndex, climb.cursor);
  assert.ok(climbStep);
  const oldAnswers = sessionAnswers(plans, { ...climb, selected: "easily" });
  assert.ok(oldAnswers[climbStep.item.id]);
  const corrected = sessionAnswers(plans, { ...start, selected: "not_yet" });
  assert.equal(corrected[climbStep.item.id], undefined);
  assert.equal(Object.keys(corrected).length, 1);
  assert.equal(resumeQuestions(plans, corrected).cursor.phase, "down");
});

test("finishing early includes a selected draft once and does not invent unanswered evidence", () => {
  const start = resumeQuestions(plans, {});
  assert.deepEqual(sessionAnswers(plans, start), {});
  const saved = sessionAnswers(plans, { ...start, selected: "not_sure" });
  assert.equal(Object.keys(saved).length, 1);
  assert.equal(Object.values(saved)[0].answer, "not_sure");
  assert.equal(resumeQuestions(plans, saved).subjectIndex, 1);
});

test("a completed path reopens the final answer for review and can finish again", () => {
  let session = resumeQuestions(plans, {});
  while (nextPosition(plans, session, "getting_there")) session = answerAndAdvance(session, "getting_there");
  session = { ...session, selected: "getting_there" };
  assert.equal(session.subjectIndex, plans.length - 1);
  const resumed = resumeQuestions(plans, sessionAnswers(plans, session));
  assert.deepEqual(resumed, session);
  assert.equal(nextPosition(plans, resumed, "getting_there"), null);
});

test("untried exposure subjects remain skippable without follow-up questions", () => {
  const subjectIndex = MAP_SUBJECTS.findIndex((subject) => subject.exposureBased);
  assert.ok(subjectIndex >= 0);
  const next = nextPosition(plans, { subjectIndex, cursor: INITIAL_CURSOR }, "skip");
  assert.ok(next);
  assert.equal(next.subjectIndex, subjectIndex + 1);
});
