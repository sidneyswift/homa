import {
  MAP_BANK_VERSION,
  MAP_SCORER_VERSION,
  ageInMonths,
  getMapItem,
  getMapSubject,
  personalizeStatement,
  type MapAnswer,
} from "@homa/core";

import { zonedDateString } from "../time-zone";
import {
  parseProgressConflictResolvedOutcome,
  parseProgressCheckInStartOutcome,
  parseStoredProgressCheckInResponseOutcome,
} from "./check-in-schema";
import { selectNextProgressItem } from "./check-in-selection";
import { DEEP_DIVE_RESPONSE_LIMIT, selectSubjectDeepDiveQuestion } from "./deep-dive-selection";
import {
  hashChildProgressOperationPayload,
  storedChildProgressOperationResultSchema,
} from "./operation-receipt";
import { buildProgressSelectionAnswers } from "./projection";
import type {
  ChildProgressOperationReceipt,
  ChildProgressProjectionInput,
  ProgressCheckInRepository,
  ProgressCheckInTransaction,
  StoredProgressCheckInResponse,
} from "./repository";
import {
  ChildProgressService,
  type RecordProgressEvidenceResult,
} from "./progress-service";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import type {
  OpenProgressConflict,
  ProgressCheckInBindResult,
  ProgressCheckInContext,
  ProgressCheckInPauseReason,
  ProgressCheckInPrompt,
  ProgressCheckInPurpose,
  ProgressCheckInRecord,
  ProgressCheckInResponseOutcome,
  ProgressCheckInResult,
  ProgressCheckInScope,
  ProgressCheckInStartOutcome,
  ProgressCheckInUpdate,
  ProgressConflictCard,
  ProgressEvidenceAnswer,
} from "./types";

/** The core scorer's version, re-exported name kept for existing call
 * sites; the value now lives beside the scorer it describes. */
const CHILD_PROGRESS_SCORER_VERSION = MAP_SCORER_VERSION;

interface LockedCheckInContext {
  checkIn: ProgressCheckInRecord;
  projectionInput: ChildProgressProjectionInput;
}

export interface CommittedProgressCheckInAnswerEvent {
  familyId: string;
  childId: string;
  itemId: string;
  answer: MapAnswer;
  outcome: ProgressCheckInResponseOutcome["status"];
}

export interface CommittedProgressConflictResolutionEvent {
  familyId: string;
  childId: string;
  itemId: string;
  checkInState: "active" | "completed" | null;
}

export interface ProgressCheckInServiceOptions {
  onAnswerCommitted?: (
    event: CommittedProgressCheckInAnswerEvent,
  ) => Promise<void>;
  onConflictResolutionCommitted?: (
    event: CommittedProgressConflictResolutionEvent,
  ) => Promise<void>;
}

async function notifyCommittedProgressEvent<T>(
  listener: ((event: T) => Promise<void>) | undefined,
  event: T,
): Promise<void> {
  if (listener === undefined) return;
  try {
    await listener(event);
  } catch {
    console.error("Committed check-in event notification failed");
  }
}

function requireContextDate(context: ProgressCheckInContext): Date {
  parseOffsetIsoTimestampEpochNanoseconds(context.now);
  const date = new Date(context.now);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("Progress check-in requires a valid current time");
  }
  return date;
}

function requireNonemptyIdempotencyKey(value: string): boolean {
  return value.trim().length > 0;
}

function isEvidenceAnswer(
  answer: MapAnswer,
): answer is ProgressEvidenceAnswer {
  return (
    answer === "easily" ||
    answer === "getting_there" ||
    answer === "not_yet"
  );
}

function utcNoonForDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function ageMonthsForProjection(
  projectionInput: ChildProgressProjectionInput,
  now: Date,
): number {
  return ageInMonths(
    projectionInput.child.birthDate,
    utcNoonForDateKey(
      zonedDateString(now, projectionInput.timeZone),
    ),
  );
}

function normalizedScope(
  purpose: ProgressCheckInPurpose,
  subjectIds: readonly string[] | undefined,
): ProgressCheckInScope | null {
  if (subjectIds === undefined) {
    return purpose === "subject_deep_dive" ? null : {};
  }
  const uniqueSubjectIds = [...new Set(subjectIds)];
  if (
    uniqueSubjectIds.length === 0 ||
    uniqueSubjectIds.some(
      (subjectId) => getMapSubject(subjectId) === undefined,
    )
  ) {
    return null;
  }
  return { subjectIds: uniqueSubjectIds };
}

function promptForCheckIn(
  checkIn: ProgressCheckInRecord,
): ProgressCheckInPrompt | null {
  if (checkIn.currentItemId === null) return null;
  const located = getMapItem(checkIn.currentItemId);
  if (located === undefined) {
    throw new TypeError(
      `Check-in "${checkIn.id}" has unknown item "${checkIn.currentItemId}"`,
    );
  }
  return {
    checkInId: checkIn.id,
    revision: checkIn.revision,
    childId: checkIn.childId,
    childName: checkIn.childName,
    itemId: located.item.id,
    personalizedStatement: personalizeStatement(
      checkIn.childName,
      located.item,
    ),
    subjectDisplayName: located.subject.displayName,
    subjectId: located.subject.id,
    acceptedResponseCount: checkIn.acceptedResponseCount ?? 0,
    ...(checkIn.purpose === "subject_deep_dive" ? {responseLimit: DEEP_DIVE_RESPONSE_LIMIT} : {}),
    state: checkIn.state,
    ownerDisplayName: checkIn.ownerDisplayName,
  };
}

function requirePrompt(
  checkIn: ProgressCheckInRecord,
): ProgressCheckInPrompt {
  const prompt = promptForCheckIn(checkIn);
  if (prompt === null) {
    throw new Error(
      `Nonterminal check-in "${checkIn.id}" has no current item`,
    );
  }
  return prompt;
}

