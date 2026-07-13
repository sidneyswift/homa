import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_BANK_VERSION, ageInMonths } from "@homa/core";

import {
  CHILD_PROGRESS_SNAPSHOT_TRANSACTION_SQL,
  buildChildReportCompatibilityUpdate,
  mapPostgresChildProgressOperationRow,
  mapPostgresProgressCheckInResponseRow,
  mapPostgresProgressCheckInRow,
  mapPostgresProgressConflictRow,
  mapPostgresProgressEvidenceRow,
  mapPostgresProgressSelectionResponseRow,
  runRepeatableReadOnlyProgressSnapshot,
  validatePostgresLiveProgressRow,
} from "./postgres-repository-helpers";
import { buildChildProgressView } from "./projection";
import type { ProgressEvidence } from "./types";
import { CHILD_PROGRESS_PROJECTION_VERSION } from "./view-schema";

function liveProjectionFixture() {
  const evidence: ProgressEvidence = {
    id: "evidence-1",
    childId: "child-1",
    familyId: "family-1",
    itemId: "math.counts-to-5",
    answer: "easily",
    source: "checklist",
    memberUserId: "adult-1",
    adultDisplayName: "Elena",
    quote: null,
    channel: null,
    messageId: null,
    checkInId: null,
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-07-11T17:30:00.123456Z",
    createdAt: "2026-07-11T17:30:01.123456Z",
  };
  return buildChildProgressView({
    child: {
      id: "child-1",
      name: "Maya",
      birthDate: "2019-07-01",
    },
    familyId: "family-1",
    timeZone: "America/Chicago",
    evidence: [evidence],
    conflicts: [],
    selectionAnswers: [],
    now: new Date("2026-07-11T18:00:00.000Z"),
  });
}

describe("Postgres child progress snapshot contract", () => {
  it("configures repeatable-read and read-only before every snapshot read", async () => {
    const calls: string[] = [];

    const result = await runRepeatableReadOnlyProgressSnapshot(
      async (statement) => {
        calls.push(statement);
      },
      async () => {
        calls.push("read:child");
        calls.push("read:evidence");
        calls.push("read:conflicts");
        calls.push("read:responses");
        return "snapshot";
      },
    );

    assert.equal(result, "snapshot");
    assert.deepEqual(calls, [
      CHILD_PROGRESS_SNAPSHOT_TRANSACTION_SQL,
      "read:child",
      "read:evidence",
      "read:conflicts",
      "read:responses",
    ]);
    assert.equal(
      CHILD_PROGRESS_SNAPSHOT_TRANSACTION_SQL,
      "set transaction isolation level repeatable read, read only",
    );
  });
});

