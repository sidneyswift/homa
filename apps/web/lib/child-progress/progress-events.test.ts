import assert from "node:assert/strict";
import test from "node:test";

import type { EventName, EventProps } from "@homa/core";

import {
  emitProgressEvents,
  progressEventsForCheckInAnswer,
  progressEventsForCheckInPause,
  progressEventsForCheckInResolution,
  progressEventsForCheckInResume,
  progressEventsForCheckInStart,
  progressEventsForCheckInStop,
  progressEventsForCheckInTakeover,
  progressEventsForCorrectionResult,
  progressEventsForEvidenceResult,
  progressEventsForUndoResult,
  progressEventsForWalkAnswer,
  withCommittedProgressEvents,
  type ProgressEvent,
} from "./progress-events";
import type {
  CorrectProgressAnswersResult,
  RecordProgressEvidenceResult,
  UndoProgressOperationResult,
} from "./progress-service";
import type {
  ProgressCheckInRecord,
  ProgressCheckInResult,
  ProgressEvidence,
} from "./types";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const CHILD_ID = "00000000-0000-4000-8000-000000000002";
const MEMBER_ID = "00000000-0000-4000-8000-000000000003";
const CHECK_IN_ID = "00000000-0000-4000-8000-000000000004";
const OPERATION_ID = "00000000-0000-4000-8000-000000000006";
const TAXONOMY_ITEM_ID = "math.comparing-groups-more-or-fewer";

function progressEvidence(
  overrides: Partial<ProgressEvidence> = {},
): ProgressEvidence {
  return {
    id: "evidence-1",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    answer: "easily",
    source: "journal",
    memberUserId: MEMBER_ID,
    adultDisplayName: "Synthetic adult",
    quote: "Synthetic quote",
    channel: "web",
    messageId: null,
    checkInId: null,
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-07-12T12:00:00.000Z",
    createdAt: "2026-07-12T12:00:00.000Z",
    ...overrides,
  };
}

function checkInRecord(
  overrides: Partial<ProgressCheckInRecord> = {},
): ProgressCheckInRecord {
  return {
    id: CHECK_IN_ID,
    childId: CHILD_ID,
    childName: "Synthetic child",
    familyId: FAMILY_ID,
    purpose: "whole_map_refresh",
    scope: {},
    state: "active",
    ownerMemberUserId: MEMBER_ID,
    ownerDisplayName: "Synthetic adult",
    recipientMemberUserId: MEMBER_ID,
    recipientDisplayName: "Synthetic adult",
    revision: 1,
    currentItemId: "math.counts-to-5",
    currentDeliveryId: null,
    episodeId: null,
    pendingRuntimeSessionId: "runtime-1",
    pendingTurnId: "turn-1",
    pauseReason: null,
    openedAt: "2026-07-12T12:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    stoppedAt: null,
    updatedAt: "2026-07-12T12:00:00.000Z",
    ...overrides,
  };
}

test("committed evidence emits only PII-free write events", () => {
  const result: RecordProgressEvidenceResult = {
    status: "recorded",
    evidence: [
      progressEvidence(),
      progressEvidence({
        id: "evidence-2",
        itemId: "writing.writes-name",
        source: "journal",
        supersedesId: "older-evidence",
      }),
    ],
    affectedItemIds: [
      "math.counts-to-5",
      "writing.writes-name",
    ],
    conflictIds: [],
    operationId: OPERATION_ID,
  };

  assert.deepEqual(
    progressEventsForEvidenceResult(result),
    [
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "journal",
          items: 2,
          supersedes: true,
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 2,
          had_conflict: false,
        },
      },
    ],
  );
});

