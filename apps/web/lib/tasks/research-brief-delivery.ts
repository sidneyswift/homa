import {
  aggregateDurableDeliveryAttempts,
  type DeliveryAggregate,
} from "../conversation-continuity/delivery-policy";
import type { OperationalPhase } from "../operational-diagnostics";
import { usesResearchBriefV2Delivery } from "./delivery-version";
import type { ResearchBriefSourceSnapshot } from "./research-brief-preparation";

export interface PreparedResearchBrief {
  familyId: string;
  taskRunId: string;
  childId: string;
  knowledgeId: string;
  observationId?: string;
  draft: string;
  sourceSnapshot: ResearchBriefSourceSnapshot;
}

export interface DurableResearchBriefDeliveryAttempt {
  recipientKey: string;
  channel: "sms" | "email";
  status: "pending" | "sent" | "failed" | "uncertain";
}

export function aggregateResearchBriefDeliveryAttempts(
  attempts: readonly DurableResearchBriefDeliveryAttempt[],
): DeliveryAggregate {
  return aggregateDurableDeliveryAttempts(attempts);
}

export interface PreparedResearchBriefDeliveryState {
  transportAccepted: boolean;
  delivered: boolean;
}

export interface PreparedResearchBriefMessage {
  id: string;
  episodeId: string;
}

export interface PreparedResearchBriefFinalization {
  prepared: PreparedResearchBrief;
  delivery: DeliveryAggregate;
}

export interface PreparedResearchBriefDeliveryDependencies {
  loadPrepared(input: {
    familyId: string;
    taskRunId: string;
  }): Promise<PreparedResearchBrief | null>;
  persistCanonical(
    draft: string,
    prepared: PreparedResearchBrief,
  ): Promise<PreparedResearchBriefMessage>;
  deliver(
    draft: string,
    message: PreparedResearchBriefMessage,
    markTransportAccepted: () => void,
  ): Promise<DeliveryAggregate>;
  recordAcceptance(
    prepared: PreparedResearchBrief,
    delivery: DeliveryAggregate,
  ): Promise<void>;
  finalize(
    prepared: PreparedResearchBrief,
    message: PreparedResearchBriefMessage,
  ): Promise<PreparedResearchBriefFinalization | null>;
  failRun(reason: string): Promise<void>;
  logFailure?(phase: OperationalPhase): void;
  logRecoveryPending(phase: OperationalPhase): void;
}

export type PreparedResearchBriefDeliveryResult =
  | { status: "failed_before_transport" }
  | { status: "delivery_not_accepted"; delivery: DeliveryAggregate }
  | { status: "recovery_pending" }
  | {
      status: "completed";
      prepared: PreparedResearchBrief;
      message: PreparedResearchBriefMessage;
      delivery: DeliveryAggregate;
    };

const PREPARED_BRIEF_FAILURE = "morning brief delivery did not complete";

export function preparedResearchBriefOwnsCanonicalPersistence(
  attributes: unknown,
): boolean {
  const values = (attributes ?? {}) as {
    channel?: unknown;
    taskKind?: unknown;
    deliveryVersion?: unknown;
  };
  return (
    values.channel === "dispatch" &&
    values.taskKind === "morning_brief" &&
    values.deliveryVersion === "research_brief_v2" &&
    usesResearchBriefV2Delivery(values.deliveryVersion)
  );
}

export function isPreparedResearchBriefTerminalMessage(input: {
  finishReason?: string;
  message?: string | null;
}): boolean {
  return input.finishReason === "stop" && Boolean(input.message?.trim());
}

export async function handlePreparedResearchBriefTerminalEvent(
  input: {
    eventType: "turn.completed" | "turn.failed" | "session.failed";
    enabled: boolean;
    state: PreparedResearchBriefDeliveryState;
  },
  failRun: (reason: string) => Promise<void>,
): Promise<void> {
  switch (input.eventType) {
    case "turn.completed":
    case "turn.failed":
    case "session.failed":
      break;
    default: {
      const exhaustive: never = input.eventType;
      throw new Error(`unhandled prepared brief event: ${String(exhaustive)}`);
    }
  }
  if (
    !input.enabled ||
    input.state.delivered ||
    input.state.transportAccepted
  ) {
    return;
  }
  await failRun(PREPARED_BRIEF_FAILURE);
}

