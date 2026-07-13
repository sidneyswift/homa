import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreMap } from "@homa/core";

import {
  executeChildProgressCommand,
  type ChildProgressToolOperations,
} from "./tool-adapter";
import { createProgressToolContext } from "./tool-contract";
import {
  OBSERVATION_ALREADY_USED_PROGRESS_NOTE,
  OBSERVATION_USED_PROGRESS_NOTE,
  REFUSED_PROGRESS_NOTE,
  REISSUE_PROGRESS_NOTE,
} from "./tool-result-contract";
import type {
  ChildProgressView,
  ProgressCheckInRecord,
} from "./types";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHECK_IN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EVIDENCE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OPERATION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-11T20:30:00.000Z");

function context() {
  return createProgressToolContext({
    access: { familyId: FAMILY_ID },
    attributes: {
      memberUserId: MEMBER_ID,
      channel: "web",
      canonicalInboundText:
        "Maya read the whole early reader by herself.",
      canonicalInboundMessageId: MESSAGE_ID,
    },
    sessionId: "session-1",
    turnId: "turn-1",
    now: NOW,
  });
}

function activeCheckIn(): ProgressCheckInRecord {
  return {
    id: CHECK_IN_ID,
    childId: CHILD_ID,
    childName: "Maya",
    familyId: FAMILY_ID,
    purpose: "whole_map_refresh",
    scope: {},
    state: "active",
    ownerMemberUserId: MEMBER_ID,
    ownerDisplayName: "Elena",
    recipientMemberUserId: MEMBER_ID,
    recipientDisplayName: "Elena",
    revision: 2,
    currentItemId: "math.counts-to-5",
    currentDeliveryId: null,
    episodeId: "episode-1",
    pendingRuntimeSessionId: "session-1",
    pendingTurnId: "turn-1",
    pauseReason: null,
    openedAt: NOW.toISOString(),
    pausedAt: null,
    completedAt: null,
    stoppedAt: null,
    updatedAt: NOW.toISOString(),
  };
}

function view(): ChildProgressView {
  return {
    childId: CHILD_ID,
    childName: "Maya",
    birthDate: "2020-01-01",
    timeZone: "America/Chicago",
    projectedAt: NOW.toISOString(),
    scores: scoreMap(78, []),
    subjects: [
      {
        subjectId: "literacy",
        displayName: "Literacy",
        evidenceCount: 1,
        latestObservedAt: NOW.toISOString(),
        state: "updated_recently",
        summary: null,
        domains: [
          {
            domainId: "reading",
            displayName: "Reading",
            topics: [
              {
                itemId: "literacy.emergent-reader",
                statement: "Reads a short early reader",
                detail: "Reads a short early reader",
                state: "observed_today",
                answer: "easily",
                source: {
                  kind: "journal",
                  adultDisplayName: "Elena",
                  checkInId: null,
                },
                observedAt: NOW.toISOString(),
              },
            ],
          },
        ],
      },
    ],
    conflicts: [],
  };
}

function operations(
  overrides: Partial<ChildProgressToolOperations>,
): ChildProgressToolOperations {
  const unexpected = async (): Promise<never> => {
    throw new Error("Unexpected operation");
  };
  return {
    startCheckIn: unexpected,
    respondCheckIn: unexpected,
    pauseCheckIn: unexpected,
    resumeCheckIn: unexpected,
    stopCheckIn: unexpected,
    takeoverCheckIn: unexpected,
    recordJournalEvidence: unexpected,
    resolveConflict: unexpected,
    undoProgressUpdate: unexpected,
    markObservationUsed: unexpected,
    listFamilyCheckIns: async () => [],
    getChildProgressView: async () => null,
    ...overrides,
  };
}

