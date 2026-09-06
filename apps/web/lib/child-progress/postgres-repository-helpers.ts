import {
  ageInMonths,
  MAP_BANK_VERSION,
  MAP_SCORER_VERSION,
  type MapAnswer,
} from "@homa/core";

import { parseProgressCheckInRecord } from "./check-in-schema";
import type {
  ChildProgressOperationReceipt,
  ChildProgressOperationStatus,
  SaveDerivedChildProgressInput,
  StoredProgressEvidence,
  StoredProgressCheckInResponse,
} from "./repository";
import type {
  ChildProgressView,
  ProgressCheckInChannel,
  ProgressCheckInPauseReason,
  ProgressCheckInPurpose,
  ProgressCheckInRecord,
  ProgressCheckInScope,
  ProgressCheckInState,
  ProgressCheckInTerminalReason,
  ProgressConflict,
  ProgressEvidenceAnswer,
  ProgressEvidenceDerivation,
  ProgressSelectionAnswer,
  ProgressSourceKind,
} from "./types";
import {
  CHILD_PROGRESS_PROJECTION_VERSION,
  childProgressViewSchema,
} from "./view-schema";

export const CHILD_PROGRESS_SNAPSHOT_TRANSACTION_SQL =
  "set transaction isolation level repeatable read, read only";
export const CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY =
  72_460_111_213_330;

export interface PostgresProgressEvidenceRow {
  id: string;
  child_id: string;
  family_id: string;
  item_id: string;
  answer: ProgressEvidenceAnswer;
  derivation: ProgressEvidenceDerivation | null;
  source: ProgressSourceKind;
  member_user_id: string | null;
  current_adult_display_name: string | null;
  adult_display_name_snapshot: string | null;
  quote: string | null;
  channel: ProgressCheckInChannel | null;
  message_id: string | null;
  check_in_id: string | null;
  supersedes_id: string | null;
  superseded_at: string | null;
  observed_at: string;
  created_at: string;
  idempotency_key: string;
}

