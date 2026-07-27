import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  JOURNAL_HOURS_PROGRESS_NOTE,
  manageChildProgressResultSchema,
} from "./tool-result-contract";

const CHECK_IN_ID = "11111111-1111-4111-8111-111111111111";
const CONFLICT_ID = "22222222-2222-4222-8222-222222222222";
const UNDO_TOKEN = "33333333-3333-4333-8333-333333333333";

function conflictResult(observedAt = "2026-07-12T01:30:00.123456-04:00") {
  return {
    kind: "progress_conflict",
    conflict: {
      conflictId: CONFLICT_ID,
      label: "Please confirm",
      question: "Which answer fits Maya today?",
      childName: "Maya",
      subjectDisplayName: "Math",
      skillStatement: "Maya counts out loud from 1 to 5.",
      answers: [
        {
          answer: "easily",
          adultDisplayName: "Elena",
          observedAt,
          source: "conversation",
        },
        {
          answer: "not_yet",
          adultDisplayName: "Jordan",
          observedAt,
          source: "check_in",
        },
      ],
      options: ["easily", "not_yet", "ask_later"],
    },
  };
}

describe("client-safe progress result contract", () => {
  it("accepts the bounded strict conflict result with evidence sources", () => {
    assert.equal(
      manageChildProgressResultSchema.safeParse(conflictResult()).success,
      true,
    );
  });

  it("requires strict offset-bearing calendar timestamps", () => {
    for (const observedAt of [
      "2026-07-12T01:30:00",
      "2026-02-30T01:30:00Z",
      "2026-07-12",
      "not-a-date",
    ]) {
      assert.equal(
        manageChildProgressResultSchema.safeParse(
          conflictResult(observedAt),
        ).success,
        false,
      );
    }
  });

  it("bounds every displayed name, question, statement, and topic", () => {
    const longName = "N".repeat(121);
    const longStatement = "S".repeat(501);
    const validUpdate = {
      kind: "progress_update",
      label: "Progress updated",
      childName: "Maya",
      affectedTopics: ["Counts out loud from 1 to 5"],
      undoAvailable: true,
      undoToken: UNDO_TOKEN,
    };
    const validQuestion = {
      kind: "progress_question",
      prompt: {
        checkInId: CHECK_IN_ID,
        revision: 1,
        childName: "Maya",
        subjectDisplayName: "Math",
        statement: "Can Maya count out loud from 1 to 5?",
        answerOptions: [
          "easily",
          "getting_there",
          "not_yet",
          "not_sure",
          "skip",
        ],
      },
    };
    const invalidResults = [
      { ...validUpdate, childName: longName },
      { ...validUpdate, affectedTopics: [longStatement] },
      {
        ...validQuestion,
        prompt: { ...validQuestion.prompt, childName: longName },
      },
      {
        ...validQuestion,
        prompt: { ...validQuestion.prompt, subjectDisplayName: longName },
      },
      {
        ...validQuestion,
        prompt: { ...validQuestion.prompt, statement: longStatement },
      },
      {
        ...conflictResult(),
        conflict: {
          ...conflictResult().conflict,
          question: longStatement,
        },
      },
      {
        ...conflictResult(),
        conflict: {
          ...conflictResult().conflict,
          skillStatement: longStatement,
        },
      },
      {
        ...conflictResult(),
        conflict: {
          ...conflictResult().conflict,
          answers: [
            {
              ...conflictResult().conflict.answers[0],
              adultDisplayName: longName,
            },
            conflictResult().conflict.answers[1],
          ],
        },
      },
    ];

    for (const result of invalidResults) {
      assert.equal(
        manageChildProgressResultSchema.safeParse(result).success,
        false,
      );
    }
  });

  it("allows only the exact hours reminder on progress updates", () => {
    const update = {
      kind: "progress_update",
      label: "Progress updated",
      childName: "Maya",
      affectedTopics: ["Counts out loud from 1 to 5"],
      undoAvailable: true,
      undoToken: UNDO_TOKEN,
    };
    // Historical transcripts predate the note; they must keep parsing.
    assert.equal(
      manageChildProgressResultSchema.safeParse(update).success,
      true,
    );
    assert.equal(
      manageChildProgressResultSchema.safeParse({
        ...update,
        note: JOURNAL_HOURS_PROGRESS_NOTE,
      }).success,
      true,
    );
    assert.equal(
      manageChildProgressResultSchema.safeParse({
        ...update,
        note: "Free-text guidance a caller made up",
      }).success,
      false,
    );
  });

  it("bounds every displayed result array", () => {
    assert.equal(
      manageChildProgressResultSchema.safeParse({
        kind: "progress_update",
        label: "Progress updated",
        childName: "Maya",
        affectedTopics: Array.from(
          { length: 13 },
          (_, index) => `Topic ${index}`,
        ),
        undoAvailable: false,
        undoToken: null,
      }).success,
      false,
    );
  });
});