describe("Postgres child progress row mapping", () => {
  it("prefers the current adult name and falls back to its evidence snapshot", () => {
    const row = {
      id: "evidence-1",
      child_id: "child-1",
      family_id: "family-1",
      item_id: "math.counts-to-5",
      answer: "easily" as const,
      source: "checklist" as const,
      member_user_id: "adult-1",
      current_adult_display_name: "Elena Current",
      adult_display_name_snapshot: "Elena Saved",
      quote: null,
      channel: null,
      message_id: null,
      check_in_id: null,
      supersedes_id: null,
      superseded_at: null,
      observed_at: "2026-07-11T17:30:00.123456Z",
      created_at: "2026-07-11T17:30:01.123456Z",
      idempotency_key: "evidence-1",
    };

    assert.equal(
      mapPostgresProgressEvidenceRow(row).adultDisplayName,
      "Elena Current",
    );
    const fallback = mapPostgresProgressEvidenceRow({
      ...row,
      current_adult_display_name: null,
    });
    assert.equal(fallback.adultDisplayName, "Elena Saved");
    assert.equal("adultDisplayNameSnapshot" in fallback, false);
  });

  it("maps not-sure and skip responses with selection provenance", () => {
    const notSure = mapPostgresProgressSelectionResponseRow({
      id: "response-not-sure",
      evidence_id: null,
      item_id: "math.counts-to-5",
      answer: "not_sure",
      created_at: "2026-07-11T17:30:00.123456Z",
    });
    const skip = mapPostgresProgressSelectionResponseRow({
      id: "response-skip",
      evidence_id: null,
      item_id: "literacy.chapter-books",
      answer: "skip",
      created_at: "2026-07-11T17:31:00.654321Z",
    });

    assert.deepEqual(notSure, {
      selectionId: "response-not-sure",
      evidenceId: null,
      itemId: "math.counts-to-5",
      answer: "not_sure",
      answeredAt: "2026-07-11T17:30:00.123456Z",
    });
    assert.deepEqual(skip, {
      selectionId: "response-skip",
      evidenceId: null,
      itemId: "literacy.chapter-books",
      answer: "skip",
      answeredAt: "2026-07-11T17:31:00.654321Z",
    });
  });

  it("maps conflict created_at to the domain observedAt field", () => {
    const conflict = mapPostgresProgressConflictRow({
      id: "conflict-1",
      child_id: "child-1",
      family_id: "family-1",
      item_id: "math.counts-to-5",
      evidence_id_a: "evidence-1",
      evidence_id_b: "evidence-2",
      state: "open",
      resolved_answer: null,
      resolved_evidence_id: null,
      created_at: "2026-07-11T17:32:00.987654Z",
      resolved_at: null,
    });

    assert.equal(
      conflict.observedAt,
      "2026-07-11T17:32:00.987654Z",
    );
    assert.equal(Object.keys(conflict).includes("createdAt"), false);
  });

  it("maps durable operation receipts without reconstructing them", () => {
    const result = {
      status: "recorded",
      evidenceIds: ["evidence-1"],
      affectedItemIds: ["math.counts-to-5"],
      conflictIds: [],
    };
    assert.deepEqual(
      mapPostgresChildProgressOperationRow({
        id: "00000000-0000-4000-8000-000000000001",
        child_id: "child-1",
        family_id: "family-1",
        idempotency_key: "operation-1",
        payload_hash: "a".repeat(64),
        status: "recorded",
        evidence_ids: ["evidence-1"],
        affected_item_ids: ["math.counts-to-5"],
        conflict_ids: [],
        result,
        created_at: "2026-07-11T18:00:00.123456Z",
      }),
      {
        id: "00000000-0000-4000-8000-000000000001",
        childId: "child-1",
        familyId: "family-1",
        idempotencyKey: "operation-1",
        payloadHash: "a".repeat(64),
        status: "recorded",
        evidenceIds: ["evidence-1"],
        affectedItemIds: ["math.counts-to-5"],
        conflictIds: [],
        result,
        createdAt: "2026-07-11T18:00:00.123456Z",
      },
    );
  });

  it("maps durable check-in ownership and microsecond timestamps", () => {
    assert.deepEqual(
      mapPostgresProgressCheckInRow({
        id: "check-in-1",
        child_id: "child-1",
        child_name: "Maya",
        family_id: "family-1",
        purpose: "subject_deep_dive",
        scope: { subjectIds: ["math"] },
        state: "paused",
        active_member_user_id: "adult-1",
        active_member_display_name: "Elena",
        prompt_recipient_member_user_id: "adult-2",
        prompt_recipient_display_name: "Jordan",
        revision: 2,
        current_item_id: "math.counts-to-5",
        current_delivery_id: "delivery-1",
        episode_id: "episode-1",
        pending_runtime_session_id: null,
        pending_turn_id: null,
        pause_reason: "topic_change",
        opened_at: "2026-07-11T18:00:00.000001Z",
        paused_at: "2026-07-11T18:01:00.000002Z",
        completed_at: null,
        stopped_at: null,
        updated_at: "2026-07-11T18:01:00.000003Z",
      }),
      {
        id: "check-in-1",
        childId: "child-1",
        childName: "Maya",
        familyId: "family-1",
        purpose: "subject_deep_dive",
        scope: { subjectIds: ["math"] },
        state: "paused",
        ownerMemberUserId: "adult-1",
        ownerDisplayName: "Elena",
        recipientMemberUserId: "adult-2",
        recipientDisplayName: "Jordan",
        revision: 2,
        currentItemId: "math.counts-to-5",
        currentDeliveryId: "delivery-1",
        episodeId: "episode-1",
        pendingRuntimeSessionId: null,
        pendingTurnId: null,
        pauseReason: "topic_change",
        openedAt: "2026-07-11T18:00:00.000001Z",
        pausedAt: "2026-07-11T18:01:00.000002Z",
        completedAt: null,
        stoppedAt: null,
        updatedAt: "2026-07-11T18:01:00.000003Z",
      },
    );
  });

  it("rejects an empty stored subject scope", () => {
    assert.throws(
      () =>
        mapPostgresProgressCheckInRow({
          id: "check-in-invalid",
          child_id: "child-1",
          child_name: "Maya",
          family_id: "family-1",
          purpose: "subject_deep_dive",
          scope: { subjectIds: [] },
          state: "active",
          active_member_user_id: null,
          active_member_display_name: null,
          prompt_recipient_member_user_id: null,
          prompt_recipient_display_name: null,
          revision: 1,
          current_item_id: "math.counts-to-5",
          current_delivery_id: null,
          episode_id: null,
          pending_runtime_session_id: "runtime-1",
          pending_turn_id: "turn-1",
          pause_reason: null,
          opened_at: "2026-07-11T18:00:00.000001Z",
          paused_at: null,
          completed_at: null,
          stopped_at: null,
          updated_at: "2026-07-11T18:00:00.000001Z",
        }),
      /scope is invalid/u,
    );
  });

  it("rejects persisted check-in state-shape violations", () => {
    const activeRow = {
      id: "check-in-state",
      child_id: "child-1",
      child_name: "Maya",
      family_id: "family-1",
      purpose: "subject_deep_dive" as const,
      scope: { subjectIds: ["math"] },
      state: "active" as const,
      active_member_user_id: "adult-1",
      active_member_display_name: "Elena",
      prompt_recipient_member_user_id: "adult-1",
      prompt_recipient_display_name: "Elena",
      revision: 1,
      current_item_id: "math.counts-to-5",
      current_delivery_id: null,
      episode_id: "episode-1",
      pending_runtime_session_id: "runtime-1",
      pending_turn_id: "turn-1",
      pause_reason: null,
      opened_at: "2026-07-11T18:00:00.000001Z",
      paused_at: null,
      completed_at: null,
      stopped_at: null,
      updated_at: "2026-07-11T18:00:00.000001Z",
    };
    for (const invalid of [
      { ...activeRow, revision: 0 },
      {
        ...activeRow,
        pending_runtime_session_id: null,
      },
      {
        ...activeRow,
        pause_reason: "topic_change" as const,
        paused_at: "2026-07-11T18:01:00.000000Z",
      },
      {
        ...activeRow,
        state: "paused" as const,
        current_item_id: null,
        pause_reason: "member_removed" as const,
        paused_at: "2026-07-11T18:01:00.000000Z",
      },
      {
        ...activeRow,
        state: "paused" as const,
        pause_reason: "conflict" as const,
        paused_at: "2026-07-11T18:01:00.000000Z",
        pending_runtime_session_id: null,
        pending_turn_id: null,
      },
      {
        ...activeRow,
        state: "completed" as const,
        completed_at: "2026-07-11T18:01:00.000000Z",
      },
      {
        ...activeRow,
        state: "stopped" as const,
        stopped_at: "2026-07-11T18:01:00.000000Z",
      },
    ]) {
      assert.throws(
        () => mapPostgresProgressCheckInRow(invalid),
        /check-in state/u,
      );
    }
  });

  it("maps response idempotency and provider provenance", () => {
    const stored = { status: "completed" };
    assert.deepEqual(
      mapPostgresProgressCheckInResponseRow({
        id: "response-1",
        child_id: "child-1",
        family_id: "family-1",
        check_in_id: "check-in-1",
        revision: 1,
        item_id: "math.counts-to-5",
        answer: "skip",
        member_user_id: "adult-1",
        delivery_id: "delivery-1",
        channel: "sms",
        provider_message_id: "provider-1",
        inbound_message_id:
          "11111111-1111-4111-8111-111111111111",
        is_evidence: false,
        evidence_id: null,
        idempotency_key: "response-key",
        result: stored,
        created_at: "2026-07-11T18:00:00.000001Z",
      }),
      {
        id: "response-1",
        childId: "child-1",
        familyId: "family-1",
        checkInId: "check-in-1",
        revision: 1,
        itemId: "math.counts-to-5",
        answer: "skip",
        memberUserId: "adult-1",
        deliveryId: "delivery-1",
        channel: "sms",
        providerMessageId: "provider-1",
        inboundMessageId:
          "11111111-1111-4111-8111-111111111111",
        isEvidence: false,
        evidenceId: null,
        idempotencyKey: "response-key",
        result: stored,
        createdAt: "2026-07-11T18:00:00.000001Z",
      },
    );
  });

  it("rejects non-microsecond Postgres check-in timestamps", () => {
    assert.throws(
      () =>
        mapPostgresProgressCheckInResponseRow({
          id: "response-invalid-time",
          child_id: "child-1",
          family_id: "family-1",
          check_in_id: "check-in-1",
          revision: 1,
          item_id: "math.counts-to-5",
          answer: "skip",
          member_user_id: null,
          delivery_id: null,
          channel: "web",
          provider_message_id: null,
        inbound_message_id: null,
          is_evidence: false,
          evidence_id: null,
          idempotency_key: "response-invalid-time",
          result: { status: "completed" },
          created_at: "2026-07-11T18:00:00.000Z",
        }),
      /microsecond timestamp/u,
    );
  });
});