test("taxonomy-only evidence counts its trusted subject", () => {
  const result: RecordProgressEvidenceResult = {
    status: "recorded",
    evidence: [progressEvidence({ itemId: TAXONOMY_ITEM_ID })],
    affectedItemIds: [TAXONOMY_ITEM_ID],
    conflictIds: [],
    operationId: OPERATION_ID,
  };

  assert.deepEqual(
    progressEventsForEvidenceResult(result),
    [
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "journal",
          items: 1,
          supersedes: false,
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: false,
        },
      },
    ],
  );
});

test("new conflicts emit trusted subject and domain metadata", () => {
  const result: RecordProgressEvidenceResult = {
    status: "conflict_open",
    evidence: [progressEvidence({ source: "conversation" })],
    affectedItemIds: ["math.counts-to-5"],
    conflictIds: ["conflict-1"],
    operationId: OPERATION_ID,
  };

  assert.deepEqual(
    progressEventsForEvidenceResult(
      result,
      ["math.counts-to-5"],
    ),
    [
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "conversation",
          items: 1,
          supersedes: false,
        },
      },
      {
        name: "progress.conflict_opened",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: true,
        },
      },
    ],
  );
});

test("taxonomy-only conflicts emit trusted subject and domain metadata", () => {
  const result: RecordProgressEvidenceResult = {
    status: "conflict_open",
    evidence: [
      progressEvidence({
        itemId: TAXONOMY_ITEM_ID,
        source: "conversation",
      }),
    ],
    affectedItemIds: [TAXONOMY_ITEM_ID],
    conflictIds: ["conflict-1"],
    operationId: OPERATION_ID,
  };

  assert.deepEqual(
    progressEventsForEvidenceResult(result, [TAXONOMY_ITEM_ID]),
    [
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "conversation",
          items: 1,
          supersedes: false,
        },
      },
      {
        name: "progress.conflict_opened",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: true,
        },
      },
    ],
  );
});

test("duplicate and refused evidence outcomes emit nothing", () => {
  for (const result of [
    {
      status: "duplicate",
      original: {
        status: "recorded",
        evidence: [progressEvidence()],
        affectedItemIds: ["math.counts-to-5"],
        conflictIds: [],
      },
    },
    { status: "unknown_child" },
    { status: "unknown_actor" },
    { status: "idempotency_mismatch" },
    {
      status: "conflict_pending",
      conflictId: "conflict-1",
      itemId: "math.counts-to-5",
    },
  ] satisfies RecordProgressEvidenceResult[]) {
    assert.deepEqual(progressEventsForEvidenceResult(result), []);
  }
});

test("untrusted affected items emit no zero-subject projection", () => {
  const result: RecordProgressEvidenceResult = {
    status: "recorded",
    evidence: [progressEvidence({ itemId: "unknown.item" })],
    affectedItemIds: ["unknown.item"],
    conflictIds: [],
    operationId: OPERATION_ID,
  };

  assert.deepEqual(progressEventsForEvidenceResult(result), [
    {
      name: "progress.evidence_recorded",
      props: {
        family_id: FAMILY_ID,
        child_id: CHILD_ID,
        source: "journal",
        items: 1,
        supersedes: false,
      },
    },
  ]);
  assert.deepEqual(
    progressEventsForCheckInResolution({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: "unknown.item",
      checkInState: "active",
    }),
    [],
  );
});

test("correction and undo projection events reflect committed changes", () => {
  const correction: CorrectProgressAnswersResult = {
    status: "answers_corrected",
    childId: CHILD_ID,
    childName: "Synthetic child",
    operationId: OPERATION_ID,
    evidence: [
      progressEvidence({
        source: "report_correction",
        itemId: "math.counts-to-5",
      }),
    ],
    affectedItemIds: [
      "math.counts-to-5",
      "math.counts-to-10",
    ],
  };
  assert.deepEqual(
    progressEventsForCorrectionResult(FAMILY_ID, correction),
    [
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "report_correction",
          items: 1,
          supersedes: true,
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: false,
        },
      },
    ],
  );

  const undo: UndoProgressOperationResult = {
    status: "undone",
    childId: CHILD_ID,
    childName: "Synthetic child",
    operationId: OPERATION_ID,
    evidenceIds: ["evidence-1"],
    affectedItemIds: [
      "math.counts-to-5",
      "writing.writes-name",
    ],
  };
  assert.deepEqual(progressEventsForUndoResult(FAMILY_ID, undo), [
    {
      name: "progress.projection_updated",
      props: {
        family_id: FAMILY_ID,
        child_id: CHILD_ID,
        subjects_touched: 2,
        had_conflict: false,
      },
    },
  ]);
});

