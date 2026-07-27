import type {
  RecordJournalProgressEvidenceResult,
  UndoProgressOperationResult,
} from "./progress-service";
import type {
  ProgressCheckInContext,
  ProgressCheckInResult,
} from "./types";
import type {
  ChildProgressToolOperations,
} from "./tool-operations";
import {
  progressConflictCardResult,
  progressConflictViewResult,
  progressQuestionResult,
  progressUpdateResult,
  progressWorkflowResult,
  refusedProgressResult,
  reissueProgressResult,
} from "./tool-result-payloads";
import {
  ACTIVITY_ONLY_PROGRESS_NOTE,
  AMBIGUOUS_PROGRESS_NOTE,
  JOURNAL_HOURS_PROGRESS_NOTE,
  manageChildProgressResultSchema,
  NO_MATCH_PROGRESS_NOTE,
  type ManageChildProgressResult,
} from "./tool-contract";

async function childIdForCheckIn(
  context: ProgressCheckInContext,
  checkInId: string,
  operations: ChildProgressToolOperations,
): Promise<string | null> {
  const checkIns = await operations.listFamilyCheckIns(context.familyId);
  return (
    checkIns.find((checkIn) => checkIn.id === checkInId)?.childId ??
    null
  );
}

export async function adaptCheckInResult(input: {
  result: ProgressCheckInResult;
  context: ProgressCheckInContext;
  checkInId?: string;
  childId?: string;
  operations: ChildProgressToolOperations;
}): Promise<ManageChildProgressResult> {
  const { result } = input;
  switch (result.status) {
    case "started":
    case "resumed":
      return progressQuestionResult(result.prompt);
    case "advanced":
      return progressQuestionResult(
        result.prompt,
        result.progressUpdate,
      );
    case "existing":
      if (result.checkIn.state === "paused") {
        return progressWorkflowResult("Check-in paused");
      }
      return result.prompt
        ? progressQuestionResult(result.prompt)
        : refusedProgressResult();
    case "stopped":
      return progressWorkflowResult("Check-in saved");
    case "completed":
      return progressWorkflowResult(
        "Check-in saved",
        result.progressUpdate,
      );
    case "conflict_open":
      return progressConflictCardResult(result.conflict);
    case "paused":
      return progressWorkflowResult("Check-in paused");
    case "takeover_accepted":
      return progressWorkflowResult("Check-in moved");
    case "conflict_resolved":
      return result.prompt
        ? progressQuestionResult(result.prompt)
        : progressWorkflowResult("Check-in saved");
    case "duplicate":
      return adaptCheckInResult({ ...input, result: result.original });
    case "conflict_pending": {
      const childId =
        input.childId ??
        (
          input.checkInId
            ? await childIdForCheckIn(
                input.context,
                input.checkInId,
                input.operations,
              )
            : null
        );
      return childId
        ? progressConflictViewResult({
            context: input.context,
            childId,
            conflictId: result.conflictId,
            operations: input.operations,
          })
        : refusedProgressResult();
    }
    case "no_active_check_in":
    case "stale_prompt":
    case "wrong_delivery":
      return reissueProgressResult();
    case "unknown_child":
    case "wrong_recipient":
    case "idempotency_mismatch":
    case "invalid_scope":
      return refusedProgressResult();
    default: {
      const exhaustiveResult: never = result;
      return exhaustiveResult;
    }
  }
}

export async function adaptJournalResult(input: {
  result: RecordJournalProgressEvidenceResult;
  context: ProgressCheckInContext;
  childId: string;
  operations: ChildProgressToolOperations;
}): Promise<ManageChildProgressResult> {
  const { result } = input;
  switch (result.status) {
    case "activity_only":
      return manageChildProgressResultSchema.parse({
        kind: "activity_only",
        note: ACTIVITY_ONLY_PROGRESS_NOTE,
      });
    case "no_match":
      return manageChildProgressResultSchema.parse({
        kind: "no_match",
        note: NO_MATCH_PROGRESS_NOTE,
      });
    case "ambiguous":
      return manageChildProgressResultSchema.parse({
        kind: "ambiguous",
        note: AMBIGUOUS_PROGRESS_NOTE,
      });
    case "recorded":
      return progressUpdateResult({
        context: input.context,
        childId: input.childId,
        affectedItemIds: result.affectedItemIds,
        undoToken: result.operationId ?? null,
        operations: input.operations,
        note: JOURNAL_HOURS_PROGRESS_NOTE,
      });
    case "conflict_open": {
      const conflictId = result.conflictIds[0];
      return conflictId
        ? progressConflictViewResult({
            context: input.context,
            childId: input.childId,
            conflictId,
            operations: input.operations,
          })
        : refusedProgressResult();
    }
    case "conflict_pending":
      return progressConflictViewResult({
        context: input.context,
        childId: input.childId,
        conflictId: result.conflictId,
        operations: input.operations,
      });
    case "duplicate":
      return adaptJournalResult({ ...input, result: result.original });
    case "unknown_child":
    case "unknown_actor":
    case "idempotency_mismatch":
      return refusedProgressResult();
    default: {
      const exhaustiveResult: never = result;
      return exhaustiveResult;
    }
  }
}

export async function adaptUndoResult(input: {
  result: UndoProgressOperationResult;
  context: ProgressCheckInContext;
  operations: ChildProgressToolOperations;
}): Promise<ManageChildProgressResult> {
  switch (input.result.status) {
    case "undone":
      return progressUpdateResult({
        context: input.context,
        childId: input.result.childId,
        affectedItemIds: input.result.affectedItemIds,
        undoToken: null,
        operations: input.operations,
      });
    case "duplicate":
      return adaptUndoResult({
        ...input,
        result: input.result.original,
      });
    case "conflict_pending":
    case "unknown_operation":
    case "unknown_actor":
    case "idempotency_mismatch":
      return refusedProgressResult();
    default: {
      const exhaustiveResult: never = input.result;
      return exhaustiveResult;
    }
  }
}
