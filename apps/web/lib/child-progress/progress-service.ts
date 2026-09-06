import {
  MAP_BANK_VERSION,
  getMapItem,
  type MapAnswer,
} from "@homa/core";

import { zonedDateString } from "../time-zone";
import type { ValidatedClaim } from "./claim-validation";
import {
  resolveEffectiveProgressEvidence,
} from "./effective-evidence";
import { isProgressEvidenceAnswer } from "./evidence-policy";
import type { JournalEvidenceMatch } from "./journal-matcher";
import {
  hashChildProgressOperationPayload,
  storedChildProgressOperationResultSchema,
  type StoredChildProgressOperationResult,
} from "./operation-receipt";
import type {
  ChildProgressProjectionInput,
  ChildProgressRepository,
  ChildProgressTransaction,
  CompatibilityProgressAnswer,
  StoredProgressEvidence,
} from "./repository";
import type {
  ChildProgressView,
  ProgressCheckInChannel,
  ProgressConflict,
  ProgressEvidence,
  ProgressEvidenceAnswer,
  ProgressEvidenceDerivation,
  ProgressSelectionAnswer,
  ProgressSourceKind,
} from "./types";
import { childAnswerSelectionId } from "./selection-answer";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import { CHILD_PROGRESS_PROJECTION_VERSION } from "./view-schema";

export type DirectProgressSourceKind = Exclude<
  ProgressSourceKind,
  "journal"
>;
type NonCheckInDirectProgressSourceKind = Exclude<
  DirectProgressSourceKind,
  "check_in"
>;

interface RecordProgressEvidenceFields {
  familyId: string;
  childId: string;
  memberUserId: string | null;
  itemId: string;
  answer: ProgressEvidenceAnswer;
  quote: string | null;
  channel?: ProgressCheckInChannel | null;
  messageId?: string | null;
  providerMessageId?: string | null;
  observedAt: string;
  idempotencyKey: string;
  supersedesEvidenceId?: string;
}

export type RecordProgressEvidenceInput =
  RecordProgressEvidenceFields &
    (
      | { source: "check_in"; checkInId: string }
      | {
          source: NonCheckInDirectProgressSourceKind;
          checkInId?: never;
        }
    );

export interface RecordJournalProgressEvidenceInput {
  familyId: string;
  childId: string;
  memberUserId: string | null;
  quote: string;
  channel: Extract<
    ProgressCheckInChannel,
    "web" | "sms" | "email" | "lesson"
  >;
  /** Conversation provenance. Null only on the lesson channel, where
   * the quote's provenance is the lesson row, not a message. */
  messageId: string | null;
  observedAt: string;
  idempotencyKey: string;
  subjectId?: string;
  /** Lesson listen rides the journal path with its own source label
   * (plan 2026-07-13-lesson-listen.md §4.5). Absent means "journal". */
  source?: "journal" | "lesson_listen";
  /**
   * Claims the caller's judgment step proposed and the deterministic
   * gate accepted (AGENTS.md "Models judge, code verifies"). An empty
   * array means the message was read and reports no ability, which
   * still keeps the parent's words as an observation rather than a
   * guessed score. There is no lexical-matcher fallback.
   *
   * Deliberately excluded from the operation payload hash: a retry
   * re-runs the model and may word its claims slightly differently,
   * and a replayed operation must still replay rather than fail as an
   * idempotency mismatch.
   */
  claims: readonly ValidatedClaim[];
}

export type RecordProgressEvidenceResult =
  | { status: "unknown_child" }
  | { status: "unknown_actor" }
  | { status: "idempotency_mismatch" }
  | {
      status: "duplicate";
      original: ChildProgressOperationOutcome;
    }
  | ProgressWriteResult
  | ProgressConflictPendingResult;

export type RecordJournalProgressEvidenceResult =
  | { status: "unknown_child" }
  | { status: "unknown_actor" }
  | { status: "idempotency_mismatch" }
  | {
      status: "duplicate";
      original: ChildProgressOperationOutcome;
    }
  | JournalNonWriteResult
  | RecordProgressEvidenceResult;

export type ProgressAnswerCorrectionSource = Exclude<
  ProgressSourceKind,
  "journal" | "conversation" | "check_in"
>;

export interface CorrectProgressAnswersInput {
  familyId: string;
  childId: string;
  memberUserId: string | null;
  source: ProgressAnswerCorrectionSource;
  changes: Array<{ itemId: string; answer: MapAnswer | null }>;
  observedAt: string;
  idempotencyKey: string;
}

export interface ProgressAnswersCorrectedOutcome {
  status: "answers_corrected";
  childId: string;
  childName: string;
  operationId: string;
  evidence: ProgressEvidence[];
  affectedItemIds: string[];
}

export type CorrectProgressAnswersResult =
  | ProgressAnswersCorrectedOutcome
  | ProgressConflictPendingResult
  | { status: "unknown_child" }
  | { status: "unknown_actor" }
  | { status: "unknown_item"; itemId: string }
  | { status: "idempotency_mismatch" }
  | {
      status: "duplicate";
      original:
        | ProgressAnswersCorrectedOutcome
        | ProgressConflictPendingResult;
    };

export interface ProgressUndoOutcome {
  status: "undone";
  childId: string;
  childName: string;
  evidenceId: string;
  affectedItemIds: string[];
}

export type UndoProgressEvidenceResult =
  | ProgressUndoOutcome
  | { status: "unknown_evidence" }
  | { status: "unknown_actor" }
  | { status: "idempotency_mismatch" }
  | {
      status: "duplicate";
      original: ProgressUndoOutcome;
    }
  | { status: "conflict_pending"; conflictId: string };

export interface BatchProgressUndoOutcome {
  status: "undone";
  childId: string;
  childName: string;
  operationId: string;
  evidenceIds: string[];
  affectedItemIds: string[];
}

export type UndoProgressOperationResult =
  | BatchProgressUndoOutcome
  | { status: "unknown_operation" }
  | { status: "unknown_actor" }
  | { status: "idempotency_mismatch" }
  | {
      status: "duplicate";
      original: BatchProgressUndoOutcome;
    }
  | { status: "conflict_pending"; conflictId: string };

export type JournalNonWriteResult =
  | { status: "activity_only" }
  | { status: "no_match" }
  | {
      status: "ambiguous";
      candidates: JournalEvidenceMatch[];
    };

