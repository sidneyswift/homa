import type {
  ProgressCheckInContext,
} from "./types";
import type {
  ChildProgressToolOperations,
} from "./tool-operations";
import {
  adaptCheckInResult,
  adaptJournalResult,
  adaptUndoResult,
} from "./tool-result-adapter";
import { liveProgressEnabled } from "./flag";
import {
  disabledProgressResult,
  observationUsedResult,
  refusedProgressResult,
} from "./tool-result-payloads";
import type {
  ManageChildProgressInput,
  ManageChildProgressResult,
} from "./tool-contract";
import { progressOperationIdempotencyKey } from "./tool-contract";

export type { ChildProgressToolOperations } from "./tool-operations";

/**
 * Keeps disabled turns outside authenticated context resolution and every
 * ChildProgress operation, including reads.
 */
export async function executeChildProgressTool(input: {
  command: ManageChildProgressInput;
  createContext: () => ProgressCheckInContext;
  operations: ChildProgressToolOperations;
}): Promise<ManageChildProgressResult> {
  if (!liveProgressEnabled()) {
    return disabledProgressResult();
  }
  return await executeChildProgressCommand(
    input.command,
    input.createContext(),
    input.operations,
  );
}

/**
 * Translates the strict model command into service calls that receive trusted
 * context separately, then removes server-only item and evidence identifiers
 * from the result.
 */
export async function executeChildProgressCommand(
  command: ManageChildProgressInput,
  context: ProgressCheckInContext,
  operations: ChildProgressToolOperations,
): Promise<ManageChildProgressResult> {
  // mark_observation_used also works from dispatch sessions: the
  // morning brief is where observations get woven into the family's
  // week (plan 2026-07-13-observation-ledger.md, OBS-3).
  const allowsDispatch = command.action === "mark_observation_used";
  if (
    context.channel !== "web" &&
    context.channel !== "sms" &&
    context.channel !== "email" &&
    !(allowsDispatch && context.channel === "dispatch")
  ) {
    return refusedProgressResult();
  }
  if (
    (
      command.action === "record_journal_evidence" ||
      command.action === "respond_check_in"
    ) &&
    (
      context.canonicalInboundText === null ||
      context.inboundMessageId === null
    )
  ) {
    return refusedProgressResult();
  }
  const idempotencyKey = progressOperationIdempotencyKey(
    context,
    command.action,
  );
  switch (command.action) {
    case "start_check_in":
      return adaptCheckInResult({
        result: await operations.startCheckIn(context, {
          childId: command.childId,
          purpose: command.purpose,
          ...(command.subjectId
            ? { subjectId: command.subjectId }
            : {}),
          idempotencyKey,
        }),
        context,
        childId: command.childId,
        operations,
      });
    case "respond_check_in":
      return adaptCheckInResult({
        result: await operations.respondCheckIn(context, {
          ...command,
          idempotencyKey,
        }),
        context,
        checkInId: command.checkInId,
        operations,
      });
    case "pause_check_in":
      return adaptCheckInResult({
        result: await operations.pauseCheckIn(context, {
          checkInId: command.checkInId,
          reason:
            command.reason === "explicit_stop"
              ? "explicit_pause"
              : command.reason,
        }),
        context,
        checkInId: command.checkInId,
        operations,
      });
    case "resume_check_in":
      return adaptCheckInResult({
        result: await operations.resumeCheckIn(context, command),
        context,
        checkInId: command.checkInId,
        operations,
      });
    case "stop_check_in":
      return adaptCheckInResult({
        result: await operations.stopCheckIn(context, command),
        context,
        checkInId: command.checkInId,
        operations,
      });
    case "takeover_check_in":
      return adaptCheckInResult({
        result: await operations.takeoverCheckIn(context, command),
        context,
        checkInId: command.checkInId,
        operations,
      });
    case "record_journal_evidence":
      return adaptJournalResult({
        result: await operations.recordJournalEvidence(context, {
          childId: command.childId,
          idempotencyKey,
          ...(command.subjectId
            ? { subjectId: command.subjectId }
            : {}),
        }),
        context,
        childId: command.childId,
        operations,
      });
    case "resolve_conflict":
      return adaptCheckInResult({
        result: await operations.resolveConflict(context, {
          ...command,
          idempotencyKey,
        }),
        context,
        operations,
      });
    case "undo_progress_update":
      return adaptUndoResult({
        result: await operations.undoProgressUpdate(context, {
          operationId: command.operationId,
          idempotencyKey,
        }),
        context,
        operations,
      });
    case "mark_observation_used": {
      const result = await operations.markObservationUsed(context, {
        observationId: command.observationId,
      });
      switch (result.outcome) {
        case "used":
          return observationUsedResult(false);
        case "already_used":
          return observationUsedResult(true);
        case "unknown_observation":
          return refusedProgressResult();
        default: {
          const exhaustiveOutcome: never = result;
          return exhaustiveOutcome;
        }
      }
    }
    default: {
      const exhaustiveCommand: never = command;
      return exhaustiveCommand;
    }
  }
}
