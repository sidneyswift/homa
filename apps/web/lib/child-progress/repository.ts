import type { MAP_BANK_VERSION, MapAnswer } from "@homa/core";

import type {
  ChildProgressView,
  OpenProgressConflict,
  ProgressCheckInChannel,
  ProgressCheckInPauseReason,
  ProgressCheckInPurpose,
  ProgressCheckInRecord,
  ProgressCheckInScope,
  ProgressCheckInState,
  ProgressCheckInTerminalReason,
  ProgressConflict,
  ProgressEvidence,
  ProgressEvidenceAnswer,
  ProgressEvidenceDerivation,
  ProgressSelectionAnswer,
  ResolvedProgressConflict,
  ProgressSourceKind,
} from "./types";

export interface ProgressChildRecord {
  id: string;
  name: string;
  birthDate: string;
}

export interface StoredProgressEvidence extends ProgressEvidence {
  idempotencyKey: string;
}

export interface ChildProgressProjectionInput {
  child: ProgressChildRecord;
  familyId: string;
  timeZone: string;
  sourceRevision: bigint;
  evidence: StoredProgressEvidence[];
  conflicts: ProgressConflict[];
  selectionAnswers: ProgressSelectionAnswer[];
}

interface AppendProgressEvidenceFields {
  childId: string;
  familyId: string;
  itemId: string;
  answer: ProgressEvidenceAnswer;
  derivation: ProgressEvidenceDerivation;
  memberUserId: string | null;
  quote: string | null;
  channel: ProgressCheckInChannel | null;
  messageId: string | null;
  providerMessageId?: string | null;
  supersedesId: string | null;
  observedAt: string;
  idempotencyKey: string;
}

export type AppendProgressEvidenceInput =
  AppendProgressEvidenceFields &
    (
      | { source: "check_in"; checkInId: string }
      | {
          source: Exclude<ProgressSourceKind, "check_in">;
          checkInId: null;
        }
    );

export type ChildProgressOperationStatus =
  | "pending"
  | "activity_only"
  | "no_match"
  | "ambiguous"
  | "recorded"
  | "conflict_open"
  | "conflict_pending"
  | "conflict_resolved"
  | "answers_corrected"
  | "undone";

/**
 * The observation ledger (plan 2026-07-13-observation-ledger.md).
 * Journal input the matcher cannot score is still written durably,
 * inside the same transaction as the operation receipt. Rows never
 * move scores; they feed the weekly reinforcement loop.
 */
export type ChildObservationClassification =
  | "no_match"
  | "activity_only"
  | "ambiguous";

export interface ChildObservationCandidate {
  itemId: string;
  score: number;
}

export interface AppendChildObservationInput {
  childId: string;
  familyId: string;
  memberUserId: string | null;
  quote: string;
  channel: Extract<
    ProgressCheckInChannel,
    "web" | "sms" | "email" | "lesson"
  >;
  messageId: string | null;
  classification: ChildObservationClassification;
  candidates: readonly ChildObservationCandidate[];
  subjectHints: readonly string[];
  observedAt: string;
}

export interface StoredChildObservation {
  id: string;
  childId: string;
  familyId: string;
  classification: ChildObservationClassification;
  status: "new" | "used";
  createdAt: string;
}

export interface MarkChildObservationUsedInput {
  familyId: string;
  observationId: string;
  usedTaskRunId: string | null;
  usedAt: string;
}

export type MarkChildObservationUsedResult =
  | { outcome: "used"; childId: string }
  | { outcome: "already_used"; childId: string }
  | { outcome: "unknown_observation" };

export interface ChildProgressOperationReceipt {
  id: string;
  childId: string;
  familyId: string;
  idempotencyKey: string;
  payloadHash: string;
  status: ChildProgressOperationStatus;
  evidenceIds: string[];
  affectedItemIds: string[];
  conflictIds: string[];
  result: unknown;
  createdAt: string;
}

export interface ClaimChildProgressOperationInput {
  childId: string;
  familyId: string;
  idempotencyKey: string;
  payloadHash: string;
}

export type ClaimChildProgressOperationResult =
  | { kind: "claimed"; receipt: ChildProgressOperationReceipt }
  | { kind: "existing"; receipt: ChildProgressOperationReceipt };