export interface ProgressConflictPendingResult {
  status: "conflict_pending";
  conflictId: string;
  itemId: string;
}

export type ChildProgressOperationOutcome =
  | JournalNonWriteResult
  | ProgressWriteResult
  | ProgressConflictPendingResult;

export type ProgressWriteResult =
  | {
      status: "recorded";
      evidence: ProgressEvidence[];
      affectedItemIds: string[];
      conflictIds: string[];
      operationId?: string;
    }
  | {
      status: "conflict_open";
      evidence: ProgressEvidence[];
      affectedItemIds: string[];
      conflictIds: string[];
      operationId?: string;
    };

export interface SavedWalkProgressResult {
  status: "saved";
  evidenceRecorded: boolean;
  projectionUpdated: boolean;
  hadConflict: boolean;
}

export type ChildProgressViewBuilder = (input: {
  child: { id: string; name: string; birthDate: string };
  familyId: string;
  timeZone: string;
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
  selectionAnswers: readonly ProgressSelectionAnswer[];
  now: Date;
}) => ChildProgressView;

export interface ChildProgressServiceOptions {
  buildView: ChildProgressViewBuilder;
  now?: () => Date;
}

interface ProgressEvidenceWriteFields {
  familyId: string;
  childId: string;
  memberUserId: string | null;
  itemId: string;
  answer: ProgressEvidenceAnswer;
  derivation: ProgressEvidenceDerivation;
  quote: string | null;
  channel: ProgressCheckInChannel | null;
  messageId: string | null;
  providerMessageId: string | null;
  observedAt: string;
  idempotencyKey: string;
  supersedesEvidenceId?: string;
}

type ProgressEvidenceWrite = ProgressEvidenceWriteFields &
  (
    | { source: "check_in"; checkInId: string }
    | {
        source: Exclude<ProgressSourceKind, "check_in">;
        checkInId: null;
      }
  );

export type RecordProgressEvidenceInTransactionInput =
  Omit<
    RecordProgressEvidenceFields,
    "channel" | "messageId" | "providerMessageId"
  > & {
    channel: ProgressCheckInChannel | null;
    messageId: string | null;
    providerMessageId?: string | null;
  } &
    (
      | { source: "check_in"; checkInId: string }
      | {
          source: NonCheckInDirectProgressSourceKind;
          checkInId: null;
        }
    );

function journalMatchIdempotencyKey(
  baseKey: string,
  itemId: string,
  index: number,
): string {
  return index === 0
    ? baseKey
    : `${baseKey}:match:${index + 1}:${itemId}`;
}

function validateCheckInProvenance(
  source: ProgressSourceKind,
  checkInId: unknown,
): void {
  if (
    source === "check_in" &&
    (
      typeof checkInId !== "string" ||
      checkInId.trim().length === 0
    )
  ) {
    throw new TypeError("check_in evidence requires a checkInId");
  }
  if (
    source !== "check_in" &&
    checkInId !== null &&
    checkInId !== undefined
  ) {
    throw new TypeError(
      "Only check_in evidence can carry a checkInId",
    );
  }
}

function validateProgressEvidenceWrite(
  write: ProgressEvidenceWrite,
): void {
  validateCheckInProvenance(write.source, write.checkInId);
  // Lesson evidence carries the lesson channel and no message ids: its
  // provenance is the lesson_recordings row named inside the
  // idempotency key (plan 2026-07-13-lesson-listen.md §4.5).
  if (write.source === "lesson_listen" && write.channel !== "lesson") {
    throw new TypeError(
      "lesson_listen evidence requires the lesson channel",
    );
  }
  if (write.source !== "lesson_listen" && write.channel === "lesson") {
    throw new TypeError(
      "the lesson channel is reserved for lesson_listen evidence",
    );
  }
  const needsConversationProvenance =
    write.source === "journal" ||
    write.source === "conversation" ||
    write.source === "check_in";
  if (
    needsConversationProvenance &&
    (
      (
        write.channel !== "web" &&
        write.channel !== "sms" &&
        write.channel !== "email"
      ) ||
      (
        write.messageId === null ||
        write.messageId.trim().length === 0
      ) &&
      (
        write.providerMessageId === null ||
        write.providerMessageId.trim().length === 0
      )
    )
  ) {
    throw new TypeError(
      `${write.source} evidence requires trusted message provenance`,
    );
  }
  if (write.idempotencyKey.trim().length === 0) {
    throw new TypeError("Progress evidence requires an idempotency key");
  }
  if (
    write.quote !== null &&
    Array.from(write.quote).length > 500
  ) {
    throw new TypeError(
      "Progress evidence quote cannot exceed 500 characters",
    );
  }
  parseOffsetIsoTimestampEpochNanoseconds(write.observedAt);
}

function toPublicProgressEvidence(
  evidence: StoredProgressEvidence,
): ProgressEvidence {
  return {
    id: evidence.id,
    childId: evidence.childId,
    familyId: evidence.familyId,
    itemId: evidence.itemId,
    answer: evidence.answer,
    derivation: evidence.derivation,
    source: evidence.source,
    memberUserId: evidence.memberUserId,
    adultDisplayName: evidence.adultDisplayName,
    quote: evidence.quote,
    channel: evidence.channel,
    messageId: evidence.messageId,
    checkInId: evidence.checkInId,
    supersedesId: evidence.supersedesId,
    supersededAt: evidence.supersededAt,
    observedAt: evidence.observedAt,
    createdAt: evidence.createdAt,
  };
}

/**
 * Orchestrates progress policy through a transaction-capable repository.
 */
