import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseProgressMessagePart } from "./progress-message-parts";

const CHECK_IN_ID = "11111111-1111-4111-8111-111111111111";
const CONFLICT_ID = "22222222-2222-4222-8222-222222222222";
const UNDO_TOKEN = "33333333-3333-4333-8333-333333333333";

function progressToolPart(output: unknown) {
  return {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "manage_child_progress",
    output,
  };
}

describe("parseProgressMessagePart", () => {
  it("parses a strict progress update without retaining its undo token", () => {
    const item = parseProgressMessagePart(
      progressToolPart({
        kind: "progress_update",
        label: "Progress updated",
        childName: "Maya",
        affectedTopics: ["Counts out loud from 1 to 5"],
        undoAvailable: true,
        undoToken: UNDO_TOKEN,
      }),
    );

    assert.deepEqual(item, {
      kind: "progress_update",
      update: {
        label: "Progress updated",
        childName: "Maya",
        affectedTopics: ["Counts out loud from 1 to 5"],
        undoAvailable: true,
      },
    });
    assert.equal(JSON.stringify(item).includes(UNDO_TOKEN), false);
  });

  it("parses a question and its nested update in server order", () => {
    const item = parseProgressMessagePart(
      progressToolPart({
        kind: "progress_question",
        prompt: {
          checkInId: CHECK_IN_ID,
          revision: 4,
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
        update: {
          label: "Progress updated",
          undoToken: UNDO_TOKEN,
          affectedTopics: ["Recognizes groups of five"],
        },
      }),
    );

    assert.deepEqual(item, {
      kind: "progress_question",
      card: {
        childName: "Maya",
        subjectDisplayName: "Math",
        statement: "Can Maya count out loud from 1 to 5?",
        answerLabels: [
          "Easily",
          "Getting there",
          "Not yet",
          "Not sure",
          "Skip",
        ],
        update: {
          label: "Progress updated",
          affectedTopics: ["Recognizes groups of five"],
          undoAvailable: true,
        },
      },
    });
  });

  it("parses both conflict observations and every visible option", () => {
    const item = parseProgressMessagePart(
      progressToolPart({
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
              observedAt: "2026-07-11T23:55:00.000Z",
              source: "conversation",
            },
            {
              answer: "not_yet",
              adultDisplayName: "Jordan",
              observedAt: "2026-07-12T01:00:00.000Z",
              source: "check_in",
            },
          ],
          options: ["easily", "not_yet", "ask_later"],
        },
      }),
    );

    assert.deepEqual(item, {
      kind: "progress_conflict",
      card: {
        label: "Please confirm",
        question: "Which answer fits Maya today?",
        childName: "Maya",
        subjectDisplayName: "Math",
        skillStatement: "Maya counts out loud from 1 to 5.",
        answers: [
          {
            answerLabel: "Easily",
            adultDisplayName: "Elena",
            observedAt: "2026-07-11T23:55:00.000Z",
            source: "conversation",
          },
          {
            answerLabel: "Not yet",
            adultDisplayName: "Jordan",
            observedAt: "2026-07-12T01:00:00.000Z",
            source: "check_in",
          },
        ],
        optionLabels: ["Easily", "Not yet", "Ask me later"],
      },
    });
  });

  it("parses every workflow label and an optional nested update", () => {
    for (const label of [
      "Check-in paused",
      "Check-in saved",
      "Check-in moved",
    ] as const) {
      const item = parseProgressMessagePart(
        progressToolPart({
          kind: "progress_workflow",
          label,
          update:
            label === "Check-in saved"
              ? {
                  label: "Progress updated",
                  undoToken: UNDO_TOKEN,
                  affectedTopics: ["Counts out loud from 1 to 5"],
                }
              : undefined,
        }),
      );

      assert.equal(item?.kind, "progress_workflow");
      assert.equal(item?.kind === "progress_workflow" ? item.label : null, label);
      assert.equal(
        item?.kind === "progress_workflow"
          ? item.update?.undoAvailable ?? false
          : false,
        label === "Check-in saved",
      );
    }
  });

  it("ignores wrong tools, unfinished states, safe non-card results, and malformed output", () => {
    const validOutput = {
      kind: "progress_update",
      label: "Progress updated",
      childName: "Maya",
      affectedTopics: [],
      undoAvailable: false,
      undoToken: null,
    };
    const ignored = [
      { ...progressToolPart(validOutput), toolName: "remember" },
      { ...progressToolPart(validOutput), state: "input-available" },
      { type: "text", text: "Progress updated" },
      progressToolPart({
        kind: "disabled",
        note: "Progress is not available right now. No family data was read or changed.",
      }),
      progressToolPart({ ...validOutput, unexpected: true }),
      progressToolPart({ ...validOutput, undoToken: "not-a-uuid" }),
      progressToolPart(null),
    ];

    for (const part of ignored) {
      assert.doesNotThrow(() => parseProgressMessagePart(part));
      assert.equal(parseProgressMessagePart(part), null);
    }
  });

  it("fails closed on invalid conflict dates and oversized display text", () => {
    const baseConflict = {
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
            observedAt: "2026-07-11T23:55:00.000Z",
            source: "conversation",
          },
          {
            answer: "not_yet",
            adultDisplayName: "Jordan",
            observedAt: "2026-07-12T01:00:00.000Z",
            source: "check_in",
          },
        ],
        options: ["easily", "not_yet", "ask_later"],
      },
    };
    const invalidOutputs = [
      {
        ...baseConflict,
        conflict: {
          ...baseConflict.conflict,
          answers: [
            {
              ...baseConflict.conflict.answers[0],
              observedAt: "2026-07-11T23:55:00",
            },
            baseConflict.conflict.answers[1],
          ],
        },
      },
      {
        ...baseConflict,
        conflict: {
          ...baseConflict.conflict,
          skillStatement: "S".repeat(501),
        },
      },
    ];

    for (const output of invalidOutputs) {
      assert.equal(
        parseProgressMessagePart(progressToolPart(output)),
        null,
      );
    }
  });
});