export interface CompleteChildProgressOperationInput {
  childId: string;
  familyId: string;
  idempotencyKey: string;
  payloadHash: string;
  status: Exclude<ChildProgressOperationStatus, "pending">;
  evidenceIds: string[];
  affectedItemIds: string[];
  conflictIds: string[];
  result: unknown;
}

export interface SupersedeProgressEvidenceInput {
  childId: string;
  familyId: string;
  evidenceId: string;
  supersededAt: string;
}

export interface ProgressEvidenceIdentity {
  childId: string;
  familyId: string;
}

export interface InsertOpenProgressConflictInput {
  childId: string;
  familyId: string;
  itemId: string;
  evidenceIdA: string;
  evidenceIdB: string;
  openedAt: string;
}

export type CompatibilityProgressAnswer =
  | {
      kind: "upsert";
      itemId: string;
      answer: MapAnswer;
      source: ProgressSourceKind;
      observedAt: string;
    }
  | {
      kind: "delete";
      itemId: string;
    };

export interface SaveDerivedChildProgressInput {
  childId: string;
  familyId: string;
  view: ChildProgressView;
  bankVersion: typeof MAP_BANK_VERSION;
  projectionVersion: string;
  projectionDate: string;
  sourceRevision: bigint;
  evidenceCount: number;
  openConflictCount: number;
  compatibilityAnswers: CompatibilityProgressAnswer[];
}

export interface SaveProgressCompatibilityAnswersInput {
  childId: string;
  familyId: string;
  compatibilityAnswers: CompatibilityProgressAnswer[];
}

export interface InsertProgressCheckInInput {
  childId: string;
  childName: string;
  familyId: string;
  purpose: ProgressCheckInPurpose;
  scope: ProgressCheckInScope;
  ownerMemberUserId: string | null;
  recipientMemberUserId: string | null;
  currentItemId: string;
  episodeId: string | null;
  pendingRuntimeSessionId: string;
  pendingTurnId: string;
  idempotencyKey: string;
  openedAt: string;
}

export type InsertProgressCheckInResult =
  | {
      kind: "inserted";
      checkIn: ProgressCheckInRecord;
    }
  | {
      kind: "existing";
      checkIn: ProgressCheckInRecord;
    };

export interface ProgressCheckInNextState {
  terminalReason?: ProgressCheckInTerminalReason | null;
  acceptedResponseCount?: number | null;
  uncertainResponseCount?: number | null;
  terminalMixedEvidence?: boolean | null;
  state: ProgressCheckInState;
  ownerMemberUserId: string | null;
  recipientMemberUserId: string | null;
  currentItemId: string | null;
  currentDeliveryId: string | null;
  episodeId: string | null;
  pendingRuntimeSessionId: string | null;
  pendingTurnId: string | null;
  pauseReason: ProgressCheckInPauseReason | null;
  pausedAt: string | null;
  completedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
}

export interface CompareAndSwapProgressCheckInInput {
  familyId: string;
  childId: string;
  checkInId: string;
  expectedRevision: number;
  next: ProgressCheckInNextState;
}

export interface CancelProgressReplyLoopsInput {
  familyId: string;
  checkInId: string;
  keepDeliveryId: string | null;
  keepRevision: number | null;
}

export interface StoredProgressCheckInResponse {
  id: string;
  childId: string;
  familyId: string;
  checkInId: string;
  revision: number;
  itemId: string;
  answer: MapAnswer;
  memberUserId: string | null;
  deliveryId: string | null;
  channel: ProgressCheckInChannel;
  providerMessageId: string | null;
  inboundMessageId: string | null;
  isEvidence: boolean;
  evidenceId: string | null;
  idempotencyKey: string;
  result: unknown;
  createdAt: string;
}

export interface FindProgressCheckInResponseReplayInput {
  familyId: string;
  checkInId: string;
  idempotencyKey: string;
  channel: ProgressCheckInChannel;
  providerMessageId: string | null;
}

export interface InsertProgressCheckInResponseInput
  extends FindProgressCheckInResponseReplayInput {
  childId: string;
  revision: number;
  itemId: string;
  answer: MapAnswer;
  memberUserId: string | null;
  deliveryId: string | null;
  inboundMessageId: string | null;
  createdAt: string;
}

export type InsertProgressCheckInResponseResult =
  | {
      kind: "inserted";
      response: StoredProgressCheckInResponse;
    }
  | {
      kind: "duplicate";
      response: StoredProgressCheckInResponse;
    };