export class ChildProgressService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: ChildProgressRepository,
    private readonly options: ChildProgressServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async getChildProgressView(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressView | null> {
    const now = this.now();
    const liveView = await this.repository.loadLiveView(
      familyId,
      childId,
      now,
    );
    if (liveView !== null) return liveView;

    const projectionInput =
      await this.repository.loadProjectionInput(familyId, childId);
    if (projectionInput === null) return null;
    return this.options.buildView({
      ...projectionInput,
      now,
    });
  }

  /**
   * The receipt spine's read: one child's whole ledger, quotes and all.
   *
   * getChildProgressView above prefers the cached projection, which is
   * right for the Progress page and useless here: it holds one effective
   * row per item and no quote at all, so neither min(observed_at) nor a
   * parent's own words can be recovered from it. A receipt surface has to
   * come down to the rows themselves.
   */
  getChildProgressLedger(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    return this.repository.loadProjectionInput(familyId, childId);
  }

  async recordJournalProgressEvidence(
    input: RecordJournalProgressEvidenceInput,
  ): Promise<RecordJournalProgressEvidenceResult> {
    this.validateOperationInput(
      input.idempotencyKey,
      input.observedAt,
      input.quote,
    );
    const payloadHash = hashChildProgressOperationPayload({
      kind: "journal",
      familyId: input.familyId,
      childId: input.childId,
      memberUserId: input.memberUserId,
      quote: input.quote,
      channel: input.channel,
      messageId: input.messageId,
      observedAt: input.observedAt,
      idempotencyKey: input.idempotencyKey,
      source: input.source,
      subjectId: input.subjectId ?? null,
    });
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "unknown_actor" };
      }
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          input.childId,
        );
      if (projectionInput === null) {
        return { status: "unknown_child" };
      }
      const replay = await this.claimOperationOrReplay(
        transaction,
        projectionInput,
        input.idempotencyKey,
        payloadHash,
      );
      if (replay !== null) return replay;

      // The caller already ran the judgment step and the deterministic
      // gate (AGENTS.md "Models judge, code verifies"). There is no
      // lexical-matcher fallback: an empty claims array means the
      // message was read and reports no ability, which still keeps the
      // parent's words as an observation rather than a guessed score.
      const writes = this.claimWrites(input, input.claims);
      if (writes.length === 0) {
        // Still writes a child_observations row in this same transaction
        // (plan 2026-07-13-observation-ledger.md): the parent's report
        // survives even though no score moves.
        await this.appendJournalObservation(transaction, input);
        return this.completeOperation(transaction, input, payloadHash, {
          status: "no_match",
        });
      }
      writes.forEach(validateProgressEvidenceWrite);
      const pending = this.findPendingConflict(projectionInput, writes);
      if (pending !== null) {
        return this.completeOperation(
          transaction,
          input,
          payloadHash,
          pending,
        );
      }
      const result = await this.recordKnownChildEvidence(
        transaction,
        projectionInput,
        writes,
      );
      return this.completeOperation(
        transaction,
        input,
        payloadHash,
        result,
      );
    });
  }

  async recordProgressEvidence(
    input: RecordProgressEvidenceInput,
  ): Promise<RecordProgressEvidenceResult> {
    const suppliedCheckInId =
      "checkInId" in input ? input.checkInId : undefined;
    validateCheckInProvenance(input.source, suppliedCheckInId);
    const transactionInput: RecordProgressEvidenceInTransactionInput =
      input.source === "check_in"
        ? {
            ...input,
            channel: input.channel ?? null,
            messageId: input.messageId ?? null,
            providerMessageId: input.providerMessageId ?? null,
          }
        : {
            ...input,
            channel: input.channel ?? null,
            messageId: input.messageId ?? null,
            providerMessageId: input.providerMessageId ?? null,
            checkInId: null,
          };
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "unknown_actor" };
      }
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          input.childId,
        );
      if (projectionInput === null) {
        return { status: "unknown_child" };
      }
      return this.recordProgressEvidenceInTransaction(
        transaction,
        projectionInput,
        transactionInput,
      );
    });
  }

  async correctProgressAnswers(
    input: CorrectProgressAnswersInput,
  ): Promise<CorrectProgressAnswersResult> {
    this.validateOperationInput(
      input.idempotencyKey,
      input.observedAt,
      null,
    );
    if (input.changes.length === 0) {
      throw new TypeError("Progress correction batch cannot be empty");
    }
    const seenItemIds = new Set<string>();
    for (const change of input.changes) {
      if (
        getMapItem(change.itemId) === undefined ||
        seenItemIds.has(change.itemId)
      ) {
        return { status: "unknown_item", itemId: change.itemId };
      }
      seenItemIds.add(change.itemId);
    }
    const payloadHash = hashChildProgressOperationPayload({
      kind: "answer_correction",
      familyId: input.familyId,
      childId: input.childId,
      memberUserId: input.memberUserId,
      source: input.source,
      changes: input.changes,
    });
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "unknown_actor" };
      }
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          input.childId,
        );
      if (projectionInput === null) {
        return { status: "unknown_child" };
      }
      const claim = await transaction.claimOperation({
        childId: input.childId,
        familyId: input.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      });
      if (claim.kind === "existing") {
        if (claim.receipt.payloadHash !== payloadHash) {
          return { status: "idempotency_mismatch" };
        }
        const stored = storedChildProgressOperationResultSchema.parse(
          claim.receipt.result,
        );
        if (stored.status === "answers_corrected") {
          return {
            status: "duplicate",
            original: {
              ...stored,
              operationId: claim.receipt.id,
            },
          };
        }
        if (stored.status === "conflict_pending") {
          return {
            status: "duplicate",
            original: stored,
          };
        }
        throw new Error(
          "Stored progress correction receipt is incomplete",
        );
      }
      const affectedItemIds = [...seenItemIds].sort();
      const pendingConflict = projectionInput.conflicts.find(
        (conflict) =>
          conflict.state === "open" &&
          seenItemIds.has(conflict.itemId),
      );
      if (pendingConflict !== undefined) {
        const result: ProgressConflictPendingResult = {
          status: "conflict_pending",
          conflictId: pendingConflict.id,
          itemId: pendingConflict.itemId,
        };
        await transaction.completeOperation({
          childId: input.childId,
          familyId: input.familyId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          status: result.status,
          evidenceIds: [],
          affectedItemIds: [result.itemId],
          conflictIds: [result.conflictId],
          result,
        });
        return result;
      }

      const recordedEvidence: StoredProgressEvidence[] = [];
      const compatibilityOverrides =
        new Map<string, CompatibilityProgressAnswer>();
      const correctionCutoff =
        parseOffsetIsoTimestampEpochNanoseconds(
          input.observedAt,
        );
      for (const [index, change] of input.changes.entries()) {
        const selectionId = childAnswerSelectionId(
          input.childId,
          change.itemId,
        );
        projectionInput.selectionAnswers =
          projectionInput.selectionAnswers.filter(
            (answer) => answer.selectionId !== selectionId,
          );
        const activeEvidenceAtCutoff =
          projectionInput.evidence.filter(
            (evidence) =>
              evidence.itemId === change.itemId &&
              evidence.supersededAt === null &&
              parseOffsetIsoTimestampEpochNanoseconds(
                evidence.observedAt,
              ) <= correctionCutoff,
          );
        for (const evidence of activeEvidenceAtCutoff) {
          await transaction.supersedeEvidence({
            childId: input.childId,
            familyId: input.familyId,
            evidenceId: evidence.id,
            supersededAt: input.observedAt,
          });
          evidence.supersededAt = input.observedAt;
        }
        const hasPostCutoffEvidence =
          projectionInput.evidence.some(
            (evidence) =>
              evidence.itemId === change.itemId &&
              evidence.supersededAt === null,
          );
        const shouldOverrideCompatibility =
          !hasPostCutoffEvidence;
        if (change.answer === null) {
          if (shouldOverrideCompatibility) {
            compatibilityOverrides.set(change.itemId, {
              kind: "delete",
              itemId: change.itemId,
            });
          }
          continue;
        }
        if (!isProgressEvidenceAnswer(change.answer)) {
          if (shouldOverrideCompatibility) {
            compatibilityOverrides.set(change.itemId, {
              kind: "upsert",
              itemId: change.itemId,
              answer: change.answer,
              source: input.source,
              observedAt: input.observedAt,
            });
          }
          projectionInput.selectionAnswers.push({
            selectionId,
            childId: input.childId,
            familyId: input.familyId,
            evidenceId: null,
            itemId: change.itemId,
            answer: change.answer,
            answeredAt: input.observedAt,
          });
          continue;
        }
        const evidence = await this.appendEvidenceWrite(
          transaction,
          projectionInput,
          {
            familyId: input.familyId,
            childId: input.childId,
            memberUserId: input.memberUserId,
            source: input.source,
            derivation: "direct",
            itemId: change.itemId,
            answer: change.answer,
            quote: null,
            channel: null,
            messageId: null,
            providerMessageId: null,
            observedAt: input.observedAt,
            idempotencyKey:
              `${input.idempotencyKey}:change:${index + 1}:${change.itemId}`,
            checkInId: null,
          },
          this.now(),
        );
        recordedEvidence.push(evidence);
        projectionInput.selectionAnswers.push({
          selectionId,
          childId: input.childId,
          familyId: input.familyId,
          evidenceId: evidence.id,
          itemId: change.itemId,
          answer: change.answer,
          answeredAt: input.observedAt,
        });
      }
      await this.refreshDerivedProgressInTransaction(
        transaction,
        projectionInput,
        affectedItemIds,
        new Date(input.observedAt),
        compatibilityOverrides,
      );
      const storedResult = {
        status: "answers_corrected" as const,
        childId: projectionInput.child.id,
        childName: projectionInput.child.name,
        evidence: recordedEvidence.map(toPublicProgressEvidence),
        affectedItemIds,
      };
      const receipt = await transaction.completeOperation({
        childId: input.childId,
        familyId: input.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        status: storedResult.status,
        evidenceIds: recordedEvidence.map((evidence) => evidence.id),
        affectedItemIds,
        conflictIds: [],
        result: storedResult,
      });
      return {
        ...storedResult,
        operationId: receipt.id,
      };
    });
  }

  async undoProgressEvidence(input: {
    familyId: string;
    memberUserId: string | null;
    evidenceId: string;
    idempotencyKey: string;
    observedAt: string;
  }): Promise<UndoProgressEvidenceResult> {
    this.validateOperationInput(
      input.idempotencyKey,
      input.observedAt,
      null,
    );
    const payloadHash = hashChildProgressOperationPayload({
      kind: "undo",
      familyId: input.familyId,
      evidenceId: input.evidenceId,
    });
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "unknown_actor" };
      }
      const identity = await transaction.findProgressEvidence(
        input.familyId,
        input.evidenceId,
      );
      if (identity === null) return { status: "unknown_evidence" };
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          identity.childId,
        );
      if (projectionInput === null) {
        return { status: "unknown_evidence" };
      }
      const existingOperation = await transaction.loadOperation(
        input.familyId,
        identity.childId,
        input.idempotencyKey,
      );
      if (existingOperation !== null) {
        if (existingOperation.payloadHash !== payloadHash) {
          return { status: "idempotency_mismatch" };
        }
        const stored = storedChildProgressOperationResultSchema.parse(
          existingOperation.result,
        );
        if (
          existingOperation.status !== "undone" ||
          stored.status !== "undone" ||
          stored.evidenceId === undefined
        ) {
          throw new Error("Stored progress undo receipt is incomplete");
        }
        return {
          status: "duplicate",
          original: {
            status: "undone",
            childId: stored.childId,
            childName: stored.childName,
            evidenceId: stored.evidenceId,
            affectedItemIds: stored.affectedItemIds,
          },
        };
      }
      const evidence = projectionInput.evidence.find(
        (candidate) =>
          candidate.id === input.evidenceId &&
          candidate.supersededAt === null,
      );
      if (evidence === undefined) {
        return { status: "unknown_evidence" };
      }
      const openConflict = projectionInput.conflicts.find(
        (conflict) =>
          conflict.state === "open" &&
          (
            conflict.evidenceIdA === evidence.id ||
            conflict.evidenceIdB === evidence.id
          ),
      );
      if (openConflict !== undefined) {
        return {
          status: "conflict_pending",
          conflictId: openConflict.id,
        };
      }
      const claim = await transaction.claimOperation({
        childId: evidence.childId,
        familyId: evidence.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      });
      if (claim.kind !== "claimed") {
        throw new Error("Progress undo claim raced unexpectedly");
      }
      await transaction.supersedeEvidence({
        childId: evidence.childId,
        familyId: evidence.familyId,
        evidenceId: evidence.id,
        supersededAt: input.observedAt,
      });
      evidence.supersededAt = input.observedAt;
      await this.refreshDerivedProgressInTransaction(
        transaction,
        projectionInput,
        [evidence.itemId],
        new Date(input.observedAt),
      );
      const outcome: ProgressUndoOutcome = {
        status: "undone",
        childId: projectionInput.child.id,
        childName: projectionInput.child.name,
        evidenceId: evidence.id,
        affectedItemIds: [evidence.itemId],
      };
      await transaction.completeOperation({
        childId: evidence.childId,
        familyId: evidence.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        status: "undone",
        evidenceIds: [evidence.id],
        affectedItemIds: [evidence.itemId],
        conflictIds: [],
        result: outcome,
      });
      return outcome;
    });
  }

  async undoProgressOperation(input: {
    familyId: string;
    memberUserId: string | null;
    operationId: string;
    idempotencyKey: string;
    observedAt: string;
  }): Promise<UndoProgressOperationResult> {
    this.validateOperationInput(
      input.idempotencyKey,
      input.observedAt,
      null,
    );
    const payloadHash = hashChildProgressOperationPayload({
      kind: "undo_operation",
      familyId: input.familyId,
      operationId: input.operationId,
    });
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "unknown_actor" };
      }
      const sourceOperation = await transaction.findOperationById(
        input.familyId,
        input.operationId,
      );
      if (
        sourceOperation === null ||
        (
          sourceOperation.status !== "recorded" &&
          sourceOperation.status !== "conflict_open"
        )
      ) {
        return { status: "unknown_operation" };
      }
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          sourceOperation.childId,
        );
      if (projectionInput === null) {
        return { status: "unknown_operation" };
      }
      const existingUndo = await transaction.loadOperation(
        input.familyId,
        sourceOperation.childId,
        input.idempotencyKey,
      );
      if (existingUndo !== null) {
        if (existingUndo.payloadHash !== payloadHash) {
          return { status: "idempotency_mismatch" };
        }
        const stored = storedChildProgressOperationResultSchema.parse(
          existingUndo.result,
        );
        if (
          existingUndo.status !== "undone" ||
          stored.status !== "undone" ||
          stored.operationId === undefined ||
          stored.evidenceIds === undefined
        ) {
          throw new Error("Stored batch undo receipt is incomplete");
        }
        return {
          status: "duplicate",
          original: {
            status: "undone",
            childId: stored.childId,
            childName: stored.childName,
            operationId: stored.operationId,
            evidenceIds: stored.evidenceIds,
            affectedItemIds: stored.affectedItemIds,
          },
        };
      }
      const sourceEvidenceIds = new Set(
        sourceOperation.evidenceIds,
      );
      const activeEvidence = projectionInput.evidence.filter(
        (evidence) =>
          sourceEvidenceIds.has(evidence.id) &&
          evidence.supersededAt === null,
      );
      if (activeEvidence.length === 0) {
        return { status: "unknown_operation" };
      }
      const conflicted = projectionInput.conflicts.find(
        (conflict) =>
          conflict.state === "open" &&
          activeEvidence.some(
            (evidence) =>
              conflict.evidenceIdA === evidence.id ||
              conflict.evidenceIdB === evidence.id,
          ),
      );
      if (conflicted !== undefined) {
        return {
          status: "conflict_pending",
          conflictId: conflicted.id,
        };
      }
      const claim = await transaction.claimOperation({
        childId: sourceOperation.childId,
        familyId: sourceOperation.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      });
      if (claim.kind !== "claimed") {
        throw new Error("Batch progress undo claim raced unexpectedly");
      }
      for (const evidence of activeEvidence) {
        await transaction.supersedeEvidence({
          childId: evidence.childId,
          familyId: evidence.familyId,
          evidenceId: evidence.id,
          supersededAt: input.observedAt,
        });
        evidence.supersededAt = input.observedAt;
      }
      const affectedItemIds = [
        ...new Set(activeEvidence.map((evidence) => evidence.itemId)),
      ];
      await this.refreshDerivedProgressInTransaction(
        transaction,
        projectionInput,
        affectedItemIds,
        new Date(input.observedAt),
      );
      const outcome: BatchProgressUndoOutcome = {
        status: "undone",
        childId: projectionInput.child.id,
        childName: projectionInput.child.name,
        operationId: sourceOperation.id,
        evidenceIds: activeEvidence.map((evidence) => evidence.id),
        affectedItemIds,
      };
      await transaction.completeOperation({
        childId: sourceOperation.childId,
        familyId: sourceOperation.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        status: "undone",
        evidenceIds: outcome.evidenceIds,
        affectedItemIds,
        conflictIds: [],
        result: outcome,
      });
      return outcome;
    });
  }

  async recordProgressEvidenceInTransaction(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    input: RecordProgressEvidenceInTransactionInput,
  ): Promise<RecordProgressEvidenceResult> {
    const write: ProgressEvidenceWrite = {
      ...input,
      derivation: "direct",
      channel: input.channel ?? null,
      messageId: input.messageId ?? null,
      providerMessageId: input.providerMessageId ?? null,
    };
    validateProgressEvidenceWrite(write);
    const payloadHash = hashChildProgressOperationPayload({
      kind: "direct",
      familyId: input.familyId,
      childId: input.childId,
      memberUserId: input.memberUserId,
      source: input.source,
      itemId: input.itemId,
      answer: input.answer,
      quote: input.quote,
      channel: input.channel,
      messageId: input.messageId,
      providerMessageId: input.providerMessageId,
      checkInId:
        input.source === "check_in" ? input.checkInId : null,
      supersedesEvidenceId: input.supersedesEvidenceId ?? null,
    });
    const replay = await this.claimOperationOrReplay(
      transaction,
      projectionInput,
      input.idempotencyKey,
      payloadHash,
    );
    if (replay !== null) return replay;
    const pending = this.findPendingConflict(
      projectionInput,
      [write],
    );
    if (pending !== null) {
      return this.completeOperation(
        transaction,
        input,
        payloadHash,
        pending,
      );
    }
    const result = await this.recordKnownChildEvidence(
      transaction,
      projectionInput,
      [write],
    );
    return this.completeOperation(
      transaction,
      input,
      payloadHash,
      result,
    );
  }

  async recordWalkAnswerInTransaction(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    input: {
      familyId: string;
      childId: string;
      memberUserId: string | null;
      itemId: string;
      answer: MapAnswer;
      channel: "web" | "sms";
      observedAt: string;
      idempotencyKey: string;
    },
  ): Promise<
    | SavedWalkProgressResult
    | { status: "conflict_pending" }
    | { status: "idempotency_mismatch" }
  > {
    if (isProgressEvidenceAnswer(input.answer)) {
      const result = await this.recordProgressEvidenceInTransaction(
        transaction,
        projectionInput,
        {
          familyId: input.familyId,
          childId: input.childId,
          memberUserId: input.memberUserId,
          source: "onboarding_walk",
          itemId: input.itemId,
          answer: input.answer,
          quote: null,
          channel: input.channel,
          messageId: null,
          providerMessageId: null,
          observedAt: input.observedAt,
          idempotencyKey: input.idempotencyKey,
          checkInId: null,
        },
      );
      if (
        result.status === "recorded" ||
        result.status === "conflict_open"
      ) {
        return {
          status: "saved",
          evidenceRecorded: true,
          projectionUpdated: true,
          hadConflict: result.status === "conflict_open",
        };
      }
      if (result.status === "duplicate") {
        return (
          result.original.status === "recorded" ||
          result.original.status === "conflict_open"
        )
          ? {
              status: "saved",
              evidenceRecorded: false,
              projectionUpdated: false,
              hadConflict: false,
            }
          : { status: "conflict_pending" };
      }
      return result.status === "idempotency_mismatch"
        ? result
        : { status: "conflict_pending" };
    }
    const openConflict = projectionInput.conflicts.some(
      (conflict) =>
        conflict.state === "open" &&
        conflict.itemId === input.itemId,
    );
    if (openConflict) return { status: "conflict_pending" };
    const payloadHash = hashChildProgressOperationPayload({
      kind: "walk_coverage",
      familyId: input.familyId,
      childId: input.childId,
      itemId: input.itemId,
      answer: input.answer,
    });
    const claim = await transaction.claimOperation({
      childId: input.childId,
      familyId: input.familyId,
      idempotencyKey: input.idempotencyKey,
      payloadHash,
    });
    if (claim.kind === "existing") {
      return claim.receipt.payloadHash === payloadHash
        ? {
            status: "saved",
            evidenceRecorded: false,
            projectionUpdated: false,
            hadConflict: false,
          }
        : { status: "idempotency_mismatch" };
    }
    const cutoff =
      parseOffsetIsoTimestampEpochNanoseconds(input.observedAt);
    for (const evidence of projectionInput.evidence) {
      if (
        evidence.itemId !== input.itemId ||
        evidence.supersededAt !== null ||
        parseOffsetIsoTimestampEpochNanoseconds(
          evidence.observedAt,
        ) > cutoff
      ) {
        continue;
      }
      await transaction.supersedeEvidence({
        childId: input.childId,
        familyId: input.familyId,
        evidenceId: evidence.id,
        supersededAt: input.observedAt,
      });
      evidence.supersededAt = input.observedAt;
    }
    const selectionId = childAnswerSelectionId(
      input.childId,
      input.itemId,
    );
    projectionInput.selectionAnswers =
      projectionInput.selectionAnswers.filter(
        (answer) => answer.selectionId !== selectionId,
      );
    projectionInput.selectionAnswers.push({
      selectionId,
      childId: input.childId,
      familyId: input.familyId,
      evidenceId: null,
      itemId: input.itemId,
      answer: input.answer,
      answeredAt: input.observedAt,
    });
    await this.refreshDerivedProgressInTransaction(
      transaction,
      projectionInput,
      [input.itemId],
      new Date(input.observedAt),
      new Map([
        [
          input.itemId,
          {
            kind: "upsert" as const,
            itemId: input.itemId,
            answer: input.answer,
            source: "onboarding_walk" as const,
            observedAt: input.observedAt,
          },
        ],
      ]),
    );
    const result = {
      status: "answers_corrected" as const,
      childId: projectionInput.child.id,
      childName: projectionInput.child.name,
      evidence: [],
      affectedItemIds: [input.itemId],
    };
    await transaction.completeOperation({
      childId: input.childId,
      familyId: input.familyId,
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      status: result.status,
      evidenceIds: [],
      affectedItemIds: result.affectedItemIds,
      conflictIds: [],
      result,
    });
    return {
      status: "saved",
      evidenceRecorded: false,
      projectionUpdated: true,
      hadConflict: false,
    };
  }

  buildCurrentProgressView(
    projectionInput: ChildProgressProjectionInput,
    now: Date,
  ): ChildProgressView {
    return this.options.buildView({
      ...projectionInput,
      now,
    });
  }

  async refreshDerivedProgressInTransaction(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    affectedItemIds: readonly string[],
    now: Date,
    compatibilityOverrides: ReadonlyMap<
      string,
      CompatibilityProgressAnswer
    > = new Map(),
  ): Promise<ChildProgressView> {
    const view = this.buildCurrentProgressView(projectionInput, now);
    const resolution = resolveEffectiveProgressEvidence({
      childId: projectionInput.child.id,
      familyId: projectionInput.familyId,
      evidence: projectionInput.evidence,
      conflicts: projectionInput.conflicts,
    });
    const compatibilityAnswers = this.buildCompatibilityAnswers(
      affectedItemIds,
      resolution.effectiveEvidence,
      compatibilityOverrides,
    );
    await transaction.saveCompatibilityAnswers({
      childId: projectionInput.child.id,
      familyId: projectionInput.familyId,
      compatibilityAnswers,
    });
    const sourceRevision = await transaction.loadSourceRevision(
      projectionInput.familyId,
      projectionInput.child.id,
    );
    projectionInput.sourceRevision = sourceRevision;
    await transaction.saveDerivedProgress({
      childId: projectionInput.child.id,
      familyId: projectionInput.familyId,
      view,
      bankVersion: MAP_BANK_VERSION,
      projectionVersion: CHILD_PROGRESS_PROJECTION_VERSION,
      projectionDate: zonedDateString(
        now,
        projectionInput.timeZone,
      ),
      sourceRevision,
      evidenceCount: projectionInput.evidence.length,
      openConflictCount: resolution.openConflicts.length,
      compatibilityAnswers,
    });
    return view;
  }

  /**
   * Records a journal message that produced no claims. There is no
   * lexical matcher left to propose near-miss candidates, so the row
   * carries only the parent's own words and, if named, the subject the
   * caller already scoped the message to.
   */
  private async appendJournalObservation(
    transaction: ChildProgressTransaction,
    input: RecordJournalProgressEvidenceInput,
  ): Promise<void> {
    await transaction.appendObservation({
      childId: input.childId,
      familyId: input.familyId,
      memberUserId: input.memberUserId,
      quote: input.quote,
      channel: input.channel,
      messageId: input.messageId,
      classification: "no_match",
      candidates: [],
      subjectHints: input.subjectId !== undefined ? [input.subjectId] : [],
      observedAt: input.observedAt,
    });
  }

  private validateOperationInput(
    idempotencyKey: string,
    observedAt: string,
    quote: string | null,
  ): void {
    if (idempotencyKey.trim().length === 0) {
      throw new TypeError(
        "Progress evidence requires an idempotency key",
      );
    }
    if (quote !== null && Array.from(quote).length > 8_000) {
      throw new TypeError(
        "Journal input cannot exceed 8000 characters",
      );
    }
    parseOffsetIsoTimestampEpochNanoseconds(observedAt);
  }

  /**
   * Validated claims to evidence writes. The claim's quote is the
   * parent's own words, already proven to appear in her message by
   * claim-validation.ts, so it carries the same provenance the matcher
   * path got from the clause it matched.
   */
  private claimWrites(
    input: RecordJournalProgressEvidenceInput,
    claims: readonly ValidatedClaim[],
  ): ProgressEvidenceWrite[] {
    return claims
      .filter((claim) => claim.childId === input.childId)
      .map((claim, index) => ({
        familyId: input.familyId,
        childId: input.childId,
        memberUserId: input.memberUserId,
        source: input.source ?? "journal",
        derivation:
          claim.confidence === "high" ? "direct" : "inferred",
        itemId: claim.itemId,
        answer: claim.answer,
        quote: Array.from(claim.quote).slice(0, 500).join(""),
        channel: input.channel,
        messageId: input.messageId,
        providerMessageId: null,
        observedAt: input.observedAt,
        idempotencyKey: journalMatchIdempotencyKey(
          input.idempotencyKey,
          claim.itemId,
          index,
        ),
        checkInId: null,
      }));
  }


  private findPendingConflict(
    projectionInput: ChildProgressProjectionInput,
    writes: readonly ProgressEvidenceWrite[],
  ): ProgressConflictPendingResult | null {
    const affectedItems = new Set(
      writes.map((write) => write.itemId),
    );
    const conflict = projectionInput.conflicts.find(
      (candidate) =>
        candidate.state === "open" &&
        affectedItems.has(candidate.itemId),
    );
    return conflict === undefined
      ? null
      : {
          status: "conflict_pending",
          conflictId: conflict.id,
          itemId: conflict.itemId,
        };
  }

  private async claimOperationOrReplay(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    idempotencyKey: string,
    payloadHash: string,
  ): Promise<
    | { status: "idempotency_mismatch" }
    | {
        status: "duplicate";
        original: ChildProgressOperationOutcome;
      }
    | null
  > {
    const claim = await transaction.claimOperation({
      childId: projectionInput.child.id,
      familyId: projectionInput.familyId,
      idempotencyKey,
      payloadHash,
    });
    if (claim.kind === "claimed") return null;
    if (claim.receipt.payloadHash !== payloadHash) {
      return { status: "idempotency_mismatch" };
    }
    const stored = storedChildProgressOperationResultSchema.parse(
      claim.receipt.result,
    );
    if (
      claim.receipt.status === "pending" ||
      claim.receipt.status !== stored.status
    ) {
      throw new Error(
        "Stored child progress operation receipt is incomplete",
      );
    }
    const original = this.hydrateStoredOperationResult(stored);
    return {
      status: "duplicate",
      original:
        original.status === "recorded" ||
        original.status === "conflict_open"
          ? {
              ...original,
              operationId: claim.receipt.id,
            }
          : original,
    };
  }

  private hydrateStoredOperationResult(
    stored: StoredChildProgressOperationResult,
  ): ChildProgressOperationOutcome {
    switch (stored.status) {
      case "activity_only":
      case "no_match":
      case "ambiguous":
      case "conflict_pending":
      case "recorded":
      case "conflict_open":
        return stored;
      case "conflict_resolved":
      case "answers_corrected":
      case "undone":
        throw new Error(
          "Non-evidence operation receipt cannot replay as evidence",
        );
      default: {
        const exhaustiveResult: never = stored;
        return exhaustiveResult;
      }
    }
  }

  private storedOperationResult(
    outcome: ChildProgressOperationOutcome,
  ): StoredChildProgressOperationResult {
    switch (outcome.status) {
      case "activity_only":
      case "no_match":
      case "ambiguous":
      case "conflict_pending":
        return outcome;
      case "recorded":
      case "conflict_open":
        return {
          status: outcome.status,
          evidence: outcome.evidence,
          affectedItemIds: outcome.affectedItemIds,
          conflictIds: outcome.conflictIds,
        };
      default: {
        const exhaustiveOutcome: never = outcome;
        return exhaustiveOutcome;
      }
    }
  }

  private async completeOperation<
    T extends ChildProgressOperationOutcome,
  >(
    transaction: ChildProgressTransaction,
    identity: {
      familyId: string;
      childId: string;
      idempotencyKey: string;
    },
    payloadHash: string,
    outcome: T,
  ): Promise<T> {
    const stored = this.storedOperationResult(outcome);
    const evidenceIds =
      stored.status === "recorded" ||
      stored.status === "conflict_open"
        ? stored.evidence.map((evidence) => evidence.id)
        : [];
    const affectedItemIds =
      stored.status === "recorded" ||
      stored.status === "conflict_open"
        ? stored.affectedItemIds
        : stored.status === "conflict_pending"
          ? [stored.itemId]
          : [];
    const conflictIds =
      stored.status === "recorded" ||
      stored.status === "conflict_open"
        ? stored.conflictIds
        : stored.status === "conflict_pending"
          ? [stored.conflictId]
          : [];
    const receipt = await transaction.completeOperation({
      childId: identity.childId,
      familyId: identity.familyId,
      idempotencyKey: identity.idempotencyKey,
      payloadHash,
      status: stored.status,
      evidenceIds,
      affectedItemIds,
      conflictIds,
      result: stored,
    });
    return (
      outcome.status === "recorded" ||
      outcome.status === "conflict_open"
        ? { ...outcome, operationId: receipt.id }
        : outcome
    ) as T;
  }

  private async recordKnownChildEvidence(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    writes: readonly ProgressEvidenceWrite[],
  ): Promise<ProgressWriteResult> {
    const firstWrite = writes[0];
    if (firstWrite === undefined) {
      throw new TypeError("Progress evidence batch cannot be empty");
    }
    const transactionNow = this.now();
    const recordedEvidence: StoredProgressEvidence[] = [];
    for (const write of writes) {
      recordedEvidence.push(
        await this.appendEvidenceWrite(
          transaction,
          projectionInput,
          write,
          transactionNow,
        ),
      );
    }

    const affectedItemIds = [
      ...new Set(writes.map((write) => write.itemId)),
    ].sort();
    await this.refreshDerivedProgressInTransaction(
      transaction,
      projectionInput,
      affectedItemIds,
      transactionNow,
    );
    const affectedItems = new Set(affectedItemIds);
    const conflictIds = projectionInput.conflicts
      .filter((conflict) => affectedItems.has(conflict.itemId))
      .filter((conflict) => conflict.state === "open")
      .map((conflict) => conflict.id)
      .sort();
    return {
      status:
        conflictIds.length === 0 ? "recorded" : "conflict_open",
      evidence: recordedEvidence.map(toPublicProgressEvidence),
      affectedItemIds,
      conflictIds,
    };
  }

  private async appendEvidenceWrite(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    write: ProgressEvidenceWrite,
    transactionNow: Date,
  ): Promise<StoredProgressEvidence> {
    await this.applySupersessionIfRequested(
      transaction,
      projectionInput,
      write,
      transactionNow,
    );
    const currentResolution = resolveEffectiveProgressEvidence({
      childId: write.childId,
      familyId: write.familyId,
      evidence: projectionInput.evidence,
      conflicts: projectionInput.conflicts,
    });
    const previousEffectiveEvidence =
      currentResolution.effectiveEvidence.find(
        (candidate) => candidate.itemId === write.itemId,
      );
    const existingOpenConflict =
      currentResolution.openConflicts.find(
        (conflict) => conflict.itemId === write.itemId,
      );
    const appendFields = {
      childId: write.childId,
      familyId: write.familyId,
      itemId: write.itemId,
      answer: write.answer,
      derivation: write.derivation,
      memberUserId: write.memberUserId,
      quote: write.quote,
      channel: write.channel,
      messageId: write.messageId,
      providerMessageId: write.providerMessageId,
      supersedesId: write.supersedesEvidenceId ?? null,
      observedAt: write.observedAt,
      idempotencyKey: write.idempotencyKey,
    };
    const evidence = await transaction.appendEvidence(
      write.source === "check_in"
        ? {
            ...appendFields,
            source: write.source,
            checkInId: write.checkInId,
          }
        : {
            ...appendFields,
            source: write.source,
            checkInId: null,
          },
    );
    projectionInput.evidence.push(evidence);
    const previousMemberUserId =
      previousEffectiveEvidence?.memberUserId;
    const currentMemberUserId = write.memberUserId;
    const hasPotentialConflict =
      existingOpenConflict === undefined &&
      previousEffectiveEvidence !== undefined &&
      previousMemberUserId !== null &&
      previousMemberUserId !== undefined &&
      currentMemberUserId !== null &&
      previousMemberUserId !== currentMemberUserId &&
      previousEffectiveEvidence.answer !== write.answer;
    const effectiveAfterAppend = hasPotentialConflict
      ? resolveEffectiveProgressEvidence({
          childId: write.childId,
          familyId: write.familyId,
          evidence: projectionInput.evidence,
          conflicts: projectionInput.conflicts,
        }).effectiveEvidence.find(
          (candidate) => candidate.itemId === write.itemId,
        )
      : undefined;
    if (
      hasPotentialConflict &&
      effectiveAfterAppend?.id === evidence.id &&
      previousEffectiveEvidence !== undefined &&
      previousMemberUserId !== null &&
      previousMemberUserId !== undefined &&
      currentMemberUserId !== null
    ) {
      const conflict = await transaction.insertOpenConflict({
        childId: write.childId,
        familyId: write.familyId,
        itemId: write.itemId,
        evidenceIdA: previousEffectiveEvidence.id,
        evidenceIdB: evidence.id,
        openedAt: transactionNow.toISOString(),
      });
      projectionInput.conflicts.push(conflict);
    }
    return evidence;
  }

  private async applySupersessionIfRequested(
    transaction: ChildProgressTransaction,
    projectionInput: ChildProgressProjectionInput,
    write: ProgressEvidenceWrite,
    transactionNow: Date,
  ): Promise<void> {
    const supersededEvidence =
      write.supersedesEvidenceId === undefined
        ? undefined
        : projectionInput.evidence.find(
            (candidate) =>
              candidate.id === write.supersedesEvidenceId,
          );
    if (
      write.supersedesEvidenceId !== undefined &&
      (
        supersededEvidence === undefined ||
        supersededEvidence.childId !== write.childId ||
        supersededEvidence.familyId !== write.familyId ||
        supersededEvidence.itemId !== write.itemId ||
        supersededEvidence.supersededAt !== null
      )
    ) {
      throw new TypeError(
        "Superseded progress evidence must be active and match the child, family, and item",
      );
    }
    if (supersededEvidence !== undefined) {
      const belongsToOpenConflict = projectionInput.conflicts.some(
        (conflict) =>
          conflict.state === "open" &&
          (
            conflict.evidenceIdA === supersededEvidence.id ||
            conflict.evidenceIdB === supersededEvidence.id
          ),
      );
      if (belongsToOpenConflict) {
        throw new TypeError(
          "Open conflict evidence must be resolved before supersession",
        );
      }
      const supersededAt = transactionNow.toISOString();
      await transaction.supersedeEvidence({
        childId: write.childId,
        familyId: write.familyId,
        evidenceId: supersededEvidence.id,
        supersededAt,
      });
      supersededEvidence.supersededAt = supersededAt;
    }
  }

  private buildCompatibilityAnswers(
    affectedItemIds: readonly string[],
    effectiveEvidence: readonly ProgressEvidence[],
    overrides: ReadonlyMap<
      string,
      CompatibilityProgressAnswer
    >,
  ): CompatibilityProgressAnswer[] {
    const effectiveByItem = new Map(
      effectiveEvidence.map((evidence) => [
        evidence.itemId,
        evidence,
      ]),
    );
    const compatibilityAnswers: CompatibilityProgressAnswer[] = [];
    for (const itemId of affectedItemIds) {
      const override = overrides.get(itemId);
      if (override !== undefined) {
        compatibilityAnswers.push(override);
        continue;
      }
      const evidence = effectiveByItem.get(itemId);
      compatibilityAnswers.push(
        evidence === undefined
          ? { kind: "delete", itemId }
          : {
              kind: "upsert",
              itemId,
              answer: evidence.answer,
              source: evidence.source,
              observedAt: evidence.observedAt,
            },
      );
    }
    return compatibilityAnswers;
  }
}