test("check-in lifecycle events exclude existing and refused outcomes", () => {
  const started: ProgressCheckInResult = {
    status: "started",
    checkIn: checkInRecord({
      scope: { subjectIds: ["math"] },
    }),
    prompt: {
      checkInId: CHECK_IN_ID,
      revision: 1,
      childId: CHILD_ID,
      childName: "Synthetic child",
      itemId: "math.counts-to-5",
      personalizedStatement: "Synthetic statement",
      subjectDisplayName: "Math",
      state: "active",
      ownerDisplayName: "Synthetic adult",
    },
  };
  assert.deepEqual(progressEventsForCheckInStart(started), [
    {
      name: "progress.checkin_started",
      props: {
        family_id: FAMILY_ID,
        child_id: CHILD_ID,
        scope: "subject",
        subject: "math",
      },
    },
  ]);
  assert.deepEqual(
    progressEventsForCheckInStart({
      status: "existing",
      checkIn: started.checkIn,
      prompt: started.prompt,
    }),
    [],
  );
  assert.deepEqual(
    progressEventsForCheckInPause(
      "explicit_pause",
      {
        status: "paused",
        checkIn: checkInRecord({
          state: "paused",
          pauseReason: "explicit_pause",
          pausedAt: "2026-07-12T12:01:00.000Z",
          pendingRuntimeSessionId: null,
          pendingTurnId: null,
        }),
        prompt: {
          ...started.prompt,
          revision: 2,
          state: "paused",
        },
      },
    ),
    [
      {
        name: "progress.checkin_paused",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          reason: "explicit_stop",
        },
      },
    ],
  );
  assert.deepEqual(
    progressEventsForCheckInPause(
      "topic_change",
      { status: "wrong_recipient" },
    ),
    [],
  );
});

test("resume, takeover, and stop events use committed outcomes", () => {
  const prompt = {
    checkInId: CHECK_IN_ID,
    revision: 2,
    childId: CHILD_ID,
    childName: "Synthetic child",
    itemId: "math.counts-to-5",
    personalizedStatement: "Synthetic statement",
    subjectDisplayName: "Math",
    state: "active" as const,
    ownerDisplayName: "Synthetic adult",
  };
  assert.deepEqual(
    progressEventsForCheckInResume({
      status: "resumed",
      checkIn: checkInRecord({ revision: 2 }),
      prompt,
    }),
    [
      {
        name: "progress.checkin_resumed",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          takeover: false,
        },
      },
    ],
  );
  assert.deepEqual(
    progressEventsForCheckInTakeover({
      status: "takeover_accepted",
      checkIn: checkInRecord({ revision: 2 }),
      prompt,
    }),
    [
      {
        name: "progress.checkin_resumed",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          takeover: true,
        },
      },
    ],
  );
  assert.deepEqual(
    progressEventsForCheckInStop({
      status: "stopped",
      checkIn: checkInRecord({
        state: "stopped",
        currentItemId: null,
        pendingRuntimeSessionId: null,
        pendingTurnId: null,
        stoppedAt: "2026-07-12T12:02:00.000Z",
      }),
    }),
    [
      {
        name: "progress.checkin_ended",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          outcome: "stopped",
        },
      },
    ],
  );
});