export interface PostgresProgressConflictRow {
  id: string;
  child_id: string;
  family_id: string;
  item_id: string;
  evidence_id_a: string;
  evidence_id_b: string;
  state: "open" | "resolved";
  resolved_answer: ProgressEvidenceAnswer | null;
  resolved_evidence_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface PostgresProgressSelectionResponseRow {
  id: string;
  child_id: string;
  family_id: string;
  evidence_id: string | null;
  item_id: string;
  answer: MapAnswer;
  created_at: string;
}

export interface PostgresProgressCheckInRow {
  id: string;
  child_id: string;
  child_name: string;
  family_id: string;
  purpose: ProgressCheckInPurpose;
  scope: unknown;
  state: ProgressCheckInState;
  active_member_user_id: string | null;
  active_member_display_name: string | null;
  prompt_recipient_member_user_id: string | null;
  prompt_recipient_display_name: string | null;
  revision: number;
  current_item_id: string | null;
  current_delivery_id: string | null;
  episode_id: string | null;
  pending_runtime_session_id: string | null;
  pending_turn_id: string | null;
  terminal_reason?: ProgressCheckInTerminalReason | null;
  accepted_response_count?: number | null;
  uncertain_response_count?: number | null;
  terminal_mixed_evidence?: boolean | null;
  pause_reason: ProgressCheckInPauseReason | null;
  opened_at: string;
  paused_at: string | null;
  completed_at: string | null;
  stopped_at: string | null;
  updated_at: string;
}

export interface PostgresProgressCheckInResponseRow {
  id: string;
  child_id: string;
  family_id: string;
  check_in_id: string;
  revision: number;
  item_id: string;
  answer: MapAnswer;
  member_user_id: string | null;
  delivery_id: string | null;
  channel: ProgressCheckInChannel;
  provider_message_id: string | null;
  inbound_message_id: string | null;
  is_evidence: boolean;
  evidence_id: string | null;
  idempotency_key: string;
  result: unknown;
  created_at: string;
}

export interface PostgresChildProgressOperationRow {
  id: string;
  child_id: string;
  family_id: string;
  idempotency_key: string;
  payload_hash: string;
  status: ChildProgressOperationStatus;
  evidence_ids: string[];
  affected_item_ids: string[];
  conflict_ids: string[];
  result: unknown;
  created_at: string;
}

export interface PostgresLiveProgressRow {
  projection: unknown;
  bank_version: string;
  projection_version: string;
  projection_date: string;
  child_name: string;
  birth_date: string;
  evidence_count: number;
  open_conflict_count: number;
  actual_evidence_count: number;
  actual_open_conflict_count: number;
  source_revision: string;
  actual_source_revision: string;
}

export function mapPostgresProgressEvidenceRow(
  row: PostgresProgressEvidenceRow,
): StoredProgressEvidence {
  return {
    id: row.id,
    childId: row.child_id,
    familyId: row.family_id,
    itemId: row.item_id,
    answer: row.answer,
    derivation: row.derivation ?? "unknown",
    source: row.source,
    memberUserId: row.member_user_id,
    adultDisplayName:
      row.current_adult_display_name ??
      row.adult_display_name_snapshot,
    quote: row.quote,
    channel: row.channel,
    messageId: row.message_id,
    checkInId: row.check_in_id,
    supersedesId: row.supersedes_id,
    supersededAt: row.superseded_at,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    idempotencyKey: row.idempotency_key,
  };
}

export function mapPostgresProgressConflictRow(
  row: PostgresProgressConflictRow,
): ProgressConflict {
  const shared = {
    id: row.id,
    childId: row.child_id,
    familyId: row.family_id,
    itemId: row.item_id,
    evidenceIdA: row.evidence_id_a,
    evidenceIdB: row.evidence_id_b,
    observedAt: row.created_at,
  };
  switch (row.state) {
    case "open":
      return {
        ...shared,
        state: "open",
        resolvedAnswer: null,
        resolvedEvidenceId: null,
        resolvedAt: null,
      };
    case "resolved":
      if (
        row.resolved_answer === null ||
        row.resolved_evidence_id === null ||
        row.resolved_at === null
      ) {
        throw new TypeError(
          `Resolved progress conflict "${row.id}" is incomplete`,
        );
      }
      return {
        ...shared,
        state: "resolved",
        resolvedAnswer: row.resolved_answer,
        resolvedEvidenceId: row.resolved_evidence_id,
        resolvedAt: row.resolved_at,
      };
    default: {
      const exhaustiveState: never = row.state;
      return exhaustiveState;
    }
  }
}

export function mapPostgresProgressSelectionResponseRow(
  row: PostgresProgressSelectionResponseRow,
): ProgressSelectionAnswer {
  return {
    selectionId: row.id,
    childId: row.child_id,
    familyId: row.family_id,
    evidenceId: row.evidence_id,
    itemId: row.item_id,
    answer: row.answer,
    answeredAt: row.created_at,
  };
}

const POSTGRES_MICROSECOND_UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function requirePostgresMicrosecondTimestamp(
  value: string,
  field: string,
): void {
  if (!POSTGRES_MICROSECOND_UTC_TIMESTAMP.test(value)) {
    throw new TypeError(
      `Postgres ${field} must be a UTC microsecond timestamp`,
    );
  }
}

function parseProgressCheckInScope(
  value: unknown,
): ProgressCheckInScope {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new TypeError("Progress check-in scope must be an object");
  }
  const entries = Object.entries(value);
  const subjectIds =
    "subjectIds" in value ? value.subjectIds : undefined;
  if (entries.some(([key]) => key !== "subjectIds")) {
    throw new TypeError("Progress check-in scope is invalid");
  }
  if (subjectIds === undefined) return {};
  if (
    !Array.isArray(subjectIds) ||
    subjectIds.length === 0 ||
    subjectIds.some(
      (subjectId) => typeof subjectId !== "string",
    )
  ) {
    throw new TypeError("Progress check-in scope is invalid");
  }
  return { subjectIds: [...subjectIds] };
}