function nextProgressQuestion(
  projectionInput: ChildProgressProjectionInput,
  purpose: ProgressCheckInPurpose,
  scope: ProgressCheckInScope,
  now: Date,
  allowRefresh: boolean,
  responses: Array<Pick<StoredProgressCheckInResponse, "itemId" | "answer">> = [],
) {
  if (purpose === "subject_deep_dive") {
    // Existing durable multi-subject sittings remain readable. New web actions
    // and the model-facing start schema select exactly one subject.
    const decisions = (scope.subjectIds ?? []).map(subjectId => selectSubjectDeepDiveQuestion({
      ...projectionInput,
      childId: projectionInput.child.id,
      subjectId,
      ageMonths: ageMonthsForProjection(projectionInput, now),
      now,
      sittingItemIds: responses.map(row => row.itemId),
    }));
    const question = decisions.find(decision => decision.kind === "question");
    if (question?.kind === "question") return { item: question.item, reason: null, mixedEvidence: false };
    const stop = decisions.find(decision => decision.kind === "stop");
    return { item: null, reason: stop?.reason ?? "no_useful_question" as const, mixedEvidence: stop?.mixedEvidence ?? false };
  }
  return { item: selectNextProgressItem({
    ageMonths: ageMonthsForProjection(projectionInput, now),
    subjectIds: scope.subjectIds,
    answers: buildProgressSelectionAnswers({
      childId: projectionInput.child.id,
      familyId: projectionInput.familyId,
      evidence: projectionInput.evidence,
      conflicts: projectionInput.conflicts,
      selectionAnswers: projectionInput.selectionAnswers,
    }),
    allowRefresh,
  }), reason: null, mixedEvidence: false };
}

function openConflictForCheckIn(
  projectionInput: ChildProgressProjectionInput,
  checkInId: string,
): OpenProgressConflict | null {
  const evidenceById = new Map(
    projectionInput.evidence.map((evidence) => [
      evidence.id,
      evidence,
    ]),
  );
  return (
    projectionInput.conflicts.find(
      (conflict): conflict is OpenProgressConflict =>
        conflict.state === "open" &&
        [conflict.evidenceIdA, conflict.evidenceIdB].some(
          (evidenceId) =>
            evidenceById.get(evidenceId)?.checkInId === checkInId,
        ),
    ) ?? null
  );
}

function conflictCard(
  projectionInput: ChildProgressProjectionInput,
  conflictId: string,
): ProgressConflictCard {
  const conflict = projectionInput.conflicts.find(
    (candidate): candidate is OpenProgressConflict =>
      candidate.id === conflictId && candidate.state === "open",
  );
  if (conflict === undefined) {
    throw new Error(`Open conflict "${conflictId}" is missing`);
  }
  const evidenceA = projectionInput.evidence.find(
    (evidence) => evidence.id === conflict.evidenceIdA,
  );
  const evidenceB = projectionInput.evidence.find(
    (evidence) => evidence.id === conflict.evidenceIdB,
  );
  if (evidenceA === undefined || evidenceB === undefined) {
    throw new Error(
      `Open conflict "${conflictId}" is missing evidence`,
    );
  }
  const located = getMapItem(conflict.itemId);
  if (located === undefined) {
    throw new Error(
      `Open conflict "${conflictId}" has an unknown bank item`,
    );
  }
  return {
    id: conflict.id,
    childId: conflict.childId,
    childName: projectionInput.child.name,
    itemId: conflict.itemId,
    skillStatement: located.item.statement,
    subjectDisplayName: located.subject.displayName,
    answers: [
      {
        evidenceId: evidenceA.id,
        answer: evidenceA.answer,
        adultDisplayName: evidenceA.adultDisplayName,
        observedAt: evidenceA.observedAt,
        source: evidenceA.source,
      },
      {
        evidenceId: evidenceB.id,
        answer: evidenceB.answer,
        adultDisplayName: evidenceB.adultDisplayName,
        observedAt: evidenceB.observedAt,
        source: evidenceB.source,
      },
    ],
  };
}

export class ProgressCheckInService {
  constructor(
    private readonly repository: ProgressCheckInRepository,
    private readonly childProgressService: ChildProgressService,
    private readonly options: ProgressCheckInServiceOptions = {},
  ) {}

