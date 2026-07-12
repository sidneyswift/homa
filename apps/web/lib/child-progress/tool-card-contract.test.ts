import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  manageChildProgressResultSchema,
} from "./tool-contract";
import {
  progressConflictCardResult,
} from "./tool-result-payloads";
import type { ProgressConflictCard } from "./types";

const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONFLICT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const EVIDENCE_A = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_B = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-07-11T23:55:00.000Z";

describe("progress card contracts", () => {
  it("requires a real operation undo token when undo is available", () => {
    assert.equal(
      manageChildProgressResultSchema.safeParse({
        kind: "progress_update",
        label: "Progress updated",
        childName: "Maya",
        affectedTopics: ["Reads a short early reader"],
        undoAvailable: true,
        undoToken: OPERATION_ID,
      }).success,
      true,
    );
    assert.equal(
      manageChildProgressResultSchema.safeParse({
        kind: "progress_update",
        label: "Progress updated",
        childName: "Maya",
        affectedTopics: ["Reads a short early reader"],
        undoAvailable: true,
      }).success,
      false,
    );
  });

  it("returns one declarative skill and exact conflict correction choices", () => {
    const conflict: ProgressConflictCard = {
      id: CONFLICT_ID,
      childId: CHILD_ID,
      childName: "Maya",
      itemId: "math.counts-to-5",
      skillStatement:
        "Maya counts out loud from 1 to 5, mostly in order",
      subjectDisplayName: "Math",
      answers: [
        {
          evidenceId: EVIDENCE_A,
          answer: "easily",
          adultDisplayName: "Elena",
          observedAt: NOW,
          source: "conversation",
        },
        {
          evidenceId: EVIDENCE_B,
          answer: "not_yet",
          adultDisplayName: "Jordan",
          observedAt: NOW,
          source: "check_in",
        },
      ],
    };

    assert.deepEqual(progressConflictCardResult(conflict), {
      kind: "progress_conflict",
      conflict: {
        conflictId: CONFLICT_ID,
        label: "Please confirm",
        question: "Which answer fits Maya today?",
        childName: "Maya",
        subjectDisplayName: "Math",
        skillStatement:
          "Maya counts out loud from 1 to 5, mostly in order",
        answers: [
          {
            answer: "easily",
            adultDisplayName: "Elena",
            observedAt: NOW,
            source: "conversation",
          },
          {
            answer: "not_yet",
            adultDisplayName: "Jordan",
            observedAt: NOW,
            source: "check_in",
          },
        ],
        options: ["easily", "not_yet", "ask_later"],
      },
    });
  });
});
