import { ProgressCheckInService } from "./check-in-service";
import { PostgresChildProgressRepository } from "./postgres-repository";
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
  progressEventsForJournalObservation,
  progressEventsForObservationUsed,
  progressEventsForUndoResult,
  withCommittedProgressEvents,
} from "./progress-events";
import { buildChildProgressView } from "./projection";
import {
  ChildProgressService,
  type CorrectProgressAnswersInput,
  type RecordJournalProgressEvidenceInput,
  type RecordJournalProgressEvidenceResult,
  type RecordProgressEvidenceInput,
  type RecordProgressEvidenceResult,
} from "./progress-service";
import type {
  ProgressCheckInContext,
  ProgressCheckInPauseReason,
  ProgressCheckInPurpose,
  ProgressEvidenceAnswer,
} from "./types";

const childProgressRepository =
  new PostgresChildProgressRepository();
const childProgressService = new ChildProgressService(
  childProgressRepository,
  { buildView: buildChildProgressView },
);
const progressCheckInService = new ProgressCheckInService(
  childProgressRepository,
  childProgressService,
  {
    onAnswerCommitted: async (event) => {
      await emitProgressEvents(
        progressEventsForCheckInAnswer(event),
      );
    },
    onConflictResolutionCommitted: async (event) => {
      await emitProgressEvents(
        progressEventsForCheckInResolution(event),
      );
    },
  },
);

async function conflictItemIdsForResult(
  result:
    | RecordProgressEvidenceResult
    | RecordJournalProgressEvidenceResult,
): Promise<string[]> {
  if (result.status !== "conflict_open") return [];
  const firstEvidence = result.evidence[0];
  if (firstEvidence === undefined) return [];
  try {
    const view = await childProgressService.getChildProgressView(
      firstEvidence.familyId,
      firstEvidence.childId,
    );
    const conflictIds = new Set(result.conflictIds);
    return view?.conflicts
      .filter((conflict) => conflictIds.has(conflict.id))
      .map((conflict) => conflict.itemId) ?? [];
  } catch {
    console.error("Committed progress conflict metadata lookup failed");
    return [];
  }
}

async function emitEvidenceResultEvents(
  result:
    | RecordProgressEvidenceResult
    | RecordJournalProgressEvidenceResult,
): Promise<void> {
  await emitProgressEvents(
    progressEventsForEvidenceResult(
      result,
      await conflictItemIdsForResult(result),
    ),
  );
}

export function recordProgressEvidence(
  input: RecordProgressEvidenceInput,
) {
  return withCommittedProgressEvents(
    childProgressService.recordProgressEvidence(input),
    emitEvidenceResultEvents,
  );
}

export function recordJournalProgressEvidence(
  input: RecordJournalProgressEvidenceInput,
) {
  return withCommittedProgressEvents(
    childProgressService.recordJournalProgressEvidence(input),
    async (result) => {
      await emitEvidenceResultEvents(result);
      await emitProgressEvents(
        progressEventsForJournalObservation(input, result),
      );
    },
  );
}

/**
 * Flips one observation to used (observation ledger, OBS-3). Family
 * scope and the task-run id come from trusted context, never the model.
 */
export async function markChildObservationUsed(input: {
  familyId: string;
  observationId: string;
  usedTaskRunId: string | null;
  usedAt: string;
}) {
  const result = await childProgressRepository.markObservationUsed({
    familyId: input.familyId,
    observationId: input.observationId,
    usedTaskRunId: input.usedTaskRunId,
    usedAt: input.usedAt,
  });
  if (result.outcome === "used") {
    await emitProgressEvents(
      progressEventsForObservationUsed({
        familyId: input.familyId,
        childId: result.childId,
      }),
    );
  }
  return result;
}

export function correctProgressAnswers(
  input: CorrectProgressAnswersInput,
) {
  return withCommittedProgressEvents(
    childProgressService.correctProgressAnswers(input),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCorrectionResult(
          input.familyId,
          result,
        ),
      );
    },
  );
}

export function undoProgressUpdate(
  context: ProgressCheckInContext,
  input: { operationId: string; idempotencyKey: string },
) {
  return withCommittedProgressEvents(
    childProgressService.undoProgressOperation({
      familyId: context.familyId,
      memberUserId: context.memberUserId,
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      observedAt: context.now,
    }),
    async (result) => {
      await emitProgressEvents(
        progressEventsForUndoResult(context.familyId, result),
      );
    },
  );
}

export function getChildProgressView(
  familyId: string,
  childId: string,
) {
  return childProgressService.getChildProgressView(familyId, childId);
}