describe("child progress tool result adapter", () => {
  it("returns a question and visible update without exposing the server item id", async () => {
    const result = await executeChildProgressCommand(
      {
        action: "respond_check_in",
        checkInId: CHECK_IN_ID,
        answer: "easily",
      },
      context(),
      operations({
        respondCheckIn: async () => ({
          status: "advanced",
          checkIn: activeCheckIn(),
          prompt: {
            checkInId: CHECK_IN_ID,
            revision: 2,
            childId: CHILD_ID,
            childName: "Maya",
            itemId: "math.counts-to-5",
            personalizedStatement: "Can Maya count up to 5?",
            subjectDisplayName: "Math",
            state: "active",
            ownerDisplayName: "Elena",
          },
          responseId: "response-1",
          progressUpdate: {
            operationId: OPERATION_ID,
            affectedItemIds: ["math.counts-to-5"],
            affectedTopics: ["Counts out loud from 1 to 5"],
            undoAvailable: true,
          },
        }),
      }),
    );

    assert.equal(result.kind, "progress_question");
    assert.equal(JSON.stringify(result).includes("itemId"), false);
    assert.deepEqual(result.update, {
      label: "Progress updated",
      undoToken: OPERATION_ID,
      affectedTopics: ["Counts out loud from 1 to 5"],
    });
  });

  it("returns a saved workflow with its visible progress update", async () => {
    const result = await executeChildProgressCommand(
      {
        action: "respond_check_in",
        checkInId: CHECK_IN_ID,
        answer: "easily",
      },
      context(),
      operations({
        respondCheckIn: async () => ({
          status: "completed",
          checkIn: {
            ...activeCheckIn(),
            state: "completed",
            currentItemId: null,
            pendingRuntimeSessionId: null,
            pendingTurnId: null,
            completedAt: NOW.toISOString(),
          },
          responseId: "response-2",
          progressUpdate: {
            operationId: OPERATION_ID,
            affectedItemIds: ["math.counts-to-5"],
            affectedTopics: ["Counts out loud from 1 to 5"],
            undoAvailable: true,
          },
        }),
      }),
    );

    assert.deepEqual(result, {
      kind: "progress_workflow",
      label: "Check-in saved",
      update: {
        label: "Progress updated",
        undoToken: OPERATION_ID,
        affectedTopics: ["Counts out loud from 1 to 5"],
      },
    });
  });

  it("guides recovery for an unbound reply but stays generic for identity refusals", async () => {
    const unbound = await executeChildProgressCommand(
      {
        action: "respond_check_in",
        checkInId: CHECK_IN_ID,
        answer: "easily",
      },
      context(),
      operations({
        respondCheckIn: async () => ({ status: "wrong_delivery" }),
      }),
    );
    assert.deepEqual(unbound, {
      kind: "refused",
      note: REISSUE_PROGRESS_NOTE,
    });

    const identity = await executeChildProgressCommand(
      {
        action: "respond_check_in",
        checkInId: CHECK_IN_ID,
        answer: "easily",
      },
      context(),
      operations({
        respondCheckIn: async () => ({ status: "wrong_recipient" }),
      }),
    );
    assert.deepEqual(identity, {
      kind: "refused",
      note: REFUSED_PROGRESS_NOTE,
    });
  });

  it("returns a real undo token without echoing canonical input", async () => {
    const canonicalText =
      "Maya read the whole early reader by herself.";
    const result = await executeChildProgressCommand(
      {
        action: "record_journal_evidence",
        childId: CHILD_ID,
      },
      context(),
      operations({
        recordJournalEvidence: async () => ({
          status: "recorded",
          evidence: [
            {
              id: EVIDENCE_ID,
              childId: CHILD_ID,
              familyId: FAMILY_ID,
              itemId: "literacy.emergent-reader",
              answer: "easily",
              source: "journal",
              memberUserId: MEMBER_ID,
              adultDisplayName: "Elena",
              quote: canonicalText,
              channel: "web",
              messageId: MESSAGE_ID,
              checkInId: null,
              supersedesId: null,
              supersededAt: null,
              observedAt: NOW.toISOString(),
              createdAt: NOW.toISOString(),
            },
          ],
          affectedItemIds: ["literacy.emergent-reader"],
          conflictIds: [],
          operationId: OPERATION_ID,
        }),
        getChildProgressView: async () => view(),
      }),
    );

    assert.deepEqual(result, {
      kind: "progress_update",
      label: "Progress updated",
      childName: "Maya",
      affectedTopics: ["Reads a short early reader"],
      undoAvailable: true,
      undoToken: OPERATION_ID,
    });
    assert.equal(JSON.stringify(result).includes(canonicalText), false);
  });

  it("marks an observation used, including from a dispatch session", async () => {
    const OBSERVATION_ID =
      "22222222-2222-4222-8222-222222222222";
    const dispatchContext = createProgressToolContext({
      access: { familyId: FAMILY_ID },
      attributes: {
        channel: "dispatch",
        taskRunId: "33333333-3333-4333-8333-333333333333",
      },
      sessionId: "session-dispatch",
      turnId: "turn-dispatch",
      now: NOW,
    });
    const seenTaskRunIds: Array<string | null> = [];

    const used = await executeChildProgressCommand(
      {
        action: "mark_observation_used",
        observationId: OBSERVATION_ID,
      },
      dispatchContext,
      operations({
        markObservationUsed: async (operationContext) => {
          seenTaskRunIds.push(operationContext.taskRunId ?? null);
          return { outcome: "used", childId: CHILD_ID };
        },
      }),
    );
    assert.deepEqual(used, {
      kind: "observation_used",
      note: OBSERVATION_USED_PROGRESS_NOTE,
    });
    assert.deepEqual(seenTaskRunIds, [
      "33333333-3333-4333-8333-333333333333",
    ]);

    const repeat = await executeChildProgressCommand(
      {
        action: "mark_observation_used",
        observationId: OBSERVATION_ID,
      },
      context(),
      operations({
        markObservationUsed: async () => ({
          outcome: "already_used",
          childId: CHILD_ID,
        }),
      }),
    );
    assert.deepEqual(repeat, {
      kind: "observation_used",
      note: OBSERVATION_ALREADY_USED_PROGRESS_NOTE,
    });

    const unknown = await executeChildProgressCommand(
      {
        action: "mark_observation_used",
        observationId: OBSERVATION_ID,
      },
      context(),
      operations({
        markObservationUsed: async () => ({
          outcome: "unknown_observation",
        }),
      }),
    );
    assert.deepEqual(unknown, {
      kind: "refused",
      note: REFUSED_PROGRESS_NOTE,
    });
  });

  it("still refuses other actions on the dispatch channel", async () => {
    const dispatchContext = createProgressToolContext({
      access: { familyId: FAMILY_ID },
      attributes: { channel: "dispatch" },
      sessionId: "session-dispatch",
      turnId: "turn-dispatch",
      now: NOW,
    });
    const result = await executeChildProgressCommand(
      {
        action: "start_check_in",
        childId: CHILD_ID,
        purpose: "whole_map_refresh",
      },
      dispatchContext,
      operations({}),
    );
    assert.deepEqual(result, {
      kind: "refused",
      note: REFUSED_PROGRESS_NOTE,
    });
  });
});