export function mapPostgresProgressCheckInRow(
  row: PostgresProgressCheckInRow,
): ProgressCheckInRecord {
  requirePostgresMicrosecondTimestamp(row.opened_at, "opened_at");
  requirePostgresMicrosecondTimestamp(row.updated_at, "updated_at");
  for (const [field, value] of [
    ["paused_at", row.paused_at],
    ["completed_at", row.completed_at],
    ["stopped_at", row.stopped_at],
  ] as const) {
    if (value !== null) {
      requirePostgresMicrosecondTimestamp(value, field);
    }
  }
  const scope = parseProgressCheckInScope(row.scope);
  try {
    return parseProgressCheckInRecord({
      id: row.id,
      childId: row.child_id,
      childName: row.child_name,
      familyId: row.family_id,
      purpose: row.purpose,
      scope,
      state: row.state,
      ownerMemberUserId: row.active_member_user_id,
      ownerDisplayName: row.active_member_display_name,
      recipientMemberUserId:
        row.prompt_recipient_member_user_id,
      recipientDisplayName:
        row.prompt_recipient_display_name,
      revision: row.revision,
      currentItemId: row.current_item_id,
      currentDeliveryId: row.current_delivery_id,
      episodeId: row.episode_id,
      pendingRuntimeSessionId:
        row.pending_runtime_session_id,
      pendingTurnId: row.pending_turn_id,
      terminalReason: row.terminal_reason ?? null,
      acceptedResponseCount: row.accepted_response_count ?? null,
      uncertainResponseCount: row.uncertain_response_count ?? null,
      terminalMixedEvidence: row.terminal_mixed_evidence ?? null,
      pauseReason: row.pause_reason,
      openedAt: row.opened_at,
      pausedAt: row.paused_at,
      completedAt: row.completed_at,
      stoppedAt: row.stopped_at,
      updatedAt: row.updated_at,
    });
  } catch {
    throw new TypeError("Persisted check-in state is invalid");
  }
}

export function mapPostgresProgressCheckInResponseRow(
  row: PostgresProgressCheckInResponseRow,
): StoredProgressCheckInResponse {
  requirePostgresMicrosecondTimestamp(row.created_at, "created_at");
  return {
    id: row.id,
    childId: row.child_id,
    familyId: row.family_id,
    checkInId: row.check_in_id,
    revision: row.revision,
    itemId: row.item_id,
    answer: row.answer,
    memberUserId: row.member_user_id,
    deliveryId: row.delivery_id,
    channel: row.channel,
    providerMessageId: row.provider_message_id,
    inboundMessageId: row.inbound_message_id,
    isEvidence: row.is_evidence,
    evidenceId: row.evidence_id,
    idempotencyKey: row.idempotency_key,
    result: row.result,
    createdAt: row.created_at,
  };
}

export function mapPostgresChildProgressOperationRow(
  row: PostgresChildProgressOperationRow,
): ChildProgressOperationReceipt {
  return {
    id: row.id,
    childId: row.child_id,
    familyId: row.family_id,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    status: row.status,
    evidenceIds: row.evidence_ids,
    affectedItemIds: row.affected_item_ids,
    conflictIds: row.conflict_ids,
    result: row.result,
    createdAt: row.created_at,
  };
}

export function validatePostgresLiveProgressRow(
  row: PostgresLiveProgressRow,
  expected: { childId: string; projectionDate: string },
): ChildProgressView | null {
  if (
    row.bank_version !== MAP_BANK_VERSION ||
    row.projection_version !== CHILD_PROGRESS_PROJECTION_VERSION ||
    row.projection_date !== expected.projectionDate ||
    row.source_revision !== row.actual_source_revision ||
    row.evidence_count !== row.actual_evidence_count ||
    row.open_conflict_count !== row.actual_open_conflict_count
  ) {
    return null;
  }
  const parsed = childProgressViewSchema.safeParse(row.projection);
  if (
    !parsed.success ||
    parsed.data.childId !== expected.childId ||
    parsed.data.childName !== row.child_name ||
    parsed.data.birthDate !== row.birth_date
  ) {
    return null;
  }
  return parsed.data;
}

export function buildChildReportCompatibilityUpdate(
  input: SaveDerivedChildProgressInput,
) {
  return {
    scores: input.view.scores,
    bankVersion: input.bankVersion,
    // The measurement-basis stamps (migration #78): noon UTC of the
    // projection's zoned date is the same age convention the projector
    // itself uses (projection.ts utcNoonForDateKey), so the stamped age
    // always equals the age inside the scores.
    scorerVersion: MAP_SCORER_VERSION,
    scoredBirthDate: input.view.birthDate,
    scoredAgeMonths: ageInMonths(
      input.view.birthDate,
      new Date(`${input.projectionDate}T12:00:00.000Z`),
    ),
    generatedAt: input.view.projectedAt,
    updatedAt: input.view.projectedAt,
    narrative: null,
    narrativeMeta: null,
  };
}

/**
 * Configures one transaction snapshot before any multi-query read begins.
 */
export async function runRepeatableReadOnlyProgressSnapshot<T>(
  executeStatement: (statement: string) => Promise<unknown>,
  loadSnapshot: () => Promise<T>,
): Promise<T> {
  await executeStatement(CHILD_PROGRESS_SNAPSHOT_TRANSACTION_SQL);
  return loadSnapshot();
}