export function startProgressCheckIn(
  context: ProgressCheckInContext,
  input: {
    childId: string;
    purpose: ProgressCheckInPurpose;
    subjectIds?: string[];
    idempotencyKey: string;
  },
) {
  return withCommittedProgressEvents(
    progressCheckInService.startCheckIn(context, input),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCheckInStart(result),
      );
    },
  );
}

export function respondToProgressCheckIn(
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
) {
  return progressCheckInService.respondCheckIn(context, input);
}

export function pauseProgressCheckIn(
  context: ProgressCheckInContext,
  input: {
    checkInId: string;
    expectedRevision?: number;
    reason: Exclude<
      ProgressCheckInPauseReason,
      "conflict" | "member_removed"
    >;
  },
) {
  return withCommittedProgressEvents(
    progressCheckInService.pauseCheckIn(context, input),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCheckInPause(input.reason, result),
      );
    },
  );
}

export function resumeProgressCheckIn(
  context: ProgressCheckInContext,
  input: { checkInId: string; expectedRevision?: number },
) {
  return withCommittedProgressEvents(
    progressCheckInService.resumeCheckIn(context, input),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCheckInResume(result),
      );
    },
  );
}

export function takeoverProgressCheckIn(
  context: ProgressCheckInContext,
  input: { checkInId: string; expectedRevision?: number },
) {
  return withCommittedProgressEvents(
    progressCheckInService.takeoverCheckIn(context, input),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCheckInTakeover(result),
      );
    },
  );
}

export function pauseProgressCheckInForDeliveryOutcome(
  context: ProgressCheckInContext,
  input: {
    checkInId: string;
    expectedRevision: number;
    reason: "delivery_uncertain" | "delivery_failed";
  },
) {
  return withCommittedProgressEvents(
    progressCheckInService.pauseCheckInForDeliveryOutcome(
      context,
      input,
    ),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCheckInPause(input.reason, result),
      );
    },
  );
}

export function stopProgressCheckIn(
  context: ProgressCheckInContext,
  input: { checkInId: string; expectedRevision?: number },
) {
  return withCommittedProgressEvents(
    progressCheckInService.stopCheckIn(context, input),
    async (result) => {
      await emitProgressEvents(
        progressEventsForCheckInStop(result),
      );
    },
  );
}

export function resolveProgressConflict(
  context: ProgressCheckInContext,
  input: {
    conflictId: string;
    answer: ProgressEvidenceAnswer;
    idempotencyKey: string;
  },
) {
  return progressCheckInService.resolveProgressConflict(context, input);
}

export function listActiveFamilyProgressCheckIns(familyId: string) {
  return progressCheckInService.listActiveFamilyCheckIns(familyId);
}

export function getActiveChildProgressCheckIn(
  familyId: string,
  childId: string,
) {
  return progressCheckInService.getActiveChildCheckIn(
    familyId,
    childId,
  );
}

export function getProgressCheckInPromptContext(
  context: ProgressCheckInContext,
) {
  return progressCheckInService.getPromptContext(context);
}

export function bindProgressCheckInDelivery(
  context: ProgressCheckInContext,
  input: {
    checkInId: string;
    expectedRevision: number;
    deliveryId: string;
  },
) {
  return progressCheckInService.bindCurrentDelivery(context, input);
}

export { ChildProgressService, ProgressCheckInService };
export type {
  ChildProgressOperationOutcome,
  ChildProgressViewBuilder,
  ChildProgressServiceOptions,
  CorrectProgressAnswersInput,
  CorrectProgressAnswersResult,
  DirectProgressSourceKind,
  ProgressWriteResult,
  ProgressConflictPendingResult,
  RecordProgressEvidenceInTransactionInput,
  RecordJournalProgressEvidenceInput,
  RecordJournalProgressEvidenceResult,
  RecordProgressEvidenceInput,
  RecordProgressEvidenceResult,
  UndoProgressEvidenceResult,
  UndoProgressOperationResult,
} from "./progress-service";
export type {
  ChildProgressProjectionInput,
  ChildProgressRepository,
  ChildProgressTransaction,
  ProgressCheckInRepository,
  ProgressCheckInTransaction,
} from "./repository";
export type {
  ChildProgressView,
  ProgressCheckInBindResult,
  ProgressCheckInChannel,
  ProgressCheckInContext,
  ProgressCheckInPauseReason,
  ProgressCheckInPrompt,
  ProgressCheckInPurpose,
  ProgressCheckInRecord,
  ProgressCheckInResult,
  ProgressCheckInScope,
  ProgressCheckInState,
  ProgressConflict,
  ProgressConflictCard,
  ProgressEvidence,
} from "./types";
