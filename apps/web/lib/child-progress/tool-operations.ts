import type {
  RecordJournalProgressEvidenceResult,
  UndoProgressOperationResult,
} from "./progress-service";
import type { MarkChildObservationUsedResult } from "./repository";
import type {
  ChildProgressView,
  ProgressCheckInContext,
  ProgressCheckInRecord,
  ProgressCheckInResult,
} from "./types";

/**
 * Injectable service boundary for the pure model-command adapter.
 */
export interface ChildProgressToolOperations {
  startCheckIn(
    context: ProgressCheckInContext,
    input: {
      childId: string;
      purpose:
        | "whole_map_refresh"
        | "subject_deep_dive"
        | "age_refresh";
      subjectId?: string;
      idempotencyKey: string;
    },
  ): Promise<ProgressCheckInResult>;
  respondCheckIn(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      answer:
        | "easily"
        | "getting_there"
        | "not_yet"
        | "not_sure"
        | "skip";
      idempotencyKey: string;
    },
  ): Promise<ProgressCheckInResult>;
  pauseCheckIn(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      reason: "topic_change" | "explicit_pause";
    },
  ): Promise<ProgressCheckInResult>;
  resumeCheckIn(
    context: ProgressCheckInContext,
    input: { checkInId: string },
  ): Promise<ProgressCheckInResult>;
  stopCheckIn(
    context: ProgressCheckInContext,
    input: { checkInId: string },
  ): Promise<ProgressCheckInResult>;
  takeoverCheckIn(
    context: ProgressCheckInContext,
    input: { checkInId: string },
  ): Promise<ProgressCheckInResult>;
  recordJournalEvidence(
    context: ProgressCheckInContext,
    input: {
      childId: string;
      idempotencyKey: string;
      subjectId?: string;
    },
  ): Promise<RecordJournalProgressEvidenceResult>;
  resolveConflict(
    context: ProgressCheckInContext,
    input: {
      conflictId: string;
      answer: "easily" | "getting_there" | "not_yet";
      idempotencyKey: string;
    },
  ): Promise<ProgressCheckInResult>;
  undoProgressUpdate(
    context: ProgressCheckInContext,
    input: {
      operationId: string;
      idempotencyKey: string;
    },
  ): Promise<UndoProgressOperationResult>;
  markObservationUsed(
    context: ProgressCheckInContext,
    input: { observationId: string },
  ): Promise<MarkChildObservationUsedResult>;
  listFamilyCheckIns(
    familyId: string,
  ): Promise<ProgressCheckInRecord[]>;
  getChildProgressView(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressView | null>;
}