test("committed check-in answers emit answer and evidence effects", () => {
  assert.deepEqual(
    progressEventsForCheckInAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: "math.counts-to-5",
      answer: "not_yet",
      outcome: "conflict_open",
    }),
    [
      {
        name: "progress.checkin_answered",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
          answer: "not_yet",
        },
      },
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "check_in",
          items: 1,
          supersedes: false,
        },
      },
      {
        name: "progress.conflict_opened",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
        },
      },
      {
        name: "progress.checkin_paused",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          reason: "conflict",
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: true,
        },
      },
    ],
  );

  assert.deepEqual(
    progressEventsForCheckInAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: "math.counts-to-5",
      answer: "skip",
      outcome: "completed",
    }),
    [
      {
        name: "progress.checkin_answered",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
          answer: "skip",
        },
      },
      {
        name: "progress.checkin_ended",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          outcome: "completed",
        },
      },
    ],
  );
});

test("conflict resolution updates projection and workflow state", () => {
  assert.deepEqual(
    progressEventsForCheckInResolution({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: "math.counts-to-5",
      checkInState: "active",
    }),
    [
      {
        name: "progress.conflict_resolved",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
          resolution: "confirmed",
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: false,
        },
      },
      {
        name: "progress.checkin_resumed",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          takeover: false,
        },
      },
    ],
  );
});

test("taxonomy-only conflict resolution keeps trusted dimensions", () => {
  assert.deepEqual(
    progressEventsForCheckInResolution({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: TAXONOMY_ITEM_ID,
      checkInState: null,
    }),
    [
      {
        name: "progress.conflict_resolved",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
          resolution: "confirmed",
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: false,
        },
      },
    ],
  );
});

test("accepted walk answers emit once with trusted walk metadata", () => {
  assert.deepEqual(
    progressEventsForWalkAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      subject: "math",
      domain: "counting-cardinality",
      answer: "easily",
      evidenceRecorded: true,
      projectionUpdated: true,
      hadConflict: false,
    }),
    [
      {
        name: "progress.evidence_recorded",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          source: "onboarding_walk",
          items: 1,
          supersedes: false,
        },
      },
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: false,
        },
      },
    ],
  );
  assert.deepEqual(
    progressEventsForWalkAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      subject: "math",
      domain: "counting-cardinality",
      answer: "skip",
      evidenceRecorded: false,
      projectionUpdated: true,
      hadConflict: false,
    }),
    [
      {
        name: "progress.projection_updated",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subjects_touched: 1,
          had_conflict: false,
        },
      },
    ],
  );
});

test("event failures cannot fail a committed product operation", async () => {
  const committedResult = { status: "committed" } as const;
  let emitCalls = 0;
  const returned = await withCommittedProgressEvents(
    Promise.resolve(committedResult),
    async () => {
      emitCalls += 1;
      throw new Error("synthetic analytics failure");
    },
  );
  assert.equal(returned, committedResult);
  assert.equal(emitCalls, 1);
});

test("rejected product operations emit no events", async () => {
  let emitCalls = 0;
  await assert.rejects(
    withCommittedProgressEvents(
      Promise.reject(new Error("synthetic rollback")),
      async () => {
        emitCalls += 1;
      },
    ),
    /synthetic rollback/u,
  );
  assert.equal(emitCalls, 0);
});

test("emitter receives exact typed event payloads", async () => {
  const emitted: ProgressEvent[] = [];
  await emitProgressEvents(
    [
      {
        name: "progress.checkin_answered",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "math",
          domain: "counting-cardinality",
          answer: "getting_there",
        },
      },
    ],
    async <N extends EventName>(
      name: N,
      props: EventProps<N>,
    ) => {
      emitted.push({ name, props } as ProgressEvent);
    },
  );
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0]?.name, "progress.checkin_answered");
  assert.equal(
    "operation_id" in (emitted[0]?.props ?? {}),
    false,
  );
  assert.equal(
    "message_text" in (emitted[0]?.props ?? {}),
    false,
  );
});