describe("compatibility write contract", () => {
  it("omits report token and history fields", () => {
    const view = liveProjectionFixture();
    const update = buildChildReportCompatibilityUpdate({
      childId: "child-1",
      familyId: "family-1",
      view,
      bankVersion: MAP_BANK_VERSION,
      projectionVersion: CHILD_PROGRESS_PROJECTION_VERSION,
      projectionDate: "2026-07-11",
      sourceRevision: BigInt(1),
      evidenceCount: 1,
      openConflictCount: 0,
      compatibilityAnswers: [],
    });

    assert.deepEqual(Object.keys(update).sort(), [
      "bankVersion",
      "generatedAt",
      "narrative",
      "narrativeMeta",
      "scoredAgeMonths",
      "scoredBirthDate",
      "scorerVersion",
      "scores",
      "updatedAt",
    ]);
    assert.equal("token" in update, false);
    assert.equal("history" in update, false);
    assert.equal(update.scoredBirthDate, view.birthDate);
    assert.equal(
      update.scoredAgeMonths,
      ageInMonths(view.birthDate, new Date("2026-07-11T12:00:00.000Z")),
    );
    assert.equal(typeof update.scorerVersion, "string");
  });
});

describe("live projection invalidation", () => {
  it("returns null for stale metadata, count drift, or invalid JSON", () => {
    const projection = liveProjectionFixture();
    const row = {
      projection,
      bank_version: MAP_BANK_VERSION,
      projection_version: CHILD_PROGRESS_PROJECTION_VERSION,
      projection_date: "2026-07-11",
      child_name: "Maya",
      birth_date: "2019-07-01",
      evidence_count: 1,
      open_conflict_count: 0,
      actual_evidence_count: 1,
      actual_open_conflict_count: 0,
      source_revision: "1",
      actual_source_revision: "1",
    };
    const expected = {
      childId: "child-1",
      projectionDate: "2026-07-11",
    };

    assert.deepEqual(
      validatePostgresLiveProgressRow(row, expected),
      projection,
    );
    for (const stale of [
      { ...row, projection_date: "2026-07-10" },
      { ...row, child_name: "Maya Renamed" },
      { ...row, birth_date: "2018-07-01" },
      { ...row, bank_version: "old-bank" },
      { ...row, projection_version: "old-schema" },
      { ...row, actual_evidence_count: 2 },
      { ...row, actual_open_conflict_count: 1 },
      { ...row, actual_source_revision: "2" },
      {
        ...row,
        projection: { ...projection, unknownRoot: true },
      },
      {
        ...row,
        projection: {
          ...projection,
          subjects: projection.subjects.map((subject) => ({
            ...subject,
            domains: subject.domains.map((domain) => ({
              ...domain,
              topics: domain.topics.map((topic) => ({
                ...topic,
                quote: "private",
              })),
            })),
          })),
        },
      },
    ]) {
      assert.equal(
        validatePostgresLiveProgressRow(stale, expected),
        null,
      );
    }
  });
});