export interface CompleteProgressCheckInResponseInput {
  familyId: string;
  childId: string;
  checkInId: string;
  responseId: string;
  evidenceId: string | null;
  result: unknown;
}

export interface InsertProgressCheckInBaselineSnapshotInput {
  childId: string;
  familyId: string;
  checkInId: string;
  evidenceIds: string[];
  ageMonths: number;
  bankVersion: typeof MAP_BANK_VERSION;
  scorerVersion: string;
  projection: ChildProgressView;
  createdAt: string;
}

export interface ProgressConflictIdentity {
  childId: string;
  familyId: string;
}

export interface LockedProgressConflict {
  conflict: ProgressConflict;
  evidenceA: StoredProgressEvidence;
  evidenceB: StoredProgressEvidence;
}

export interface ResolveProgressConflictInput {
  familyId: string;
  childId: string;
  conflictId: string;
  answer: ProgressEvidenceAnswer;
  evidenceId: string;
  resolverMemberUserId: string;
  resolvedAt: string;
}

export interface BindProgressCheckInDeliveryInput {
  familyId: string;
  childId: string;
  checkInId: string;
  expectedRevision: number;
  deliveryId: string;
  episodeId: string | null;
  runtimeSessionId: string;
  turnId: string;
  updatedAt: string;
}

export interface LoadActiveProgressCheckInInput {
  familyId: string;
  memberUserId: string | null;
  repliedDeliveryId: string | null;
}

export interface StoredMapWalkPrompt {
  id: string;
  childId: string;
  familyId: string;
  subjectId: string;
  topicId: string;
  sitting: number;
  sourceRevision: bigint;
  itemObservedAt: string | null;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  terminalReason:
    | "answered"
    | "expired"
    | "stale"
    | "stopped"
    | null;
  answer: MapAnswer | null;
  idempotencyKey: string | null;
  payloadHash: string | null;
  result: unknown;
}