  async startCheckIn(
    context: ProgressCheckInContext,
    input: {
      childId: string;
      purpose: ProgressCheckInPurpose;
      subjectIds?: string[];
      idempotencyKey: string;
    },
  ): Promise<ProgressCheckInResult> {
    const now = requireContextDate(context);
    if (!requireNonemptyIdempotencyKey(input.idempotencyKey)) {
      return { status: "invalid_scope" };
    }
    return this.repository.withTransaction(async (transaction) => {
      if (
        !await this.lockAuthenticatedMember(transaction, context)
      ) {
        return { status: "wrong_recipient" };
      }
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          context.familyId,
          input.childId,
        );
      if (projectionInput === null) {
        return { status: "unknown_child" };
      }
      const scope = normalizedScope(input.purpose, input.subjectIds);
      if (scope === null) return { status: "invalid_scope" };
      const selected = context.selectedAssessment;
      if (selected) {
        if (context.channel !== "web" || context.memberUserId === null || selected.childId !== input.childId || input.purpose !== "subject_deep_dive" || scope.subjectIds?.length !== 1 || scope.subjectIds[0] !== selected.subjectId) {
          return {status: "idempotency_mismatch"};
        }
        const request = await transaction.claimCheckInStartRequest({
          familyId: context.familyId, memberUserId: context.memberUserId,
          requestId: selected.requestId, childId: selected.childId, subjectId: selected.subjectId,
          runtimeSessionId: context.runtimeSessionId, turnId: context.turnId,
        });
        if (request.kind === "existing") {
          if (request.childId !== selected.childId || request.subjectId !== selected.subjectId) return {status: "idempotency_mismatch"};
          const original = parseProgressCheckInStartOutcome(request.result);
          const currentCheckIn = "checkIn" in original
            ? await transaction.lockCheckIn(context.familyId, selected.childId, original.checkIn.id) : null;
          if (selected.retryRevision !== undefined && selected.retryRevision === request.issuedRevision &&
            request.deliveredAt === null && currentCheckIn?.id === request.issuedCheckInId &&
            currentCheckIn.state === "active" && currentCheckIn.currentDeliveryId === null &&
            currentCheckIn.revision === request.issuedRevision &&
            currentCheckIn.ownerMemberUserId === context.memberUserId && currentCheckIn.recipientMemberUserId === context.memberUserId) {
            // Explicit recovery reissues only the still-undelivered question.
            // The original receipt stays immutable; a raced retry cannot move
            // the new marker because it carries the previously issued revision.
            const current = await this.refreshExistingActivePrompt(transaction, context, currentCheckIn);
            return {status: "existing", checkIn: current, prompt: requirePrompt(current)};
          }
          return {status: "duplicate_start", original, currentCheckIn};
        }
        if (selected.retryRevision !== undefined) {
          // Roll back the provisional claim too. Recovery can never create a
          // sitting when its original receipt is absent.
          throw new Error("Question recovery requires an existing start receipt");
        }
      }
      const executeStart = async (): Promise<ProgressCheckInResult> => {
        const existing =
          await transaction.lockNonterminalCheckInByChild(
            context.familyId,
            input.childId,
          );
        if (existing !== null) {
          if (existing.purpose !== input.purpose ||
            JSON.stringify([...(existing.scope.subjectIds ?? [])].sort()) !== JSON.stringify([...(scope.subjectIds ?? [])].sort()) ||
            existing.recipientMemberUserId !== context.memberUserId || existing.ownerMemberUserId !== context.memberUserId) {
            return { status: "different_check_in_active", checkIn: existing };
          }
          const current =
            await this.refreshExistingActivePrompt(
              transaction,
              context,
              existing,
            );
          return {
            status: "existing",
            checkIn: current,
            prompt: promptForCheckIn(current),
          };
        }
        const openConflict = projectionInput.conflicts.find(conflict => conflict.state === "open" &&
          (!scope.subjectIds || scope.subjectIds.includes(getMapItem(conflict.itemId)?.subject.id ?? "")));
        if (openConflict && input.purpose === "subject_deep_dive") return {status: "conflict_pending", conflictId: openConflict.id};
        const decision = nextProgressQuestion(projectionInput, input.purpose, scope, now, true);
        const item = decision.item;
        if (item === null) return input.purpose === "subject_deep_dive"
          ? { status: "no_question", childId: projectionInput.child.id, childName: projectionInput.child.name, subjectId: scope.subjectIds![0], reason: decision.reason ?? "no_useful_question", mixedEvidence: decision.mixedEvidence }
          : { status: "invalid_scope" };
        const inserted = await transaction.insertCheckIn({
          childId: projectionInput.child.id,
          childName: projectionInput.child.name,
          familyId: projectionInput.familyId,
          purpose: input.purpose,
          scope,
          ownerMemberUserId: context.memberUserId,
          recipientMemberUserId: context.memberUserId,
          currentItemId: item.id,
          episodeId: context.episodeId,
          pendingRuntimeSessionId: context.runtimeSessionId,
          pendingTurnId: context.turnId,
          idempotencyKey: input.idempotencyKey,
          openedAt: context.now,
        });
        if (inserted.kind === "existing") {
          const current =
            await this.refreshExistingActivePrompt(
              transaction,
              context,
              inserted.checkIn,
            );
          return {
            status: "existing",
            checkIn: current,
            prompt: promptForCheckIn(current),
          };
        }
        const baseline = this.childProgressService.buildCurrentProgressView(
          projectionInput,
          now,
        );
        await transaction.insertCheckInBaselineSnapshot({
          childId: projectionInput.child.id,
          familyId: projectionInput.familyId,
          checkInId: inserted.checkIn.id,
          evidenceIds: projectionInput.evidence.map(
            (evidence) => evidence.id,
          ),
          ageMonths: ageMonthsForProjection(projectionInput, now),
          bankVersion: MAP_BANK_VERSION,
          scorerVersion: CHILD_PROGRESS_SCORER_VERSION,
          projection: baseline,
          createdAt: context.now,
        });
        return {
          status: "started",
          checkIn: inserted.checkIn,
          prompt: requirePrompt(inserted.checkIn),
        };
      };
      const result = await executeStart();
      if (selected && context.memberUserId) {
        const outcome: ProgressCheckInStartOutcome = parseProgressCheckInStartOutcome(result);
        const issued = (outcome.status === "started" || outcome.status === "existing") && outcome.checkIn.state === "active" ? outcome.checkIn : null;
        await transaction.completeCheckInStartRequest({familyId: context.familyId, memberUserId: context.memberUserId, requestId: selected.requestId, result: outcome,
          issuedCheckInId: issued?.id ?? null, issuedRevision: issued?.revision ?? null});
      }
      return result;
    });
  }

  async respondCheckIn(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      expectedRevision?: number;
      answer:
        | ProgressEvidenceAnswer
        | "not_sure"
        | "skip";
      idempotencyKey: string;
    },
  ): Promise<ProgressCheckInResult> {
    const now = requireContextDate(context);
    if (!requireNonemptyIdempotencyKey(input.idempotencyKey)) {
      return { status: "invalid_scope" };
    }
    let committedEvent:
      | CommittedProgressCheckInAnswerEvent
      | null = null;
    const result =
      await this.repository.withTransaction<ProgressCheckInResult>(
      async (transaction) => {
      if (
        !await this.lockAuthenticatedMember(transaction, context)
      ) {
        return { status: "wrong_recipient" };
      }
      const locked = await this.lockCheckInContext(
        transaction,
        context.familyId,
        input.checkInId,
      );
      if (locked === null) {
        return { status: "no_active_check_in" };
      }
      const replay =
        await transaction.findCheckInResponseReplay({
          familyId: context.familyId,
          checkInId: input.checkInId,
          idempotencyKey: input.idempotencyKey,
          channel: context.channel,
          providerMessageId: context.providerMessageId,
        });
      if (replay !== null) {
        return this.duplicateResponse(replay, context);
      }
      const refusal = this.responseRefusal(
        locked,
        context,
      );
      if (refusal !== null) return refusal;
      if (input.expectedRevision !== undefined && input.expectedRevision !== locked.checkIn.revision) return {status: "stale_prompt"};
      const itemId = locked.checkIn.currentItemId;
      if (itemId === null) {
        return { status: "no_active_check_in" };
      }
      const inserted = await transaction.insertCheckInResponse({
        childId: locked.checkIn.childId,
        familyId: locked.checkIn.familyId,
        checkInId: locked.checkIn.id,
        revision: locked.checkIn.revision,
        itemId,
        answer: input.answer,
        memberUserId: context.memberUserId,
        deliveryId: context.repliedDeliveryId,
        channel: context.channel,
        providerMessageId: context.providerMessageId,
        inboundMessageId: context.inboundMessageId,
        idempotencyKey: input.idempotencyKey,
        createdAt: context.now,
      });
      if (inserted.kind === "duplicate") {
        return this.duplicateResponse(
          inserted.response,
          context,
        );
      }
      const selectionAnswer = {
        selectionId: inserted.response.id,
        childId: locked.checkIn.childId,
        familyId: locked.checkIn.familyId,
        evidenceId: null as string | null,
        itemId,
        answer: input.answer,
        answeredAt: inserted.response.createdAt,
      };
      locked.projectionInput.selectionAnswers.push(selectionAnswer);

      let evidenceId: string | null = null;
      let conflictId: string | null = null;
      let progressUpdate: ProgressCheckInUpdate | null = null;
      if (isEvidenceAnswer(input.answer)) {
        const evidenceResult =
          await this.childProgressService
            .recordProgressEvidenceInTransaction(
              transaction,
              locked.projectionInput,
              {
                familyId: locked.checkIn.familyId,
                childId: locked.checkIn.childId,
                memberUserId: context.memberUserId,
                source: "check_in",
                checkInId: locked.checkIn.id,
                itemId,
                answer: input.answer,
                quote: null,
                channel: context.channel,
                messageId: context.inboundMessageId,
                observedAt: context.now,
                idempotencyKey:
                  `check-in-response:${inserted.response.id}`,
              },
            );
        const interpreted = this.interpretEvidenceResult(
          evidenceResult,
        );
        evidenceId = interpreted.evidenceId;
        conflictId = interpreted.conflictId;
        progressUpdate = interpreted.progressUpdate;
        selectionAnswer.evidenceId = evidenceId;
      }

      const responses = await transaction.listCheckInResponses(context.familyId, locked.checkIn.childId, locked.checkIn.id);
      const decision = nextProgressQuestion(locked.projectionInput, locked.checkIn.purpose, locked.checkIn.scope, now, false, responses);
      const nextItem = conflictId === null ? decision.item : null;
      const nextCheckIn = await transaction.compareAndSwapCheckIn({
        familyId: locked.checkIn.familyId,
        childId: locked.checkIn.childId,
        checkInId: locked.checkIn.id,
        expectedRevision: locked.checkIn.revision,
        next: {
          acceptedResponseCount: responses.length,
          uncertainResponseCount: responses.filter(row => row.answer === "skip" || row.answer === "not_sure").length,
          terminalReason: conflictId === null && nextItem === null ? decision.reason : null,
          terminalMixedEvidence: conflictId === null && nextItem === null ? decision.mixedEvidence : null,
          state:
            conflictId !== null
              ? "paused"
              : nextItem === null
                ? "completed"
                : "active",
          ownerMemberUserId:
            locked.checkIn.ownerMemberUserId,
          recipientMemberUserId:
            locked.checkIn.recipientMemberUserId,
          currentItemId:
            conflictId === null
              ? nextItem?.id ?? null
              : itemId,
          currentDeliveryId: null,
          episodeId: context.episodeId,
          pendingRuntimeSessionId:
            conflictId !== null || nextItem !== null
              ? context.runtimeSessionId
              : null,
          pendingTurnId:
            conflictId !== null || nextItem !== null
              ? context.turnId
              : null,
          pauseReason:
            conflictId === null ? null : "conflict",
          pausedAt:
            conflictId === null ? null : context.now,
          completedAt:
            conflictId === null && nextItem === null
              ? context.now
              : null,
          stoppedAt: null,
          updatedAt: context.now,
        },
      });
      if (nextCheckIn === null) {
        throw new Error("Locked check-in compare-and-swap failed");
      }
      await this.cancelSupersededReplyLoops(
        transaction,
        nextCheckIn,
      );
      const outcome = parseStoredProgressCheckInResponseOutcome(
        this.responseOutcome({
          checkIn: nextCheckIn,
          projectionInput: locked.projectionInput,
          responseId: inserted.response.id,
          conflictId,
          progressUpdate,
        }),
      );
      await transaction.completeCheckInResponse({
        familyId: nextCheckIn.familyId,
        childId: nextCheckIn.childId,
        checkInId: nextCheckIn.id,
        responseId: inserted.response.id,
        evidenceId,
        result: outcome,
      });
      committedEvent = {
        familyId: nextCheckIn.familyId,
        childId: nextCheckIn.childId,
        itemId,
        answer: input.answer,
        outcome: outcome.status,
      };
      return outcome;
      },
    );
    if (committedEvent !== null) {
      await notifyCommittedProgressEvent(
        this.options.onAnswerCommitted,
        committedEvent,
      );
    }
    return result;
  }

  async pauseCheckIn(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      expectedRevision?: number;
      reason: Exclude<
        ProgressCheckInPauseReason,
        "conflict" | "member_removed"
      >;
    },
  ): Promise<ProgressCheckInResult> {
    requireContextDate(context);
    if (
      input.reason !== "topic_change" &&
      input.reason !== "explicit_pause"
    ) {
      return { status: "invalid_scope" };
    }
    return this.mutateRecipientCheckIn(
      context,
      input.checkInId,
      (locked) => {
        if (locked.checkIn.state !== "active") {
          const conflict = openConflictForCheckIn(
            locked.projectionInput,
            locked.checkIn.id,
          );
          return conflict === null
            ? { status: "no_active_check_in" }
            : {
                status: "conflict_pending",
                conflictId: conflict.id,
              };
        }
        return {
          next: {
            ...this.preservedNextState(locked.checkIn, context),
            state: "paused" as const,
            currentDeliveryId: null,
            pendingRuntimeSessionId: null,
            pendingTurnId: null,
            pauseReason: input.reason,
            pausedAt: context.now,
          },
          buildResult: (checkIn: ProgressCheckInRecord) => ({
            status: "paused" as const,
            checkIn,
            prompt: requirePrompt(checkIn),
          }),
        };
      },
    );
  }

  async resumeCheckIn(
    context: ProgressCheckInContext,
    input: { checkInId: string; expectedRevision?: number },
  ): Promise<ProgressCheckInResult> {
    requireContextDate(context);
    return this.mutateRecipientCheckIn(
      context,
      input.checkInId,
      (locked) => {
        if (locked.checkIn.state !== "paused") {
          return { status: "no_active_check_in" };
        }
        if (locked.checkIn.pauseReason === "member_removed") {
          return { status: "wrong_recipient" };
        }
        if (locked.checkIn.pauseReason === "conflict") {
          const conflict = openConflictForCheckIn(
            locked.projectionInput,
            locked.checkIn.id,
          );
          return conflict === null
            ? { status: "no_active_check_in" }
            : {
                status: "conflict_pending",
                conflictId: conflict.id,
              };
        }
        if (locked.checkIn.currentItemId === null) {
          return { status: "no_active_check_in" };
        }
        return {
          next: {
            ...this.preservedNextState(locked.checkIn, context),
            state: "active" as const,
            currentDeliveryId: null,
            pendingRuntimeSessionId: context.runtimeSessionId,
            pendingTurnId: context.turnId,
            pauseReason: null,
            pausedAt: null,
          },
          buildResult: (checkIn: ProgressCheckInRecord) => ({
            status: "resumed" as const,
            checkIn,
            prompt: requirePrompt(checkIn),
          }),
        };
      },
    );
  }

  async pauseCheckInForDeliveryOutcome(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      expectedRevision: number;
      reason: "delivery_uncertain" | "delivery_failed";
    },
  ): Promise<ProgressCheckInResult> {
    requireContextDate(context);
    return this.repository.withTransaction(async (transaction) => {
      if (!await this.lockAuthenticatedMember(transaction, context)) {
        return { status: "wrong_recipient" };
      }
      const locked = await this.lockCheckInContext(
        transaction,
        context.familyId,
        input.checkInId,
      );
      if (locked === null || locked.checkIn.state !== "active") {
        return { status: "no_active_check_in" };
      }
      if (locked.checkIn.revision !== input.expectedRevision) {
        return { status: "stale_prompt" };
      }
      if (
        locked.checkIn.recipientMemberUserId !== context.memberUserId
      ) {
        return { status: "wrong_recipient" };
      }
      if (
        locked.checkIn.currentDeliveryId !== null ||
        locked.checkIn.pendingRuntimeSessionId !==
          context.runtimeSessionId ||
        locked.checkIn.pendingTurnId !== context.turnId
      ) {
        return { status: "wrong_delivery" };
      }
      const updated = await transaction.compareAndSwapCheckIn({
        familyId: locked.checkIn.familyId,
        childId: locked.checkIn.childId,
        checkInId: locked.checkIn.id,
        expectedRevision: locked.checkIn.revision,
        next: {
          ...this.preservedNextState(locked.checkIn, context),
          state: "paused",
          currentDeliveryId: null,
          pendingRuntimeSessionId: null,
          pendingTurnId: null,
          pauseReason: input.reason,
          pausedAt: context.now,
        },
      });
      if (updated === null) {
        throw new Error("Delivery outcome pause lost its prompt");
      }
      await this.cancelSupersededReplyLoops(transaction, updated);
      return {
        status: "paused",
        checkIn: updated,
        prompt: requirePrompt(updated),
      };
    });
  }

  async takeoverCheckIn(
    context: ProgressCheckInContext,
    input: { checkInId: string; expectedRevision?: number },
  ): Promise<ProgressCheckInResult> {
    requireContextDate(context);
    const takeoverMemberUserId = context.memberUserId;
    if (takeoverMemberUserId === null) {
      return { status: "wrong_recipient" };
    }
    return this.repository.withTransaction(async (transaction) => {
      if (
        !await transaction.lockFamilyMemberForKeyShare(
          context.familyId,
          takeoverMemberUserId,
        )
      ) {
        return { status: "wrong_recipient" };
      }
      const locked = await this.lockCheckInContext(
        transaction,
        context.familyId,
        input.checkInId,
      );
      if (locked === null) {
        return { status: "no_active_check_in" };
      }
      if (
        locked.checkIn.state !== "active" &&
        locked.checkIn.state !== "paused"
      ) {
        return { status: "no_active_check_in" };
      }
      const conflict = openConflictForCheckIn(
        locked.projectionInput,
        locked.checkIn.id,
      );
      if (conflict !== null) {
        return {
          status: "conflict_pending",
          conflictId: conflict.id,
        };
      }
      const updated = await transaction.compareAndSwapCheckIn({
        familyId: locked.checkIn.familyId,
        childId: locked.checkIn.childId,
        checkInId: locked.checkIn.id,
        expectedRevision: locked.checkIn.revision,
        next: {
          ...this.preservedNextState(locked.checkIn, context),
          state:
            locked.checkIn.pauseReason === "member_removed"
              ? "active"
              : locked.checkIn.state,
          ownerMemberUserId: takeoverMemberUserId,
          recipientMemberUserId: takeoverMemberUserId,
          currentDeliveryId: null,
          pendingRuntimeSessionId:
            locked.checkIn.state === "active" ||
            locked.checkIn.pauseReason === "conflict" ||
            locked.checkIn.pauseReason === "member_removed"
              ? context.runtimeSessionId
              : null,
          pendingTurnId:
            locked.checkIn.state === "active" ||
            locked.checkIn.pauseReason === "conflict" ||
            locked.checkIn.pauseReason === "member_removed"
              ? context.turnId
              : null,
          pauseReason:
            locked.checkIn.pauseReason === "member_removed"
              ? null
              : locked.checkIn.pauseReason,
          pausedAt:
            locked.checkIn.pauseReason === "member_removed"
              ? null
              : locked.checkIn.pausedAt,
        },
      });
      if (updated === null) {
        throw new Error("Locked takeover compare-and-swap failed");
      }
      await this.cancelSupersededReplyLoops(transaction, updated);
      return {
        status: "takeover_accepted",
        checkIn: updated,
        prompt: requirePrompt(updated),
      };
    });
  }

  async stopCheckIn(
    context: ProgressCheckInContext,
    input: { checkInId: string; expectedRevision?: number },
  ): Promise<ProgressCheckInResult> {
    requireContextDate(context);
    return this.mutateRecipientCheckIn(
      context,
      input.checkInId,
      (locked) => {
        if (
          locked.checkIn.state !== "active" &&
          locked.checkIn.state !== "paused"
        ) {
          return { status: "no_active_check_in" };
        }
        return {
          next: {
            ...this.preservedNextState(locked.checkIn, context),
            state: "stopped" as const,
            terminalReason: "parent_stopped" as const,
            currentItemId: null,
            currentDeliveryId: null,
            pendingRuntimeSessionId: null,
            pendingTurnId: null,
            pauseReason: null,
            pausedAt: null,
            completedAt: null,
            stoppedAt: context.now,
          },
          buildResult: (checkIn: ProgressCheckInRecord) => ({
            status: "stopped" as const,
            checkIn,
          }),
        };
      },
    );
  }

  async resolveProgressConflict(
    context: ProgressCheckInContext,
    input: {
      conflictId: string;
      answer: ProgressEvidenceAnswer;
      idempotencyKey: string;
    },
  ): Promise<ProgressCheckInResult> {
    const now = requireContextDate(context);
    const resolverMemberUserId = context.memberUserId;
    if (resolverMemberUserId === null) {
      return { status: "wrong_recipient" };
    }
    if (!requireNonemptyIdempotencyKey(input.idempotencyKey)) {
      return { status: "invalid_scope" };
    }
    const payloadHash = hashChildProgressOperationPayload({
      kind: "conflict_resolution",
      conflictId: input.conflictId,
      answer: input.answer,
    });
    let committedEvent:
      | CommittedProgressConflictResolutionEvent
      | null = null;
    const result =
      await this.repository.withTransaction<ProgressCheckInResult>(
      async (transaction) => {
      if (
        !await transaction.lockFamilyMemberForKeyShare(
          context.familyId,
          resolverMemberUserId,
        )
      ) {
        return { status: "wrong_recipient" };
      }
      const identity = await transaction.findProgressConflict(
        context.familyId,
        input.conflictId,
      );
      if (identity === null) {
        return { status: "no_active_check_in" };
      }
      const projectionInput =
        await transaction.loadProjectionInputForUpdate(
          context.familyId,
          identity.childId,
        );
      if (projectionInput === null) {
        return { status: "no_active_check_in" };
      }
      const existingOperation = await transaction.loadOperation(
        context.familyId,
        identity.childId,
        input.idempotencyKey,
      );
      if (existingOperation !== null) {
        return this.replayConflictResolution(
          existingOperation,
          payloadHash,
        );
      }
      const lockedConflict =
        await transaction.lockProgressConflict(
          context.familyId,
          identity.childId,
          input.conflictId,
        );
      if (lockedConflict === null) {
        return { status: "no_active_check_in" };
      }
      if (lockedConflict.conflict.state === "resolved") {
        return { status: "invalid_scope" };
      }
      const selectedEvidence = [
        lockedConflict.evidenceA,
        lockedConflict.evidenceB,
      ].find((evidence) => evidence.answer === input.answer);
      if (selectedEvidence === undefined) {
        return { status: "invalid_scope" };
      }
      const operationClaim = await transaction.claimOperation({
        childId: identity.childId,
        familyId: context.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      });
      if (operationClaim.kind === "existing") {
        return this.replayConflictResolution(
          operationClaim.receipt,
          payloadHash,
        );
      }
      const resolved = await transaction.resolveProgressConflict({
        familyId: context.familyId,
        childId: identity.childId,
        conflictId: input.conflictId,
        answer: input.answer,
        evidenceId: selectedEvidence.id,
        resolverMemberUserId,
        resolvedAt: context.now,
      });
      if (resolved === null) {
        throw new Error("Locked conflict resolution failed");
      }
      const conflictIndex = projectionInput.conflicts.findIndex(
        (conflict) => conflict.id === resolved.id,
      );
      if (conflictIndex < 0) {
        throw new Error("Resolved conflict left the projection");
      }
      projectionInput.conflicts[conflictIndex] = resolved;

      const relatedCheckInId =
        lockedConflict.evidenceB.checkInId ??
        lockedConflict.evidenceA.checkInId;
      let relatedCheckIn: ProgressCheckInRecord | null = null;
      if (relatedCheckInId !== null) {
        const lockedCheckIn = await transaction.lockCheckIn(
          context.familyId,
          identity.childId,
          relatedCheckInId,
        );
        if (
          lockedCheckIn !== null &&
          lockedCheckIn.state === "paused" &&
          lockedCheckIn.pauseReason === "conflict"
        ) {
          const responses = await transaction.listCheckInResponses(context.familyId, lockedCheckIn.childId, lockedCheckIn.id);
          const decision = nextProgressQuestion(projectionInput, lockedCheckIn.purpose, lockedCheckIn.scope, now, false, responses);
          const resumedItem = decision.item;
          relatedCheckIn =
            await transaction.compareAndSwapCheckIn({
              familyId: lockedCheckIn.familyId,
              childId: lockedCheckIn.childId,
              checkInId: lockedCheckIn.id,
              expectedRevision: lockedCheckIn.revision,
              next: {
                ...this.preservedNextState(
                  lockedCheckIn,
                  context,
                ),
                acceptedResponseCount: responses.length,
                uncertainResponseCount: responses.filter(row => row.answer === "skip" || row.answer === "not_sure").length,
                terminalReason: resumedItem === null ? decision.reason : null,
                terminalMixedEvidence: resumedItem === null ? decision.mixedEvidence : null,
                state:
                  resumedItem === null
                    ? "completed"
                    : "active",
                currentItemId: resumedItem?.id ?? null,
                currentDeliveryId: null,
                episodeId: lockedCheckIn.episodeId,
                pendingRuntimeSessionId:
                  resumedItem === null
                    ? null
                    : context.runtimeSessionId,
                pendingTurnId:
                  resumedItem === null ? null : context.turnId,
                pauseReason: null,
                pausedAt: null,
                completedAt:
                  resumedItem === null
                    ? context.now
                    : null,
              },
            });
          if (relatedCheckIn === null) {
            throw new Error(
              "Locked conflict check-in compare-and-swap failed",
            );
          }
          await this.cancelSupersededReplyLoops(
            transaction,
            relatedCheckIn,
          );
        }
      }
      await this.childProgressService
        .refreshDerivedProgressInTransaction(
          transaction,
          projectionInput,
          [resolved.itemId],
          now,
        );
      const outcome = parseProgressConflictResolvedOutcome({
        status: "conflict_resolved",
        conflictId: resolved.id,
        selectedEvidenceId: selectedEvidence.id,
        checkIn: relatedCheckIn,
        prompt:
          relatedCheckIn?.state === "active"
            ? requirePrompt(relatedCheckIn)
            : null,
      });
      await transaction.completeOperation({
        childId: identity.childId,
        familyId: context.familyId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        status: "conflict_resolved",
        evidenceIds: [selectedEvidence.id],
        affectedItemIds: [resolved.itemId],
        conflictIds: [resolved.id],
        result: outcome,
      });
      committedEvent = {
        familyId: context.familyId,
        childId: identity.childId,
        itemId: resolved.itemId,
        checkInState:
          relatedCheckIn?.state === "active" ||
            relatedCheckIn?.state === "completed"
            ? relatedCheckIn.state
            : null,
      };
      return outcome;
      },
    );
    if (committedEvent !== null) {
      await notifyCommittedProgressEvent(
        this.options.onConflictResolutionCommitted,
        committedEvent,
      );
    }
    return result;
  }

  async listActiveFamilyCheckIns(
    familyId: string,
  ): Promise<ProgressCheckInRecord[]> {
    return this.repository.listNonterminalCheckInsByFamily(familyId);
  }

  async getActiveChildCheckIn(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null> {
    return this.repository.loadNonterminalCheckInByChild(
      familyId,
      childId,
    );
  }

  async getPromptContext(
    context: ProgressCheckInContext,
  ): Promise<ProgressCheckInPrompt | null> {
    const checkIn =
      await this.repository
        .loadActiveCheckInByRecipientOrDelivery({
          familyId: context.familyId,
          memberUserId: context.memberUserId,
          repliedDeliveryId: context.repliedDeliveryId,
        });
    return checkIn === null ? null : promptForCheckIn(checkIn);
  }

  async bindCurrentDelivery(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      expectedRevision: number;
      deliveryId: string;
    },
  ): Promise<ProgressCheckInBindResult> {
    requireContextDate(context);
    if (input.deliveryId.trim().length === 0) {
      return { status: "wrong_delivery" };
    }
    return this.repository.withTransaction(async (transaction) => {
      if (
        !await this.lockAuthenticatedMember(transaction, context)
      ) {
        return { status: "wrong_recipient" };
      }
      const locked = await this.lockCheckInContext(
        transaction,
        context.familyId,
        input.checkInId,
      );
      if (locked === null) {
        return { status: "no_active_check_in" };
      }
      switch (locked.checkIn.state) {
        case "paused":
        case "completed":
        case "stopped":
          return { status: "no_active_check_in" };
        case "active":
          break;
        default: {
          const exhaustiveState: never = locked.checkIn.state;
          return exhaustiveState;
        }
      }
      if (locked.checkIn.revision !== input.expectedRevision) {
        return { status: "stale_prompt" };
      }
      if (
        locked.checkIn.recipientMemberUserId !==
        context.memberUserId
      ) {
        return { status: "wrong_recipient" };
      }
      if (locked.checkIn.currentDeliveryId !== null) {
        return locked.checkIn.currentDeliveryId === input.deliveryId
          ? { status: "bound", checkIn: locked.checkIn }
          : { status: "wrong_delivery" };
      }
      const checkIn = await transaction.bindCurrentCheckInDelivery({
        familyId: locked.checkIn.familyId,
        childId: locked.checkIn.childId,
        checkInId: locked.checkIn.id,
        expectedRevision: input.expectedRevision,
        deliveryId: input.deliveryId,
        episodeId: context.episodeId,
        runtimeSessionId: context.runtimeSessionId,
        turnId: context.turnId,
        updatedAt: context.now,
      });
      return checkIn === null
        ? { status: "wrong_delivery" }
        : { status: "bound", checkIn };
    });
  }

  private cancelSupersededReplyLoops(
    transaction: ProgressCheckInTransaction,
    checkIn: ProgressCheckInRecord,
  ): Promise<number> {
    switch (checkIn.state) {
      case "active":
        return transaction.cancelProgressReplyLoops({
          familyId: checkIn.familyId,
          checkInId: checkIn.id,
          keepDeliveryId: checkIn.currentDeliveryId,
          keepRevision:
            checkIn.currentDeliveryId === null
              ? null
              : checkIn.revision,
        });
      case "paused":
      case "completed":
      case "stopped":
        return transaction.cancelProgressReplyLoops({
          familyId: checkIn.familyId,
          checkInId: checkIn.id,
          keepDeliveryId: null,
          keepRevision: null,
        });
      default: {
        const exhaustiveState: never = checkIn.state;
        return exhaustiveState;
      }
    }
  }

  private lockAuthenticatedMember(
    transaction: ProgressCheckInTransaction,
    context: ProgressCheckInContext,
  ): Promise<boolean> {
    return context.memberUserId === null
      ? Promise.resolve(true)
      : transaction.lockFamilyMemberForKeyShare(
          context.familyId,
          context.memberUserId,
        );
  }

  private async refreshExistingActivePrompt(
    transaction: ProgressCheckInTransaction,
    context: ProgressCheckInContext,
    checkIn: ProgressCheckInRecord,
  ): Promise<ProgressCheckInRecord> {
    const resumeSelected = context.selectedAssessment !== undefined && context.selectedAssessment !== null &&
      checkIn.state === "paused" && checkIn.currentItemId !== null &&
      checkIn.pauseReason !== "conflict" && checkIn.pauseReason !== "member_removed";
    if (checkIn.state !== "active" && !resumeSelected) return checkIn;
    const updated = await transaction.compareAndSwapCheckIn({
      familyId: checkIn.familyId,
      childId: checkIn.childId,
      checkInId: checkIn.id,
      expectedRevision: checkIn.revision,
      next: {
        ...this.preservedNextState(checkIn, context),
        ...(resumeSelected ? {state: "active" as const, pauseReason: null, pausedAt: null} : {}),
        currentDeliveryId: null,
        episodeId: context.episodeId,
        pendingRuntimeSessionId: context.runtimeSessionId,
        pendingTurnId: context.turnId,
      },
    });
    if (updated === null) {
      throw new Error("Existing active prompt marker refresh failed");
    }
    // Every reissue of this exact undelivered question carries its selected
    // receipts forward, including an ordinary chat start without action metadata.
    // A paused/resumed, delivered, advanced or transferred question cannot
    // acquire that lineage: only receipts matching the prior owned revision move.
    if (checkIn.state === "active" && checkIn.currentDeliveryId === null && context.memberUserId !== null &&
      checkIn.ownerMemberUserId === context.memberUserId && checkIn.recipientMemberUserId === context.memberUserId) {
      const moved = await transaction.reissueCheckInStartRequests({familyId: checkIn.familyId, childId: checkIn.childId,
        checkInId: checkIn.id, memberUserId: context.memberUserId, expectedRevision: checkIn.revision, revision: updated.revision});
      if (context.selectedAssessment?.retryRevision !== undefined && moved === 0) {
        throw new Error("Selected check-in retry lost its undelivered revision");
      }
    }
    await this.cancelSupersededReplyLoops(transaction, updated);
    return updated;
  }

  private async lockCheckInContext(
    transaction: ProgressCheckInTransaction,
    familyId: string,
    checkInId: string,
  ): Promise<LockedCheckInContext | null> {
    const discovered = await transaction.findCheckIn(
      familyId,
      checkInId,
    );
    if (discovered === null) return null;
    const projectionInput =
      await transaction.loadProjectionInputForUpdate(
        familyId,
        discovered.childId,
      );
    if (projectionInput === null) return null;
    const checkIn = await transaction.lockCheckIn(
      familyId,
      projectionInput.child.id,
      checkInId,
    );
    return checkIn === null ? null : { checkIn, projectionInput };
  }

  private duplicateResponse(
    response: StoredProgressCheckInResponse,
    context: ProgressCheckInContext,
  ): ProgressCheckInResult {
    if (response.memberUserId !== context.memberUserId) {
      return { status: "wrong_recipient" };
    }
    if (response.deliveryId !== context.repliedDeliveryId) {
      return { status: "wrong_delivery" };
    }
    return {
      status: "duplicate",
      original: parseStoredProgressCheckInResponseOutcome(
        response.result,
      ),
    };
  }

  private replayConflictResolution(
    receipt: ChildProgressOperationReceipt,
    payloadHash: string,
  ): ProgressCheckInResult {
    if (receipt.payloadHash !== payloadHash) {
      return { status: "idempotency_mismatch" };
    }
    const stored = storedChildProgressOperationResultSchema.parse(
      receipt.result,
    );
    if (
      receipt.status !== "conflict_resolved" ||
      stored.status !== "conflict_resolved"
    ) {
      throw new Error(
        "Stored conflict resolution receipt is incomplete",
      );
    }
    return {
      status: "duplicate",
      original: parseProgressConflictResolvedOutcome(stored),
    };
  }

  private responseRefusal(
    locked: LockedCheckInContext,
    context: ProgressCheckInContext,
  ): ProgressCheckInResult | null {
    if (
      locked.checkIn.recipientMemberUserId !==
      context.memberUserId
    ) {
      return { status: "wrong_recipient" };
    }
    if (
      (locked.checkIn.state === "active" && locked.checkIn.currentDeliveryId === null) ||
      locked.checkIn.currentDeliveryId !==
      context.repliedDeliveryId
    ) {
      return { status: "wrong_delivery" };
    }
    if (locked.checkIn.state === "paused") {
      const conflict = openConflictForCheckIn(
        locked.projectionInput,
        locked.checkIn.id,
      );
      return conflict === null
        ? { status: "no_active_check_in" }
        : {
            status: "conflict_pending",
            conflictId: conflict.id,
          };
    }
    if (locked.checkIn.state !== "active") {
      return { status: "no_active_check_in" };
    }
    const currentConflict = locked.projectionInput.conflicts.find(
      (conflict) =>
        conflict.state === "open" &&
        conflict.itemId === locked.checkIn.currentItemId,
    );
    return currentConflict === undefined
      ? null
      : {
          status: "conflict_pending",
          conflictId: currentConflict.id,
        };
  }

  private interpretEvidenceResult(
    result: RecordProgressEvidenceResult,
  ): {
    evidenceId: string;
    conflictId: string | null;
    progressUpdate: ProgressCheckInUpdate | null;
  } {
    switch (result.status) {
      case "recorded": {
        const evidence = result.evidence[0];
        if (evidence === undefined) {
          throw new Error("Check-in evidence result is empty");
        }
        if (!result.operationId) {
          throw new Error("Check-in evidence operation id is missing");
        }
        return {
          evidenceId: evidence.id,
          conflictId: null,
          progressUpdate: {
            operationId: result.operationId,
            affectedItemIds: result.affectedItemIds,
            affectedTopics: result.affectedItemIds.map(
              (itemId) =>
                getMapItem(itemId)?.item.statement ?? itemId,
            ),
            undoAvailable: true,
          },
        };
      }
      case "conflict_open": {
        const evidence = result.evidence[0];
        const conflictId = result.conflictIds[0];
        if (evidence === undefined || conflictId === undefined) {
          throw new Error("Check-in conflict result is incomplete");
        }
        return {
          evidenceId: evidence.id,
          conflictId,
          progressUpdate: null,
        };
      }
      case "unknown_child":
      case "unknown_actor":
      case "idempotency_mismatch":
      case "duplicate":
      case "conflict_pending":
        throw new Error(
          `Unexpected nested check-in evidence result "${result.status}"`,
        );
      default: {
        const exhaustiveResult: never = result;
        return exhaustiveResult;
      }
    }
  }

  private responseOutcome(input: {
    checkIn: ProgressCheckInRecord;
    projectionInput: ChildProgressProjectionInput;
    responseId: string;
    conflictId: string | null;
    progressUpdate: ProgressCheckInUpdate | null;
  }): ProgressCheckInResponseOutcome {
    if (input.conflictId !== null) {
      return {
        status: "conflict_open",
        checkIn: input.checkIn,
        conflict: conflictCard(
          input.projectionInput,
          input.conflictId,
        ),
        responseId: input.responseId,
      };
    }
    switch (input.checkIn.state) {
      case "active":
        return {
          status: "advanced",
          checkIn: input.checkIn,
          prompt: requirePrompt(input.checkIn),
          responseId: input.responseId,
          ...(input.progressUpdate
            ? { progressUpdate: input.progressUpdate }
            : {}),
        };
      case "completed":
        return {
          status: "completed",
          checkIn: input.checkIn,
          responseId: input.responseId,
          ...(input.progressUpdate
            ? { progressUpdate: input.progressUpdate }
            : {}),
        };
      case "paused":
      case "stopped":
        throw new Error(
          `Unexpected response state "${input.checkIn.state}"`,
        );
      default: {
        const exhaustiveState: never = input.checkIn.state;
        return exhaustiveState;
      }
    }
  }

  private preservedNextState(
    checkIn: ProgressCheckInRecord,
    context: ProgressCheckInContext,
  ) {
    return {
      state: checkIn.state,
      terminalReason: checkIn.terminalReason ?? null,
      terminalMixedEvidence: checkIn.terminalMixedEvidence ?? null,
      acceptedResponseCount: checkIn.acceptedResponseCount ?? null,
      uncertainResponseCount: checkIn.uncertainResponseCount ?? null,
      ownerMemberUserId: checkIn.ownerMemberUserId,
      recipientMemberUserId:
        checkIn.recipientMemberUserId,
      currentItemId: checkIn.currentItemId,
      currentDeliveryId: checkIn.currentDeliveryId,
      episodeId: context.episodeId,
      pendingRuntimeSessionId: checkIn.pendingRuntimeSessionId,
      pendingTurnId: checkIn.pendingTurnId,
      pauseReason: checkIn.pauseReason,
      pausedAt: checkIn.pausedAt,
      completedAt: checkIn.completedAt,
      stoppedAt: checkIn.stoppedAt,
      updatedAt: context.now,
    };
  }

  private async mutateRecipientCheckIn(
    context: ProgressCheckInContext,
    checkInId: string,
    decide: (
      locked: LockedCheckInContext,
    ) =>
      | ProgressCheckInResult
      | {
          next: ReturnType<
            ProgressCheckInService["preservedNextState"]
          >;
          buildResult: (
            checkIn: ProgressCheckInRecord,
          ) => ProgressCheckInResult;
        },
  ): Promise<ProgressCheckInResult> {
    return this.repository.withTransaction(async (transaction) => {
      if (
        !await this.lockAuthenticatedMember(transaction, context)
      ) {
        return { status: "wrong_recipient" };
      }
      const locked = await this.lockCheckInContext(
        transaction,
        context.familyId,
        checkInId,
      );
      if (locked === null) {
        return { status: "no_active_check_in" };
      }
      if (
        locked.checkIn.recipientMemberUserId !==
        context.memberUserId
      ) {
        return { status: "wrong_recipient" };
      }
      const decision = decide(locked);
      if (!("next" in decision)) return decision;
      const updated = await transaction.compareAndSwapCheckIn({
        familyId: locked.checkIn.familyId,
        childId: locked.checkIn.childId,
        checkInId: locked.checkIn.id,
        expectedRevision: locked.checkIn.revision,
        next: decision.next,
      });
      if (updated === null) {
        throw new Error("Locked check-in compare-and-swap failed");
      }
      await this.cancelSupersededReplyLoops(transaction, updated);
      return decision.buildResult(updated);
    });
  }
}