/**
 * Runs the production v2 delivery boundary. Errors before transport acceptance
 * fail immediately. Errors after acceptance stay running for idempotent
 * recovery because a parent may already have received the prepared draft.
 */
export async function deliverPreparedResearchBrief(
  input: {
    familyId: string;
    taskRunId: string;
    state: PreparedResearchBriefDeliveryState;
  },
  dependencies: PreparedResearchBriefDeliveryDependencies,
): Promise<PreparedResearchBriefDeliveryResult> {
  let phase: OperationalPhase = "preparation_load";
  let prepared: PreparedResearchBrief;
  let message: PreparedResearchBriefMessage;
  try {
    const loaded = await dependencies.loadPrepared(input);
    if (!loaded) {
      dependencies.logFailure?.(phase);
      await dependencies.failRun(PREPARED_BRIEF_FAILURE);
      return { status: "failed_before_transport" };
    }
    prepared = loaded;
    phase = "canonical_persist";
    message = await dependencies.persistCanonical(prepared.draft, prepared);
  } catch {
    dependencies.logFailure?.(phase);
    await dependencies.failRun(PREPARED_BRIEF_FAILURE);
    return { status: "failed_before_transport" };
  }

  phase = "transport";
  let transportDelivery: DeliveryAggregate | null = null;
  try {
    transportDelivery = await dependencies.deliver(
      prepared.draft,
      message,
      () => {
        input.state.transportAccepted = true;
      },
    );
  } catch {
    // Durable attempts, if any, are re-read under the finalization run lock.
  }

  if (transportDelivery && transportDelivery.deliveredCount > 0) {
    input.state.transportAccepted = true;
    phase = "finalization";
    try {
      await dependencies.recordAcceptance(prepared, transportDelivery);
    } catch {
      dependencies.logRecoveryPending(phase);
      return { status: "recovery_pending" };
    }
  }

  phase = "finalization";
  try {
    const finalized = await dependencies.finalize(
      prepared,
      message,
    );
    if (!finalized) {
      throw new Error("prepared research brief finalization was unavailable");
    }
    const delivery = finalized.delivery;
    input.state.delivered = delivery.deliveredCount > 0;
    if (delivery.deliveredCount === 0) {
      return { status: "delivery_not_accepted", delivery };
    }
    input.state.transportAccepted = true;
    return {
      status: "completed",
      prepared: finalized.prepared,
      message,
      delivery,
    };
  } catch {
    dependencies.logRecoveryPending(phase);
    return { status: "recovery_pending" };
  }
}

export interface RecoverablePreparedResearchBriefDelivery {
  messageId: string;
  delivery: DeliveryAggregate;
}

export type PreparedResearchBriefAggregateRecoveryResult =
  | { status: "not_found" }
  | { status: "recovery_pending" }
  | { status: "recovered"; delivery: DeliveryAggregate };

export interface PreparedResearchBriefAggregateRecoveryDependencies {
  loadDelivery(input: {
    familyId: string;
    taskRunId: string;
  }): Promise<RecoverablePreparedResearchBriefDelivery | null>;
  finalize(
    snapshot: RecoverablePreparedResearchBriefDelivery,
  ): Promise<PreparedResearchBriefFinalization | null>;
  logRecoveryPending(phase: OperationalPhase): void;
}

/**
 * Replays post-delivery persistence from the complete durable delivery
 * aggregate. Confirmed delivery and save-only receipts finalize brief effects.
 * Failed or uncertain aggregates finish honestly without consuming evidence.
 */
export async function recoverPreparedResearchBriefFromDurableDelivery(
  input: { familyId: string; taskRunId: string },
  dependencies: PreparedResearchBriefAggregateRecoveryDependencies,
): Promise<PreparedResearchBriefAggregateRecoveryResult> {
  let phase: OperationalPhase = "recovery_lookup";
  try {
    const snapshot = await dependencies.loadDelivery(input);
    if (!snapshot) return { status: "not_found" };
    phase = "finalization";
    const finalized = await dependencies.finalize(snapshot);
    if (finalized === null) {
      dependencies.logRecoveryPending(phase);
      return { status: "recovery_pending" };
    }
    return { status: "recovered", delivery: finalized.delivery };
  } catch {
    dependencies.logRecoveryPending(phase);
    return { status: "recovery_pending" };
  }
}
