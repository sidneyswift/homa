import { getMapItem, personalizeStatement } from "@homa/core";

import type {
  DeliveryAttempt,
} from "../conversation-continuity/delivery-ledger";
import {
  replyContractForProgressCheckIn,
  type TaskReplyContract,
} from "../conversation-continuity/delivery-policy";
import { liveProgressEnabled } from "./flag";
import type {
  ProgressCheckInBindResult,
  ProgressCheckInContext,
  ProgressCheckInRecord,
  ProgressCheckInResult,
} from "./types";

export interface ProgressDeliveryBindingDependencies {
  listFamilyCheckIns(
    familyId: string,
  ): Promise<ProgressCheckInRecord[]>;
  bindDelivery(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      expectedRevision: number;
      deliveryId: string;
    },
  ): Promise<ProgressCheckInBindResult>;
  pauseUndeliveredPrompt(
    context: ProgressCheckInContext,
    input: {
      checkInId: string;
      expectedRevision: number;
      reason: "delivery_uncertain" | "delivery_failed";
    },
  ): Promise<ProgressCheckInResult>;
  openReplyLoop(input: {
    attempt: DeliveryAttempt;
    contract: TaskReplyContract;
    now?: Date;
  }): Promise<void>;
}

export type ProgressDeliveryBindingResult =
  | { status: "disabled" }
  | { status: "not_delivered" }
  | { status: "no_unique_prompt" }
  | {
      status: "delivery_paused";
      reason: "delivery_uncertain" | "delivery_failed";
    }
  | {
      status: "binding_refused";
      reason: Exclude<
        ProgressCheckInBindResult["status"],
        "bound"
      >;
    }
  | {
      status: "bound";
      checkInId: string;
      revision: number;
    };

function textDeliveryContainsPrompt(
  checkIn: ProgressCheckInRecord,
  content: string | undefined,
): boolean {
  if (content === undefined || checkIn.currentItemId === null) {
    return false;
  }
  const located = getMapItem(checkIn.currentItemId);
  if (!located) return false;
  const prompt = personalizeStatement(
    checkIn.childName,
    located.item,
  ).replace(/\s+/gu, " ");
  return content.replace(/\s+/gu, " ").includes(prompt);
}

/**
 * Requires one exact family, recipient, episode, active, and unbound match.
 * Returning null for both zero and many matches makes guessing impossible.
 */
export function selectSingleUnboundProgressCheckIn(
  checkIns: readonly ProgressCheckInRecord[],
  identity: {
    familyId: string;
    memberUserId: string | null;
    episodeId: string;
    runtimeSessionId?: string;
    turnId?: string;
  },
): ProgressCheckInRecord | null {
  const matches = checkIns.filter(
    (checkIn) =>
      checkIn.familyId === identity.familyId &&
      checkIn.state === "active" &&
      checkIn.currentDeliveryId === null &&
      checkIn.recipientMemberUserId === identity.memberUserId &&
      checkIn.episodeId === identity.episodeId &&
      checkIn.pendingRuntimeSessionId === identity.runtimeSessionId &&
      checkIn.pendingTurnId === identity.turnId,
  );
  return matches.length === 1 ? matches[0] : null;
}

async function openBoundProgressReplyLoop(input: {
  checkIn: ProgressCheckInRecord;
  attempt: DeliveryAttempt;
  now: Date;
  dependencies: ProgressDeliveryBindingDependencies;
}): Promise<ProgressDeliveryBindingResult> {
  await input.dependencies.openReplyLoop({
    attempt: input.attempt,
    contract: replyContractForProgressCheckIn(
      input.checkIn.id,
      input.checkIn.revision,
    ),
    now: input.now,
  });
  return {
    status: "bound",
    checkInId: input.checkIn.id,
    revision: input.checkIn.revision,
  };
}

/**
 * Runs only after the provider or web surface has a successful durable
 * conversation delivery. The strict service bind happens before its reply
 * loop opens, so a failed or stale prompt can never claim the delivery.
 */
export async function bindProgressCheckInAfterSuccessfulDelivery(
  input: {
    attempt: DeliveryAttempt;
    deliverySucceeded?: boolean;
    deliveryOutcome?: "sent" | "uncertain" | "failed";
    runtimeSessionId?: string;
    turnId?: string;
    deliveredContent?: string;
    now?: Date;
  },
  dependencies: ProgressDeliveryBindingDependencies,
): Promise<ProgressDeliveryBindingResult> {
  if (!liveProgressEnabled()) {
    return { status: "disabled" };
  }
  const deliveryOutcome =
    input.deliveryOutcome === undefined
      ? input.deliverySucceeded === true
        ? "sent"
        : "failed"
      : input.deliveryOutcome;
  const checkIns = await dependencies.listFamilyCheckIns(
    input.attempt.familyId,
  );
  const alreadyBound = checkIns.filter(
    (checkIn) =>
      checkIn.familyId === input.attempt.familyId &&
      checkIn.state === "active" &&
      checkIn.currentDeliveryId === input.attempt.id &&
      checkIn.recipientMemberUserId ===
        input.attempt.memberUserId &&
      checkIn.episodeId === input.attempt.episodeId,
  );
  const now = input.now ?? new Date();
  if (deliveryOutcome === "sent" && alreadyBound.length === 1) {
    return openBoundProgressReplyLoop({
      checkIn: alreadyBound[0],
      attempt: input.attempt,
      now,
      dependencies,
    });
  }
  if (alreadyBound.length > 1) {
    return { status: "no_unique_prompt" };
  }
  const checkIn = selectSingleUnboundProgressCheckIn(checkIns, {
    familyId: input.attempt.familyId,
    memberUserId: input.attempt.memberUserId,
    episodeId: input.attempt.episodeId,
    runtimeSessionId: input.runtimeSessionId,
    turnId: input.turnId,
  });
  if (!checkIn) return { status: "no_unique_prompt" };
  const context: ProgressCheckInContext = {
    familyId: input.attempt.familyId,
    memberUserId: input.attempt.memberUserId,
    channel: input.attempt.channel,
    providerMessageId: null,
    repliedDeliveryId: null,
    episodeId: input.attempt.episodeId,
    runtimeSessionId:
      input.runtimeSessionId ??
      checkIn.pendingRuntimeSessionId ??
      "",
    turnId: input.turnId ?? checkIn.pendingTurnId ?? "",
    canonicalInboundText: null,
    inboundMessageId: null,
    now: now.toISOString(),
  };
  if (deliveryOutcome !== "sent") {
    const reason =
      deliveryOutcome === "uncertain"
        ? "delivery_uncertain"
        : "delivery_failed";
    const paused = await dependencies.pauseUndeliveredPrompt(
      context,
      {
        checkInId: checkIn.id,
        expectedRevision: checkIn.revision,
        reason,
      },
    );
    return paused.status === "paused"
      ? { status: "delivery_paused", reason }
      : { status: "no_unique_prompt" };
  }
  if (
    (
      input.attempt.channel === "sms" ||
      input.attempt.channel === "email"
    ) &&
    !textDeliveryContainsPrompt(checkIn, input.deliveredContent)
  ) {
    return { status: "no_unique_prompt" };
  }

  const binding = await dependencies.bindDelivery(
    context,
    {
      checkInId: checkIn.id,
      expectedRevision: checkIn.revision,
      deliveryId: input.attempt.id,
    },
  );
  if (binding.status !== "bound") {
    return {
      status: "binding_refused",
      reason: binding.status,
    };
  }
  return openBoundProgressReplyLoop({
    checkIn: binding.checkIn,
    attempt: input.attempt,
    now,
    dependencies,
  });
}
