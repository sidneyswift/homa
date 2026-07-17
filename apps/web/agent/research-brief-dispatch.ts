import { persistCanonicalMessage } from "../lib/conversation-continuity/ledger";
import { operationalDiagnostic } from "../lib/operational-diagnostics";
import { deliverLiveDispatchTask } from "../lib/tasks/dispatch-transport";
import {
  deliverPreparedResearchBrief,
  handlePreparedResearchBriefTerminalEvent,
  type PreparedResearchBriefDeliveryState,
  type PreparedResearchBriefDeliveryResult,
} from "../lib/tasks/research-brief-delivery";
import { emitResearchBriefDispatchCompletion } from "../lib/tasks/research-brief-events";
import {
  finalizePreparedResearchBriefDelivery,
  loadPreparedResearchBriefForDelivery,
  recordPreparedResearchBriefSaveOnlyAcceptance,
} from "../lib/tasks/research-brief-store";
import {
  finishTaskRun,
} from "../lib/tasks/store";
import {
  usesResearchBriefV2Delivery,
  type TaskDeliveryVersion,
} from "../lib/tasks/delivery-version";
import type { FamilyTaskKind } from "../lib/tasks/kinds";

export interface ResearchBriefDispatchState
  extends PreparedResearchBriefDeliveryState {
  familyId: string | null;
  runId: string | null;
  episodeId: string | null;
  kind: FamilyTaskKind;
  deliveryPref: "text" | "email" | "none";
  recipientMemberUserId: string | null;
  deliveryVersion: TaskDeliveryVersion;
}

export function usesResearchBriefV2Dispatch(
  kind: FamilyTaskKind,
  deliveryVersion: TaskDeliveryVersion,
): boolean {
  return kind === "morning_brief" &&
    usesResearchBriefV2Delivery(deliveryVersion);
}

async function failResearchBriefDispatchRun(
  state: ResearchBriefDispatchState,
  sessionId: string | undefined,
  error = "morning brief delivery did not complete",
): Promise<void> {
  if (
    !state.runId ||
    !state.familyId ||
    !usesResearchBriefV2Dispatch(state.kind, state.deliveryVersion)
  ) {
    return;
  }
  await finishTaskRun(state.runId, {
    familyId: state.familyId,
    kind: state.kind,
    status: "failed",
    error,
    ...(sessionId ? { sessionId } : {}),
    onlyIfRunning: true,
  });
}

export async function deliverResearchBriefDispatch(input: {
  state: ResearchBriefDispatchState;
  authAttributes: unknown;
  sessionId: string;
  sequence: number;
  turnId?: string;
}): Promise<PreparedResearchBriefDeliveryResult> {
  const { state } = input;
  const familyId = state.familyId;
  const runId = state.runId;
  if (!familyId || !runId) {
    await failResearchBriefDispatchRun(state, input.sessionId);
    return { status: "failed_before_transport" };
  }
  const result = await deliverPreparedResearchBrief(
    {
      familyId,
      taskRunId: runId,
      state,
    },
    {
      loadPrepared: loadPreparedResearchBriefForDelivery,
      persistCanonical: async (draft) => {
        const message = await persistCanonicalMessage({
          attributes: input.authAttributes,
          sessionId: input.sessionId,
          channel: "dispatch",
          sequence: input.sequence,
          role: "assistant",
          content: draft,
          turnId: input.turnId,
        });
        if (!message || !state.episodeId) {
          throw new Error(
            "prepared dispatch message could not enter the continuity ledger",
          );
        }
        return { id: message.id, episodeId: message.episodeId };
      },
      deliver: async (draft, message, markTransportAccepted) => {
        return await deliverLiveDispatchTask(
          {
            familyId,
            episodeId: message.episodeId,
            messageId: message.id,
            taskRunId: runId,
            kind: "morning_brief",
            text: draft,
            deliveryMode: state.deliveryPref,
            recipientMemberUserId: state.recipientMemberUserId,
            label: null,
            deliveryVersion: state.deliveryVersion,
          },
          undefined,
          markTransportAccepted,
        );
      },
      recordAcceptance: async (prepared, delivery) => {
        switch (delivery.deliveredChannel) {
          case "sms":
          case "email":
            return;
          case "none": {
            const recorded =
              await recordPreparedResearchBriefSaveOnlyAcceptance({
                familyId,
                taskRunId: prepared.taskRunId,
                draft: prepared.draft,
              });
            if (!recorded) {
              throw new Error(
                "prepared save-only acceptance could not be recorded",
              );
            }
            return;
          }
          case null:
            throw new Error(
              "accepted prepared delivery had no delivery channel",
            );
          default: {
            const exhaustive: never = delivery.deliveredChannel;
            throw new Error(
              `unhandled prepared delivery channel: ${String(exhaustive)}`,
            );
          }
        }
      },
      finalize: async (prepared, message) =>
        await finalizePreparedResearchBriefDelivery({
          familyId,
          taskRunId: prepared.taskRunId,
          canonicalMessageId: message.id,
          sessionId: input.sessionId,
        }),
      failRun: async (reason) => {
        await failResearchBriefDispatchRun(
          state,
          input.sessionId,
          reason,
        );
      },
      logFailure: (phase) => {
        console.error(
          operationalDiagnostic("morning_brief", phase, "failed"),
        );
      },
      logRecoveryPending: (phase) => {
        console.error(
          operationalDiagnostic(
            "morning_brief",
            phase,
            "retry_pending",
          ),
        );
      },
    },
  );
  await emitResearchBriefDispatchCompletion(familyId, result);
  return result;
}

export async function handleResearchBriefDispatchTerminalEvent(input: {
  eventType: "turn.completed" | "turn.failed" | "session.failed";
  state: ResearchBriefDispatchState;
  sessionId?: string;
}): Promise<void> {
  await handlePreparedResearchBriefTerminalEvent(
    {
      eventType: input.eventType,
      enabled: usesResearchBriefV2Dispatch(
        input.state.kind,
        input.state.deliveryVersion,
      ),
      state: input.state,
    },
    async (reason) => {
      await failResearchBriefDispatchRun(
        input.state,
        input.sessionId,
        reason,
      );
    },
  );
}