export interface InsertMapWalkPromptInput {
  id: string;
  childId: string;
  familyId: string;
  subjectId: string;
  topicId: string;
  sitting: number;
  sourceRevision: bigint;
  itemObservedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

export type InsertMapWalkPromptResult =
  | { kind: "inserted"; prompt: StoredMapWalkPrompt }
  | { kind: "existing"; prompt: StoredMapWalkPrompt };

export interface ConsumeMapWalkPromptInput {
  promptId: string;
  childId: string;
  familyId: string;
  answer: MapAnswer | null;
  terminalReason: "answered" | "expired" | "stale" | "stopped";
  idempotencyKey: string;
  payloadHash: string;
  result: unknown;
  consumedAt: string;
}

/**
 * Storage operations available inside one child-scoped transaction.
 * The progress module decides policy; adapters only persist those decisions.
 */
export interface ChildProgressTransaction {
  lockFamilyMemberForKeyShare(
    familyId: string,
    memberUserId: string,
  ): Promise<boolean>;
  loadProjectionInputForUpdate(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null>;
  loadOperation(
    familyId: string,
    childId: string,
    idempotencyKey: string,
  ): Promise<ChildProgressOperationReceipt | null>;
  findOperationById(
    familyId: string,
    operationId: string,
  ): Promise<ChildProgressOperationReceipt | null>;
  findProgressEvidence(
    familyId: string,
    evidenceId: string,
  ): Promise<ProgressEvidenceIdentity | null>;
  appendEvidence(
    input: AppendProgressEvidenceInput,
  ): Promise<StoredProgressEvidence>;
  appendObservation(
    input: AppendChildObservationInput,
  ): Promise<StoredChildObservation>;
  claimOperation(
    input: ClaimChildProgressOperationInput,
  ): Promise<ClaimChildProgressOperationResult>;
  completeOperation(
    input: CompleteChildProgressOperationInput,
  ): Promise<ChildProgressOperationReceipt>;
  loadSourceRevision(
    familyId: string,
    childId: string,
  ): Promise<bigint>;
  supersedeEvidence(
    input: SupersedeProgressEvidenceInput,
  ): Promise<void>;
  insertOpenConflict(
    input: InsertOpenProgressConflictInput,
  ): Promise<OpenProgressConflict>;
  saveCompatibilityAnswers(
    input: SaveProgressCompatibilityAnswersInput,
  ): Promise<void>;
  saveDerivedProgress(
    input: SaveDerivedChildProgressInput,
  ): Promise<void>;
  insertOrLoadActiveMapWalkPrompt(
    input: InsertMapWalkPromptInput,
  ): Promise<InsertMapWalkPromptResult>;
  lockMapWalkPrompt(
    familyId: string,
    childId: string,
    promptId: string,
  ): Promise<StoredMapWalkPrompt | null>;
  consumeMapWalkPrompt(
    input: ConsumeMapWalkPromptInput,
  ): Promise<void>;
}

/**
 * Check-in storage extends the approved ChildProgress transaction without
 * changing the evidence service's narrower dependency.
 */
export interface ProgressCheckInTransaction
  extends ChildProgressTransaction {
  findCheckIn(
    familyId: string,
    checkInId: string,
  ): Promise<ProgressCheckInRecord | null>;
  lockCheckIn(
    familyId: string,
    childId: string,
    checkInId: string,
  ): Promise<ProgressCheckInRecord | null>;
  lockNonterminalCheckInByChild(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null>;
  claimCheckInStartRequest(input: {familyId: string; memberUserId: string; requestId: string; childId: string; subjectId: string; runtimeSessionId: string; turnId: string}): Promise<{kind: "claimed"} | {kind: "existing"; childId: string; subjectId: string; result: unknown}>;
  completeCheckInStartRequest(input: {familyId: string; memberUserId: string; requestId: string; result: unknown}): Promise<void>;
  listCheckInResponses(familyId: string, childId: string, checkInId: string): Promise<Array<Pick<StoredProgressCheckInResponse, "itemId" | "answer">>>;
  insertCheckIn(
    input: InsertProgressCheckInInput,
  ): Promise<InsertProgressCheckInResult>;
  compareAndSwapCheckIn(
    input: CompareAndSwapProgressCheckInInput,
  ): Promise<ProgressCheckInRecord | null>;
  cancelProgressReplyLoops(
    input: CancelProgressReplyLoopsInput,
  ): Promise<number>;
  findCheckInResponseReplay(
    input: FindProgressCheckInResponseReplayInput,
  ): Promise<StoredProgressCheckInResponse | null>;
  insertCheckInResponse(
    input: InsertProgressCheckInResponseInput,
  ): Promise<InsertProgressCheckInResponseResult>;
  completeCheckInResponse(
    input: CompleteProgressCheckInResponseInput,
  ): Promise<void>;
  insertCheckInBaselineSnapshot(
    input: InsertProgressCheckInBaselineSnapshotInput,
  ): Promise<"inserted" | "existing">;
  findProgressConflict(
    familyId: string,
    conflictId: string,
  ): Promise<ProgressConflictIdentity | null>;
  lockProgressConflict(
    familyId: string,
    childId: string,
    conflictId: string,
  ): Promise<LockedProgressConflict | null>;
  resolveProgressConflict(
    input: ResolveProgressConflictInput,
  ): Promise<ResolvedProgressConflict | null>;
  bindCurrentCheckInDelivery(
    input: BindProgressCheckInDeliveryInput,
  ): Promise<ProgressCheckInRecord | null>;
}

/**
 * Transaction seam shared by the Postgres adapter and in-memory tests.
 */
export interface ChildProgressRepository {
  withTransaction<T>(
    operation: (
      transaction: ChildProgressTransaction,
    ) => Promise<T>,
  ): Promise<T>;
  loadLiveView(
    familyId: string,
    childId: string,
    now: Date,
  ): Promise<ChildProgressView | null>;
  loadProjectionInput(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null>;
  markObservationUsed(
    input: MarkChildObservationUsedInput,
  ): Promise<MarkChildObservationUsedResult>;
}

export interface ProgressCheckInRepository
  extends ChildProgressRepository {
  withTransaction<T>(
    operation: (
      transaction: ProgressCheckInTransaction,
    ) => Promise<T>,
  ): Promise<T>;
  listNonterminalCheckInsByFamily(
    familyId: string,
  ): Promise<ProgressCheckInRecord[]>;
  loadNonterminalCheckInByChild(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null>;
  loadActiveCheckInByRecipientOrDelivery(
    input: LoadActiveProgressCheckInInput,
  ): Promise<ProgressCheckInRecord | null>;
}
